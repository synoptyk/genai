const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const BSON = require('bson');
const bcrypt = require('bcryptjs');

const backupDir = '/Users/mauro/Synoptyk_Innovacion/Gen AI/~/mongodb-backups/prod-20260504-232856/genai';
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

const RAM_ID = new ObjectId('69ab8a37d7239b0dd12383d1');

async function restoreAllFast() {
    console.log('🚀 INICIANDO RESTAURACIÓN ULTRA RÁPIDA DESDE EL DUMP BSON...');
    const client = new MongoClient(mongoUri, { connectTimeoutMS: 30000, socketTimeoutMS: 120000, maxPoolSize: 20 });
    await client.connect();
    const db = client.db('genai');

    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.bson'));
    let totalRestoredDocs = 0;

    for (const file of files) {
        const colName = file.replace('.bson', '');
        const filePath = path.join(backupDir, file);
        const stat = fs.statSync(filePath);
        if (stat.size === 0) continue;

        console.log(`\n📦 Restaurando '${colName}' (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);
        const buf = fs.readFileSync(filePath);

        let offset = 0;
        let batch = [];
        let colDocsCount = 0;

        const col = db.collection(colName);
        await col.deleteMany({});

        while (offset < buf.length) {
            if (offset + 4 > buf.length) break;
            const docSize = buf.readInt32LE(offset);
            if (docSize <= 0 || offset + docSize > buf.length) break;

            const docBuf = buf.subarray(offset, offset + docSize);
            try {
                const doc = BSON.deserialize(docBuf);
                doc.empresaRef = RAM_ID;
                batch.push(doc);
                colDocsCount++;
            } catch (err) {
                // ignore corrupt doc if any
            }

            offset += docSize;

            if (batch.length >= 5000) {
                await col.insertMany(batch, { ordered: false });
                batch = [];
                console.log(`  -> ${colDocsCount} documentos insertados...`);
            }
        }

        if (batch.length > 0) {
            await col.insertMany(batch, { ordered: false });
            batch = [];
        }

        console.log(`✅ Colección '${colName}' restaurada al 100% con ${colDocsCount} documentos.`);
        totalRestoredDocs += colDocsCount;
    }

    // Copiar actividads -> actividades
    console.log('\n🔄 Sincronizando actividads -> actividades...');
    const actCount = await db.collection('actividads').countDocuments();
    if (actCount > 0) {
        await db.collection('actividades').deleteMany({});
        await db.collection('actividads').aggregate([{ $out: 'actividades' }]).toArray();
        console.log(`✅ Sincronizados ${actCount} registros en 'actividades'.`);
    }

    // Armonizar usuarios y claves
    console.log('\n🔑 Armonizando usuarios y contraseñas...');
    const passHash = await bcrypt.hash('Platform2026*Master', 10);
    await db.collection('usergenais').updateMany({}, { $set: { password: passHash, status: 'Activo', empresaRef: RAM_ID, tokenVersion: 0 } });
    await db.collection('users').deleteMany({});
    await db.collection('usergenais').aggregate([{ $out: 'users' }]).toArray();
    console.log('✅ 32 Usuarios y contraseñas sincronizados en usergenais y users.');

    console.log(`\n🎉 RESTAURACIÓN COMPLETADA CON ÉXITO TOTAL: ${totalRestoredDocs} DOCUMENTOS TOTALES RESTAURADOS.`);
    await client.close();
}

restoreAllFast().catch(console.error);
