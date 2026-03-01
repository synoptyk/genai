const express = require('express');
const router = express.Router();
const Turno = require('../models/Turno');

router.get('/', async (req, res) => {
    try {
        const turnos = await Turno.find({ activo: true }).populate('colominoAsignados', 'fullName rut');
        res.json(turnos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    try {
        const turno = new Turno(req.body);
        const saved = await turno.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const updated = await Turno.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// Assign/unassign colaborador to turno
router.put('/:id/asignar', async (req, res) => {
    try {
        const { candidatoId, action } = req.body;
        const turno = await Turno.findById(req.params.id);
        if (!turno) return res.status(404).json({ message: 'Turno no encontrado' });
        if (action === 'add') {
            if (!turno.colominoAsignados.includes(candidatoId)) turno.colominoAsignados.push(candidatoId);
        } else {
            turno.colominoAsignados = turno.colominoAsignados.filter(id => id.toString() !== candidatoId);
        }
        await turno.save();
        res.json(turno);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await Turno.findByIdAndUpdate(req.params.id, { activo: false });
        res.json({ message: 'Turno eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
