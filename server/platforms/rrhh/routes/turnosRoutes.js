const express = require('express');
const router = express.Router();
const Turno = require('../models/Turno');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const turnos = await Turno.find({ activo: true, empresaRef: req.user.empresaRef })
            .populate('colominoAsignados', 'fullName rut');
        res.json(turnos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, async (req, res) => {
    try {
        // 🔒 INYECTAR EMPRESA
        const turno = new Turno({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        const saved = await turno.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const updated = await Turno.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Assign/unassign colaborador to turno
router.put('/:id/asignar', protect, async (req, res) => {
    try {
        const { candidatoId, action } = req.body;
        // 🔒 FILTRO POR EMPRESA
        const turno = await Turno.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!turno) return res.status(404).json({ message: 'Turno no encontrado o sin acceso' });
        if (action === 'add') {
            if (!turno.colominoAsignados.includes(candidatoId)) turno.colominoAsignados.push(candidatoId);
        } else {
            turno.colominoAsignados = turno.colominoAsignados.filter(id => id.toString() !== candidatoId);
        }
        await turno.save();
        res.json(turno);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', protect, async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await Turno.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            { activo: false },
            { new: true }
        );
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Turno eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
