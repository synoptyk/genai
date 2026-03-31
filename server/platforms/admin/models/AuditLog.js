const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
    modulo: { type: String, required: true }, // e.g., 'Bancos', 'Previred', 'Logistica'
    accion: { type: String, required: true }, // e.g., 'EXPORT', 'SAVE_CREDENTIALS', 'APPROVE_PURCHASE'
    metodo: { type: String, enum: ['GET', 'POST', 'PUT', 'DELETE'], required: true },
    url: { type: String },
    detalles: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
