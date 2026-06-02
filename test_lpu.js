const mongoose = require('mongoose');
const TarifaLPU = require('./server/platforms/agentetelecom/models/TarifaLPU');
mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true')
  .then(async () => {
    const lpus = await TarifaLPU.find().lean();
    console.log(JSON.stringify(lpus.map(l => ({desc: l.descripcion, code: l.codigo})), null, 2));
    process.exit(0);
  });
