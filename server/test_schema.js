const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai').then(async () => {
  const model = require('./models/Candidato'); // assuming it's in models/
  console.log('Schema for empresaRef:', model.schema.paths.empresaRef);
  process.exit(0);
}).catch(console.error);
