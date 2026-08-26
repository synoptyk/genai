const mongoose = require('mongoose');

const validacionAsistenciaSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'EmpresaConfig', required: true },
    periodo: { type: String, required: true }, // Formato "YYYY-MM", ej. "2026-07"
    candidatoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    rut: { type: String },
    
    // Snapshot de métricas originales calculadas
    balanceOriginal: { type: Number, default: 0 },
    horasTurnoTotales: { type: Number, default: 0 },
    horasEfectivasTrabajadas: { type: Number, default: 0 },
    horasNoTrabajadas: { type: Number, default: 0 },
    horasLibres: { type: Number, default: 0 },
    horasExtraAprobadas: { type: Number, default: 0 },

    // Decisión de Validación Inteligente del Supervisor
    estadoValidacion: { 
        type: String, 
        enum: ['PENDIENTE', 'APROBADO_ORIGINAL', 'COMPENSADO_ZERO', 'AJUSTE_MANUAL'], 
        default: 'PENDIENTE' 
    },
    balanceAprobadoFinal: { type: Number, default: 0 },
    observacionSupervisor: { type: String, default: '' },
    
    // Firma de Auditoría
    validadoPor: { type: String, default: '' },
    validadoPorEmail: { type: String, default: '' },
    fechaValidacion: { type: Date, default: Date.now }
}, { timestamps: true });

validacionAsistenciaSchema.index({ empresaRef: 1, periodo: 1, candidatoId: 1 }, { unique: true });

module.exports = mongoose.model('ValidacionAsistencia', validacionAsistenciaSchema);
