const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

async function audit() {
  // Conexión local si falla Atlas (usando el servidor local de Mauros)
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/tu_base";
  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error("No se pudo conectar a MongoDB. Abortando.");
    process.exit(1);
  }

  const empresaId = '663e46c7587ef03b98357a07'; // RAM Ingenieria
  const desde = new Date('2026-03-01T00:00:00Z');
  const hasta = new Date('2026-03-29T23:59:59Z');

  const tecnicosDB = await Tecnico.find({ empresaRef: empresaId }).lean();
  const vinculadosSet = new Set(tecnicosDB.map(t => String(t.idRecursoToa || '').trim()).filter(Boolean));

  const docs = await Actividad.find({
    fecha: { $gte: desde, $lte: hasta },
    Estado: 'Completado'
  }).lean();

  let totalOp = 0;
  let totalEj = 0;
  
  let skippedByEj = [];
  let skippedByOp = [];

  docs.forEach(doc => {
    const clean = {};
    for (const [k, v] of Object.entries(doc)) clean[k.replace(/\./g, '_')] = v;

    const idRecurso = String(clean['ID_Recurso'] || clean['ID Recurso'] || clean.idRecurso || '').trim();
    const nameToa = clean['Técnico'] || clean.Técnico || '';
    const pTotal = parseFloat(clean['Pts_Total_Baremo'] || clean['Total_Puntos'] || 0);

    const isVinculado = idRecurso && vinculadosSet.has(idRecurso);

    // Lógica Operativo (Simplificada)
    if (isVinculado && nameToa) {
      totalOp += pTotal;
    } else if (isVinculado && !nameToa) {
      skippedByOp.push({ idRecurso, pTotal, reason: 'No Name' });
    }

    // Lógica Ejecutivo (Simplificada)
    if (idRecurso && vinculadosSet.has(idRecurso)) {
      totalEj += pTotal;
    } else {
      skippedByEj.push({ nameToa, pTotal, reason: 'Not Vinculado' });
    }
  });

  console.log(`TOTAL PUNTOS OPERATIVO: ${totalOp.toFixed(2)}`);
  console.log(`TOTAL PUNTOS EJECUTIVO: ${totalEj.toFixed(2)}`);
  console.log(`DIFERENCIA: ${(totalOp - totalEj).toFixed(2)}`);
  
  if (skippedByOp.length > 0) {
    console.log(`Registros saltados por Operativo (con ID pero sin NOMBRE): ${skippedByOp.length} (Total Pts: ${skippedByOp.reduce((a,b)=>a+b.pTotal,0)})`);
  }
  
  process.exit(0);
}

audit();
