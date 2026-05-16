
const mongoose = require('mongoose');
const path = require('path');

async function checkTech() {
  try {
    await mongoose.connect('mongodb://localhost:27017/genai_prod');
    console.log('Conectado a MongoDB');
    
    const Tecnico = mongoose.model('Tecnico', new mongoose.Schema({}, { strict: false }), 'tecnicos');
    const Candidato = mongoose.model('Candidato', new mongoose.Schema({}, { strict: false }), 'candidatos');
    
    const query = {
      $or: [
        { idRecursoToa: "19149" },
        { idRecursoToa: 19149 },
        { idRecurso: "19149" },
        { idRecurso: 19149 }
      ]
    };
    
    const t = await Tecnico.findOne(query).lean();
    const c = await Candidato.findOne(query).lean();
    
    console.log('RESULTADO TECNICO:', JSON.stringify(t, null, 2));
    console.log('RESULTADO CANDIDATO:', JSON.stringify(c, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  }
}

checkTech();
