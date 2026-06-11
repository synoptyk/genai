const mongoose = require('mongoose');
mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin').then(async () => {
  const C = mongoose.model('Candidato', new mongoose.Schema({}, { strict: false }));
  const docs = await C.find({}).lean();
  console.log(`Total candidatos: ${docs.length}`);
  const idMap = {};
  docs.forEach(d => {
    if (d.idRecursoToa) {
      console.log(`Cand: ${d.fullName} | ID TOA: ${d.idRecursoToa} | RUT: ${d.rut}`);
    }
  });
  process.exit(0);
});
