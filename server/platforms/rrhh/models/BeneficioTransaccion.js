const mongoose = require('mongoose');

const BeneficioTransaccionSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    candidatoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    tipoBeneficioRef: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoBeneficio', required: true },
    periodo: { type: String, required: true }, // Format "YYYY-MM"
    monto: { type: Number, required: true, default: 0 },
    cantidad: { type: Number, default: 0 }, // optional for units
    modalidad: { type: String, enum: ['Totalidad', 'Cuotas', ''], default: '' },
    numeroCuotasTotal: { type: Number, default: null },
    cuotaActual: { type: Number, default: null },
    respaldoUrl: { type: String, default: '' }, // Link to document
    nota: { type: String, default: '' },
    estadoAprobacion: { type: String, enum: ['Pendiente', 'Aprobado', 'Rechazado'], default: 'Aprobado' },
    motivoRechazo: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

BeneficioTransaccionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('BeneficioTransaccion', BeneficioTransaccionSchema);
