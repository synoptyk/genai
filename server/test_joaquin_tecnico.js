const mongoose = require('mongoose');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai')
  .then(async () => {
    const tec = await Tecnico.find({ idRecursoToa: "28710" }).lean();
    console.log(JSON.stringify(tec, null, 2));
    process.exit(0);
  });
