const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function listUsers() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Buscar en 'usergenais'
    const users = await db.collection('usergenais').find({}).project({ email: 1, name: 1, empresaRef: 1, role: 1 }).toArray();
    console.log('Usuarios en usergenais:');
    users.forEach(u => {
      console.log(`  ${u.email} - ${u.name} - empresa: ${u.empresaRef} - role: ${u.role}`);
    });
    
  } finally {
    await client.close();
  }
}

listUsers().catch(console.error);
