const express = require('express');
const router = express.Router();
const inspeccionController = require('../controllers/inspeccionController');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, inspeccionController.getInspecciones);
router.get('/:id', protect, inspeccionController.getInspeccionById);
router.post('/', protect, inspeccionController.createInspeccion);
router.put('/:id', protect, inspeccionController.updateInspeccion);
router.delete('/:id', protect, inspeccionController.deleteInspeccion);

module.exports = router;
