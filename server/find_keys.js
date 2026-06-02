const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true";

async function run() {
    await mongoose.connect(MONGO_URI);
    const Actividad = require('./platforms/agentetelecom/models/Actividad');
    const acts = await Actividad.find({ empresaRef: "69ab8a37d7239b0dd12383d1" }).limit(50).lean();
    
    const keys = new Set();
    acts.forEach(a => {
        Object.keys(a).forEach(k => keys.add(k));
    });

    const keyList = [...keys];
    console.log("Keys containing 'direc':", keyList.filter(k => k.toLowerCase().includes('direc')));
    console.log("Keys containing 'comu':", keyList.filter(k => k.toLowerCase().includes('comu')));
    console.log("Keys containing 'nomb':", keyList.filter(k => k.toLowerCase().includes('nomb')));
    console.log("Keys containing 'clie':", keyList.filter(k => k.toLowerCase().includes('clie')));
    console.log("Keys containing 'tipo':", keyList.filter(k => k.toLowerCase().includes('tipo')));
    console.log("Keys containing 'subt':", keyList.filter(k => k.toLowerCase().includes('subt')));
    console.log("Keys containing 'rut':", keyList.filter(k => k.toLowerCase().includes('rut')));

    await mongoose.disconnect();
}

run().catch(console.error);
