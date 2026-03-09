const express = require('express');
const router = express.Router();
const RiesgoIPER = require('../models/RiesgoIPER');
const { protect } = require('../../auth/authMiddleware');

// GET /api/prevencion/matriz-riesgos
router.get('/', protect, async (req, res) => {
    try {
        const { proyecto, proceso, nivel } = req.query;
        // 🔒 FILTRO POR EMPRESA
        let filtro = { empresaRef: req.user.empresaRef };
        if (proyecto) filtro.proyecto = proyecto;
        if (proceso) filtro.proceso = proceso;
        if (nivel) filtro.nivelRiesgo = nivel;
        const riesgos = await RiesgoIPER.find(filtro).sort({ updatedAt: -1 });
        res.json(riesgos);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/prevencion/matriz-riesgos/:id
router.get('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const r = await RiesgoIPER.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!r) return res.status(404).json({ error: 'Riesgo no encontrado o sin acceso' });
        res.json(r);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/prevencion/matriz-riesgos
router.post('/', protect, async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const riesgo = new RiesgoIPER({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        await riesgo.save();
        res.status(201).json(riesgo);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/prevencion/matriz-riesgos/:id
router.put('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const riesgo = await RiesgoIPER.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { ...req.body, updatedAt: new Date() },
            { new: true, runValidators: true }
        );
        if (!riesgo) return res.status(404).json({ error: 'Riesgo no encontrado o sin acceso' });
        res.json(riesgo);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/prevencion/matriz-riesgos/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await RiesgoIPER.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ error: 'Riesgo no encontrado o sin acceso' });
        res.json({ message: 'Riesgo eliminado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
