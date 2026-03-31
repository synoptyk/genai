const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
    tipo: { 
        type: String, 
        enum: ['ENTRADA', 'SALIDA', 'TRASPASO', 'AJUSTE', 'RESERVA', 'REVERSA', 'MERMA', 'RECEPCION', 'ASIGNACION'], 
        required: true 
    },
    productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    cantidad: { type: Number, required: true },
    estadoProducto: { type: String, enum: ['Nuevo', 'Usado Bueno', 'Usado Malo', 'Merma'], default: 'Nuevo' },
    
    // Almacenes involucrados
    almacenOrigen: { type: mongoose.Schema.Types.ObjectId, ref: 'Almacen' },
    almacenDestino: { type: mongoose.Schema.Types.ObjectId, ref: 'Almacen' },
    
    // Trazabilidad
    usuarioRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true }, // Quién ejecutó el movimiento
    motivo: { type: String, trim: true },
    documentoReferencia: { type: String }, // Ej: Factura #, Guía Despacho #
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    fotoUrl: { type: String }, // Referencia visual opcional o requerida según operación
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Movimiento', MovimientoSchema);
