const mongoose = require('mongoose');

const ChatStatusSchema = new mongoose.Schema({
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: ['text', 'image'], default: 'text' },
    content: { type: String }, // Used for text status or caption
    mediaUrl: { type: String }, // Used for image status
    backgroundColor: { type: String, default: '#4f46e5' }, // Background for text statuses
    viewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Track who has seen it
    expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL Index para eliminar documentos automáticamente después de expiresAt
ChatStatusSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ChatStatus', ChatStatusSchema);
