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

    // Bóveda Criptográfica - Integración Servicios de Impuestos Internos (SII Chile)
    integracionSII: {
        rpaActivo: { type: Boolean, default: false },
        rutEmpresa: { type: String, trim: true },
        rutAutorizado: { type: String, trim: true },
        claveTributaria: { type: String }, // Guardada SIEMPRE cifrada AES-256
        certificadoDigitalPath: { type: String }, // Ruta del Servidor local a archivo secreto .pfx
        certificadoPassword: { type: String }, // Guardada SIEMPRE cifrada AES-256
        ultimaSincronizacion: Date,
        estadoSincronizacion: {
            type: String,
            enum: ['Ok', 'Error', 'Pendiente'],
            default: 'Pendiente'
        }
    },
    // Bóveda Criptográfica - Integración Previred (Remuneraciones Chile)
    integracionPrevired: {
        rpaActivo: { type: Boolean, default: false },
        rutEmpresa: { type: String, trim: true },
        rutAutorizado: { type: String, trim: true },
        clavePrevired: { type: String }, // Guardada SIEMPRE cifrada AES-256
        ultimaSincronizacion: Date,
        estadoSincronizacion: {
            type: String,
            default: 'Sin configurar'
        }
    },
    // Bóveda Criptográfica - Integración TOA (Oracle Field Service)
    integracionTOA: {
        usuario: { type: String, trim: true },
        clave: { type: String }, // Guardada SIEMPRE cifrada AES-256
        ultimaSincronizacion: Date,
        estadoSincronizacion: {
            type: String,
            default: 'Sin configurar'
        }
    },

    // Permisos Granulares de la Empresa (Techo Máximo para sus usuarios)
    permisosModulos: {
        type: Map,
        of: Object,
        default: {
            // 1. Administración
            admin_resumen_ejecutivo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_modelos_bonificacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_proyectos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_conexiones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_aprobaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_sii: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            admin_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 2. Recursos Humanos
            rrhh_captura: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_documental: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_activos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_nomina: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_laborales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_vacaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_asistencia: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rrhh_turnos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 3. Prevención HSE
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

            // 4. Flota & GPS
            flota_vehiculos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            flota_gps: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 5. Operaciones
            op_supervision: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_colaborador: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_portales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_dotacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_mapa_calor: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            op_designaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 6. Rendimiento Productivo
            rend_operativo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rend_financiero: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            rend_tarifario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 7. Configuraciones
            cfg_baremos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_clientes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_empresa: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            cfg_personal: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

            // 8. Logística 360
            logistica_dashboard: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            logistica_inventario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            logistica_almacenes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            logistica_movimientos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            logistica_despachos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
        }
    },
    estado: {
        type: String,
        enum: ['Activo', 'Inactivo', 'Suspendido'],
        default: 'Activo'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Empresa', empresaSchema);
