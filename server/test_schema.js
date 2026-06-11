const mongoose = require('mongoose');
mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin').then(async () => {
  const model = require('./models/Candidato'); // assuming it's in models/
  console.log('Schema for empresaRef:', model.schema.paths.empresaRef);
  process.exit(0);
}).catch(console.error);
