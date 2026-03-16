const mongoose = require('mongoose');
require('dotenv').config();

// Load Models (Adjust paths if needed based on your structure)
const SolicitudCompra = require('../platforms/logistica/models/SolicitudCompra');
const OrdenCompra = require('../platforms/logistica/models/OrdenCompra');
const Producto = require('../platforms/logistica/models/Producto');
const Tecnico = require('../platforms/agentetelecom/models/Tecnico');
const Vehiculo = require('../platforms/agentetelecom/models/Vehiculo');
const Actividad = require('../platforms/agentetelecom/models/Actividad');
const Empresa = require('../platforms/auth/models/Empresa');

const sanitize = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Actividades: Eliminar simuladas
        const actResult = await Actividad.deleteMany({ 
            $or: [
                { comentarios: /simula/i },
                { clienteAsociado: /simula/i },
                { ordenId: /TEST/i }
            ]
        });
        console.log(`🧹 Actividades eliminadas: ${actResult.deletedCount}`);

        // 2. Técnicos: Eliminar demo/test
        const tecResult = await Tecnico.deleteMany({
            $or: [
                { nombres: /test/i },
                { nombres: /demo/i },
                { rut: /12345678/ }
            ]
        });
        console.log(`🧹 Técnicos eliminados: ${tecResult.deletedCount}`);

        // 3. Vehículos: Eliminar demo
        const vehResult = await Vehiculo.deleteMany({
            $or: [
                { patente: /TEST/i },
                { patente: /DEMO/i }
            ]
        });
        console.log(`🧹 Vehículos eliminados: ${vehResult.deletedCount}`);

        // 4. Productos: Eliminar SKU de prueba
        const prodResult = await Producto.deleteMany({
            $or: [
                { sku: /PRD-00000/ },
                { nombre: /test/i },
                { nombre: /demo/i }
            ]
        });
        console.log(`🧹 Productos eliminados: ${prodResult.deletedCount}`);

        // 5. Empresas: Limpiar integración SII de simulaciones si las hubiera
        // (En este caso buscamos empresas que se llamen "Prueba" o similar)
        const empResult = await Empresa.deleteMany({
            $or: [
                { nombre: /Empresa de Prueba/i },
                { nombre: /Simulator/i }
            ]
        });
        console.log(`🧹 Empresas de prueba eliminadas: ${empResult.deletedCount}`);

        console.log('\n✨ Saneamiento completado con éxito.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante el saneamiento:', error);
        process.exit(1);
    }
};

sanitize();
