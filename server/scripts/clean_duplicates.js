require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const RegistroAsistencia = require('../platforms/rrhh/models/RegistroAsistencia');

async function clean() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const duplicates = await RegistroAsistencia.find({
        fecha: { $type: "date" }
    }).lean();

    let deleted = 0;
    for (const record of duplicates) {
        if (record.fecha.toISOString().includes('T12:00:00.000Z') && (record.syncContractual || record.syncFromProduccion)) {
            const dateStr = record.fecha.toISOString().split('T')[0];
            const originalDate = new Date(dateStr + 'T00:00:00.000Z');
            
            const original = await RegistroAsistencia.findOne({
                candidatoId: record.candidatoId,
                fecha: originalDate
            });

            if (original) {
                console.log(`Deleting duplicate T12 for candidate ${record.candidatoId} on ${dateStr}`);
                await RegistroAsistencia.deleteOne({ _id: record._id });
                deleted++;
            } else {
                console.log(`Fixing time for isolated T12 for candidate ${record.candidatoId} on ${dateStr}`);
                await RegistroAsistencia.updateOne({ _id: record._id }, { $set: { fecha: originalDate } });
                deleted++;
            }
        }
    }
    console.log(`Cleanup finished. Affected records: ${deleted}`);
    mongoose.disconnect();
}
clean();
