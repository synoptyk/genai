const mongoose = require('mongoose');

const CategoriaSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, unique: true }, // CAT-XXXX
    descripcion: { type: String, trim: true },
    icono: { type: String, default: 'Tags' },
    imagenUrl: { type: String, trim: true },
    
    // Clasificación solicitada
    prioridadValor: { 
        type: String, 
        enum: ['Alto Valor', 'Bajo Valor'], 
        default: 'Bajo Valor' 
    },
    tipoRotacion: { 
        type: String, 
        enum: ['Rotativo', 'Estático'], 
        default: 'Rotativo' 
    },
    
    // Multi-tenancy
    empresaRef: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Empresa', 
        required: true 
    },
    
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' }
}, { timestamps: true });

// Único nombre por empresa
CategoriaSchema.index({ nombre: 1, empresaRef: 1 }, { unique: true });

CategoriaSchema.pre('save', async function(next) {
    if (!this.codigo) {
        const count = await this.constructor.countDocuments({ empresaRef: this.empresaRef });
        this.codigo = `CAT-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Categoria', CategoriaSchema);
