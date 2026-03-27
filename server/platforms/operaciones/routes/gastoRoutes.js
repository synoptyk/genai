const express = require('express');
const router = express.Router();
const Gasto = require('../models/Gasto');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const notificationService = require('../../../utils/notificationService');
const { protect, authorize } = require('../../auth/authMiddleware');

// Autenticación global para todas las rutas
router.use(protect);

// 1. Crear rendición de gasto (Trabajador)
router.post('/', authorize('op_gastos:crear'), async (req, res) => {
    try {
        const { 
            rut, nombre, proyecto, tipoGasto, monto, fechaGasto, 
            comprobanteUrl, descripcion, autorizador, evidenciaAutorizacionUrl,
            tipoDocumento, montoNeto, ivaRecuperable, ivaPerdido, subtipoOtros
        } = req.body;
        
        if (!rut || !tipoGasto || !monto) {
            return res.status(400).json({ error: "RUT, tipo de gasto y monto son obligatorios" });
        }

        // Buscar técnico para obtener su supervisor y vincular automáticamente
        const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        const tecnico = await Tecnico.findOne({ rut: rutLimpio });
        const supervisorId = tecnico?.supervisor;

        const nuevoGasto = new Gasto({
            rut: rutLimpio,
            nombre,
            empresaRef: req.user.empresaRef,
            proyecto,
            tipoGasto,
            subtipoOtros,
            monto,
            montoNeto,
            ivaRecuperable,
            ivaPerdido,
            tipoDocumento: tipoDocumento || 'BOLETA',
            fechaGasto: fechaGasto || new Date(),
            comprobanteUrl,
            autorizador,
            evidenciaAutorizacionUrl,
            descripcion,
            supervisorId,
            estado: req.user.role === 'tecnico' ? 'PENDIENTE' : 'APROBADO'
        });


        await nuevoGasto.save();

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'operaciones_gastos',
            action: 'rindió',
            entityName: `gasto por ${monto}`,
            entityId: nuevoGasto._id,
            companyRef: req.user.empresaRef,
            isImportant: false
        });

        res.status(201).json(nuevoGasto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Obtener gastos para un supervisor (Pendientes de aprobación)
router.get('/supervisor/:supervisorId', authorize('op_gastos:ver'), async (req, res) => {
    try {
        const solicitudes = await Gasto.find({ 
            supervisorId: req.params.supervisorId,
            empresaRef: req.user.empresaRef
        }).sort({ createdAt: -1 });
        res.json(solicitudes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2.1. Obtener todos los gastos de la empresa (Admin/Gerencia)
router.get('/all', authorize('op_gastos:ver'), async (req, res) => {
    try {
        const gastos = await Gasto.find({ 
            empresaRef: req.user.empresaRef 
        }).sort({ createdAt: -1 });
        res.json(gastos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// 3. Obtener historial de gastos de un trabajador
router.get('/rut/:rut', authorize('op_gastos:ver'), async (req, res) => {
    try {
        const rutLimpio = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        const gastos = await Gasto.find({ 
            rut: rutLimpio,
            empresaRef: req.user.empresaRef
        }).sort({ createdAt: -1 });
        res.json(gastos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Actualizar estado (Supervisor/Admin)
router.patch('/:id/estado', authorize('op_gastos:editar'), async (req, res) => {
    try {
        const { estado, comentarioSupervisor, comentarioGerente } = req.body;
        
        if (!['APROBADO', 'RECHAZADO', 'PAGADO', 'GERENCIA'].includes(estado)) {
            return res.status(400).json({ error: "Estado no válido" });
        }

        const updateFields = { estado, notificado: true };
        if (comentarioSupervisor) updateFields.comentarioSupervisor = comentarioSupervisor;
        if (comentarioGerente) updateFields.comentarioGerente = comentarioGerente;
        if (estado === 'GERENCIA') updateFields.gerenteId = null; // Para que aparezca en el pool de gerencia

        const gasto = await Gasto.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true }
        );


        if (!gasto) return res.status(404).json({ error: "Gasto no encontrado" });

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'operaciones_gastos',
            action: 'actualizó',
            entityName: `gasto ${gasto._id}`,
            entityId: gasto._id,
            companyRef: req.user.empresaRef,
            isImportant: true,
            messageExtra: `nuevo estado: ${estado}`
        });

        res.json(gasto);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Estadísticas globales (Admin)
router.get('/stats', authorize('op_gastos:ver'), async (req, res) => {
    try {
        const stats = await Gasto.aggregate([
            { $match: { empresaRef: req.user.empresaRef } },
            { $group: {
                _id: "$tipoGasto",
                total: { $sum: "$monto" },
                totalNeto: { $sum: "$montoNeto" },
                totalIvaRecup: { $sum: "$ivaRecuperable" },
                totalIvaPerdido: { $sum: "$ivaPerdido" },
                count: { $sum: 1 }
            }}
        ]);
        res.json(stats);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
