const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');
const ChecklistVehicular = require('../models/ChecklistVehicular');
const SiniestroVehicular = require('../models/SiniestroVehicular');

const Tecnico = require('../models/Tecnico');
const Conductor = require('../../rrhh/models/Conductor');
const Candidato = require('../../rrhh/models/Candidato');
const mailer = require('../../../utils/mailer');
const notificationService = require('../../../utils/notificationService');
const { protect } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');
const crypto = require('crypto');
const genaiService = require('../../../utils/genaiService');

const isSupervisorRole = (role) => {
  const r = String(role || '').toLowerCase();
  return r === ROLES.SUPERVISOR || r === 'supervisor_hse';
};

const syncVehicleToDriver = async (tecnicoId, vehiculo, isUnassign) => {
  if (!tecnicoId) return;
  try {
    const updateTecnico = isUnassign 
      ? { $unset: { vehiculoAsignado: 1, patente: 1 } }
      : { vehiculoAsignado: vehiculo._id, patente: vehiculo.patente };
    const t = await Tecnico.findByIdAndUpdate(tecnicoId, updateTecnico, { new: true });
    
    if (t && t.rut) {
      const updateConductor = isUnassign
        ? { $unset: { patente: 1, marca: 1, modelo: 1 } }
        : { patente: vehiculo.patente, marca: vehiculo.marca, modelo: vehiculo.modelo };
      await Conductor.findOneAndUpdate(
        { rut: t.rut, empresaRef: t.empresaRef },
        updateConductor
      );
    }
  } catch (err) {
    console.error('Error in syncVehicleToDriver:', err);
  }
};

