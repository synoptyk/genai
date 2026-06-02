const mongoose = require('mongoose');

const ConsumoCombustibleSchema = new mongoose.Schema({
  empresaRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true,
    index: true
  },
  patente: {
    type: String,
    required: true,
    index: true,
    uppercase: true,
    trim: true
  },
  fechaCarga: {
    type: Date,
    required: true,
    index: true
  },
  litros: {
    type: Number,
    required: true,
    default: 0
  },
  monto: {
    type: Number,
    required: true,
    default: 0
  },
  tipoCombustible: {
    type: String,
    trim: true
  },
  odometro: {
    type: Number,
    default: 0
  },
  estacion: {
    type: String,
    trim: true
  },
  tarjeta: {
    type: String,
    trim: true
  },
  // Opcional: Proveedor del archivo (ej: 'COPEC', 'SHELL', etc)
  proveedor: {
    type: String,
    trim: true,
    default: 'MANUAL'
  },
  // Referencia opcional al vehículo si existe en la BD
  vehiculoRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehiculo'
  },
  // Para control de duplicados de carga
  comprobanteTransaccion: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true,
  strict: false // Permitimos campos extra del excel temporalmente
});

// Índice compuesto para facilitar consultas por fecha y patente
ConsumoCombustibleSchema.index({ empresaRef: 1, patente: 1, fechaCarga: -1 });

module.exports = mongoose.model('ConsumoCombustible', ConsumoCombustibleSchema);
