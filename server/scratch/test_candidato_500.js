const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');
const Proyecto = require('../platforms/rrhh/models/Proyecto');
const Empresa = require('../platforms/auth/models/Empresa');

async function test() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const id = '6a30772e6854ee283c82a3c3';
    console.log(`Searching for candidate ${id}...`);
    
    // Find directly
    const direct = await Candidato.findById(id);
    if (!direct) {
      console.log('Candidate not found at all!');
      process.exit(0);
    }
    console.log('Found directly without population:', direct);

    // Try finding and populating
    console.log('Trying with population...');
    const populated = await Candidato.findById(id)
      .populate('projectId')
      .populate('empresaRef');
    console.log('Populated successfully:', populated);
  } catch (err) {
    console.error('ERROR OCCURRED:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
