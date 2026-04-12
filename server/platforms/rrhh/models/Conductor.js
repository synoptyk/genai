const mongoose = require('mongoose');
const crypto = require('crypto');

const ConductorSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  candidatoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', default: null },
  proyectoRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto',  default: null },

  // Datos personales
  nombre:    { type: String, required: true, trim: true },
  rut:       { type: String, required: true, trim: true },
  telefono:  { type: String, trim: true },
  email:     { type: String, trim: true, lowercase: true },

  // Vehículo asignado
  patente:   { type: String, trim: true, uppercase: true },
  marca:     { type: String, trim: true },
  modelo:    { type: String, trim: true },
  tamano:    { type: String, enum: ['Moto', 'Auto', 'Camioneta', 'Furgón 3/4', 'Van', 'Camión Pequeño', 'Camión Mediano', 'Camión Grande', 'Semi-remolque', 'Otro'], default: 'Camioneta' },
  anio:      { type: Number },
  color:     { type: String, trim: true },

  // Estado GPS
  gpsActivo:   { type: Boolean, default: false },
  gpsToken:    { type: String, default: () => crypto.randomBytes(24).toString('hex') },
  ultimaPosicion: {
    lat: Number,
    lng: Number,
    velocidad: Number,
    heading: Number,
    bateria: Number,
    signal: Number,
    precision: Number,
    timestamp: Date
  },
  gpsHistorial: [{
    lat: Number,
    lng: Number,
    velocidad: Number,
    heading: Number,
    bateria: Number,
    signal: Number,
    precision: Number,
    timestamp: { type: Date, default: Date.now }
  }],

  // Estado laboral
  estado: { type: String, enum: ['Activo', 'Inactivo', 'Suspendido', 'De Vacaciones'], default: 'Activo' },
  licenciaClase:   { type: String, enum: ['A1', 'A2', 'A3', 'A4', 'B', 'C', 'D', 'F', 'Otra'], default: 'B' },
  licenciaVence:   { type: Date },

  notas: { type: String },
  creadoPor: { type: String },
}, { timestamps: true });

ConductorSchema.index({ empresaRef: 1, rut: 1 }, { unique: true });
ConductorSchema.index({ gpsToken: 1 }, { unique: true, sparse: true });
ConductorSchema.index({ empresaRef: 1, 'gpsHistorial.timestamp': -1 });

module.exports = mongoose.model('Conductor', ConductorSchema);
