const mongoose = require('mongoose');
const Candidato = require('./platforms/rrhh/models/Candidato');

mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true')
  .then(async () => {
    const cand = await Candidato.find({ fullName: /MAT.AS/i }).lean();
    console.log(cand.map(c => c.fullName));
    process.exit(0);
  });
