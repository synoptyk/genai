require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const tarifas = await db.collection('tarifaslpus').find({}).toArray();
  const grupos = [...new Set(tarifas.map(t => t.grupo))];
  const categorias = [...new Set(tarifas.map(t => t.categoria))];
  console.log("Grupos:", grupos);
  console.log("Categorias:", categorias);
  process.exit(0);
}).catch(e => console.error(e));
