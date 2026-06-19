
const { MongoClient } = require('mongodb');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

async function check() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    const collections = await db.listCollections().toArray();
    console.log('Colecciones encontradas:', collections.map(c => c.name));

    const start = new Date('2026-05-01T00:00:00Z');
    const end = new Date('2026-05-31T23:59:59Z');

    for (const col of collections) {
      const c = db.collection(col.name);
      const count = await c.countDocuments({
        fecha: { $gte: start, $lte: end }
      });
      if (count > 0) {
        console.log(`✅ Colección "${col.name}" tiene ${count} documentos en Mayo 2026`);
        const sample = await c.findOne({ fecha: { $gte: start, $lte: end } });
        console.log('Muestra:', JSON.stringify(sample).substring(0, 200));
      }
    }
  } finally {
    await client.close();
  }
}
check().catch(console.error);
