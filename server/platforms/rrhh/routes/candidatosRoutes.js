const express = require('express');
const router = express.Router();
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const Tecnico = require('../../agentetelecom/models/Tecnico');
const { invalidarCacheValorizacion } = require('../../agentetelecom/utils/calculoEngine');
const { handlePortalAccess } = require('../../auth/authAutomation');
const { protect, authorize } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

const normalizeRut = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();
const isHighLevelRole = (role) => [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN].includes(String(role || '').toLowerCase());
const hasModulePerm = (user, moduleKey, action) => {
    const perms = user?.permisosModulos || {};
    const bucket = perms instanceof Map ? perms.get(moduleKey) : perms[moduleKey];
    return Boolean(bucket && bucket[action] === true);
};

function bumpValorizacionVersion(empresaRef) {
    const key = String(empresaRef || '');
    if (!key) return;
    if (!process.__mapValVersionByEmpresa) process.__mapValVersionByEmpresa = {};
    process.__mapValVersionByEmpresa[key] = (process.__mapValVersionByEmpresa[key] || 0) + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Actualizar dotacion.cubiertos en el Proyecto al cambiar status
// Esto conecta el flujo Candidato <-> Proyecto automáticamente
// ─────────────────────────────────────────────────────────────────────────────
const CONTRATADO_STATUS = 'Contratado';
const BAJA_STATUSES = ['Finiquitado', 'Retirado', 'Rechazado', 'Inactivo'];

async function updateProyectoCubiertos(candidato, oldStatus, newStatus) {
    if (!candidato.projectId && !candidato.ceco) return;

    const wasActive = oldStatus === CONTRATADO_STATUS;
    const nowActive = newStatus === CONTRATADO_STATUS;
    const nowBaja = BAJA_STATUSES.includes(newStatus);

    // Only act if there is a relevant transition
    if (!wasActive && !nowActive) return;
    if (wasActive && !nowBaja && !nowActive) return;

    try {
        // Find the project by ObjectId OR ceco+nombre
        let proyecto = null;
        if (candidato.projectId) {
            proyecto = await Proyecto.findById(candidato.projectId);
        }
        if (!proyecto && candidato.ceco) {
            proyecto = await Proyecto.findOne({
                centroCosto: candidato.ceco,
                $or: [
                    { nombreProyecto: candidato.projectName },
                    { projectName: candidato.projectName }
                ]
            });
        }
        if (!proyecto) return;

        const cargo = candidato.position;
        const sede = candidato.sede;
        const depto = candidato.departamento;

        const dotItem = proyecto.dotacion.find(d =>
            d.cargo?.toLowerCase().trim() === cargo?.toLowerCase().trim() &&
            (!d.sede || d.sede === sede) &&
            (!d.departamento || d.departamento === depto)
        );
        if (!dotItem) return;

        if (!wasActive && nowActive) {
            // Just got hired → increment cubiertos
            dotItem.cubiertos = Math.min((dotItem.cubiertos || 0) + 1, dotItem.cantidad);
        } else if (wasActive && (nowBaja || !nowActive)) {
            // Was hired, now left → decrement cubiertos
            dotItem.cubiertos = Math.max((dotItem.cubiertos || 1) - 1, 0);
        }

        proyecto.updatedAt = new Date();
        await proyecto.save();
    } catch (e) {
        console.error('⚠️ updateProyectoCubiertos error:', e.message);
    }
}

async function syncToTecnico(candidato, empresaRef, opts = {}) {
    const { createIfMissing = true } = opts;
    if (!candidato || !candidato.rut) {
        console.log('❌ syncToTecnico: candidato o rut ausente');
        return;
    }

    try {
        console.log(`\n🔄 syncToTecnico START: RUT=${candidato.rut}, projectId=${candidato.projectId}, createIfMissing=${createIfMissing}`);
        
        // 🔒 FILTRO POR EMPRESA
        let existe = await Tecnico.findOne({ rut: candidato.rut, empresaRef });
        console.log(`📍 Tecnico existe en DB: ${!!existe ? 'SÍ' : 'NO'}`);

        if (existe) {
            console.log(`📝 Actualizando Tecnico existente...`);
            // ALWAYS actualizar estos campos clave — sin esperar a que cambien
            const updateData = {
                projectId: candidato.projectId || null,
                sede: candidato.sede || existe.sede,
                departamento: candidato.departamento || existe.departamento,
                ceco: candidato.ceco || existe.ceco,
                cargo: candidato.position || existe.cargo,
                area: candidato.area || existe.area,
                estadoActual: (candidato.status === 'Inactivo' || candidato.status === 'Suspendido' || candidato.status === 'Bloqueado') ? 'INACTIVO' : 
                             (candidato.status === 'Licencia Médica') ? 'LICENCIA MEDICA' :
                             (candidato.status === 'Finiquitado') ? 'FINIQUITADO' : 'OPERATIVO',
                idRecursoToa: candidato.idRecursoToa || '',
                email: candidato.email || existe.email,
                telefono: candidato.phone || existe.telefono,
                sueldoBase: candidato.sueldoBase !== undefined ? candidato.sueldoBase : existe.sueldoBase,
                // Otros campos importantes
                nombres: candidato.fullName?.split(' ')[0] || existe.nombres || 'Sin Nombre',
                apellidos: candidato.fullName?.split(' ').slice(1).join(' ') || existe.apellidos || 'Sin Apellido',
                fechaNacimiento: candidato.fechaNacimiento || existe.fechaNacimiento,
                nacionalidad: candidato.nationality || existe.nacionalidad || 'CHILENA',
                estadoCivil: candidato.estadoCivil || existe.estadoCivil,
                previsionSalud: candidato.previsionSalud || existe.previsionSalud,
                afp: candidato.afp || existe.afp,
                tieneCargas: candidato.tieneCargas || existe.tieneCargas,
                updatedAt: new Date()
            };
            
            console.log(`📊 Nuevos datos:`, JSON.stringify(updateData).substring(0, 200));
            
            // Usar updateOne para forzar guardado en Mongo
            const result = await Tecnico.updateOne(
                { _id: existe._id },
                { $set: updateData }
            );
            
            console.log(`✅ Tecnico actualizado en MongoDB: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
            
            // Invalidar cache y bumpar version
            invalidarCacheValorizacion(empresaRef);
            bumpValorizacionVersion(empresaRef);
            console.log(`🔄 Cache invalidado y versión bumped para empresa ${empresaRef}`);
            return;
        }

        if (!createIfMissing) {
            console.log(`⏭️ Tecnico no existe y createIfMissing=false, saltando creación`);
            return;
        }

        console.log(`✨ Creando nuevo Tecnico...`);
        
        let nombres = candidato.fullName || 'Sin Nombre';
        let apellidos = 'Sin Apellido';
        if (candidato.fullName && candidato.fullName.includes(' ')) {
            const parts = candidato.fullName.split(' ');
            nombres = parts[0];
            apellidos = parts.slice(1).join(' ');
        }

        const nuevoTecnico = new Tecnico({
            rut: candidato.rut,
            empresaRef: empresaRef,
            nombres,
            apellidos,
            fechaNacimiento: candidato.fechaNacimiento,
            nacionalidad: candidato.nationality || 'CHILENA',
            estadoCivil: candidato.estadoCivil,
            calle: candidato.calle,
            numero: candidato.numero,
            deptoBlock: candidato.deptoBlock,
            comuna: candidato.comuna,
            region: candidato.region,
            email: candidato.email,
            telefono: candidato.phone,
            cargo: candidato.position,
            area: candidato.area,
            departamento: candidato.departamento,
            sede: candidato.sede,
            projectId: candidato.projectId,
            ceco: candidato.ceco,
            fechaIngreso: candidato.contractStartDate || new Date(),
            tipoContrato: candidato.contractType,
            estadoActual: (candidato.status === 'Inactivo' || candidato.status === 'Suspendido' || candidato.status === 'Bloqueado') ? 'INACTIVO' : 
                         (candidato.status === 'Licencia Médica') ? 'LICENCIA MEDICA' :
                         (candidato.status === 'Finiquitado') ? 'FINIQUITADO' : 'OPERATIVO',
            previsionSalud: candidato.previsionSalud,
            isapreNombre: candidato.isapreNombre,
            valorPlan: candidato.valorPlan,
            monedaPlan: candidato.monedaPlan,
            afp: candidato.afp,
            pensionado: candidato.pensionado,
            tieneCargas: candidato.tieneCargas,
            listaCargas: candidato.listaCargas?.map(c => ({
                rut: c.rut,
                nombre: c.fullName || c.nombre,
                parentesco: c.parentesco
            })) || [],
            banco: candidato.banco,
            tipoCuenta: candidato.tipoCuenta,
            numeroCuenta: candidato.numeroCuenta,
            sueldoBase: candidato.sueldoBase,
            requiereLicencia: candidato.requiereLicencia,
            fechaVencimientoLicencia: candidato.fechaVencimientoLicencia,
            idRecursoToa: candidato.idRecursoToa || ''
        });

        const saved = await nuevoTecnico.save();
        console.log(`✅ Tecnico CREADO y guardado: ${saved._id}`);
        
        invalidarCacheValorizacion(empresaRef);
        bumpValorizacionVersion(empresaRef);
        console.log(`🔄 Cache invalidado y versión bumped después de crear`);
        
    } catch (e) {
        console.error(`❌ syncToTecnico ERROR: ${e.message}`);
        console.error(e.stack);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Sanitizar datos del candidato (Convertir "SIN TÉRMINO" a null)
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeCandidatoData(data) {
    if (!data) return data;
    if (data._id) delete data._id;

    // Campos de fecha a limpiar (convertir cadena vacía a null)
    const fieldsToClean = [
        'contractEndDate', 'nextAddendumDate', 'fechaNacimiento', 
        'idExpiryDate', 'fechaVencimientoLicencia', 'fechaInicioContrato',
        'fechaProximoHito', 'fechaOperativa'
    ];
    
    fieldsToClean.forEach(field => {
        if (data[field] === 'SIN TÉRMINO' || data[field] === '') {
            data[field] = null;
        }
    });

    // Manejo de IDs (convertir cadena vacía a null para evitar error de casting ObjectId)
    if (data.clienteId === '') {
        data.clienteId = null;
    }
    if (data.projectId === '') {
        data.projectId = null;
    }

    if (data.hiring) {
        if (data.hiring.contractEndDate === 'SIN TÉRMINO' || data.hiring.contractEndDate === '') {
            data.hiring.contractEndDate = null;
        }
        if (data.hiring.contractStartDate === '') {
            data.hiring.contractStartDate = null;
        }
    }

    return data;
}

// ── GET all candidatos ──────────────────────────────────────────────
router.get('/', protect, authorize('admin', 'rrhh_captura', ROLES.SUPERVISOR), async (req, res) => {
    try {
        const { status, position, projectId, includeAll, includeInactive } = req.query;
        let filter;
        if (['system_admin', 'ceo'].includes(req.user.role)) {
            filter = {};
        } else if (req.user.role === 'admin') {
            filter = {
                $or: [ { empresaRef: req.user.empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ]
            };
        } else {
            filter = { empresaRef: req.user.empresaRef };
        }

        if (includeInactive !== 'true') filter.isActive = true;
        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',').map(s => s.trim()) };
            } else {
                filter.status = status;
            }
        }
        if (position) filter.position = new RegExp(position, 'i');
        if (projectId) filter.projectId = projectId;
        if (req.query.empresaRef && ['system_admin', 'ceo'].includes(req.user.role)) {
            filter.empresaRef = req.query.empresaRef;
        }

        // 🔒 SUPERVISOR FILTER: Solo puede ver su propia dotación si el rol es supervisor
        const isSupervisor = String(req.user.role).toLowerCase() === ROLES.SUPERVISOR;
        const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());
        
        if (isSupervisor && !isHighLevel) {
            const misTecnicos = await Tecnico.find({ supervisorId: req.user._id }).select('rut');
            const misRuts = misTecnicos.map(t => t.rut).filter(Boolean);
            filter.rut = { $in: misRuts };
        }

        const candidatos = await Candidato.find(filter)
            .populate('projectId', 'nombreProyecto projectName centroCosto area')
            .populate('empresaRef', 'nombre rut slug')
            .sort({ updatedAt: -1 })
            .lean();

        // 🔒 BLINDAJE DE DATOS SENSIBLES PARA SUPERVISORES
        if (!isHighLevel) {
            candidatos.forEach(c => {
                if (String(req.user.role).toLowerCase() === ROLES.SUPERVISOR) {
                    if (c.hiring) delete c.hiring.salary;
                    delete c.bonuses;
                    delete c.sueldoBase;
                    delete c.banco;
                    delete c.tipoCuenta;
                    delete c.numeroCuenta;
                }
            });
        }

        res.json(candidatos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/finiquitos', protect, async (req, res) => {
    try {
        const { proyecto, ceco, desde, hasta } = req.query;
        let filter = { status: 'Finiquitado', isActive: true };

        if (['system_admin', 'ceo'].includes(req.user.role)) {
            // sin filtro de empresa
        } else if (req.user.role === 'admin') {
            filter.$or = [
                { empresaRef: req.user.empresaRef },
                { empresaRef: null },
                { empresaRef: { $exists: false } }
            ];
        } else {
            filter.empresaRef = req.user.empresaRef;
        }

        if (proyecto) filter.projectId = proyecto;
        if (ceco) filter.ceco = ceco;
        if (desde || hasta) {
            filter.fechaFiniquito = {};
            if (desde) filter.fechaFiniquito.$gte = new Date(desde);
            if (hasta) filter.fechaFiniquito.$lte = new Date(hasta);
        }

        const lista = await Candidato.find(filter)
            .populate('projectId', 'nombreProyecto centroCosto')
            .populate('empresaRef', 'nombre')
            .sort({ fechaFiniquito: -1 });
        res.json(lista);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /sincronizar-base — ACTUALIZAR BASE CON TODA LA INFORMACIÓN DE CANDIDATOS
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/sincronizar-base', protect, authorize('admin', 'rrhh_captura:editar'), async (req, res) => {
    try {
        console.log('\n' + '═'.repeat(80));
        console.log('🔄 POST /sincronizar-base INICIADO');
        console.log('═'.repeat(80));

        const empresaId = req.user.empresaRef;
        console.log(`👤 Usuario: ${req.user.email}`);
        console.log(`🏢 Empresa: ${empresaId}`);

        // 1. OBTENER TODOS LOS CANDIDATOS DE LA EMPRESA
        let filter = { isActive: true };
        if (['system_admin', 'ceo'].includes(req.user.role)) {
            // sin filtro de empresa
        } else if (req.user.role === 'admin') {
            filter.$or = [
                { empresaRef: empresaId },
                { empresaRef: null },
                { empresaRef: { $exists: false } }
            ];
        } else {
            filter.empresaRef = empresaId;
        }

        const candidatos = await Candidato.find(filter)
            .populate('projectId', 'nombreProyecto centroCosto')
            .lean();

        console.log(`\n📊 CANDIDATOS ENCONTRADOS: ${candidatos.length}`);

        // 2. PROCESAR CADA CANDIDATO
        let updated = 0;
        let synced = 0;
        let errors = [];

        for (const candidato of candidatos) {
            try {
                // Asegurar que tenga empresaRef
                if (!candidato.empresaRef && empresaId) {
                    await Candidato.findByIdAndUpdate(candidato._id, { empresaRef: empresaId });
                    updated++;
                }

                // Sincronizar a tabla Tecnico
                await syncToTecnico(candidato, empresaId, { createIfMissing: true });
                synced++;

                if ((synced % 10) === 0) {
                    console.log(`  ✓ Sincronizados ${synced}/${candidatos.length}...`);
                }
            } catch (err) {
                console.error(`  ❌ Error sincronizando ${candidato.rut}:`, err.message);
                errors.push({
                    rut: candidato.rut,
                    fullName: candidato.fullName,
                    error: err.message
                });
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('✅ SINCRONIZACIÓN COMPLETADA');
        console.log('═'.repeat(80));
        console.log(`📈 Estadísticas:`);
        console.log(`   • Total candidatos procesados: ${candidatos.length}`);
        console.log(`   • Sincronizados exitosamente: ${synced}`);
        console.log(`   • Actualizaciones empresaRef: ${updated}`);
        console.log(`   • Errores encontrados: ${errors.length}`);

        if (errors.length > 0) {
            console.log(`\n⚠️ Errores:`);
            errors.forEach(e => {
                console.log(`   - ${e.rut} (${e.fullName}): ${e.error}`);
            });
        }

        console.log('═'.repeat(80) + '\n');

        // 3. RETORNAR RESULTADO
        res.json({
            success: true,
            message: 'Base de datos actualizada exitosamente',
            stats: {
                totalCandidatos: candidatos.length,
                sinronizados: synced,
                actualizacionesEmpresa: updated,
                errores: errors.length
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (err) {
        console.error('❌ /sincronizar-base ERROR:', err.message);
        console.error(err.stack);
        res.status(500).json({
            success: false,
            message: err.message,
            error: err.stack
        });
    }
});

router.get('/rut/:rut', protect, async (req, res) => {
    try {
        const rawRut = req.params.rut.trim();
        const r = rawRut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        let filter;

        if (['system_admin', 'ceo'].includes(req.user.role)) { 
            filter = { $or: [{ rut: r }, { rut: rawRut }] }; 
        } else if (req.user.role === 'admin') {
            filter = { 
                $and: [
                    { $or: [{ rut: r }, { rut: rawRut }] },
                    { $or: [ { empresaRef: req.user.empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ] }
                ]
            };
        } else { 
            filter = { 
                $and: [
                    { $or: [{ rut: r }, { rut: rawRut }] },
                    { empresaRef: req.user.empresaRef }
                ]
            }; 
        }
        let candidato = await Candidato.findOne(filter).populate('projectId').populate('empresaRef');
        
        // Fallback: Si no se encuentra por RUT, intentar por email del usuario logueado (Cruce Portal Colaborador)
        if (!candidato && req.user.email) {
            candidato = await Candidato.findOne({ email: req.user.email }).populate('projectId').populate('empresaRef');
        }

        if (!candidato) return res.status(404).json({ message: 'No encontrado' });
        res.json(candidato);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', protect, async (req, res) => {
    try {
        if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'ID de candidato inválido' });
        }
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef }).populate('projectId').populate('empresaRef');
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        res.json(c);
    } catch (err) { 
        console.error('GET /api/rrhh/candidatos/:id ERROR:', err);
        res.status(500).json({ message: err.message, stack: err.stack }); 
    }
});

router.post('/bulk', protect, authorize('admin', 'rrhh_captura:crear'), async (req, res) => {
    try {
        const rows = Array.isArray(req.body.candidatos) ? req.body.candidatos : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'No se enviaron registros para procesar' });
        }

        console.log(`\n📥 CARGA MASIVA: Procesando ${rows.length} registros para la empresa ${req.user.empresaRef}...`);

        let createdCount = 0;
        let updatedCount = 0;
        let errors = [];

        const parseCustomDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            const s = String(val).trim();
            if (!s || s === 'SIN TÉRMINO' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NULL' || s === 'undefined') return null;

            // Si es formato ISO
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            }

            // Si es formato DD/MM/AAAA o DD-MM-AAAA
            const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1; // 0-indexed
                const year = parseInt(match[3], 10);
                const d = new Date(year, month, day);
                return isNaN(d.getTime()) ? null : d;
            }

            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const cleanRut = normalizeRut(row.rut);
                if (!cleanRut) {
                    throw new Error(`RUT inválido o vacío en la fila ${i + 1}`);
                }

                if (!row.fullName || !String(row.fullName).trim()) {
                    throw new Error(`Nombre Completo es requerido (RUT: ${cleanRut})`);
                }

                if (!row.position || !String(row.position).trim()) {
                    throw new Error(`Cargo es requerido (RUT: ${cleanRut})`);
                }

                // Intentar resolver Proyecto
                let projectId = null;
                let projectName = row.projectName || '';
                if (projectName) {
                    const matchedProj = await Proyecto.findOne({
                        empresaRef: req.user.empresaRef,
                        $or: [
                            { nombreProyecto: new RegExp('^' + projectName.trim() + '$', 'i') },
                            { projectName: new RegExp('^' + projectName.trim() + '$', 'i') }
                        ]
                    }).select('_id nombreProyecto projectName').lean();

                    if (matchedProj) {
                        projectId = matchedProj._id;
                        projectName = matchedProj.nombreProyecto || matchedProj.projectName;
                    }
                }

                // Intentar resolver Cliente
                let clienteId = null;
                let clienteNombre = row.clienteNombre || '';
                if (clienteNombre) {
                    const Cliente = require('../../agentetelecom/models/Cliente');
                    const matchedCli = await Cliente.findOne({
                        empresaRef: req.user.empresaRef,
                        nombre: new RegExp('^' + clienteNombre.trim() + '$', 'i')
                    }).select('_id nombre').lean();

                    if (matchedCli) {
                        clienteId = matchedCli._id;
                        clienteNombre = matchedCli.nombre;
                    }
                }

                let candidato = await Candidato.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef });

                const mapped = {
                    fullName: String(row.fullName).trim(),
                    email: row.email ? String(row.email).trim().toLowerCase() : '',
                    phone: row.phone ? String(row.phone).trim() : '',
                    fechaNacimiento: parseCustomDate(row.fechaNacimiento),
                    estadoCivil: row.estadoCivil || 'Soltero(a)',
                    nationality: row.nationality || 'Chilena',
                    birthPlace: row.birthPlace || '',
                    idExpiryDate: parseCustomDate(row.idExpiryDate),
                    gender: row.gender || 'No Informado',
                    address: row.address || '',
                    calle: row.calle || '',
                    numero: row.numero || '',
                    deptoBlock: row.deptoBlock || '',
                    comuna: row.comuna || '',
                    region: row.region || '',
                    idRecursoToa: row.idRecursoToa || '',
                    position: String(row.position).trim(),
                    educationLevel: row.educationLevel || '',
                    ceco: row.ceco || '',
                    area: row.area || '',
                    departamento: row.departamento || '',
                    sede: row.sede || '',
                    projectName: projectName || '',
                    projectId: projectId || null,
                    clienteId: clienteId || null,
                    clienteNombre: clienteNombre || '',
                    status: row.status || 'Contratado',
                    contractType: row.contractType || 'PLAZO FIJO',
                    contractStartDate: parseCustomDate(row.contractStartDate) || new Date(),
                    contractDurationDays: row.contractDurationDays ? (parseInt(row.contractDurationDays, 10) || 30) : 30,
                    contractEndDate: parseCustomDate(row.contractEndDate),
                    operationalStartDate: parseCustomDate(row.operationalStartDate),
                    emergencyContact: row.emergencyContact || '',
                    emergencyPhone: row.emergencyPhone || '',
                    emergencyEmail: row.emergencyEmail || '',
                    previsionSalud: row.previsionSalud || 'FONASA',
                    isapreNombre: row.isapreNombre || '',
                    valorPlan: row.valorPlan || '',
                    monedaPlan: row.monedaPlan || 'UF',
                    afp: row.afp || '',
                    pensionado: (row.pensionado && (String(row.pensionado).toUpperCase() === 'SI' || String(row.pensionado).toUpperCase() === 'SÍ')) ? 'SI' : 'NO',
                    bloodType: row.bloodType || '',
                    allergies: row.allergies || '',
                    chronicDiseases: row.chronicDiseases || '',
                    hasDisability: Boolean(row.hasDisability && (String(row.hasDisability).toUpperCase() === 'SI' || String(row.hasDisability).toUpperCase() === 'SÍ' || row.hasDisability === true)),
                    disabilityType: row.disabilityType || '',
                    tieneCargas: (row.tieneCargas && (String(row.tieneCargas).toUpperCase() === 'SI' || String(row.tieneCargas).toUpperCase() === 'SÍ')) ? 'SI' : 'NO',
                    banco: row.banco || '',
                    tipoCuenta: row.tipoCuenta || '',
                    numeroCuenta: row.numeroCuenta || '',
                    sueldoBase: row.sueldoBase ? (parseFloat(row.sueldoBase) || 0) : 0,
                    requiereLicencia: (row.requiereLicencia && (String(row.requiereLicencia).toUpperCase() === 'SI' || String(row.requiereLicencia).toUpperCase() === 'SÍ')) ? 'SI' : 'NO',
                    fechaVencimientoLicencia: parseCustomDate(row.fechaVencimientoLicencia),
                    shirtSize: row.shirtSize || '',
                    pantsSize: row.pantsSize || '',
                    jacketSize: row.jacketSize || '',
                    shoeSize: row.shoeSize || '',
                    isActive: true
                };

                if (candidato) {
                    Object.assign(candidato, mapped);
                    candidato.updatedAt = new Date();
                    candidato.history.push({ action: 'Carga Masiva', description: 'Registro actualizado vía importación masiva', user: req.user?.name || 'Sistema' });
                    const saved = await candidato.save();
                    await syncToTecnico(saved, req.user.empresaRef);
                    updatedCount++;
                } else {
                    candidato = new Candidato({
                        ...mapped,
                        rut: cleanRut,
                        empresaRef: req.user.empresaRef,
                        history: [{ action: 'Carga Masiva', description: 'Registro creado vía importación masiva', user: req.user?.name || 'Sistema' }]
                    });
                    const saved = await candidato.save();
                    await syncToTecnico(saved, req.user.empresaRef);
                    createdCount++;
                }
            } catch (err) {
                console.error(`❌ Error importando fila ${i + 1}:`, err.message);
                errors.push({
                    fila: i + 1,
                    rut: row.rut || 'S/N',
                    fullName: row.fullName || 'S/N',
                    error: err.message
                });
            }
        }

        res.json({
            success: true,
            stats: {
                total: rows.length,
                creados: createdCount,
                actualizados: updatedCount,
                errores: errors.length
            },
            errors: errors.length > 0 ? errors : null
        });

    } catch (err) {
        console.error('❌ POST /api/rrhh/candidatos/bulk ERROR:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/bulk-finiquitos', protect, authorize('admin', 'rrhh_captura:editar'), async (req, res) => {
    try {
        const rows = Array.isArray(req.body.finiquitos) ? req.body.finiquitos : [];
        if (rows.length === 0) {
            return res.status(400).json({ message: 'No se enviaron registros para procesar' });
        }

        console.log(`\n📥 CARGA MASIVA FINIQUITOS: Procesando ${rows.length} registros...`);

        // Helper parsers inside the function
        const parseExcelDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return val;
            if (typeof val === 'number' || !isNaN(Number(val))) {
                const num = Number(val);
                const date = new Date(Math.round((num - 25569) * 86400 * 1000));
                return isNaN(date.getTime()) ? null : date;
            }
            const s = String(val).trim();
            if (!s || s === 'SIN TÉRMINO' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NULL' || s === 'undefined') return null;

            if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            }

            const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (match) {
                const day = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const year = parseInt(match[3], 10);
                const d = new Date(year, month, day);
                return isNaN(d.getTime()) ? null : d;
            }

            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        };

        const mapCausal = (val) => {
            if (!val) return null;
            const s = String(val).trim().toLowerCase();
            if (s.includes('necesidad') || s.includes('161')) {
                return 'Necesidades de la empresa (Art. 161)';
            }
            if (s.includes('renuncia') || s.includes('159 n°2') || s.includes('159 no 2') || s.includes('159-2')) {
                return 'Renuncia voluntaria (Art. 159 N°2)';
            }
            if (s.includes('mutuo') || s.includes('159 n°1') || s.includes('159 no 1') || s.includes('159-1')) {
                return 'Mutuo acuerdo (Art. 159 N°1)';
            }
            if (s.includes('vencimiento') || s.includes('plazo') || s.includes('159 n°4') || s.includes('159 no 4') || s.includes('159-4')) {
                return 'Vencimiento del plazo (Art. 159 N°4)';
            }
            if (s.includes('caso fortuito') || s.includes('fuerza mayor') || s.includes('159 n°6') || s.includes('159 no 6') || s.includes('159-6')) {
                return 'Caso fortuito o fuerza mayor (Art. 159 N°6)';
            }
            if (s.includes('probidad') || s.includes('160')) {
                return 'Falta de probidad (Art. 160)';
            }
            if (s.includes('abandono') || s.includes('160 n°4') || s.includes('160 no 4') || s.includes('160-4')) {
                return 'Abandono del trabajo (Art. 160 N°4)';
            }
            return 'Otro';
        };

        // Paso 1: Validación Completa ("Todo o Nada")
        const rowErrors = [];
        const validRowsData = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const lineNum = i + 1;

            const cleanRut = normalizeRut(row.RUT || row.rut);
            if (!cleanRut) {
                rowErrors.push(`Fila ${lineNum}: El RUT es obligatorio o inválido.`);
                continue;
            }

            // Buscar Candidato
            const candidate = await Candidato.findOne({ rut: cleanRut, empresaRef: req.user.empresaRef });
            if (!candidate) {
                rowErrors.push(`Fila ${lineNum}: Colaborador con RUT ${row.RUT || row.rut} no registrado.`);
                continue;
            }

            if (candidate.status === 'Finiquitado') {
                rowErrors.push(`Fila ${lineNum}: El colaborador ${candidate.fullName} ya se encuentra finiquitado.`);
                continue;
            }

            // Validar Fecha de Egreso
            const rawFechaEgreso = row['Fecha Egreso'] || row.fechaEgreso;
            if (!rawFechaEgreso) {
                rowErrors.push(`Fila ${lineNum}: La Fecha de Egreso es obligatoria.`);
                continue;
            }

            const fechaEgreso = parseExcelDate(rawFechaEgreso);
            if (!fechaEgreso) {
                rowErrors.push(`Fila ${lineNum}: La Fecha de Egreso '${rawFechaEgreso}' no tiene un formato válido (use YYYY-MM-DD o Excel Date).`);
                continue;
            }

            const fechaIngreso = candidate.contractStartDate ? new Date(candidate.contractStartDate) : new Date(candidate.createdAt);
            if (fechaEgreso < fechaIngreso) {
                rowErrors.push(`Fila ${lineNum}: La fecha de egreso (${fechaEgreso.toISOString().slice(0, 10)}) no puede ser anterior a la de ingreso (${fechaIngreso.toISOString().slice(0, 10)}).`);
                continue;
            }

            // Validar Causal
            const rawCausal = row['Causal Término'] || row.causalTermino;
            if (!rawCausal) {
                rowErrors.push(`Fila ${lineNum}: La Causal de Término es obligatoria.`);
                continue;
            }

            const causalTermino = mapCausal(rawCausal);
            if (!causalTermino) {
                rowErrors.push(`Fila ${lineNum}: Causal de término no válida.`);
                continue;
            }

            // Buscar si tiene Licencia Médica activa aprobada que coincida con la fecha de egreso
            const activeLicencia = (candidate.vacaciones || []).find(v => {
                if (v.tipo === 'Licencia Médica' && v.estado === 'Aprobado' && v.fechaInicio && v.fechaFin) {
                    const inicio = new Date(v.fechaInicio);
                    const fin = new Date(v.fechaFin);
                    const egresoDate = new Date(fechaEgreso);
                    egresoDate.setHours(0,0,0,0);
                    inicio.setHours(0,0,0,0);
                    fin.setHours(0,0,0,0);
                    return egresoDate >= inicio && egresoDate <= fin;
                }
                return false;
            });

            if (activeLicencia && causalTermino === 'Necesidades de la empresa (Art. 161)') {
                const initStr = new Date(activeLicencia.fechaInicio).toLocaleDateString('es-CL');
                const finStr = new Date(activeLicencia.fechaFin).toLocaleDateString('es-CL');
                rowErrors.push(`Fila ${lineNum}: El colaborador ${candidate.fullName} tiene una Licencia Médica aprobada vigente (desde ${initStr} hasta ${finStr}) que coincide con la fecha de egreso. La ley prohíbe desvincular a un colaborador bajo el Art. 161 con licencia médica activa.`);
                continue;
            }

            // Validar Fecha de Notificación si la causal es Art. 161
            const rawFechaNotificacion = row['Fecha Notificación'] || row.fechaNotificacion;
            let fechaNotificacion = null;
            if (rawFechaNotificacion) {
                fechaNotificacion = parseExcelDate(rawFechaNotificacion);
                if (!fechaNotificacion) {
                    rowErrors.push(`Fila ${lineNum}: La Fecha de Notificación '${rawFechaNotificacion}' no tiene un formato válido (use YYYY-MM-DD o Excel Date).`);
                    continue;
                }
            }

            // Recolectar parámetros opcionales
            const parseVal = (name, def = 0) => {
                const val = row[name];
                if (val === undefined || val === null || val === '') return def;
                const num = Number(val);
                return isNaN(num) ? def : num;
            };

            const pagarDiasProporcionalesRaw = row['Pagar Días Proporcionales (SI/NO)'] || row.pagarDiasProporcionales;
            const pagarDiasProporcionales = (pagarDiasProporcionalesRaw === 'SI' || pagarDiasProporcionalesRaw === 'si' || pagarDiasProporcionalesRaw === 'Si' || pagarDiasProporcionalesRaw === true || String(pagarDiasProporcionalesRaw).toLowerCase() === 'true');
            const diasTrabajadosMes = parseVal('Días Trabajados Mes', 0);
            
            let diasVacacionesTomados = row['Vacaciones Tomadas Override'] !== undefined && row['Vacaciones Tomadas Override'] !== null && row['Vacaciones Tomadas Override'] !== ''
                ? Number(row['Vacaciones Tomadas Override'])
                : null;
            if (diasVacacionesTomados === null || isNaN(diasVacacionesTomados)) {
                const totalTomadas = (candidate.vacaciones || []).reduce((sum, v) => sum + (v.diasHabiles || 0), 0);
                diasVacacionesTomados = totalTomadas;
            }

            const diasVacacionesProgresivas = parseVal('Vacaciones Progresivas', 0);
            const valorUF = parseVal('Valor UF', 38500);
            const otrosHaberes = parseVal('Otros Haberes', 0);
            const otrosDescuentos = parseVal('Otros Descuentos', 0);
            const descuentoPrestamoCaja = parseVal('Préstamo Caja', 0);
            const descuentoPrestamoEmpresa = parseVal('Préstamo Empresa', 0);
            const descuentoAnticipos = parseVal('Anticipos', 0);
            const indemnizacionVoluntaria = parseVal('Indemnización Voluntaria', 0);
            const aguinaldosOtros = parseVal('Aguinaldos y Otros', 0);
            const descuentoSeguroColectivo = parseVal('Seguro Colectivo', 0);
            const descuentoEquiposNoDevueltos = parseVal('Equipos No Devueltos', 0);

            const descuentoAfpProporcional = row['AFP Proporcional Override'] !== undefined && row['AFP Proporcional Override'] !== null && row['AFP Proporcional Override'] !== ''
                ? Number(row['AFP Proporcional Override'])
                : null;
            const descuentoSaludProporcional = row['Salud Proporcional Override'] !== undefined && row['Salud Proporcional Override'] !== null && row['Salud Proporcional Override'] !== ''
                ? Number(row['Salud Proporcional Override'])
                : null;
            const descuentoAfcProporcional = row['AFC Proporcional Override'] !== undefined && row['AFC Proporcional Override'] !== null && row['AFC Proporcional Override'] !== ''
                ? Number(row['AFC Proporcional Override'])
                : null;

            validRowsData.push({
                candidate,
                fechaIngreso,
                fechaEgreso,
                fechaNotificacion,
                causalTermino,
                pagarDiasProporcionales,
                diasTrabajadosMes,
                diasVacacionesTomados,
                diasVacacionesProgresivas,
                valorUF,
                otrosHaberes,
                otrosDescuentos,
                descuentoPrestamoCaja,
                descuentoPrestamoEmpresa,
                descuentoAnticipos,
                indemnizacionVoluntaria,
                aguinaldosOtros,
                descuentoSeguroColectivo,
                descuentoEquiposNoDevueltos,
                descuentoAfpProporcional,
                descuentoSaludProporcional,
                descuentoAfcProporcional,
                row
            });
        }

        if (rowErrors.length > 0) {
            console.log(`❌ Carga masiva rechazada: ${rowErrors.length} errores encontrados.`);
            return res.status(400).json({ 
                message: 'La carga masiva fue rechazada debido a errores de validación.', 
                errors: rowErrors 
            });
        }

        // Paso 2: Procesamiento
        let processedCount = 0;
        const savedFiniquitos = [];

        for (const data of validRowsData) {
            const {
                candidate,
                fechaIngreso,
                fechaEgreso,
                fechaNotificacion,
                causalTermino,
                pagarDiasProporcionales,
                diasTrabajadosMes,
                diasVacacionesTomados,
                diasVacacionesProgresivas,
                valorUF,
                otrosHaberes,
                otrosDescuentos,
                descuentoPrestamoCaja,
                descuentoPrestamoEmpresa,
                descuentoAnticipos,
                indemnizacionVoluntaria,
                aguinaldosOtros,
                descuentoSeguroColectivo,
                descuentoEquiposNoDevueltos,
                descuentoAfpProporcional,
                descuentoSaludProporcional,
                descuentoAfcProporcional
            } = data;

            const sueldoBaseFijo = Number(candidate.sueldoBase || 0);
            const promedioSueldoVariable = Number(candidate.promedioSueldoVariable || 0);
            const colacion = Number(candidate.colacion || 0);
            const movilizacion = Number(candidate.movilizacion || 0);
            const gratificacion = Number(candidate.gratificacion || (sueldoBaseFijo > 0 ? Math.min(sueldoBaseFijo * 0.25, 197917) : 0));

            const diffTime = Math.abs(fechaEgreso - fechaIngreso);
            const totalDaysOfService = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const { years, months, days } = calcularAntiguedadDetallada(fechaIngreso, fechaEgreso);

            let aniosServicioCalculados = 0;
            let montoIndemnizacionAnos = 0;
            const totalAntiguedadMeses = (years * 12) + months;
            const aplicaIAS = (causalTermino === 'Necesidades de la empresa (Art. 161)');

            if (aplicaIAS && totalAntiguedadMeses >= 12) {
                if (months > 6 || (months === 6 && days > 0)) {
                    aniosServicioCalculados = years + 1;
                } else {
                    aniosServicioCalculados = years;
                }
                aniosServicioCalculados = Math.min(aniosServicioCalculados, 11);
            }

            const sueldoImponible = sueldoBaseFijo + promedioSueldoVariable + colacion + movilizacion;
            const topeRemuneracion = 90 * valorUF;
            const sueldoImponibleConTope = Math.min(sueldoImponible, topeRemuneracion);

            if (aplicaIAS) {
                montoIndemnizacionAnos = aniosServicioCalculados * sueldoImponibleConTope;
            }

            let computedExcluirAviso = false;
            let isAvisoTardio = false;
            let diffNotifDays = 0;
            const bulkWarnings = [];

            // Add non-blocking medical leave warning for other causals if any
            const activeLicencia = (candidate.vacaciones || []).find(v => {
                if (v.tipo === 'Licencia Médica' && v.estado === 'Aprobado' && v.fechaInicio && v.fechaFin) {
                    const inicio = new Date(v.fechaInicio);
                    const fin = new Date(v.fechaFin);
                    const egresoDate = new Date(fechaEgreso);
                    egresoDate.setHours(0,0,0,0);
                    inicio.setHours(0,0,0,0);
                    fin.setHours(0,0,0,0);
                    return egresoDate >= inicio && egresoDate <= fin;
                }
                return false;
            });
            if (activeLicencia) {
                const initStr = new Date(activeLicencia.fechaInicio).toLocaleDateString('es-CL');
                const finStr = new Date(activeLicencia.fechaFin).toLocaleDateString('es-CL');
                bulkWarnings.push(`El colaborador tiene una Licencia Médica aprobada vigente (desde ${initStr} hasta ${finStr}) que coincide con la fecha de egreso.`);
            }

            if (causalTermino === 'Necesidades de la empresa (Art. 161)') {
                if (fechaNotificacion) {
                    const fNotif = new Date(fechaNotificacion);
                    const fEgres = new Date(fechaEgreso);
                    fNotif.setHours(0,0,0,0);
                    fEgres.setHours(0,0,0,0);
                    diffNotifDays = Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24));
                    if (diffNotifDays < 30) {
                        isAvisoTardio = true;
                        computedExcluirAviso = false;
                        bulkWarnings.push(`Aviso previo fuera de plazo legal: notificado con ${diffNotifDays} días de anticipación (mínimo legal: 30 días). Se forzará el pago de la Indemnización Sustitutiva de Aviso Previo.`);
                    } else {
                        computedExcluirAviso = true;
                    }
                } else {
                    computedExcluirAviso = false;
                    bulkWarnings.push("Falta ingresar la fecha de notificación de despido para verificar el plazo legal de aviso previo de 30 días.");
                }
            } else {
                computedExcluirAviso = true;
            }

            let montoIndemnizacionAviso = 0;
            if (causalTermino === 'Necesidades de la empresa (Art. 161)' && !computedExcluirAviso) {
                montoIndemnizacionAviso = sueldoImponibleConTope;
            }

            const diasVacacionesHabilesGanados = (totalAntiguedadMeses * 1.25) + (days * (1.25 / 30)) + Number(diasVacacionesProgresivas);
            const diasVacacionesHabilesPendientes = Math.max(0, diasVacacionesHabilesGanados - Number(diasVacacionesTomados));
            const diasVacacionesCorridos = calcularProyeccionFeriado(fechaEgreso, diasVacacionesHabilesPendientes);
            const valorDiaFeriado = sueldoImponible / 30;
            const montoFeriadoProporcional = Math.round(diasVacacionesCorridos * valorDiaFeriado);

            let montoAFC = candidate.montoAFC || 0;
            const rawMontoAFC = data.row['Monto AFC'] !== undefined ? data.row['Monto AFC'] : data.row.montoAFC;
            if (rawMontoAFC !== undefined && rawMontoAFC !== null && rawMontoAFC !== '') {
                montoAFC = Number(rawMontoAFC);
            }
            const descuentoAFCAplicado = causalTermino === 'Necesidades de la empresa (Art. 161)' 
                ? Math.min(montoAFC, montoIndemnizacionAnos) 
                : 0;

            let montoSueldoProporcional = 0;
            let montoColacionProporcional = 0;
            let montoMovilizacionProporcional = 0;
            let montoGratificacionProporcional = 0;
            let totalHaberesProporcionales = 0;

            if (pagarDiasProporcionales && diasTrabajadosMes > 0) {
                montoSueldoProporcional = Math.round((sueldoBaseFijo / 30) * diasTrabajadosMes);
                montoColacionProporcional = Math.round((colacion / 30) * diasTrabajadosMes);
                montoMovilizacionProporcional = Math.round((movilizacion / 30) * diasTrabajadosMes);
                montoGratificacionProporcional = Math.round((gratificacion / 30) * diasTrabajadosMes);
                totalHaberesProporcionales = montoSueldoProporcional + montoColacionProporcional + montoMovilizacionProporcional + montoGratificacionProporcional;
            }

            const baseImponibleProporcional = montoSueldoProporcional + montoGratificacionProporcional;
            
            let afpDeduction = 0;
            if (descuentoAfpProporcional !== null) {
                afpDeduction = descuentoAfpProporcional;
            } else if (baseImponibleProporcional > 0) {
                afpDeduction = Math.round(baseImponibleProporcional * 0.115);
            }

            let saludDeduction = 0;
            if (descuentoSaludProporcional !== null) {
                saludDeduction = descuentoSaludProporcional;
            } else if (baseImponibleProporcional > 0) {
                saludDeduction = Math.round(baseImponibleProporcional * 0.07);
            }

            let afcDeductionProp = 0;
            if (descuentoAfcProporcional !== null) {
                afcDeductionProp = descuentoAfcProporcional;
            } else if (baseImponibleProporcional > 0) {
                const esIndefinido = candidate.contractStep === 'INDEFINIDO' || (candidate.contractType && candidate.contractType.toUpperCase().includes('INDEF'));
                if (esIndefinido) {
                    afcDeductionProp = Math.round(baseImponibleProporcional * 0.006);
                }
            }

            const netoFiniquito = Math.max(0, 
                montoIndemnizacionAnos + 
                montoIndemnizacionAviso + 
                montoFeriadoProporcional + 
                Number(otrosHaberes) + 
                Number(indemnizacionVoluntaria) +
                Number(aguinaldosOtros) +
                totalHaberesProporcionales - 
                descuentoAFCAplicado - 
                Number(otrosDescuentos) - 
                Number(descuentoPrestamoCaja) - 
                Number(descuentoPrestamoEmpresa) - 
                Number(descuentoAnticipos) -
                Number(afpDeduction) -
                Number(saludDeduction) -
                Number(afcDeductionProp) -
                Number(descuentoSeguroColectivo) -
                Number(descuentoEquiposNoDevueltos)
            );

            // Deductions threshold check
            const totalHaberes = montoIndemnizacionAnos + 
                montoIndemnizacionAviso + 
                montoFeriadoProporcional + 
                Number(otrosHaberes) + 
                Number(indemnizacionVoluntaria) +
                Number(aguinaldosOtros) +
                totalHaberesProporcionales;

            const totalDescuentos = descuentoAFCAplicado + 
                Number(otrosDescuentos) + 
                Number(descuentoPrestamoCaja) + 
                Number(descuentoPrestamoEmpresa) + 
                Number(descuentoAnticipos) +
                Number(afpDeduction) +
                Number(saludDeduction) +
                Number(afcDeductionProp) +
                Number(descuentoSeguroColectivo) +
                Number(descuentoEquiposNoDevueltos);

            if (totalHaberes > 0) {
                const pct = (totalDescuentos / totalHaberes) * 100;
                if (pct > 45) {
                    bulkWarnings.push(`La suma de descuentos ($${totalDescuentos.toLocaleString('es-CL')}) representa el ${pct.toFixed(1)}% del total de haberes, superando el límite legal del 45%.`);
                }
            }

            if (netoFiniquito <= 0) {
                bulkWarnings.push("El neto a pagar en el finiquito es $0. Esto genera un alto riesgo de fiscalización por parte de la Dirección del Trabajo (DT).");
            }

            const finiquitoDetalle = {
                fechaEgreso,
                fechaNotificacion,
                causalTermino,
                diasVacacionesTomados,
                diasVacacionesProgresivas,
                sueldoBaseFijo,
                promedioSueldoVariable,
                colacion,
                movilizacion,
                gratificacion,
                valorUF,
                montoAFC: causalTermino === 'Necesidades de la empresa (Art. 161)' ? montoAFC : 0,
                otrosDescuentos,
                otrosHaberes,
                excluirAviso: computedExcluirAviso,
                pagarDiasProporcionales,
                diasTrabajadosMes,
                descuentoPrestamoCaja,
                descuentoPrestamoEmpresa,
                descuentoAnticipos,
                indemnizacionVoluntaria,
                aguinaldosOtros,
                descuentoAfpProporcional: afpDeduction,
                descuentoSaludProporcional: saludDeduction,
                descuentoAfcProporcional: afcDeductionProp,
                descuentoSeguroColectivo,
                descuentoEquiposNoDevueltos,
                netoFiniquito,
                warnings: bulkWarnings
            };

            const oldStatus = candidate.status;
            
            candidate.status = 'Finiquitado';
            candidate.fechaFiniquito = fechaEgreso;
            candidate.finiquitoMotivo = causalTermino;
            candidate.finiquitoDetalle = finiquitoDetalle;
            candidate.history.push({
                action: 'Carga Masiva Finiquitos',
                description: `Finiquitado masivamente. Causal: ${causalTermino}. Neto: $${netoFiniquito.toLocaleString('es-CL')}`,
                user: req.user?.name || 'Sistema'
            });

            const saved = await candidate.save();

            await syncToTecnico(saved, req.user.empresaRef, { createIfMissing: true });
            await updateProyectoCubiertos(saved, oldStatus, 'Finiquitado');

            try {
                const notificationService = require('../../../utils/notificationService');
                await notificationService.notifyAction({
                    actor: req.user,
                    moduleKey: 'rrhh_captura',
                    action: 'finiquitó a (masivo)',
                    entityName: `colaborador ${saved.fullName}`,
                    entityId: saved._id,
                    companyRef: req.user.empresaRef,
                    isImportant: false,
                    messageExtra: `Causal: ${saved.finiquitoMotivo} | Neto: $${netoFiniquito.toLocaleString('es-CL')}`
                });
            } catch (err) {
                console.error('Error notificando finiquito masivo:', err.message);
            }

            processedCount++;
            savedFiniquitos.push({
                rut: saved.rut,
                fullName: saved.fullName,
                netoFiniquito
            });
        }

        res.json({
            success: true,
            message: `Se procesaron exitosamente ${processedCount} finiquitos de colaboradores.`,
            processedCount,
            data: savedFiniquitos
        });

    } catch (err) {
        console.error('❌ POST /api/rrhh/candidatos/bulk-finiquitos ERROR:', err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/', protect, authorize('admin', 'rrhh_captura:crear'), async (req, res) => {
    try {
        const cleanData = sanitizeCandidatoData(req.body);
        const candidato = new Candidato({
            ...cleanData,
            empresaRef: req.user.empresaRef,
            history: [{ action: 'Registro', description: 'Postulante ingresado', user: req.user?.name || 'Sistema' }]
        });
        const saved = await candidato.save();

        try {
            const notificationService = require('../../../utils/notificationService');
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'rrhh_captura',
                action: 'registró',
                entityName: `postulante ${saved.fullName || saved.nombre}`,
                entityId: saved._id,
                companyRef: req.user.empresaRef,
                isImportant: false,
                messageExtra: `Estado inicial: ${saved.status || 'pendiente'}`
            });
        } catch (err) {
            console.error('Error notificando registro de candidato:', err.message);
        }

        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', protect, authorize('admin', 'rrhh_captura:editar'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'ID de candidato inválido' });
        }
        
        console.log(`\n═══════════════════════════════════════════════════════━`);
        console.log(`🟢 PUT /api/rrhh/candidatos/:${id} RECEIVED`);
        
        // 1. CONSTRUIR FILTRO ROBUSTO
        // Si el usuario es de alto nivel, permitimos editar registros de su empresa O registros huérfanos
        const isHigh = isHighLevelRole(req.user.role);
        const filter = { _id: id };
        
        if (!isHigh) {
            filter.empresaRef = req.user.empresaRef;
        } else {
            filter.$or = [
                { empresaRef: req.user.empresaRef },
                { empresaRef: null },
                { empresaRef: { $exists: false } }
            ];
        }

        // 2. BUSCAR EL DOCUMENTO
        let candidato = await Candidato.findOne(filter);
        if (!candidato) {
            console.warn(`⚠️ Candidato ${id} no encontrado o no pertenece a la empresa ${req.user.empresaRef}`);
            return res.status(404).json({ message: 'Candidato no encontrado o sin permisos' });
        }

        // 3. SANITIZAR Y ACTUALIZAR
        const cleanData = sanitizeCandidatoData(req.body);
        
        // Si el registro era huérfano, asignamos la empresa del usuario actual
        if (!candidato.empresaRef) {
            console.log(`🏢 Asignando empresaRef automática: ${req.user.empresaRef}`);
            candidato.empresaRef = req.user.empresaRef;
        }

        // Actualizar campos (evitando sobreescribir _id e history manualmente de forma incorrecta)
        Object.keys(cleanData).forEach(key => {
            if (key !== '_id' && key !== 'history') {
                candidato[key] = cleanData[key];
            }
        });

        // 4. GUARDAR (Uso .save() para activar validaciones y middlewares)
        const updated = await candidato.save();

        console.log(`📊 Candidato actualizado en MongoDB: ${updated.fullName} (${updated.rut})`);

        // 5. SINCRONIZACIÓN TRANSVERSAL
        console.log(`🔄 Sincronizando con módulo operativo...`);
        await syncToTecnico(updated, req.user.empresaRef, { createIfMissing: true });

        // 6. NOTIFICACIÓN
        try {
            const notificationService = require('../../../utils/notificationService');
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'rrhh_captura',
                action: 'actualizó',
                entityName: `postulante ${updated.fullName}`,
                entityId: updated._id,
                companyRef: req.user.empresaRef,
                isImportant: false,
                messageExtra: `Estado: ${updated.status}`
            });
        } catch (err) {
            console.error('Error notificando:', err.message);
        }

        console.log(`═══════════════════════════════════════════════════════━\n`);
        res.json(updated);
    } catch (err) { 
        console.error('❌ PUT /api/rrhh/candidatos/:id ERROR:', err);
        res.status(500).json({ message: err.message }); 
    }
});

router.put('/:id/status', protect, authorize('admin', 'rrhh_captura:editar'), async (req, res) => {
    try {
        const cleanData = sanitizeCandidatoData(req.body);
        const { status, note, user, approvalChain, validationRequested } = cleanData;
        
        const candidateFilter = { _id: req.params.id };
        if (!['system_admin', 'ceo'].includes(req.user.role)) {
            if (req.user.role === 'admin') {
                candidateFilter.$or = [
                    { empresaRef: req.user.empresaRef },
                    { empresaRef: null },
                    { empresaRef: { $exists: false } }
                ];
            } else {
                candidateFilter.empresaRef = req.user.empresaRef;
            }
        }

        const c = await Candidato.findOne(candidateFilter);
        if (!c) {
            console.warn(`⚠️ Candidato ${req.params.id} no encontrado para usuario ${req.user.email || req.user._id}`);
            return res.status(404).json({ message: 'No encontrado' });
        }

        const oldStatus = c.status;
        c.status = status;
        if (approvalChain !== undefined) c.set('approvalChain', approvalChain);
        if (validationRequested !== undefined) c.set('validationRequested', validationRequested);

        if (validationRequested && status !== 'Contratado' && status !== 'Rechazado') {
            try {
                const mailer = require('../../../utils/mailer');
                const emails = (approvalChain || []).filter(a => a.status === 'Pendiente' && a.email).map(a => a.email);
                if (emails.length > 0) await mailer.sendCandidateValidationEmail(c, emails.join(', '), req.user.empresaRef);
            } catch (err) { console.error('Error mailer:', err.message); }
        }

        if (status === CONTRATADO_STATUS && cleanData.contractStartDate) {
            c.contractStartDate = cleanData.contractStartDate;
            c.contractType = cleanData.contractType || c.contractType;
        }

        if (status === 'Finiquitado') {
            c.fechaFiniquito = cleanData.fechaFiniquito ? new Date(cleanData.fechaFiniquito) : c.fechaFiniquito;
            c.finiquitoMotivo = cleanData.finiquitoMotivo || c.finiquitoMotivo;
        }

        c.history.push({ action: 'Cambio de Estado', description: `De ${oldStatus} a ${status}`, user: user || 'Sistema' });
        await c.save();

        if (status === CONTRATADO_STATUS) {
            try {
                const Notification = require('../models/Notification');
                const PlatformUser = require('../../auth/PlatformUser');
                const mailer = require('../../../utils/mailer');
                const admins = await PlatformUser.find({ empresaRef: req.user.empresaRef, role: { $in: ['admin', 'ceo', 'system_admin'] }, status: 'Activo' });
                for (const admin of admins) {
                    await Notification.create({
                        userEmail: admin.email, title: 'Ingreso Confirmado',
                        message: `El ingreso de ${c.fullName} ha sido aprobado.`,
                        type: 'approval', link: '/rrhh/personal-activo',
                        empresaRef: req.user.empresaRef, metadata: { candidatoId: c._id, module: 'RRHH', action: 'Hiring' }
                    });
                }
                const adminEmails = admins.map(a => a.email).join(', ');
                if (adminEmails) await mailer.sendApprovalNotificationEmail(c, adminEmails, 'Ingreso', null, req.user.empresaRef);
            } catch (err) { console.error('Error notification:', err.message); }
            await updateProyectoCubiertos(c, oldStatus, status);
            await syncToTecnico(c, req.user.empresaRef);
            await handlePortalAccess(c);
        } else {
             await updateProyectoCubiertos(c, oldStatus, status);
        }

        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/interview', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.interview = { ...c.interview?.toObject(), ...req.body };
        if (req.body.scheduledDate && !c.interview.interviewStatus) {
            c.interview.interviewStatus = 'Agendada';
            c.status = 'En Entrevista';
        }
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/notes', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.notes.push(req.body);
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/documents', protect, upload.single('file'), async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        let url = null;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'rrhh-documentos' }, (err, res) => {
                    if (err) reject(err); else resolve(res);
                }).end(req.file.buffer);
            });
            url = result.secure_url;
        }
        c.documents.push({ 
            docType: req.body.docType, 
            url, 
            status: 'Pendiente',
            emissionDate: req.body.emissionDate ? new Date(req.body.emissionDate) : null,
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null
        });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Ruta específica para Foto de Perfil
router.post('/:id/profile-pic', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ folder: 'rrhh-perfiles' }, (err, res) => {
                if (err) reject(err); else resolve(res);
            }).end(req.file.buffer);
        });
        
        c.profilePic = result.secure_url;
        await c.save();
        res.json({ url: result.secure_url });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Ruta específica para CV
router.post('/:id/cv', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No se subió ningún archivo' });
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ folder: 'rrhh-cvs' }, (err, res) => {
                if (err) reject(err); else resolve(res);
            }).end(req.file.buffer);
        });
        
        c.cvUrl = result.secure_url;
        await c.save();
        res.json({ url: result.secure_url });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Actualizar metadatos o estado de un documento
router.put('/:id/documents/:docId', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        const doc = c.documents.id(req.params.docId);
        if (!doc) return res.status(404).json({ message: 'Documento no encontrado' });
        
        if (req.body.status) doc.status = req.body.status;
        if (req.body.emissionDate) doc.emissionDate = new Date(req.body.emissionDate);
        if (req.body.expiryDate) doc.expiryDate = new Date(req.body.expiryDate);
        
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/hiring', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        const oldStatus = c.status;
        const cleanData = sanitizeCandidatoData(req.body);
        c.hiring = { ...c.hiring?.toObject(), ...cleanData };
        if (cleanData.contractStartDate) c.contractStartDate = cleanData.contractStartDate;
        if (req.body.managerApproval === 'Aprobado') {
            c.status = CONTRATADO_STATUS;
            await c.save();
            await updateProyectoCubiertos(c, oldStatus, CONTRATADO_STATUS);
            await syncToTecnico(c, req.user.empresaRef);
            await handlePortalAccess(c);
        } else if (req.body.managerApproval === 'Rechazado') {
            c.status = 'Rechazado';
            await c.save();
        } else { await c.save(); }
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/accreditation', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.accreditation = { ...c.accreditation?.toObject(), ...req.body };
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/tests', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.tests.push(req.body);
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/vacaciones', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const isHighLevel = isHighLevelRole(req.user.role);
        const isOwner = normalizeRut(req.user.rut) === normalizeRut(c.rut) ||
            (req.user.email && c.email && String(req.user.email).toLowerCase() === String(c.email).toLowerCase());
        const isSupervisorDirecto = await Tecnico.exists({
            empresaRef: req.user.empresaRef,
            rut: normalizeRut(c.rut),
            supervisorId: req.user._id
        });
        const canCreateVacation =
            isHighLevel ||
            isOwner ||
            Boolean(isSupervisorDirecto) ||
            hasModulePerm(req.user, 'rrhh_vacaciones', 'crear') ||
            hasModulePerm(req.user, 'cfg_personal', 'editar');

        if (!canCreateVacation) {
            return res.status(403).json({ message: 'No autorizado para crear solicitudes de vacaciones/permisos' });
        }

        c.vacaciones.push(req.body);
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/vacaciones/:vacId', protect, async (req, res) => {
    try {
        const { vacId } = req.params;
        const { approvalChain, estado, aprobadoPor, validationRequested } = req.body;
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const isHighLevel = isHighLevelRole(req.user.role);
        const isSupervisorDirecto = await Tecnico.exists({
            empresaRef: req.user.empresaRef,
            rut: normalizeRut(c.rut),
            supervisorId: req.user._id
        });
        const canEditVacation =
            isHighLevel ||
            Boolean(isSupervisorDirecto) ||
            hasModulePerm(req.user, 'rrhh_vacaciones', 'editar') ||
            hasModulePerm(req.user, 'cfg_personal', 'editar');

        if (!canEditVacation) {
            return res.status(403).json({ message: 'No autorizado para actualizar solicitudes de vacaciones/permisos' });
        }

        const vac = c.vacaciones.id(vacId);
        if (!vac) return res.status(404).json({ message: 'No encontrado' });
        if (approvalChain !== undefined) vac.approvalChain = approvalChain;
        if (estado !== undefined) vac.estado = estado;
        if (aprobadoPor !== undefined) vac.aprobadoPor = aprobadoPor;
        if (validationRequested !== undefined) vac.validationRequested = validationRequested;
        await c.save();

        // Notificar escalamiento a los siguientes aprobadores pendientes
        if (Array.isArray(approvalChain) && approvalChain.length > 0) {
            try {
                const Notification = require('../models/Notification');
                const pendingApprovers = approvalChain.filter(step => step.status === 'Pendiente' && step.email);
                for (const approver of pendingApprovers) {
                    await Notification.create({
                        userEmail: approver.email,
                        title: `${vac.tipo || 'Solicitud'} pendiente de aprobación`,
                        message: `La solicitud de ${vac.tipo || 'vacación/permiso'} de ${c.fullName} requiere tu revisión.`,
                        type: 'approval',
                        link: '/administracion/aprobaciones',
                        empresaRef: req.user.empresaRef,
                        metadata: { candidatoId: c._id, vacacionId: vac._id, module: 'RRHH', action: 'VacationApprovalPending' }
                    });
                }
            } catch (err) {
                console.error('Error notifying pending vacation approvers:', err.message);
            }
        }

        if (estado === 'Aprobado') {
            try {
                const Notification = require('../models/Notification');
                const PlatformUser = require('../../auth/PlatformUser');
                const mailer = require('../../../utils/mailer');
                const admins = await PlatformUser.find({ empresaRef: req.user.empresaRef, role: { $in: ['admin', 'ceo', 'system_admin', 'gerencia', 'jefatura'] }, status: 'Activo' });
                for (const admin of admins) {
                    await Notification.create({
                        userEmail: admin.email, title: `${vac.tipo} Aprobado`,
                        message: `La solicitud de ${vac.tipo} para ${c.fullName} ha sido aprobada.`,
                        type: 'approval', link: '/rrhh/vacaciones-licencias',
                        empresaRef: req.user.empresaRef, metadata: { candidatoId: c._id, module: 'RRHH', action: 'Vacation' }
                    });
                }
                const adminEmails = admins.map(a => a.email).join(', ');
                if (adminEmails) await mailer.sendApprovalNotificationEmail(c, adminEmails, vac.tipo, vac, req.user.empresaRef);
            } catch (err) { console.error('Error notification:', err.message); }
        }
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/amonestaciones', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.amonestaciones.push(req.body);
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/felicitaciones', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.felicitaciones.push(req.body);
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', protect, authorize('admin', 'rrhh_captura:eliminar'), async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.isActive = false;
        await c.save();
        res.json({ message: 'Archivado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});
// GET candidates for Bonos Fijos Telecom (Contratado, Inactivo, Activo en Terreno, Finiquitado del mes)
router.get('/remuneraciones/fijos', protect, async (req, res) => {
  try {
    const { year, month } = req.query;
    const empresaId = req.user.empresaRef;

    if (!year || !month) return res.status(400).json({ error: 'Year and month required' });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const matchQuery = {
      empresaRef: empresaId,
      $or: [
        { status: { $in: ['Contratado', 'Inactivo', 'Activo en Terreno'] } },
        {
          status: 'Finiquitado',
          'hiring.endDate': { $gte: startDate, $lte: endDate }
        }
      ]
    };

    const candidatos = await Candidato.find(matchQuery).select('rut fullName idRecursoToa status hiring.startDate hiring.endDate');
    res.json(candidatos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- CALCULADOR DE FINIQUITOS COMPLIANT CON LA DIRECCIÓN DEL TRABAJO (CHILE) ---
function isFeriadoChile(fecha) {
    const y = fecha.getFullYear();
    const m = fecha.getMonth() + 1;
    const d = fecha.getDate();
    
    // Feriados fijos en Chile
    const fijos = [
        '1-1',   // Año Nuevo
        '5-1',   // Día del Trabajo
        '5-21',  // Glorias Navales
        '7-16',  // Virgen del Carmen
        '8-15',  // Asunción de la Virgen
        '9-18',  // Fiestas Patrias
        '9-19',  // Glorias del Ejército
        '10-31', // Iglesias Evangélicas
        '11-1',  // Todos los Santos
        '12-8',  // Inmaculada Concepción
        '12-25'  // Navidad
    ];
    
    if (fijos.includes(`${m}-${d}`)) return true;
    
    // Feriados móviles específicos (Viernes/Sábado Santo y San Pedro y San Pablo)
    if (y === 2025) {
        if (m === 4 && (d === 18 || d === 19)) return true;
        if (m === 6 && d === 29) return true;
        if (m === 10 && d === 12) return true;
    }
    if (y === 2026) {
        if (m === 4 && (d === 3 || d === 4)) return true;
        if (m === 6 && d === 29) return true;
        if (m === 10 && d === 12) return true;
    }
    
    return false;
}

function calcularProyeccionFeriado(fechaEgreso, diasHabilesPendientes) {
    let fechaCursor = new Date(fechaEgreso.getTime());
    let diasHabilesRestantes = diasHabilesPendientes;
    let diasCorridos = 0;
    
    while (diasHabilesRestantes > 0) {
        fechaCursor.setDate(fechaCursor.getDate() + 1);
        const dayOfWeek = fechaCursor.getDay(); // 0 = Domingo, 6 = Sábado
        const esFinDeSemana = (dayOfWeek === 0 || dayOfWeek === 6);
        const esFeriado = isFeriadoChile(fechaCursor);
        
        if (esFinDeSemana || esFeriado) {
            diasCorridos += 1;
        } else {
            if (diasHabilesRestantes >= 1) {
                diasHabilesRestantes -= 1;
                diasCorridos += 1;
            } else {
                diasCorridos += diasHabilesRestantes;
                diasHabilesRestantes = 0;
            }
        }
    }
    return diasCorridos;
}

function calcularAntiguedadDetallada(fechaInicio, fechaFin) {
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    
    let months = 0;
    let milestone = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const target = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    
    while (true) {
        let nextMilestone = new Date(Date.UTC(milestone.getUTCFullYear(), milestone.getUTCMonth() + 1, milestone.getUTCDate()));
        
        if (nextMilestone.getUTCDate() !== milestone.getUTCDate()) {
            nextMilestone = new Date(Date.UTC(milestone.getUTCFullYear(), milestone.getUTCMonth() + 2, 0));
        }
        
        if (nextMilestone <= target) {
            milestone = nextMilestone;
            months++;
        } else {
            break;
        }
    }
    
    let days = 0;
    if (target.getTime() > milestone.getTime()) {
        const diffTime = target.getTime() - milestone.getTime();
        days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    let years = Math.floor(months / 12);
    months = months % 12;
    
    return { years, months, days };
}

router.post('/:id/calcular-finiquito', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'Colaborador no encontrado' });

        const fechaIngreso = c.contractStartDate ? new Date(c.contractStartDate) : new Date(c.createdAt);
        const {
            fechaEgreso: fechaEgresoStr,
            fechaNotificacion: fechaNotificacionStr = null,
            causalTermino,
            diasVacacionesTomados = 0,
            diasVacacionesProgresivas = 0,
            sueldoBaseFijo = 0,
            promedioSueldoVariable = 0,
            colacion = 0,
            movilizacion = 0,
            gratificacion = 0,
            valorUF = 38500,
            montoAFC = 0,
            otrosDescuentos = 0,
            otrosHaberes = 0,
            excluirAviso = false,
            
            // Nuevas variables operativas y financieras
            pagarDiasProporcionales = false,
            diasTrabajadosMes = 0,
            descuentoPrestamoCaja = 0,
            descuentoPrestamoEmpresa = 0,
            descuentoAnticipos = 0,

            // Haberes adicionales
            indemnizacionVoluntaria = 0,
            aguinaldosOtros = 0,

            // Deducciones de leyes sociales proporcionales (si se pasan, se usan; si no, se precalculan)
            descuentoAfpProporcional = null,
            descuentoSaludProporcional = null,
            descuentoAfcProporcional = null,
            descuentoSeguroColectivo = 0,
            descuentoEquiposNoDevueltos = 0
        } = req.body;

        if (!fechaEgresoStr) {
            return res.status(400).json({ message: 'La fecha de egreso es requerida para calcular el finiquito.' });
        }

        const fechaEgreso = new Date(fechaEgresoStr);
        if (fechaEgreso < fechaIngreso) {
            return res.status(400).json({ message: 'La fecha de egreso no puede ser anterior a la de ingreso.' });
        }

        const warnings = [];

        // 1. Validar si tiene Licencia Médica activa aprobada que coincida con la fecha de egreso
        const activeLicencia = (c.vacaciones || []).find(v => {
            if (v.tipo === 'Licencia Médica' && v.estado === 'Aprobado' && v.fechaInicio && v.fechaFin) {
                const inicio = new Date(v.fechaInicio);
                const fin = new Date(v.fechaFin);
                const egresoDate = new Date(fechaEgreso);
                egresoDate.setHours(0,0,0,0);
                inicio.setHours(0,0,0,0);
                fin.setHours(0,0,0,0);
                return egresoDate >= inicio && egresoDate <= fin;
            }
            return false;
        });

        if (activeLicencia) {
            const initStr = new Date(activeLicencia.fechaInicio).toLocaleDateString('es-CL');
            const finStr = new Date(activeLicencia.fechaFin).toLocaleDateString('es-CL');
            warnings.push(`El colaborador tiene una Licencia Médica aprobada vigente (desde ${initStr} hasta ${finStr}) que coincide con la fecha de egreso. La ley prohíbe desvincular a un colaborador con licencia médica activa bajo el Art. 161 (Necesidades de la empresa).`);
        }

        // 2. Calcular antigüedad en días de corrido
        const diffTime = Math.abs(fechaEgreso - fechaIngreso);
        const totalDaysOfService = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Incluye el día de egreso

        // Desglose de años, meses y días usando método UTC robusto e inclusive
        const { years, months, days } = calcularAntiguedadDetallada(fechaIngreso, fechaEgreso);

        // 3. Indemnización por Años de Servicio (Art. 163 Código del Trabajo)
        let aniosServicioCalculados = 0;
        let montoIndemnizacionAnos = 0;

        const totalAntiguedadMeses = (years * 12) + months;
        const aplicaIAS = (causalTermino === 'Necesidades de la empresa (Art. 161)');

        if (aplicaIAS && totalAntiguedadMeses >= 12) {
            if (months > 6 || (months === 6 && days > 0)) {
                aniosServicioCalculados = years + 1;
            } else {
                aniosServicioCalculados = years;
            }
            // Tope de 11 años
            aniosServicioCalculados = Math.min(aniosServicioCalculados, 11);
        }

        // Base de cálculo imponible (Sueldo Base + promedio variable + asignaciones regulares)
        const sueldoImponible = Number(sueldoBaseFijo) + Number(promedioSueldoVariable) + Number(colacion) + Number(movilizacion);
        
        // Tope 90 UF para indemnizaciones
        const topeRemuneracion = 90 * Number(valorUF);
        const sueldoImponibleConTope = Math.min(sueldoImponible, topeRemuneracion);

        if (aplicaIAS) {
            montoIndemnizacionAnos = aniosServicioCalculados * sueldoImponibleConTope;
        }

        // 4. Indemnización Sustitutiva de Aviso Previo (ISAP) y cálculo de plazo de aviso (30 días)
        let computedExcluirAviso = excluirAviso;
        if (causalTermino === 'Necesidades de la empresa (Art. 161)') {
            if (fechaNotificacionStr) {
                const fNotif = new Date(fechaNotificacionStr);
                const fEgres = new Date(fechaEgreso);
                fNotif.setHours(0,0,0,0);
                fEgres.setHours(0,0,0,0);
                const diffNotifDays = Math.round((fEgres - fNotif) / (1000 * 60 * 60 * 24));
                if (diffNotifDays < 30) {
                    computedExcluirAviso = false;
                    warnings.push(`Aviso previo fuera de plazo legal: notificado con ${diffNotifDays} días de anticipación (mínimo legal: 30 días). Se forzará el pago de la Indemnización Sustitutiva de Aviso Previo.`);
                } else {
                    computedExcluirAviso = true;
                }
            } else {
                warnings.push("Falta ingresar la fecha de notificación de despido para verificar el plazo legal de aviso previo de 30 días.");
            }
        } else {
            computedExcluirAviso = true;
        }

        let montoIndemnizacionAviso = 0;
        if (causalTermino === 'Necesidades de la empresa (Art. 161)' && !computedExcluirAviso) {
            montoIndemnizacionAviso = sueldoImponibleConTope;
        }

        // 5. Feriado Proporcional (DT Chile: Meses completos * 1.25 + Días sueltos * 1.25/30 + Vacaciones Progresivas)
        const diasVacacionesHabilesGanados = (totalAntiguedadMeses * 1.25) + (days * (1.25 / 30)) + Number(diasVacacionesProgresivas);
        const diasVacacionesHabilesPendientes = Math.max(0, diasVacacionesHabilesGanados - Number(diasVacacionesTomados));
        
        // Proyección calendarizada
        const diasVacacionesCorridos = calcularProyeccionFeriado(fechaEgreso, diasVacacionesHabilesPendientes);
        const valorDiaFeriado = sueldoImponible / 30;
        const montoFeriadoProporcional = Math.round(diasVacacionesCorridos * valorDiaFeriado);

        // 6. Descuento AFC (Topado legalmente al monto de la indemnización por años de servicio)
        const descuentoAFCAplicado = causalTermino === 'Necesidades de la empresa (Art. 161)' 
            ? Math.min(Number(montoAFC), montoIndemnizacionAnos) 
            : 0;

        // 7. Días Proporcionales del mes de término (Sueldo Proporcional)
        let montoSueldoProporcional = 0;
        let montoColacionProporcional = 0;
        let montoMovilizacionProporcional = 0;
        let montoGratificacionProporcional = 0;
        let totalHaberesProporcionales = 0;

        if (pagarDiasProporcionales && Number(diasTrabajadosMes) > 0) {
            montoSueldoProporcional = Math.round((Number(sueldoBaseFijo) / 30) * Number(diasTrabajadosMes));
            montoColacionProporcional = Math.round((Number(colacion) / 30) * Number(diasTrabajadosMes));
            montoMovilizacionProporcional = Math.round((Number(movilizacion) / 30) * Number(diasTrabajadosMes));
            montoGratificacionProporcional = Math.round((Number(gratificacion) / 30) * Number(diasTrabajadosMes));
            totalHaberesProporcionales = montoSueldoProporcional + montoColacionProporcional + montoMovilizacionProporcional + montoGratificacionProporcional;
        }

        // Cotizaciones sobre días proporcionales (AFP, Salud, AFC)
        const baseImponibleProporcional = montoSueldoProporcional + montoGratificacionProporcional;
        
        let afpDeduction = 0;
        if (descuentoAfpProporcional !== undefined && descuentoAfpProporcional !== null) {
            afpDeduction = Number(descuentoAfpProporcional);
        } else if (baseImponibleProporcional > 0) {
            afpDeduction = Math.round(baseImponibleProporcional * 0.115); // Tasa AFP promedio (~11.5%)
        }

        let saludDeduction = 0;
        if (descuentoSaludProporcional !== undefined && descuentoSaludProporcional !== null) {
            saludDeduction = Number(descuentoSaludProporcional);
        } else if (baseImponibleProporcional > 0) {
            saludDeduction = Math.round(baseImponibleProporcional * 0.07); // Salud (7%)
        }

        let afcDeductionProp = 0;
        if (descuentoAfcProporcional !== undefined && descuentoAfcProporcional !== null) {
            afcDeductionProp = Number(descuentoAfcProporcional);
        } else if (baseImponibleProporcional > 0) {
            // Se cobra 0.6% de AFC si el tipo de contrato es Indefinido
            const esIndefinido = c.contractStep === 'INDEFINIDO' || (c.contractType && c.contractType.toUpperCase().includes('INDEF'));
            if (esIndefinido) {
                afcDeductionProp = Math.round(baseImponibleProporcional * 0.006);
            }
        }

        // 8. Neto Finiquito
        const netoFiniquito = Math.max(0, 
            montoIndemnizacionAnos + 
            montoIndemnizacionAviso + 
            montoFeriadoProporcional + 
            Number(otrosHaberes) + 
            Number(indemnizacionVoluntaria) +
            Number(aguinaldosOtros) +
            totalHaberesProporcionales - 
            descuentoAFCAplicado - 
            Number(otrosDescuentos) - 
            Number(descuentoPrestamoCaja) - 
            Number(descuentoPrestamoEmpresa) - 
            Number(descuentoAnticipos) -
            Number(afpDeduction) -
            Number(saludDeduction) -
            Number(afcDeductionProp) -
            Number(descuentoSeguroColectivo) -
            Number(descuentoEquiposNoDevueltos)
        );

        // Validaciones financieras y de topes legales
        const totalHaberes = montoIndemnizacionAnos + 
            montoIndemnizacionAviso + 
            montoFeriadoProporcional + 
            Number(otrosHaberes) + 
            Number(indemnizacionVoluntaria) +
            Number(aguinaldosOtros) +
            totalHaberesProporcionales;

        const totalDescuentos = descuentoAFCAplicado + 
            Number(otrosDescuentos) + 
            Number(descuentoPrestamoCaja) + 
            Number(descuentoPrestamoEmpresa) + 
            Number(descuentoAnticipos) +
            Number(afpDeduction) +
            Number(saludDeduction) +
            Number(afcDeductionProp) +
            Number(descuentoSeguroColectivo) +
            Number(descuentoEquiposNoDevueltos);

        if (totalHaberes > 0) {
            const pct = (totalDescuentos / totalHaberes) * 100;
            if (pct > 45) {
                warnings.push(`La suma de descuentos ($${totalDescuentos.toLocaleString('es-CL')}) representa el ${pct.toFixed(1)}% del total de haberes, superando el límite legal del 45% del total imponible/haberes.`);
            }
        }

        if (netoFiniquito <= 0) {
            warnings.push("El neto a pagar en el finiquito es $0. Esto genera un alto riesgo de fiscalización por parte de la Dirección del Trabajo (DT).");
        }

        res.json({
            fechaIngresoReal: fechaIngreso,
            fechaEgreso: fechaEgreso,
            fechaNotificacion: fechaNotificacionStr ? new Date(fechaNotificacionStr) : null,
            warnings,
            excluirAviso: computedExcluirAviso,
            antiguedad: {
                anios: years,
                meses: months,
                dias: days,
                diasTotales: totalDaysOfService
            },
            valoresBase: {
                sueldoBaseFijo,
                promedioSueldoVariable,
                colacion,
                movilizacion,
                gratificacion: Number(gratificacion),
                sueldoImponible,
                sueldoImponibleConTope
            },
            feriadoProporcional: {
                ganados: Number(diasVacacionesHabilesGanados.toFixed(4)),
                tomados: Number(diasVacacionesTomados),
                progresivas: Number(diasVacacionesProgresivas),
                pendientesHabiles: Number(diasVacacionesHabilesPendientes.toFixed(4)),
                diasCorridosCalculados: Number(diasVacacionesCorridos.toFixed(4)),
                monto: montoFeriadoProporcional
            },
            diasProporcionales: {
                pagarDiasProporcionales,
                diasTrabajadosMes: Number(diasTrabajadosMes),
                montoSueldoProporcional,
                montoColacionProporcional,
                montoMovilizacionProporcional,
                montoGratificacionProporcional,
                totalHaberesProporcionales
            },
            descuentosDetallados: {
                descuentoPrestamoCaja: Number(descuentoPrestamoCaja),
                descuentoPrestamoEmpresa: Number(descuentoPrestamoEmpresa),
                descuentoAnticipos: Number(descuentoAnticipos),
                descuentoAfpProporcional: afpDeduction,
                descuentoSaludProporcional: saludDeduction,
                descuentoAfcProporcional: afcDeductionProp,
                descuentoSeguroColectivo: Number(descuentoSeguroColectivo),
                descuentoEquiposNoDevueltos: Number(descuentoEquiposNoDevueltos)
            },
            haberesAdicionales: {
                indemnizacionVoluntaria: Number(indemnizacionVoluntaria),
                aguinaldosOtros: Number(aguinaldosOtros)
            },
            indemnizaciones: {
                aniosServicioCalculados,
                montoIAS: montoIndemnizacionAnos,
                montoISAP: montoIndemnizacionAviso,
                descuentoAFC: descuentoAFCAplicado
            },
            netoFiniquito
        });

    } catch (err) {
        console.error('Error calculando finiquito:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   PUT /api/rrhh/candidatos/:id/guardar-finiquito
// @desc    Guardar cálculo de finiquito formal de desvinculación
// @access  Private
router.put('/:id/guardar-finiquito', protect, authorize('admin', 'rrhh_captura:editar'), async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'Colaborador no encontrado' });

        const oldStatus = c.status;
        const { finiquitoDetalle } = req.body;
        
        if (!finiquitoDetalle) {
            return res.status(400).json({ message: 'Los detalles del finiquito son requeridos.' });
        }

        // Sanitizar campos de fecha vacíos para evitar errores de casteo
        if (finiquitoDetalle.notariaFechaFirma === '') {
            finiquitoDetalle.notariaFechaFirma = null;
        }

        // Actualizar el Candidato
        c.status = 'Finiquitado';
        c.fechaFiniquito = new Date(finiquitoDetalle.fechaEgreso);
        c.finiquitoMotivo = finiquitoDetalle.causalTermino;
        c.finiquitoDetalle = finiquitoDetalle;
        
        c.history.push({
            action: 'Desvinculación y Finiquito',
            description: `Colaborador finiquitado por causa: ${finiquitoDetalle.causalTermino}. Neto finiquito: $${Number(finiquitoDetalle.netoFiniquito).toLocaleString('es-CL')}`,
            user: req.user?.name || 'Sistema'
        });

        const saved = await c.save();
        
        // Sincronizar al módulo técnico (Tecnico)
        await syncToTecnico(saved, req.user.empresaRef, { createIfMissing: true });
        
        // Descontar dotación del proyecto si corresponde
        await updateProyectoCubiertos(saved, oldStatus, 'Finiquitado');

        // Notificación
        try {
            const notificationService = require('../../../utils/notificationService');
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'rrhh_captura',
                action: 'finiquitó a',
                entityName: `colaborador ${saved.fullName}`,
                entityId: saved._id,
                companyRef: req.user.empresaRef,
                isImportant: true,
                messageExtra: `Causal: ${saved.finiquitoMotivo} | Monto Neto: $${Number(finiquitoDetalle.netoFiniquito).toLocaleString('es-CL')}`
            });
        } catch (err) {
            console.error('Error notificando finiquito:', err.message);
        }

        res.json(saved);
    } catch (err) {
        console.error('Error guardando finiquito:', err);
        res.status(500).json({ message: err.message });
    }
});

// @route   POST /api/rrhh/candidatos/parse-renuncia
// @desc    Parse voluntary resignation letter and match worker
// @access  Private
router.post('/parse-renuncia', protect, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha subido ningún archivo.' });
        }

        const fileName = req.file.originalname || '';
        const fileContent = req.file.buffer ? req.file.buffer.toString('utf8') : '';

        // 1. Buscar todos los candidatos contratados / activos de la empresa
        const candidatosActivos = await Candidato.find({
            empresaRef: req.user.empresaRef,
            status: { $in: ['Contratado', 'En Terreno', 'Listo Terreno', 'Licencia Médica'] }
        });

        let matchedCandidato = null;
        let score = 0;

        // 2. Buscar coincidencias de RUT en el texto o en el nombre del archivo
        const cleanRutFromFile = fileContent.replace(/[^0-9kK]/g, '');
        const cleanRutFromFileName = fileName.replace(/[^0-9kK]/g, '');

        for (const c of candidatosActivos) {
            if (!c.rut) continue;
            const cRutClean = c.rut.replace(/[^0-9kK]/g, '');
            
            // Si el RUT exacto (limpio) aparece en el nombre del archivo o en el texto
            if (cRutClean && (cleanRutFromFileName.includes(cRutClean) || cleanRutFromFile.includes(cRutClean))) {
                matchedCandidato = c;
                break;
            }

            // O si partes del nombre completo están en el nombre del archivo o en el texto
            const nameParts = c.fullName ? c.fullName.toLowerCase().split(' ').filter(p => p.length > 2) : [];
            let currentScore = 0;
            nameParts.forEach(part => {
                if (fileName.toLowerCase().includes(part)) currentScore += 2;
                if (fileContent.toLowerCase().includes(part)) currentScore += 1;
            });

            if (currentScore > score) {
                score = currentScore;
                matchedCandidato = c;
            }
        }

        // 3. Buscar fechas en el archivo para proponer como fecha de egreso
        let proposedDate = new Date(); // Por defecto, hoy
        const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g;
        const matches = fileContent.match(dateRegex);
        if (matches && matches.length > 0) {
            const dateStr = matches[0].replace(/\//g, '-');
            const parts = dateStr.split('-');
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            if (!isNaN(d.getTime())) {
                proposedDate = d;
            }
        } else {
            // Intentar buscar fechas verbales comunes, ej. "15 de junio de 2026"
            const verbalDateRegex = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i;
            const verbalMatch = fileContent.match(verbalDateRegex);
            if (verbalMatch) {
                const day = parseInt(verbalMatch[1]);
                const monthName = verbalMatch[2].toLowerCase();
                const year = parseInt(verbalMatch[3]);
                const monthsMap = {
                    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
                    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11
                };
                const month = monthsMap[monthName] !== undefined ? monthsMap[monthName] : 5;
                const d = new Date(year, month, day);
                if (!isNaN(d.getTime())) {
                    proposedDate = d;
                }
            }
        }

        res.json({
            success: true,
            matched: matchedCandidato ? {
                _id: matchedCandidato._id,
                fullName: matchedCandidato.fullName,
                rut: matchedCandidato.rut,
                position: matchedCandidato.position,
                sueldoBase: matchedCandidato.sueldoBase,
                contractStartDate: matchedCandidato.contractStartDate,
                contractType: matchedCandidato.contractType,
                vacaciones: matchedCandidato.vacaciones
            } : null,
            proposedDate: proposedDate.toISOString().split('T')[0],
            causalTermino: 'Renuncia voluntaria (Art. 159 N°2)'
        });

    } catch (err) {
        console.error('Error al procesar renuncia:', err);
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
