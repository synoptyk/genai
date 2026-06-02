require('dotenv').config();
const mongoose = require('mongoose');

const Schema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', Schema, 'users');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).limit(1);
  console.log('User found:', users[0].email);
  process.exit(0);
}
run().catch(console.error);
