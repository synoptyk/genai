const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

// Mock models
const Candidato = require('../platforms/rrhh/models/Candidato');
const Tecnico = require('../platforms/rrhh/models/Candidato'); // or wherever they reside
// Load other schemas
const Actividad = require('../platforms/operaciones/models/TurnoSupervisor'); // Or find the schema for Actividad

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  // Let's call the database directly to inspect the 'actividads' or 'actividades' collection
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections list:', collections.map(c => c.name));

  // Let's find June 2026 activities
  const actCollectionName = collections.find(c => c.name.toLowerCase().includes('actividad'))?.name || 'actividads';
  console.log('Using activity collection:', actCollectionName);

  const actCollection = mongoose.connection.db.collection(actCollectionName);
  
  // Count docs in June 2026
  // Check date formats in DB
  const sampleDoc = await actCollection.findOne({});
  console.log('\n--- SAMPLE ACTIVITY ---');
  console.log(sampleDoc);

  // Let's search for docs with fecha between 2026-06-01 and 2026-06-30
  // Check what dates are in the DB
  const allDocs = await actCollection.find({}).toArray();
  console.log(`Total activities in collection: ${allDocs.length}`);
  
  const dates = allDocs.map(d => d.fecha || d.date || d.FECHA).filter(Boolean);
  console.log('Sample dates:', dates.slice(0, 10));

  // Let's filter docs in June 2026
  const juneDocs = allDocs.filter(d => {
    const f = d.fecha || d.date || d.FECHA;
    if (!f) return false;
    const dateStr = new Date(f).toISOString();
    return dateStr.startsWith('2026-06');
  });

  console.log(`\nJune 2026 activities count: ${juneDocs.length}`);

  // Let's print the resource IDs and names in June 2026 activities
  const resourceCounts = {};
  juneDocs.forEach(d => {
    const id = d.ID_RECURSO || d.idRecurso || d.RECURSO || d.Recurso || d.idRecursoToa;
    const name = d.NOMBRE || d.nombre || d.NOMBRE_TECNICO || d.nombreTecnico;
    const key = `${id} - ${name}`;
    resourceCounts[key] = (resourceCounts[key] || 0) + 1;
  });

  console.log('\n--- June 2026 Resource IDs in Activities ---');
  console.log(resourceCounts);

  await mongoose.connection.close();
}

run().catch(console.error);
