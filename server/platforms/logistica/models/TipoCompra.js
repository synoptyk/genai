const mongoose = require('mongoose');

const TipoCompraSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' }
}, { timestamps: true });

// Índice único por empresa para evitar duplicados de nombre
TipoCompraSchema.index({ nombre: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('TipoCompra', TipoCompraSchema);
