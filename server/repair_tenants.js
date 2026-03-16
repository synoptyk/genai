const mongoose = require('mongoose');
require('dotenv').config();

const UserGenAi = require('./platforms/auth/UserGenAi');
const Candidato = require('./platforms/rrhh/models/Candidato');
const Empresa = require('./platforms/auth/models/Empresa');
const Producto = require('./platforms/logistica/models/Producto');

const repair = async () => {
    try {
        console.log('⏳ Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // 1. Identify "Real" Companies vs "Placeholders"
        // Based on screenshot: 
        // Real RAM: "Ram Ingenieria" (77215779-2)
        // Real GenAI: "GenAI" (76.000.000-K)
        
        let realRam = await Empresa.findOne({ $or: [{ nombre: /Ram Ingenieria/i }, { rut: '77215779-2' }] });
        let placeholderRam = await Empresa.findOne({ nombre: 'RAM', rut: '77.000.000-K' });

        let realGenAi = await Empresa.findOne({ $or: [{ nombre: 'GenAI' }, { rut: '76.000.000-K' }] });
        let placeholderGenAi = await Empresa.findOne({ nombre: 'GEN AI', rut: '76.000.000-1' });

        console.log('\n--- TARGETS IDENTIFIED ---');
        console.log(`Real RAM: ${realRam?.nombre} (${realRam?._id})`);
        console.log(`Real GenAI: ${realGenAi?.nombre} (${realGenAi?._id})`);

        if (!realRam || !realGenAi) {
            console.error('❌ Could not find all real companies. Current companies in DB:');
            const all = await Empresa.find();
            all.forEach(e => console.log(` - ${e.nombre} (RUT: ${e.rut}) [${e._id}]`));
            
            // Try fallback: if my script created them but names match somehow
            if (!realRam) realRam = placeholderRam;
            if (!realGenAi) realGenAi = placeholderGenAi;
        }

        const fixUsers = async (emails, targetEmpresa) => {
            if (!targetEmpresa) return;
            const result = await UserGenAi.updateMany(
                { email: { $in: emails.map(e => new RegExp(e, 'i')) } },
                { $set: { empresaRef: targetEmpresa._id, empresa: { nombre: targetEmpresa.nombre, rut: targetEmpresa.rut, plan: targetEmpresa.plan } } }
            );
            console.log(` ✅ Linked ${result.modifiedCount} users to ${targetEmpresa.nombre}`);
        };

        const mergeCompanyData = async (fromId, toId) => {
            if (!fromId || !toId || fromId.toString() === toId.toString()) return;
            const models = [UserGenAi, Candidato, Producto];
            for (const Model of models) {
                const res = await Model.updateMany({ empresaRef: fromId }, { $set: { empresaRef: toId } });
                console.log(` 🚚 Moved ${res.modifiedCount} records from legacy company to ${toId}`);
            }
            // Cleanup placeholder
            await Empresa.findByIdAndDelete(fromId);
            console.log(` 🧹 Deleted placeholder company ${fromId}`);
        };

        // --- EXECUTION ---

        // Fix RAM Team
        const ramEmails = ['maurobflores@gmail.com', 'jimmy', 'ruby', 'ricardo'];
        console.log('\n🔗 Linking RAM management team...');
        await fixUsers(ramEmails, realRam);

        // Merge placeholder RAM if it exists
        if (placeholderRam && realRam && placeholderRam._id.toString() !== realRam._id.toString()) {
            console.log('\n🔄 Merging duplicate RAM companies...');
            await mergeCompanyData(placeholderRam._id, realRam._id);
        }

        // Merge placeholder GEN AI if it exists
        if (placeholderGenAi && realGenAi && placeholderGenAi._id.toString() !== realGenAi._id.toString()) {
            console.log('\n🔄 Merging duplicate GEN AI companies...');
            await mergeCompanyData(placeholderGenAi._id, realGenAi._id);
        }

        // Ensure leftover GEN AI users (like Mauricio) are linked to real GenAI
        console.log('\n🔗 Linking Mauricio to real GenAI...');
        await fixUsers(['ceo@synoptyk.cl'], realGenAi);

        console.log('\n✨ Repair completed.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Repair Error:', error);
        process.exit(1);
    }
};

repair();
