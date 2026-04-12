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
        url:     { type: String, trim: true, default: 'https://telefonica-cl.etadirect.com/' },
        usuario: { type: String, trim: true },
        clave:   { type: String }, // Guardada SIEMPRE cifrada AES-256
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
            admin_resumen_ejecutivo: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_modelos_bonificacion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_proyectos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_conexiones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_aprobaciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_sii: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_historial: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_previred: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_pagos_bancarios: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_dashboard_tributario: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_aprobaciones_compras: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_gestion_portales: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_mis_clientes: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_gestion_gastos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_config_notificaciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            admin_tipos_bono: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 2. Recursos Humanos
            rrhh_captura: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_documental: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_activos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_nomina: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_laborales: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_vacaciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_asistencia: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_turnos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_seguridad_ppe: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_contratos_anexos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_finiquitos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rrhh_historial: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 3. Prevención HSE
            prev_ast: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_procedimientos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_charlas: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_inspecciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_acreditacion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_accidentes: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_iper: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_auditoria: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_dashboard: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            prev_historial: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 4. Flota & GPS
            flota_vehiculos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            flota_gps: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            dist_conecta_gps: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            dist_mis_conductores: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 5. Operaciones
            op_supervision: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_colaborador: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_portales: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_dotacion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_mapa_calor: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_designaciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            op_gastos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 6. Rendimiento Productivo
            rend_operativo: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rend_cierre_bonos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rend_financiero: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rend_tarifario: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rend_config_lpu: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            rend_descarga_toa: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_mineria: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_energia: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_construccion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_transporte: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_manufactura: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_agricola: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ind_pesquero: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 7. Configuraciones
            cfg_baremos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            cfg_clientes: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            cfg_empresa: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            cfg_personal: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 8. Logística 360
            logistica_dashboard: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_configuracion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_inventario: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_compras: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_proveedores: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_almacenes: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_movimientos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_despachos: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_historial: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            logistica_auditorias: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 9. Comunicaciones & Social
            social_chat: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            comunic_video: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },

            // 10. Empresa 360
            emp360_facturacion: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            emp360_tesoreria: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            emp360_biometria: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            emp360_beneficios: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            emp360_lms: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            emp360_evaluaciones: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
            ai_asistente: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false }
        }
    },
    estado: {
        type: String,
        enum: ['Activo', 'Inactivo', 'Suspendido'],
        default: 'Activo'
    },
    configuracionNotificaciones: {
        type: Map,
        of: new mongoose.Schema({
            activo: { type: Boolean, default: true },
            horario: { type: String, default: '23:00' },
            diaSemana: { type: Number, default: 0 },
            diaMes: { type: Number, default: 1 },
            soloDiasHabiles: { type: Boolean, default: false },
            titulo: { type: String, default: 'Notificación del Sistema' },
            subtitulo: { type: String, default: 'Gestión Corporativa' },
            cuerpo: { type: String, default: 'Se ha generado una nueva notificación para su revisión.' },
            asunto: { type: String, default:'' },
            copia: { type: String, default: '' }, // CC (emails separados por coma)
            destinatariosExtra: [String],
            imagenCuerpo: {
                url: { type: String, default: '' },
                width: { type: Number, default: 200 },
                align: { type: String, enum: ['left', 'center', 'right'], default: 'center' }
            }
        }, { _id: false }),
        default: {
            diario: { horario: '23:50', titulo: 'Reporte Ejecutivo Diario', subtitulo: 'Consolidado de Gestión Corporativa' },
            semanal: { horario: '23:55', diaSemana: 0, titulo: 'Reporte Ejecutivo Semanal', subtitulo: 'Resumen de Gestión Semanal' },
            mensual: { horario: '23:59', diaMes: 1, titulo: 'Reporte Ejecutivo Mensual', subtitulo: 'Balance Mensual de Operaciones' },
            aprobaciones_compras: { titulo: 'Aprobación de Compra', subtitulo: 'Requerimiento de Suministros', asunto: '🛒 [GENAI360] Nueva Aprobación de Compra' },
            rrhh_solicitudes: { titulo: 'Solicitud de Personal', subtitulo: 'Gestión de RRHH', asunto: '👥 [GENAI360] Nueva Solicitud de Personal' }
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Empresa', empresaSchema);
