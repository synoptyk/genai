const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PlatformUser = require('../platforms/auth/PlatformUser');
const Candidato = require('../platforms/rrhh/models/Candidato');

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const user = await PlatformUser.findOne({ email: 'mbarrientos@rambox.cl' });
    if (!user) {
      console.error('Test user not found!');
      return;
    }

    const candidateId = '6a30772e6854ee283c82a3c3';
    const candidato = await Candidato.findById(candidateId).lean();
    if (!candidato) {
      console.error('Candidate not found!');
      return;
    }

    // Convert candidato to plain object similar to what client sends
    // The client sends the candidate document fields
    const payload = {
      ...candidato,
      fullName: candidato.fullName + ' (Test Update)' // mock modification
    };

    const token = jwt.sign(
      { id: user._id.toString(), version: user.tokenVersion || 0 },
      process.env.JWT_SECRET
    );

    console.log('Sending PUT request to server...');
    const apiURL = `http://localhost:5003/api/rrhh/candidatos/${candidateId}`;

    try {
      const response = await axios.put(apiURL, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('PUT SUCCESS! Status:', response.status);
    } catch (err) {
      if (err.response) {
        console.log('PUT FAILED! Status:', err.response.status);
        console.log('Error Data:', JSON.stringify(err.response.data, null, 2));
      } else {
        console.error('Request Error:', err.message);
      }
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
