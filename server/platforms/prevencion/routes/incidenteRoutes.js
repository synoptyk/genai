const express = require('express');
const router = express.Router();
const Hallazgo = require('../models/Hallazgo');

// GET /api/prevencion/incidentes
router.get('/', async (req, res) => {
    try {
        const { proyecto, tipo, estado, fechaInicio, fechaFin } = req.query;
        let filtro = {};
        if (proyecto) filtro.proyecto = proyecto;
        if (tipo) filtro.tipo = tipo;
        if (estado) filtro.estado = estado;
        if (fechaInicio || fechaFin) {
            filtro.fecha = {};
            if (fechaInicio) filtro.fecha.$gte = new Date(fechaInicio);
            if (fechaFin) filtro.fecha.$lte = new Date(new Date(fechaFin).setHours(23, 59, 59, 999));
        }
        const incidentes = await Hallazgo.find(filtro).sort({ fecha: -1 });
        res.json(incidentes);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/prevencion/incidentes/:id
router.get('/:id', async (req, res) => {
    try {
        const inc = await Hallazgo.findById(req.params.id);
        if (!inc) return res.status(404).json({ error: 'Incidente no encontrado' });
        res.json(inc);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/prevencion/incidentes
router.post('/', async (req, res) => {
    try {
        const inc = new Hallazgo({ ...req.body, fecha: req.body.fecha || new Date() });
        await inc.save();
        res.status(201).json(inc);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/prevencion/incidentes/:id
router.put('/:id', async (req, res) => {
    try {
        const inc = await Hallazgo.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!inc) return res.status(404).json({ error: 'Incidente no encontrado' });
        res.json(inc);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/prevencion/incidentes/:id
router.delete('/:id', async (req, res) => {
    try {
        await Hallazgo.findByIdAndDelete(req.params.id);
        res.json({ message: 'Incidente eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
