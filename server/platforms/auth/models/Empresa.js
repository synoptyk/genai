const mongoose = require('mongoose');

const empresaSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: [true, 'El nombre de la empresa es obligatorio'],
        unique: true,
        trim: true
    },
    slug: {
        type: String,
        unique: true,
        trim: true
    },
    rut: {
        type: String,
        trim: true
    },
    giroComercial: String,
    direccion: String,
    telefono: String,
    email: String,
    web: String,
    pais: { type: String, default: 'CL' },
    industria: String,
    logo: String,

    // Representantes Legales
    representantesLegales: [{
        rut: String,
        nombre: String,
        email: String,
        telefono: String
    }],

    // Contactos Comerciales
    contactosComerciales: [{
        nombre: String,
        email: String,
        telefono: String
    }],

    // Detalles del Contrato
    fechaInicioContrato: Date,
    duracionMeses: Number,
    fechaTerminoContrato: Date,
    limiteUsuarios: { type: Number, default: 5 },
    valorUsuarioUF: Number,
    totalMensualUF: Number,
    modoServicio: {
        type: String,
        enum: ['FULL_HR_360', 'RECRUITMENT_ONLY'],
        default: 'FULL_HR_360'
    },

    plan: {
        type: String,
        enum: ['starter', 'pro', 'enterprise'],
        default: 'starter'
    },
    modulosActivos: [{
        type: String,
        enum: ['rrhh', 'prevencion', 'operaciones', 'comercial', 'agentetelecom', 'finanzas']
    }],
    estado: {
        type: String,
        enum: ['Activo', 'Inactivo', 'Suspendido'],
        default: 'Activo'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Empresa', empresaSchema);
