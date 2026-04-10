const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const Factura360 = require('../models/Factura360');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const estado = req.query.estado;
    const query = { empresaRef };
    if (estado) query.estado = estado;

    const facturas = await Factura360.find(query).sort({ createdAt: -1 }).limit(300);
    res.json(facturas);
  } catch (error) {
    res.status(500).json({ message: 'Error listando facturas', error: error.message });
  }
});

router.get('/resumen', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const facturas = await Factura360.find({ empresaRef });

    const resumen = facturas.reduce((acc, f) => {
      acc.totalEmitido += Number(f.total || 0);
      acc.totalPendiente += Number(f.saldoPendiente || 0);
      if (f.estado === 'Pagada') acc.totalPagado += Number(f.total || 0);
      if (f.estado === 'Vencida') acc.vencidas += 1;
      return acc;
    }, {
      cantidad: facturas.length,
      totalEmitido: 0,
      totalPagado: 0,
      totalPendiente: 0,
      vencidas: 0
    });

    Object.keys(resumen).forEach((k) => {
      if (typeof resumen[k] === 'number') resumen[k] = Math.round(resumen[k] * 100) / 100;
    });

    res.json(resumen);
  } catch (error) {
    res.status(500).json({ message: 'Error calculando resumen', error: error.message });
  }
});

router.post('/', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const payload = {
      ...req.body,
      empresaRef,
      createdBy: req.user._id,
      updatedBy: req.user._id
    };

    const factura = await Factura360.create(payload);
    res.status(201).json(factura);
  } catch (error) {
    res.status(400).json({ message: 'Error creando factura', error: error.message });
  }
});

router.put('/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const factura = await Factura360.findOne({ _id: req.params.id, empresaRef });
    if (!factura) return res.status(404).json({ message: 'Factura no encontrada' });

    Object.assign(factura, req.body || {});
    factura.updatedBy = req.user._id;
    await factura.save();

    res.json(factura);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando factura', error: error.message });
  }
});

router.post('/:id/pagos', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const factura = await Factura360.findOne({ _id: req.params.id, empresaRef });
    if (!factura) return res.status(404).json({ message: 'Factura no encontrada' });

    const { monto, metodo, referencia } = req.body || {};
    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ message: 'Monto inválido' });
    }

    factura.pagos.push({ monto: Number(monto), metodo, referencia });
    factura.updatedBy = req.user._id;
    await factura.save();

    res.json(factura);
  } catch (error) {
    res.status(400).json({ message: 'Error registrando pago', error: error.message });
  }
});

module.exports = router;
