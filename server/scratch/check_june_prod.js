const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;
console.log('Connecting to:', MONGO_URI);

const Candidato = require('../platforms/rrhh/models/Candidato');
const Tecnico = require('../platforms/operaciones/models/TurnoSupervisor'); // we can also load from the model path

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  // Load Technicians from DB
  const dbTechs = await mongoose.connection.db.collection('tecnicos').find({}).toArray();
  const dbCands = await mongoose.connection.db.collection('candidatos').find({}).toArray();
  
  console.log(`Total Tecnicos in DB: ${dbTechs.length}`);
  console.log(`Total Candidatos in DB: ${dbCands.length}`);

  console.log('\n--- SAMPLE CANDIDATOS (first 5) ---');
  dbCands.slice(0, 5).forEach(c => {
    console.log(`Name: ${c.fullName || c.name}, RUT: ${c.rut}, TOA ID: ${c.idRecursoToa || c.idRecurso}`);
  });

  console.log('\n--- SAMPLE TECNICOS (first 5) ---');
  dbTechs.slice(0, 5).forEach(t => {
    console.log(`Name: ${t.nombre || t.name}, RUT: ${t.rut}, TOA ID: ${t.idRecursoToa || t.idRecurso}`);
  });

  // Check specific technicians from user's image
  const targetNames = ['ALAN', 'ANDY', 'CARLOS', 'CRISTIAN', 'JOAQUIN', 'JULIO', 'RICARDO', 'RODRIGO', 'MATIAS'];
  console.log('\n--- SEARCHING FOR TARGET NAMES IN DB ---');
  for (const name of targetNames) {
    const matchedC = dbCands.filter(c => (c.fullName || c.name || '').toUpperCase().includes(name));
    const matchedT = dbTechs.filter(t => (t.nombre || t.name || '').toUpperCase().includes(name));
    console.log(`\nName: ${name}`);
    console.log(`  Candidatos: ${matchedC.map(c => `${c.fullName} (RUT: ${c.rut}, TOA: ${c.idRecursoToa})`).join(', ')}`);
    console.log(`  Tecnicos: ${matchedT.map(t => `${t.nombre} (RUT: ${t.rut}, TOA: ${t.idRecursoToa})`).join(', ')}`);
  }

  await mongoose.connection.close();
}

run().catch(console.error);
