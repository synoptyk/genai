const express = require('express');
const router = express.Router();
const previredController = require('../controllers/previredController');
const { protect } = require('../../auth/authMiddleware');

router.get('/status', protect, previredController.getPreviredStatus);
router.get('/stats', protect, previredController.getPreviredStats);
router.get('/history', protect, previredController.getPreviredHistory);
router.post('/rpa', protect, previredController.saveRPACredentials);
router.delete('/rpa', protect, previredController.disconnectRPACredentials);
router.get('/export', protect, previredController.exportPreviredFile);
router.get('/movimientos', protect, previredController.exportMovimientos);
router.get('/honorarios', protect, previredController.exportHonorarios);
router.get('/preflight', protect, previredController.preFlightCheck);
router.post('/seed', protect, previredController.seedSampleData);

module.exports = router;
