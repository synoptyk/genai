require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Actividad = require('./platforms/agentetelecom/models/Actividad');
  const Empresa = require('./platforms/auth/models/Empresa');
  const empresa = await Empresa.findOne({ name: { $regex: /M3/i } });
  const docEmpresaId = empresa._id;
  console.log("Doc Empresa ID:", docEmpresaId);
  
  const docs = await Actividad.find({ 
    empresaRef: docEmpresaId,
    FECHA_SISTEMA: { $gte: '2026-05-01', $lte: '2026-05-31' },
    Estado: 'Completado'
  }).lean();

  console.log("Found", docs.length, "docs.");
  if (docs.length) {
     console.log("FECHA:", docs[0].fecha, typeof docs[0].fecha);
     console.log("KEYS:", Object.keys(docs[0]).join(', '));
  }
  process.exit(0);
}
run().catch(console.error);
