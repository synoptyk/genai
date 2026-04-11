const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const Tecnico = require('./server/platforms/agentetelecom/models/Tecnico');
    const Candidato = require('./server/platforms/rrhh/models/Candidato');

    const rut = '212872571';
    const rutConPuntos = '21.287.257-1';

    console.log('--- BUSCANDO TÉCNICO ---');
    const tec = await Tecnico.findOne({ $or: [{ rut: rut }, { rut: rutConPuntos }] });
    console.log('Técnico:', tec ? { id: tec._id, rut: tec.rut, idToa: tec.idRecursoToa, email: tec.email } : 'NO ENCONTRADO');

    console.log('\n--- BUSCANDO CANDIDATO ---');
    const cand = await Candidato.findOne({ $or: [{ rut: rut }, { rut: rutConPuntos }] });
    console.log('Candidato:', cand ? { id: cand._id, rut: cand.rut, idToa: cand.idRecursoToa, status: cand.status } : 'NO ENCONTRADO');

    if (cand && tec && !tec.idRecursoToa && cand.idRecursoToa) {
        console.log('\n✅ DESAJUSTE DETECTADO: El candidato tiene ID TOA pero el técnico no.');
    }

    await mongoose.disconnect();
}

check();
