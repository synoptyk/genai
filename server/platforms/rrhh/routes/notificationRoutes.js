const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../../auth/authMiddleware');

// Get all notifications for current user
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ 
            userEmail: req.user.email,
            empresaRef: req.user.empresaRef 
        }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mark one as read
router.patch('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userEmail: req.user.email },
            { read: true },
            { new: true }
        );
        if (!notification) return res.status(404).json({ message: 'Notificación no encontrada' });
        res.json(notification);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Mark all as read
router.patch('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { userEmail: req.user.email, read: false },
            { read: true }
        );
        res.json({ message: 'Todas las notificaciones marcadas como leídas' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
