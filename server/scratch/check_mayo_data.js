const mongoose = require('mongoose');
require('dotenv').config();

async function checkData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/entplatform');
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const coll = db.collection('actividades_mayo');

    const total = await coll.countDocuments();
    console.log('Total docs in actividades_mayo:', total);

    const empresas = await coll.distinct('empresaRef');
    console.log('Unique empresaRefs in actividades_mayo:', empresas);

    // Buscar "Ram Ingenieria"
    const Ram = await db.collection('empresas').findOne({ nombre: /Ram Ingenieria/i });
    if (Ram) {
      console.log('Found Ram Ingenieria:', Ram._id, Ram.nombre);
      const countRam = await coll.countDocuments({ empresaRef: Ram._id });
      console.log('Docs for Ram in Mayo:', countRam);
      
      const sample = await coll.findOne({ empresaRef: Ram._id });
      if (sample) {
        console.log('Sample doc for Ram:', JSON.stringify(sample, null, 2));
      } else {
        // Probablemente empresaRef está guardado como String?
        const countRamStr = await coll.countDocuments({ empresaRef: Ram._id.toString() });
        console.log('Docs for Ram in Mayo (as String):', countRamStr);
        if (countRamStr > 0) {
            const sampleStr = await coll.findOne({ empresaRef: Ram._id.toString() });
            console.log('Sample doc for Ram (String):', JSON.stringify(sampleStr, null, 2));
        }
      }
    } else {
      console.log('Ram Ingenieria NOT found in empresas collection');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkData();
