const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const searchVal = '1287416952';
    console.log(`Searching for '${searchVal}' in activities...`);

    const docs = await Actividad.find({
      $or: [
        { ordenId: searchVal },
        { "Número de Petición": searchVal },
        { "Número_de_Petición": searchVal },
        { "peticion": searchVal }
      ]
    }).lean();

    console.log(`Found ${docs.length} documents matching '${searchVal}':`);
    docs.forEach((d, idx) => {
      console.log(`\nDoc #${idx+1} keys and values:`);
      Object.keys(d).forEach(k => {
        console.log(`  ${k}: ${JSON.stringify(d[k])}`);
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
