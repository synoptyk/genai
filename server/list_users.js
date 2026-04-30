const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function listUsers() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Buscar usuarios en diferentes colecciones
    const usuarios = await db.collection('usuarios').find({}).project({ email: 1, fullName: 1, empresaRef: 1, role: 1 }).limit(5).toArray();
    console.log('Primeros usuarios encontrados:');
    usuarios.forEach(u => {
      console.log(`  ${u.email} - ${u.fullName} - empresa: ${u.empresaRef} - role: ${u.role}`);
    });
    
    // Buscar por rambox
    const rambox = await db.collection('usuarios').findOne({ email: { $regex: /rambox/i } });
    console.log(`\nBúsqueda con 'rambox': ${rambox ? rambox.email : 'NO ENCONTRADO'}`);
    
    // Buscar empresas
    const empresas = await db.collection('empresas').find({}).project({ nombre: 1 }).toArray();
    console.log(`\nEmpresas (${empresas.length}):`, empresas.map(e => e.nombre).join(', '));
    
  } finally {
    await client.close();
  }
}

listUsers().catch(console.error);
