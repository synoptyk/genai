const mongoose = require('mongoose');

const RegistroAsistenciaSchema = new mongoose.Schema({
    candidatoId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    empresaRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa',   required: true },
    turnoId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Turno' },
    fecha:        { type: Date, required: true },
    horaEntrada:  String,
    horaSalida:   String,
    estado: {
        type: String,
        enum: ['Presente', 'Ausente', 'Tardanza', 'Licencia', 'Permiso', 'Feriado', 'Vacaciones', 'Libre', 'NC'],
        default: 'Presente'
    },
    minutosTardanza:     { type: Number, default: 0 },
    horasExtra:          { type: Number, default: 0 },           // HE registradas (declaradas)
    horasExtraAprobadas: { type: Number, default: 0 },           // HE aprobadas por supervisor
    estadoHorasExtra: {
        type: String,
        enum: ['Sin HE', 'Pendiente', 'Aprobado', 'Rechazado'],
        default: 'Sin HE'
    },
    // Tipo de ausencia (solo cuando estado != Presente / Tardanza)
    tipoAusencia: {
        type: String,
        enum: [
            'Licencia Médica',
            'Licencia Maternal/Paternal',
            'Accidente del Trabajo',
            'Permiso con Goce de Sueldo',
            'Permiso sin Goce de Sueldo',
            'Vacaciones',
            'Inasistencia Injustificada',
            'Feriado Legal',
        ],
        default: null
    },
    descuentaDia:   { type: Boolean, default: false }, // true = descuenta del sueldo (ausencia injustificada)
    validadoPor:    String,                             // nombre del supervisor que aprobó
    observacion:    String,
    registradoPor:  String,
    // SINCRONIZACIÓN CON PRODUCCIÓN Y CAPTURA DE TALENTO
    isBeforeContract: { type: Boolean, default: false }, // NC (No Contratado) - fecha anterior a contractStartDate
    esFeriado:        { type: Boolean, default: false }, // Marcador de feriado legal
    esDomingo:        { type: Boolean, default: false }, // Marcador de domingo
    syncFromProduccion: { type: Boolean, default: false }, // true = sincronizado desde Producción, false = manual
}, { timestamps: true });

// Índice compuesto para búsquedas rápidas por empresa + candidato + fecha
RegistroAsistenciaSchema.index({ empresaRef: 1, candidatoId: 1, fecha: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('RegistroAsistencia', RegistroAsistenciaSchema);
