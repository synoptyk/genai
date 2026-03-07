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
    cargos: [{ type: String }],
    areas: [{ type: String }],
    cecos: [{ type: String }],
    projectTypes: [{ type: String }],
    approvalWorkflows: [ApprovalWorkflowSchema],
    updatedAt: { type: Date, default: Date.now }
});

EmpresaConfigSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('EmpresaConfig', EmpresaConfigSchema);
