require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Candidato = mongoose.model('Candidato', Schema, 'candidatos');

async function run() {
  await mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin');
  
  const cands = await Candidato.find({ fullName: /VICENTE/i }).lean();
  console.log('Vicente empresaRef:', cands.map(c => c.empresaRef));

  const empresas = await mongoose.connection.collection('empresas').find({}).toArray();
  console.log('All empresas:', empresas.map(e => ({ id: e._id, nombre: e.nombre })));

  process.exit(0);
}
run().catch(console.error);
