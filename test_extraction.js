const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Actividad = require('./server/platforms/agentetelecom/models/Actividad');
    const doc = await Actividad.findOne({ "Estado": "Completado" }).lean();
    console.log("Original Doc keys:", Object.keys(doc));
    
    const clean = {};
    for (let k in doc) {
      if (typeof doc[k] === 'function') continue;
      const val = doc[k];
      const kUpper = k.toUpperCase().replace(/ /g, '_');
      clean[kUpper] = val;
      const kNormal = k.replace(/[\.\s]/g, '_');
      if (!clean[kNormal]) clean[kNormal] = val;
    }
    
    console.log("Clean keys:", Object.keys(clean).slice(0,20));
    
    let idRecursoRaw = 
        clean.ID_RECURSO || 
        clean.IDRECURSOTOA || 
        clean.ID_RECURSO_TOA || 
        clean.RECURSO || 
        clean['AUTO_ASIGNADO_A_RECURSO_(ID)'] ||
        clean.TECNICO ||
        '';

    console.log("Extracted ID:", idRecursoRaw);
    process.exit(0);
  });
