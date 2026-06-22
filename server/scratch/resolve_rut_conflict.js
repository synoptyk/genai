const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB.');

    const inactiveId = '6a1da26a4265d045fc34af11';
    const inactiveCandidate = await Candidato.findById(inactiveId);
    
    if (inactiveCandidate) {
      console.log(`Found inactive candidate: ${inactiveCandidate.fullName} (RUT: ${inactiveCandidate.rut})`);
      
      // Release the RUT by appending a suffix
      const originalRut = inactiveCandidate.rut;
      const newRut = `${originalRut}-INACTIVO`;
      
      inactiveCandidate.rut = newRut;
      // We temporarily bypass validation if needed, but since it is a save on a normal model, Mongoose pre-save formatting will run
      // Let's bypass pre-save formatRut if it fails on suffixes, or modify it directly in MongoDB using updateOne
      console.log(`Updating RUT in MongoDB: ${originalRut} -> ${newRut}...`);
      await Candidato.updateOne({ _id: inactiveId }, { $set: { rut: newRut } });
      
      console.log('RUT updated successfully in database!');
    } else {
      console.log('Inactive candidate not found.');
    }

  } catch (err) {
    console.error('Error during update:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
