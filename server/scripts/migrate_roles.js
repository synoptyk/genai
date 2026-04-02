/**
 * SCRIPT: Migración Final de Roles de Usuario
 * Convierte todos los 'ceo_genai' a 'system_admin' para completar la neutralización del platform.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PlatformUser = require('../platforms/auth/PlatformUser');

const migrate = async () => {
    try {
        console.log('⏳ Conectando a la base de datos...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conexión establecida.');

        const legacyRole = 'ceo_genai';
        const newRole = 'system_admin';

        const count = await PlatformUser.countDocuments({ role: legacyRole });
        if (count === 0) {
            console.log(`ℹ️ No se encontraron usuarios con el rol '${legacyRole}'.`);
        } else {
            console.log(`🔍 Encontrados ${count} usuarios con el rol '${legacyRole}'. Actualizando...`);
            const result = await PlatformUser.updateMany(
                { role: legacyRole },
                { $set: { role: newRole } }
            );
            console.log(`✅ ${result.modifiedCount} usuarios actualizados de '${legacyRole}' a '${newRole}'.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error catastrófico en la migración:', error.message);
        process.exit(1);
    }
};

migrate();
