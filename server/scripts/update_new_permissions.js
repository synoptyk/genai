const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../platforms/auth/PlatformUser');

const ALL_PERMISSION_KEYS = [
    // Administración
    'admin_resumen_ejecutivo',
    'admin_modelos_bonificacion',
    'admin_proyectos',
    'admin_conexiones',
    'admin_aprobaciones',
    'admin_sii',
    'admin_historial',
    'admin_previred',
    'admin_pagos_bancarios',
    'admin_dashboard_tributario',
    'admin_aprobaciones_compras',
    'admin_gestion_portales',
    'admin_mis_clientes',
    'admin_gestion_gastos',
    'admin_config_notificaciones',
    'admin_tipos_bono',

    // Recursos Humanos
    'rrhh_captura',
    'rrhh_documental',
    'rrhh_activos',
    'rrhh_nomina',
    'rrhh_laborales',
    'rrhh_vacaciones',
    'rrhh_asistencia',
    'rrhh_turnos',
    'rrhh_seguridad_ppe',
    'rrhh_contratos_anexos',
    'rrhh_finiquitos',
    'rrhh_historial',

    // Prevención HSE
    'prev_ast',
    'prev_procedimientos',
    'prev_charlas',
    'prev_inspecciones',
    'prev_acreditacion',
    'prev_accidentes',
    'prev_iper',
    'prev_auditoria',
    'prev_dashboard',
    'prev_historial',

    // Flota & GPS
    'flota_vehiculos',
    'flota_eficiencia',
    'flota_gps',
    'dist_conecta_gps',
    'dist_mis_conductores',
    'dist_historial_rutas',
    'dist_rutas_guiadas',

    // Operaciones
    'op_supervision',
    'op_colaborador',
    'op_portales',
    'op_dotacion',
    'op_mapa_calor',
    'op_designaciones',
    'op_gastos',

    // Rendimiento & Finanzas
    'rend_operativo',
    'rend_cierre_bonos',
    'rend_financiero',
    'rend_tarifario',
    'rend_config_lpu',
    'rend_descarga_toa',
    'ind_mineria',
    'ind_energia',
    'ind_construccion',
    'ind_transporte',
    'ind_manufactura',
    'ind_agricola',
    'ind_pesquero',

    // Logística 360
    'logistica_dashboard',
    'logistica_configuracion',
    'logistica_inventario',
    'logistica_compras',
    'logistica_proveedores',
    'logistica_almacenes',
    'logistica_movimientos',
    'logistica_despachos',
    'logistica_historial',
    'logistica_auditorias',

    // Configuraciones & Social
    'social_chat',
    'comunic_video',
    'emp360_facturacion',
    'emp360_tesoreria',
    'emp360_biometria',
    'emp360_beneficios',
    'emp360_lms',
    'emp360_evaluaciones',
    'ai_asistente',
    'cfg_baremos',
    'cfg_clientes',
    'cfg_empresa',
    'cfg_personal'
];

const DEFAULT_OBJECT = { ver: false, crear: false, editar: false, suspender: false, bloquear: false, eliminar: false };
const ADMIN_OBJECT = { ver: true, crear: true, editar: true, suspender: true, bloquear: true, eliminar: true };

async function migrate() {
    try {
        console.log('--- Iniciando migración masiva de permisos ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB');

        const users = await User.find({});
        console.log(`Encontrados ${users.length} usuarios.`);

        let updatedCount = 0;
        for (const user of users) {
            let modified = false;
            
            if (!user.permisosModulos) {
                user.permisosModulos = new Map();
                modified = true;
            }

            for (const key of ALL_PERMISSION_KEYS) {
                if (!user.permisosModulos.has(key)) {
                    // Si es admin o ceo, le damos permiso total por defecto en las nuevas llaves
                    const value = (user.role === 'admin' || user.role === 'system_admin' || user.role === 'ceo') 
                        ? { ...ADMIN_OBJECT } 
                        : { ...DEFAULT_OBJECT };
                    
                    user.permisosModulos.set(key, value);
                    modified = true;
                }
            }

            if (modified) {
                user.markModified('permisosModulos');
                await user.save();
                updatedCount++;
            }
        }

        console.log(`Migración completada. ${updatedCount} usuarios actualizados.`);
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

migrate();
