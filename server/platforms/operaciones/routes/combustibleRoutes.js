const express = require('express');
const router = express.Router();
const Combustible = require('../models/Combustible');
const Tecnico = require('../../agentetelecom/models/Tecnico'); // To get supervisor info
const notificationService = require('../../../utils/notificationService');
const { protect, authorize } = require('../../auth/authMiddleware');

const normalizeRut = (rut) => String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();
const isHighLevelRole = (role) => ['admin', 'ceo', 'system_admin', 'ceo_genai', 'gerencia'].includes(String(role || '').toLowerCase());

// Autenticación global para todas las rutas del módulo operaciones
router.use(protect);

// 1. Submit fuel request (Technician)
router.post('/', authorize('tecnico', 'user', 'admin', 'ceo', 'system_admin'), async (req, res) => {
    try {
        const { rut, patente, kmActual, fotoTacometro, nombre } = req.body;
        if (!rut || !patente || !kmActual || !fotoTacometro) {
            return res.status(400).json({ error: "Faltan campos obligatorios" });
        }

        if (!req.user?.empresaRef) {
            return res.status(400).json({ error: 'No se pudo resolver la empresa de la sesión' });
        }

        const rutLimpio = normalizeRut(rut);
        const patenteLimpia = String(patente || '').toUpperCase().trim();

        // Find technician to get their supervisor automatically
        const tecnico = await Tecnico.findOne({
            rut: rutLimpio,
            empresaRef: req.user.empresaRef
        }).select('_id supervisorId');
        const supervisorId = tecnico?.supervisorId || null;

        const nuevaSolicitud = new Combustible({
            rut: rutLimpio,
            empresaRef: req.user.empresaRef,
            nombre,
            patente: patenteLimpia,
            kmActual,
            fotoTacometro,
            supervisorId,
            estado: 'Pendiente'
        });

        await nuevaSolicitud.save();

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'operaciones_combustible',
            action: 'creó',
            entityName: `solicitud combustible ${nuevaSolicitud.patente || nuevaSolicitud._id}`,
            entityId: nuevaSolicitud._id,
            companyRef: req.user.empresaRef,
            isImportant: true
        });

        res.status(201).json(nuevaSolicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get requests for a supervisor
router.get('/supervisor/:supervisorId', authorize('supervisor', 'admin', 'ceo', 'system_admin'), async (req, res) => {
    try {
        const targetSupervisorId = isHighLevelRole(req.user.role) ? req.params.supervisorId : req.user._id;
        const solicitudes = await Combustible.find({
            empresaRef: req.user.empresaRef,
            supervisorId: targetSupervisorId
        })
            .sort({ fecha: -1 });
        res.json(solicitudes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Update status (Approve/Reject/Carga Realizada)
router.put('/:id/estado', authorize('supervisor', 'admin', 'ceo', 'system_admin'), async (req, res) => {
    try {
        const { estado, comentarioSupervisor } = req.body;
        const estadosPermitidos = ['Pendiente', 'Aprobado', 'Rechazado', 'Carga Realizada'];
        if (!estadosPermitidos.includes(estado)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const solicitud = await Combustible.findOne({
            _id: req.params.id,
            empresaRef: req.user.empresaRef
        });
        if (!solicitud) return res.status(404).json({ error: "Solicitud no encontrada" });

        const canManage = isHighLevelRole(req.user.role) || (String(solicitud.supervisorId || '') === String(req.user._id || ''));
        if (!canManage) {
            return res.status(403).json({ error: 'No tienes acceso a esta solicitud de combustible' });
        }

        solicitud.estado = estado;
        solicitud.comentarioSupervisor = comentarioSupervisor;
        solicitud.notificado = true;
        await solicitud.save();

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'operaciones_combustible',
            action: 'actualizó',
            entityName: `solicitud combustible ${solicitud.patente || solicitud._id}`,
            entityId: solicitud._id,
            companyRef: req.user.empresaRef,
            isImportant: true,
            messageExtra: `estado ${estado}`
        });

        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Get individual status (Technician notification)
router.get('/rut/:rut/reciente', async (req, res) => {
    try {
        const rutLimpio = normalizeRut(req.params.rut);
        const tecnico = await Tecnico.findOne({ rut: rutLimpio, empresaRef: req.user.empresaRef }).select('supervisorId email');
        const userRut = normalizeRut(req.user?.rut);
        const isOwner = userRut && userRut === rutLimpio;
        const isSupervisorOwner = tecnico && String(tecnico.supervisorId || '') === String(req.user._id || '');

        if (!isOwner && !isSupervisorOwner && !isHighLevelRole(req.user.role)) {
            return res.status(403).json({ error: 'No tienes acceso al historial de combustible solicitado' });
        }

        const solicitud = await Combustible.findOne({
            empresaRef: req.user.empresaRef,
            rut: rutLimpio
        })
            .sort({ fecha: -1 });
        res.json(solicitud);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Get last registered KM for a vehicle
router.get('/patente/:patente/last-km', async (req, res) => {
    try {
        const patente = req.params.patente.toUpperCase().trim();
        const lastRequest = await Combustible.findOne({
            empresaRef: req.user.empresaRef,
            patente,
            estado: { $ne: 'Rechazado' }
        })
            .sort({ fecha: -1 });
        res.json({ lastKm: lastRequest ? lastRequest.kmActual : 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
