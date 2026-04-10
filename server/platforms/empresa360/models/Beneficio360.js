const mongoose = require('mongoose');

const Beneficio360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  nombre: { type: String, required: true, trim: true },
  categoria: {
    type: String,
    enum: ['Salud', 'Alimentacion', 'Transporte', 'Educacion', 'Reconocimiento', 'Otro'],
    default: 'Otro'
  },
  proveedor: { type: String, trim: true },
  montoMensual: { type: Number, default: 0, min: 0 },
  imponible: { type: Boolean, default: false },
  descripcion: { type: String, trim: true },
  activo: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

Beneficio360Schema.index({ empresaRef: 1, nombre: 1 }, { unique: true });

module.exports = mongoose.model('Beneficio360', Beneficio360Schema);
