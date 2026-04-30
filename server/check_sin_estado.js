const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkSinEstado() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // 1. IDs de técnicos de Ram Ingenieria
    const empresaId = new ObjectId('69ab8a37d7239b0dd12383d1');
    const candidatos = await db.collection('candidatos').find({
      empresaRef: empresaId,
      status: 'Contratado'
    }).project({ idRecursoToa: 1 }).toArray();
    
    const idsRecurso = candidatos
      .filter(c => c.idRecursoToa)
      .map(c => String(c.idRecursoToa));
    
    console.log(`✅ ${idsRecurso.length} IDs de recurso en Ram Ingenieria:`);
    console.log(`   ${idsRecurso.join(', ')}\n`);
    
    // 2. Buscar actividades sin estado
    const sinEstado = await db.collection('actividads').find({
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      }
    }).limit(10).toArray();
    
    console.log(`📊 Muestra de actividades sin Estado (${sinEstado.length}):`);
    sinEstado.forEach((a, i) => {
      const fecha = a.fecha instanceof Date ? a.fecha.toISOString().split('T')[0] : a.fecha;
      console.log(`  ${i+1}. RECURSO: '${a.RECURSO}' (${typeof a.RECURSO}), Fecha: ${fecha}, Pts: ${a.PTS_TOTAL_BAREMO}`);
      console.log(`     Recurso: '${a.Recurso}', ID_RECURSO: '${a.ID_RECURSO}', ID RECURSO: '${a['ID RECURSO']}'`);
    });
    
    // 3. Contar actividades sin estado
    const totalSinEstado = await db.collection('actividads').countDocuments({
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      }
    });
    
    console.log(`\n📈 Total actividades sin Estado en abril: ${totalSinEstado}`);
    
    // 4. Contar cuántas tienen RECURSO que coinciden con técnicos Ram
    const conRecurso = await db.collection('actividads').countDocuments({
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      RECURSO: { $in: idsRecurso },
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      }
    });
    
    console.log(`✅ Que pertenecen a técnicos Ram: ${conRecurso}`);
    
    // 5. Buscar actividades sin RECURSO
    const sinRecurso = await db.collection('actividads').countDocuments({
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ],
      RECURSO: { $exists: false },
      fecha: {
        $gte: new Date('2026-04-01'),
        $lt: new Date('2026-05-01')
      }
    });
    
    console.log(`❌ Sin campo RECURSO: ${sinRecurso}`);
    
    // 6. Ver qué campos tienen las actividades sin estado
    const sinEstadoSample = await db.collection('actividads').findOne({
      $or: [
        { Estado: { $exists: false } },
        { Estado: null }
      ]
    });
    
    console.log(`\n📋 Campos de una actividad sin Estado:`);
    if (sinEstadoSample) {
      Object.keys(sinEstadoSample).slice(0, 20).forEach(key => {
        console.log(`   ${key}: ${sinEstadoSample[key]}`);
      });
    }
    
  } finally {
    await client.close();
  }
}

checkSinEstado().catch(console.error);
