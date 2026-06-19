const mongoose = require('mongoose');
const Candidato = require('./platforms/rrhh/models/Candidato');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai')
  .then(async () => {
    const cand = await Candidato.find({ 
      $or: [
        { fullName: /JOAQU/i },
        { idRecursoToa: "28710" },
        { idRecursoToa: "29110" },
        { idRecursoToa: "29118" }
      ]
    }).lean();
    console.log(JSON.stringify(cand, null, 2));
    process.exit(0);
  });
