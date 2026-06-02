const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Find an activity with 'At--------' to see what an Alta looks like
    const act = await db.collection('actividades_mayo').findOne({
      $or: [
        { 'Tipo_Trabajo': { $regex: /^At/i } },
        { 'Tipo_de_Trabajo': { $regex: /^At/i } },
        { 'Tipo de Trabajo': { $regex: /^At/i } }
      ]
    });
    
    console.log("Activity data:", JSON.stringify(act, null, 2));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
