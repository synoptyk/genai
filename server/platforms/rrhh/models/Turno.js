const mongoose = require('mongoose');

const TurnoSchema = new mongoose.Schema({
    nombre:      { type: String, required: true },
    descripcion: String,
    empresaRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    tipo: {
        type: String,
        enum: ['Mañana', 'Tarde', 'Noche', 'Full Day', 'Personalizado'],
        default: 'Full Day'
    },
    horaEntrada:  { type: String, required: true }, // HH:MM
    horaSalida:   { type: String, required: true }, // HH:MM
    horasTrabajo: Number,                           // calculado automáticamente
    colacionMinutos: { type: Number, default: 30 }, // minutos de colación deducidos

    diasSemana: [{
        type: String,
        enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    }],

    // Horarios específicos por día (permite jornadas desiguales — Ej: L-V 9h, Sáb 5h)
    horariosPorDia: [{
        dia: {
            type: String,
            enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        },
        horaEntrada:     { type: String, default: '08:00' },
        horaSalida:      { type: String, default: '18:00' },
        colacionMinutos: { type: Number, default: 30 },
    }],

    // Tolerancia antes de marcar tardanza
    toleranciaTardanza: { type: Number, default: 5 }, // minutos

    // Política de horas extra
    horasExtraPolicy: {
        habilitado:   { type: Boolean, default: false },
        maxDiarias:   { type: Number, default: 2 },   // máx HE por día
        maxSemanales: { type: Number, default: 10 },  // máx HE por semana
        recargo:      { type: Number, default: 1.5 }, // factor (1.5 = 50% recargo Art. 32)
    },

    // Recargos legales
    recargos: {
        nocturno:  { type: Number, default: 35 }, // % recargo nocturno (Chile: 35%)
        festivo:   { type: Number, default: 50 }, // % recargo festivo (Chile: 50%)
        sabado:    { type: Number, default: 0  }, // % recargo sábado
    },

    esNocturno: { type: Boolean, default: false }, // activar recargo nocturno

    colominoAsignados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Candidato' }],
    color:  { type: String, default: '#6366F1' },
    activo: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Turno', TurnoSchema);
