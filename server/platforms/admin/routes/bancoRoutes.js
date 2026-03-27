const express = require('express');
const router = express.Router();
const bancoController = require('../controllers/bancoController');
const { protect, authorize } = require('../../auth/authMiddleware');

router.get('/export', authorize('admin_pagos_bancarios:ver'), bancoController.exportPagoBanco);

module.exports = router;
