/**
 * SCRIPT: Crear usuario Administrador del Sistema en la base de datos.
 * Uso: node server/platforms/auth/seedCeo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const PlatformUser = require('./PlatformUser');

const CEO_DATA = {
    name: 'Mauricio Barrientos',
    email: process.env.CEO_EMAIL || 'admin@platform-os.cl',
    password: process.env.CEO_PASSWORD,
    role: 'system_admin',
    cargo: 'CEO & Fundador',
    status: 'Activo',
    empresa: {
        nombre: 'Platform Hub',
        rut: '76.000.000-1',
        plan: 'enterprise'
    }
};

async function seed() {
    if (!CEO_DATA.password) {
        console.error('❌ ERROR: CEO_PASSWORD no definida en el entorno. No se puede crear el usuario CEO.');
        process.exit(1);
        return;
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        const exists = await PlatformUser.findOne({ email: CEO_DATA.email });
        if (exists) {
            console.log('⚠️  El usuario CEO ya existe:', CEO_DATA.email);
            console.log('   Para resetear la contraseña, elimínelo manualmente de la DB.');
        } else {
            await PlatformUser.create({ ...CEO_DATA, tokenVersion: 1 });
            console.log('🚀 Usuario CEO creado exitosamente:');
            console.log('   Email:', CEO_DATA.email);
            console.log('   Password: [hidden]');
            console.log('   ⚠️  CAMBIA LA CONTRASEÑA EN PRODUCCIÓN');
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seed();
