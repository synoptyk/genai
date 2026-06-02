require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
const { calcularBaremos, valorizarBaremos, obtenerTarifasEmpresa } = require('./platforms/agentetelecom/utils/calculoEngine');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const acts = await Actividad.find({ 
      fecha: { $gte: mayDesde, $lte: mayHasta },
      $or: [
          { RECURSO: '565' },
          { idRecursoToa: '565' },
          { idRecurso: '565' }
      ]
  }).lean();
  
  console.log(`Found ${acts.length} activities for 565 in May.`);
  
  if (acts.length > 0) {
      const docEmpresaId = acts[0].empresaRef; // Assuming we have it
      console.log('Doc Empresa ID:', docEmpresaId);
      const tarifas = await obtenerTarifasEmpresa(docEmpresaId);
      console.log(`Loaded ${tarifas.length} tarifas for empresa.`);
      
      let totalPts = 0;
      for (const doc of acts) {
          const baremos = calcularBaremos(doc, tarifas) || {};
          const pTotal = parseFloat(baremos.Pts_Total_Baremo || 0);
          totalPts += pTotal;
      }
      console.log(`Total calculated points for Julio (565) in May: ${totalPts}`);
  }
  
  process.exit(0);
}
run().catch(console.error);
