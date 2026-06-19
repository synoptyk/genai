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
router.post('/typing/:roomId', protect, chatController.sendTyping);

// Stream Real-time (SSE)
router.get('/stream/global', protect, chatController.globalStream);
router.get('/stream/:roomId', protect, chatController.stream);

// Rutas de Salas Dinámicas
router.get('/rooms/list', protect, chatController.getRooms);
router.post('/rooms/create', protect, chatController.createRoom);
router.get('/users/search', protect, chatController.searchUsers);
router.get('/users/contacts', protect, chatController.getContacts);

// Estados (Status)
router.get('/status', protect, chatController.getStatuses);
router.post('/status', protect, chatController.createStatus);
router.post('/status/:id/view', protect, chatController.markStatusViewed);

// Comunicados (Announcements)
router.get('/announcements', protect, chatController.getAnnouncements);
router.post('/announcements', protect, chatController.createAnnouncement);

module.exports = router;
