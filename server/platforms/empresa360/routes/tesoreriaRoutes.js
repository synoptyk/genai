const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const TesoreriaMovimiento = require('../models/TesoreriaMovimiento');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/movimientos', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const rows = await TesoreriaMovimiento.find({ empresaRef }).sort({ fecha: -1, createdAt: -1 }).limit(500);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error listando movimientos', error: error.message });
  }
});

router.post('/movimientos', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await TesoreriaMovimiento.create({
      ...req.body,
      empresaRef,
      createdBy: req.user._id
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error creando movimiento', error: error.message });
  }
});

router.put('/movimientos/:id/conciliar', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await TesoreriaMovimiento.findOneAndUpdate(
      { _id: req.params.id, empresaRef },
      { $set: { conciliado: true, referenciaExterna: req.body?.referenciaExterna || null } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Movimiento no encontrado' });
    res.json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error conciliando movimiento', error: error.message });
  }
});

router.get('/resumen', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const rows = await TesoreriaMovimiento.find({ empresaRef });
    const resumen = rows.reduce((acc, m) => {
      const monto = Number(m.monto || 0);
      if (m.tipo === 'Ingreso') acc.ingresos += monto;
      else acc.egresos += monto;
      if (!m.conciliado) acc.pendientes += 1;
      return acc;
    }, { ingresos: 0, egresos: 0, balance: 0, pendientes: 0 });

    resumen.balance = Math.round((resumen.ingresos - resumen.egresos) * 100) / 100;
    resumen.ingresos = Math.round(resumen.ingresos * 100) / 100;
    resumen.egresos = Math.round(resumen.egresos * 100) / 100;

    res.json(resumen);
  } catch (error) {
    res.status(500).json({ message: 'Error calculando resumen tesorería', error: error.message });
  }
});

module.exports = router;
