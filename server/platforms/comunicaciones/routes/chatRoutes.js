const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../../auth/authMiddleware');

// Obtener mensajes de una sala específica
router.get('/:roomId/messages', protect, chatController.getMessages);

// Enviar un nuevo mensaje
router.post('/send', protect, chatController.sendMessage);

// Marcar como leídos
router.post('/read', protect, chatController.markAsRead);

module.exports = router;
