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
    
    const traslados = await collection.find({
      $or: [
        { descripcion: { $regex: /traslado/i } },
        { 'mapeo.tipo_trabajo_pattern': { $regex: /traslado/i } },
        { 'mapeo.subtipo_actividad': { $regex: /traslado/i } },
        { categoria: { $regex: /traslado/i } }
      ],
      activo: true
    }).toArray();
    
    console.log(JSON.stringify(traslados, null, 2));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
