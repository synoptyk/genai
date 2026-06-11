const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { runDailyAnomalyCheck } = require('../utils/anomaliesService');
const Empresa = require('../platforms/auth/models/Empresa');

async function test() {
  try {
    const mongoUri = process.env.MONGO_URI;
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    // Find a company
    const empresa = await Empresa.findOne({});
    if (!empresa) {
      console.error('No company found in database.');
      await mongoose.connection.close();
      process.exit(1);
    }
    console.log(`Found company: ${empresa.nombre} (${empresa._id})`);

    // Run audit for a past date to check calculations
    // We use a date in May 2026 as reference
    const result = await runDailyAnomalyCheck(empresa._id, new Date('2026-05-15'));
    console.log('Audit completed. Result:', JSON.stringify(result, null, 2));

    await mongoose.connection.close();
    console.log('Database connection closed.');
  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }
}

test();
