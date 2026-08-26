require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Candidato = require('../platforms/rrhh/models/Candidato');

async function run() {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    const cands = await Candidato.find({ rut: { $regex: '16.562.758-K', $options: 'i' } }).lean();
    console.log(cands.map(c => ({ _id: c._id, rut: c.rut, fullName: c.fullName, status: c.status, isActive: c.isActive })));
    mongoose.disconnect();
}
run();
