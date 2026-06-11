require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const collection = db.collection('actividades');

  // Let's find one document that has empresaRef set
  const docWithEmpresa = await collection.findOne({ empresaRef: { $exists: true } });
  if (docWithEmpresa) {
    console.log("Found doc with empresaRef:", docWithEmpresa.empresaRef);
    console.log("Keys of doc with empresaRef:", Object.keys(docWithEmpresa));
  } else {
    console.log("No document has empresaRef set!");
  }

  // Count documents
  const total = await collection.countDocuments();
  const withEmpresa = await collection.countDocuments({ empresaRef: { $exists: true } });
  const completedWithCapitalEstado = await collection.countDocuments({ Estado: /complet/i });
  const completedWithLowerEstado = await collection.countDocuments({ estado: /complet/i });
  const completedWithUpperEstado = await collection.countDocuments({ ESTADO: /complet/i });

  console.log(`Total docs: ${total}`);
  console.log(`With empresaRef: ${withEmpresa}`);
  console.log(`Estado (Capital E) matching /complet/i: ${completedWithCapitalEstado}`);
  console.log(`estado (lower e) matching /complet/i: ${completedWithLowerEstado}`);
  console.log(`ESTADO (upper E) matching /complet/i: ${completedWithUpperEstado}`);

  // Let's run a query similar to the backend's query to see what it finds
  // Assume a default date range
  const desde = new Date('2026-06-01T00:00:00Z');
  const hasta = new Date('2026-06-10T23:59:59Z');
  const searchDesde = new Date('2026-05-02T00:00:00Z');

  const countBackendQueryOriginal = await collection.countDocuments({
    fecha: { $gte: searchDesde, $lte: hasta },
    $and: [{
      $or: [
        { ESTADO: { $regex: /complet/i } },
        { estado: { $regex: /complet/i } },
        { ESTADO: 'Done' }, { estado: 'Done' }
      ]
    }]
  });

  const countBackendQueryFixed = await collection.countDocuments({
    fecha: { $gte: searchDesde, $lte: hasta },
    $and: [{
      $or: [
        { Estado: { $regex: /complet/i } },
        { ESTADO: { $regex: /complet/i } },
        { estado: { $regex: /complet/i } },
        { ESTADO: 'Done' }, { estado: 'Done' }, { Estado: 'Done' }
      ]
    }]
  });

  console.log(`Original backend query matches (no empresa filter): ${countBackendQueryOriginal}`);
  console.log(`Fixed backend query matches (no empresa filter): ${countBackendQueryFixed}`);

  process.exit(0);
}
run().catch(console.error);
