const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    const act = await db.collection('actividades_mayo').findOne({});
    if (act) {
      console.log("Columns:");
      Object.keys(act).forEach(k => console.log(k));
    }
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
