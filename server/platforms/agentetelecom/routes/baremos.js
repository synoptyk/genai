const express = require('express');
const router = express.Router();
const Baremo = require('../models/Baremo');

router.get('/', async (req, res) => {
  try {
    const baremos = await Baremo.find().sort({ cliente: 1, codigo: 1 });
    res.json(baremos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const nuevo = new Baremo(req.body);
    await nuevo.save();
    res.status(201).json(nuevo);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    await Baremo.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: "Actualizado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/all/reset', async (req, res) => {
  try {
    await Baremo.deleteMany({});
    res.json({ message: "Tarifario completamente reseteado" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Baremo.findByIdAndDelete(req.params.id);
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
        filter: { codigo: item.codigo, cliente: item.cliente },
        update: { $set: item },
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
