
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

async function check() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const ActividadMayo = require('./platforms/agentetelecom/models/ActividadMayo');
  
  const start = new Date('2026-05-01T00:00:00Z');
  const end = new Date('2026-05-31T23:59:59Z');

  const count = await ActividadMayo.countDocuments({
    fecha: { $gte: start, $lte: end }
  });
  console.log(`Total documents in ActividadMayo for May 2026: ${count}`);

  if (count > 0) {
    const samples = await ActividadMayo.find({
      fecha: { $gte: start, $lte: end }
    }).limit(3).lean();
    console.log('Samples:', JSON.stringify(samples, null, 2));

    const statusRegex = /completad|finalizad|ok|ejecutad/i;
    const matchingStatus = await ActividadMayo.countDocuments({
      fecha: { $gte: start, $lte: end },
      $or: [
        { estado: { $regex: statusRegex } },
        { Estado: { $regex: statusRegex } },
        { ESTADO: { $regex: statusRegex } },
        { status: { $regex: statusRegex } }
      ]
    });
    console.log(`Documents matching status filter: ${matchingStatus}`);
    
    // Check points
    const withPoints = await ActividadMayo.countDocuments({
      fecha: { $gte: start, $lte: end },
      $or: [
        { ptsTotalBaremo: { $gt: 0 } },
        { PTS_TOTAL_BAREMO: { $gt: 0 } },
        { Pts_Total_Baremo: { $gt: 0 } }
      ]
    });
    console.log(`Documents with points > 0: ${withPoints}`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
