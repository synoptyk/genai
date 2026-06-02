const mongoose = require('mongoose');

const NotificacionSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    candidatoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    tipo: { type: String, enum: ['Informativa', 'Tramite'], required: true },
    titulo: { type: String, required: true },
    mensaje: { type: String, required: true },
    
    // Relación con el documento de origen (ej. DescuentoTransaccion)
    refId: { type: mongoose.Schema.Types.ObjectId, required: false },
    refModel: { type: String, required: false }, 
    
    // Estado de lectura general
    leida: { type: Boolean, default: false },

    // Datos para Trámites que requieren firma
    requiereFirma: { type: Boolean, default: false },
    estadoFirma: { type: String, enum: ['Pendiente', 'Firmado', 'Rechazado'], default: 'Pendiente' },
    pdfUrl: { type: String, default: '' }, // Donde se guarda el PDF firmado (o un base64 largo)
    motivoRechazo: { type: String, default: '' },
    
    // Datos de la firma avanzada
    datosFirma: {
        fechaHora: { type: Date },
        ip: { type: String },
        userAgent: { type: String },
        latitud: { type: Number },
        longitud: { type: Number }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

NotificacionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Notificacion', NotificacionSchema);
