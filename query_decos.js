const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    const rules = await db.collection('tarifalpus').find({
      'mapeo.es_equipo_adicional': true
    }).toArray();
    
    console.log(JSON.stringify(rules.map(r => ({
      codigo: r.codigo,
      desc: r.descripcion,
      campo_cantidad: r.mapeo.campo_cantidad
    })), null, 2));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
