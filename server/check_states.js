const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkStates() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Obtener técnicos TELECOMUNICACIONES
    const candidatos = await db.collection('candidatos').find({
      status: 'Contratado',
      position: { $regex: /TELECOMUNICACIONES/i }
    }).project({ idRecursoToa: 1 }).toArray();
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    // Buscar actividades por ESTADO
    const states = await db.collection('actividads').aggregate([
      {
        $match: {
          RECURSO: { $in: idsRecurso },
          fecha: {
            $gte: new Date('2026-04-01'),
            $lt: new Date('2026-05-01')
          }
        }
      },
      {
        $group: {
          _id: '$Estado',
          count: { $sum: 1 },
          pts: { $sum: { $toDouble: '$PTS_TOTAL_BAREMO' } }
        }
      }
    ]).toArray();
    
    console.log('Estados encontrados en abril para TELECOMUNICACIONES:');
    states.sort((a, b) => b.count - a.count).forEach(s => {
      console.log(`  ${s._id || '(sin estado)'}: ${s.count} actividades, ${s.pts.toFixed(2)} puntos`);
    });
    
  } finally {
    await client.close();
  }
}

checkStates().catch(console.error);
