require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const mayOrders = await Actividad.find({ fecha: { $gte: mayDesde, $lte: mayHasta } }).lean();
  
  let julio = 0;
  for(const act of mayOrders) {
      if (String(act.RECURSO || '').includes('565') || String(act.idRecurso || '').includes('565') || String(act.idRecursoToa || '').includes('565')) {
          julio++;
      }
  }
  console.log(`Julio Soto (565) activities in May: ${julio}`);
  process.exit(0);
}
run().catch(console.error);
