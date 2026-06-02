require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Bono = mongoose.model('BonoMensualConsolidado', Schema, 'bonomensualconsolidados');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const bonos = await Bono.find({}, { mes: 1, anio: 1, status: 1 });
  console.log(`Found ${bonos.length} total closures`);
  for (const b of bonos) {
      console.log(`MES: ${b.mes}, ANIO: ${b.anio}, STATUS: ${b.status}`);
  }
  process.exit(0);
}
run().catch(console.error);
