const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    const TarifaLPU = require('../server/platforms/agentetelecom/models/TarifaLPU');
    const { obtenerTarifasEmpresa, calcularBaremos, valorizarBaremos, construirMapaValorizacion } = require('../server/platforms/agentetelecom/utils/calculoEngine');

    const actividadId = "6a0e5f8fa4abd108884b883f";
    const Actividades = mongoose.connection.db.collection('actividades');
    const act = await Actividades.findOne({ _id: new mongoose.Types.ObjectId(actividadId) });
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

        // Actualizar equipos adicionales en el documento
        let updateFields = {};
        updateFields.Decos_Adicionales = String(decosVal);
        updateFields.DECOS_ADICIONALES = decosVal;
        updateFields.Repetidores_WiFi = String(repetidoresVal);
        updateFields.REPETIDORES_WIFI = repetidoresVal;
        updateFields.Telefonos = String(telefonosVal);
        updateFields.TELEFONOS = telefonosVal;

        if (codigoLpuVal) {
            updateFields.CODIGO_LPU_BASE = codigoLpuVal;
            updateFields['Cód LPU'] = codigoLpuVal;
            updateFields.COD_LPU = codigoLpuVal;
            updateFields.LPU_COD = codigoLpuVal;
            updateFields.SUBTIPO_DE_ACTIVIDAD = codigoLpuVal;
            updateFields.subtipo = codigoLpuVal;
        }

        if (puntosBaseVal > 0) {
            updateFields.Pts_Actividad_Base = puntosBaseVal;
            updateFields.PTS_ACTIVIDAD_BASE = puntosBaseVal;
        }

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
