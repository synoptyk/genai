const mongoose = require('mongoose');

const AuditoriaInventarioSchema = new mongoose.Schema({
    empresaRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa',
        required: true
    },
    almacen: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Almacen',
        required: true
    },
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi',
        required: true
    },
    auditadoRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tecnico' // Opcional si es una bodega central sin técnico específico
    },
    datosAuditado: {
        rut: String,
        nombre: String,
        cargo: String,
        area: String,
        ceco: String,
        proyecto: String
    },
    firmaAceptacion: String, // Base64 de la firma al inicio
    firmaFinalizacion: String, // Base64 de la firma al terminar
    fechaAuditoria: {
        type: Date,
        default: Date.now
    },
    detalles: [{
        producto: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Producto'
        },
        modelo: String, // Captura el modelo en el momento de la auditoría
        serie: String,  // Captura el S/N si aplica
        estado: {
            type: String,
            enum: ['Nuevo', 'Usado Bueno', 'Usado Malo', 'Mermado/Dañado'],
            default: 'Nuevo'
        },
        stockSistema: {
            type: Number,
            required: true
        },
        conteoFisico: {
            type: Number,
            required: true
        },
        diferencia: {
            type: Number,
            required: true
        },
        // Campos Forenses solicitados
        fotoUrl: { 
            type: String, 
            required: true // El usuario exigió foto
        },
        coordenadasGps: {
            lat: Number,
            lng: Number
        },
        comentario: String, // Comentario opcional: Faltante, Dañado, requiere recambio, etc.
        ajustado: {
            type: Boolean,
            default: false
        }
    }],
    observaciones: String,
    estadoRevision: {
        type: String,
        enum: ['Pendiente', 'Verificado', 'Conciliado'],
        default: 'Pendiente'
    },
    tieneDiscrepancia: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('AuditoriaInventario', AuditoriaInventarioSchema);
