const mongoose = require('mongoose');

const PayrollTemplateSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  name: { type: String, required: true },
  config: { type: Object, required: true }, // payrollMapping state
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Unicidad por nombre dentro de la misma empresa
PayrollTemplateSchema.index({ empresaRef: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PayrollTemplate', PayrollTemplateSchema);
