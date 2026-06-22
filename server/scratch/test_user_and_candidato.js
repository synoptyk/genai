const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PlatformUser = require('../platforms/auth/PlatformUser');
const Candidato = require('../platforms/rrhh/models/Candidato');
const Proyecto = require('../platforms/rrhh/models/Proyecto');
const Empresa = require('../platforms/auth/models/Empresa');
const Cliente = require('../platforms/agentetelecom/models/Cliente'); // just in case
const Turno = require('../platforms/rrhh/models/Turno'); // just in case

async function test() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    // Find all users
    const users = await PlatformUser.find({}).lean();
    console.log('Total users in DB:', users.length);
    users.forEach(u => {
      console.log(`User: ${u.email}, role: ${u.role}, empresaRef: ${u.empresaRef}`);
    });

    const candidateId = '6a30772e6854ee283c82a3c3';
    
    // Simulate the query for each user to see if it throws an error
    for (const u of users) {
      try {
        console.log(`\nSimulating query for user ${u.email} (empresaRef: ${u.empresaRef})...`);
        const c = await Candidato.findOne({ _id: candidateId, empresaRef: u.empresaRef })
          .populate('projectId')
          .populate('empresaRef');
        console.log(`Result for ${u.email}:`, c ? `Found (${c.fullName})` : 'Not Found (404)');
      } catch (err) {
        console.error(`ERROR for user ${u.email}:`, err);
      }
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
