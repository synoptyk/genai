const mongoose = require('mongoose');

const VehiculoSchema = new mongoose.Schema({
  // --- IDENTIFICACIÓN ---
  patente: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true // Evita errores por espacios vacíos
  },
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
  patenteReemplazo: { type: String, uppercase: true, trim: true }

}, { timestamps: true });

module.exports = mongoose.model('Vehiculo', VehiculoSchema);