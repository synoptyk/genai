const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { protect, authorize } = require('./authMiddleware');

router.post('/login', authController.login);
router.post('/register', authController.register); // Public + Internal Auth
router.get('/me', protect, authController.getMe);

// CEO/Admin Only routes
router.get('/users', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.getAllUsers);
router.put('/users/:id', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.updateUser);
router.delete('/users/:id', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.deleteUser);
router.get('/stats/portales', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.getPortalStats);
router.get('/users/:id/history', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.getUserHistory);
router.post('/users/:id/resend-credentials', protect, authorize('ceo_genai', 'ceo', 'admin'), authController.resendCredentials); // AHORA ADMIN TAMBIÉN

module.exports = router;
