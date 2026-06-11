require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const cand = await Actividad.find({
      $or: [
          { ID_RECURSO: /29110/i },
          { idRecursoToa: /29110/i },
          { RECURSO: /29110/i },
          { NOMBRE: /GACIT/i }
      ]
  }).limit(2).lean();
  console.log(cand.length);
  if(cand.length > 0) {
     console.log({
        nombre: cand[0].NOMBRE || cand[0].RESOURCE_NAME,
        id_recurso: cand[0].ID_RECURSO || cand[0].RECURSO
     });
  }
  process.exit(0);
}
run().catch(console.error);
