const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../platforms/auth/UserGenAi');

const NEW_PERMISSIONS = [
    'admin_resumen_ejecutivo',
    'admin_modelos_bonificacion',
    'op_dotacion',
    'op_mapa_calor',
    'op_designaciones'
];

const DEFAULT_OBJECT = { ver: false, crear: false, editar: false, suspender: false, eliminar: false };
const ADMIN_OBJECT = { ver: true, crear: true, editar: true, suspender: true, eliminar: true };

async function migrate() {
    try {
        console.log('--- Iniciando migración de permisos ---');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Conectado a MongoDB');

        const users = await User.find({});
        console.log(`Encontrados ${users.length} usuarios.`);

        let updatedCount = 0;
        for (const user of users) {
            let modified = false;
            
            // Si el objeto permisosModulos no existe, inicializarlo (aunque el schema tiene default)
            if (!user.permisosModulos) {
                user.permisosModulos = new Map();
                modified = true;
            }

            for (const key of NEW_PERMISSIONS) {
                if (!user.permisosModulos.has(key)) {
                    // Si es admin o ceo, le damos permiso por defecto para que no pierda acceso a lo nuevo
                    const value = (user.role === 'admin' || user.role === 'ceo_genai' || user.role === 'ceo') 
                        ? { ...ADMIN_OBJECT } 
                        : { ...DEFAULT_OBJECT };
                    
                    user.permisosModulos.set(key, value);
                    modified = true;
                }
            }

            if (modified) {
                // Forzar mongoose a detectar cambios en el Map
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
