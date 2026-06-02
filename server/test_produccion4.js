require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const marDesde = new Date('2026-03-01T00:00:00Z');
  const marHasta = new Date('2026-03-31T23:59:59Z');
  const acts = await Actividad.find({ 
      fecha: { $gte: marDesde, $lte: marHasta },
      $or: [
          { RECURSO: /565/ },
          { idRecursoToa: /565/ }
      ]
  }).lean();
  
  console.log(`Julio Soto (565) activities in March: ${acts.length}`);
  process.exit(0);
}
run().catch(console.error);
