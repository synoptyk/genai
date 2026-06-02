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
      $or: [
        { 'Cierres Secundarios STB': { $exists: true, $ne: '' } },
        { 'Cantidad de Equipos Nuevos': { $exists: true, $ne: '' } },
        { 'Cantidad de Equipos Nuevos': { $ne: '0' } },
        { 'Cantidad de Equipos Nuevos': { $ne: 0 } }
      ]
    }).limit(3).toArray();
    
    console.log(JSON.stringify(acts.map(a => ({
      STB: a['Cierres Secundarios STB'],
      EquiposNuevos: a['Cantidad de Equipos Nuevos'],
      EquiposReutilizados: a['Cantidad de Equipos Reutilizados'],
      Desc: a['Subtipo de Actividad'],
      Tipo: a['Tipo Trabajo']
    })), null, 2));
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
