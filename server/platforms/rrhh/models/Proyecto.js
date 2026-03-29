const mongoose = require('mongoose');

const DotacionSchema = new mongoose.Schema({
    cargo: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    cubiertos: { type: Number, default: 0 },   // cuántos están ya asignados
    sede: { type: String }, // Sede específica para este cargo
    ceco: { type: String }, // Centro de Costo específico
    area: { type: String }, // Área específica
    departamento: { type: String },
    sueldoBaseLiquido: { type: Number, default: 0 },
    bonos: [{
        type: { type: String, trim: true },
        modality: { type: String, enum: ['Fijo', 'Variable'], default: 'Fijo' },
        amount: { type: Number, default: 0 },
        description: { type: String, trim: true }
    }]
});

const ProyectoSchema = new mongoose.Schema({
    // ── Identificación ─────────────────────────
    centroCosto: { type: String, required: true, trim: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    nombreProyecto: { type: String, required: true, trim: true },
    cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },
    area: { type: String, trim: true },
    sede: { type: String, trim: true }, // Legacy/Principal
    sedesVinculadas: [{ type: String }], // Lista de sedes vinculadas al proyecto

    // ── Dotación requerida (cargo + cantidad) ──
    dotacion: [DotacionSchema],

    // ── Estado y fechas ────────────────────────
    status: {
        type: String,
        enum: ['Activo', 'Pausado', 'Cerrado', 'En Licitación'],
        default: 'Activo'
    },
    fechaInicio: Date,
    fechaFin: Date,

    // ── Metas Financieras y de Producción ─────
    puntosRequeridos: { type: Number, default: 0 },
    ingresoRequerido: { type: Number, default: 0 },

    // ── Legado / compatibilidad ────────────────
    projectName: String,   // alias de nombreProyecto para compatibilidad
    location: String,
    manager: String,
    notes: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ProyectoSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    // Mantener alias en sincronía
    if (!this.projectName) this.projectName = this.nombreProyecto;
    next();
});

module.exports = mongoose.model('Proyecto', ProyectoSchema);
