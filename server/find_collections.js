const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function findCollections() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Listar colecciones
    const collections = await db.listCollections().toArray();
    console.log(`Colecciones en base de datos (${collections.length}):`);
    collections.forEach(c => {
      console.log(`  - ${c.name}`);
    });
    
    // Buscar usuarios en todas las colecciones potenciales
    console.log(`\nBuscando usuario mbarrientos en colecciones:`);
    
    for (const collection of collections) {
      const col = db.collection(collection.name);
      const count = await col.countDocuments({ email: { $regex: /mbarrientos|rambox/i } });
      if (count > 0) {
        const sample = await col.findOne({ email: { $regex: /mbarrientos|rambox/i } });
        console.log(`  ✅ ${collection.name}: ${count} encontrados`);
        console.log(`     ${JSON.stringify(sample).substring(0, 150)}...`);
      }
    }
    
  } finally {
    await client.close();
  }
}

findCollections().catch(console.error);
