const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/genai');
        console.log('Connected to DB');
        const Actividad = mongoose.model('Actividad', new mongoose.Schema({}, { strict: false }));
        const total = await Actividad.countDocuments();
        console.log('Total activities:', total);
        
        const sample = await Actividad.findOne({ fecha: { $exists: true } });
        console.log('Sample activity keys:', Object.keys(sample?.toObject() || {}));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
