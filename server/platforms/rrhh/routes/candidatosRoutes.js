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
// Query params:
//   status=Contratado       → filter by status
//   position=...            → filter by position (regex)
//   projectId=...           → filter by project
//   includeAll=true         → include finiquitados/retirados (for Historial)
//   includeInactive=true    → include soft-deleted (isActive: false)
router.get('/', protect, async (req, res) => {
    try {
        const { status, position, projectId, includeAll, includeInactive } = req.query;
        // 🔒 FILTRO POR EMPRESA
        const filter = { empresaRef: req.user.empresaRef };
        if (includeInactive !== 'true') filter.isActive = true;
        if (status) filter.status = status;
        if (position) filter.position = new RegExp(position, 'i');
        if (projectId) filter.projectId = projectId;

        // When includeAll is NOT set, historically historial needs finiquitados too
        // Default behavior: return everything active (Postulando → Finiquitado)

        const candidatos = await Candidato.find(filter)
            .populate('projectId', 'nombreProyecto projectName centroCosto area')
            .sort({ updatedAt: -1 });
        res.json(candidatos);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET single candidato by RUT ─────────────────────────────────────
router.get('/rut/:rut', protect, async (req, res) => {
    try {
        const r = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        // 🔒 FILTRO POR EMPRESA
        const candidato = await Candidato.findOne({ rut: r, empresaRef: req.user.empresaRef })
            .populate('projectId', 'nombreProyecto projectName centroCosto area');
        if (!candidato) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(candidato);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ── GET single candidato ──────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef })
            .populate('projectId', 'nombreProyecto projectName centroCosto area');
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST create candidato ─────────────────────────────────────────
router.post('/', protect, async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA Y SANITIZAR
        const cleanData = sanitizeCandidatoData(req.body);
        const candidato = new Candidato({
            ...cleanData,
            empresaRef: req.user.empresaRef,
            history: [{ action: 'Registro', description: 'Postulante ingresado al sistema', user: req.user?.name || 'Sistema' }]
        });
        const saved = await candidato.save();
        res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'RUT ya registrado' });
        res.status(400).json({ message: err.message });
    }
});

// ── PUT update candidato ──────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA Y SANITIZAR
        const cleanData = sanitizeCandidatoData(req.body);
        const updated = await Candidato.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            cleanData,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update status ─────────────────────────────────────────────
