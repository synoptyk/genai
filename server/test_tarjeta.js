const mongoose = require('mongoose');
const ConsumoCombustible = require('./platforms/agentetelecom/models/ConsumoCombustible');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/synoptik')
  .then(async () => {
    const docs = await ConsumoCombustible.find({}).sort({createdAt: -1}).limit(5);
    console.log(JSON.stringify(docs.map(d => ({ patente: d.patente, tarjeta: d.tarjeta, comprobante: d.comprobanteTransaccion })), null, 2));
    process.exit(0);
  })
  .catch(console.error);
