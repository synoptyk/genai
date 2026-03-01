/**
 * SCRIPT: Crear usuario CEO Gen AI en la base de datos.
 * Uso: node server/platforms/auth/seedCeo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const UserGenAi = require('./UserGenAi');

const CEO_DATA = {
    name: 'Mauricio Barrientos',
    email: 'ceo@genai.cl',
    password: 'GenAI2026*CEO',
    role: 'ceo_genai',
    cargo: 'CEO & Fundador',
    status: 'Activo',
    empresa: {
        nombre: 'Empresa Synoptyk',
        rut: '76.000.000-1',
        plan: 'enterprise'
    }
};

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Conectado a MongoDB');

        const exists = await UserGenAi.findOne({ email: CEO_DATA.email });
        if (exists) {
            console.log('⚠️  El usuario CEO ya existe:', CEO_DATA.email);
            console.log('   Para resetear la contraseña, elimínelo manualmente de la DB.');
        } else {
            await UserGenAi.create({ ...CEO_DATA, tokenVersion: 1 });
            console.log('🚀 Usuario CEO creado exitosamente:');
            console.log('   Email:', CEO_DATA.email);
            console.log('   Password:', CEO_DATA.password);
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
