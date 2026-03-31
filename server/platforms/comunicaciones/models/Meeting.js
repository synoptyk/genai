const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true }, // Fecha de inicio programada
    startTime: { type: String, required: true }, // Formato 'HH:mm'
    duration: { type: Number, required: true }, // Duración en minutos
    organizerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }], // Invitados
    roomId: { type: String, required: true }, // ID de sala generada para la videollamada
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    status: { type: String, enum: ['Programada', 'En Curso', 'Finalizada', 'Cancelada'], default: 'Programada' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Meeting', meetingSchema);
