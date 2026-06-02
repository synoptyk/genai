require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const acts = await Actividad.find({ 
      fecha: { $gte: mayDesde, $lte: mayHasta },
      "Recurso Name": /JULIO/i
  }).lean();
  
  console.log(`Activities for *JULIO* in May: ${acts.length}`);
  
  if (acts.length > 0) {
      console.log(`Sample activity RECURSO: ${acts[0].RECURSO}, name: ${acts[0]["Recurso Name"]}`);
  }
  process.exit(0);
}
run().catch(console.error);
