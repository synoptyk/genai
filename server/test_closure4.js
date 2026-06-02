require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Bono = mongoose.model('BonoMensualConsolidado', Schema, 'bonomensualconsolidados');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const bono = await Bono.findOne({ mes: 4, anio: 2026 });
  if (bono) {
      console.log(`Bono April:`);
      for (const c of bono.get('calculos')) {
          if (c.nombre && c.nombre.includes('SOTO')) {
              console.log(`Julio Soto: pts=${c.puntos}, id=${c.tecnicoId}`);
          }
      }
  } else {
      console.log("Not found");
  }
  process.exit(0);
}
run().catch(console.error);
