const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://ceo_synoptyk_reclutando:ReclutaSeguro.%23%23@clusterreclutando.im7etzo.mongodb.net/reclutando?retryWrites=true&w=majority&appName=ClusterReclutando';

const cleanRut = (r) => (r || "").toString().replace(/[^0-9kK]/g, '').toUpperCase().trim();

const tecnicoSchema = new mongoose.Schema({}, { strict: false, collection: 'tecnicos' });
const Tecnico = mongoose.model('Tecnico', tecnicoSchema);

async function fix() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        const all = await Tecnico.find().sort({ updatedAt: -1 });
        const seen = new Set();
        let deleted = 0;
        let updated = 0;
        let kept = 0;

        for (const t of all) {
            if (!t.rut) {
                await Tecnico.findByIdAndDelete(t._id);
                deleted++;
                continue;
            }
            const r = cleanRut(t.rut);
            // Identificador único es r + empresaRef (si existe)
            const uniqueId = r + (t.empresaRef ? t.empresaRef.toString() : '');

            if (seen.has(uniqueId)) {
                console.log(`Deleting duplicate: ${t.rut} (${t._id})`);
                await Tecnico.findByIdAndDelete(t._id);
                deleted++;
            } else {
                seen.add(uniqueId);
                kept++;
                if (t.rut !== r) {
                    console.log(`Fixing RUT format: ${t.rut} -> ${r}`);
                    await Tecnico.findByIdAndUpdate(t._id, { rut: r });
                    updated++;
                }
            }
        }
        console.log(`✅ SUCCESS:\n- Unique records kept: ${kept}\n- Duplicates deleted: ${deleted}\n- Formats corrected: ${updated}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

fix();
