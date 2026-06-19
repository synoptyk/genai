const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/genai';

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
