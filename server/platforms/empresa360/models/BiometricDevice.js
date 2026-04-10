const mongoose = require('mongoose');

const BiometricDeviceSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  nombre: { type: String, required: true, trim: true },
  marca: { type: String, trim: true },
  modelo: { type: String, trim: true },
  serial: { type: String, required: true, trim: true },
  ubicacion: { type: String, trim: true },
  ipLocal: { type: String, trim: true },
  estado: { type: String, enum: ['Activo', 'Inactivo', 'Mantenimiento'], default: 'Activo' },
  ultimoHeartbeat: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

BiometricDeviceSchema.index({ empresaRef: 1, serial: 1 }, { unique: true });

module.exports = mongoose.model('BiometricDevice', BiometricDeviceSchema);
