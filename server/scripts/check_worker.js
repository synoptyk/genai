const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');

const findWorker = async () => {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        const worker = await Candidato.findOne({ fullName: /JULIO ALBERTO SOTO/i });
        if (worker) {
            console.log('Worker Found:', JSON.stringify({
                fullName: worker.fullName,
                rut: worker.rut,
                baseSalary: worker.sueldoBase,
                tieneCargas: worker.tieneCargas,
                listaCargas: worker.listaCargas,
                bonuses: worker.bonuses,
                previsionSalud: worker.previsionSalud,
                afp: worker.afp
            }, null, 2));
        } else {
            console.log('Worker Not Found');
        }
        await mongoose.disconnect();
    } catch (e) { 
        console.error('Error:', e.message); 
        process.exit(1);
    }
};

findWorker();
