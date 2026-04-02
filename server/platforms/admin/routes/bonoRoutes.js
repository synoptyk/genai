const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const ModeloBonificacion = require('../models/ModeloBonificacion');
const BonoMensualConsolidado = require('../models/BonoMensualConsolidado');

// GET all models for an empresa
// ...
router.get('/', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const models = await ModeloBonificacion.find({ empresaRef: empresaId }).sort({ createdAt: -1 });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET existing closures for a month/year (supports multiple models/depts)
router.get('/closure/:year/:month', protect, async (req, res) => {
  try {
    const { year, month } = req.params;
    const empresaId = req.user.empresaRef;
    const closures = await BonoMensualConsolidado.find({ mes: month, anio: year, empresaRef: empresaId })
      .populate({
        path: 'modeloRef',
        populate: { path: 'tipoBonoRef' }
      });
    res.json(closures);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST consolidate closure: Allow one per Model-Period
router.post('/consolidate', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const { mes, anio, calculos, totales, modeloId, status } = req.body;
    
    const closure = await BonoMensualConsolidado.findOneAndUpdate(
      { mes, anio, empresaRef: empresaId, modeloRef: modeloId },
      { 
        mes, anio, calculos, totales, modeloRef: modeloId, 
        empresaRef: empresaId, closedBy: req.user._id, status: status || 'CERRADO' 
      },
      { upsert: true, new: true }
    );
    res.json(closure);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



// GET active model
router.get('/active', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const active = await ModeloBonificacion.findOne({ empresaRef: empresaId, activo: true });
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET one
router.get('/:id', protect, async (req, res) => {
  try {
    const model = await ModeloBonificacion.findById(req.params.id);
    res.json(model);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE
router.post('/', protect, async (req, res) => {
  try {
    const empresaId = req.user.empresaRef;
    const newModel = new ModeloBonificacion({ ...req.body, empresaRef: empresaId });
    await newModel.save();
    res.status(201).json(newModel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put('/:id', protect, async (req, res) => {
  try {
    const updated = await ModeloBonificacion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE closure (Re-open)
router.delete('/closure/:year/:month', protect, async (req, res) => {
  try {
    const { year, month } = req.params;
    const empresaId = req.user.empresaRef;
    await BonoMensualConsolidado.deleteMany({ mes: month, anio: year, empresaRef: empresaId });
    res.json({ message: 'Cierre eliminado (Abierto)' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE model (existing)
router.delete('/:id', protect, async (req, res) => {
  try {
    await ModeloBonificacion.findByIdAndDelete(req.params.id);
    res.json({ message: 'Modelo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
