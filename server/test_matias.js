const mongoose = require('mongoose');
const Candidato = require('./platforms/rrhh/models/Candidato');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai')
  .then(async () => {
    const cand = await Candidato.find({ fullName: /MAT.AS/i }).lean();
    console.log(cand.map(c => c.fullName));
    process.exit(0);
  });
