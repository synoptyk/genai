const mongoose = require('mongoose');

const TipoBonoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  codigoDT: { type: String }, // Codigo LRE (Libro Remuneraciones Electrónico)
  descripcion: { type: String },
  tipo: { type: String, enum: ['IMPONIBLE', 'NO_IMPONIBLE'], required: true },
  frecuencia: { type: String, enum: ['MENSUAL', 'OCASIONAL', 'POR_EVENTO'], default: 'MENSUAL' },
  pagoProporcional: { type: Boolean, default: true }, // Si se descuenta por inasistencias/licencias
  
  // DT Legal Compliance properties
  baseLegal: { type: String }, // Parrafos especificos de la DT
  observacionDT: { type: String }, // Explicación de por qué es imponible o no
  limiteReferencial: { type: Number }, // Tope porcentual o en UF/CLP para alertas de "No Imponible"
  avisoLegal: { type: String }, // Texto de la alerta (ej: "No debe exceder lo razonable para el cargo")

  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  activo: { type: Boolean, default: true },
  esModuloProduccion: { type: Boolean, default: false }, // Vínculo con el módulo operacional (Baremo/Calidad)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TipoBono', TipoBonoSchema);
