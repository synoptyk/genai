const mongoose = require('mongoose');

const ProveedorLeasingSchema = new mongoose.Schema({
  empresaRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Empresa',
    required: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  rut: {
    type: String,
    trim: true
  },
  contacto: {
    nombre: { type: String, trim: true },
    telefono: { type: String, trim: true },
    email: { type: String, trim: true }
  },
  serviciosContratados: [{
    type: String
  }],
  segurosIncluidos: [{
    type: String
  }],
  valores: {
    monedas: {
      rentaBase: { type: String, enum: ['CLP', 'UF', 'USD'], default: 'CLP' },
      seguroAdicional: { type: String, enum: ['CLP', 'UF', 'USD'], default: 'CLP' },
      gps: { type: String, enum: ['CLP', 'UF', 'USD'], default: 'CLP' },
      deducibleSiniestro: { type: String, enum: ['CLP', 'UF', 'USD'], default: 'CLP' }
    },
    rentaBase: { type: Number, default: 0 },
    seguroAdicional: { type: Number, default: 0 },
    gps: { type: Number, default: 0 },
    deducibleSiniestro: { type: Number, default: 0 }
  },
  estadoContrato: {
    type: String,
    enum: ['Activo', 'Inactivo'],
    default: 'Activo'
  }
}, { timestamps: true });

module.exports = mongoose.model('ProveedorLeasing', ProveedorLeasingSchema);
