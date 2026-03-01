const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');

router.get('/', async (req, res) => {
    try {
        const { fecha, candidatoId, month, year } = req.query;
        const filter = {};
        if (candidatoId) filter.candidatoId = candidatoId;
        if (fecha) {
            const d = new Date(fecha);
            filter.fecha = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
        }
        if (month && year) {
            filter.fecha = {
                $gte: new Date(year, month - 1, 1),
                $lte: new Date(year, month, 0, 23, 59, 59)
            };
        }
        const registros = await RegistroAsistencia.find(filter)
            .populate('candidatoId', 'fullName rut position')
            .populate('turnoId', 'nombre horaEntrada horaSalida')
            .sort({ fecha: -1 });
        res.json(registros);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    try {
        const registro = new RegistroAsistencia(req.body);
        const saved = await registro.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// Bulk register attendance
router.post('/bulk', async (req, res) => {
    try {
        const { registros } = req.body;
        const result = await RegistroAsistencia.insertMany(registros);
        res.status(201).json(result);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const updated = await RegistroAsistencia.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await RegistroAsistencia.findByIdAndDelete(req.params.id);
        res.json({ message: 'Registro eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
