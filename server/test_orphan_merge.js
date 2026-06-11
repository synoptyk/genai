const nameToMapKey = {};
const rawName = "MATÍAS ANDRÉS GACITÚA ALVAREZ";
const name = rawName.trim().toUpperCase();
const nameParts = name.split(' ').filter(Boolean);
const nameVariations = [
  name,
  nameParts.join(' '),
  nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[2]}` : null,
  nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}` : null,
].filter(Boolean);

nameVariations.forEach(nv => { if (nv && !nameToMapKey[nv]) nameToMapKey[nv] = 'canon_key'; });

console.log('Map keys:', Object.keys(nameToMapKey));

const orphanName = "Matias Gacitua";
const canonKey = nameToMapKey[(orphanName || '').toLowerCase().trim()];

console.log('Result for "Matias Gacitua":', canonKey);
