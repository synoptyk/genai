const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai').then(async () => {
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
