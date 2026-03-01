const mongoose = require('mongoose');

const ProcedimientoSchema = new mongoose.Schema({
    codigo: { type: String, required: true, unique: true },
    titulo: { type: String, required: true },
    descripcion: { type: String },
    pdfUrl: { type: String },
    imagenReferenciaUrl: { type: String },
    categoria: { type: String },
    evidencia: {
        fotoCarnetPrev: { type: String }, // URL a Cloudinary/S3
    },
    firmaAvanzada: {
        signature: { type: String },
        qrId: { type: String },
        gps: { type: String },
        timestamp: { type: Date },
        rutFirmante: { type: String },
        nombreFirmante: { type: String },
        cargoFirmante: { type: String, default: 'Prevencionista de Riesgos' }
    },
    fechaSubida: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Procedimiento', ProcedimientoSchema);
