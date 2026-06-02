require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./platforms/auth/models/User');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({}).lean();
    users.forEach(u => console.log(u.email, u.role));
    process.exit(0);
}
run().catch(console.error);
