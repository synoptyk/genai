const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGO_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('clusterreclutando');
  const act = await db.collection('actividad').findOne({Estado: 'Completado'});
  console.log("RUT fields:");
  console.log(Object.keys(act).filter(k => k.toLowerCase().includes('rut')));
  console.log("Estado field:", act.Estado || act.estado);
  console.log("RUT value:", act.RUT_PERSONA_CLIENTE || act['RUT_PERSONA_CLIENTE']);
  await client.close();
}
run().catch(console.error);
