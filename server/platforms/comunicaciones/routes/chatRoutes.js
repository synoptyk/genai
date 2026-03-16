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

// Stream Real-time (SSE)
router.get('/stream/global', protect, chatController.globalStream);
router.get('/stream/:roomId', protect, chatController.stream);

// Rutas de Salas Dinámicas
router.get('/rooms/list', protect, chatController.getRooms);
router.post('/rooms/create', protect, chatController.createRoom);
router.get('/users/search', protect, chatController.searchUsers);
router.get('/users/contacts', protect, chatController.getContacts);

module.exports = router;
