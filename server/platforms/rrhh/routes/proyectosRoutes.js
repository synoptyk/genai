const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const proyectos = await Proyecto.find({ empresaRef: req.user.empresaRef }).sort({ createdAt: -1 });
        res.json(proyectos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const p = await Proyecto.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!p) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(p);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const proyecto = new Proyecto({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        const saved = await proyecto.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const updated = await Proyecto.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await Proyecto.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Proyecto eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
