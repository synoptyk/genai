const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');
const ChecklistVehicular = require('../models/ChecklistVehicular');
const Tecnico = require('../models/Tecnico');
const mailer = require('../../../utils/mailer');
const { protect } = require('../../auth/authMiddleware');
const crypto = require('crypto');

// ── 0. BUSCAR VEHÍCULOS POR PATENTE (Autocompletado) ──────────────────────────
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const vehiculos = await Vehiculo.find({
      empresaRef: req.user.empresaRef,
      patente: { $regex: q, $options: 'i' }
    }).limit(10).select('patente marca modelo anio');
    res.json(vehiculos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 1. HISTORIAL RECIENTE DE CHECKLISTS ───────────────────────────────────────
router.get('/checklists/recientes', protect, async (req, res) => {
  try {
    const registros = await ChecklistVehicular.find({ empresaRef: req.user.empresaRef })
      .populate('vehiculo', 'patente marca modelo')
      .populate('tecnico', 'nombre rut')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(registros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 2. OBTENER TODOS LOS VEHÍCULOS ────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const vehiculos = await Vehiculo.find({ empresaRef: req.user.empresaRef })
      .populate('asignadoA', 'nombre rut cargo email')
      .sort({ createdAt: -1 });
    res.json(vehiculos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 3. HISTORIAL DE ASIGNACIONES POR VEHÍCULO ─────────────────────────────────
router.get('/:id/historial', protect, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef })
      .populate('historialAsignaciones.tecnico', 'nombre rut')
      .populate('historialAsignaciones.supervisor', 'name');
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const historial = [...vehiculo.historialAsignaciones].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );
    res.json(historial);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. CREAR NUEVO VEHÍCULO ───────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const nuevo = new Vehiculo({ ...req.body, empresaRef: req.user.empresaRef });
    await nuevo.save();
    res.json(nuevo);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "La patente ya existe en el sistema." });
    res.status(400).json({ error: err.message });
  }
});

// ── 5. BULK LOAD ───────────────────────────────────────────────────────────────
router.post('/bulk', protect, async (req, res) => {
  try {
    let { flota } = req.body;
    if (!Array.isArray(flota)) return res.status(400).json({ error: "Invalid format" });
    flota = flota.map(v => ({ ...v, empresaRef: req.user.empresaRef }));
    await Vehiculo.insertMany(flota, { ordered: false });
    res.json({ message: "Carga masiva completada" });
  } catch (e) {
    if (e.code === 11000) return res.status(207).json({ message: "Carga parcial (patentes duplicadas omitidas)" });
    res.status(500).json({ error: e.message });
  }
});

// ── 6. EDITAR (con tracking automático de asignaciones) ───────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!vehiculo) return res.status(404).json({ error: "Vehículo no encontrado o sin acceso" });

    // Detectar cambio de conductor → registrar en historial
    const anteriorAsignado = vehiculo.asignadoA?.toString() || null;
    const nuevoAsignado = req.body.asignadoA?.toString() || null;

    if (nuevoAsignado !== anteriorAsignado) {
      const tipo = !nuevoAsignado ? 'Devolución' : (!anteriorAsignado ? 'Asignación' : 'Cambio');
      vehiculo.historialAsignaciones.push({
        tecnico: nuevoAsignado || anteriorAsignado,
        supervisor: req.user._id,
        tipo,
        fecha: new Date(),
        observacion: req.body.observacionAsignacion || `${tipo} registrada por ${req.user.name}`
      });
    }

    Object.assign(vehiculo, req.body);
    await vehiculo.save();

    const updated = await Vehiculo.findById(vehiculo._id).populate('asignadoA', 'nombre rut cargo email');
    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 7. ELIMINAR ───────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await Vehiculo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "Vehículo no encontrado o sin acceso" });
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 8. REGISTRAR CHECKLIST VEHICULAR (con email real) ────────────────────────
router.post('/:id/checklist', protect, async (req, res) => {
  try {
    const vehiculoId = req.params.id;
    const { tecnicoId, checklist, coordenadas, fotos, emailPersonal, tipo, firmaColaborador } = req.body;

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
        luces: checklist.lucesPrincipales || 'OK',
        lucesIntermitentes: checklist.lucesIntermitentes || 'OK',
        lucesReversa: checklist.lucesReversa || 'OK',
        limpiaParabrisas: checklist.limpiaParabrisas || 'OK',
        espejos: checklist.espejoIzq || 'OK',
        vidrios: checklist.vidriosLaterales || 'OK',
        carroceria: checklist.carroceria || 'OK',
        neumaticos: checklist.taponesLlantas || 'OK',
        bocina: checklist.bocina || 'OK',
        cinturones: checklist.cinturones || 'OK',
        aireAcondicionado: checklist.calefaccion || 'OK',
        nivelAceite: checklist.nivelAceite || 'OK',
        nivelRefrigerante: checklist.nivelRefrigerante || 'OK',
        nivelLiquidoFrenos: checklist.nivelLiquidoFrenos || 'OK',
        estadoBateria: checklist.estadoBateria || 'OK',
        chalecoReflectante: checklist.chalecoReflectante || 'OK',
        permisoCirculacion: checklist.docPadron || 'OK',
        seguroObligatorio: checklist.docSoap || 'OK',
        revisionTecnica: checklist.docInspeccionTec || 'OK'
      },
      detallesItems: checklist.detallesItems || {},
      fotos: fotos || {},
      observaciones: checklist.observaciones,
      coordenadas,
      emailPersonal,
      qrCodeId,
      firmaColaborador
    });

    await nuevoChecklist.save();

    // Actualizar el vehículo: conductor + estado + historial
    const estadoLogistico = tipo === 'Devolución' ? 'En Patio' : 'En Terreno';
    await Vehiculo.findByIdAndUpdate(vehiculoId, {
      asignadoA: tipo === 'Devolución' ? null : tecnicoId,
      estadoLogistico,
      $push: {
        historialAsignaciones: {
          tecnico: tecnicoId,
          supervisor: req.user._id,
          tipo: tipo || 'Asignación',
          fecha: new Date(),
          kmRegistrado: checklist.kilometraje,
          observacion: checklist.observaciones || `Checklist ${qrCodeId}`
        }
      }
    });

    // ── Email de notificación (no bloqueante) ──────────────────────────────────
    try {
      const [vehiculo, tecnico] = await Promise.all([
        Vehiculo.findById(vehiculoId).select('patente marca modelo'),
        Tecnico.findById(tecnicoId).select('nombre rut email')
      ]);

      const emailsTo = [req.user.email];
      if (emailPersonal) emailsTo.push(emailPersonal);
      if (tecnico?.email) emailsTo.push(tecnico.email);

      await mailer.sendChecklistVehicular({
        to: [...new Set(emailsTo)],
        tipo: tipo || 'Asignación',
        patente: vehiculo?.patente,
        marca: vehiculo?.marca,
        modelo: vehiculo?.modelo,
        tecnicoNombre: tecnico?.nombre || 'N/A',
        supervisorNombre: req.user.name,
        kmActual: checklist.kilometraje,
        nivelCombustible: checklist.combustible,
        items: nuevoChecklist.items,
        fotos: fotos || {},
        observaciones: checklist.observaciones,
        firmaUrl: firmaColaborador,
        qrCodeId,
        fecha: new Date()
      });
    } catch (mailErr) {
      console.error("Error enviando correos de checklist (no bloqueante):", mailErr.message);
    }

    res.status(201).json({ message: "Checklist registrado con éxito", qrCodeId, id: nuevoChecklist._id });
  } catch (err) {
    console.error("Error en checklist vehicular:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;