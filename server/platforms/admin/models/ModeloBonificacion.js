const mongoose = require('mongoose');

const ModeloBonificacionSchema = new mongoose.Schema({
  // ─── Identificación ───────────────────────────────────────────────────────
  nombre:      { type: String, required: true },
  description: { type: String },
  empresaRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  color:       { type: String, default: 'indigo' },
  activo:      { type: Boolean, default: true },

  // ─── Tipo y Clasificación ─────────────────────────────────────────────────
  tipo: {
    type: String,
    enum: ['BAREMO_PUNTOS', 'BONO_FIJO', 'COMISION', 'META_KPI', 'ESCALA_ANTIGUEDAD', 'GRATIFICACION_VOLUNTARIA'],
    default: 'BAREMO_PUNTOS'
  },
  industria: { type: String, default: 'TODOS' }, // TELCO | CONSTRUCCION | RETAIL | SERVICIOS | MANUFACTURA | SALUD | TODOS

  // ─── Aplicabilidad ────────────────────────────────────────────────────────
  aplicaA: {
    todos:    { type: Boolean, default: true },
    cargos:   [{ type: String }],
    sectores: [{ type: String }]
  },

  // ─── BAREMO_PUNTOS (Telco/TOA) ────────────────────────────────────────────
  tramosBaremos: [{
    desde: { type: Number },
    hasta: { type: mongoose.Schema.Types.Mixed }, // Number | 'Más'
    valor: { type: Number }
  }],
  puntosExcluidos: { type: Number, default: 0 },
  tramosRR: [{
    operator: { type: String }, // '<' | '>' | 'Entre'
    desde:    { type: Number },
    hasta:    { type: Number },
    limit:    { type: Number },
    valor:    { type: Number },
    label:    { type: String }
  }],
  tramosAI: [{
    operator: { type: String },
    desde:    { type: Number },
    hasta:    { type: Number },
    limit:    { type: Number },
    valor:    { type: Number },
    label:    { type: String }
  }],

  // ─── BONO_FIJO ────────────────────────────────────────────────────────────
  bonoFijo: {
    monto:            { type: Number, default: 0 },
    frecuencia:       { type: String, enum: ['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO'], default: 'MENSUAL' },
    condiciones:      { type: String },
    proporcionalDias: { type: Boolean, default: false }
  },

  // ─── COMISION ────────────────────────────────────────────────────────────
  comision: {
    base:            { type: String, enum: ['MONTO_VENTA', 'UNIDADES', 'PRODUCCION', 'RECAUDACION'], default: 'MONTO_VENTA' },
    tipo:            { type: String, enum: ['PORCENTAJE', 'ESCALA'], default: 'PORCENTAJE' },
    porcentajePlano: { type: Number, default: 5 },
    tramos: [{
      desde: { type: Number },
      hasta: { type: mongoose.Schema.Types.Mixed },
      valor: { type: Number }
    }]
  },

  // ─── META_KPI ─────────────────────────────────────────────────────────────
  metaKpi: {
    metaBase: { type: Number, default: 100 },
    unidad:   { type: String, enum: ['PORCENTAJE', 'PUNTOS', 'UNIDADES', 'CLP'], default: 'PORCENTAJE' },
    tramos: [{
      desde: { type: Number },
      hasta: { type: mongoose.Schema.Types.Mixed },
      monto: { type: Number }
    }]
  },

  // ─── ESCALA_ANTIGUEDAD ────────────────────────────────────────────────────
  escalaAntiguedad: {
    tipoValor: { type: String, enum: ['MONTO_FIJO', 'PORCENTAJE_SUELDO'], default: 'MONTO_FIJO' },
    tramos: [{
      aniosDesde: { type: Number },
      aniosHasta: { type: mongoose.Schema.Types.Mixed },
      valor:      { type: Number }
    }]
  },

  // ─── GRATIFICACION_VOLUNTARIA ─────────────────────────────────────────────
  gratificacion: {
    tipoValor:  { type: String, enum: ['MONTO_FIJO', 'PORCENTAJE_SUELDO'], default: 'MONTO_FIJO' },
    valor:      { type: Number, default: 0 },
    base:       { type: String, enum: ['SUELDO_BASE', 'SUELDO_IMPONIBLE'], default: 'SUELDO_BASE' },
    frecuencia: { type: String, enum: ['MENSUAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'], default: 'MENSUAL' }
  },

  // ─── Legal ────────────────────────────────────────────────────────────────
  tipoBonoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'TipoBono' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModeloBonificacion', ModeloBonificacionSchema);
