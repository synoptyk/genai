const mongoose = require('mongoose');

const ProductoSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    ean: { type: String, trim: true },
    categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Categoria' },
    marca: { type: String, trim: true },
    modelo: { type: String, trim: true },
    descripcion: { type: String, trim: true },
    unidadMedida: { type: String, default: 'Unidad' },
    icono: { type: String, default: 'Archive' },
    tipo: { type: String, enum: ['Activo', 'Suministro'], default: 'Suministro' },
    trackSerial: { type: Boolean, default: false }, // Indicar si requiere registro de S/N
    
    // Segmentación y Estado
    segmentacion: { type: String, enum: ['Crítico', 'Estándar', 'Consumo'], default: 'Estándar' },
    estadoDetallado: { type: String, enum: ['Nuevo', 'Usado Reacondicionado', 'Para Reparar', 'Baja'], default: 'Nuevo' },

    // Propiedad
    propiedad: { type: String, enum: ['Propio', 'Cliente'], default: 'Propio' },
    clienteRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' },

    // Características de Activos
    movilidad: { type: String, enum: ['Rotativo', 'Estático'], default: 'Rotativo' },
    valorUnitario: { type: Number, default: 0 }, // Valor de adquisición
    fotos: [{ type: String }], // URLs de imágenes del producto
    
    // Depreciación Automática
    fechaAdquisicion: { type: Date, default: Date.now },
    vidaUtilMeses: { type: Number, default: 60 }, // Ejemplo: 5 años por defecto
    valorResidual: { type: Number, default: 0 }, // Valor al final de la depreciación

    // Control de Stock
    stockMinimo: { type: Number, default: 0 },
    stockActual: { type: Number, default: 0 },
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual para calcular depreciación acumulada (Línea Recta)
ProductoSchema.virtual('depreciacionAcumulada').get(function() {
    if (this.tipo !== 'Activo' || !this.valorUnitario || this.valorUnitario <= this.valorResidual) return 0;
    
    const hoy = new Date();
    const mesesTranscurridos = (hoy.getFullYear() - this.fechaAdquisicion.getFullYear()) * 12 + (hoy.getMonth() - this.fechaAdquisicion.getMonth());
    
    if (mesesTranscurridos <= 0) return 0;
    if (mesesTranscurridos >= this.vidaUtilMeses) return this.valorUnitario - this.valorResidual;
    
    const depreciacionMensual = (this.valorUnitario - this.valorResidual) / this.vidaUtilMeses;
    return Math.round(depreciacionMensual * mesesTranscurridos);
});

ProductoSchema.virtual('valorLibroActual').get(function() {
    return this.valorUnitario - this.depreciacionAcumulada;
});

// Índice para búsqueda rápida por SKU dentro de la misma empresa
ProductoSchema.index({ sku: 1, empresaRef: 1 }, { unique: true });

ProductoSchema.pre('save', async function(next) {
    if (!this.sku) {
        // Generar SKU automático: PRD-XXXX
        const count = await this.constructor.countDocuments({ empresaRef: this.empresaRef });
        this.sku = `PRD-${(count + 1).toString().padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Producto', ProductoSchema);
