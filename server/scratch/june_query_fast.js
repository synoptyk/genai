const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const actCollection = db.collection('actividades');

  // Let's find activities in June 2026 using date boundaries
  // Check the schema field type for "fecha" or similar
  const doc = await actCollection.findOne({ fecha: { $exists: true } });
  console.log('Fecha type is:', typeof doc.fecha, doc.fecha);

  let query = {};
  if (doc.fecha instanceof Date) {
    query = {
      fecha: {
        $gte: new Date('2026-06-01T00:00:00Z'),
        $lte: new Date('2026-06-30T23:59:59Z')
      }
    };
  } else {
    // String dates or something else
    query = {
      fecha: {
        $regex: /^2026-06/
      }
    };
  }

  const docs = await actCollection.find(query).toArray();
  console.log(`Total June 2026 activities matched: ${docs.length}`);

  const counts = {};
  docs.forEach(d => {
    const id = d.ID_RECURSO || d.idRecurso || d.RECURSO || d.Recurso || d.idRecursoToa;
    const name = d.NOMBRE || d.nombre || d.NOMBRE_TECNICO || d.nombreTecnico || d.Técnico;
    const key = `${id} - ${name}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  console.log('\n--- June 2026 Resources with Activity Counts ---');
  console.log(JSON.stringify(counts, null, 2));

  await mongoose.connection.close();
}

run().catch(console.error);
