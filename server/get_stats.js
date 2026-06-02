require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', Schema, 'users');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'sdelgado@synoptik.cl' });
  if (!user) {
      console.log('User not found');
      process.exit(1);
  }
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  const options = {
      hostname: 'localhost',
      port: 5003,
      path: '/api/bot/produccion-stats?desde=2026-05-01&hasta=2026-05-31&estado=Completado&empresaFilter=66b59d9f9c0635e9f1681ab0',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
  };
  
  const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
          const json = JSON.parse(data);
          const julio = json.tecnicos.find(t => String(t.id).includes('565') || String(t.rut).includes('100710811') || String(t.nombre).toUpperCase().includes('JULIO'));
          console.log(`API Julio:`, julio);
          process.exit(0);
      });
  });
  req.on('error', e => { console.error(e); process.exit(1); });
  req.end();
}
run().catch(console.error);
