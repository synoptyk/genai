const mongoose = require('mongoose');

const CargoEquipamientoSchema = new mongoose.Schema({
    cargo: { 
        type: String, 
        required: true, 
        trim: true 
    },
    nombreTipoCargo: {
        type: String,
        required: true,
        trim: true,
        default: function() {
            return this.cargo || "Técnico General";
        }
    },
    
    // Equipamiento predeterminado
    items: [{
        productoRef: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Producto', 
            required: true 
        },
        cantidad: { 
            type: Number, 
            required: true, 
            default: 1 
        },
        estadoProducto: { 
            type: String, 
            enum: ['Nuevo', 'Usado Bueno', 'Usado Malo', 'Merma'], 
            default: 'Nuevo' 
        }
    }],
    
    // Multi-tenancy (Aislamiento de Empresa)
    empresaRef: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Empresa', 
        required: true 
    },
    
    status: { 
        type: String, 
        enum: ['Activo', 'Inactivo'], 
        default: 'Activo' 
    }
}, { timestamps: true });

// Garantizar un único registro de tipo de cargo por empresa
CargoEquipamientoSchema.index({ nombreTipoCargo: 1, empresaRef: 1 }, { unique: true });

module.exports = mongoose.model('CargoEquipamiento', CargoEquipamientoSchema);
