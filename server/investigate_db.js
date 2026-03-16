const mongoose = require('mongoose');
require('dotenv').config();

const UserGenAi = require('./platforms/auth/UserGenAi');
const Empresa = require('./platforms/auth/models/Empresa');

const investigate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('--- EMPRESAS ---');
        const empresas = await Empresa.find();
        empresas.forEach(e => {
            console.log(`[${e._id}] Name: "${e.nombre}" | RUT: ${e.rut} | Slug: ${e.slug}`);
        });

        console.log('\n--- TARGET USERS ---');
        const targetEmails = ['maurobflores@gmail.com', 'jimmy', 'ruby', 'ricardo'];
        const users = await UserGenAi.find({ 
            $or: [
                { email: { $in: targetEmails.map(e => new RegExp(e, 'i')) } },
                { name: { $in: targetEmails.map(e => new RegExp(e, 'i')) } }
            ]
        });

        users.forEach(u => {
            console.log(`User: ${u.email} | Name: ${u.name} | Role: ${u.role} | Ref: ${u.empresaRef} | Legacy Empresa: ${JSON.stringify(u.empresa)}`);
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

investigate();
