require('dotenv').config();
const mongoose = require('mongoose');
const ModeloBonificacion = require('./platforms/admin/models/ModeloBonificacion');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const model = await ModeloBonificacion.findOne({ estado: 'ACTIVO', tipo: 'BAREMO_PUNTOS' }).lean();
    if (model) {
        console.log("tramosRR:", JSON.stringify(model.tramosRR, null, 2));
        console.log("tramosAI:", JSON.stringify(model.tramosAI, null, 2));
    } else {
        console.log("No active model found");
    }
    process.exit(0);
}
run().catch(console.error);
