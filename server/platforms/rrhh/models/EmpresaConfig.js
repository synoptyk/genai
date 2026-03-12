const mongoose = require('mongoose');

const ApproverSchema = new mongoose.Schema({
    id: { type: Number },
    name: { type: String, required: true },
    email: { type: String, required: true },
    position: { type: String }
}, { _id: false });

const ApprovalWorkflowSchema = new mongoose.Schema({
    module: { type: String, enum: ['Ingreso', 'Salida', 'Finiquito', 'Vacaciones', 'Amonestación', 'Permiso'], required: true },
    approvers: [ApproverSchema],
});

const EmpresaConfigSchema = new mongoose.Schema({
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, unique: true },
    cargos: [{
        nombre: { type: String, required: true },
        categoria: { type: String, enum: ['Operativo', 'Administrativo', 'Gerencial', 'Otros'], default: 'Operativo' }
    }],
    areas: [{
        nombre: { type: String, required: true }
    }],
    cecos: [{
        nombre: { type: String, required: true },
        areaAsociada: { type: String } // Ahora el CECO pertenece a un área
    }],
    projectTypes: [{ type: String }],
    departamentos: [{
        nombre: { type: String, required: true },
        region: { type: String }, // Sede/Lugar físico con su región
        comuna: { type: String }
    }],
    approvalWorkflows: [ApprovalWorkflowSchema],
    history: [{
        action: String,
        description: String,
        user: String,
        timestamp: { type: Date, default: Date.now }
    }],
    updatedAt: { type: Date, default: Date.now }
});

EmpresaConfigSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('EmpresaConfig', EmpresaConfigSchema);
