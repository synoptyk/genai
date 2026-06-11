require('dotenv').config();
const mongoose = require('mongoose');
const Schema = new mongoose.Schema({}, { strict: false });

const Candidato = mongoose.model('Candidato', Schema, 'candidatos');
const Actividad = mongoose.model('Actividad', Schema, 'actividades');

async function run() {
  await mongoose.connect('mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin');
  
  // Simulated techMap
  const techMap = {};
  const idToKey = {};
  const rutToKey = {};

  const cands = await Candidato.find({}).select('idRecurso idRecursoToa rut fullName').lean();
  
  cands.forEach(t => {
      const idRawToa = String(t.idRecursoToa || '').trim();
      const rutRaw = String(t.rut || '').trim().toLowerCase();
      const rutClean = rutRaw.replace(/[^0-9kK]/g, '');

      if (!rutClean && !idRawToa) return;

      const keysToa = [idRawToa.toLowerCase(), idRawToa.toLowerCase().replace(/^0+/, ''), idRawToa];
      
      let key = null;
      if (rutClean && rutToKey[rutClean]) key = rutToKey[rutClean];
      
      if (!key) {
        for (const k of keysToa) {
          if (idToKey[k]) { key = idToKey[k]; break; }
        }
      }
      
      if (!key) {
        key = keysToa[1] || keysToa[0] || `rut_${rutClean}`;
        techMap[key] = {
          name: t.fullName,
          idRecursoToa: idRawToa,
          rut: t.rut || '',
          orders: 0
        };
        if (rutClean) rutToKey[rutClean] = key;
        keysToa.forEach(k => { if(k) idToKey[k] = key; });
      }
  });

  console.log('Vicente in techMap directly?');
  for (const k in techMap) {
     if (techMap[k].name && techMap[k].name.includes('VICENTE')) {
         console.log(techMap[k]);
     }
  }

  const query = {
      fecha: { $gte: new Date('2026-06-01T00:00:00Z'), $lt: new Date('2026-07-01T00:00:00Z') },
      Estado: 'Completado'
  };
  
  const actividades = await Actividad.find(query).lean();
  
  actividades.forEach(doc => {
      let idRecursoRaw = doc.ID_RECURSO || doc.IDRECURSOTOA || doc.ID_RECURSO_TOA || doc.RECURSO || doc.TECNICO || '';
      const idRecurso = String(idRecursoRaw || '').trim().replace(/^0+/, '');
      const idLow = idRecurso.toLowerCase();
      const idClean = idLow.replace(/^0+/, '');
      
      let techKey = techMap[idRecurso] ? idRecurso : (idToKey[idLow] || idToKey[idClean] || idToKey[idRecurso] || '');
      
      if (techKey && techMap[techKey]) {
          techMap[techKey].orders++;
      } else {
          // Emulate what produccion-stats does for orphans
          const key = idClean || idLow || `id_${Math.random()}`;
          techMap[key] = {
             name: doc.NOMBRE || doc.RESOURCE_NAME || 'SIN NOMBRE',
             idRecursoToa: idRecurso,
             rut: '',
             orders: 1
          };
          idToKey[idLow] = key;
      }
  });

  console.log('Vicente in techMap after Actividades?');
  for (const k in techMap) {
     if (techMap[k].name && techMap[k].name.includes('VICENTE') && techMap[k].orders > 0) {
         console.log(techMap[k]);
     }
  }

  process.exit(0);
}
run().catch(console.error);
