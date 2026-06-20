const mongoose = require('mongoose');

const GpsActivoSchema = new mongoose.Schema({
  empresaRef: { type: String, required: true },
  
  // Identificación del activo
  tipoActivo: { type: String, enum: ['CELULAR', 'NOTEBOOK', 'TABLET', 'OTRO'], required: true },
  identificador: { type: String, required: true, trim: true }, // IMEI, MAC, Serial, etc.
  modelo: { type: String, default: 'Desconocido' },
  numeroCelular: { type: String, trim: true },
  
  // Asignación (Recursos Humanos / Logística)
  asignadoA: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }, 
  productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
  esPersonal: { type: Boolean, default: true },
  
  // Posición Geográfica
  latitud: { type: Number, required: true },
  longitud: { type: Number, required: true },
  
  // Telemetría / Estado
  bateria: { type: Number, default: 100 },
  conexion: { type: String, enum: ['WIFI', '4G', '5G', 'DESCONECTADO', 'DESCONOCIDO'], default: 'DESCONOCIDO' },
  estado: { type: String, enum: ['ACTIVO', 'EN REPARACION', 'EXTRAVIADO', 'APAGADO'], default: 'ACTIVO' },

  // Control de Tiempo
  timestamp: { type: Date, default: Date.now },
  origenCaptura: { type: String, default: 'APP_MOBILE' } // De donde proviene la coordenada
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas por empresa y persona asignada
GpsActivoSchema.index({ empresaRef: 1, asignadoA: 1 });
GpsActivoSchema.index({ timestamp: -1 });

module.exports = mongoose.model('GpsActivo', GpsActivoSchema);
