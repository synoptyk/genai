const express = require('express');
const router = express.Router();
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const Tecnico = require('../../agentetelecom/models/Tecnico');
const { handlePortalAccess } = require('../../auth/authAutomation');
const { protect } = require('../../auth/authMiddleware');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Actualizar dotacion.cubiertos en el Proyecto al cambiar status
// Esto conecta el flujo Candidato <-> Proyecto automáticamente
// ─────────────────────────────────────────────────────────────────────────────
const CONTRATADO_STATUS = 'Contratado';
const BAJA_STATUSES = ['Finiquitado', 'Retirado', 'Rechazado'];

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

async function syncToTecnico(candidato, empresaRef) {
    if (!candidato || !candidato.rut) return;

    try {
        // 🔒 FILTRO POR EMPRESA
        const existe = await Tecnico.findOne({ rut: candidato.rut, empresaRef });
        if (existe) {
            if (existe.estadoActual !== 'OPERATIVO' || existe.projectId !== candidato.projectId) {
                existe.estadoActual = 'OPERATIVO';
                existe.projectId = candidato.projectId || existe.projectId;
                existe.sede = candidato.sede || existe.sede;
                existe.departamento = candidato.departamento || existe.departamento;
                existe.ceco = candidato.ceco || existe.ceco;
                existe.cargo = candidato.position || existe.cargo;
                await existe.save();
            }
            return;
        }

        let nombres = candidato.fullName || 'Sin Nombre';
        let apellidos = 'Sin Apellido';
        if (candidato.fullName) {
            const parts = candidato.fullName.split(' ');
            if (parts.length > 1) {
                nombres = parts[0];
                apellidos = parts.slice(1).join(' ');
            }
        }

        const nuevoTecnico = new Tecnico({
            rut: candidato.rut,
            empresaRef: empresaRef, // 🔒 INYECTAR
            nombres: nombres,
            apellidos: apellidos,
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
            estadoActual: 'OPERATIVO',
            previsionSalud: candidato.previsionSalud,
            isapreNombre: candidato.isapreNombre,
            valorPlan: candidato.valorPlan,
            monedaPlan: candidato.monedaPlan,
            afp: candidato.afp,
            pensionado: candidato.pensionado,
            tieneCargas: candidato.tieneCargas,
            listaCargas: candidato.listaCargas?.map(c => ({
                rut: c.rut, nombre: c.fullName, parentesco: c.parentesco
            })) || [],
            banco: candidato.banco,
            tipoCuenta: candidato.tipoCuenta,
            numeroCuenta: candidato.numeroCuenta,
            sueldoBase: candidato.sueldoBase,
            requiereLicencia: candidato.requiereLicencia,
            fechaVencimientoLicencia: candidato.fechaVencimientoLicencia
        });

        await nuevoTecnico.save();
        console.log(`✅ Tecnico sincronizado desde RRHH: ${candidato.rut}`);
    } catch (e) {
        console.error('⚠️ syncToTecnico error:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Sanitizar datos del candidato (Convertir "SIN TÉRMINO" a null)
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeCandidatoData(data) {
    if (!data) return data;
    const fieldsToClean = ['contractEndDate', 'nextAddendumDate', 'fechaNacimiento', 'idExpiryDate', 'fechaVencimientoLicencia'];
    
    fieldsToClean.forEach(field => {
        if (data[field] === 'SIN TÉRMINO' || data[field] === '') {
            data[field] = null;
        }
    });

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
router.get('/', protect, async (req, res) => {
    try {
        const { status, position, projectId, includeAll, includeInactive } = req.query;
        let filter;
        if (['ceo_genai', 'ceo'].includes(req.user.role)) {
            filter = {};
        } else if (req.user.role === 'admin') {
            filter = {
                $or: [ { empresaRef: req.user.empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ]
            };
        } else {
            filter = { empresaRef: req.user.empresaRef };
        }

        if (includeInactive !== 'true') filter.isActive = true;
        if (status) filter.status = status;
        if (position) filter.position = new RegExp(position, 'i');
        if (projectId) filter.projectId = projectId;
        if (req.query.empresaRef && ['ceo_genai', 'ceo'].includes(req.user.role)) {
            filter.empresaRef = req.query.empresaRef;
        }

        const candidatos = await Candidato.find(filter)
            .populate('projectId', 'nombreProyecto projectName centroCosto area')
            .populate('empresaRef', 'nombre rut slug')
            .sort({ updatedAt: -1 });
        res.json(candidatos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/finiquitos', protect, async (req, res) => {
    try {
        const { proyecto, ceco, desde, hasta } = req.query;
        let filter = { status: 'Finiquitado', isActive: true };

        if (['ceo_genai', 'ceo'].includes(req.user.role)) {
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

router.get('/rut/:rut', protect, async (req, res) => {
    try {
        const r = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        let filter;
        if (['ceo_genai', 'ceo'].includes(req.user.role)) { filter = { rut: r }; }
        else if (req.user.role === 'admin') {
            filter = { rut: r, $or: [ { empresaRef: req.user.empresaRef }, { empresaRef: null }, { empresaRef: { $exists: false } } ] };
        } else { filter = { rut: r, empresaRef: req.user.empresaRef }; }
        const candidato = await Candidato.findOne(filter).populate('projectId').populate('empresaRef');
        if (!candidato) return res.status(404).json({ message: 'No encontrado' });
        res.json(candidato);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef }).populate('projectId').populate('empresaRef');
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, async (req, res) => {
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

router.put('/:id', protect, async (req, res) => {
    try {
        const cleanData = sanitizeCandidatoData(req.body);
        const updated = await Candidato.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            cleanData,
            { new: true }
        );

        if (updated) {
            try {
                const notificationService = require('../../../utils/notificationService');
                await notificationService.notifyAction({
                    actor: req.user,
                    moduleKey: 'rrhh_captura',
                    action: 'actualizó',
                    entityName: `postulante ${updated.fullName || updated.nombre}`,
                    entityId: updated._id,
                    companyRef: req.user.empresaRef,
                    isImportant: false,
                    messageExtra: `status: ${updated.status || 'no disponible'}`
                });
            } catch (err) {
                console.error('Error notificando actualización de candidato:', err.message);
            }
        }

        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/status', protect, async (req, res) => {
    try {
        const cleanData = sanitizeCandidatoData(req.body);
        const { status, note, user, approvalChain, validationRequested } = cleanData;
        
        const candidateFilter = { _id: req.params.id };
        if (!['ceo_genai', 'ceo'].includes(req.user.role)) {
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
                if (emails.length > 0) await mailer.sendCandidateValidationEmail(c, emails.join(', '));
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
                const UserGenAi = require('../../auth/UserGenAi');
                const mailer = require('../../../utils/mailer');
                const admins = await UserGenAi.find({ empresaRef: req.user.empresaRef, role: { $in: ['admin', 'ceo', 'ceo_genai'] }, status: 'Activo' });
                for (const admin of admins) {
                    await Notification.create({
                        userEmail: admin.email, title: 'Ingreso Confirmado',
                        message: `El ingreso de ${c.fullName} ha sido aprobado.`,
                        type: 'approval', link: '/rrhh/personal-activo',
                        empresaRef: req.user.empresaRef, metadata: { candidatoId: c._id, module: 'RRHH', action: 'Hiring' }
                    });
                }
                const adminEmails = admins.map(a => a.email).join(', ');
                if (adminEmails) await mailer.sendApprovalNotificationEmail(c, adminEmails, 'Ingreso');
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
        c.documents.push({ docType: req.body.docType, url, status: 'Pendiente' });
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
        const vac = c.vacaciones.id(vacId);
        if (!vac) return res.status(404).json({ message: 'No encontrado' });
        if (approvalChain !== undefined) vac.approvalChain = approvalChain;
        if (estado !== undefined) vac.estado = estado;
        if (aprobadoPor !== undefined) vac.aprobadoPor = aprobadoPor;
        if (validationRequested !== undefined) vac.validationRequested = validationRequested;
        await c.save();
        if (estado === 'Aprobado') {
            try {
                const Notification = require('../models/Notification');
                const UserGenAi = require('../../auth/UserGenAi');
                const mailer = require('../../../utils/mailer');
                const admins = await UserGenAi.find({ empresaRef: req.user.empresaRef, role: { $in: ['admin', 'ceo', 'ceo_genai'] }, status: 'Activo' });
                for (const admin of admins) {
                    await Notification.create({
                        userEmail: admin.email, title: `${vac.tipo} Aprobado`,
                        message: `La solicitud de ${vac.tipo} para ${c.fullName} ha sido aprobada.`,
                        type: 'approval', link: '/rrhh/vacaciones-licencias',
                        empresaRef: req.user.empresaRef, metadata: { candidatoId: c._id, module: 'RRHH', action: 'Vacation' }
                    });
                }
                const adminEmails = admins.map(a => a.email).join(', ');
                if (adminEmails) await mailer.sendApprovalNotificationEmail(c, adminEmails, vac.tipo, vac);
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

router.delete('/:id', protect, async (req, res) => {
    try {
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.isActive = false;
        await c.save();
        res.json({ message: 'Archivado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
