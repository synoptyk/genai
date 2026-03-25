const express = require('express');
const router = express.Router();
const Cliente = require('../../agentetelecom/models/Cliente');
const { protect } = require('../../auth/authMiddleware');

// 🔒 GET ALL CLIENTS (FILTRO POR EMPRESA)
router.get('/', protect, async (req, res) => {
    try {
        const clientes = await Cliente.find({ empresaRef: req.user.empresaRef }).sort({ nombre: 1 });
        res.json(clientes);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔒 GET SINGLE CLIENT
router.get('/:id', protect, async (req, res) => {
    try {
        const c = await Cliente.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔒 CREATE CLIENT
router.post('/', protect, async (req, res) => {
    try {
        const cliente = new Cliente({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        const saved = await cliente.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// 🔒 UPDATE CLIENT
router.put('/:id', protect, async (req, res) => {
    try {
        const updated = await Cliente.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔒 DELETE CLIENT
router.delete('/:id', protect, async (req, res) => {
    try {
        const result = await Cliente.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Cliente eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
