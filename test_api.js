const http = require('http');
http.get('http://localhost:5003/api/bot/produccion-stats', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 500)));
});
