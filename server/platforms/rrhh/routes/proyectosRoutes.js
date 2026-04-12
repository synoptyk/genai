const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');
const Empresa = require('../../auth/models/Empresa');
const { protect, authorize } = require('../../auth/authMiddleware');

router.use(protect);

router.get('/', authorize('admin_proyectos:ver', 'rrhh_captura:ver', 'cfg_clientes:ver', 'admin_mis_clientes:ver', 'rend_tarifario:ver'), async (req, res) => {
    try {
        let empresaRef = req.user.empresaRef;
        if (!empresaRef && req.user?.empresa?.nombre) {
            const emp = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            empresaRef = emp?._id;
        }
        if (!empresaRef) return res.json([]);

        // 🔒 FILTRO POR EMPRESA - POPULATE CLIENTE
        const proyectos = await Proyecto.find({ empresaRef })
            .populate('cliente')
            .sort({ createdAt: -1 });
        res.json(proyectos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', authorize('admin_proyectos:ver'), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const p = await Proyecto.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef }).populate('cliente');
        if (!p) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(p);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authorize('admin_proyectos:crear'), async (req, res) => {
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

router.put('/:id', authorize('admin_proyectos:editar'), async (req, res) => {
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

router.delete('/:id', authorize('admin_proyectos:eliminar'), async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await Proyecto.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Proyecto eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
