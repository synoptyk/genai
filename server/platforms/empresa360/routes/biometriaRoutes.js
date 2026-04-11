const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const BiometricDevice = require('../models/BiometricDevice');
const BiometricLog = require('../models/BiometricLog');
const PlatformUser = require('../../auth/PlatformUser');

router.use(protect);

const resolveEmpresaRef = (req) => req.user.empresaRef?._id || req.user.empresaRef;

router.get('/devices', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const devices = await BiometricDevice.find({ empresaRef }).sort({ createdAt: -1 });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: 'Error listando dispositivos', error: error.message });
  }
});

router.post('/devices', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const item = await BiometricDevice.create({ ...req.body, empresaRef, createdBy: req.user._id, ultimoHeartbeat: new Date() });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ message: 'Error creando dispositivo', error: error.message });
  }
});

router.put('/devices/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const allowedFields = ['nombre', 'marca', 'modelo', 'serial', 'ubicacion', 'ipLocal', 'estado'];
    const payload = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) payload[field] = req.body[field];
    });

    const updated = await BiometricDevice.findOneAndUpdate(
      { _id: req.params.id, empresaRef },
      payload,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Error actualizando dispositivo', error: error.message });
  }
});

router.delete('/devices/:id', authorize('admin', 'gerencia', 'rrhh'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const deleted = await BiometricDevice.findOneAndDelete({ _id: req.params.id, empresaRef });

    if (!deleted) {
      return res.status(404).json({ message: 'Dispositivo no encontrado' });
    }

    res.json({ message: 'Dispositivo eliminado correctamente' });
  } catch (error) {
    res.status(400).json({ message: 'Error eliminando dispositivo', error: error.message });
  }
});

router.post('/ingest', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const { serial, rut, tipoMarca = 'Entrada', fechaMarca } = req.body || {};

    let deviceRef = null;
    if (serial) {
      const d = await BiometricDevice.findOne({ empresaRef, serial });
      if (d) {
        d.ultimoHeartbeat = new Date();
        await d.save();
        deviceRef = d._id;
      }
    }

    let userRef = null;
    if (rut) {
      const user = await PlatformUser.findOne({ empresaRef, rut });
      if (user) userRef = user._id;
    }

    const log = await BiometricLog.create({
      empresaRef,
      userRef,
      rut,
      deviceRef,
      tipoMarca,
      fechaMarca: fechaMarca ? new Date(fechaMarca) : new Date(),
      fuente: 'API_Device',
      payloadRaw: req.body || {}
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(400).json({ message: 'Error registrando marca biométrica', error: error.message });
  }
});

router.get('/logs', authorize('admin', 'gerencia', 'rrhh', 'supervisor'), async (req, res) => {
  try {
    const empresaRef = resolveEmpresaRef(req);
    const { desde, hasta } = req.query;
    const query = { empresaRef };
    if (desde || hasta) {
      query.fechaMarca = {};
      if (desde) query.fechaMarca.$gte = new Date(desde);
      if (hasta) query.fechaMarca.$lte = new Date(hasta);
    }

    const logs = await BiometricLog.find(query)
      .populate('userRef', 'name email cargo')
      .populate('deviceRef', 'nombre serial ubicacion')
      .sort({ fechaMarca: -1 })
      .limit(500);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error listando marcas biométricas', error: error.message });
  }
});

module.exports = router;
