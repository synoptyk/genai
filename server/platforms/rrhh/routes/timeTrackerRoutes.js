const express = require('express');
const router = express.Router();
const timeTrackerController = require('../controllers/timeTrackerController');
const { protect } = require('../../auth/authMiddleware');

// Registrar un "heartbeat" de tiempo activo (Peticiones automáticas del cliente)
router.post('/heartbeat', protect, timeTrackerController.registrarLatido);

// Obtener el reporte de todos los administrativos (Para Dashboard CEO)
router.get('/diario', protect, timeTrackerController.getReporteTiempos);

module.exports = router;
