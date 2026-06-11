const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI;

// Load real schemas
const Candidato = require('../platforms/rrhh/models/Candidato');
const Tecnico = require('../platforms/rrhh/models/Candidato'); // Tecnicos resides in same/other
const Actividad = require('../platforms/operaciones/models/TurnoSupervisor'); // Or find the schema for Actividad
const Empresa = require('../platforms/auth/models/Empresa');

// Mock req, res to run the endpoint
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  // Query all candidates and find unique company refs
  const candsVal = await mongoose.connection.db.collection('candidatos').find({}).toArray();
  const dbTechs = await mongoose.connection.db.collection('tecnicos').find({}).toArray();
  
  console.log(`Loaded ${candsVal.length} candidates, ${dbTechs.length} tecnicos from DB`);

  // Build techMap
  const techMap = {};
  const idToKey = {};
  const rutToKey = {};
  const nameToMapKey = {};

  const validTecnicoIds = new Set(); 

  const addToTechMap = (t, source) => {
    const idRawToa = String(t.idRecursoToa || '').trim();
    const idRawRec = String(t.idRecurso || '').trim();
    const rutRaw = String(t.rut || '').trim().toLowerCase();
    const rutClean = rutRaw.replace(/[^0-9kK]/g, '');

    if (!rutClean && !idRawToa && !idRawRec) return;

    const getKeys = (id) => {
      if (!id) return [];
      const low = id.toLowerCase();
      const clean = low.replace(/^0+/, '');
      return [low, clean, id];
    };

    const keysToa = getKeys(idRawToa);
    const keysRec = getKeys(idRawRec);

    let key = null;
    if (rutClean && rutToKey[rutClean]) key = rutToKey[rutClean];
    
    if (!key) {
      for (const k of [...keysToa, ...keysRec]) {
        if (idToKey[k]) {
          key = idToKey[k];
          break;
        }
      }
    }
    
    const rawName = t.name || t.fullName || (t.nombres ? `${t.nombres} ${t.apellidos || ''}` : '') || 'Sin Nombre';
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

    if (!key) {
      const cleanIdToUse = keysToa[1] || keysRec[1];
      const lowIdToUse = keysToa[0] || keysRec[0];
      key = cleanIdToUse || lowIdToUse || (rutClean ? `rut_${rutClean}` : `id_${Math.random()}`);
      
      techMap[key] = {
        name,
        idRecursoToa: idRawToa || idRawRec,
        idRecurso: idRawRec || idRawToa,
        rut: t.rut || '',
        orders: 0,
        ptsTotal: 0,
        dailyMap: {},
        source
      };

      if (rutClean) rutToKey[rutClean] = key;
      [...keysToa, ...keysRec].forEach(k => {
          if (k) {
              idToKey[k] = key;
              const num = parseInt(k);
              if (!isNaN(num)) idToKey[num] = key;
          }
      });
      nameVariations.forEach(nv => { if (nv) nameToMapKey[nv] = key; });
    } else {
      const ex = techMap[key];
      if (t.rut && !ex.rut) {
        ex.rut = t.rut;
        rutToKey[rutClean] = key;
      }
      if (idRawToa && !ex.idRecursoToa) ex.idRecursoToa = idRawToa;
      if (idRawRec && !ex.idRecurso) ex.idRecurso = idRawRec;
      [...keysToa, ...keysRec].forEach(k => {
          if (k) {
              idToKey[k] = key;
              const num = parseInt(k);
              if (!isNaN(num)) idToKey[num] = key;
          }
      });
    }
  };

  candsVal.forEach(c => addToTechMap(c, 'candidato'));
  dbTechs.forEach(t => addToTechMap(t, 'tecnico'));

  // Load activities in June 2026 for this company's restricted IDs
  const restrictedIDs = new Set();
  const processItem = (t) => {
    const id1 = String(t.idRecursoToa || '').trim();
    const id2 = String(t.idRecurso || t.rut || '').trim();
    [id1, id2].forEach(rawId => {
      if (!rawId) return;
      restrictedIDs.add(rawId);
      restrictedIDs.add(rawId.replace(/^0+/, ''));
      const n = parseInt(rawId);
      if (!isNaN(n)) restrictedIDs.add(n);
    });
  };
  dbTechs.forEach(processItem);
  candsVal.forEach(processItem);

  const restrictedIDsArray = Array.from(restrictedIDs);
  console.log(`Restricted IDs count: ${restrictedIDsArray.length}`);

  const activities = await mongoose.connection.db.collection('actividades').find({
    fecha: {
      $gte: new Date('2026-06-01T00:00:00Z'),
      $lte: new Date('2026-06-30T23:59:59Z')
    },
    Estado: 'Completado',
    $or: [
      { RECURSO: { $in: restrictedIDsArray } },
      { "ID Recurso": { $in: restrictedIDsArray } },
      { "ID_Recurso": { $in: restrictedIDsArray } },
      { "RECURSO": { $in: restrictedIDsArray } }
    ]
  }).toArray();

  console.log(`Loaded ${activities.length} matching activities for June 2026`);

  // Process activities
  let matched = 0;
  activities.forEach(act => {
    const idRecurso = String(act['ID Recurso'] || act.idRecurso || act.ID_RECURSO || act.RECURSO || '').trim();
    const techName = String(act['Técnico'] || act.Técnico || act.nombre || act.NOMBRE || '').trim();
    const dateKey = act.fecha ? new Date(act.fecha).toISOString().split('T')[0] : '';

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
      t.orders++;
      t.ptsTotal += 1; // dummy baremo points for check
      if (dateKey) {
        if (!t.dailyMap[dateKey]) t.dailyMap[dateKey] = { orders: 0, ptsTotal: 0 };
        t.dailyMap[dateKey].orders++;
        t.dailyMap[dateKey].ptsTotal += 1;
      }
    }
  });

  console.log(`Matched ${matched} activities in simulated endpoint!`);

  // Print results for our target technicians
  const targetColabs = candsVal.filter(c => 
    c.fullName.includes('BADILLA') || 
    c.fullName.includes('OSORIO') || 
    c.fullName.includes('CASTILLO')
  );

  console.log('\n--- API RESPONSE DATA FOR TARGET COLLABORATORS ---');
  targetColabs.forEach(col => {
    // Find key in techMap
    const rutClean = col.rut ? String(col.rut).replace(/[^0-9kK]/g, '').toLowerCase() : '';
    const key = rutToKey[rutClean] || idToKey[col.idRecursoToa];
    const t = techMap[key];
    if (t) {
      console.log(`\nName: ${col.fullName}`);
      console.log(`  RUT: ${col.rut} (Clean: ${rutClean})`);
      console.log(`  TOA ID: ${col.idRecursoToa}`);
      console.log(`  Mapped Key: ${key}`);
      console.log(`  Source: ${t.source}`);
      console.log(`  Orders: ${t.orders}`);
      console.log(`  dailyMap:`, JSON.stringify(t.dailyMap, null, 2));
    } else {
      console.log(`\nName: ${col.fullName} - NOT FOUND IN techMap`);
    }
  });

  await mongoose.connection.close();
}

run().catch(console.error);
