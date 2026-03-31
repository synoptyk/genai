const mongoose = require('mongoose');

const ModeloBonificacionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  description: { type: String },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  color: { type: String, default: 'indigo' },
  activo: { type: Boolean, default: true },
  tramosBaremos: [{
    desde: { type: Number },
    hasta: { type: mongoose.Schema.Types.Mixed }, // Number or 'Más'
    valor: { type: Number }
  }],
  tramosRR: [{
    operator: { type: String }, // '<', '>', 'Entre'
    desde: { type: Number },
    hasta: { type: Number },
    limit: { type: Number },
    valor: { type: Number },
    label: { type: String }
  }],
  tramosAI: [{
    operator: { type: String }, // '<', '>', 'Entre'
    desde: { type: Number },
    hasta: { type: Number },
    limit: { type: Number },
    valor: { type: Number },
    label: { type: String }
  }],
  tipoBonoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoBono' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModeloBonificacion', ModeloBonificacionSchema);
