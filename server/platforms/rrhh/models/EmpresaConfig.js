const mongoose = require('mongoose');

const ApprovalWorkflowSchema = new mongoose.Schema({
    module: { type: String, enum: ['Ingreso', 'Salida', 'Finiquito', 'Vacaciones', 'Amonestación'], required: true },
    approvers: [String], // List of roles or specific user IDs
});

const EmpresaConfigSchema = new mongoose.Schema({
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
