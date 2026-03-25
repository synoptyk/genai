const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://maurobflores:Mbf16411496@cluster0.p0qon.mongodb.net/genai_db?retryWrites=true&w=majority";

async function diag() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");

        const Actividad = mongoose.model('Actividad', new mongoose.Schema({}, { strict: false }), 'actividads');
        const Tecnico = mongoose.model('Tecnico', new mongoose.Schema({}, { strict: false }), 'tecnicos');
        const Empresa = mongoose.model('Empresa', new mongoose.Schema({ nombre: String }, { strict: false }), 'empresas');

        const totalAct = await Actividad.countDocuments();
        console.log("Total Actividades:", totalAct);

        if (totalAct > 0) {
            const first10 = await Actividad.find().limit(10).lean();
            console.log("Muestra Actividades (primeras 10):", JSON.stringify(first10.map(a => ({ id: a.ordenId, fecha: a.fecha, empresa: a.empresaRef, idRecurso: a.ID_Recurso || a['ID Recurso'] })), null, 2));

            const distEmpresas = await Actividad.distinct('empresaRef');
            console.log("Empresas en Actividad:", distEmpresas);
        }

        const totalTec = await Tecnico.countDocuments();
        console.log("Total Tecnicos:", totalTec);

        const ram = await Empresa.findOne({ nombre: /Ram/i });
        if (ram) {
            console.log("Ram Ingeniería ID:", ram._id);
            const tecsRam = await Tecnico.find({ empresaRef: ram._id }).lean();
            console.log("Tecnicos de Ram:", tecsRam.length);
            console.log("IDs Recurso TOA de Ram:", tecsRam.map(t => t.idRecursoToa).filter(Boolean));
            
            const countRamAct = await Actividad.countDocuments({ empresaRef: ram._id });
            console.log("Actividades con empresaRef de Ram:", countRamAct);
        } else {
            console.log("Ram Ingeniería not found in empresas collection");
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

diag();
