const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/bot/produccion-stats',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (!json.tecnicos) {
        console.log('No tecnicos property');
        return;
      }
      const c = json.tecnicos.filter(t => t.name && t.name.toLowerCase().includes('gacit'));
      console.log('Encontrados:');
      c.forEach(x => console.log('- Name:', x.name, '| RUT:', x.rut, '| TOA:', x.idRecursoToa, '| ID Recurso:', x.idRecurso, '| source:', x.isVinculado ? 'RRHH' : 'Orphan'));
    } catch(e) {
      console.log('Error parsing JSON or empty', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});
req.end();
