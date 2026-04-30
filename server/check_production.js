const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkProduction() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Verificar distribución de actividades por fecha en abril
    const pipeline = [
      {
        $match: {
          RECURSO: { $exists: true },
          fecha: {
            $gte: new Date('2026-04-01'),
            $lt: new Date('2026-05-01')
          },
          Estado: 'Completado'
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$fecha' }
          },
          count: { $sum: 1 },
          sumPts: { $sum: { $toDouble: '$PTS_TOTAL_BAREMO' } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];
    
    const dailyAgg = await db.collection('actividads').aggregate(pipeline).toArray();
    
    console.log(`✅ Actividades por día en abril 2026:`);
    console.log('Fecha | Actividades | Puntos');
    dailyAgg.forEach(d => {
      console.log(`${d._id} | ${d.count.toString().padStart(11)} | ${Math.round(d.sumPts)}`);
    });
    
  } finally {
    await client.close();
  }
}

checkProduction().catch(console.error);
