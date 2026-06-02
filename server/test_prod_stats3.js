require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Tecnico = mongoose.model('Tecnico', Schema, 'tecnicos');
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
const { calcularBaremos, obtenerTarifasEmpresa } = require('./platforms/agentetelecom/utils/calculoEngine');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const tech = await Tecnico.findOne({ idRecursoToa: /565/ });
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const acts = await Actividad.find({ 
      fecha: { $gte: mayDesde, $lte: mayHasta },
      $or: [
          { RECURSO: tech.idRecursoToa },
          { "ID Recurso": tech.idRecursoToa },
          { idRecursoToa: tech.idRecursoToa },
          { idRecurso: tech.idRecursoToa },
          { rut: tech.rut }
      ]
  }).lean();
  
  console.log(`Found ${acts.length} activities in May.`);
  
  if (acts.length > 0) {
      const docEmpresaId = acts[0].empresaRef || tech.empresaRef || '66b59d9f9c0635e9f1681ab0'; 
      console.log('Doc Empresa ID:', docEmpresaId);
      const tarifas = await obtenerTarifasEmpresa(docEmpresaId);
      console.log(`Loaded ${tarifas.length} tarifas for empresa.`);
      
      let totalPts = 0;
      let zeroPtsCount = 0;
      for (const doc of acts) {
          const baremos = calcularBaremos(doc, tarifas) || {};
          let pTotal = parseFloat(baremos.Pts_Total_Baremo || doc.ptsTotalBaremo || 0);
          if (pTotal === 0) zeroPtsCount++;
          totalPts += pTotal;
      }
      console.log(`Total calculated points for Julio in May: ${totalPts}`);
      console.log(`Activities with 0 points: ${zeroPtsCount}`);
  }
  
  process.exit(0);
}
run().catch(console.error);
