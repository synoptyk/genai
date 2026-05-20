const mongoose = require('mongoose');

const ObservacionStockSchema = new mongoose.Schema({
    tecnicoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico', required: true },
    productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    supervisorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    comentario: { type: String, required: true },
    fotoUrl: { type: String },
    estado: { type: String, enum: ['Abierto', 'Resuelto', 'En Revisión'], default: 'Abierto' },
    tipo: { type: String, enum: ['Daño', 'Pérdida', 'General'], default: 'General' },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
}, { timestamps: true });

// Índice para búsquedas rápidas de alertas abiertas por técnico
ObservacionStockSchema.index({ tecnicoRef: 1, estado: 1 });

module.exports = mongoose.model('ObservacionStock', ObservacionStockSchema);
