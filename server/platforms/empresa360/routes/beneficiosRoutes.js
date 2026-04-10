const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const Beneficio360 = require('../models/Beneficio360');
const AsignacionBeneficio360 = require('../models/AsignacionBeneficio360');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/catalogo', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const data = await Beneficio360.find({ empresaRef }).sort({ nombre: 1 });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error listando beneficios', error: error.message });
  }
});

router.post('/catalogo', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const beneficio = await Beneficio360.create({
      ...req.body,
      empresaRef,
      createdBy: req.user._id
    });
    res.status(201).json(beneficio);
  } catch (error) {
    res.status(400).json({ message: 'Error creando beneficio', error: error.message });
  }
});

router.get('/asignaciones', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const data = await AsignacionBeneficio360.find({ empresaRef })
      .populate('userRef', 'name email cargo')
      .populate('beneficioRef', 'nombre categoria montoMensual')
      .sort({ createdAt: -1 });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error listando asignaciones', error: error.message });
  }
});

router.post('/asignaciones', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const asignacion = await AsignacionBeneficio360.create({
      ...req.body,
      empresaRef,
      createdBy: req.user._id
    });
    res.status(201).json(asignacion);
  } catch (error) {
    res.status(400).json({ message: 'Error asignando beneficio', error: error.message });
  }
});

router.put('/asignaciones/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await AsignacionBeneficio360.findOneAndUpdate(
      { _id: req.params.id, empresaRef },
      { $set: req.body || {} },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Asignación no encontrada' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando asignación', error: error.message });
  }
});

module.exports = router;
