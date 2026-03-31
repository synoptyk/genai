const mongoose = require('mongoose');

const AlmacenSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, trim: true }, // Ej: ALM-01
    ubicacion: {
        direccion: { type: String },
        comuna: { type: String },
        coordenadas: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },
    tipo: { type: String, enum: ['Central', 'Sucursal', 'Móvil', 'Técnico', 'Sub-Bodega'], default: 'Central' },
    parentAlmacen: { type: mongoose.Schema.Types.ObjectId, ref: 'Almacen' }, 
    capacidadMaxima: { type: Number },
    
    // Propiedad y Segmentación
    propiedad: { type: String, enum: ['Propio', 'Cliente'], default: 'Propio' },
    clienteRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }, // De qué cliente es esta bodega si no es propia
    
    // Multi-tenancy
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    
    encargado: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformUser' },
    tecnicoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Tecnico' },
    status: { type: String, enum: ['Activo', 'Inactivo'], default: 'Activo' }
}, { timestamps: true });

AlmacenSchema.pre('save', async function(next) {
    if (!this.codigo) {
        const count = await this.constructor.countDocuments({ empresaRef: this.empresaRef });
        const prefix = this.tipo === 'Móvil' ? 'FUR' : this.tipo === 'Técnico' ? 'TEC' : 'BOD';
        this.codigo = `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Almacen', AlmacenSchema);
