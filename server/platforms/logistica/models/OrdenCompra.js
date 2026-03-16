const mongoose = require('mongoose');

const OrdenCompraSchema = new mongoose.Schema({
    codigoOC: { type: String, required: true },
    solicitudRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SolicitudCompra', required: true },
    proveedorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor', required: true },
    
    items: [{
        productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
        cantidad: { type: Number, required: true },
        precioUnitario: { type: Number, required: true },
        subtotal: { type: Number }
    }],
    subtotalNeto: { type: Number },
    iva: { type: Number }, // 19% en Chile
    total: { type: Number },

    archivoFacturaUrl: String,
    fechaEntregaEstimada: Date,
    estadoEntrega: { type: String, enum: ['Pendiente', 'Parcial', 'Recibido'], default: 'Pendiente' },
    observaciones: String,

    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
}, { timestamps: true });

OrdenCompraSchema.index({ codigoOC: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('OrdenCompra', OrdenCompraSchema);