// ── 0b. VEHÍCULOS DISPONIBLES (sin conductor, operativos) ─────────────────────
router.get('/disponibles', protect, async (req, res) => {
  try {
    const disponibles = await Vehiculo.find({
      empresaRef: req.user.empresaRef,
      estadoOperativo: 'Operativa',
      $or: [{ asignadoA: null }, { asignadoA: { $exists: false } }]
    }).select('patente marca modelo anio estadoLogistico').sort({ patente: 1 });
    res.json(disponibles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 0c. ASIGNAR VEHÍCULO A TÉCNICO ────────────────────────────────────────────
router.put('/:id/asignar', protect, async (req, res) => {
  try {
    const { tecnicoId } = req.body;
    if (!tecnicoId) return res.status(400).json({ error: 'tecnicoId requerido' });

    const vehiculo = await Vehiculo.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      {
        asignadoA: tecnicoId,
        estadoLogistico: 'En Terreno',
        $push: {
          historialAsignaciones: {
            tecnico: tecnicoId,
            supervisor: req.user._id,
            tipo: 'Asignación',
            fecha: new Date(),
            observacion: 'Asignación desde Portal Supervisión'
          }
        }
      },
      { new: true }
    ).populate('asignadoA', 'nombre rut cargo');

    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado o sin acceso' });

    // Actualizar también el Tecnico con la referencia al vehículo y sincronizar Conductor
    await syncVehicleToDriver(tecnicoId, vehiculo, false);

    res.json(vehiculo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
    const isSupervisor = isSupervisorRole(req.user.role);
    const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());

    const filter = { empresaRef: req.user.empresaRef };

    if (isSupervisor && !isHighLevel) {
      // Solo checklists donde yo soy el supervisor
      filter.supervisor = req.user._id;
    }

    const registros = await ChecklistVehicular.find(filter)
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
    const isSupervisor = isSupervisorRole(req.user.role);
    const isHighLevel = [ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.CEO_GENAI, ROLES.GERENCIA, ROLES.ADMIN, ROLES.RRHH_ADMIN].includes(String(req.user.role).toLowerCase());

    const filter = { empresaRef: req.user.empresaRef };

    // Si es supervisor, solo ve vehículos de su equipo o disponibles
    if (isSupervisor && !isHighLevel) {
      // 1. Obtener IDs de técnicos del supervisor
      const misTecnicos = await Tecnico.find({ supervisorId: req.user._id }).select('_id');
      const misTecnicosIds = misTecnicos.map(t => t._id);

      filter.$or = [
        { asignadoA: { $in: misTecnicosIds } },
        { asignadoA: null },
        { asignadoA: { $exists: false } }
      ];
    }

    const vehiculos = await Vehiculo.find(filter)
      .populate({
        path: 'asignadoA',
        select: 'nombre rut cargo email estadoActual proyecto fechaIngreso projectId sueldoBase idRecursoToa previsionSalud isapreNombre valorPlan monedaPlan afp pensionado tieneCargas listaCargas tipoContrato',
        populate: { path: 'projectId', select: 'nombreProyecto' }
      })
      .sort({ createdAt: -1 });

    const vehiculosData = vehiculos.map(v => v.toObject());
    const rutsRaw = vehiculosData.filter(v => v.asignadoA && v.asignadoA.rut).map(v => v.asignadoA.rut);
    
    if (rutsRaw.length > 0) {
      const cleanRut = (r) => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase();
      const rutsClean = rutsRaw.map(cleanRut);

      // Fetch all candidates and match in memory to bypass DB formatting issues
      const candidatos = await Candidato.find({ empresaRef: req.user.empresaRef }).select('rut status').lean();
      
      const statusMap = {};
      candidatos.forEach(c => {
        const cRut = cleanRut(c.rut);
        if (cRut) {
          statusMap[cRut] = c.status;
        }
      });
      
      vehiculosData.forEach(v => {
        if (v.asignadoA && v.asignadoA.rut) {
          const vRut = cleanRut(v.asignadoA.rut);
          v.asignadoA.statusCandidato = statusMap[vRut] || null;
        }
      });
    }

    res.json(vehiculosData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 3. OBTENER UN VEHÍCULO POR ID ───────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef })
      .populate({
        path: 'asignadoA',
        select: 'nombre rut cargo email estadoActual proyecto fechaIngreso projectId sueldoBase idRecursoToa previsionSalud isapreNombre valorPlan monedaPlan afp pensionado tieneCargas listaCargas tipoContrato',
        populate: { path: 'projectId', select: 'nombreProyecto' }
      });
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado o sin acceso' });
    res.json(vehiculo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3b. HISTORIAL DE ASIGNACIONES POR VEHÍCULO ───────────────────────────────
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

// ── 3c. OBTENER CHECKLISTS COMPLETOS POR VEHÍCULO ─────────────────────────────
router.get('/:id/checklists', protect, async (req, res) => {
  try {
    const checklists = await ChecklistVehicular.find({ vehiculoRef: req.params.id }).sort({ fecha: -1 });
    res.json(checklists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 4. CREAR NUEVO VEHÍCULO ───────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const nuevo = new Vehiculo({ ...req.body, empresaRef: req.user.empresaRef });
    await nuevo.save();

    await notificationService.notifyAction({
      actor: req.user,
      moduleKey: 'agentetelecom_vehiculos',
      action: 'creó',
      entityName: `vehículo ${nuevo.patente || nuevo._id}`,
      entityId: nuevo._id,
      companyRef: req.user.empresaRef,
      isImportant: false
    });

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
        observacion: req.body.observacionAsignacion || `${tipo} rápida registrada por ${req.user.name} (Sin Checklist)`
      });
      // Adjust assignment state based on this manual assignment
      req.body.estadoAsignacion = nuevoAsignado ? 'Asignación Pendiente' : 'Sin Asignar';
      
      // Sincronizar módulos (Tecnico, Conductor)
      if (anteriorAsignado) await syncVehicleToDriver(anteriorAsignado, vehiculo, true);
      if (nuevoAsignado) await syncVehicleToDriver(nuevoAsignado, vehiculo, false);
    }

    Object.assign(vehiculo, req.body);
    await vehiculo.save();

    const updated = await Vehiculo.findById(vehiculo._id).populate('asignadoA', 'nombre rut cargo email');

    await notificationService.notifyAction({
      actor: req.user,
      moduleKey: 'agentetelecom_vehiculos',
      action: 'actualizó',
      entityName: `vehículo ${updated.patente || updated._id}`,
      entityId: updated._id,
      companyRef: req.user.empresaRef,
      isImportant: false
    });

    res.json(updated);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── 7. ELIMINAR ───────────────────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const result = await Vehiculo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

// @route   POST /api/platforms/agentetelecom/vehiculos/bulk-delete
// @desc    Eliminar múltiples vehículos
// @access  Private
router.post('/bulk-delete', protect, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs válidos' });
    }
    const result = await Vehiculo.deleteMany({ _id: { $in: ids }, empresaRef: req.user.empresaRef });
    res.json({ message: `${result.deletedCount} vehículos eliminados correctamente` });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar vehículos masivamente' });
  }
});

// @route   POST /api/platforms/agentetelecom/vehiculos/:id/checklist) ────────────────────────
router.post('/:id/checklist', protect, async (req, res) => {
  try {
    const vehiculoId = req.params.id;
    const { 
      tecnicoId, conductorRut, conductorNombre, conductorCargo, fechaAsignacion, 
      quienReportaTipo, quienReportaRut, quienReportaNombre, quienReportaCargo, 
      checklist, coordenadas, fotos, emailPersonal, tipo, 
      firmaColaborador, firmaSupervisor,
      origenRecepcion, subMotivoRecepcion, detallesRecepcion
    } = req.body;

    const qrCodeId = `VEC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const nuevoChecklist = new ChecklistVehicular({
      vehiculo: vehiculoId,
      tecnico: tecnicoId,
      supervisor: req.user._id,
      empresaRef: req.user.empresaRef,
      fecha: fechaAsignacion ? new Date(fechaAsignacion) : new Date(),
      conductorRut,
      conductorNombre,
      conductorCargo,
      quienReportaTipo,
      quienReportaRut,
      quienReportaNombre,
      quienReportaCargo,
      proyecto: checklist.proyecto,
      lugar: checklist.lugar,
      tipo: tipo || 'Asignación',
      origenRecepcion,
      subMotivoRecepcion,
      detallesRecepcion,
      kmActual: checklist.kilometraje || checklist.kmEntrega,
      nivelCombustible: checklist.combustible,
      cuponElectronico: checklist.cuponElectronico,
      numeroCupon: checklist.numeroCupon,
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
      firmaColaborador,
      firmaSupervisor
    });

    await nuevoChecklist.save();

    // Actualizar el vehículo: conductor + estado + historial
    const isRecepcion = tipo === 'Devolución' || tipo === 'Recepción';
    const estadoLogistico = isRecepcion ? 'En Patio' : 'En Terreno';
    
    // Si viene de taller, asegurar que vuelva a estar Operativa
    const estadoOperativo = (isRecepcion && origenRecepcion === 'Taller') ? 'Operativa' : undefined;

    const updateFields = {
      asignadoA: isRecepcion ? null : tecnicoId,
      estadoLogistico,
      estadoAsignacion: isRecepcion ? 'Sin Asignar' : 'Asignación Completa'
    };
    if (estadoOperativo) updateFields.estadoOperativo = estadoOperativo;
    if (checklist.cuponElectronico) updateFields.cuponElectronico = checklist.cuponElectronico;
    if (checklist.numeroCupon !== undefined) updateFields.numeroCupon = checklist.numeroCupon;

    await Vehiculo.findByIdAndUpdate(vehiculoId, {
      ...updateFields,
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

    // Sincronizar módulos (Tecnico, Conductor)
    await syncVehicleToDriver(tecnicoId, { _id: vehiculoId, patente: checklist.patente || (await Vehiculo.findById(vehiculoId)).patente, marca: (await Vehiculo.findById(vehiculoId)).marca, modelo: (await Vehiculo.findById(vehiculoId)).modelo }, isRecepcion);


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
        firmaSupervisorUrl: firmaSupervisor,
        qrCodeId,
        fecha: new Date()
      });
    } catch (mailErr) {
      console.error("Error enviando correos de checklist (no bloqueante):", mailErr.message);
    }

    res.status(201).json({ message: "Checklist registrado con éxito", id: nuevoChecklist._id, documento: nuevoChecklist });

    await notificationService.notifyAction({
      actor: req.user,
      moduleKey: 'agentetelecom_checklists',
      action: 'registró',
      entityName: `checklist vehículo ${vehiculoId}`,
      entityId: nuevoChecklist._id,
      companyRef: req.user.empresaRef,
      isImportant: false,
      messageExtra: `tipo ${tipo || 'Asignación'}`
    });
  } catch (err) {
    console.error("Error en checklist vehicular:", err);
    res.status(500).json({ error: err.message });
  }
});


// ── 9. REGISTRAR SINIESTRO ────────────────────────────────────────────────────
router.post('/:id/siniestro', protect, async (req, res) => {
  try {
    const vehiculo = await Vehiculo.findOne({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!vehiculo) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const nuevoSiniestro = new SiniestroVehicular({
      vehiculo: req.params.id,
      tecnico: req.body.tecnicoId || vehiculo.asignadoA,
      empresaRef: req.user.empresaRef,
      reportadoPor: req.user._id,
      
      // Conductor info (from body)
      conductorRut: req.body.conductorRut,
      conductorNombre: req.body.conductorNombre,
      conductorCargo: req.body.conductorCargo,
      conductorProyecto: req.body.conductorProyecto,
      conductorEmail: req.body.conductorEmail,

      // Time and location
      fechaSiniestro: req.body.fechaSiniestro || new Date(),
      horaSiniestro: req.body.horaSiniestro,
      region: req.body.region,
      comuna: req.body.comuna,
      calle: req.body.calle,
      numero: req.body.numero,
      referencia: req.body.referencia,

      // Motivo
      motivoDano: req.body.motivoDano || 'Otro',
      motivoEspecifico: req.body.motivoEspecifico,

      // Terceros
      terceroRut: req.body.terceroRut,
      terceroNombre: req.body.terceroNombre,
      terceroPatente: req.body.terceroPatente,
      terceroResponsabilidad: req.body.terceroResponsabilidad,
      fotosTercero: req.body.fotosTercero || [],

      // Gravedad y Daño
      gravedad: req.body.gravedad || 'Moderado',
      tipoDano: req.body.tipoDano,
      danoEspecifico: req.body.danoEspecifico,
      descripcion: req.body.descripcion,

      // Evidencia General
      fotoLicenciaFrontal: req.body.fotoLicenciaFrontal,
      fotoLicenciaPosterior: req.body.fotoLicenciaPosterior,
      fotos: req.body.fotos || [],
      
      // Firma y Geo
      quienReportaTipo: req.body.quienReportaTipo || 'Involucrado',
      quienReportaRut: req.body.quienReportaRut,
      quienReportaNombre: req.body.quienReportaNombre,
      quienReportaCargo: req.body.quienReportaCargo,
      
      firmaColaborador: req.body.firmaColaborador,
      ubicacionGeo: req.body.ubicacionGeo,
      
      observacionesAdicionales: req.body.observacionesAdicionales
    });

    await nuevoSiniestro.save();

    // Bloquear el vehículo operativamente
    vehiculo.estadoOperativo = 'Siniestro';
    vehiculo.historialAsignaciones.push({
      tecnico: vehiculo.asignadoA,
      supervisor: req.user._id,
      tipo: 'Cambio',
      fecha: new Date(),
      observacion: `Siniestro Reportado: ${req.body.gravedad}. Motivo: ${req.body.motivoDano}. Vehículo bloqueado.`
    });
    await vehiculo.save();

    await notificationService.notifyAction({
      actor: req.user,
      moduleKey: 'agentetelecom_vehiculos',
      action: 'reportó',
      entityName: `siniestro en vehículo ${vehiculo.patente}`,
      entityId: nuevoSiniestro._id,
      companyRef: req.user.empresaRef,
      isImportant: true
    });

    res.status(201).json(nuevoSiniestro);

    // BACKGROUND TASK: GenAI Image Analysis
    if (req.body.fotos && req.body.fotos.length > 0) {
      setTimeout(async () => {
        try {
          const prompt = `Analiza estas fotos de un accidente/siniestro vehicular.
El usuario reportó un daño de gravedad: "${req.body.gravedad}" y motivo: "${req.body.motivoDano}".
Por favor, actúa como un experto liquidador de seguros y auditor de flota.
Entrega un breve informe técnico indicando:
1. Nivel de daño visible estimado (Leve, Moderado, Grave, Pérdida Total).
2. Partes del vehículo presuntamente afectadas.
3. ¿Coincide el daño visible con la gravedad reportada por el conductor?
Responde en formato de reporte corto y profesional.`;
          
          const analysis = await genaiService.analyzeImageMultimodal(req.body.fotos, prompt);
          await SiniestroVehicular.findByIdAndUpdate(nuevoSiniestro._id, {
            evaluacionIA: analysis
          });
          console.log(`[GenAI] Análisis de siniestro completado para ${nuevoSiniestro._id}`);
        } catch (genaiErr) {
          console.error(`[GenAI] Error analizando siniestro ${nuevoSiniestro._id}:`, genaiErr.message);
        }
      }, 0);
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 10. OBTENER SINIESTROS DE UN VEHÍCULO ─────────────────────────────────────
router.get('/:id/siniestros', protect, async (req, res) => {
  try {
    const siniestros = await SiniestroVehicular.find({ vehiculo: req.params.id, empresaRef: req.user.empresaRef })
      .populate('tecnico', 'nombre rut')
      .populate('reportadoPor', 'name')
      .sort({ fechaSiniestro: -1 });
    res.json(siniestros);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;