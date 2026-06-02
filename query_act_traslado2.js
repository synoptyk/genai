const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Find activities where any string field contains TRASLADO
    const act = await db.collection('actividades_mayo').findOne({
      $or: [
        { subtipo: { $regex: /TRASLADO/i } },
        { Subtipo_de_Actividad: { $regex: /TRASLADO/i } },
        { 'Subtipo de Actividad': { $regex: /TRASLADO/i } },
        { actividad: { $regex: /TRASLADO/i } },
        { Actividad: { $regex: /TRASLADO/i } }
      ]
    });
    
    console.log("Actividades Mayo:", act ? JSON.stringify(act, null, 2) : "None");
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
