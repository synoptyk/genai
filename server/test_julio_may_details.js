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
  
  const mayActs = acts.filter(a => a.fecha && new Date(a.fecha).getMonth() + 1 === 5);
  
  console.log(`Julio May acts count: ${mayActs.length}`);
  if (mayActs.length > 0) {
      console.log(`Sample 1:`, mayActs[0]);
  }
  process.exit(0);
}
run().catch(console.error);
