require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const RegistroAsistencia = require('../platforms/rrhh/models/RegistroAsistencia');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const count = await RegistroAsistencia.countDocuments({ candidatoId: '6a1da26a4265d045fc34af11' });
    console.log("Inactive Alfonso records:", count);
    mongoose.disconnect();
}
run();
