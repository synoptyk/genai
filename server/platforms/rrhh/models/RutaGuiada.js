const mongoose = require('mongoose');

const RutaStopSchema = new mongoose.Schema({
  sequence: { type: Number, required: true },
  clienteNombre: { type: String, trim: true, default: '' },
  direccion: { type: String, required: true, trim: true },
  direccionNormalizada: { type: String, trim: true, default: '' },
  comuna: { type: String, trim: true, default: '' },
  region: { type: String, trim: true, default: '' },
  pais: { type: String, trim: true, default: '' },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  contactoNombre: { type: String, trim: true, default: '' },
  contactoTelefono: { type: String, trim: true, default: '' },
  notas: { type: String, trim: true, default: '' },
  etaMin: { type: Number, default: 0 },
  distanceFromPreviousKm: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['PENDIENTE', 'EN_CURSO', 'ENTREGADO', 'CERRADO'],
    default: 'PENDIENTE',
  },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completionNote: { type: String, trim: true, default: '' },
}, { _id: true });

const RutaGuiadaSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  conductorRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Conductor', required: true, index: true },
  nombreRuta: { type: String, required: true, trim: true },
  estado: {
    type: String,
    enum: ['PLANIFICADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'],
    default: 'PLANIFICADA',
    index: true,
  },
  origen: {
    mode: { type: String, enum: ['DRIVER_CURRENT', 'MANUAL'], default: 'DRIVER_CURRENT' },
    label: { type: String, trim: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    comuna: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  stops: { type: [RutaStopSchema], default: [] },
  totalDistanceKm: { type: Number, default: 0 },
  totalDurationMin: { type: Number, default: 0 },
  polyline: { type: [[Number]], default: [] },
  currentStopIndex: { type: Number, default: 0 },
  notas: { type: String, trim: true, default: '' },
  createdBy: { type: String, trim: true, default: '' },
  optimizedAt: { type: Date, default: Date.now },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
}, { timestamps: true });

RutaGuiadaSchema.index({ empresaRef: 1, conductorRef: 1, estado: 1, createdAt: -1 });

module.exports = mongoose.model('RutaGuiada', RutaGuiadaSchema);