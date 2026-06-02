require('dotenv').config();
const mongoose = require('mongoose');
const Actividad = require('./platforms/agentetelecom/models/Actividad');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const act = await Actividad.findOne({ ordenId: '1283982657' }).lean();
    if (act) {
        console.log("Productos XML:", act.Productos_y_Servicios_Contratados);
        console.log("Decos Adicionales (Raw):", act.Decos_Adicionales);
        console.log("Decos Cable Adicionales:", act.Decos_Cable_Adicionales);
        console.log("Decos WiFi Adicionales:", act.Decos_WiFi_Adicionales);
        console.log("Baremos:", act.Pts_Deco_Adicional, act.Pts_Deco_WiFi);
    } else {
        console.log("OT no encontrada");
    }
    process.exit(0);
}
run().catch(console.error);
