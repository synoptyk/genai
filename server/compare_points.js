const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const empresaId = '663e46c7587ef03b98357a07'; // RAM Ingenieria
  
  const desde = new Date('2026-03-01T00:00:00Z');
  const hasta = new Date('2026-03-29T23:59:59Z');

  const tecnicos = await Tecnico.find({ empresaRef: empresaId }).lean();
  const vinculadosIds = tecnicos.map(t => String(t.idRecursoToa || '').trim()).filter(Boolean);
  const vinculadosSet = new Set(vinculadosIds);

  const filtro = {
    fecha: { $gte: desde, $lte: hasta },
    Estado: 'Completado'
  };

  const docs = await Actividad.find(filtro).lean();
  console.log(`Total documentos 'Completado' en el periodo: ${docs.length}`);

  let ptsOperativo = 0;
  let ptsEjecutivo = 0;
  
  const techMapOperativo = {};
  const techMapEjecutivo = {};

  docs.forEach(doc => {
    const clean = {};
    for (const [k, v] of Object.entries(doc)) clean[k.replace(/\./g, '_')] = v;

    const idRecursoRaw = clean['ID_Recurso'] || clean['ID Recurso'] || clean.idRecurso || '';
    const idRecurso = String(idRecursoRaw || '').trim();
    const nameToa = clean['Técnico'] || clean.Técnico || 'S/N';
    const pTotal = parseFloat(clean['Pts_Total_Baremo'] || clean['Total_Puntos'] || 0);

    const isVinculado = idRecurso && vinculadosSet.has(idRecurso);

    if (isVinculado) {
      // Criterio Operativo (basado en lo que vi en el codigo)
      if (nameToa !== 'S/N') {
        ptsOperativo += pTotal;
        techMapOperativo[nameToa] = (techMapOperativo[nameToa] || 0) + pTotal;
      }

      // Criterio Ejecutivo (basado en mi nuevo codigo)
      ptsEjecutivo += pTotal;
      techMapEjecutivo[idRecurso] = (techMapEjecutivo[idRecurso] || 0) + pTotal;
    }
  });

  console.log(`>>> TOTAL OPERATIVO (Simulado): ${ptsOperativo.toFixed(2)}`);
  console.log(`>>> TOTAL EJECUTIVO (Simulado): ${ptsEjecutivo.toFixed(2)}`);
  
  console.log('\n--- Diferencias por Técnico (Top 5) ---');
  // (Esto es solo una aproximacion ya que uno usa nombre y otro ID)
  
  process.exit(0);
}

check();
