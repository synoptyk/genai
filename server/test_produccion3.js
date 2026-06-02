require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const aprDesde = new Date('2026-04-01T00:00:00Z');
  const aprHasta = new Date('2026-04-30T23:59:59Z');
  const aprOrders = await Actividad.find({ fecha: { $gte: aprDesde, $lte: aprHasta } }).lean();
  
  let julio = 0;
  for(const act of aprOrders) {
      if (String(act.RECURSO || '').includes('565') || String(act.idRecurso || '').includes('565') || String(act.idRecursoToa || '').includes('565')) {
          julio++;
      }
  }
  console.log(`Julio Soto (565) activities in April: ${julio}`);
  process.exit(0);
}
run().catch(console.error);
