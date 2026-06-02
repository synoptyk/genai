const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Find activities where subtipo contains TRASLADO
    const act = await db.collection('actividades_mayo').findOne({ subtipo: { $regex: /TRASLADO/i } });
    const act2 = await db.collection('actividades').findOne({ subtipo: { $regex: /TRASLADO/i } });
    
    console.log("Actividades Mayo:", act ? JSON.stringify(act, null, 2) : "None");
    console.log("Actividades Legacy:", act2 ? JSON.stringify(act2, null, 2) : "None");
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
