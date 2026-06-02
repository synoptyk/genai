require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const Tecnico = mongoose.model('Tecnico', Schema, 'tecnicos');
const Candidato = mongoose.model('Candidato', Schema, 'candidatos');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tech = await Tecnico.findOne({ idRecursoToa: /565/ });
  const cand = await Candidato.findOne({ idRecursoToa: /565/ });
  
  console.log('Tecnico:', tech);
  console.log('Candidato:', cand);
  process.exit(0);
}
run().catch(console.error);
