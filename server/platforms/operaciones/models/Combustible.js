const mongoose = require('mongoose');

const CombustibleSchema = new mongoose.Schema({
    rut: { type: String, required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    nombre: { type: String },
    patente: { type: String, required: true },
    kmActual: { type: Number, required: true },
    fotoTacometro: { type: String, required: true }, // URL de Cloudinary
    estado: {
        type: String,
        enum: ['Pendiente', 'Aprobado', 'Rechazado', 'Carga Realizada'],
        default: 'Pendiente'
    },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    fecha: { type: Date, default: Date.now },
    comentarioSupervisor: { type: String },
    notificado: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Combustible', CombustibleSchema);
