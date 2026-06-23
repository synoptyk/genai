const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { protect, authorize } = require('./authMiddleware');

const notificationConfigController = require('./notificacionConfigController');

router.post('/login', authController.login);
router.post('/verify-pin', authController.verifyPin);
router.post('/register', authController.register); // Public + Internal Auth
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/me', protect, authController.getMe);
router.post('/setup-pin', protect, authController.setupPin);

// Notification Config
router.get('/configuracion-notificaciones', protect, notificationConfigController.getNotificacionConfig);
router.put('/configuracion-notificaciones', protect, authorize('system_admin', 'ceo', 'admin'), notificationConfigController.updateNotificacionConfig);

// CEO/Admin Only routes
router.get('/users', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal', 'admin_gestion_usuarios'), authController.getAllUsers);
router.post('/register', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal:crear', 'admin_gestion_usuarios:crear'), authController.register);
router.put('/users/:id', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal:editar', 'admin_gestion_usuarios:editar'), authController.updateUser);
router.delete('/users/:id', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal:eliminar', 'admin_gestion_usuarios:eliminar'), authController.deleteUser);
router.get('/stats/portales', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal', 'admin_gestion_usuarios'), authController.getPortalStats);
router.get('/users/:id/history', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal', 'admin_gestion_usuarios'), authController.getUserHistory);
router.post('/users/:id/resend-credentials', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal:editar', 'admin_gestion_usuarios:editar'), authController.resendCredentials);
router.post('/users/:id/reset-pin', protect, authorize('system_admin', 'ceo', 'admin', 'cfg_personal:editar', 'admin_gestion_usuarios:editar'), authController.resetPin);

module.exports = router;
