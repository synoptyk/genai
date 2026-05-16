const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

const Tecnico = require('../platforms/agentetelecom/models/Tecnico');
const Actividad = require('../platforms/agentetelecom/models/Actividad');
const Candidato = require('../platforms/auth/models/Candidato'); // Ajustar si es necesario

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    const slug = (str) => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    // 1. Cargar Mapa de Técnicos
    const techs = await Tecnico.find({ idRecursoToa: { $exists: true, $ne: '' } }).lean();
    const techMap = new Map();
    techs.forEach(t => {
        const id = String(t.idRecursoToa || '').trim().replace(/^0+/, '');
        if (id) techMap.set(id, t.empresaRef);
        
        const nameParts = [t.nombre, t.nombres, t.apellidos].filter(Boolean).join(' ');
        const n = slug(nameParts);
        if (n) techMap.set(n, t.empresaRef);
    });

    // 2. Buscar Actividades del 8 y 9 de Mayo
    const fechaInicio = new Date('2026-05-08T00:00:00Z');
    const fechaFin = new Date('2026-05-10T23:59:59Z');

    const actividades = await Actividad.find({
        fecha: { $gte: fechaInicio, $lte: fechaFin }
    }).lean();

    console.log(`📊 Procesando ${actividades.length} actividades...`);

    let actualizadas = 0;
    let ops = [];

    for (const act of actividades) {
        const idRecurso = String(act['ID Recurso'] || '').trim().replace(/^0+/, '');
        const nombre = slug(act['Nombre']);
        
        const targetEmpresaRef = techMap.get(idRecurso) || techMap.get(nombre);

        if (targetEmpresaRef && String(act.empresaRef) !== String(targetEmpresaRef)) {
            ops.push({
                updateOne: {
                    filter: { _id: act._id },
                    update: { $set: { empresaRef: targetEmpresaRef } }
                }
            });
            actualizadas++;
        }
        
        if (ops.length >= 500) {
            await Actividad.bulkWrite(ops);
            ops = [];
            console.log(`   ... ${actualizadas} actualizadas`);
        }
    }

    if (ops.length > 0) {
        await Actividad.bulkWrite(ops);
    }

    console.log(`\n✅ PROCESO COMPLETADO`);
    console.log(`   - Total revisadas: ${actividades.length}`);
    console.log(`   - Total re-vinculadas: ${actualizadas}`);

    await mongoose.disconnect();
}

run().catch(console.error);
