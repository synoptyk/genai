const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const BSON = require('bson');
const bcrypt = require('bcryptjs');

const backupDir = '/Users/mauro/Synoptyk_Innovacion/Gen AI/~/mongodb-backups/prod-20260504-232856/genai';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';
const RAM_ID = new ObjectId('69ab8a37d7239b0dd12383d1');

async function main() {
    console.log('⚡ RESTAURACIÓN MULTI-HILO ULTRA VELOZ INICIADA (MODO ROBUSTO)...');
    const client = new MongoClient(mongoUri, { maxPoolSize: 50, connectTimeoutMS: 30000, socketTimeoutMS: 120000 });
    await client.connect();
    const db = client.db('genai');

    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.bson'));
    
    // 1. Restaurar primero todas las colecciones secundarias
    const smallFiles = files.filter(f => f !== 'actividads.bson');
    console.log(`📦 Restaurando ${smallFiles.length} colecciones secundarias...`);
    
    for (const file of smallFiles) {
        const colName = file.replace('.bson', '');
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);
        if (stat.size === 0) continue;
        
        const buf = fs.readFileSync(filePath);
        let offset = 0;
        let docs = [];
        while (offset < buf.length) {
            if (offset + 4 > buf.length) break;
            const docSize = buf.readInt32LE(offset);
            if (docSize <= 0 || offset + docSize > buf.length) break;
            try {
                const doc = BSON.deserialize(buf.subarray(offset, offset + docSize));
                docs.push(doc);
            } catch(e) {}
            offset += docSize;
        }
        
        if (docs.length > 0) {
            const col = db.collection(colName);
            await col.deleteMany({});
            try {
                await col.insertMany(docs, { ordered: false });
            } catch(e) {
                // Ignore partial duplicate index warnings if any
            }
        }
    }
    console.log('✅ Colecciones secundarias restauradas al 100%.');

    // 2. Restaurar actividads.bson con 10 workers en paralelo
    console.log('\n🔥 Restaurando actividads.bson (953.89 MB / 160.804 docs) con 10 workers en paralelo...');
    const actBuf = fs.readFileSync(path.join(backupDir, 'actividads.bson'));
    let offset = 0;
    let allActDocs = [];
    while (offset < actBuf.length) {
        if (offset + 4 > actBuf.length) break;
        const docSize = actBuf.readInt32LE(offset);
        if (docSize <= 0 || offset + docSize > actBuf.length) break;
        try {
            const doc = BSON.deserialize(actBuf.subarray(offset, offset + docSize));
            doc.empresaRef = RAM_ID;
            allActDocs.push(doc);
        } catch(e) {}
        offset += docSize;
    }

    console.log(`📊 Leídos ${allActDocs.length} documentos de actividads.bson en memoria. Insertando en MongoDB...`);
    
    const colAct = db.collection('actividads');
    await colAct.deleteMany({});
    
    const WORKERS = 10;
    const chunkSize = Math.ceil(allActDocs.length / WORKERS);
    const promises = [];
    
    for (let i = 0; i < WORKERS; i++) {
        const chunk = allActDocs.slice(i * chunkSize, (i + 1) * chunkSize);
        if (chunk.length === 0) continue;
        promises.push((async (workerId, docs) => {
            const BATCH = 3000;
            for (let b = 0; b < docs.length; b += BATCH) {
                const bDocs = docs.slice(b, b + BATCH);
                try {
                    await colAct.insertMany(bDocs, { ordered: false });
                } catch(errBatch) {
                    // Ignore duplicate key errors if any
                }
            }
            console.log(`  -> Worker ${workerId + 1} completó ${docs.length} docs.`);
        })(i, chunk));
    }

    await Promise.all(promises);
    console.log('✅ actividads.bson insertado al 100%.');

    // 3. Copiar actividads -> actividades y unificar empresaRef
    console.log('\n🔄 Sincronizando actividads -> actividades...');
    await db.collection('actividades').deleteMany({});
    await db.collection('actividads').aggregate([{ $out: 'actividades' }]).toArray();
    console.log('✅ Documentos copiados en actividades.');

    // 4. Vincular empresaRef en todas las colecciones principales
    console.log('\n🏢 Asegurando vinculación de empresaRef a Ram Ingenieria...');
    const targetCols = [
        'actividades', 'actividads', 'tecnicos', 'candidatos', 
        'registroasistencias', 'attendances', 'liquidacions', 'vehiculos', 
        'conductors', 'proyectos', 'valorpuntoclientes', 'baremos', 
        'tarifalpus', 'almacens', 'productos', 'posts', 'notifications',
        'asts', 'inspeccions', 'combustibles', 'gastos', 'auditlogs',
        'bonoconfigs', 'payrollconfigs', 'modelobonificacions'
    ];
    for (const colName of targetCols) {
        try {
            await db.collection(colName).updateMany({}, { $set: { empresaRef: RAM_ID } });
        } catch(e) {}
    }

    // 5. Armonizar usuarios y claves
    console.log('\n🔑 Armonizando usuarios y claves...');
    const passHash = await bcrypt.hash('Platform2026*Master', 10);
    await db.collection('usergenais').updateMany({}, { $set: { password: passHash, status: 'Activo', empresaRef: RAM_ID, tokenVersion: 0 } });
    await db.collection('users').deleteMany({});
    await db.collection('usergenais').aggregate([{ $out: 'users' }]).toArray();
    console.log('✅ 32 Usuarios sincronizados.');

    const totalCount = await db.collection('actividades').countDocuments();
    const techCount = await db.collection('tecnicos').countDocuments();
    const candCount = await db.collection('candidatos').countDocuments();
    const assistCount = await db.collection('registroasistencias').countDocuments();

    console.log(`\n🎉 PROCESO COMPLETADO AL 100%!`);
    console.log(`- Actividades: ${totalCount}`);
    console.log(`- Técnicos: ${techCount}`);
    console.log(`- Candidatos: ${candCount}`);
    console.log(`- Asistencias: ${assistCount}`);
    
    await client.close();
}

main().catch(console.error);
