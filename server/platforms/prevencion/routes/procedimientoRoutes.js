const express = require('express');
const router = express.Router();
const procedimientoController = require('../controllers/procedimientoController');

router.get('/', procedimientoController.getProcedimientos);
router.post('/', procedimientoController.createProcedimiento);

module.exports = router;
