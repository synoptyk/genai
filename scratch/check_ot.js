const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function run() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    // Buscar actividad por ID_Orden en la colección correct 'actividades'
    const Actividades = mongoose.connection.db.collection('actividades');
    const act = await Actividades.findOne({
        $or: [
            { ordenId: '1283982657' },
            { ID_Orden: '1283982657' },
            { ID_Orden: 1283982657 },
            { ordenId: 1283982657 }
        ]
    });

    if (!act) {
        console.log("❌ Actividad no encontrada en la colección 'actividades'!");
    } else {
        console.log("✅ Actividad encontrada!");
        console.log(JSON.stringify(act, null, 2));
    }

    // Buscar usuario técnico por email en la colección 'usergenais'
    const UserGenais = mongoose.connection.db.collection('usergenais');
    const user = await UserGenais.findOne({ email: 'ricardill0231@gmail.com' });
    if (user) {
        console.log("✅ Usuario encontrado!");
        console.log("ID:", user._id);
        console.log("Email:", user.email);
        console.log("empresaRef:", user.empresaRef);
        console.log("Role:", user.role);
    } else {
        console.log("❌ Usuario ricardill0231@gmail.com no encontrado!");
    }

    await mongoose.disconnect();
}

run().catch(console.error);
