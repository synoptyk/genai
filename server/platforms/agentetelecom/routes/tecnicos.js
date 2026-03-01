const express = require('express');
const router = express.Router();
const Tecnico = require('../models/Tecnico');

// OBTENER TODOS
router.get('/', async (req, res) => {
  try {
    const tecnicos = await Tecnico.find().sort({ createdAt: -1 });
    res.json(tecnicos);
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
router.post('/', async (req, res) => {
  const { rut, nombres, apellidos } = req.body;
  if (!rut) return res.status(400).json({ error: "RUT requerido" });

  try {
    const r = cleanRut(rut);
    const tecnico = await Tecnico.findOneAndUpdate(
      { rut: r },
      { ...req.body, rut: r },
      { new: true, upsert: true }
    );
    res.json(tecnico);
  } catch (err) {
    res.status(500).json({ error: "Error al guardar." });
  }
});

// --- CARGA MASIVA MEJORADA ---
router.post('/bulk', async (req, res) => {
  try {
    const { tecnicos } = req.body;
    if (!tecnicos || !Array.isArray(tecnicos)) return res.status(400).json({ error: "Datos inválidos" });

    const operaciones = tecnicos.map(tec => {
      const r = cleanRut(tec.rut);
      return {
        updateOne: {
          filter: { rut: r },
          update: { $set: { ...tec, rut: r } },
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
router.delete('/:id', async (req, res) => {
  try {
    await Tecnico.findByIdAndDelete(req.params.id);
    res.json({ message: "Eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;