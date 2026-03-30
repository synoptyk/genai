const express = require('express');
const router = express.Router();
const charlaController = require('../controllers/charlaController');
const { protect, authorize } = require('../../auth/authMiddleware');

router.use(protect);

router.get('/', protect, charlaController.getCharlas);
router.post('/', protect, charlaController.createCharla);

module.exports = router;
