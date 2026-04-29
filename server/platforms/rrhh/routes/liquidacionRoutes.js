const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');
const RegistroAsistencia = require('../models/RegistroAsistencia');
const Actividad = require('../../agentetelecom/models/Actividad');
const Tecnico = require('../../agentetelecom/models/Tecnico');
const { protect } = require('../../auth/authMiddleware');

// GET /api/rrhh/nomina/historial - Obtener historial de liquidaciones (con filtros cliente/proyecto)
router.get('/historial', protect, async (req, res) => {
    try {
        const { periodo, trabajadorId, clienteId, proyectoId } = req.query;
        // 🔒 FILTRO POR EMPRESA
        let filtro = { empresaRef: req.user.empresaRef };
        if (periodo) filtro.periodo = periodo;
        if (trabajadorId) filtro.trabajadorId = trabajadorId;
        // FASE 4: Agregar filtros de cliente y proyecto
        if (clienteId) filtro.clienteId = clienteId;
        if (proyectoId) filtro.proyectoId = proyectoId;

        const regs = await Liquidacion.find(filtro).sort({ periodo: -1, rutTrabajador: 1 });
        res.json(regs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rrhh/nomina/guardar-lote - Guardar lote de liquidaciones (Snapshot)
// Enriquece cada liquidación con datos de asistencia y producción
router.post('/guardar-lote', protect, async (req, res) => {
    try {
        const { liquidaciones } = req.body;
        if (!Array.isArray(liquidaciones)) return res.status(400).json({ error: 'Formato inválido' });

        // Enriquecer cada liquidación con datos de asistencia y producción
        const bulkOps = liquidaciones.map(liq => {
            const [mes, año] = liq.periodo.split('-');
            const firstDay = new Date(Date.UTC(Number(año), Number(mes) - 1, 1));
            const lastDay = new Date(Date.UTC(Number(año), Number(mes), 0, 23, 59, 59));

            return {
                updateOne: {
                    filter: {
                        trabajadorId: liq.trabajadorId,
                        periodo: liq.periodo,
                        empresaRef: req.user.empresaRef
                    },
                    update: {
                        $set: {
                            ...liq,
                            empresaRef: req.user.empresaRef,
                            // Snapshot de asistencia (estos datos vienen del cliente en liq.asistencia)
                            asistencia: liq.asistencia || {},
                            produccion: liq.produccion || {}
                        }
                    },
                    upsert: true
                }
            };
        });

        await Liquidacion.bulkWrite(bulkOps);
        res.json({ message: `Sincronizadas ${liquidaciones.length} liquidaciones exitosamente con detalles de asistencia y producción.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PLATFORM CONFIGURATION (DYNAMIC MAPPING) ---
const PayrollConfig = require('../models/PayrollConfig');

// GET /api/rrhh/nomina/config
router.get('/config', protect, async (req, res) => {
    try {
        let config = await PayrollConfig.findOne({ empresaRef: req.user.empresaRef });
        if (!config) {
            // Seed default config for company
            config = new PayrollConfig({ empresaRef: req.user.empresaRef });
            await config.save();
        }
        res.json(config);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rrhh/nomina/config
router.post('/config', protect, async (req, res) => {
    try {
        const { mappings, config, extraColumns, manualValuesByPeriod } = req.body;
        const update = { updatedAt: new Date() };
        if (mappings !== undefined)             update.mappings             = mappings;
        if (config !== undefined)               update.config               = config;
        if (extraColumns !== undefined)         update.extraColumns         = extraColumns;
        if (manualValuesByPeriod !== undefined) update.manualValuesByPeriod = manualValuesByPeriod;

        const result = await PayrollConfig.findOneAndUpdate(
            { empresaRef: req.user.empresaRef },
            { $set: update },
            { upsert: true, new: true }
        );
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PAYROLL TEMPLATES (MAPPINGS PERSISTENCE) ---
const PayrollTemplate = require('../models/PayrollTemplate');

// GET /api/rrhh/nomina/templates
router.get('/templates', protect, async (req, res) => {
    try {
        const temps = await PayrollTemplate.find({ empresaRef: req.user.empresaRef }).sort({ createdAt: -1 });
        res.json(temps);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rrhh/nomina/templates
router.post('/templates', protect, async (req, res) => {
    try {
        const { name, config } = req.body;
        // Upsert by name per company
        const temp = await PayrollTemplate.findOneAndUpdate(
            { empresaRef: req.user.empresaRef, name },
            { config, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json(temp);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
