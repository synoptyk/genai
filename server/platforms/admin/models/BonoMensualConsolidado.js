const mongoose = require('mongoose');

const BonoMensualConsolidadoSchema = new mongoose.Schema({
  mes: { type: Number, required: true },
  anio: { type: Number, required: true },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  modeloRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ModeloBonificacion' },
  status: { type: String, enum: ['ABIERTO', 'CERRADO'], default: 'CERRADO' },
  calculos: [{
    tecnicoId: { type: String }, // idRecursoToa or MongoId
    nombre: { type: String },
    puntos: { type: Number },
    multiplier: { type: Number },
    baremoBonus: { type: Number },
    rrValue: { type: Number },
    rrBonus: { type: Number },
    aiValue: { type: Number },
    aiBonus: { type: Number },
    totalBonus: { type: Number }
  }],
  totales: {
    puntos: { type: Number },
    baremo: { type: Number },
    rr: { type: Number },
    ai: { type: Number },
    total: { type: Number }
  },
  createdAt: { type: Date, default: Date.now },
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
});

module.exports = mongoose.model('BonoMensualConsolidado', BonoMensualConsolidadoSchema);
