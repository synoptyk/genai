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
  // DATOS ESTANDARIZADOS (GOLDEN SCHEMA)
  // ════════════════════════════════════════════════════════════════════════
  idRecursoToa: { type: String, required: false, index: true }, // Vínculo universal
  fecha: { type: Date, required: false, index: true },           // Fecha universal
  ptsTotalBaremo: { type: Number, default: 0 },                  // Puntos universales
  estado: { type: String, index: true },                         // Estado universal
  
  // Datos Operativos Adicionales
  actividad: String,
  subtipo: String,
  comuna: String,
  peticion: String,

  // Vínculo con Empresa (Para que las empresas vean sus datos rápido)
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' },
  
  // Auditoría
  ultimaActualizacion: { type: Date, default: Date.now }
}, {
  strict: false, // Permitir campos legacy durante la transición
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

module.exports = mongoose.model('Actividad', ActividadSchema, 'actividades');