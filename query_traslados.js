const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const TarifaLPU = require('./server/platforms/agentetelecom/models/TarifaLPU');
    
    // Find all records where description or mapped fields contain "traslado" (case insensitive)
    const traslados = await TarifaLPU.find({
      $or: [
        { descripcion: { $regex: /traslado/i } },
        { 'mapeo.tipo_trabajo_pattern': { $regex: /traslado/i } },
        { 'mapeo.subtipo_actividad': { $regex: /traslado/i } },
        { categoria: { $regex: /traslado/i } }
      ],
      activo: true
    }).lean();

    console.log(JSON.stringify(traslados, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
