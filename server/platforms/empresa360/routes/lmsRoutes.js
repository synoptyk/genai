const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const Curso360 = require('../models/Curso360');
const InscripcionCurso360 = require('../models/InscripcionCurso360');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/cursos', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const cursos = await Curso360.find({ empresaRef }).sort({ createdAt: -1 });
    res.json(cursos);
  } catch (error) {
    res.status(500).json({ message: 'Error listando cursos', error: error.message });
  }
});

router.post('/cursos', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const curso = await Curso360.create({
      ...req.body,
      empresaRef,
      createdBy: req.user._id
    });
    res.status(201).json(curso);
  } catch (error) {
    res.status(400).json({ message: 'Error creando curso', error: error.message });
  }
});

router.put('/cursos/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const curso = await Curso360.findOneAndUpdate(
      { _id: req.params.id, empresaRef },
      { $set: req.body || {} },
      { new: true }
    );

    if (!curso) return res.status(404).json({ message: 'Curso no encontrado' });
    res.json(curso);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando curso', error: error.message });
  }
});

router.get('/inscripciones', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const rows = await InscripcionCurso360.find({ empresaRef })
      .populate('cursoRef', 'titulo categoria estado')
      .populate('userRef', 'name email role cargo')
      .sort({ updatedAt: -1 });

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error listando inscripciones', error: error.message });
  }
});

router.post('/inscripciones', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const insc = await InscripcionCurso360.create({
      ...req.body,
      empresaRef,
      updatedBy: req.user._id
    });
    res.status(201).json(insc);
  } catch (error) {
    res.status(400).json({ message: 'Error inscribiendo colaborador', error: error.message });
  }
});

router.put('/inscripciones/:id/progreso', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const { progresoPct, notaFinal } = req.body || {};

    const update = { updatedBy: req.user._id };
    if (progresoPct !== undefined) {
      update.progresoPct = Math.max(0, Math.min(100, Number(progresoPct)));
      if (update.progresoPct > 0 && update.progresoPct < 100) update.estado = 'En Progreso';
      if (update.progresoPct === 100) {
        update.estado = Number(notaFinal || 0) >= 4 ? 'Aprobado' : 'Reprobado';
        update.fechaTermino = new Date();
      }
    }
    if (notaFinal !== undefined) update.notaFinal = Number(notaFinal);

    const insc = await InscripcionCurso360.findOneAndUpdate(
      { _id: req.params.id, empresaRef },
      { $set: update },
      { new: true }
    );

    if (!insc) return res.status(404).json({ message: 'Inscripción no encontrada' });
    res.json(insc);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando progreso', error: error.message });
  }
});

module.exports = router;
