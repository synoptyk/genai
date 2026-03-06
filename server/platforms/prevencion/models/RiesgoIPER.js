const mongoose = require('mongoose');

const RiesgoIPERSchema = new mongoose.Schema({
    peligro: { type: String, required: true },
    empresaRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true },
    riesgo: { type: String, required: true },
    consecuencia: { type: String },
    probabilidad: { type: Number, min: 1, max: 5 },
    severidad: { type: Number, min: 1, max: 5 },
    valoracion: { type: Number }, // P * S
    clasificacion: {
        type: String,
        enum: ['Bajo', 'Medio', 'Alto', 'Crítico']
    },
    medidasControl: [{ type: String }],
    activo: { type: Boolean, default: true }
}, { timestamps: true });

// Pre-save to calculate valoracion and clasificacion
RiesgoIPERSchema.pre('save', function (next) {
    if (this.probabilidad && this.severidad) {
        this.valoracion = this.probabilidad * this.severidad;
        if (this.valoracion <= 5) this.clasificacion = 'Bajo';
        else if (this.valoracion <= 10) this.clasificacion = 'Medio';
        else if (this.valoracion <= 16) this.clasificacion = 'Alto';
        else this.clasificacion = 'Crítico';
    }
    next();
});

module.exports = mongoose.model('RiesgoIPER', RiesgoIPERSchema);
