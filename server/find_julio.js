require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Tecnico = mongoose.model('Tecnico', Schema, 'tecnicos');
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tech = await Tecnico.findOne({
      $or: [
          { idRecursoToa: /565/ },
          { nombre: /JULIO ALBERTO SOTO/i },
          { idRecurso: /565/ }
      ]
  });
  if (tech) {
      console.log(`Found Tech: ${tech.nombre}, TOA: ${tech.idRecursoToa}, RUT: ${tech.rut}`);
      
      const mayDesde = new Date('2026-05-01T00:00:00Z');
      const mayHasta = new Date('2026-05-31T23:59:59Z');
      const acts = await Actividad.find({ 
          fecha: { $gte: mayDesde, $lte: mayHasta },
          $or: [
              { RECURSO: tech.idRecursoToa },
              { "ID Recurso": tech.idRecursoToa },
              { idRecursoToa: tech.idRecursoToa },
              { idRecurso: tech.idRecursoToa },
              { rut: tech.rut }
          ]
      }).limit(5).lean();
      
      console.log(`Found ${acts.length} activities in May matching this tech.`);
  } else {
      console.log('Tech not found');
  }
  process.exit(0);
}
run().catch(console.error);
