const mongoose = require('mongoose');
require('dotenv').config();

// Load Models
const PlatformUser = require('./platforms/auth/PlatformUser');
const Candidato = require('./platforms/rrhh/models/Candidato');
const Empresa = require('./platforms/auth/models/Empresa');
const Producto = require('./platforms/logistica/models/Producto');
const SolicitudCompra = require('./platforms/logistica/models/SolicitudCompra');
const OrdenCompra = require('./platforms/logistica/models/OrdenCompra');
const Tecnico = require('./platforms/agentetelecom/models/Tecnico');

const migrate = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Get or Create Default Empresas
        let empresaGenAi = await Empresa.findOne({ nombre: 'GEN AI' });
        if (!empresaGenAi) {
            console.log('🏢 Creating empresa GEN AI...');
            empresaGenAi = new Empresa({
                nombre: 'GEN AI',
                slug: 'gen-ai',
                rut: '76.000.000-1',
                plan: 'enterprise',
                estado: 'Activo'
            });
            await empresaGenAi.save();
        }

        let empresaRam = await Empresa.findOne({ nombre: 'RAM' });
        if (!empresaRam) {
            console.log('🏢 Creating empresa RAM...');
            empresaRam = new Empresa({
                nombre: 'RAM',
                slug: 'ram',
                rut: '77.000.000-K', // Placeholder RUT
                plan: 'enterprise',
                estado: 'Activo'
            });
            await empresaRam.save();
        }

        console.log(`✅ GEN AI ID: ${empresaGenAi._id}`);
        console.log(`✅ RAM ID: ${empresaRam._id}`);

        const models = [
            { name: 'Usuarios', model: PlatformUser, target: empresaGenAi },
            { name: 'Candidatos', model: Candidato, target: empresaRam }, // Asignar Captura de Talento a RAM
            { name: 'Tecnicos', model: Tecnico, target: empresaRam },   // Asignar Tecnicos a RAM
            { name: 'Productos', model: Producto, target: empresaGenAi },
            { name: 'Solicitudes', model: SolicitudCompra, target: empresaGenAi },
            { name: 'Ordenes', model: OrdenCompra, target: empresaGenAi }
        ];

        for (const item of models) {
            const total = await item.model.countDocuments();
            const orphaned = await item.model.countDocuments({ 
                $or: [
                    { empresaRef: { $exists: false } },
                    { empresaRef: null }
                ]
            });

            console.log(`\n📦 Migrating ${item.name} to ${item.target.nombre}:`);
            console.log(` - Total: ${total}`);
            console.log(` - Orphaned: ${orphaned}`);

            if (orphaned > 0) {
                const result = await item.model.updateMany(
                    { 
                        $or: [
                            { empresaRef: { $exists: false } },
                            { empresaRef: null }
                        ]
                    },
                    { $set: { empresaRef: item.target._id } }
                );
                console.log(` ✅ Updated ${result.modifiedCount} records to ${item.target.nombre}.`);
            } else {
                console.log(' ✅ No records need migration.');
            }
        }

        console.log('\n✨ Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Error:', error);
        process.exit(1);
    }
};

migrate();
