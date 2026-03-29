const mongoose = require('mongoose');

const ContratoDocumentoSchema = new mongoose.Schema({
    candidatoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    plantillaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Plantilla', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    titulo: { type: String, required: true },
    tipo: { type: String, enum: ['Contrato', 'Anexo', 'Otro'], default: 'Contrato' },
    contenidoHtml: { type: String, required: true },
    pdfUrl: { type: String },
    
    estado: { 
        type: String, 
        enum: ['Borrador', 'Pendiente de Aprobación', 'Aprobado', 'Firmado', 'Rechazado'], 
        default: 'Borrador' 
    },
    
    solicitadoPor: {
        name: String,
        email: String,
        timestamp: { type: Date, default: Date.now }
    },
    
    approvalChain: [{
        id: String,
        name: String,
        email: String,
        position: String,
        status: { type: String, enum: ['Pendiente', 'Aprobado', 'Rechazado'], default: 'Pendiente' },
        comment: String,
        updatedAt: Date
    }],
    
    metadataFirma: {
        hash: String,
        ip: String,
        userAgent: String,
        timestamp: Date,
        qrId: String
    },
    
    tenantId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ContratoDocumento', ContratoDocumentoSchema);
