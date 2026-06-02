require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
const { calcularBaremos, obtenerTarifasEmpresa } = require('./platforms/agentetelecom/utils/calculoEngine');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const acts = await Actividad.find({ 
      fecha: { $gte: mayDesde, $lte: mayHasta },
      $or: [
          { RECURSO: '565' },
          { idRecursoToa: '565' },
          { idRecurso: '565' },
          { rut: '100710811' }
      ]
  }).lean();
  
  console.log(`Found ${acts.length} activities in May.`);
  
  if (acts.length > 0) {
      const docEmpresaId = '66b59d9f9c0635e9f1681ab0'; // Try to fetch manually if acts doesn't have it
      console.log('Doc Empresa ID:', acts[0].empresaRef || docEmpresaId);
      const tarifas = await obtenerTarifasEmpresa(acts[0].empresaRef || docEmpresaId);
      console.log(`Loaded ${tarifas.length} tarifas for empresa.`);
      
      let totalPts = 0;
      for (const doc of acts) {
          const baremos = calcularBaremos(doc, tarifas) || {};
          const pTotal = parseFloat(baremos.Pts_Total_Baremo || doc.ptsTotalBaremo || 0);
          totalPts += pTotal;
      }
      console.log(`Total calculated points for Julio in May: ${totalPts}`);
  }
  
  process.exit(0);
}
run().catch(console.error);
