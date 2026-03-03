const mongoose = require('mongoose');

const TurnoSupervisorSchema = new mongoose.Schema({
    semanaDe: {
        type: Date,
        required: true
    },
    semanaHasta: {
        type: Date,
        required: true
    },
    supervisor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Asumiendo que los supervisores están en la colección de usuarios principal o CEO/Admin
        required: true
    },
    supervisorRut: {
        type: String, // Para fácil vinculación si es necesario cruzar con otras tablas
        required: false
    },
    supervisorNombre: {
        type: String,
        required: true
    },
    rutasDiarias: [{
        fecha: { type: Date, required: true },
        diaSemana: { type: String, required: true }, // 'L', 'M', 'M', 'J', 'V', 'S'
        horario: { type: String, required: true }  // e.g., "09:00 a 19:00" or "09:00 a 17:30"
    }],
    estado: {
        type: String,
        enum: ['Pendiente', 'Notificado', 'Confirmado'],
        default: 'Pendiente'
    },
    fechaConfirmacion: {
        type: Date
    },
    creadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Índice para asegurar que un supervisor no tenga turnos duplicados en la misma semana de inicio
TurnoSupervisorSchema.index({ semanaDe: 1, supervisor: 1 }, { unique: true });

module.exports = mongoose.model('TurnoSupervisor', TurnoSupervisorSchema);
