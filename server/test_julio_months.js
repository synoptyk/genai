require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Tecnico = mongoose.model('Tecnico', Schema, 'tecnicos');
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tech = await Tecnico.findOne({ idRecursoToa: /565/ });
  
  const acts = await Actividad.find({
      $or: [
          { RECURSO: tech.idRecursoToa },
          { "ID Recurso": tech.idRecursoToa },
          { idRecursoToa: tech.idRecursoToa },
          { idRecurso: tech.idRecursoToa },
          { rut: tech.rut }
      ]
  }).lean();
  
  const byMonth = {};
  for (const act of acts) {
      if (!act.fecha) continue;
      const d = new Date(act.fecha);
      const m = d.getMonth() + 1;
      if (!byMonth[m]) byMonth[m] = 0;
      byMonth[m]++;
  }
  
  console.log(`Julio activities by month:`, byMonth);
  process.exit(0);
}
run().catch(console.error);
