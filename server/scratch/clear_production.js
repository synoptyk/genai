const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

async function deepClean() {
  try {
    console.log("⏳ Conectando a MongoDB para eliminación de colecciones...");
    await mongoose.connect(mongoURI);
    console.log("✅ Conectado.");

    const db = mongoose.connection.db;
    
    // 1. Vaciar la principal
    console.log("🧹 Vaciando registros de 'actividads'...");
    await db.collection('actividads').deleteMany({});
    console.log("✅ 'actividads' vaciada.");

    // 2. Eliminar por completo las colecciones temporales/basura
    const collectionsToDrop = ['actividades_mayo', 'actividades__mayo', 'actividades_abril', 'actividades_febrero'];
    
    for (const colName of collectionsToDrop) {
      try {
        const collections = await db.listCollections({ name: colName }).toArray();
        if (collections.length > 0) {
          console.log(`🔥 Eliminando colección completa: '${colName}'...`);
          await db.collection(colName).drop();
          console.log(`✅ '${colName}' eliminada de la base de datos.`);
        } else {
          console.log(`ℹ️ '${colName}' no existe, nada que borrar.`);
        }
      } catch (e) {
        console.log(`⚠️ Error al intentar borrar '${colName}':`, e.message);
      }
    }

    console.log("\n✨ LIMPIEZA PROFUNDA COMPLETADA. La base de datos está impecable.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    process.exit(1);
  }
}

deepClean();
