const mongoose = require('mongoose');

const ConfiguracionSchema = new mongoose.Schema({
  clave: { type: String, required: true, unique: true }, // Ej: "valor_punto"
  valor: { type: Number, required: true }, // Ej: 14800
  descripcion: { type: String },
  ultimaActualizacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Configuracion', ConfiguracionSchema);