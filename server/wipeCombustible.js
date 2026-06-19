const mongoose = require('mongoose');
const ConsumoCombustible = require('./platforms/agentetelecom/models/ConsumoCombustible');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

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
