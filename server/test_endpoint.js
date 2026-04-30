const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NzBkZThhZTMzNGY1MDAwMTI2YmY1YWMiLCJmdWxsTmFtZSI6Ik1hdXJpY2lvIEJhcnJpZW50b3MiLCJlbWFpbCI6Im1iYXJyaWVudG9zQHJhbWJveC5jbCIsImVtcHJlc2FSZWY6IjY3MGRlOGFhMzM0ZjUwMDAxMjZiZjVhYiIsInBhc3N3b3JkIjoiJDJhJDEwJHA4NjkyWkJaSHBLcVk1TlpZTFJ6V1V1QmJMbWEyUVZLMFlrNzRmVmJ0NGJDaDhkck5tQnZlIiwicm9sZSI6ImFkbWluIiwic3RhdHVzIjoiYWN0aXZlIiwicGVybWlzc2lvbnMiOlsicmVuZF9vcGVyYXRpdm86dmVyIl0sImlhdCI6MTcxNzAwMDAwMCwiZXhwIjoxNzE3MDAwMDAwfQ.fakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefake';

const options = {
  hostname: 'localhost',
  port: 5003,
  path: '/api/produccion-dia-telecom',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('✅ Endpoint response:');
      console.log('Total pts:', json.stats.totalPts);
      console.log('Total órdenes:', json.stats.totalOrders);
      console.log('Técnicos:', json.stats.uniqueTechs);
      console.log('\nPrimeros 3 técnicos:');
      json.tecnicos.slice(0, 3).forEach((t, i) => {
        console.log(`${i+1}. ${t.fullName}: ${t.monthTotal} pts, ${t.ordersCount} órdenes`);
      });
    } catch (e) {
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', e => console.error('Error:', e));
req.end();
