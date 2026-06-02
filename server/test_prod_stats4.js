require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Actividad = require('./platforms/agentetelecom/models/Actividad');
  const docEmpresaId = new mongoose.Types.ObjectId('66b59d9f9c0635e9f1681ab0');
  
  const docs = await Actividad.find({ 
    empresaRef: docEmpresaId,
    FECHA_SISTEMA: { $gte: '2026-05-01', $lte: '2026-05-31' },
    Estado: 'Completado'
  }).lean().limit(1);

  if (docs.length) {
     console.log("FECHA:", docs[0].fecha, typeof docs[0].fecha);
  }
  process.exit(0);
}
run().catch(console.error);
