const express = require('express');
const router = express.Router();
const prevencionController = require('../controllers/prevencionController');
const { protect } = require('../../auth/authMiddleware');

router.get('/stats', protect, prevencionController.getDashboardStats);
router.get('/supervisors-progress', protect, prevencionController.getSupervisorsProgress);

module.exports = router;
