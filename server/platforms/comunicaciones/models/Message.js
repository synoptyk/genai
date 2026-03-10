const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    roomId: {
        type: String, // String compuesto: "soporte_genai", "empresaID_1234", "empresaID_admin_gerencia"
        required: true,
        index: true
    },
    senderRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi',
        required: true
    },
    empresaRef: {
        type: String, // Referencia al RUT de la empresa para aislamiento estricto
        required: true,
        index: true
    },
    text: {
        type: String,
        default: ''
    },
    type: {
        type: String,
        enum: ['text', 'video_link', 'system'],
        default: 'text'
    },
    isReadBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi'
    }]
}, { timestamps: true });

// Optimizar consultas recurrentes
MessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
