const express = require('express');
const router = express.Router();
const previredController = require('../controllers/previredController');
const { protect, authorize } = require('../../auth/authMiddleware');

router.use(protect);

router.get('/status', authorize('admin_previred:ver'), previredController.getPreviredStatus);
router.get('/stats', authorize('admin_previred:ver'), previredController.getPreviredStats);
router.get('/history', authorize('admin_previred:ver'), previredController.getPreviredHistory);
router.post('/rpa', authorize('admin_previred:crear'), previredController.saveRPACredentials);
router.delete('/rpa', authorize('admin_previred:eliminar'), previredController.disconnectRPACredentials);
router.get('/export', authorize('admin_previred:ver'), previredController.exportPreviredFile);
router.get('/movimientos', authorize('admin_previred:ver'), previredController.exportMovimientos);
router.get('/honorarios', authorize('admin_previred:ver'), previredController.exportHonorarios);
router.get('/preflight', authorize('admin_previred:ver'), previredController.preFlightCheck);
router.post('/seed', authorize('admin_previred:crear'), previredController.seedSampleData);

module.exports = router;
