const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');

// 1. OBTENER TODOS (Mejorado)
router.get('/', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const vehiculos = await Vehiculo.find({ empresaRef: req.user.empresaRef })
      .populate('asignadoA', 'nombre rut cargo')
      .sort({ createdAt: -1 });
    res.json(vehiculos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. CREAR NUEVO
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    // 🔒 FILTRO POR EMPRESA
    const result = await Vehiculo.findOneAndDelete({ _id: req.params.id, empresaRef: req.user.empresaRef });
    if (!result) return res.status(404).json({ error: "Vehículo no encontrado o sin acceso" });
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;