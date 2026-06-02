const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'server', '.env') });

async function run() {
  const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db('genai');
    
    // Fix missing tipo_trabajo_pattern for Reuso Drop rules
    const rulesToUpdate = await db.collection('tarifalpus').find({
      'mapeo.requiere_reutilizacion_drop': 'SI'
    }).toArray();
    
    for (let rule of rulesToUpdate) {
       // Look for the standard version of this rule (without reuso drop) to copy its tipo_trabajo_pattern
       const baseDesc = rule.descripcion.replace(/ con Reutilizaci[óo]n de DROP/i, '').trim();
       const baseRule = await db.collection('tarifalpus').findOne({
         descripcion: baseDesc,
         'mapeo.requiere_reutilizacion_drop': { $in: [null, '', false] }
       });
       
       if (baseRule && baseRule.mapeo && baseRule.mapeo.tipo_trabajo_pattern) {
         await db.collection('tarifalpus').updateOne(
           { _id: rule._id },
           { $set: { 'mapeo.tipo_trabajo_pattern': baseRule.mapeo.tipo_trabajo_pattern } }
         );
         console.log(`Updated ${rule.descripcion} with pattern ${baseRule.mapeo.tipo_trabajo_pattern}`);
       } else {
         console.log(`Could not find base rule for ${rule.descripcion}`);
         // fallback heuristics
         let pattern = 'At--------'; // default for BA
         if (rule.descripcion.includes('TV')) pattern = 'At------At';
         if (rule.descripcion.includes('Voz')) pattern = 'At----';
         if (rule.descripcion.includes('Voz/Punto Ppal FTTH y Banda Ancha')) pattern = 'AtAt------';
         if (rule.descripcion.includes('Voz/Punto Ppal FTTH, Banda Ancha y TV')) pattern = 'AtAt----At';
         
         await db.collection('tarifalpus').updateOne(
           { _id: rule._id },
           { $set: { 'mapeo.tipo_trabajo_pattern': pattern } }
         );
         console.log(`Updated ${rule.descripcion} with fallback pattern ${pattern}`);
       }
    }
    
  } catch (err) {
    console.error('Connection error:', err);
  } finally {
    await client.close();
  }
}

run();
