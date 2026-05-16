const mongoose = require('mongoose');

const ActividadMayoSchema = new mongoose.Schema({
  // IDENTIFICADORES ÚNICOS
  ordenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // DATOS ESTANDARIZADOS (GOLDEN SCHEMA)
  idRecursoToa: { type: String, required: false, index: true },
  fecha: { type: Date, required: false, index: true },
  ptsTotalBaremo: { type: Number, default: 0 },
  estado: { type: String, index: true },
  
  // Datos Operativos Adicionales
  actividad: String,
  subtipo: String,
  comuna: String,
  peticion: String,

  // Vínculo con Empresa
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' },
  
  // Auditoría
  ultimaActualizacion: { type: Date, default: Date.now }
}, {
  strict: false, // Permitir campos dinámicos
  timestamps: true,
  collection: 'actividades_mayo' // Colección específica para Mayo en adelante
});

// ÍNDICES
ActividadMayoSchema.index({ empresaRef: 1, fecha: -1 });
ActividadMayoSchema.index({ empresaRef: 1, ESTADO: 1, fecha: -1 });
ActividadMayoSchema.index({ empresaRef: 1, RECURSO: 1 });
ActividadMayoSchema.index({ NOMBRE: 'text', ACTIVIDAD: 'text', ESTADO: 'text' });
ActividadMayoSchema.index({ SUBTIPO_DE_ACTIVIDAD: 1, fecha: -1 });

module.exports = mongoose.model('ActividadMayo', ActividadMayoSchema);
