const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

async function run() {
    await mongoose.connect(MONGO_URI);
    const Actividad = require('./platforms/agentetelecom/models/Actividad');

    // Find the 5 most recently created/updated activities
    const docs = await Actividad.find()
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

    console.log(`Found ${docs.length} most recent documents:`);
    docs.forEach((d, idx) => {
        console.log(`\nDocument ${idx + 1}:`);
        console.log(`  _id: ${d._id}`);
        console.log(`  updatedAt: ${d.updatedAt}`);
        console.log(`  ordenId: ${d.ordenId}`);
        console.log(`  Número de Petición: ${d['Número de Petición'] || d['Número_de_Petición'] || d['peticion']}`);
        console.log(`  Numero orden: ${d['Numero orden'] || d['Número orden']}`);
        console.log(`  RUT del cliente: ${d['RUT del cliente'] || d['RUT_del_cliente']}`);
        console.log(`  Direccion: ${d['Direccion'] || d['Dirección']}`);
        console.log(`  Nombre Contacto: ${d['Nombre Contacto'] || d['Nombre_Contacto'] || d['Nombre']}`);
        
        // Print all keys that are present in the document
        console.log("  All keys present in this doc:");
        const keys = Object.keys(d).filter(k => d[k] !== undefined && d[k] !== null && d[k] !== '');
        console.log("    " + keys.join(", "));
    });

    await mongoose.disconnect();
}

run().catch(console.error);
