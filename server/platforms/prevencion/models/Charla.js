const mongoose = require('mongoose');

const CharlaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    tipo: {
        type: String,
        enum: ['Charla 5 Minutos', 'Inducción Hombre Nuevo', 'Capacitación Específica', 'Charla Extraordinaria'],
        required: true
    },
    descripcion: { type: String },
    empresa: { type: String },
    relator: {
        nombre: { type: String },
        rut: { type: String }
    },
    evidencia: {
        fotoAsistencia: { type: String } // Base64 o URL Cloudinary
    },
    videoUrl: { type: String }, // Links de YouTube, Vimeo, o MP4
    galeriaFotos: [{ type: String }],
    archivosAdjuntos: [{
        nombre: { type: String },
        url: { type: String }
    }],
    estadoPublicacion: {
        type: String,
        enum: ['Borrador', 'Publicado', 'Archivado'],
        default: 'Publicado'
    },
    firmaAvanzada: {
        signature: { type: String },
        qrId: { type: String },
        gps: { type: String },
        timestamp: { type: Date }
    },
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Charla', CharlaSchema);
