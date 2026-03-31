const mongoose = require('mongoose');

const PayrollConfigSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, unique: true },
  
  // Mapeo detallado de columnas LRE (DT 2026)
  // Cada llave representa un código o concepto del LRE
  // El valor indica el ORIGEN de los datos (ej: 'closure.totalBonus', 'ficha.sueldoBase', etc.)
  mappings: {
    sueldoBase: { type: String, default: 'ficha.sueldoBase' },
    gratificacion: { type: String, default: 'formula.legal_25' },
    horasExtra: { type: String, default: 'manual.horasExtra' },
    
    // Bonos Operativos (Donde ocurre la magia del cruce)
    bonoProduccion: { type: String, default: 'closure.baremoBonus' },
    bonoCalidad: { type: String, default: 'closure.calidadBonus' }, // rr + ai
    bonoAsistencia: { type: String, default: 'closure.asistenciaBonus' },
    
    // No Imponibles
    colacion: { type: String, default: 'ficha.colacion' },
    movilizacion: { type: String, default: 'ficha.movilizacion' },
    viaticos: { type: String, default: 'manual.viaticos' },
  },
  
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

  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PayrollConfig', PayrollConfigSchema);
