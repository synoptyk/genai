require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    const Actividad = db.collection('actividads');

    const fechaInicio = new Date('2026-05-08T00:00:00Z');
    const fechaFin = new Date('2026-05-10T23:59:59Z'); 

    const query = {
        fecha: { $gte: fechaInicio, $lte: fechaFin }
    };

    const count = await Actividad.countDocuments(query);
    console.log(`📊 Encontradas ${count} actividades para los días 8 y 9 de Mayo.`);

    if (count > 0) {
        const res = await Actividad.deleteMany(query);
        console.log(`🗑️ Se han eliminado ${res.deletedCount} actividades duplicadas/corruptas.`);
    } else {
        console.log('No hay actividades para borrar.');
    }

    console.log('✅ PROCESO COMPLETADO');
    await mongoose.disconnect();
}

run().catch(console.error);
