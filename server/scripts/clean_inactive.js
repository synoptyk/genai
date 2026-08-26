require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Candidato = require('../platforms/rrhh/models/Candidato');
const RegistroAsistencia = require('../platforms/rrhh/models/RegistroAsistencia');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    
    // Find all inactive candidates with no contractEndDate/fechaFiniquito in the future
    const inactiveCands = await Candidato.find({ isActive: false }).lean();
    
    let deleted = 0;
    for (const cand of inactiveCands) {
        // If they have a recent end date, they might be valid for recent months. 
        // We will just delete all empty sync records for them.
        const res = await RegistroAsistencia.deleteMany({
            candidatoId: cand._id,
            estado: { $in: ['Ausente', 'No Contrat.', 'Libre'] }, // Only delete auto-generated records without marks
            hora: { $exists: false } // ensure no marks
        });
        deleted += res.deletedCount;
        if (res.deletedCount > 0) {
            console.log(`Deleted ${res.deletedCount} empty records for inactive candidate ${cand.rut} (${cand.fullName})`);
        }
    }
    
    console.log(`Cleanup finished. Total deleted: ${deleted}`);
    mongoose.disconnect();
}
run();
