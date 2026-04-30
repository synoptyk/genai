const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkEndpoint() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // 1. Obtener candidatos TELECOMUNICACIONES
    const candidatos = await db.collection('candidatos').find({
      status: 'Contratado',
      position: { $regex: /TELECOMUNICACIONES/i }
    }).project({ fullName: 1, rut: 1, idRecursoToa: 1 }).toArray();
    
    console.log(`✅ Técnicos encontrados: ${candidatos.length}`);
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    console.log('IDs Recurso:', idsRecurso.slice(0, 5).join(', ') + '...');
    
    // 2. Búscar actividades
    const ahora = new Date();
    const mesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const proxMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
    
    console.log(`\nBuscando actividades entre ${mesActual.toISOString().split('T')[0]} y ${proxMes.toISOString().split('T')[0]}`);
    
    const query = {
      RECURSO: { $in: idsRecurso },
      fecha: { $gte: mesActual, $lt: proxMes },
      Estado: 'Completado'
    };
    
    const actividades = await db.collection('actividads').find(query).project({ RECURSO: 1, fecha: 1, PTS_TOTAL_BAREMO: 1 }).limit(20).toArray();
    
    console.log(`\n✅ Primeras 20 actividades encontradas:`);
    actividades.forEach(a => {
      const fecha = a.fecha instanceof Date ? a.fecha.toISOString().split('T')[0] : (typeof a.fecha === 'string' ? a.fecha.split('T')[0] : 'INVALID');
      console.log(`  RECURSO: ${a.RECURSO}, Fecha: ${fecha}, Pts: ${a.PTS_TOTAL_BAREMO}`);
    });
    
    // 3. Verificar el total
    const totalCount = await db.collection('actividads').countDocuments(query);
    console.log(`\nTotal actividades para TELECOMUNICACIONES en abril: ${totalCount}`);
    
    // 4. Agrupar por RECURSO para ver distribución
    const byRecurso = await db.collection('actividads').aggregate([
      { $match: query },
      { $group: { _id: '$RECURSO', count: { $sum: 1 }, totalPts: { $sum: { $toDouble: '$PTS_TOTAL_BAREMO' } } } },
      { $sort: { totalPts: -1 } },
      { $limit: 5 }
    ]).toArray();
    
    console.log(`\nTop 5 técnicos por puntos:`);
    byRecurso.forEach(r => {
      console.log(`  RECURSO ${r._id}: ${r.count} actividades, ${Math.round(r.totalPts)} puntos`);
    });
    
  } finally {
    await client.close();
  }
}

checkEndpoint().catch(console.error);
