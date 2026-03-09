const express = require('express');
const router = express.Router();
const procedimientoController = require('../controllers/procedimientoController');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, procedimientoController.getProcedimientos);
router.post('/', protect, procedimientoController.createProcedimiento);

module.exports = router;
