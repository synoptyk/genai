const mongoose = require('mongoose');

/**
 * 💰 REGISTRO UNIFICADO DE TRANSACCIONES DE BONIFICACIÓN (v5.0)
 * Almacena los resultados finales de cualquier regla de BonoConfig.
 * Este es el puente final hacia la Nómina/Payroll.
 */

const BonoTransaccionSchema = new mongoose.Schema({
  // ─── Vínculos Principales ───────────────────────────────────────────────
  empresaRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  bonoConfigRef: { type: mongoose.Schema.Types.ObjectId, ref: 'BonoConfig', required: true },
  
  // Identificación del beneficiario (Doble vía para robustez)
  beneficiario: {
    rut:  { type: String, required: true }, 
    nombre: { type: String },
    candidatoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidato' }, // Vínculo RRHH
    tecnicoRef:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico' }    // Vínculo Operaciones
  },

  // ─── Datos del Periodo y Monto ──────────────────────────────────────────
  periodo: {
    mes:  { type: Number, required: true },
    anio: { type: Number, required: true },
    key:  { type: String } // Ej: "03-2026"
  },

  monto: { type: Number, required: true, default: 0 },
  
  // Datos crudos del cálculo para auditoría
  rawDetails: {
    baseCalculo: { type: Number }, // Ej: Puntos TOA, Monto Venta, % KPI
    factor:      { type: Number }, // Ej: Multiplicador, Tasa Comisión
    metadata:    { type: mongoose.Schema.Types.Mixed } // Data extra segun la estrategia
  },

  // ─── Trazabilidad y Estado ──────────────────────────────────────────────
  status: {
    type: String,
    enum: ['CALCULADO', 'BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'RECHAZADO', 'PAGADO', 'ANULADO'],
    default: 'CALCULADO'
  },
  
  source: {
    type: String,
    enum: ['MOTOR_CONFIG', 'MANUAL', 'IMPORTACION', 'BOT_EXTRACCION'],
    default: 'MOTOR_CONFIG'
  },

  audit: {
    creadoPor:  { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    aprobadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    fechaAprobacion: { type: Date },
    motivoRechazo:   { type: String },
    hashControl:     { type: String } // Firma digital opcional para integridad
  },

  // ─── Sincronización con Nómina ──────────────────────────────────────────
  sincronizadoNomina: { type: Boolean, default: false },
  fechaSincronizacion: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexación estratégica para reportes ultra-rápidos
BonoTransaccionSchema.index({ empresaRef: 1, 'periodo.anio': 1, 'periodo.mes': 1 });
BonoTransaccionSchema.index({ 'beneficiario.rut': 1 });

BonoTransaccionSchema.pre('save', function(next) {
  if (this.periodo.mes && this.periodo.anio) {
    this.periodo.key = `${String(this.periodo.mes).padStart(2, '0')}-${this.periodo.anio}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BonoTransaccion', BonoTransaccionSchema);
