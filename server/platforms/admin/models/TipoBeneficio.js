const mongoose = require('mongoose');

const TipoBeneficioSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    nombre: { type: String, required: true },
    codigoDT: { type: String, required: true }, // LRE code, e.g. '1001' (Sueldo base?), '1020' Aguinaldo
    descripcionLegal: { type: String, default: '' },
    requiereCantidad: { type: Boolean, default: false },
    unidadMedida: { type: String, enum: ['Horas', 'Días', 'Unidades', ''], default: '' },
    isEstandar: { type: Boolean, default: false }, // If true, it's a default loaded by the system
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

TipoBeneficioSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('TipoBeneficio', TipoBeneficioSchema);
