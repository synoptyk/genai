const express = require('express');
const router = express.Router();
const authController = require('./authController');
const { protect, authorize } = require('./authMiddleware');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', protect, authController.getMe);

// CEO Only routes
router.get('/users', protect, authorize('ceo_genai'), authController.getAllUsers);
router.put('/users/:id', protect, authorize('ceo_genai'), authController.updateUser);
router.delete('/users/:id', protect, authorize('ceo_genai'), authController.deleteUser);

module.exports = router;
