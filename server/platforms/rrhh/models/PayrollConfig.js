const mongoose = require('mongoose');

const PayrollConfigSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, unique: true },
  
  // Mapeo flexible de columnas LRE — acepta cualquier clave dinámica (model_<id>, etc.)
  mappings: { type: mongoose.Schema.Types.Mixed, default: {
    sueldoBase: 'ficha.sueldoBase',
    gratificacion: 'formula.legal_25',
  }},
  
  // Configuraciones generales de cálculo
  config: {
    tasaMutual: { type: Number, default: 0.90 },
    sis: { type: Number, default: 1.47 },
    colacionFija: { type: Boolean, default: true },
    movilizacionFija: { type: Boolean, default: true }
  },
  
  // Columnas dinámicas agregadas por el usuario
  extraColumns: [{
    key: { type: String },
    label: { type: String },
    code: { type: String },
    source: { type: String },
    id: { type: String }
  }],

  // Valores manuales por período: { '2025-01': { 'RUT_col_123': 5000, ... } }
  manualValuesByPeriod: { type: mongoose.Schema.Types.Mixed, default: {} },

  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true, strict: false });

module.exports = mongoose.model('PayrollConfig', PayrollConfigSchema);
