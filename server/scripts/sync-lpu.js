const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SistemaIntegralCorporativo';

// Schema inline to avoid import issues
const TarifaLPUSchema = new mongoose.Schema({
  empresaRef: mongoose.Schema.Types.ObjectId,
  codigo: String,
  descripcion: String,
  grupo: String,
  puntos: Number,
  mapeo: {
    es_equipo_adicional: Boolean,
    campo_cantidad: String,
    tipo_trabajo_pattern: String,
    subtipo_actividad: String
  },
  activo: Boolean
});

const TarifaLPU = mongoose.model('TarifaLPU', TarifaLPUSchema, 'tarifalpus');

async function sync() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const legacyTarifas = await TarifaLPU.find({ 
    'mapeo.campo_cantidad': 'Decos_Adicionales',
    activo: true
  });

  console.log(`Found ${legacyTarifas.length} legacy deco rates. Splitting into Cable and WiFi...`);

  for (const t of legacyTarifas) {
    // 1. Update legacy if needed or leave as catch-all
    // 2. Create Cable Specific if not exists
    const cableExists = await TarifaLPU.findOne({ 
        empresaRef: t.empresaRef, 
        'mapeo.campo_cantidad': 'Decos_Cable_Adicionales' 
    });
    if (!cableExists) {
        const cable = new TarifaLPU({
            ...t.toObject(),
            _id: new mongoose.Types.ObjectId(),
            codigo: t.codigo + '-CAT',
            descripcion: t.descripcion + ' (CABLE/CAT)',
            'mapeo.campo_cantidad': 'Decos_Cable_Adicionales'
        });
        await cable.save();
        console.log(`Created Cable rate for company ${t.empresaRef}`);
    }

    // 3. Create WiFi Specific if not exists
    const wifiExists = await TarifaLPU.findOne({ 
        empresaRef: t.empresaRef, 
        'mapeo.campo_cantidad': 'Decos_WiFi_Adicionales' 
    });
    if (!wifiExists) {
        const wifi = new TarifaLPU({
            ...t.toObject(),
            _id: new mongoose.Types.ObjectId(),
            codigo: t.codigo + '-WIFI',
            descripcion: t.descripcion + ' (WIFI/SMART)',
            'mapeo.campo_cantidad': 'Decos_WiFi_Adicionales'
        });
        await wifi.save();
        console.log(`Created WiFi rate for company ${t.empresaRef}`);
    }
  }

  // Sync Repetidores to ensure they use the correct field
  const repTarifas = await TarifaLPU.find({ 
    'mapeo.es_equipo_adicional': true,
    descripcion: /repetidor|extender|wifi/i,
    'mapeo.campo_cantidad': { $ne: 'Repetidores_WiFi' }
  });
  for (const r of repTarifas) {
      r.mapeo.campo_cantidad = 'Repetidores_WiFi';
      await r.save();
      console.log(`Updated Repetidor rate: ${r.descripcion}`);
  }

  console.log('Sync complete.');
  process.exit(0);
}

sync().catch(err => { console.error(err); process.exit(1); });
