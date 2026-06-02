require('dotenv').config();
const mongoose = require('mongoose');
const calculoEngine = require('./platforms/agentetelecom/utils/calculoEngine');
const Actividad = require('./platforms/agentetelecom/models/Actividad');
const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    
    const tarifas = await TarifaLPU.find({ activo: true }).lean();
    const acts = await Actividad.find({}).lean();
    
    console.log(`Recalculando ${acts.length} actividades...`);
    
    let count = 0;
    const ops = [];
    for(const act of acts) {
        // filter tarifas for this company
        const ts = tarifas.filter(t => String(t.empresaRef) === String(act.empresaRef));
        const resBaremo = calculoEngine.calcularBaremos(act, ts) || {};
        ops.push({
            updateOne: {
                filter: { _id: act._id },
                update: {
                    $set: {
                        ...resBaremo,
                        PTS_TOTAL_BAREMO: String(resBaremo.Pts_Total_Baremo || 0),
                        ptsTotalBaremo: parseFloat(resBaremo.Pts_Total_Baremo || 0)
                    }
                }
            }
        });
        count++;
        if (ops.length >= 500) {
            await Actividad.bulkWrite(ops, { ordered: false });
            ops.length = 0;
            console.log(`Procesados ${count}`);
        }
    }
    if (ops.length > 0) {
        await Actividad.bulkWrite(ops, { ordered: false });
    }
    
    console.log(`¡Todo listo! ${count} actualizadas.`);
    process.exit(0);
}
run().catch(console.error);
