const mongoose = require('mongoose');

const DotacionSchema = new mongoose.Schema({
    cargo: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    cubiertos: { type: Number, default: 0 }   // cuántos están ya asignados
});

const ProyectoSchema = new mongoose.Schema({
    // ── Identificación ─────────────────────────
    centroCosto: { type: String, required: true, trim: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    nombreProyecto: { type: String, required: true, trim: true },
    cliente: { type: String, trim: true },
    area: { type: String, trim: true },
    sede: { type: String, trim: true }, // Reemplaza departamento como ubicación física

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
