const mongoose = require('mongoose');
const BonoMensualConsolidado = require('./platforms/admin/models/BonoMensualConsolidado');

mongoose.connect('mongodb://localhost:27017/tu_base_de_datos', { // Wait, I don't know the DB URL.
