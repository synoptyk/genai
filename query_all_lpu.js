const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    const collection = db.collection('tarifalpus');
    
    // Get a summary of all active tariffs
    const all = await collection.find({ activo: true })
      .project({ codigo: 1, descripcion: 1, categoria: 1, 'mapeo.subtipo_actividad': 1, 'mapeo.tipo_trabajo_pattern': 1 })
      .toArray();
      
    console.log(JSON.stringify(all, null, 2));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
