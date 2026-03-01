const express = require('express');
const router = express.Router();
const inspeccionController = require('../controllers/inspeccionController');

router.get('/', inspeccionController.getInspecciones);
router.get('/:id', inspeccionController.getInspeccionById);
router.post('/', inspeccionController.createInspeccion);
router.put('/:id', inspeccionController.updateInspeccion);
router.delete('/:id', inspeccionController.deleteInspeccion);

module.exports = router;
