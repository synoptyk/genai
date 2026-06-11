require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const Candidato = mongoose.model('Candidato', Schema, 'candidatos');
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const cand = await Candidato.findOne({
      $or: [
          { idRecursoToa: /29110/i },
          { rut: /29110/i }
      ]
  });
  console.log(cand);
  process.exit(0);
}
run().catch(console.error);
