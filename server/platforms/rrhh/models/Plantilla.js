const mongoose = require('mongoose');

const PlantillaSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    tipo: { type: String, enum: ['Contrato', 'Anexo', 'Otro'], default: 'Contrato' },
    tituloDocumento: { type: String },
    contenido: { type: String, required: true },
    logoLeft: { type: String }, // Base64 o URL
    logoRight: { type: String }, // Base64 o URL
    firmas: [{ type: String }],
    lastMod: { type: Date, default: Date.now },
    tenantId: { type: String } // Para multi-empresa
}, { timestamps: true });

module.exports = mongoose.model('Plantilla', PlantillaSchema);
