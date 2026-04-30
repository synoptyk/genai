const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkPts() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    const empresaId = new ObjectId('69ab8a37d7239b0dd12383d1');
    const candidatos = await db.collection('candidatos').find({
      empresaRef: empresaId,
      status: 'Contratado'
    }).project({ idRecursoToa: 1 }).toArray();
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    // Buscar actividades sin Estado con/sin puntos
    const conPts = await db.collection('actividads').countDocuments({
      RECURSO: { $in: idsRecurso },
      fecha: { $gte: new Date('2026-04-01'), $lt: new Date('2026-05-01') },
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      PTS_TOTAL_BAREMO: { $exists: true, $ne: null, $ne: '' }
    });
    
    const sinPts = await db.collection('actividads').countDocuments({
      RECURSO: { $in: idsRecurso },
      fecha: { $gte: new Date('2026-04-01'), $lt: new Date('2026-05-01') },
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      $or: [
        { PTS_TOTAL_BAREMO: { $exists: false } },
        { PTS_TOTAL_BAREMO: null },
        { PTS_TOTAL_BAREMO: '' }
      ]
    });
    
    console.log('Actividades sin Estado para Ram:');
    console.log(`  ✅ Con PTS_TOTAL_BAREMO: ${conPts}`);
    console.log(`  ❌ Sin PTS_TOTAL_BAREMO: ${sinPts}`);
    console.log(`  📊 Total: ${conPts + sinPts}`);
    
    // Buscar actividades Completadas
    const completadas = await db.collection('actividads').countDocuments({
      RECURSO: { $in: idsRecurso },
      fecha: { $gte: new Date('2026-04-01'), $lt: new Date('2026-05-01') },
      Estado: 'Completado'
    });
    
    console.log(`\nActividades Completado: ${completadas}`);
    
    // Total
    console.log(`\nTotal actividades Ram en abril: ${conPts + sinPts + completadas}`);
    
    // Distribución por fecha (solo sin Estado con Pts)
    console.log(`\n📅 Distribución por fecha (sin Estado + con Pts):`);
    const byDate = await db.collection('actividads').aggregate([
      {
        $match: {
          RECURSO: { $in: idsRecurso },
          fecha: { $gte: new Date('2026-04-01'), $lt: new Date('2026-05-01') },
          $or: [
            { Estado: { $exists: false } },
            { Estado: null }
          ],
          PTS_TOTAL_BAREMO: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          count: { $sum: 1 },
          pts: { $sum: { $toDouble: '$PTS_TOTAL_BAREMO' } }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
    
    byDate.forEach(d => {
      console.log(`  ${d._id}: ${d.count} act, ${d.pts.toFixed(2)} pts`);
    });
    
  } finally {
    await client.close();
  }
}

checkPts().catch(console.error);
