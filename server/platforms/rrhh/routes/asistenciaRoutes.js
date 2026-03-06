const express = require('express');
const router = express.Router();
const RegistroAsistencia = require('../models/RegistroAsistencia');

router.get('/', async (req, res) => {
    try {
        const { fecha, candidatoId, month, year } = req.query;
        // 🔒 FILTRO POR EMPRESA
        const filter = { empresaRef: req.user.empresaRef };
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
        // 🔒 INYECTAR EMPRESA
        const registro = new RegistroAsistencia({
            ...req.body,
            empresaRef: req.user.empresaRef
        });
        const saved = await registro.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// Bulk register attendance
router.post('/bulk', async (req, res) => {
    try {
        const { registros } = req.body;
        // 🔒 INYECTAR EMPRESA EN CADA REGISTRO
        const registrosConEmpresa = registros.map(r => ({ ...r, empresaRef: req.user.empresaRef }));
        const result = await RegistroAsistencia.insertMany(registrosConEmpresa);
        res.status(201).json(result);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const updated = await RegistroAsistencia.findOneAndUpdate(
            { _id: req.params.id, empresaRef: req.user.empresaRef },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const result = await RegistroAsistencia.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Registro eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
