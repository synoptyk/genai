require('dotenv').config();
const mongoose = require('mongoose');
const EmailAccount = require('../platforms/comunicaciones/models/EmailAccount');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const accounts = await EmailAccount.find({}).lean();
        console.log("=== EMAIL ACCOUNTS ===");
        console.log(JSON.stringify(accounts, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
run();
