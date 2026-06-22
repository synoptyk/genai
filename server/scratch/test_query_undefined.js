const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');
const Proyecto = require('../platforms/rrhh/models/Proyecto');
const Empresa = require('../platforms/auth/models/Empresa');

async function test() {
  try {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const candidateId = '6a30772e6854ee283c82a3c3';

    console.log('\nQuerying with empresaRef: undefined...');
    try {
      const c = await Candidato.findOne({ _id: candidateId, empresaRef: undefined })
        .populate('projectId')
        .populate('empresaRef');
      console.log('Success (undefined)! Result:', c ? 'Found' : 'Not Found');
    } catch (err) {
      console.error('ERROR (undefined):', err.message, '\nStack:', err.stack);
    }

    console.log('\nQuerying with empresaRef: null...');
    try {
      const c = await Candidato.findOne({ _id: candidateId, empresaRef: null })
        .populate('projectId')
        .populate('empresaRef');
      console.log('Success (null)! Result:', c ? 'Found' : 'Not Found');
    } catch (err) {
      console.error('ERROR (null):', err.message, '\nStack:', err.stack);
    }

  } catch (err) {
    console.error('CRITICAL:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
