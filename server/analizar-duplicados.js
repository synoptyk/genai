const mongoose = require('mongoose');
require('dotenv').config({ path: '/Users/mauro/Synoptik_Innovacion/Gen AI/server/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

async function analizar() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado a MongoDB\n');

  const Actividad = mongoose.connection.db.collection('actividads');

  // Obtener una muestra grande para detectar todas las columnas
  const muestra = await Actividad.find({}).limit(1000).toArray();
  console.log(`📊 Analizando ${muestra.length} documentos...\n`);

  // Recopilar todas las claves únicas
  const todasLasColumnas = new Set();
  muestra.forEach(doc => {
    Object.keys(doc).forEach(k => todasLasColumnas.add(k));
  });

  console.log(`📋 Total columnas únicas: ${todasLasColumnas.size}\n`);

  // Detectar duplicadas (variantes de una misma columna)
  const normalizar = (n) => n.toLowerCase().replace(/[\s_]+/g, '').replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');

  const grupos = {};
  Array.from(todasLasColumnas).sort().forEach(col => {
    const norm = normalizar(col);
    if (!grupos[norm]) grupos[norm] = [];
    grupos[norm].push(col);
  });

  // Mostrar grupos con duplicados
  console.log('🔴 COLUMNAS DUPLICADAS DETECTADAS:\n');
  let hayDuplicados = 0;
  Object.entries(grupos).forEach(([norm, variantes]) => {
    if (variantes.length > 1) {
      hayDuplicados++;
      console.log(`  Grupo "${norm}":`);
      variantes.forEach(v => {
        // Contar cuántos docs tienen valor no-vacío en esta columna
        let conValor = 0;
        muestra.forEach(doc => {
          const val = doc[v];
          if (val !== null && val !== undefined && val !== '' && val !== '0') conValor++;
        });
        console.log(`    - "${v}" → ${conValor}/${muestra.length} con valor`);
      });
      console.log('');
    }
  });

  if (hayDuplicados === 0) console.log('  ✅ No se detectaron duplicados\n');
  else console.log(`\n⚠️  Total grupos con duplicados: ${hayDuplicados}\n`);

  // Listar TODAS las columnas
  console.log('📋 LISTADO COMPLETO DE TODAS LAS COLUMNAS:');
  Array.from(todasLasColumnas).sort().forEach(c => console.log(`  - ${c}`));

  await mongoose.disconnect();
}

analizar().catch(err => { console.error(err); process.exit(1); });
