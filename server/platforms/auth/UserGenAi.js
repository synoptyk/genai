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
            // Administración
            admin_resumen_ejecutivo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_modelos_bonificacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_proyectos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_conexiones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_aprobaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_sii: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Recursos Humanos
            rrhh_captura: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_documental: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_activos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_nomina: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_laborales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_vacaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_asistencia: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_turnos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Prevención HSE
            prev_ast: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_procedimientos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_charlas: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_inspecciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_acreditacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_accidentes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_iper: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_auditoria: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_dashboard: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prev_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Flota & GPS
            flota_vehiculos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            flota_gps: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Operaciones
            op_supervision: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_colaborador: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_portales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_dotacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_mapa_calor: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_designaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Rendimiento & Finanzas
            rend_operativo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rend_financiero: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rend_tarifario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            // Configuraciones
            cfg_baremos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_clientes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_empresa: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_personal: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
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
