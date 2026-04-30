const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function debugActivities() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // 1. Obtener empresa de mbarrientos
    const user = await db.collection('usuarios').findOne({ email: 'mbarrientos@rambox.cl' });
    const empresaId = user?.empresaRef;
    console.log(`👤 Usuario: mbarrientos@rambox.cl`);
    console.log(`🏢 Empresa: ${empresaId}\n`);
    
    // 2. Obtener técnicos de esa empresa
    const candidatos = await db.collection('candidatos').find({
      empresaRef: empresaId,
      status: 'Contratado',
      position: { $regex: /TELECOMUNICACIONES/i }
    }).project({ fullName: 1, idRecursoToa: 1 }).toArray();
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    console.log(`✅ ${candidatos.length} técnicos TELECOMUNICACIONES en empresa Ram`);
    console.log(`✅ ${idsRecurso.length} con idRecursoToa\n`);
    
    // 3. Buscar actividades sin estado
    const sinEstado = await db.collection('actividads').find({
      RECURSO: { $in: idsRecurso },
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      },
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ]
    }).limit(5).toArray();
    
    console.log(`📊 Muestra de actividades sin estado:`);
    sinEstado.forEach(a => {
      const fecha = a.fecha instanceof Date 
        ? a.fecha.toISOString().split('T')[0]
        : a.fecha;
      console.log(`  RECURSO: ${a.RECURSO}, Fecha: ${fecha}, Pts: ${a.PTS_TOTAL_BAREMO}, empresaRef: ${a.empresaRef}`);
    });
    
    // 4. Contar actividades por estado para esta empresa
    const actividadesTotal = await db.collection('actividads').find({
      RECURSO: { $in: idsRecurso },
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      }
    }).toArray();
    
    const porEstado = {};
    actividadesTotal.forEach(a => {
      const estado = a.Estado || '(sin estado)';
      if (!porEstado[estado]) {
        porEstado[estado] = { count: 0, pts: 0, dates: new Set() };
      }
      porEstado[estado].count++;
      porEstado[estado].pts += parseFloat(a.PTS_TOTAL_BAREMO || 0);
      
      const fecha = a.fecha instanceof Date 
        ? a.fecha.toISOString().split('T')[0]
        : (typeof a.fecha === 'string' ? a.fecha.split('T')[0] : new Date(a.fecha).toISOString().split('T')[0]);
      porEstado[estado].dates.add(fecha);
    });
    
    console.log(`\n📈 Actividades por estado en abril (empresa Ram):`);
    Object.entries(porEstado).forEach(([estado, data]) => {
      console.log(`  ${estado}: ${data.count} actividades, ${data.pts.toFixed(2)} puntos, ${data.dates.size} días únicos`);
    });
    
    console.log(`\n📅 Fechas con datos (sin estado):`);
    const sinEstadoAgg = await db.collection('actividads').aggregate([
      {
        $match: {
          RECURSO: { $in: idsRecurso },
          fecha: {
            $gte: new Date('2026-04-01'),
            $lt: new Date('2026-05-01')
          },
          $or: [
            { Estado: { $exists: false } },
            { Estado: null }
          ]
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
    
    sinEstadoAgg.forEach(d => {
      console.log(`  ${d._id}: ${d.count} actividades, ${d.pts.toFixed(2)} puntos`);
    });
    
  } finally {
    await client.close();
  }
}

debugActivities().catch(console.error);
