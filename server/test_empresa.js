require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Candidato = mongoose.model('Candidato', Schema, 'candidatos');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai');
  
  const cands = await Candidato.find({ fullName: /VICENTE/i }).lean();
  console.log('Vicente empresaRef:', cands.map(c => c.empresaRef));

  const empresas = await mongoose.connection.collection('empresas').find({}).toArray();
  console.log('All empresas:', empresas.map(e => ({ id: e._id, nombre: e.nombre })));

  process.exit(0);
}
run().catch(console.error);
