const express = require('express');
const router = express.Router();
const Tecnico = require('../models/Tecnico');
const Candidato = require('../../rrhh/models/Candidato');
const UserGenAi = require('../../auth/UserGenAi');
const { protect } = require('../../auth/authMiddleware');
const ROLES = require('../../auth/roles');

// OBTENER TODOS
router.get('/', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const tecnicos = await Tecnico.find({ empresaRef: req.user.empresaRef }).sort({ createdAt: -1 });
    res.json(tecnicos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OBTENER POR RUT
router.get('/rut/:rut', protect, async (req, res) => {
  try {
    const r = req.params.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
    // 🔒 FILTRO POR EMPRESA
    const tecnico = await Tecnico.findOne({ rut: r, empresaRef: req.user.empresaRef })
      .populate('supervisorId', 'name email telefono')
      .populate('vehiculoAsignado', 'patente marca modelo anio estadoLogistico');
    if (!tecnico) return res.status(404).json({ error: "Técnico no encontrado o sin acceso" });
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper para normalizar RUT
const cleanRut = (val) => {
  if (!val) return "";
  return val.toString().replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
};

// CREAR UNO (MANUAL)
router.post('/', protect, async (req, res) => {
  const { rut, nombres, apellidos } = req.body;
  if (!rut) return res.status(400).json({ error: "RUT requerido" });

  try {
    const r = cleanRut(rut);
    // 🔒 FILTRO E INYECCIÓN POR EMPRESA
    const tecnico = await Tecnico.findOneAndUpdate(
      { rut: r, empresaRef: req.user.empresaRef },
      { ...req.body, rut: r, empresaRef: req.user.empresaRef },
      { new: true, upsert: true }
    );
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar." });
  }
});

// VINCULAR SUPERVISOR A TÉCNICO (Auto-asignación)
router.post('/claim', protect, async (req, res) => {
  const { rut, supervisorId } = req.body;
  if (!rut || !supervisorId) return res.status(400).json({ error: "RUT y Supervisor ID requeridos" });

  try {
    const r = cleanRut(rut); // sin puntos ni guión → "200253876"
    // También construir variante formateada: "20.025.387-6"
    const rutFormateado = rut.toString().trim();
    const rutRegex = new RegExp(`^(${r}|${rutFormateado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, 'i');

    const isCeo = [ROLES.CEO_GENAI, ROLES.CEO].includes(req.user.role);

    // Construir filtro de empresa: CEO sin override puede ver todas las empresas
    const empresaFilter = isCeo && !req.headers['x-company-override']
      ? {} // CEO sin contexto específico → busca en todas las empresas
      : { empresaRef: req.user.empresaRef };

    // 1. Buscar técnico ya registrado (cualquier formato de RUT)
    let tecnico = await Tecnico.findOneAndUpdate(
      { rut: { $regex: rutRegex }, ...empresaFilter },
      { supervisorId },
      { new: true }
    );

    if (!tecnico) {
      // Fallback 1: Sincronizar desde candidatos contratados
      const candidato = await Candidato.findOne({
        rut: { $regex: rutRegex },
        ...empresaFilter,
        status: { $regex: /^contratado$/i }
      });
      if (candidato) {
        let nombres = candidato.fullName || 'Sin Nombre';
        let apellidos = 'Sin Apellido';
        if (candidato.fullName) {
          const parts = candidato.fullName.split(' ');
          if (parts.length > 1) {
            nombres = parts[0];
            apellidos = parts.slice(1).join(' ');
          }
        }
        tecnico = new Tecnico({
          rut: candidato.rut,
          empresaRef: candidato.empresaRef, // usar la empresa del candidato, no la del CEO
          nombres,
          apellidos,
          cargo: candidato.position,
          departamento: candidato.departamento,
          sede: candidato.sede,
          projectId: candidato.projectId,
          ceco: candidato.ceco,
          supervisorId
        });
        await tecnico.save();
      }
    }

    if (!tecnico) {
      // Fallback 2: Sincronizar desde usuarios de la plataforma (UserGenAi)
      const u = await UserGenAi.findOne({ rut: { $regex: rutRegex }, ...empresaFilter }).lean();
      if (u) {
        const partes = (u.name || 'Sin Nombre').split(' ');
        tecnico = new Tecnico({
          rut: r,
          empresaRef: u.empresaRef || req.user.empresaRef,
          nombres: partes[0] || u.name,
          apellidos: partes.slice(1).join(' ') || 'Sin Apellido',
          cargo: u.cargo || 'Colaborador',
          email: u.email,
          supervisorId
        });
        await tecnico.save();
      }
    }

    if (!tecnico) return res.status(404).json({ error: "Técnico no encontrado o sin acceso" });
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al vincular." });
  }
});

// DESVINCULAR SUPERVISOR
router.post('/unclaim', protect, async (req, res) => {
  const { id } = req.body;
  try {
    // 🔒 FILTRO POR EMPRESA
    const tecnico = await Tecnico.findOneAndUpdate(
      { _id: id, empresaRef: req.user.empresaRef },
      { $unset: { supervisorId: 1 } },
      { new: true }
    );
    if (!tecnico) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al desvincular." });
  }
});

// OBTENER TÉCNICOS POR SUPERVISOR
router.get('/supervisor/:id', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const tecnicos = await Tecnico.find({
      supervisorId: req.params.id,
      empresaRef: req.user.empresaRef
    }).sort({ createdAt: -1 });
    res.json(tecnicos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- CARGA MASIVA MEJORADA ---
router.post('/bulk', protect, async (req, res) => {
  try {
    const { tecnicos } = req.body;
    if (!tecnicos || !Array.isArray(tecnicos)) return res.status(400).json({ error: "Datos inválidos" });

    const operaciones = tecnicos.map(tec => {
      const r = cleanRut(tec.rut);
      return {
        updateOne: {
          filter: { rut: r, empresaRef: req.user.empresaRef }, // 🔒 FILTRO POR EMPRESA
          update: { $set: { ...tec, rut: r, empresaRef: req.user.empresaRef } }, // 🔒 INYECTAR
          upsert: true
        }
      };
    });

    if (operaciones.length > 0) {
      await Tecnico.bulkWrite(operaciones, { ordered: false });
    }

    res.json({ message: "Carga procesada correctamente" });
  } catch (err) {
    console.error("Error bulk:", err);
    res.json({ message: "Procesado con advertencias", error: err.message });
  }
});

// --- HERRAMIENTA DE LIMPIEZA Y REPARACIÓN ---
router.get('/fix-db', async (req, res) => {
  try {
    const all = await Tecnico.find().sort({ updatedAt: -1 });
    const seen = new Set();
    let deleted = 0;
    let updated = 0;
    let kept = 0;

    for (const t of all) {
      if (!t.rut) {
        await Tecnico.findByIdAndDelete(t._id);
        deleted++;
        continue;
      }
      const r = cleanRut(t.rut);
      if (seen.has(r)) {
        await Tecnico.findByIdAndDelete(t._id);
        deleted++;
      } else {
        seen.add(r);
        kept++;
        if (t.rut !== r) {
          t.rut = r;
          await t.save();
          updated++;
        }
      }
    }
    res.send(`✅ LIMPIEZA COMPLETADA: Registros únicos: ${kept}, Duplicados borrados: ${deleted}, Formatos corregidos: ${updated}`);
  } catch (err) {
    res.status(500).send("Error reparando DB: " + err.message);
  }
});

// ELIMINAR
router.delete('/:id', protect, async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const result = await Tecnico.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json({ message: "Eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// FICHA COMPLETA DEL TRABAJADOR (solo lectura — tecnico + candidato)
router.get('/:id/ficha', protect, async (req, res) => {
  try {
    const isCeo = [ROLES.CEO_GENAI, ROLES.CEO].includes(req.user.role);
    const empresaFilter = isCeo && !req.headers['x-company-override'] ? {} : { empresaRef: req.user.empresaRef };

    const tecnico = await Tecnico.findOne({ _id: req.params.id, ...empresaFilter })
      .populate('vehiculoAsignado', 'patente marca modelo anio estadoLogistico estadoOperativo')
      .populate('supervisorId', 'name email')
      .lean();

    if (!tecnico) return res.status(404).json({ error: 'No encontrado o sin acceso' });

    // Complementar con datos del candidato (si existe)
    const rutRegex = new RegExp(`^${tecnico.rut}$`, 'i');
    const candidato = await Candidato.findOne({ rut: { $regex: rutRegex } })
      .select('profilePic cvUrl emergencyContact emergencyPhone email phone documents accreditation interview tests amonestaciones felicitaciones notes vacaciones bonuses hiring contractType contractStartDate contractEndDate')
      .lean();

    res.json({ tecnico, candidato: candidato || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;