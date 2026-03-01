const express = require('express');
const router = express.Router();
const Proyecto = require('../models/Proyecto');

router.get('/', async (req, res) => {
    try {
        const proyectos = await Proyecto.find().sort({ createdAt: -1 });
        res.json(proyectos);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', async (req, res) => {
    try {
        const p = await Proyecto.findById(req.params.id);
        if (!p) return res.status(404).json({ message: 'No encontrado' });
        res.json(p);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
    try {
        const proyecto = new Proyecto(req.body);
        const saved = await proyecto.save();
        res.status(201).json(saved);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        const updated = await Proyecto.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await Proyecto.findByIdAndDelete(req.params.id);
        res.json({ message: 'Proyecto eliminado' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
