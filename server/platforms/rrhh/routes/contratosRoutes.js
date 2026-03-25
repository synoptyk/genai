const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');
const { protect } = require('../../auth/authMiddleware');

// Base: /api/rrhh/contratos
router.get('/', protect, contratoController.getAll);
router.get('/:id', protect, contratoController.getById);
router.post('/', protect, contratoController.create);
router.post('/:id/request-approval', protect, contratoController.requestApproval);
router.post('/:id/approve', protect, contratoController.approve);
router.delete('/:id', protect, contratoController.remove);

module.exports = router;
