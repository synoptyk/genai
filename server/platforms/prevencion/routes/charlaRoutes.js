const express = require('express');
const router = express.Router();
const charlaController = require('../controllers/charlaController');
const { protect } = require('../../auth/authMiddleware');

router.get('/', protect, charlaController.getCharlas);
router.post('/', protect, charlaController.createCharla);

module.exports = router;
