const mongoose = require('mongoose');

const GastoSchema = new mongoose.Schema({
    rut: { type: String, required: true },
    nombre: { type: String },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    proyecto: { type: String },
    tipoGasto: {
        type: String,
        enum: ['Alimentación', 'Transporte', 'Peajes', 'Alojamiento', 'Materiales', 'Combustible', 'Otros'],
        required: true
    },
    monto: { type: Number, required: true },
    moneda: { type: String, default: 'CLP' },
    fechaGasto: { type: Date, default: Date.now },
    tipoDocumento: { type: String, enum: ['BOLETA', 'FACTURA', 'OTROS'], default: 'BOLETA' },
    montoNeto: { type: Number },
    ivaRecuperable: { type: Number, default: 0 },
    ivaPerdido: { type: Number, default: 0 },
    subtipoOtros: { type: String }, // Subcategoría para 'Otros'
    autorizador: { type: String }, // Nombre de quien autorizó
    evidenciaAutorizacionUrl: { type: String }, // URL de foto de WhatsApp/Email
    comprobanteUrl: { type: String }, 
    comprobantePublicId: { type: String },
    descripcion: { type: String },
    origenFondos: { 
        type: String, 
        enum: ['Empresa', 'Particular'], 
        default: 'Particular' 
    }, // 'Empresa' (Gasto asignado) o 'Particular' (Reembolso)
    estado: {
        type: String,
        enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'PAGADO', 'GERENCIA'],
        default: 'PENDIENTE'
    },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    gerenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    comentarioSupervisor: { type: String },
    comentarioGerente: { type: String },
    notificado: { type: Boolean, default: false }
}, { timestamps: true });


module.exports = mongoose.model('Gasto', GastoSchema);
