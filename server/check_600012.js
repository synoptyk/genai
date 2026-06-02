require('dotenv').config();
const mongoose = require('mongoose');
const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const tarifas = await TarifaLPU.find({ codigo: '600012' }).lean();
    console.log(JSON.stringify(tarifas, null, 2));
    process.exit(0);
}
run().catch(console.error);
