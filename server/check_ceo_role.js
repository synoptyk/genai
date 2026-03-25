const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const UserGenAiSchema = new mongoose.Schema({
    email: { type: String, lowercase: true, trim: true },
    role: { type: String },
    name: { type: String },
    cargo: { type: String }
}, { collection: 'usergenais' }); // Exact collection name

const UserGenAi = mongoose.model('UserGenAiDiagnostic', UserGenAiSchema);

async function check() {
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        const user = await UserGenAi.findOne({ email: 'ceo@synoptyk.cl' });
        if (user) {
            console.log('User found:');
            console.log('Email:', user.email);
            console.log('Role:', user.role);
            console.log('Name:', user.name);
            console.log('Cargo:', user.cargo);
        } else {
            console.log('User not found: ceo@synoptyk.cl');
            const allUsers = await UserGenAi.find({}).limit(5);
            console.log('Sample users:', allUsers.map(u => ({ email: u.email, role: u.role })));
        }
        process.exit(0);
    } catch (err) {
        console.error('Connection/Query error:', err.message);
        process.exit(1);
    }
}
check();
