const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';
const ConsumoCombustible = require('./platforms/agentetelecom/models/ConsumoCombustible');

async function cleanDuplicates() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado a MongoDB');

  const records = await ConsumoCombustible.find({}).sort({ createdAt: 1 });
  const hashSet = new Set();
  let duplicates = 0;

  for (const record of records) {
    if (record.hashCarga && hashSet.has(record.hashCarga)) {
      // It's a duplicate
      await ConsumoCombustible.findByIdAndDelete(record._id);
      duplicates++;
    } else {
      if (record.hashCarga) {
        hashSet.add(record.hashCarga);
      }
    }
  }

  console.log(`✅ Duplicados eliminados: ${duplicates}`);
  await mongoose.disconnect();
}

cleanDuplicates().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
