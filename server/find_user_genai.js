const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function findUserGenai() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Buscar usuario
    const user = await db.collection('usergenais').findOne({ email: 'mbarrientos@rambox.cl' });
    
    if (!user) {
      console.log('❌ Usuario no encontrado. Buscando usuarios con email similar:');
      const similar = await db.collection('usergenais').find({ email: { $regex: /barrientos/i } }).toArray();
      similar.forEach(u => {
        console.log(`  - ${u.email} (_id: ${u._id})`);
      });
      return;
    }
    
    console.log('✅ Usuario encontrado:');
    console.log(`  _id: ${user._id}`);
    console.log(`  email: ${user.email}`);
    console.log(`  fullName: ${user.name}`);
    console.log(`  empresaRef: ${user.empresaRef}`);
    console.log(`  role: ${user.role}`);
    console.log(`  status: ${user.status}`);
    
    // Si tiene empresaRef, obtener la empresa
    if (user.empresaRef) {
      const empresa = await db.collection('empresas').findOne({ _id: user.empresaRef });
      console.log(`  Empresa vinculada: ${empresa?.nombre || 'NO ENCONTRADA'}`);
    }
    
    // Obtener técnicos de esa empresa (si existe)
    if (user.empresaRef) {
      const tecnicosCount = await db.collection('candidatos').countDocuments({
        empresaRef: user.empresaRef,
        status: 'Contratado'
      });
      console.log(`\n  Técnicos contratados en su empresa: ${tecnicosCount}`);
      
      // Top 5 técnicos
      const tecnicos = await db.collection('candidatos').find({
        empresaRef: user.empresaRef,
        status: 'Contratado'
      }).project({ fullName: 1, idRecursoToa: 1, position: 1 }).limit(5).toArray();
      
      console.log(`\n  Top 5 técnicos:`);
      tecnicos.forEach(t => {
        console.log(`    - ${t.fullName} (ID: ${t.idRecursoToa}, pos: ${t.position})`);
      });
    }
    
  } finally {
    await client.close();
  }
}

findUserGenai().catch(console.error);
