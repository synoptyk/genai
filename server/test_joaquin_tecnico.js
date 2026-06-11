const mongoose = require('mongoose');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true')
  .then(async () => {
    const tec = await Tecnico.find({ idRecursoToa: "28710" }).lean();
    console.log(JSON.stringify(tec, null, 2));
    process.exit(0);
  });
