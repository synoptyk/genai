require('dotenv').config();
const mongoose = require('mongoose');

const Proyecto = require('./platforms/rrhh/models/Proyecto');
const Cliente = require('./platforms/agentetelecom/models/Cliente');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority',
        });
        console.log('Connected to DB');

        const proyectos = await Proyecto.find();
        console.log(`Found ${proyectos.length} projects`);

        const clientNames = [...new Set(proyectos.map(p => p.cliente).filter(c => typeof c === 'string'))];
        console.log(`Found ${clientNames.length} unique string clients:`, clientNames);

        for (const name of clientNames) {
            // Find or create client for each company that has it
            const projectsWithThisClient = proyectos.filter(p => p.cliente === name);
            
            for (const p of projectsWithThisClient) {
                let clienteDoc = await Cliente.findOne({ nombre: name, empresaRef: p.empresaRef });
                
                if (!clienteDoc) {
                    clienteDoc = new Cliente({
                        nombre: name,
                        empresaRef: p.empresaRef,
                        estado: 'Activo'
                    });
                    await clienteDoc.save();
                    console.log(`Created client: ${name} for company: ${p.empresaRef}`);
                }

                p.cliente = clienteDoc._id;
                await p.save();
                console.log(`Updated project: ${p.nombreProyecto} with client ID: ${clienteDoc._id}`);
            }
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
