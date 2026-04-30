const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function checkUser() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    const user = await db.collection('usuarios').findOne({ email: 'mbarrientos@rambox.cl' });
    
    console.log('Usuario mbarrientos@rambox.cl:');
    console.log(`  _id: ${user._id}`);
    console.log(`  fullName: ${user.fullName}`);
    console.log(`  email: ${user.email}`);
    console.log(`  empresaRef: ${user.empresaRef}`);
    console.log(`  empresaRef type: ${typeof user.empresaRef}`);
    console.log(`  role: ${user.role}`);
    
    // Buscar empresas
    const empresas = await db.collection('empresas').find({}).project({ nombre: 1 }).toArray();
    console.log(`\nEmpresas en la base de datos:`);
    empresas.forEach(e => {
      console.log(`  - ${e.nombre} (_id: ${e._id})`);
    });
    
    // Buscar candidatos sin empresaRef
    const candidatosSinEmpresa = await db.collection('candidatos').find({
      empresaRef: { $exists: false }
    }).limit(3).toArray();
    
    console.log(`\nCandidatos sin empresaRef: ${candidatosSinEmpresa.length}`);
    
  } finally {
    await client.close();
  }
}

checkUser().catch(console.error);
