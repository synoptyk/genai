const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
  // --- IDENTIFICACIÓN ---
  patente: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  marca: { type: String, required: true, trim: true },
  modelo: { type: String, required: true, trim: true },
  anio: { type: Number, default: new Date().getFullYear() }, // Faltaba este campo

  // --- FINANCIERO Y CONTRATO ---
  proveedor: { type: String, trim: true }, // Ej: Mitta, Gama
  tipoContrato: { type: String, default: 'Leasing' }, // Leasing, Propio, Arriendo
  valor: { type: Number, default: 0 }, // Costo mensual
  moneda: { type: String, default: 'CLP' },

  // --- ESTADO Y LOGÍSTICA ---
  // Estado Operativo: ¿El auto sirve? (Operativa, Siniestro, Mantención)
  estadoOperativo: {
    type: String,
    default: 'Operativa'
  },
  // Estado Logístico: ¿Dónde está? (En Terreno, En Patio, Taller)
  estadoLogistico: {
    type: String,
    default: 'En Patio'
  },
  zona: { type: String, default: 'Metropolitana' },

  // --- ASIGNACIÓN (RRHH) ---
  asignadoA: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tecnico',
    default: null
  },

  // --- GESTIÓN DE INCIDENCIAS ---
  tieneReemplazo: { type: String, default: 'NO' },
  patenteReemplazo: { type: String, uppercase: true, trim: true },

  // --- HISTORIAL DE ASIGNACIONES (Trazabilidad completa) ---
  historialAsignaciones: [{
    tecnico: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico' },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'UserGenAi' },
    tipo: { type: String, enum: ['Asignación', 'Devolución', 'Cambio'], default: 'Asignación' },
    fecha: { type: Date, default: Date.now },
    observacion: { type: String },
    kmRegistrado: { type: Number }
  }]

}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);