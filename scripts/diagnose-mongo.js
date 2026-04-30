#!/usr/bin/env node

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function diagnose() {
  try {
    console.log('\n🔍 DIAGNÓSTICO DE MONGODB\n');

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000
    });

    console.log('✅ Conectado a MongoDB\n');

    const db = mongoose.connection;
    const dbName = db.name;
    console.log(`📊 Base de datos: ${dbName}\n`);

    // Listar colecciones
    console.log('📋 Colecciones disponibles:');
    const collections = await db.listCollections();

    for (const coll of collections) {
      console.log(`   - ${coll.name}`);
    }

    console.log('\n');

    // Buscar colecciones con "actividad" en el nombre
    const actividadColls = collections.filter(c =>
      c.name.toLowerCase().includes('actividad')
    );

    if (actividadColls.length === 0) {
      console.log('⚠️  No se encontró colección con "actividad" en el nombre');
      console.log('');
      process.exit(1);
    }

    console.log(`✅ Encontrado: ${actividadColls.length} colección(es) con "actividad"`);

    // Analizar cada colección
    for (const collInfo of actividadColls) {
      const collName = collInfo.name;
      console.log(`\n📍 Colección: ${collName}`);

      const coll = db.collection(collName);
      const count = await coll.countDocuments();
      console.log(`   Documentos: ${count.toLocaleString()}`);

      const indexes = await coll.getIndexes();
      console.log(`   Índices: ${Object.keys(indexes).length}`);
      Object.keys(indexes).forEach(idx => {
        console.log(`      - ${idx}`);
      });

      // Probar query simple
      console.log(`   Probando query...`);
      try {
        const sample = await coll.findOne({}, { maxTimeMS: 5000 });
        console.log(`   ✅ Query OK - Primer documento encontrado`);
        if (sample && sample._id) {
          console.log(`      ID: ${sample._id}`);
        }
      } catch (e) {
        console.log(`   ❌ Error en query: ${e.message}`);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Diagnóstico completado\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

diagnose();
