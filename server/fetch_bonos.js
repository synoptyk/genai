require('dotenv').config();
const mongoose = require('mongoose');

const BonoSchema = new mongoose.Schema({
  mes: Number,
  anio: Number,
  status: String,
  calculos: [mongoose.Schema.Types.Mixed]
});
const Bono = mongoose.model('BonoMensualConsolidado', BonoSchema, 'bonomensualconsolidados');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const bonos = await Bono.find().sort({ createdAt: -1 }).limit(3);
  for (const b of bonos) {
      console.log(`MES: ${b.mes}, ANIO: ${b.anio}, STATUS: ${b.status}, CALCULOS: ${b.calculos.length}`);
      const alan = b.calculos.find(c => c.nombre && c.nombre.toLowerCase().includes('alan'));
      console.log('Alan:', alan);
  }
  process.exit(0);
}
run().catch(console.error);
