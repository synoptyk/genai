require('dotenv').config();
const mongoose = require('mongoose');
const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const tarifas = await TarifaLPU.find({ activo: true }).lean();
    const decos = tarifas.filter(t => t.mapeo && ['Decos_WiFi_Adicionales', 'Decos_Adicionales', 'Decos_Cable_Adicionales'].includes(t.mapeo.campo_cantidad));
    console.log(JSON.stringify(decos, null, 2));
    process.exit(0);
}
run().catch(console.error);
