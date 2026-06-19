require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai');
  
  const query = {
      fecha: { $gte: new Date('2026-06-01T00:00:00Z'), $lt: new Date('2026-07-01T00:00:00Z') },
      Estado: 'Completado'
  };
  
  const actividades = await Actividad.find(query).lean();
  let found = 0;
  actividades.forEach(doc => {
     let idRecursoRaw = doc.ID_RECURSO || doc.IDRECURSOTOA || doc.ID_RECURSO_TOA || doc.RECURSO || doc.TECNICO || '';
     const idRecurso = String(idRecursoRaw || '').trim().replace(/^0+/, '');
     if (idRecurso === '19169' || idRecurso === '29118' || idRecurso === '28818') {
         console.log('ID Match:', idRecurso, 'Nombre:', doc.NOMBRE || doc.RESOURCE_NAME);
         found++;
     }
  });
  console.log('Total found:', found);

  process.exit(0);
}
run().catch(console.error);
