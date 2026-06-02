const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true";

async function run() {
    console.log("Connecting to MongoDB in server context...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    const Actividad = require('./platforms/agentetelecom/models/Actividad');
    const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');
    const { obtenerTarifasEmpresa, calcularBaremos, valorizarBaremos, construirMapaValorizacion } = require('./platforms/agentetelecom/utils/calculoEngine');

    const actividadId = "6a0e5f8fa4abd108884b883f";
    const act = await Actividad.findOne({ _id: actividadId });
    if (!act) {
        console.log("❌ Actividad no encontrada");
        return;
    }

    console.log("Found activity! ID_Orden:", act.ordenId);
    console.log("empresaRef:", act.empresaRef);

    try {
        const decosVal = parseInt(act.apelacion?.equipos?.decos || 0);
        const repetidoresVal = parseInt(act.apelacion?.equipos?.repetidores || 0);
        const telefonosVal = parseInt(act.apelacion?.equipos?.telefonos || 0);
        const codigoLpuVal = act.apelacion?.codigoLpu || '';
        const puntosBaseVal = parseFloat(act.apelacion?.puntosBase) || 0;

        console.log("Parsed inputs:", { decosVal, repetidoresVal, telefonosVal, codigoLpuVal, puntosBaseVal });

        console.log("Loading tariffs and valuation map...");
        const [tarifas, mapaValor] = await Promise.all([
            obtenerTarifasEmpresa(act.empresaRef, TarifaLPU),
            construirMapaValorizacion(act.empresaRef)
        ]);

        console.log(`Loaded ${tarifas.length} tariffs and ${Object.keys(mapaValor).length} valuation configs`);

        const tempDoc = {
            ...act.toObject(),
            Decos_Adicionales: String(decosVal),
            DECOS_ADICIONALES: decosVal,
            Repetidores_WiFi: String(repetidoresVal),
            REPETIDORES_WIFI: repetidoresVal,
            Telefonos: String(telefonosVal),
            TELEFONOS: telefonosVal,
            ...(codigoLpuVal ? {
                CODIGO_LPU_BASE: codigoLpuVal,
                'Cód LPU': codigoLpuVal,
                COD_LPU: codigoLpuVal,
                LPU_COD: codigoLpuVal,
                SUBTIPO_DE_ACTIVIDAD: codigoLpuVal,
                subtipo: codigoLpuVal
            } : {}),
            ...(puntosBaseVal > 0 ? {
                Pts_Actividad_Base: puntosBaseVal,
                PTS_ACTIVIDAD_BASE: puntosBaseVal
            } : {})
        };

        console.log("Executing calcularBaremos...");
        const baremo = calcularBaremos(tempDoc, tarifas) || {};
        console.log("calcularBaremos result total baremo:", baremo.Pts_Total_Baremo);

        const docParaValorizar = {
            ...tempDoc,
            ...baremo,
            ID_Recurso: act.idRecursoToa || act.RECURSO || act.idRecurso,
            Pts_Total_Baremo: baremo.Pts_Total_Baremo
        };

        console.log("Executing valorizarBaremos...");
        const val = valorizarBaremos(docParaValorizar, mapaValor) || {};
        console.log("valorizarBaremos result:", val);

    } catch (err) {
        console.error("❌ Exception thrown during resolver calculation flow:");
        console.error(err);
    }

    await mongoose.disconnect();
}

run().catch(console.error);
