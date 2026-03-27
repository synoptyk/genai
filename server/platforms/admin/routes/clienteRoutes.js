const express = require('express');
const router = express.Router();
const Cliente = require('../../agentetelecom/models/Cliente');
const { protect, authorize } = require('../../auth/authMiddleware');

// 🔒 GET ALL CLIENTS (FILTRO POR EMPRESA)
router.get('/', authorize('cfg_clientes:ver'), async (req, res) => {
    try {
        const clientes = await Cliente.find({ empresaRef: req.user.empresaRef }).sort({ nombre: 1 });
        res.json(clientes);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔒 GET SINGLE CLIENT
router.get('/:id', authorize('cfg_clientes:ver'), async (req, res) => {
    try {
        const c = await Cliente.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!c) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(c);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// 🔒 CREATE CLIENT
router.post('/', authorize('cfg_clientes:crear'), async (req, res) => {
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
router.put('/:id', authorize('cfg_clientes:editar'), async (req, res) => {
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
router.delete('/:id', authorize('cfg_clientes:eliminar'), async (req, res) => {
    try {
        const result = await Cliente.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Cliente eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
