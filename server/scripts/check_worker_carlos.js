const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');

const findWorker = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const worker = await Candidato.findOne({ fullName: /CARLOS JAVIER CASTILLO/i });
        if (worker) {
            console.log('Worker Found:', JSON.stringify({
                fullName: worker.fullName,
                rut: worker.rut,
                baseSalary: worker.sueldoBase,
                bonuses: worker.bonuses,
            }, null, 2));
        } else {
            console.log('Worker Not Found');
        }
        await mongoose.disconnect();
    } catch (e) { console.error('Error:', e.message); process.exit(1); }
};

findWorker();
