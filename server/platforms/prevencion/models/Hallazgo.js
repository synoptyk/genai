const mongoose = require('mongoose');

const HallazgoSchema = new mongoose.Schema({
    astRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AST', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    descripcion: { type: String, required: true },
    prioridad: {
        type: String,
        enum: ['Baja', 'Media', 'Alta', 'Crítica'],
        default: 'Media'
    },
    responsable: { type: String },
    estado: {
        type: String,
        enum: ['Abierto', 'En Proceso', 'Cerrado'],
        default: 'Abierto'
    },
    evidencia: { type: String }, // URL o Base64
    fechaCierre: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Hallazgo', HallazgoSchema);
