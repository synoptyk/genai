const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PlatformUser = require('../platforms/auth/PlatformUser');

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const users = await PlatformUser.find({}).lean();
    console.log(`Found ${users.length} users. Calling API for each...`);

    const candidateId = '6a30772e6854ee283c82a3c3';
    const apiURL = `http://localhost:5003/api/rrhh/candidatos/${candidateId}`;

    for (const user of users) {
      // Sign token
      const token = jwt.sign(
        { id: user._id.toString(), version: user.tokenVersion || 0 },
        process.env.JWT_SECRET
      );

      try {
        const response = await axios.get(apiURL, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        console.log(`User: ${user.email} -> Status: ${response.status} (Success)`);
      } catch (err) {
        if (err.response) {
          console.log(`User: ${user.email} -> Status: ${err.response.status}`);
          if (err.response.status === 500) {
            console.log('Error data:', JSON.stringify(err.response.data, null, 2));
            // Break early since we found the 500 error
            break;
          }
        } else {
          console.error(`User: ${user.email} -> Request Error:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
