const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');
const ChecklistVehicular = require('../models/ChecklistVehicular');
const mailer = require('../../../utils/mailer');
const { protect } = require('../../auth/authMiddleware');
const crypto = require('crypto');

// 0. BUSCAR VEHÍCULOS POR PATENTE (Autocompletado)
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const vehiculos = await Vehiculo.find({
      empresaRef: req.user.empresaRef,
      status: { $ne: 'Eliminado' }, // Opcional si usas soft-delete
      patente: { $regex: q, $options: 'i' }
    })
      .limit(10)
      .select('patente marca modelo anio');

    res.json(vehiculos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1. OBTENER HISTORIAL RECIENTE (NUEVO) - Prioridad Alta
router.get('/checklists/recientes', protect, async (req, res) => {
  try {
    const registros = await ChecklistVehicular.find({ empresaRef: req.user.empresaRef })
      .populate('vehiculo', 'patente marca modelo')
      .populate('tecnico', 'nombre rut')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. OBTENER TODOS
router.get('/', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const vehiculos = await Vehiculo.find({ empresaRef: req.user.empresaRef })
      .populate('asignadoA', 'nombre rut cargo')
      .sort({ createdAt: -1 });
    res.json(vehiculos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. CREAR NUEVO
router.post('/', protect, async (req, res) => {
  try {
    // 🔒 INYECTAR EMPRESA
    const nuevo = new Vehiculo({
      ...req.body,
      empresaRef: req.user.empresaRef
    });
    await nuevo.save();
    res.json(nuevo);
  } catch (err) {
    // Manejo de error de duplicados (E11000)
    if (err.code === 11000) {
      return res.status(400).json({ error: "La patente ya existe en el sistema." });
    }
    res.status(400).json({ error: err.message });
  }
});

// 3. EDITAR / ACTUALIZAR (FALTABA ESTE)
router.put('/:id', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const actualizado = await Vehiculo.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      req.body,
      { new: true }
    );
    if (!actualizado) return res.status(404).json({ error: "Vehículo no encontrado o sin acceso" });
    res.json(actualizado);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// 4. ELIMINAR
router.delete('/:id', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const result = await Vehiculo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "Vehículo no encontrado o sin acceso" });
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. REGISTRAR CHECKLIST VEHICULAR (NUEVO)
router.post('/:id/checklist', protect, async (req, res) => {
  try {
    const vehiculoId = req.params.id;
    const { tecnicoId, checklist, coordenadas, fotos, emailPersonal, tipo } = req.body;

    // Generar ID único para el QR
    const qrCodeId = `VEC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const nuevoChecklist = new ChecklistVehicular({
      vehiculo: vehiculoId,
      tecnico: tecnicoId,
      supervisor: req.user._id,
      empresaRef: req.user.empresaRef,
      proyecto: checklist.proyecto,
      lugar: checklist.lugar,
      tipo: tipo || 'Asignación',
      kmActual: checklist.kilometraje || checklist.kmEntrega,
      nivelCombustible: checklist.combustible,
      items: {
        luces: checklist.lucesPrincipales,
        lucesIntermitentes: checklist.lucesIntermitentes || 'OK',
        lucesReversa: checklist.lucesReversa || 'OK',
        limpiaParabrisas: checklist.limpiaParabrisas,
        espejos: checklist.espejoIzq,
        vidrios: checklist.vidriosLaterales,
        carroceria: checklist.carroceria,
        neumaticos: checklist.taponesLlantas,
        bocina: checklist.bocina,
        cinturones: checklist.cinturones,
        aireAcondicionado: checklist.calefaccion,
        nivelAceite: checklist.nivelAceite || 'OK',
        nivelRefrigerante: checklist.nivelRefrigerante || 'OK',
        nivelLiquidoFrenos: checklist.nivelLiquidoFrenos || 'OK',
        estadoBateria: checklist.estadoBateria || 'OK',
        chalecoReflectante: checklist.chalecoReflectante || 'OK',
        permisoCirculacion: checklist.docPadron,
        seguroObligatorio: checklist.docSoap,
        revisionTecnica: checklist.docInspeccionTec
      },
      detallesItems: checklist.detallesItems || {},
      fotos,
      observaciones: checklist.observaciones,
      coordenadas,
      emailPersonal,
      qrCodeId,
      firmaColaborador: req.body.firmaColaborador
    });

    await nuevoChecklist.save();

    // Actualizar estado del vehículo si es necesario
    await Vehiculo.findByIdAndUpdate(vehiculoId, {
      asignadoA: tecnicoId,
      estadoLogistico: tipo === 'Asignación' ? 'En Terreno' : 'En Patio'
    });

    // Disparar emails (No bloqueante)
    try {
      // Aquí se llamaría a mailer.sendChecklistVehicular (se implementará después)
      console.log(`📡 Checklist ${qrCodeId} guardado. Notificando a ${emailPersonal}`);
    } catch (mailErr) {
      console.error("Error enviando correos de checklist:", mailErr);
    }

    res.status(201).json({ message: "Checklist registrado con éxito", qrCodeId, id: nuevoChecklist._id });
  } catch (err) {
    console.error("Error en checklist vehicular:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;