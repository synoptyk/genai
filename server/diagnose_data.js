const mongoose = require('mongoose');
require('dotenv').config();

const UserGenAi = require('./platforms/auth/UserGenAi');
const Candidato = require('./platforms/rrhh/models/Candidato');
const Empresa = require('./platforms/auth/models/Empresa');

const diagnose = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.\n');

        const totalUsers = await UserGenAi.countDocuments();
        const usersWithRef = await UserGenAi.countDocuments({ empresaRef: { $exists: true, $ne: null } });
        const usersWithoutRef = totalUsers - usersWithRef;

        const totalCandidatos = await Candidato.countDocuments();
        const candidatosWithRef = await Candidato.countDocuments({ empresaRef: { $exists: true, $ne: null } });
        const candidatosWithoutRef = totalCandidatos - candidatosWithRef;

        const empresas = await Empresa.find();

        console.log('--- DIAGNOSTIC REPORT ---');
        console.log(`Empresas found: ${empresas.length}`);
        empresas.forEach(e => console.log(` - ${e.nombre} (${e._id})`));
        
        console.log('\n--- USERS ---');
        console.log(`Total: ${totalUsers}`);
        console.log(`With empresaRef: ${usersWithRef}`);
        console.log(`Without empresaRef (ORPHANED): ${usersWithoutRef}`);
        
        if (usersWithoutRef > 0) {
            const orphans = await UserGenAi.find({ empresaRef: { $exists: false } }).select('email name role');
            console.log('Orphan examples:', orphans.slice(0, 5).map(o => `${o.email} (${o.role})`));
        }

        console.log('\n--- CANDIDATOS ---');
        console.log(`Total: ${totalCandidatos}`);
        console.log(`With empresaRef: ${candidatosWithRef}`);
        console.log(`Without empresaRef (ORPHANED): ${candidatosWithoutRef}`);

        if (candidatosWithoutRef > 0) {
            const orphans = await Candidato.find({ empresaRef: { $exists: false } }).select('fullName email');
            console.log('Orphan examples:', orphans.slice(0, 5).map(o => `${o.fullName}`));
        }

        console.log('\n-----------------------');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
        process.exit(1);
    }
};

diagnose();
