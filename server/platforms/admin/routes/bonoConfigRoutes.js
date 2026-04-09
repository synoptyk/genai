const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../auth/authMiddleware');
const bonoConfigController = require('../controllers/bonoConfigController');

/**
 * 🚀 ROUTES MAESTRO DE BONIFICACIONES (v5.0)
 * Unifica TipoBono + ModeloBonificacion
 */

// Blindaje global: Autenticación requerida
router.use(protect);

// GET all for empresa
router.get('/', bonoConfigController.getAll);

// GET by ID
router.get('/:id', bonoConfigController.getById);

// CREATE
router.post('/', bonoConfigController.create);

// UPDATE
router.put('/:id', bonoConfigController.update);

// DELETE
router.delete('/:id', bonoConfigController.delete);

// 🔄 MIGRACIÓN: Unifica TipoBono + ModeloBonificacion de una sola vez
// Útil para empresas que ya tienen datos y quieren migrar al nuevo motor sin perder nada.
router.post('/migrate-legacy-data', bonoConfigController.migrateLegacy);

module.exports = router;
