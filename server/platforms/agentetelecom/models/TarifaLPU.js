const mongoose = require('mongoose');

// =============================================================================
// TARIFA LPU — Lista de Precios Unitarios por empresa
// Cada empresa configura su propia tabla de puntos baremos.
// Se usa para calcular automáticamente los puntos de cada orden TOA.
// =============================================================================

const TarifaLPUSchema = new mongoose.Schema({
  empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },

  // Identificación
  codigo: { type: String, required: true },           // Ej: "520012", "540056", "570010"
  descripcion: { type: String, required: true },       // Ej: "Alta Banda Ancha"
  observacion: { type: String, default: '' },          // Nota aclaratoria para el usuario

  // Clasificación
  grupo: { type: String, required: true },             // Ej: "BANDA ANCHA", "TELEVISION", "INSTALACIONES MULTIPRODUCTO", etc.
  categoria: { type: String, default: 'ATENCION AL CLIENTE' }, // Ej: "ATENCION AL CLIENTE", "RESOLUCIÓN DE AVERÍAS"

  // Valor
  puntos: { type: Number, required: true },            // Puntos baremos (ej: 1.5, 0.25, 2.13)
  precio: { type: Number, default: 0 },               // Precio en moneda local (opcional)
  moneda: { type: String, default: 'CLP' },

  // Mapeo automático — criterios para vincular con órdenes TOA
  mapeo: {
    tipo_trabajo_pattern: { type: String, default: '' },    // Regex o valor para Tipo_Trabajo (ej: "At--------")
    subtipo_actividad: { type: String, default: '' },       // Valor de Subtipo_de_Actividad (ej: "Alta")
    familia_producto: { type: String, default: '' },        // FIB, IPTV, TOIP, EQ
    es_equipo_adicional: { type: Boolean, default: false }, // true = se suma por cantidad (decos, repetidores)
    campo_cantidad: { type: String, default: '' },          // Qué campo del XML contar (ej: "Decos_Adicionales", "Repetidores_WiFi")
    requiere_reutilizacion_drop: { type: String, default: '' }, // "SI", "NO", "" (vacío = no aplica)
    con_preco: { type: String, default: '' },               // "SI", "NO", "" (vacío = no aplica)
    condicion_extra: { type: String, default: '' },         // Condición adicional en texto libre
  },

  // Control
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },                // Para ordenar en la UI
}, {
  timestamps: true
});

// Índice único por código + empresa
TarifaLPUSchema.index({ codigo: 1, empresaRef: 1 }, { unique: true });
// Índice para búsquedas rápidas
TarifaLPUSchema.index({ empresaRef: 1, grupo: 1, activo: 1 });

module.exports = mongoose.model('TarifaLPU', TarifaLPUSchema);
