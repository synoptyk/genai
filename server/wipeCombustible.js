const mongoose = require('mongoose');
const ConsumoCombustible = require('./platforms/agentetelecom/models/ConsumoCombustible');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function wipe() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado a MongoDB');
        const result = await ConsumoCombustible.deleteMany({});
        console.log(`🗑️ Eliminados ${result.deletedCount} registros de ConsumoCombustible`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        mongoose.disconnect();
    }
}

wipe();
