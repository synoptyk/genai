const mongoose = require('mongoose');

const AutoAuditoriaColaboradorSchema = new mongoose.Schema({
    empresaRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa',
        required: true
    },
    tecnicoRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tecnico',
        required: true
    },
    items: [{
        productoRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Producto'
        },
        estado: {
            type: String, // 'Bueno', 'Malo', 'No Tengo'
            required: true
        },
        comentario: String,
        fotoUrl: String
    }],
    firmaUrl: {
        type: String, // Base64 de la firma
        required: true
    },
    geolocalizacion: {
        lat: {
            type: Number,
            required: true
        },
        lng: {
            type: Number,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    estadoRevision: {
        type: String,
        enum: ['Firmado', 'Revisado', 'Rechazado'],
        default: 'Firmado'
    },
    tieneDiscrepancia: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('AutoAuditoriaColaborador', AutoAuditoriaColaboradorSchema);
