const mongoose = require('mongoose');
require('dotenv').config();

const actividadSchema = new mongoose.Schema({}, { strict: false });
const Actividad = mongoose.model('Actividad', actividadSchema, 'actividads');

async function debugSchema() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Buscar documentos que tengan campos de puntos
    const docs = await Actividad.find({ 
      $or: [
        { 'Total_Puntos': { $gt: 0 } },
        { 'total puntos': { $gt: 0 } },
        { 'Pts_Total': { $gt: 0 } },
        { 'Pts_Total_Baremo': { $gt: 0 } }
      ]
    }).sort({ fecha: -1 }).limit(2).lean();
    
    console.log('\n--- SAMPLE TOA DOCUMENTS ---');
    docs.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      const filtered = {};
      for (const key in doc) {
        if (!['rawData', 'camposCustom', '_id', '__v'].includes(key)) {
          filtered[key] = doc[key];
        }
      }
      console.log(JSON.stringify(filtered, null, 2));
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debugSchema();
