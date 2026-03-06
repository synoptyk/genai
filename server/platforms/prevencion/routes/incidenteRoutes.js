const express = require('express');
const router = express.Router();
const Hallazgo = require('../models/Hallazgo');

// GET /api/prevencion/incidentes
router.get('/', async (req, res) => {
    try {
        const { proyecto, tipo, estado, fechaInicio, fechaFin } = req.query;
        // 🔒 FILTRO POR EMPRESA
        let filtro = { empresaRef: req.user.empresaRef };
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
        // 🔒 FILTRO POR EMPRESA
        const inc = await Hallazgo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!inc) return res.status(404).json({ error: 'Incidente no encontrado o sin acceso' });
        res.json(inc);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/prevencion/incidentes
router.post('/', async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const inc = new Hallazgo({
            ...req.body,
            empresaRef: req.user.empresaRef,
            fecha: req.body.fecha || new Date()
        });
        await inc.save();
        res.status(201).json(inc);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/prevencion/incidentes/:id
router.put('/:id', async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const inc = await Hallazgo.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!inc) return res.status(404).json({ error: 'Incidente no encontrado o sin acceso' });
        res.json(inc);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/prevencion/incidentes/:id
router.delete('/:id', async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await Hallazgo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ error: 'No encontrado o sin acceso' });
        res.json({ message: 'Incidente eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
