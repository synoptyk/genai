const mongoose = require('mongoose');
const Candidato = require('./platforms/rrhh/models/Candidato');

mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true')
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
