const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Find an activity with DROP
    // Let's just find an activity that has any property containing 'drop' case insensitive
    const act = await db.collection('actividades_mayo').findOne({
      $or: [
        { 'Reutilización_de_Drop': { $exists: true } },
        { 'Reutilizacion_de_Drop': { $exists: true } },
        { 'Reutilización de Drop': { $exists: true } },
        { 'reutilizacion_drop': { $exists: true } },
        { 'Reutilizacion de Drop': { $exists: true } },
        { 'Reutilizacion_Drop': { $exists: true } }
      ]
    });
    
    if (act) {
      console.log("Found activity keys:", Object.keys(act).filter(k => k.toLowerCase().includes('drop')));
      console.log("Activity data:", JSON.stringify(act, null, 2));
    } else {
      console.log("No activity found with DROP property in actividades_mayo.");
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
