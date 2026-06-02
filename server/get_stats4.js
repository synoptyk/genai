require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', Schema, 'users');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'ceo@synoptyk.cl' });
  const token = jwt.sign({ id: user._id.toString(), rut: user.rut, role: user.role, roleName: user.roleName, empresaRef: user.empresaRef }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  const options = {
      hostname: 'localhost',
      port: 5003,
      path: '/api/bot/produccion-stats?desde=2026-05-01&hasta=2026-05-31&estado=Completado',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
  };
  
  const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
          console.log(`API Response:`, data.substring(0, 500));
          process.exit(0);
      });
  });
  req.on('error', e => { console.error(e); process.exit(1); });
  req.end();
}
run().catch(console.error);
