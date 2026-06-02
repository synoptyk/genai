require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Modelo = mongoose.model('ModeloBonificacion', Schema, 'modelobonificacions');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const models = await Modelo.find({ activo: true });
  console.log(`Found ${models.length} active models`);
  for (const m of models) {
      console.log(`Model: ${m.nombre}, Tipo: ${m.tipo}, mesOverride: ${m.mesOverride}, anioOverride: ${m.anioOverride}`);
  }
  process.exit(0);
}
run().catch(console.error);
