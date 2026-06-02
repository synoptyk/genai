const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true";

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    const Actividad = require('./platforms/agentetelecom/models/Actividad');
    const act = await Actividad.findOne({ empresaRef: "69ab8a37d7239b0dd12383d1" });
    if (!act) {
        console.log("❌ No activity found.");
    } else {
        console.log("Found activity keys & sample values:");
        const obj = act.toObject();
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v !== 'object' || v === null) {
                console.log(`  ${k}: ${v}`);
            } else {
                console.log(`  ${k}: [Object/Array]`);
            }
        }
    }

    await mongoose.disconnect();
}

run().catch(console.error);
