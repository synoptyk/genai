const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

// Load real models
const Candidato = require('../platforms/rrhh/models/Candidato');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  // Let's load the candidates/collaborators like the frontend does
  const colaboradores = await mongoose.connection.db.collection('candidatos').find({
    status: { $in: ['Contratado', 'Inducción', 'Operativo'] }
  }).toArray();

  console.log(`Loaded ${colaboradores.length} active/hired candidates from DB`);

  // Let's call the produccion-stats API logic or fetch directly
  const db = mongoose.connection.db;
  const actCollection = db.collection('actividades');

  // Query activities for June 2026
  const activities = await actCollection.find({
    fecha: {
      $gte: new Date('2026-06-01T00:00:00Z'),
      $lte: new Date('2026-06-30T23:59:59Z')
    },
    Estado: 'Completado'
  }).toArray();

  console.log(`Loaded ${activities.length} completed activities for June 2026`);

  // Let's build the techMap exactly like server.js does
  const idToKey = {};
  const rutToKey = {};
  const nameToMapKey = {};
  const techMap = {};

  const getKeys = (id) => {
    if (!id) return [];
    const low = String(id).toLowerCase().trim();
    const clean = low.replace(/^0+/, '');
    return [low, clean, String(id).trim()];
  };

  colaboradores.forEach(col => {
    const idRawToa = String(col.idRecursoToa || '').trim();
    const idRawRec = String(col.idRecurso || '').trim();
    const rutRaw = String(col.rut || '').trim().toLowerCase();
    const rutClean = rutRaw.replace(/[^0-9kK]/g, '');

    const key = col._id.toString();

    techMap[key] = {
      name: col.fullName || col.name,
      rut: col.rut,
      idRecursoToa: col.idRecursoToa,
      dailyMap: {}
    };

    if (rutClean) rutToKey[rutClean] = key;

    const keysToa = getKeys(idRawToa);
    const keysRec = getKeys(idRawRec);
    [...keysToa, ...keysRec].forEach(k => {
      if (k) {
        idToKey[k] = key;
        const num = parseInt(k);
        if (!isNaN(num)) idToKey[num] = key;
      }
    });

    const rawName = col.fullName || col.name || '';
    const name = rawName.trim().toUpperCase();
    const normalizeName = (s) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normName = normalizeName(name);
    
    const nameParts = normName.split(' ').filter(Boolean);
    const nameVariations = [
      normName,
      nameParts.join(' '),
      nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[2]}` : null,
      nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}` : null,
    ].filter(Boolean);

    nameVariations.forEach(nv => {
      if (nv) nameToMapKey[nv] = key;
    });
  });

  // Now, map activities to techMap
  let matched = 0;
  let unmatched = 0;
  const unmatchedNames = new Set();

  activities.forEach(act => {
    const idRecurso = String(act['ID Recurso'] || act.idRecurso || act.ID_RECURSO || act.RECURSO || '').trim();
    const techName = String(act['Técnico'] || act.Técnico || act.nombre || act.NOMBRE || '').trim();

    let techKey = null;

    if (idRecurso) {
      const idLow = idRecurso.toLowerCase();
      const idClean = idLow.replace(/^0+/, '');
      techKey = idToKey[idLow] || idToKey[idClean] || idToKey[idRecurso];
    }

    if (!techKey && techName) {
      const normalizeName = (s) => (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
      const normName = normalizeName(techName);
      const nameParts = normName.split(' ').filter(Boolean);
      const nameVariations = [
        normName,
        nameParts.join(' '),
        nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[2]}` : null,
        nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}` : null,
      ].filter(Boolean);

      for (const nv of nameVariations) {
        if (nameToMapKey[nv]) {
          techKey = nameToMapKey[nv];
          break;
        }
      }
    }

    if (techKey) {
      matched++;
      const t = techMap[techKey];
      const dateStr = act.fecha ? new Date(act.fecha).toISOString().split('T')[0] : '';
      if (dateStr) {
        if (!t.dailyMap[dateStr]) t.dailyMap[dateStr] = { orders: 0 };
        t.dailyMap[dateStr].orders++;
      }
    } else {
      unmatched++;
      unmatchedNames.add(`${idRecurso} - ${techName}`);
    }
  });

  console.log(`\nMatching stats:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  Unique unmatched names: ${unmatchedNames.size}`);

  console.log('\n--- SAMPLE UNMATCHED NAMES (first 10) ---');
  console.log(Array.from(unmatchedNames).slice(0, 10));

  console.log('\n--- DETAILED CHECK FOR KEY TECHNICIANS ---');
  const targetColabs = colaboradores.filter(c => 
    c.fullName.includes('BADILLA') || 
    c.fullName.includes('OSORIO') || 
    c.fullName.includes('CASTILLO')
  );

  targetColabs.forEach(col => {
    const key = col._id.toString();
    const t = techMap[key];
    console.log(`\nName: ${col.fullName}`);
    console.log(`  RUT: ${col.rut}`);
    console.log(`  TOA ID: ${col.idRecursoToa}`);
    console.log(`  Has dailyMap entries?`, Object.keys(t.dailyMap).length > 0 ? Object.keys(t.dailyMap) : 'NO');
  });

  await mongoose.connection.close();
}

run().catch(console.error);
