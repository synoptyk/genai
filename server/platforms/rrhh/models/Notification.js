const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    userEmail: { type: String, required: true }, // Destination email
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['approval', 'info', 'alert', 'chat'], default: 'approval' },
    link: String, // Dynamic link to action
    read: { type: Boolean, default: false },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    metadata: {
        candidatoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato' },
        module: String,
        action: String
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', NotificationSchema);
