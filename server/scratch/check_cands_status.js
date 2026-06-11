const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const candidates = await db.collection('candidatos').find({}).toArray();

  console.log(`Total candidates in candidates collection: ${candidates.length}`);

  const statusCounts = {};
  candidates.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });

  console.log('Status counts:', statusCounts);

  console.log('\n--- ALL CANDIDATES IN DB ---');
  candidates.forEach(c => {
    console.log(`Name: ${c.fullName || c.name}, Status: ${c.status}, RUT: ${c.rut}, idRecursoToa: ${c.idRecursoToa}`);
  });

  await mongoose.connection.close();
}

run().catch(console.error);
