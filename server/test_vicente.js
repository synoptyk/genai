require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai');
  
  const query = {
      fecha: { $gte: new Date('2026-06-01T00:00:00Z'), $lt: new Date('2026-07-01T00:00:00Z') },
      Estado: 'Completado',
      NOMBRE: /VICENTE/i
  };
  
  const actividades = await Actividad.find(query).lean();
  console.log(`Found ${actividades.length} activities for Vicente`);
  
  if (actividades.length > 0) {
      console.log('Sample:');
      console.log('ID_RECURSO:', actividades[0].ID_RECURSO);
      console.log('IDRECURSOTOA:', actividades[0].IDRECURSOTOA);
      console.log('RECURSO:', actividades[0].RECURSO);
      console.log('NOMBRE:', actividades[0].NOMBRE);
  }

  process.exit(0);
}
run().catch(console.error);
