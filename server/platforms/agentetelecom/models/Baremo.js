const mongoose = require('mongoose');

const BaremoSchema = new mongoose.Schema({
  codigo: { type: String, required: true },
  descripcion: { type: String, required: true },
  puntos: { type: Number, required: true },
  precio: { type: Number, default: 0 },         // New Financial Field
  ambito: { type: String, default: 'NACIONAL' }, // New Scope Field
  moneda: { type: String, default: 'CLP' },      // New Currency Field
  grupo: { type: String },
  cliente: { type: String, default: 'GENERICO' },
  mandante: { type: String, default: 'MOVISTAR' },
  // Technology Categories
  tecnologia_voz: { type: String, default: '' },
  tecnologia_banda_ancha: { type: String, default: '' },
  tecnologia_tv: { type: String, default: '' },
  tecnologia_capacidad: { type: String, default: '' },
  fechaCarga: { type: Date, default: Date.now }
});

BaremoSchema.index({ codigo: 1, cliente: 1 }, { unique: true });

module.exports = mongoose.model('Baremo', BaremoSchema);
