const express = require('express');
const router = express.Router();
const ProveedorLeasing = require('../models/ProveedorLeasing');
const { protect, authorize } = require('../../auth/authMiddleware');

// @route   GET /api/flota/proveedores
// @desc    Get all leasing providers for the company
// @access  Private (flota_proveedores:ver)
router.get('/', protect, authorize('flota_proveedores:ver'), async (req, res) => {
  try {
    const proveedores = await ProveedorLeasing.find({ empresaRef: req.user.empresaRef }).sort({ createdAt: -1 });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: 'Server Error' });
  }
});

// @route   POST /api/flota/proveedores
// @desc    Create a new leasing provider
// @access  Private (flota_proveedores:crear)
router.post('/', protect, authorize('flota_proveedores:crear'), async (req, res) => {
  try {
    const newProveedor = new ProveedorLeasing({
      ...req.body,
      empresaRef: req.user.empresaRef
    });
    const saved = await newProveedor.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   PUT /api/flota/proveedores/:id
// @desc    Update a leasing provider
// @access  Private (flota_proveedores:editar)
router.put('/:id', protect, authorize('flota_proveedores:editar'), async (req, res) => {
  try {
    const updated = await ProveedorLeasing.findOneAndUpdate(
      { _id: req.params.id, empresaRef: req.user.empresaRef },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   DELETE /api/flota/proveedores/:id
// @desc    Delete a leasing provider
// @access  Private (flota_proveedores:eliminar)
router.delete('/:id', protect, authorize('flota_proveedores:eliminar'), async (req, res) => {
  try {
    const deleted = await ProveedorLeasing.findOneAndDelete({ 
      _id: req.params.id, 
      empresaRef: req.user.empresaRef 
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json({ message: 'Proveedor eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
