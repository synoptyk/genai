const mongoose = require('mongoose');
const fs = require('fs');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const db = mongoose.connection.db;
        const Actividad = db.collection('actividads');

        const fechaInicio = new Date('2026-05-08T00:00:00Z');
        const fechaFin = new Date('2026-05-09T23:59:59Z');

        const query = { fecha: { $gte: fechaInicio, $lte: fechaFin } };
        
        // Group by technician and count activities
        const pipeline = [
            { $match: query },
            { 
                $group: { 
                    _id: "$ID Recurso", 
                    count: { $sum: 1 },
                    totalPuntos: { $sum: { $toDouble: "$Pts_Total_Baremo" } },
                    ordenIds: { $push: "$ordenId" },
                    empresas: { $addToSet: "$empresaRef" }
                } 
            },
            { $sort: { totalPuntos: -1 } },
            { $limit: 3 }
        ];

        const result = await Actividad.aggregate(pipeline).toArray();
        fs.writeFileSync('/Users/mauro/.gemini/antigravity/scratch/check_result.json', JSON.stringify(result, null, 2));
    } catch (e) {
        fs.writeFileSync('/Users/mauro/.gemini/antigravity/scratch/check_result.json', JSON.stringify({error: e.message}));
    } finally {
        await mongoose.disconnect();
    }
}
run();
