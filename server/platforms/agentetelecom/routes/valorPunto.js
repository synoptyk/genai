const express = require('express');
const router = express.Router();
const { protect } = require('../../auth/authMiddleware');
const ValorPuntoCliente = require('../models/ValorPuntoCliente');

// GET — Todos los clientes con su valor por punto
router.get('/', protect, async (req, res) => {
  try {
    const datos = await ValorPuntoCliente.find({ empresaRef: req.user.empresaRef }).sort({ cliente: 1 }).lean();
    res.json(datos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST — Crear nuevo cliente/proyecto
router.post('/', protect, async (req, res) => {
  try {
    const nuevo = new ValorPuntoCliente({ ...req.body, empresaRef: req.user.empresaRef });
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Este cliente/proyecto ya existe.' });
    res.status(500).json({ error: error.message });
  }
});

// PUT — Actualizar cliente/proyecto
router.put('/:id', protect, async (req, res) => {
  try {
    const actualizado = await ValorPuntoCliente.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      { $set: req.body },
      { new: true }
    );
    if (!actualizado) return res.status(404).json({ error: 'No encontrado.' });
    res.json(actualizado);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Este cliente/proyecto ya existe.' });
    res.status(500).json({ error: error.message });
  }
});

// DELETE — Eliminar cliente/proyecto
router.delete('/:id', protect, async (req, res) => {
  try {
    await ValorPuntoCliente.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
