const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function verifyDates() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Obtener técnicos TELECOMUNICACIONES
    const candidatos = await db.collection('candidatos').find({
      status: 'Contratado',
      position: { $regex: /TELECOMUNICACIONES/i }
    }).project({ fullName: 1, idRecursoToa: 1 }).toArray();
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    console.log(`✅ ${candidatos.length} técnicos TELECOMUNICACIONES`);
    console.log(`✅ ${idsRecurso.length} con idRecursoToa\n`);
    
    // Búscar actividades para TELECOMUNICACIONES
    const query = {
      RECURSO: { $in: idsRecurso },
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      },
      Estado: 'Completado'
    };
    
    const actividades = await db.collection('actividads').find(query).toArray();
    
    console.log(`✅ Total actividades TELECOMUNICACIONES Completadas en abril: ${actividades.length}`);
    
    // Agrupar por fecha
    const byDate = {};
    let totalPts = 0;
    
    actividades.forEach(a => {
      const fecha = a.fecha instanceof Date 
        ? a.fecha.toISOString().split('T')[0]
        : (typeof a.fecha === 'string' ? a.fecha.split('T')[0] : new Date(a.fecha).toISOString().split('T')[0]);
      
      if (!byDate[fecha]) {
        byDate[fecha] = { count: 0, pts: 0 };
      }
      
      byDate[fecha].count++;
      const pts = parseFloat(a.PTS_TOTAL_BAREMO || 0);
      byDate[fecha].pts += pts;
      totalPts += pts;
    });
    
    console.log('\n📅 Distribución por fecha:');
    Object.keys(byDate).sort().forEach(fecha => {
      const data = byDate[fecha];
      console.log(`  ${fecha}: ${data.count} actividades, ${data.pts.toFixed(2)} puntos`);
    });
    
    console.log(`\n✅ TOTAL: ${actividades.length} actividades, ${totalPts.toFixed(2)} puntos`);
    
  } finally {
    await client.close();
  }
}

verifyDates().catch(console.error);
