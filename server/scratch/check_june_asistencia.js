const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const collection = db.collection('registroasistencias');

  const docs = await collection.find({
    fecha: {
      $regex: /^2026-06/
    }
  }).toArray();

  console.log(`Total June 2026 attendance records: ${docs.length}`);
  
  if (docs.length > 0) {
    console.log('\n--- SAMPLE RECORDS (first 10) ---');
    docs.slice(0, 10).forEach(d => {
      console.log(`CandidatoId: ${d.candidatoId}, Fecha: ${d.fecha}, Estado: ${d.estado}`);
    });
  }

  await mongoose.connection.close();
}

run().catch(console.error);
