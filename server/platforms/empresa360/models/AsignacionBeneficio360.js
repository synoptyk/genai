const mongoose = require('mongoose');

const AsignacionBeneficio360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  beneficioRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Beneficio360', required: true },
  fechaInicio: { type: Date, default: Date.now },
  fechaFin: { type: Date },
  estado: { type: String, enum: ['Activo', 'Pausado', 'Finalizado'], default: 'Activo' },
  observaciones: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

AsignacionBeneficio360Schema.index({ empresaRef: 1, userRef: 1, beneficioRef: 1 }, { unique: true });

module.exports = mongoose.model('AsignacionBeneficio360', AsignacionBeneficio360Schema);
