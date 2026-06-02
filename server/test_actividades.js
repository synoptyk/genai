require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const mayDesde = new Date('2026-05-01T00:00:00Z');
  const mayHasta = new Date('2026-05-31T23:59:59Z');
  const mayOrders = await Actividad.find({ fecha: { $gte: mayDesde, $lte: mayHasta } });
  
  const aprDesde = new Date('2026-04-01T00:00:00Z');
  const aprHasta = new Date('2026-04-30T23:59:59Z');
  const aprOrders = await Actividad.find({ fecha: { $gte: aprDesde, $lte: aprHasta } });
  
  console.log(`May: ${mayOrders.length}, Apr: ${aprOrders.length}`);
  
  // Try counting without date filter
  const allOrders = await Actividad.countDocuments();
  console.log(`Total Actividades: ${allOrders}`);
  
  process.exit(0);
}
run().catch(console.error);
