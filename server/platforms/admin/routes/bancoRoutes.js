const express = require('express');
const router = express.Router();
const bancoController = require('../controllers/bancoController');
const { protect } = require('../../auth/authMiddleware');

router.get('/export', protect, bancoController.exportPagoBanco);

module.exports = router;
