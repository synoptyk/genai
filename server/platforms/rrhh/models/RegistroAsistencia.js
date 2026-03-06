const mongoose = require('mongoose');

const RegistroAsistenciaSchema = new mongoose.Schema({
    candidatoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    turnoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turno' },
    fecha: { type: Date, required: true },
    horaEntrada: String,
    horaSalida: String,
    estado: {
        type: String,
        enum: ['Presente', 'Ausente', 'Tardanza', 'Licencia', 'Permiso', 'Feriado'],
        default: 'Presente'
    },
    minutosTardanza: { type: Number, default: 0 },
    horasExtra: { type: Number, default: 0 },
    observacion: String,
    registradoPor: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RegistroAsistencia', RegistroAsistenciaSchema);
