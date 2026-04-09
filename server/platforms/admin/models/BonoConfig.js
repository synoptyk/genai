const mongoose = require('mongoose');

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   MAESTRO UNIFICADO DE BONIFICACIONES (v5.0)                         ║
 * ║   Fusión de TipoBono + ModeloBonificacion                            ║
 * ║   Diseñado para ser el motor más potente y flexible del mercado.    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const BonoConfigSchema = new mongoose.Schema({
  // ─── IDENTIFICACIÓN Y METADATOS ──────────────────────────────────────────
  nombre:      { type: String, required: true },
  description: { type: String },
  empresaRef:  { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
  activo:      { type: Boolean, default: true },
  color:       { type: String, default: '#6366f1' }, // Indigo default
  tags:        [{ type: String }],
  
  category: { 
    type: String, 
    enum: ['REMUNERACIÓN', 'INCENTIVO', 'REEMBOLSO', 'BONO_LEGAL', 'BIENESTAR', 'OTRO'],
    default: 'INCENTIVO'
  },

  // ─── CONFIGURACIÓN LEGAL Y PAYROLL (Anterior TipoBono) ──────────────────
  payroll: {
    codigoDT:         { type: String, required: true, default: '1040' },
    tipo:             { type: String, enum: ['IMPONIBLE', 'NO_IMPONIBLE'], required: true, default: 'IMPONIBLE' },
    frecuencia:       { type: String, enum: ['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'ÚNICO', 'PER_EVENTO'], default: 'MENSUAL' },
    pagoProporcional: { type: Boolean, default: true }, // Si se descuenta por inasistencias/licencias
    baseLegal:        { type: String },
    observacionDT:    { type: String },
    limiteReferencial: { type: Number }, // Para alertas de topes no imponibles
    avisoLegal:       { type: String }
  },

  // ─── ESTRATEGIA DE CÁLCULO (Anterior ModeloBonificacion) ────────────────
  strategy: {
    type: String,
    enum: [
      'FIJO', 
      'BAREMO_PUNTOS', 
      'COMISION', 
      'META_KPI', 
      'ESCALA_ANTIGÜEDAD', 
      'GRATIFICACION_VOLUNTARIA', 
      'FORMULA_PERSONALIZADA',
      'EVENTO_DISPARADOR'
    ],
    default: 'FIJO'
  },

  // Configuración dinámica según la estrategia seleccionada
  config: {
    // Para FIJO
    monto: { type: Number, default: 0 },
    
    // Para BAREMO_PUNTOS (Telco/TOA)
    tramosBaremos: [{
      desde: { type: Number },
      hasta: { type: mongoose.Schema.Types.Mixed }, // Number | 'Más'
      valor: { type: Number }
    }],
    puntosExcluidos: { type: Number, default: 0 },
    
    // Para Calidad / Auditorías (RR/AI)
    tramosCalidad: [{
      tipo:     { type: String, enum: ['RR', 'AI', 'AUDITORIA'] },
      operator: { type: String, enum: ['<', '>', '==', 'Entre'] },
      desde:    { type: Number },
      hasta:    { type: Number },
      limit:    { type: Number },
      valor:    { type: Number },
      label:    { type: String }
    }],

    // Para COMISION
    comision: {
      base:            { type: String, enum: ['MONTO_VENTA', 'UNIDADES', 'PRODUCCION', 'RECAUDACION'], default: 'MONTO_VENTA' },
      tipo:            { type: String, enum: ['PORCENTAJE', 'ESCALA'], default: 'PORCENTAJE' },
      porcentajePlano: { type: Number, default: 0 },
      tramos: [{
        desde: { type: Number },
        hasta: { type: mongoose.Schema.Types.Mixed },
        valor: { type: Number }
      }]
    },

    // Para META_KPI
    metaKpi: {
      metaBase: { type: Number, default: 100 },
      unidad:   { type: String, enum: ['PORCENTAJE', 'PUNTOS', 'UNIDADES', 'CLP'], default: 'PORCENTAJE' },
      tramos: [{
        desde: { type: Number },
        hasta: { type: mongoose.Schema.Types.Mixed },
        monto: { type: Number }
      }]
    },

    // Para ESCALA_ANTIGÜEDAD
    escalaAntiguedad: {
      tipoValor: { type: String, enum: ['MONTO_FIJO', 'PORCENTAJE_SUELDO'], default: 'MONTO_FIJO' },
      tramos: [{
        aniosDesde: { type: Number },
        aniosHasta: { type: mongoose.Schema.Types.Mixed },
        valor:      { type: Number }
      }]
    },

    // Para FORMULA_PERSONALIZADA (Power User)
    formula: {
      expression: { type: String }, // Ej: "(produccion * 0.1) + (asistencia === 100 ? 50000 : 0)"
      variables:  [{ type: String }] // Listado de variables requeridas
    }
  },

  // ─── APLICABILIDAD Y REGLAS DE NEGOCIO ──────────────────────────────────
  targeting: {
    todos:    { type: Boolean, default: true },
    cargos:   [{ type: String }],
    sectores: [{ type: String }],
    proyectos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Proyecto' }],
    contratos: [{ type: String, enum: ['INDEFINIDO', 'PLAZO_FIJO', 'POR_OBRA', 'PART_TIME'] }]
  },

  // ─── INTEGRACIÓN OPERACIONAL ───────────────────────────────────────────
  integration: {
    esModuloProduccion: { type: Boolean, default: false },
    source: { 
      type: String, 
      enum: ['TOA_BOT', 'GPS_BOT', 'SOLICITUD_MANUAL', 'IMPORTACION_EXCEL', 'SISTEMA_EXTERNO'],
      default: 'SOLICITUD_MANUAL'
    },
    autoAprobar: { type: Boolean, default: false }
  },

  // ─── VIGENCIA ──────────────────────────────────────────────────────────
  validity: {
    validFrom: { type: Date, default: Date.now },
    validTo:   { type: Date }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware para actualizar updatedAt
BonoConfigSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BonoConfig', BonoConfigSchema);