// KEY ROUTE: This is the heart of the Proyecto <-> Candidato integration.
// When status changes to 'Contratado': proyecto.dotacion[cargo].cubiertos++
// When status changes to 'Finiquitado'/'Retirado': proyecto.dotacion[cargo].cubiertos--
router.put('/:id/status', protect, async (req, res) => {
    try {
        const cleanData = sanitizeCandidatoData(req.body);
        const { status, note, user, approvalChain } = cleanData;
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });

        const oldStatus = c.status;

        // Apply status
        c.status = status;
        if (approvalChain) c.approvalChain = approvalChain;

        // If hiring approved → sync contract fields
        if (status === CONTRATADO_STATUS && cleanData.contractStartDate) {
            c.contractStartDate = cleanData.contractStartDate;
            c.contractType = cleanData.contractType || c.contractType;
        }

        // History event
        const desc = `Estado cambiado: ${oldStatus} → ${status}${note ? '. ' + note : ''}`;
        c.history.push({ action: 'Cambio de Estado', description: desc, user: user || 'Sistema' });

        await c.save();

        // ── AUTO-UPDATE proyecto.dotacion.cubiertos ──
        await updateProyectoCubiertos(c, oldStatus, status);

        // ── SYNC OPERACIONES (Solo si fue contratado) ──
        if (status === CONTRATADO_STATUS) {
            await syncToTecnico(c, req.user.empresaRef);
            await handlePortalAccess(c);
        }

        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update interview ──────────────────────────────────────────
router.put('/:id/interview', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.interview = { ...c.interview?.toObject(), ...req.body };
        if (req.body.scheduledDate && !c.interview.interviewStatus) {
            c.interview.interviewStatus = 'Agendada';
            c.status = 'En Entrevista';
        }
        c.history.push({ action: 'Entrevista Actualizada', description: 'Datos de entrevista actualizados', user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add note ─────────────────────────────────────────────────
router.post('/:id/notes', protect, async (req, res) => {
    try {
        const { note, author } = req.body;
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.notes.push({ text: note, author: author || 'Sistema' });
        c.history.push({ action: 'Nota Añadida', description: note, user: author || 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST upload document ─────────────────────────────────────────
router.post('/:id/documents', protect, upload.single('file'), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });

        let url = null;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ folder: 'rrhh-documentos' }, (err, res) => {
                    if (err) reject(err); else resolve(res);
                }).end(req.file.buffer);
            });
            url = result.secure_url;
        }

        c.documents.push({ docType: req.body.docType || 'Documento', url, status: 'Pendiente' });
        c.history.push({ action: 'Documento Subido', description: `Documento: ${req.body.docType}`, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update hiring / finalización de contratación ─────────────
// When managerApproval = 'Aprobado' → triggers status = 'Contratado'
// which then cascades through the status route logic
router.put('/:id/hiring', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });

        const oldStatus = c.status;
        const cleanData = sanitizeCandidatoData(req.body);
        c.hiring = { ...c.hiring?.toObject(), ...cleanData };

        // Also mirror contract fields at root level for convenience
        if (cleanData.contractStartDate) c.contractStartDate = cleanData.contractStartDate;
        if (cleanData.contractEndDate || cleanData.contractEndDate === null) c.contractEndDate = cleanData.contractEndDate;
        if (cleanData.contractType) c.contractType = cleanData.contractType;

        if (req.body.managerApproval === 'Aprobado') {
            c.status = CONTRATADO_STATUS;
            c.history.push({ action: 'Contratación Aprobada', description: `Aprobado por: ${req.body.approvedBy}`, user: req.body.approvedBy || 'Gerencia' });
            await c.save();
            await updateProyectoCubiertos(c, oldStatus, CONTRATADO_STATUS);
            await syncToTecnico(c, req.user.empresaRef);
            await handlePortalAccess(c);
        } else if (req.body.managerApproval === 'Rechazado') {
            c.status = 'Rechazado';
            c.history.push({ action: 'Contratación Rechazada', description: req.body.managerNote || '', user: 'Gerencia' });
            await c.save();
        } else {
            await c.save();
        }

        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update accreditation ─────────────────────────────────────
router.put('/:id/accreditation', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.accreditation = { ...c.accreditation?.toObject(), ...req.body };
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add test result ─────────────────────────────────────────
router.post('/:id/tests', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.tests.push(req.body);
        c.history.push({ action: 'Test Registrado', description: `Test: ${req.body.testName}`, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add vacacion/licencia ───────────────────────────────────
// Includes approval chain from EmpresaConfig if it comes in the request
router.post('/:id/vacaciones', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.vacaciones.push(req.body);
        c.history.push({
            action: 'Solicitud Vacaciones/Permiso',
            description: `${req.body.tipo}: ${req.body.fechaInicio} - ${req.body.fechaFin}`,
            user: 'Sistema'
        });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT approve/reject a single vacacion item ────────────────────
// PATCH /:id/vacaciones/:vacId  — updates a specific vacacion entry
router.put('/:id/vacaciones/:vacId', protect, async (req, res) => {
    try {
        const { vacId } = req.params;
        const { approvalChain, estado, aprobadoPor, validationRequested } = req.body;

        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });

        const vac = c.vacaciones.id(vacId);
        if (!vac) return res.status(404).json({ message: 'Solicitud de vacación no encontrada' });

        if (approvalChain !== undefined) vac.approvalChain = approvalChain;
        if (estado !== undefined) vac.estado = estado;
        if (aprobadoPor !== undefined) vac.aprobadoPor = aprobadoPor;
        if (validationRequested !== undefined) vac.validationRequested = validationRequested;

        const statusLabel = estado === 'Aprobado' ? 'aprobada' : estado === 'Rechazado' ? 'rechazada' : 'actualizada';
        c.history.push({
            action: `Solicitud ${vac.tipo} ${statusLabel}`,
            description: `${vac.tipo} ${vac.fechaInicio} - ${vac.fechaFin} → ${estado}`,
            user: aprobadoPor || 'Sistema'
        });

        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add amonestacion ────────────────────────────────────────
router.post('/:id/amonestaciones', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.amonestaciones.push(req.body);
        c.history.push({ action: 'Amonestación Registrada', description: req.body.motivo, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add felicitacion ────────────────────────────────────────
router.post('/:id/felicitaciones', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.felicitaciones.push(req.body);
        c.history.push({ action: 'Felicitación Registrada', description: req.body.motivo, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE candidato (soft delete) ──────────────────────────────
router.delete('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const c = await Candidato.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        c.isActive = false;
        c.history.push({ action: 'Archivado', description: 'Registro archivado del sistema', user: 'Sistema' });
        await c.save();
        res.json({ message: 'Candidato archivado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
