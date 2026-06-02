const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/synoptik_genai_db')
  .then(async () => {
    const db = mongoose.connection.db;
    const user = await db.collection('platformusers').findOne({ email: /ricardillo/i });
    console.log("User:", user);
    
    const tec = await db.collection('tecnicos').findOne({ nombre: /ricardo.*castro/i });
    console.log("Tecnico:", tec);
    process.exit(0);
  });
