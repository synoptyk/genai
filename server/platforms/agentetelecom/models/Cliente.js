const mongoose = require('mongoose');

const ClienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  valorPuntoActual: { type: Number, default: 0 },
  metaDiariaActual: { type: Number, default: 0 }, // Meta mensual en realidad
  valorFijoActual: { type: Number, default: 0 },
  reglaAsistencia: { type: Boolean, default: false },
  historialCambios: [{
    tipo: { type: String }, // 'PRECIO' o 'META'
    valorAnterior: Number,
    valorNuevo: Number,
    fechaCambio: { type: Date, default: Date.now }
  }]
});

ClienteSchema.index({ nombre: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('Cliente', ClienteSchema);
