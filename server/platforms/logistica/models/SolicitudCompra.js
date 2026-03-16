const mongoose = require('mongoose');

const SolicitudCompraSchema = new mongoose.Schema({
    items: [{
        productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
        cantidadSolicitada: { type: Number, required: true },
        cantidadAutorizada: { type: Number }, // Editado por Gerencia
        modelo: String,
        serie: String,
        precioUnitarioEstimado: { type: Number, default: 0 }
    }],
    codigoSC: { type: String, required: true }, // Formato SC-YYYY-NNNN
    tipoCompraRef: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoCompra' },
    prioridad: { type: String, enum: ['Normal', 'Urgente'], default: 'Normal' },
    motivo: { type: String, required: true },
    
    proveedorSugeridoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor' },
    firmaSolicitante: mongoose.Schema.Types.Mixed, // Almacena el payload de FirmaAvanzada

    solicitante: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGenAi', required: true },
    datosSolicitante: {
        nombre: String,
        cargo: String
    },

    status: { 
        type: String, 
        enum: ['Pendiente', 'Revision Gerencia', 'Aprobada', 'Cotizando', 'Rechazada', 'Ordenada', 'Finalizada'], 
        default: 'Pendiente' 
    },

    // Gestión de Cotizaciones (Post-Aprobación)
    cotizaciones: [{
        proveedorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor' },
        precioTotal: { type: Number },
        documentoUrl: String,
        fecha: { type: Date, default: Date.now },
        observaciones: String
    }],
    proveedorSeleccionado: { type: mongoose.Schema.Types.ObjectId, ref: 'Proveedor' },

    // Auditoría de Modificaciones
    observacionModificacion: String,
    modificador: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGenAi' },
    historial: [{
        fecha: { type: Date, default: Date.now },
        usuario: String,
        accion: String,
        detalle: String
    }],

    // Aprobación (Gerencia)
    aprobador: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGenAi' },
    fechaAprobacion: Date,
    comentarioAprobador: String,

    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
}, { timestamps: true });

SolicitudCompraSchema.index({ codigoSC: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('SolicitudCompra', SolicitudCompraSchema);
