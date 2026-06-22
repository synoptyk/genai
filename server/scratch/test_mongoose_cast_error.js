const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');

async function test() {
  try {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const candidateId = '6a30772e6854ee283c82a3c3';
    const c = await Candidato.findById(candidateId);
    
    // Simulate setting empty string on Date fields
    c.contractStartDate = '';
    
    console.log('Attempting to save with contractStartDate = ""...');
    await c.save();
    console.log('Saved successfully!');
  } catch (err) {
    console.error('ERROR ON SAVE:', err.message);
    if (err.errors) {
      console.log('Validation errors:', Object.keys(err.errors));
    }
  } finally {
    await mongoose.disconnect();
  }
}

test();
