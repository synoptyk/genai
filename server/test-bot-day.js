const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2];
        }
    });
}

// Usar credenciales reales
if (!process.env.BOT_TOA_USER && process.env.TOA_USER_REAL) {
    process.env.BOT_TOA_USER = process.env.TOA_USER_REAL;
}
if (!process.env.BOT_TOA_PASS && process.env.TOA_PASS_REAL) {
    process.env.BOT_TOA_PASS = process.env.TOA_PASS_REAL;
}

const mongoose = require('mongoose');
const { iniciarExtraccion } = require('./platforms/agentetelecom/bot/agente_real');

async function runTest() {
    try {
        const hoy = new Date();
        const viernes = new Date(hoy);
        // Retroceder hasta encontrar un viernes
        while (viernes.getUTCDay() !== 5) {
            viernes.setUTCDate(viernes.getUTCDate() - 1);
        }
        const fechaTest = viernes.toISOString().split('T')[0];

        console.log('\n🚀 PRUEBA BOT TOA');
        console.log(`📅 Fecha de prueba: ${fechaTest} (${['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'][viernes.getUTCDay()]})\n`);

        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000
        });
        console.log('✅ MongoDB conectado\n');

        await iniciarExtraccion(fechaTest);
        
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        process.exit(0);
    }
}

runTest();
