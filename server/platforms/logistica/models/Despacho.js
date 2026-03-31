const mongoose = require('mongoose');

const DespachoSchema = new mongoose.Schema({
    codigoDespacho: { type: String, required: true, unique: true }, // Auto-generable
    
    items: [{
        productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
        cantidad: { type: Number, required: true },
        entregado: { type: Boolean, default: false }
    }],
    
    // Origen y Destino
    almacenOrigen: { type: mongoose.Schema.Types.ObjectId, ref: 'Almacen' },
    clienteTag: { type: String }, // Para linkear con Cliente o dirección libre
    direccionEntrega: { type: String, required: true },
    
    // Estados 360
    status: { 
        type: String, 
        enum: ['PENDIENTE', 'RECOGIDO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO', 'INCIDENCIA'], 
        default: 'PENDIENTE' 
    },
    
    // Integración RRHH y Operaciones
    vehiculoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehiculo' },
    choferRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    
    // Trazabilidad temporal
    fechaPrometida: { type: Date },
    fechaEntregaReal: { type: Date },
    
    observaciones: { type: String },
    firmadoPor: { type: String }, // Nombre de quien recibe
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }

}, { timestamps: true });

module.exports = mongoose.model('Despacho', DespachoSchema);
