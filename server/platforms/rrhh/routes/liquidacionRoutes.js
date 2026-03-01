const express = require('express');
const router = express.Router();
const Liquidacion = require('../models/Liquidacion');

// GET /api/rrhh/nomina/historial - Obtener historial de liquidaciones
router.get('/historial', async (req, res) => {
    try {
        const { periodo, trabajadorId } = req.query;
        let filtro = {};
        if (periodo) filtro.periodo = periodo;
        if (trabajadorId) filtro.trabajadorId = trabajadorId;

        const regs = await Liquidacion.find(filtro).sort({ periodo: -1, rutTrabajador: 1 });
        res.json(regs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/rrhh/nomina/guardar-lote - Guardar lote de liquidaciones (Snapshot)
router.post('/guardar-lote', async (req, res) => {
    try {
        const { liquidaciones } = req.body;
        if (!Array.isArray(liquidaciones)) return res.status(400).json({ error: 'Formato inválido' });

        // Upsert por trabajador y periodo
        const bulkOps = liquidaciones.map(liq => ({
            updateOne: {
                filter: { trabajadorId: liq.trabajadorId, periodo: liq.periodo },
                update: { $set: liq },
                upsert: true
            }
        }));

        await Liquidacion.bulkWrite(bulkOps);
        res.json({ message: `Sincronizadas ${liquidaciones.length} liquidaciones exitosamente.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
