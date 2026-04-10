const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const Evaluacion360 = require('../models/Evaluacion360');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const rows = await Evaluacion360.find({ empresaRef })
      .populate('evaluadoRef', 'name email role cargo')
      .populate('evaluadoresRef', 'name email role cargo')
      .sort({ createdAt: -1 });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error listando evaluaciones', error: error.message });
  }
});

router.post('/', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const evaluacion = await Evaluacion360.create({
      ...req.body,
      empresaRef,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    res.status(201).json(evaluacion);
  } catch (error) {
    res.status(400).json({ message: 'Error creando evaluación', error: error.message });
  }
});

router.put('/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await Evaluacion360.findOne({ _id: req.params.id, empresaRef });
    if (!item) return res.status(404).json({ message: 'Evaluación no encontrada' });

    Object.assign(item, req.body || {});
    item.updatedBy = req.user._id;
    await item.save();

    res.json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando evaluación', error: error.message });
  }
});

router.post('/:id/responder', authorize('admin', 'gerencia', 'rrhh', 'supervisor', 'tecnico', 'operativo', 'user'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await Evaluacion360.findOne({ _id: req.params.id, empresaRef });
    if (!item) return res.status(404).json({ message: 'Evaluación no encontrada' });

    const yaRespondio = item.respuestas.some(r => String(r.evaluadorRef) === String(req.user._id));
    if (yaRespondio) {
      return res.status(400).json({ message: 'Ya existe una respuesta para este evaluador' });
    }

    item.respuestas.push({ evaluadorRef: req.user._id, puntajes: req.body?.puntajes || {}, comentario: req.body?.comentario || '' });
    item.updatedBy = req.user._id;
    await item.save();

    res.json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error respondiendo evaluación', error: error.message });
  }
});

module.exports = router;
