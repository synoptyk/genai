const mongoose = require('mongoose');

const uri = "mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin&directConnection=true";

async function limpiarBase() {
    try {
        await mongoose.connect(uri);
        console.log("Conectado a la BD para limpieza profunda.");
        const Actividad = require('./platforms/agentetelecom/models/Actividad');
        
        const fechaInicio = new Date('2026-05-02T00:00:00Z');
        const fechaFin = new Date('2026-05-09T23:59:59Z');
        
        const result = await Actividad.deleteMany({
            fecha: {
                $gte: fechaInicio,
                $lte: fechaFin
            }
        });
        
        console.log(`¡EXITO! Eliminados ${result.deletedCount} registros entre el 2 y el 9 de mayo.`);
        process.exit(0);
    } catch (e) {
        console.error("Error al limpiar:", e);
        process.exit(1);
    }
}

limpiarBase();
