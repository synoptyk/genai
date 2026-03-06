const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserGenAiSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },

    // Rol: ceo_genai = super admin, admin = admin empresa, user = usuario normal
    role: {
        type: String,
        enum: ['ceo_genai', 'admin', 'administrativo', 'supervisor_hse', 'user'],
        default: 'user'
    },

    // Multi-empresa (Migración hacia referencia `Empresa`)
    empresaRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Empresa'
    },
    empresa: {
        nombre: { type: String, required: true },
        rut: { type: String },
        logo: { type: String },
        plan: { type: String, enum: ['starter', 'pro', 'enterprise'], default: 'starter' }
    },

    // Permisos Granulares por Módulo
    permisosModulos: {
        type: Map,
        of: Object,
        default: {
            rrhh_colaboradores: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_reclutamiento: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_ficha: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_remuneraciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_portales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_ast: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_kpis: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_incidentes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_capacitaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            operaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            agentetelecom_tarifario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            agentetelecom_gps: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            agentetelecom_despachos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            agentetelecom_mantencion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            comercial_cotizador: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            comercial_crm: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            finanzas_facturacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
        }
    },

    // Metadata
    rut: { type: String },
    cargo: { type: String },
    avatar: { type: String },
    telefono: { type: String },
    status: { type: String, enum: ['Activo', 'Inactivo', 'Suspendido'], default: 'Activo' },

    // Sesión única (anti-sharing)
    tokenVersion: { type: Number, default: 0 },

    // Reset password
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    ultimoAcceso: { type: Date },
    loginHistory: [{
        fecha: { type: Date, default: Date.now },
        ip: { type: String },
        userAgent: { type: String }
    }]
}, { timestamps: true });

// Hash password before save
UserGenAiSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match password method
UserGenAiSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('UserGenAi', UserGenAiSchema);
