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
    // Operaciones
    'op_supervision',
    'op_colaborador',
    'op_portales',
    'op_dotacion',
    'op_mapa_calor',
    'op_designaciones',
    // RRHH
    'rrhh_captura',
    'rrhh_documental',
    'rrhh_activos',
    'rrhh_nomina',
    'rrhh_laborales',
    'rrhh_vacaciones',
    'rrhh_asistencia',
    'rrhh_turnos',
    // Prevención
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
    'flota_gps',
    // Rendimiento
    'rend_operativo',
    'rend_financiero',
    'rend_tarifario',
    // Configuraciones
    'cfg_baremos',
    'cfg_clientes',
    'cfg_empresa',
    'cfg_personal'
];

const DEFAULT_OBJECT = { ver: false, crear: false, editar: false, suspender: false, eliminar: false };
const ADMIN_OBJECT = { ver: true, crear: true, editar: true, suspender: true, eliminar: true };

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
