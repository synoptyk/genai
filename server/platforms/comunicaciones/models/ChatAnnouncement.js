const mongoose = require('mongoose');

const ChatAnnouncementSchema = new mongoose.Schema({
    authorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    mediaUrl: { type: String },
    priority: { type: String, enum: ['normal', 'alta', 'urgente'], default: 'normal' }
}, { timestamps: true });

module.exports = mongoose.model('ChatAnnouncement', ChatAnnouncementSchema);
