const mongoose = require('mongoose');

const UbicacionSchema = new mongoose.Schema({
  // IDENTIFICACIÓN
  patente: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,      // Elimina espacios en blanco
    uppercase: true  // Fuerza mayúsculas automáticamente
  },
  tecnicoId: { type: String, default: "POR_ASIGNAR" },

  // POSICIÓN GEOGRÁFICA
  latitud: { type: Number, required: true },
  longitud: { type: Number, required: true },

  // TELEMETRÍA (FALTABA VELOCIDAD)
  velocidad: { type: Number, default: 0 }, 
  bateria: { type: Number, default: 100 },

  // ESTADO
  estado: { type: String, default: "Desconocido" }, // Ej: "En Ruta", "Detenido"
  
  // CONTROL DE TIEMPO
  timestamp: { type: Date, default: Date.now }, // Hora del reporte GPS
  origen: { type: String, default: "BOT_AUTO" } // Para saber si vino del Bot o manual
}, {
  timestamps: true // Crea automáticamente 'createdAt' y 'updatedAt' de Mongo
});

// Índices para optimizar la carga del mapa en vivo
UbicacionSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Ubicacion', UbicacionSchema);