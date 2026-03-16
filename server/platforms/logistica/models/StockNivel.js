const mongoose = require('mongoose');

const StockNivelSchema = new mongoose.Schema({
    productoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
    almacenRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Almacen', required: true },
    cantidadNuevo: { type: Number, default: 0 },
    cantidadUsadoBueno: { type: Number, default: 0 },
    cantidadUsadoMalo: { type: Number, default: 0 },
    cantidadMerma: { type: Number, default: 0 },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
}, { timestamps: true });

// Unicidad: un producto solo tiene un registro de nivel por almacén
StockNivelSchema.index({ productoRef: 1, almacenRef: 1 }, { unique: true });

module.exports = mongoose.model('StockNivel', StockNivelSchema);
