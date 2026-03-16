const mongoose = require('mongoose');

const PreviredLogSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    periodo: { type: String, required: true },
    tipo: { type: String, enum: ['NOMINA', 'MOVIMIENTOS', 'HONORARIOS', 'RPA_SYNC'], required: true },
    status: { type: String, enum: ['SUCCESS', 'ERROR', 'WARNING'], default: 'SUCCESS' },
    mensaje: { type: String },
    metadata: {
        recordCount: { type: Number },
        fileName: { type: String }
    },
    fecha: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('PreviredLog', PreviredLogSchema);
