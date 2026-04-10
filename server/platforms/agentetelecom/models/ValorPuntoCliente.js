const mongoose = require('mongoose');

// =============================================================================
// VALOR PUNTO POR CLIENTE — Precio que paga cada cliente por punto baremo
// Una empresa puede tener múltiples clientes/proyectos, cada uno con un precio
// diferente por punto baremo. Este modelo almacena esa configuración.
// =============================================================================

const ValorPuntoClienteSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },

  // Identificación del cliente/proyecto
  cliente: { type: String, required: true },           // Ej: "MOVISTAR", "ENTEL", "VTR"
  proyecto: { type: String, default: '' },             // Ej: "Residencial", "Empresas", "FTTH"
  descripcion: { type: String, default: '' },          // Nota descriptiva

  // Valor financiero
  valor_punto: { type: Number, required: true },       // Precio en moneda por cada punto baremo
  moneda: { type: String, default: 'CLP' },
  iva_incluido: { type: Boolean, default: false },     // Si el valor ya incluye IVA
  retencion: { type: Number, default: 0, min: 0, max: 100 }, // % de retención a descontar de la facturación

  // Control
  activo: { type: Boolean, default: true },
  color: { type: String, default: '#3b82f6' },        // Color para identificar en la UI
}, {
  timestamps: true
});

ValorPuntoClienteSchema.index({ cliente: 1, proyecto: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('ValorPuntoCliente', ValorPuntoClienteSchema);
