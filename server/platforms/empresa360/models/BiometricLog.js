const mongoose = require('mongoose');

const BiometricLogSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
  rut: { type: String, trim: true },
  deviceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BiometricDevice' },
  tipoMarca: { type: String, enum: ['Entrada', 'Salida', 'ColacionInicio', 'ColacionFin', 'Otro'], default: 'Entrada' },
  fechaMarca: { type: Date, required: true, index: true },
  fuente: { type: String, enum: ['Manual', 'API_Device', 'Importacion'], default: 'API_Device' },
  payloadRaw: { type: Object }
}, { timestamps: true });

module.exports = mongoose.model('BiometricLog', BiometricLogSchema);
