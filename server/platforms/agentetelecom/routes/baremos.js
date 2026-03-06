const express = require('express');
const router = express.Router();
const Baremo = require('../models/Baremo');

router.get('/', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const baremos = await Baremo.find({ empresaRef: req.user.empresaRef }).sort({ cliente: 1, codigo: 1 });
    res.json(baremos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    // 🔒 INYECTAR EMPRESA
    const nuevo = new Baremo({
      ...req.body,
      empresaRef: req.user.empresaRef
    });
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const actualizado = await Baremo.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      req.body,
      { new: true }
    );
    if (!actualizado) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json({ message: "Actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/all/reset', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA (CRÍTICO: Evita borrar todo el sistema)
    await Baremo.deleteMany({ empresaRef: req.user.empresaRef });
    res.json({ message: "Tarifario de su empresa completamente reseteado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const result = await Baremo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "No encontrado o sin acceso" });
    res.json({ message: "Eliminado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/bulk', async (req, res) => {
  try {
    const { baremos } = req.body;

    // 1. Check if array exists and is not empty
    if (!baremos || !Array.isArray(baremos) || baremos.length === 0) {
      return res.status(400).json({ error: "El payload 'baremos' está vacío o no es un arreglo válido." });
    }

    console.log(`📡 Recibidos ${baremos.length} ítems para carga masiva.`);
    console.log("Primera fila:", JSON.stringify(baremos[0]));

    const ops = baremos.map(item => ({
      updateOne: {
        filter: {
          codigo: item.codigo,
          cliente: item.cliente,
          empresaRef: req.user.empresaRef  // 🔒 FILTRO POR EMPRESA
        },
        update: { $set: { ...item, empresaRef: req.user.empresaRef } }, // 🔒 INYECTAR
        upsert: true
      }
    }));

    // 2. Perform BulkWrite
    const result = await Baremo.bulkWrite(ops, { ordered: false });

    console.log("✅ Carga masiva exitosa:", result);
    res.json({ message: "Carga masiva procesada.", detalles: result });
  } catch (err) {
    console.error("❌ BULK UPLOAD ERROR:", err);
    // Return the full error object so the client can inspect it
    res.status(500).json({ error: err.message, detailedError: JSON.stringify(err, Object.getOwnPropertyNames(err)) });
  }
});

module.exports = router;
