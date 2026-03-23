const mongoose = require('mongoose');

const ActividadSchema = new mongoose.Schema({
  // Identificador único (Clave para que no se dupliquen)
  ordenId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  
  // Datos Operativos (Lo que extrae el bot)
  tecnicoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico', required: false },
  nombre: { type: String, required: false },
  actividad: { type: String, required: false },
  fecha: { type: Date, required: false },
  puntos: { type: Number, default: 0 },
  latitud: { type: String, required: false },
  longitud: { type: String, required: false },
  
  // Vínculo 360
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' },
  ceco: { type: String },
  
  // Datos Financieros (Lo que calcula el server)
  clienteAsociado: { type: String, default: 'Generico' },
  ingreso: { type: Number, default: 0 },
  
  // Auditoría
  ultimaActualizacion: { type: Date, default: Date.now }
}, { 
  strict: false, // <--- ESTO ES LA CLAVE: Permite guardar campos extra si el bot los envía
  timestamps: true 
});

// Índices de rendimiento para produccion-stats
ActividadSchema.index({ empresaRef: 1, fecha: -1 });
ActividadSchema.index({ empresaRef: 1, Estado: 1, fecha: -1 });

module.exports = mongoose.model('Actividad', ActividadSchema);