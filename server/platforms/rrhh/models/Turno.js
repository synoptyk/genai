const mongoose = require('mongoose');

const TurnoSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    tipo: { type: String, enum: ['Mañana', 'Tarde', 'Noche', 'Full Day', 'Personalizado'], default: 'Full Day' },
    horaEntrada: { type: String, required: true }, // HH:MM
    horaSalida: { type: String, required: true },  // HH:MM
    horasTrabajo: Number,
    diasSemana: [{ type: String, enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] }],
    colominoAsignados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Candidato' }],
    color: { type: String, default: '#6366F1' },
    activo: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Turno', TurnoSchema);
