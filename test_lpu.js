const mongoose = require('mongoose');
const TarifaLPU = require('./server/platforms/agentetelecom/models/TarifaLPU');
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

mongoose.connect(MONGO_URI)
  .then(async () => {
    const lpus = await TarifaLPU.find().lean();
    console.log(JSON.stringify(lpus.map(l => ({desc: l.descripcion, code: l.codigo})), null, 2));
    process.exit(0);
  });
