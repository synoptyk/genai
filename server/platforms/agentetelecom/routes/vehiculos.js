const express = require('express');
const router = express.Router();
const Vehiculo = require('../models/Vehiculo');

// 1. OBTENER TODOS (Mejorado)
router.get('/', async (req, res) => {
  try {
    // Populate trajo más datos del técnico (rut y cargo) para mostrarlos en la tabla
    const vehiculos = await Vehiculo.find()
      .populate('asignadoA', 'nombre rut cargo')
      .sort({ createdAt: -1 }); // Ordenar por los más nuevos primero
    res.json(vehiculos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. CREAR NUEVO
router.post('/', async (req, res) => {
  try {
    const nuevo = new Vehiculo(req.body);
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
    const actualizado = await Vehiculo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true } // Devuelve el objeto ya modificado
    );
    res.json(actualizado);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// 4. ELIMINAR
router.delete('/:id', async (req, res) => {
  try {
    await Vehiculo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vehículo eliminado correctamente' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;