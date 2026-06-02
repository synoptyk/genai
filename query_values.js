const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    const acts = await db.collection('actividades').find({
      'Cierres Secundarios STB': { $exists: true, $ne: '' }
    }).limit(10).toArray();
    
    console.log("Valores STB:", acts.map(a => a['Cierres Secundarios STB']));
    
    const acts2 = await db.collection('actividades').find({
      'Cantidad de Equipos Nuevos': { $exists: true, $ne: '', $ne: '0', $ne: 0 }
    }).limit(10).toArray();
    
    console.log("Valores Equipos Nuevos:", acts2.map(a => a['Cantidad de Equipos Nuevos']));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
