const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    usuarioRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    accion: { type: String, required: true },
    modulo: { type: String, required: true },
    detalles: { type: mongoose.Schema.Types.Mixed },
    ipLocal: { type: String },
    creadoEn: { type: Date, default: Date.now }
});

AuditLogSchema.index({ empresaRef: 1, creadoEn: -1 });
AuditLogSchema.index({ modulo: 1, accion: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
