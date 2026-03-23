const mongoose = require('mongoose');

const ConfigProduccionSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, unique: true },

  // Meta de producción por técnico
  metaProduccionDia: { type: Number, default: 0 },    // Puntos baremos meta por técnico por día
  diasLaboralesSemana: { type: Number, default: 5 },   // Días laborales por semana (5 o 6)
  diasLaboralesMes: { type: Number, default: 22 },     // Días laborales promedio al mes
}, {
  timestamps: true
});

// Virtuals calculados
ConfigProduccionSchema.virtual('metaProduccionSemana').get(function() {
  return Math.round((this.metaProduccionDia * this.diasLaboralesSemana) * 100) / 100;
});

ConfigProduccionSchema.virtual('metaProduccionMes').get(function() {
  return Math.round((this.metaProduccionDia * this.diasLaboralesMes) * 100) / 100;
});

ConfigProduccionSchema.set('toJSON', { virtuals: true });
ConfigProduccionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ConfigProduccion', ConfigProduccionSchema);
