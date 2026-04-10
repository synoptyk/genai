const mongoose = require('mongoose');

const RespuestaEvaluadorSchema = new mongoose.Schema({
  evaluadorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  puntajes: {
    liderazgo: { type: Number, min: 1, max: 5 },
    colaboracion: { type: Number, min: 1, max: 5 },
    comunicacion: { type: Number, min: 1, max: 5 },
    ejecucion: { type: Number, min: 1, max: 5 },
    innovacion: { type: Number, min: 1, max: 5 }
  },
  comentario: { type: String, trim: true },
  fecha: { type: Date, default: Date.now }
}, { _id: false });

const Evaluacion360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  periodo: { type: String, required: true, trim: true },
  evaluadoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  evaluadoresRef: { type: [mongoose.Schema.Types.ObjectId], ref: 'PlatformUser', default: [] },
  estado: { type: String, enum: ['Borrador', 'Abierta', 'Cerrada'], default: 'Borrador' },
  respuestas: { type: [RespuestaEvaluadorSchema], default: [] },
  promedioFinal: { type: Number, default: 0 },
  planAccion: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

Evaluacion360Schema.pre('save', function(next) {
  if (!this.respuestas || this.respuestas.length === 0) {
    this.promedioFinal = 0;
    return next();
  }

  const valores = [];
  this.respuestas.forEach((r) => {
    Object.values(r.puntajes || {}).forEach((v) => {
      if (typeof v === 'number' && Number.isFinite(v)) valores.push(v);
    });
  });

  this.promedioFinal = valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : 0;
  next();
});

module.exports = mongoose.model('Evaluacion360', Evaluacion360Schema);
