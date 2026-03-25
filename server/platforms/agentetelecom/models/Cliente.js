const mongoose = require('mongoose');

const ClienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  rut: { type: String, trim: true }, // Nuevo: Identificador tributario
  direccion: { type: String, trim: true },
  contacto: { type: String, trim: true }, // Nombre de la persona de contacto
  email: { type: String, trim: true, lowercase: true },
  telefono: { type: String, trim: true },
  estado: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' },
  descripcion: { type: String, trim: true },

  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },

  // --- Campos específicos de Telecom (Legacy/Compatibilidad) ---
  valorPuntoActual: { type: Number, default: 0 },
  metaDiariaActual: { type: Number, default: 0 }, // Meta mensual en realidad
  valorFijoActual: { type: Number, default: 0 },
  reglaAsistencia: { type: Boolean, default: false },
  historialCambios: [{
    tipo: { type: String }, // 'PRECIO' o 'META'
    valorAnterior: Number,
    valorNuevo: Number,
    fechaCambio: { type: Date, default: Date.now }
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ClienteSchema.index({ nombre: 1, empresaRef: 1 }, { unique: true });

// Middleware para actualizar timestamps
ClienteSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Cliente', ClienteSchema);
