const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Actividad = require('./platforms/agentetelecom/models/Actividad');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    console.log("Running aggregation to find all duplicate petition numbers in 'actividades' collection...");
    
    // Group by 'Número de Petición' and find duplicates
    const dupes = await Actividad.aggregate([
      {
        $group: {
          _id: "$Número de Petición",
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", ordenId: "$ordenId", fecha: "$fecha", estado: "$Estado", tecnico: "$Técnico" } }
        }
      },
      {
        $match: {
          _id: { $ne: null, $ne: "" },
          count: { $gt: 1 }
        }
      },
      {
        $limit: 10
      }
    ]);

    console.log(`Found ${dupes.length} duplicates (showing up to 10):`);
    dupes.forEach((d, idx) => {
      console.log(`\nDuplicate #${idx + 1}: Petition = ${d._id} (Count: ${d.count})`);
      d.docs.forEach(doc => {
        console.log(`  - ID: ${doc.id}, ordenId: ${doc.ordenId}, Date: ${doc.fecha}, State: ${doc.estado}, Tech: ${doc.tecnico}`);
      });
    });

    // Let's do the same for 'Número_de_Petición'
    const dupes2 = await Actividad.aggregate([
      {
        $group: {
          _id: "$Número_de_Petición",
          count: { $sum: 1 },
          docs: { $push: { id: "$_id", ordenId: "$ordenId", fecha: "$fecha", estado: "$Estado", tecnico: "$Técnico" } }
        }
      },
      {
        $match: {
          _id: { $ne: null, $ne: "" },
          count: { $gt: 1 }
        }
      },
      {
        $limit: 10
      }
    ]);

    console.log(`\nFound ${dupes2.length} duplicates with 'Número_de_Petición' (showing up to 10):`);
    dupes2.forEach((d, idx) => {
      console.log(`\nDuplicate #${idx + 1}: Petition = ${d._id} (Count: ${d.count})`);
      d.docs.forEach(doc => {
        console.log(`  - ID: ${doc.id}, ordenId: ${doc.ordenId}, Date: ${doc.fecha}, State: ${doc.estado}, Tech: ${doc.tecnico}`);
      });
    });

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
