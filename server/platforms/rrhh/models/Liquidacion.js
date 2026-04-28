const mongoose = require('mongoose');

const LiquidacionSchema = new mongoose.Schema({
    periodo: { type: String, required: true }, // 'MM-YYYY'
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    fechaEmision: { type: Date, default: Date.now },
    trabajadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato', required: true },
    nombreTrabajador: { type: String },
    rutTrabajador: { type: String },
    cargo: { type: String },
    stats: {
        diasTrabajados: { type: Number },
        diasAusente: { type: Number },
        diasLicencia: { type: Number },
        horasExtra: { type: Number }
    },

    // Asistencia detallada (SINCRONIZACIÓN CON CONTROL DE ASISTENCIA)
    asistencia: {
        diasPresente: { type: Number },
        diasAusente: { type: Number },
        diasLicencia: { type: Number },
        diasNC: { type: Number },        // No Contratado (antes de contractStartDate)
        diasFeriado: { type: Number },  // Feriados legales
        diasDomingo: { type: Number },  // Domingos
        diasTardanza: { type: Number },
        horasExtraDeclaradas: { type: Number },
        horasExtraAprobadas: { type: Number }
    },

    // Producción (SINCRONIZACIÓN CON PANEL TELECOMUNICACIONES)
    produccion: {
        totalPuntos: { type: Number },
        totalIngreso: { type: Number },
        diasConProduccion: { type: Number },
        promedioPuntosPorDia: { type: Number }
    },

    // Indicadores usados (Snapshot)
    indicadores: {
        uf: { type: Number },
        utm: { type: Number },
        imm: { type: Number }
    },

    // Desglose de Haberes
    haberes: {
        sueldoBase: { type: Number },
        gratificacion: { type: Number },
        bonosImponibles: { type: Number },
        totImponible: { type: Number },
        movilizacion: { type: Number },
        colacion: { type: Number },
        asignacionFamiliar: { type: Number },
        otrosNoImponibles: { type: Number },
        totNoImponible: { type: Number },
        totHaberes: { type: Number }
    },

    // Desglose de Descuentos
    descuentos: {
        afp: {
            nombre: { type: String },
            monto: { type: Number },
            tasa: { type: Number }
        },
        salud: {
            nombre: { type: String },
            monto: { type: Number },
            isapreAdicionalClp: { type: Number }
        },
        afc: { type: Number },
        impuestoUnico: { type: Number },
        otros: { type: Number },
        totDescuentos: { type: Number }
    },

    sueldoLiquido: { type: Number },
    costoEmpresa: { type: Number },
    patronales: {
        sis: { type: Number },
        afc: { type: Number },
        sanna: { type: Number },
        mutual: { type: Number }
    }
}, { timestamps: true });

module.exports = mongoose.model('Liquidacion', LiquidacionSchema);
