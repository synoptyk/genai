const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function syncCanonicalProjects() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🍃 Conectado a MongoDB...');

    const db = mongoose.connection.db;
    const proyectos = await db.collection('proyectos').find({}).toArray();
    const projMap = {};
    proyectos.forEach(p => {
      projMap[String(p._id)] = p.nombreProyecto || p.projectName;
    });

    console.log(`📋 Proyectos registrados en DB (${proyectos.length}):`);
    Object.entries(projMap).forEach(([id, name]) => {
      console.log(`   - [${id}] "${name}"`);
    });

    // 1. Sincronizar Candidatos
    const cands = await db.collection('candidatos').find({ projectId: { $exists: true, $ne: null } }).toArray();
    let candUpdated = 0;
    for (const c of cands) {
      const canonicalName = projMap[String(c.projectId)];
      if (canonicalName && c.projectName !== canonicalName) {
        await db.collection('candidatos').updateOne(
          { _id: c._id },
          { $set: { projectName: canonicalName, nombreProyecto: canonicalName } }
        );
        console.log(`   ✅ Candidato "${c.fullName || c.name}": "${c.projectName}" ➔ "${canonicalName}"`);
        candUpdated++;
      }
    }

    // 2. Sincronizar Tecnicos
    const techs = await db.collection('tecnicos').find({ projectId: { $exists: true, $ne: null } }).toArray();
    let techUpdated = 0;
    for (const t of techs) {
      const canonicalName = projMap[String(t.projectId)];
      if (canonicalName && (t.proyecto !== canonicalName || t.projectName !== canonicalName)) {
        await db.collection('tecnicos').updateOne(
          { _id: t._id },
          { $set: { proyecto: canonicalName, projectName: canonicalName, nombreProyecto: canonicalName } }
        );
        console.log(`   ✅ Técnico "${t.nombre || t.nombres}": "${t.proyecto}" ➔ "${canonicalName}"`);
        techUpdated++;
      }
    }

    console.log(`\n🎉 Sincronización completada con éxito:`);
    console.log(`   - Candidatos actualizados: ${candUpdated}`);
    console.log(`   - Técnicos actualizados: ${techUpdated}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error sincronizando proyectos:', err);
    process.exit(1);
  }
}

syncCanonicalProjects();
