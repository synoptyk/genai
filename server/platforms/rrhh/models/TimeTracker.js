const mongoose = require('mongoose');

// Este modelo almacena las sesiones de tiempo activo de los usuarios (especialmente Administrativos)
const TimeTrackerSchema = new mongoose.Schema({
    userRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserGenAi',
        required: true,
        index: true
    },
    empresaRef: {
        type: String, // Referencia a la empresa (rut)
        required: true,
        index: true
    },
    fecha: {
        type: String, // Formato YYYY-MM-DD para facilitar el agrupamiento por día
        required: true,
        index: true
    },
    segundosTrabajados: {
        type: Number,
        default: 0
    },
    ultimaActividad: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Índice compuesto para buscar rápidamente el tracker del día para un usuario
TimeTrackerSchema.index({ userRef: 1, fecha: 1 }, { unique: true });

module.exports = mongoose.model('TimeTracker', TimeTrackerSchema);
