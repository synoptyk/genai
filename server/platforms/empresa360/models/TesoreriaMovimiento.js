const mongoose = require('mongoose');

const TesoreriaMovimientoSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  tipo: { type: String, enum: ['Ingreso', 'Egreso'], required: true },
  categoria: { type: String, trim: true, default: 'General' },
  descripcion: { type: String, trim: true, required: true },
  monto: { type: Number, required: true, min: 0 },
  fecha: { type: Date, required: true, default: Date.now },
  referenciaExterna: { type: String, trim: true },
  conciliado: { type: Boolean, default: false },
  cuenta: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

module.exports = mongoose.model('TesoreriaMovimiento', TesoreriaMovimientoSchema);
