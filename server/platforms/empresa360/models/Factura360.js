const mongoose = require('mongoose');

const FacturaItemSchema = new mongoose.Schema({
  descripcion: { type: String, required: true, trim: true },
  cantidad: { type: Number, default: 1, min: 0 },
  precioUnitario: { type: Number, default: 0, min: 0 },
  subtotal: { type: Number, default: 0, min: 0 }
}, { _id: false });

const PagoSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  monto: { type: Number, required: true, min: 0 },
  metodo: { type: String, enum: ['Transferencia', 'Tarjeta', 'Efectivo', 'Otro'], default: 'Transferencia' },
  referencia: { type: String, trim: true }
}, { _id: false });

const Factura360Schema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
  clienteNombre: { type: String, required: true, trim: true },
  clienteRut: { type: String, trim: true },
  numeroFactura: { type: String, required: true, trim: true },
  moneda: { type: String, default: 'CLP', trim: true },
  fechaEmision: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date, required: true },
  items: { type: [FacturaItemSchema], default: [] },
  subtotal: { type: Number, default: 0, min: 0 },
  impuestoPct: { type: Number, default: 19, min: 0 },
  impuestoMonto: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  saldoPendiente: { type: Number, default: 0, min: 0 },
  estado: {
    type: String,
    enum: ['Borrador', 'Emitida', 'Parcial', 'Pagada', 'Vencida', 'Anulada'],
    default: 'Borrador'
  },
  pagos: { type: [PagoSchema], default: [] },
  observaciones: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' }
}, { timestamps: true });

Factura360Schema.index({ empresaRef: 1, numeroFactura: 1 }, { unique: true });

Factura360Schema.pre('save', function(next) {
  const subtotal = (this.items || []).reduce((acc, item) => {
    const lineSubtotal = Math.max(0, Number(item.cantidad || 0) * Number(item.precioUnitario || 0));
    item.subtotal = Math.round(lineSubtotal * 100) / 100;
    return acc + item.subtotal;
  }, 0);

  this.subtotal = Math.round(subtotal * 100) / 100;
  this.impuestoMonto = Math.round(this.subtotal * (Number(this.impuestoPct || 0) / 100) * 100) / 100;
  this.total = Math.round((this.subtotal + this.impuestoMonto) * 100) / 100;

  const pagado = (this.pagos || []).reduce((acc, p) => acc + Number(p.monto || 0), 0);
  this.saldoPendiente = Math.max(0, Math.round((this.total - pagado) * 100) / 100);

  if (this.estado !== 'Anulada') {
    if (this.saldoPendiente <= 0) this.estado = 'Pagada';
    else if (pagado > 0) this.estado = 'Parcial';
    else if (this.estado === 'Borrador') this.estado = 'Emitida';

    if (this.saldoPendiente > 0 && this.fechaVencimiento && new Date(this.fechaVencimiento) < new Date() && this.estado === 'Emitida') {
      this.estado = 'Vencida';
    }
  }

  next();
});

module.exports = mongoose.model('Factura360', Factura360Schema);
