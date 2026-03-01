const express = require('express');
const router = express.Router();
const Candidato = require('../models/Candidato');
const Proyecto = require('../models/Proyecto');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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
        const dotItem = proyecto.dotacion.find(d =>
            d.cargo?.toLowerCase().trim() === cargo?.toLowerCase().trim()
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

// ── GET all candidatos ──────────────────────────────────────────────
// Query params:
//   status=Contratado       → filter by status
//   position=...            → filter by position (regex)
//   projectId=...           → filter by project
//   includeAll=true         → include finiquitados/retirados (for Historial)
//   includeInactive=true    → include soft-deleted (isActive: false)
router.get('/', async (req, res) => {
    try {
        const { status, position, projectId, includeAll, includeInactive } = req.query;
        const filter = {};

        // Only exclude truly deleted records unless explicitly requested
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

// ── GET single candidato ──────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id)
            .populate('projectId', 'nombreProyecto projectName centroCosto area');
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST create candidato ─────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const candidato = new Candidato({
            ...req.body,
            history: [{ action: 'Registro', description: 'Postulante ingresado al sistema', user: 'Sistema' }]
        });
        const saved = await candidato.save();
        res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'RUT ya registrado' });
        res.status(400).json({ message: err.message });
    }
});

// ── PUT update candidato ──────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const updated = await Candidato.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update status ─────────────────────────────────────────────
// KEY ROUTE: This is the heart of the Proyecto <-> Candidato integration.
// When status changes to 'Contratado': proyecto.dotacion[cargo].cubiertos++
// When status changes to 'Finiquitado'/'Retirado': proyecto.dotacion[cargo].cubiertos--
router.put('/:id/status', async (req, res) => {
    try {
        const { status, note, user, approvalChain } = req.body;
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const oldStatus = c.status;

        // Apply status
        c.status = status;
        if (approvalChain) c.approvalChain = approvalChain;

        // If hiring approved → sync contract fields
        if (status === CONTRATADO_STATUS && req.body.contractStartDate) {
            c.contractStartDate = req.body.contractStartDate;
            c.contractType = req.body.contractType || c.contractType;
        }

        // History event
        const desc = `Estado cambiado: ${oldStatus} → ${status}${note ? '. ' + note : ''}`;
        c.history.push({ action: 'Cambio de Estado', description: desc, user: user || 'Sistema' });

        await c.save();

        // ── AUTO-UPDATE proyecto.dotacion.cubiertos ──
        await updateProyectoCubiertos(c, oldStatus, status);

        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update interview ──────────────────────────────────────────
router.put('/:id/interview', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
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
router.post('/:id/notes', async (req, res) => {
    try {
        const { note, author } = req.body;
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.notes.push({ text: note, author: author || 'Sistema' });
        c.history.push({ action: 'Nota Añadida', description: note, user: author || 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST upload document ─────────────────────────────────────────
router.post('/:id/documents', upload.single('file'), async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
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

        c.documents.push({ docType: req.body.docType || 'Documento', url, status: 'Pendiente' });
        c.history.push({ action: 'Documento Subido', description: `Documento: ${req.body.docType}`, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT update hiring / finalización de contratación ─────────────
// When managerApproval = 'Aprobado' → triggers status = 'Contratado'
// which then cascades through the status route logic
router.put('/:id/hiring', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });

        const oldStatus = c.status;
        c.hiring = { ...c.hiring?.toObject(), ...req.body };

        // Also mirror contract fields at root level for convenience
        if (req.body.contractStartDate) c.contractStartDate = req.body.contractStartDate;
        if (req.body.contractEndDate) c.contractEndDate = req.body.contractEndDate;
        if (req.body.contractType) c.contractType = req.body.contractType;

        if (req.body.managerApproval === 'Aprobado') {
            c.status = CONTRATADO_STATUS;
            c.history.push({ action: 'Contratación Aprobada', description: `Aprobado por: ${req.body.approvedBy}`, user: req.body.approvedBy || 'Gerencia' });
            await c.save();
            await updateProyectoCubiertos(c, oldStatus, CONTRATADO_STATUS);
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
router.put('/:id/accreditation', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.accreditation = { ...c.accreditation?.toObject(), ...req.body };
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add test result ─────────────────────────────────────────
router.post('/:id/tests', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.tests.push(req.body);
        c.history.push({ action: 'Test Registrado', description: `Test: ${req.body.testName}`, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add vacacion/licencia ───────────────────────────────────
// Includes approval chain from EmpresaConfig if it comes in the request
router.post('/:id/vacaciones', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
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
router.put('/:id/vacaciones/:vacId', async (req, res) => {
    try {
        const { vacId } = req.params;
        const { approvalChain, estado, aprobadoPor, validationRequested } = req.body;

        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });

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
router.post('/:id/amonestaciones', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.amonestaciones.push(req.body);
        c.history.push({ action: 'Amonestación Registrada', description: req.body.motivo, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST add felicitacion ────────────────────────────────────────
router.post('/:id/felicitaciones', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.felicitaciones.push(req.body);
        c.history.push({ action: 'Felicitación Registrada', description: req.body.motivo, user: 'Sistema' });
        await c.save();
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE candidato (soft delete) ──────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const c = await Candidato.findById(req.params.id);
        if (!c) return res.status(404).json({ message: 'No encontrado' });
        c.isActive = false;
        c.history.push({ action: 'Archivado', description: 'Registro archivado del sistema', user: 'Sistema' });
        await c.save();
        res.json({ message: 'Candidato archivado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
