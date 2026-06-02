const mongoose = require('mongoose');

const TipoDescuentoSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    nombre: { type: String, required: true },
    codigoDT: { type: String, required: true }, // LRE code, e.g. '4106', '4114'
    limiteLegalPorcentaje: { type: Number, default: 0 }, // 30 for prestamo, 0 for unlimited/standard
    descripcionLegal: { type: String, default: '' },
    requiereCantidad: { type: Boolean, default: false },
    unidadMedida: { type: String, enum: ['Horas', 'Días', 'Unidades', ''], default: '' },
    isEstandar: { type: Boolean, default: false }, // If true, it's a default loaded by the system
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

TipoDescuentoSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('TipoDescuento', TipoDescuentoSchema);
