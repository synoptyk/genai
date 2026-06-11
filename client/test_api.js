const axios = require('axios');
const token = require('fs').readFileSync('/Users/mauro/.gemini/token', 'utf8').trim();
axios.get('http://localhost:5003/api/admin/bonos/closure/2026/05', {
  headers: { Authorization: `Bearer ${token}` }
}).then(res => console.log(JSON.stringify(res.data, null, 2)))
.catch(err => console.error(err.message));
