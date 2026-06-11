require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const acts = await Actividad.find({}).limit(5).lean();
  if (acts.length > 0) {
      acts.forEach(a => {
         const clean = {};
         for (let k in a) clean[k.toUpperCase().replace(/ /g, '_')] = a[k];
         const rawId = clean.ID_RECURSO || clean.IDRECURSOTOA || clean.ID_RECURSO_TOA || clean.RECURSO || clean['AUTO_ASIGNADO_A_RECURSO_(ID)'] || clean.TECNICO || '';
         const rawName = clean.NOMBRE || clean.NOMBRE_TECNICO || clean.TECNICO_NOMBRE || '';
         console.log(`ID: ${rawId}, Name: ${rawName}, Date: ${clean.FECHA || clean.FECHA_SISTEMA || a.fecha}`);
      });
  } else {
      console.log('No activities found.');
  }
  process.exit(0);
}
run().catch(console.error);
