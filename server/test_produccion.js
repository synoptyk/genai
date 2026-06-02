require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Orden = mongoose.model('OrdenToa', Schema, 'ordentoas');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const desde = new Date('2026-04-01T00:00:00Z');
  const hasta = new Date('2026-04-30T23:59:59Z');
  const ordenes = await Orden.find({
    fechaCita: { $gte: desde, $lte: hasta },
    estado: 'Completado'
  });
  console.log(`Found ${ordenes.length} completado orders in April`);
  
  const byTech = {};
  for(const o of ordenes) {
      const id = o.idRecurso;
      if (!byTech[id]) byTech[id] = 0;
      byTech[id]++;
  }
  console.log("Orders per tech:");
  console.log(byTech);
  
  process.exit(0);
}
run().catch(console.error);
