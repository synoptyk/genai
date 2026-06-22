const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/synoptik_rrhh').then(async () => {
    const Turno = mongoose.model('Turno', new mongoose.Schema({}, { strict: false }));
    const turnos = await Turno.find({}).lean();
    console.log(JSON.stringify(turnos, null, 2));
    process.exit();
});
