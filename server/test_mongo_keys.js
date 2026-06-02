const mongoose = require('mongoose');
const ConsumoCombustible = require('./platforms/agentetelecom/models/ConsumoCombustible');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/synoptik')
  .then(async () => {
    try {
      await ConsumoCombustible.bulkWrite([{
        updateOne: {
          filter: { comprobanteTransaccion: 'test1234' },
          update: {
            $set: {
              "Monto ($)": 1000,
              "Precio/Lt.": 1000,
              empresaRef: new mongoose.Types.ObjectId()
            }
          },
          upsert: true
        }
      }]);
      console.log('Success');
    } catch (e) {
      console.log('Error:', e.message);
    }
    process.exit(0);
  })
  .catch(console.error);
