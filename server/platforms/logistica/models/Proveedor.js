const mongoose = require('mongoose');

const ProveedorSchema = new mongoose.Schema({
    rut: { type: String, required: true },
    nombre: { type: String, required: true, trim: true },
    contacto: { type: String, trim: true },
    email: { type: String, trim: true },
    telefono: { type: String, trim: true },
    rubro: { type: String, trim: true },
    direccion: { type: String, trim: true },
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' }
}, { timestamps: true });

// Índice único por empresa
ProveedorSchema.index({ rut: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('Proveedor', ProveedorSchema);
