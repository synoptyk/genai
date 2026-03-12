const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in environment');
    process.exit(1);
}

// Minimal models for migration
const EmpresaConfig = mongoose.model('EmpresaConfig', new mongoose.Schema({
    departamentos: Array,
    areas: Array,
    cecos: Array
}, { strict: false }), 'empresaconfigs');

const Proyecto = mongoose.model('Proyecto', new mongoose.Schema({
    departamento: String,
    sede: String,
    subCeco: String
}, { strict: false }), 'proyectos');

const Candidato = mongoose.model('Candidato', new mongoose.Schema({
    departamento: String,
    sede: String,
    subCeco: String
}, { strict: false }), 'candidatos');

async function migrate() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('🍃 Connected to MongoDB');

        // 1. Migrate Proyectos
        console.log('🏗️ Migrating Proyectos...');
        const proyectos = await Proyecto.find({ $or: [{ departamento: { $exists: true } }, { subCeco: { $exists: true } }] });
        for (const p of proyectos) {
            const updates = {};
            if (p.departamento && !p.sede) {
                updates.sede = p.departamento;
            }
            // Remove obsolete fields
            const unset = { departamento: "", subCeco: "" };
            await Proyecto.updateOne({ _id: p._id }, { $set: updates, $unset: unset });
        }
        console.log(`✅ ${proyectos.length} Proyectos updated.`);

        // 2. Migrate Candidatos
        console.log('👥 Migrating Candidatos...');
        const candidatos = await Candidato.find({ $or: [{ departamento: { $exists: true } }, { subCeco: { $exists: true } }] });
        for (const c of candidatos) {
            const updates = {};
            if (c.departamento && !c.sede) {
                updates.sede = c.departamento;
            }
            const unset = { departamento: "", subCeco: "" };
            await Candidato.updateOne({ _id: c._id }, { $set: updates, $unset: unset });
        }
        console.log(`✅ ${candidatos.length} Candidatos updated.`);

        // 3. Migrate EmpresaConfig (Optional: Rename departamentos to Sedes if needed, 
        // but since we kept the field name 'departamentos' in the model for compatibility 
        // and just changed the internal schema, it should be fine).
        // However, let's ensure 'region' is present if missing.
        console.log('⚙️ Normalizing EmpresaConfig...');
        const configs = await EmpresaConfig.find();
        for (const conf of configs) {
            if (conf.departamentos) {
                const updatedDepts = conf.departamentos.map(d => {
                    if (typeof d === 'string') return { nombre: d, region: 'Metropolitana' };
                    return d;
                });
                await EmpresaConfig.updateOne({ _id: conf._id }, { $set: { departamentos: updatedDepts } });
            }
        }
        console.log('✅ EmpresaConfig normalized.');

        console.log('🏁 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
