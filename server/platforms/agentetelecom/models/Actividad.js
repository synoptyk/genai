const mongoose = require('mongoose');

const ActividadSchema = new mongoose.Schema({
  // ════════════════════════════════════════════════════════════════════════
  // IDENTIFICADORES ÚNICOS
  // ════════════════════════════════════════════════════════════════════════
  ordenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // ════════════════════════════════════════════════════════════════════════
  // DATOS OPERATIVOS CANÓNICOS (UPPERCASE)
  // ════════════════════════════════════════════════════════════════════════
  fecha: { type: Date, required: false, index: true },
  RECURSO: { type: String, required: false, index: true }, // ID técnico canónico
  ACTIVIDAD: String,
  ESTADO: String,
  SUBTIPO_DE_ACTIVIDAD: String,
  NOMBRE: String,
  RUT_DEL_CLIENTE: String,
  CIUDAD: String,
  VENTANA_DE_SERVICIO: String,
  VENTANA_DE_LLEGADA: String,
  NÚMERO_DE_PETICIÓN: String,

  // ════════════════════════════════════════════════════════════════════════
  // PUNTOS Y EQUIPOS CANÓNICOS (CONSOLIDADOS UPPERCASE)
  // ════════════════════════════════════════════════════════════════════════
  PTS_TOTAL_BAREMO: { type: Number, default: 0 },
  PTS_ACTIVIDAD_BASE: { type: Number, default: 0 },
  PTS_DECO_ADICIONAL: { type: Number, default: 0 },
  PTS_REPETIDOR_WIFI: { type: Number, default: 0 },
  PTS_TELEFONO: { type: Number, default: 0 },
  DECOS_ADICIONALES: { type: Number, default: 0 },
  REPETIDORES_WIFI: { type: Number, default: 0 },
  TELEFONOS: { type: Number, default: 0 },
  TOTAL_EQUIPOS_EXTRAS: { type: Number, default: 0 },

  // ════════════════════════════════════════════════════════════════════════
  // TARIFAS Y CÓDIGOS LPU
  // ════════════════════════════════════════════════════════════════════════
  CODIGO_LPU_BASE: String,
  DESC_LPU_BASE: String,
  CODIGO_LPU_DECO_WIFI: String,
  CODIGO_LPU_REPETIDOR: String,
  VALOR_ACTIVIDAD_CLP: Number,
  CLIENTE_TARIFA: String,
  PROYECTO_TARIFA: String,

  // ════════════════════════════════════════════════════════════════════════
  // VÍNCULO 360 Y EMPRESA
  // ════════════════════════════════════════════════════════════════════════
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' },
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', index: true },

  // ════════════════════════════════════════════════════════════════════════
  // AUDITORÍA
  // ════════════════════════════════════════════════════════════════════════
  ultimaActualizacion: { type: Date, default: Date.now }
}, {
  strict: false, // ← MANTENER: Permite guardar campos extra legacy si el bot los envía
  timestamps: true
});

// ════════════════════════════════════════════════════════════════════════
// ÍNDICES CRÍTICOS DE PERFORMANCE
// ════════════════════════════════════════════════════════════════════════
ActividadSchema.index({ empresaRef: 1, fecha: -1 });
ActividadSchema.index({ empresaRef: 1, ESTADO: 1, fecha: -1 });
ActividadSchema.index({ empresaRef: 1, RECURSO: 1 }); // Para búsqueda técnico
ActividadSchema.index({ NOMBRE: 'text', ACTIVIDAD: 'text', ESTADO: 'text' }); // TEXT para búsqueda global
ActividadSchema.index({ SUBTIPO_DE_ACTIVIDAD: 1, fecha: -1 }); // Para filtros por tipo

module.exports = mongoose.model('Actividad', ActividadSchema);