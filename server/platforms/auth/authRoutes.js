const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { protect, authorize } = require('./authMiddleware');

router.post('/login', authController.login);
router.post('/verify-pin', authController.verifyPin);
router.post('/register', authController.register); // Public + Internal Auth
router.get('/me', protect, authController.getMe);
router.post('/setup-pin', protect, authController.setupPin);

// CEO/Admin Only routes
router.get('/users', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal'), authController.getAllUsers);
router.post('/register', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal:crear'), authController.register);
router.put('/users/:id', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal:editar'), authController.updateUser);
router.delete('/users/:id', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal:eliminar'), authController.deleteUser);
router.get('/stats/portales', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal'), authController.getPortalStats);
router.get('/users/:id/history', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal'), authController.getUserHistory);
router.post('/users/:id/resend-credentials', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal:editar'), authController.resendCredentials);
router.post('/users/:id/reset-pin', protect, authorize('ceo_genai', 'ceo', 'admin', 'cfg_personal:editar'), authController.resetPin);

module.exports = router;
