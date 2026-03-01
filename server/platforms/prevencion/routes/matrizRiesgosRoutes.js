const express = require('express');
const router = express.Router();
const RiesgoIPER = require('../models/RiesgoIPER');

// GET /api/prevencion/matriz-riesgos
router.get('/', async (req, res) => {
    try {
        const { proyecto, proceso, nivel } = req.query;
        let filtro = {};
        if (proyecto) filtro.proyecto = proyecto;
        if (proceso) filtro.proceso = proceso;
        if (nivel) filtro.nivelRiesgo = nivel;
        const riesgos = await RiesgoIPER.find(filtro).sort({ updatedAt: -1 });
        res.json(riesgos);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/prevencion/matriz-riesgos/:id
router.get('/:id', async (req, res) => {
    try {
        const r = await RiesgoIPER.findById(req.params.id);
        if (!r) return res.status(404).json({ error: 'Riesgo no encontrado' });
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/prevencion/matriz-riesgos
router.post('/', async (req, res) => {
    try {
        const riesgo = new RiesgoIPER(req.body);
        await riesgo.save();
        res.status(201).json(riesgo);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/prevencion/matriz-riesgos/:id
router.put('/:id', async (req, res) => {
    try {
        const riesgo = await RiesgoIPER.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!riesgo) return res.status(404).json({ error: 'Riesgo no encontrado' });
        res.json(riesgo);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/prevencion/matriz-riesgos/:id
router.delete('/:id', async (req, res) => {
    try {
        await RiesgoIPER.findByIdAndDelete(req.params.id);
        res.json({ message: 'Riesgo eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
