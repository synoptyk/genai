const mongoose = require('mongoose');

// Sub-schema para ítems EPP
const ItemEppSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    tiene: { type: Boolean, default: false },
    condicion: { type: String, enum: ['Bueno', 'Malo', 'N/A'], default: 'N/A' }
}, { _id: false });

const InspeccionSchema = new mongoose.Schema({
    tipo: {
        type: String,
        enum: ['cumplimiento-prevencion', 'epp'],
        required: true
    },

    // Identificación del trabajador inspeccionado
    empresa: { type: String, required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    ot: { type: String },
    nombreTrabajador: { type: String, required: true },
    rutTrabajador: { type: String, required: true },
    cargoTrabajador: { type: String },
    lugarInspeccion: { type: String },
    gps: { type: String },

    // --- TIPO 1: Cumplimiento de Prevención ---
    cumplimiento: {
        tieneAst: { type: Boolean, default: false },
        astNumero: { type: String },
        tienePts: { type: Boolean, default: false },
        ptsNumero: { type: String },
        tieneEpp: { type: Boolean, default: false },
        eppCompleto: { type: Boolean, default: false },
        inductionRealizada: { type: Boolean, default: false },
        observacionesCumplimiento: { type: String }
    },

    // --- TIPO 2: Inspección EPP ---
    itemsEpp: [ItemEppSchema],

    // Estado general calculado
    resultado: {
        type: String,
        enum: ['Conforme', 'No Conforme', 'Observado'],
        default: 'Observado'
    },

    // Alertas generadas hacia HSE Audit
    alertaHse: { type: Boolean, default: false },
    detalleAlerta: { type: String },

    // Email del trabajador inspeccionado (para envío de correo)
    emailTrabajador: { type: String },

    // Firma e Inspector (Supervisor HSE)
    inspector: {
        nombre: { type: String },
        cargo: { type: String },
        rut: { type: String },
        email: { type: String },
        firma: { type: String }, // base64 canvas
        firmaId: { type: String },
        timestamp: { type: String }
    },

    // Firma del Colaborador / Trabajador
    firmaColaborador: {
        nombre: { type: String },
        rut: { type: String },
        email: { type: String },
        firma: { type: String }, // base64 canvas
        firmaId: { type: String },
        timestamp: { type: String }
    },

    fotoEvidencia: [String], // Array de 4 fotos base64
    observaciones: { type: String },
    estado: {
        type: String,
        enum: ['En Revisión', 'Aprobado', 'Rechazado'],
        default: 'En Revisión'
    },
    // Trazabilidad: quién registró la inspección
    creadoPor: { type: String },
    supervisorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Inspeccion', InspeccionSchema);
