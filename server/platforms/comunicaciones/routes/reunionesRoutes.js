const express = require('express');
const router = express.Router();
const reunionesController = require('../controllers/reunionesController');
const { protect } = require('../../auth/authMiddleware');

// Obtener reuniones programadas del usuario
router.get('/', protect, reunionesController.getMeetings);

// Crear una nueva reunión
router.post('/create', protect, reunionesController.createMeeting);

// Actualizar una reunión
router.put('/:id', protect, reunionesController.updateMeeting);

// Cancelar/eliminar reunión (soft delete o status)
router.delete('/:id', protect, reunionesController.cancelMeeting);

module.exports = router;
