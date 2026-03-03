const mongoose = require('mongoose');

const ASTSchema = new mongoose.Schema({
    ot: { type: String, required: true },
    empresa: { type: String, required: true },
    region: { type: String },
    comuna: { type: String },
    gps: { type: String, required: true },
    calle: { type: String },
    numero: { type: String },
    departamento: { type: String },
    aptitud: { type: String, enum: ['Si', 'No'], default: 'Si' },
    riesgosSeleccionados: [{ type: String }],
    eppVerificado: [{ type: String }],
    controlMedidas: { type: String },
    // NUEVOS CAMPOS: Identidad del Trabajador
    rutTrabajador: { type: String },
    nombreTrabajador: { type: String },
    cargoTrabajador: { type: String },
    emailTrabajador: { type: String },
    firmaColaborador: { type: String },
    metadataFirma: {
        timestamp: { type: Date },
        gps: { type: String },
        qrId: { type: String },
        verificationLink: { type: String }
    },
    estado: {
        type: String,
        enum: ['En Revisión', 'Aprobado', 'Rechazado'],
        default: 'En Revisión'
    },
    fotos: [{ type: String }], // URLs o Base64
    audio: { type: String },    // URL o Base64
    fotoInconsistencia: { type: String }, // Foto de evidencia de error
    comentariosHse: { type: String },    // Mensaje para el trabajador
    firmaHse: { type: String },
    fechaAprobacion: { type: Date },
    fechaCreacion: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('AST', ASTSchema);
