const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://developer:genai2025@cluster0.0tiv0.mongodb.net/genai_db?retryWrites=true&w=majority')
  .then(async () => {
    const db = mongoose.connection.db;
    const count = await db.collection('candidatos').countDocuments();
    const active = await db.collection('candidatos').countDocuments({ status: { $in: ['Contratado', 'Activo', 'ACTIVO'] } });
    console.log(`Total: ${count}, Active/Contratado: ${active}`);
    process.exit(0);
  });
