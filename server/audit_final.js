const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

async function audit() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (err) {
    console.error("No se pudo conectar a MongoDB:", err.message);
    process.exit(1);
  }

  const empresaId = '663e46c7587ef03b98357a07'; // RAM Ingenieria (MB)
  const desde = new Date('2026-03-01T00:00:00Z');
  const hasta = new Date('2026-03-29T23:59:59Z');

  // Cargamos los vinculados de la empresa
  const tecnicosDB = await Tecnico.find({ empresaRef: empresaId }).lean();
  const idSet = new Set(tecnicosDB.map(t => String(t.idRecursoToa || '').trim()).filter(Boolean));

  const docs = await Actividad.find({
    fecha: { $gte: desde, $lte: hasta },
    Estado: 'Completado'
  }).lean();

  let totalOp = 0;
  let totalEj = 0;
  
  const techMapOp = {};
  const techMapEj = {};

  docs.forEach(doc => {
    const clean = {};
    for (const [k, v] of Object.entries(doc)) clean[k.replace(/\./g, '_')] = v;

    const idRecurso = String(clean['ID_Recurso'] || clean['ID Recurso'] || clean.idRecurso || clean['Recurso'] || '').trim();
    const nameToa = clean['Técnico'] || clean.Técnico || '';
    const pTotal = parseFloat(clean['Pts_Total_Baremo'] || clean['Total_Puntos'] || 0);

    const isVinculado = idRecurso && idSet.has(idRecurso);

    // CRITERIO OPERATIVO (Basado en server.js:1430)
    if (isVinculado && nameToa) {
      totalOp += pTotal;
      techMapOp[nameToa] = (techMapOp[nameToa] || 0) + pTotal;
    }

    // CRITERIO EJECUTIVO (Basado en mi rewrite)
    if (idRecurso && idSet.has(idRecurso)) {
      totalEj += pTotal;
      techMapEj[idRecurso] = (techMapEj[idRecurso] || 0) + pTotal;
    }
  });

  console.log(`TOTAL OPERATIVO: ${totalOp.toFixed(2)}`);
  console.log(`TOTAL EJECUTIVO: ${totalEj.toFixed(2)}`);
  console.log(`DIFERENCIA: ${(totalOp - totalEj).toFixed(2)}`);

  process.exit(0);
}

audit();
