require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const acts = await Actividad.find({
      $or: [
          { NOMBRE: /MAT/i }
      ]
  }).limit(5).lean();
  console.log(`Found ${acts.length} acts matching MAT`);
  acts.forEach(a => {
      console.log(`ID: ${a.ID_RECURSO || a.RECURSO}, Name: ${a.NOMBRE || a.RESOURCE_NAME}`);
  });
  process.exit(0);
}
run().catch(console.error);
