const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['direct', 'group', 'company', 'support'],
        default: 'group'
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi'
    },
    empresaRef: {
        type: String,
        required: true,
        index: true
    },
    avatar: {
        type: String // URL de la imagen del grupo
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, { timestamps: true });

// Índice para búsqueda rápida de salas de un usuario dentro de su empresa
RoomSchema.index({ members: 1, empresaRef: 1 });

module.exports = mongoose.model('Room', RoomSchema);
