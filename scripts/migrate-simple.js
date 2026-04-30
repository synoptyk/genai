#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
  let client;
  try {
    console.log('\n' + '═'.repeat(70));
    console.log('🔄 INICIANDO MIGRACIÓN: Normalización de columnas en Actividad');
    console.log('═'.repeat(70) + '\n');

    console.log('📡 Conectando a MongoDB...');
    client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 60000,
      connectTimeoutMS: 60000,
      socketTimeoutMS: 120000,
      maxPoolSize: 10,
      retryWrites: true
    });

    await client.connect();
    console.log('✅ Conectado a MongoDB\n');

    const db = client.db('genai');

    // Listar colecciones disponibles
    const collections = await db.listCollections().toArray();
    console.log('📋 Colecciones disponibles:');
    collections.forEach(c => console.log(`   - ${c.name}`));

    // Buscar la colección de actividades (puede tener varios nombres)
    let collName = null;
    for (const coll of collections) {
      if (coll.name.toLowerCase().includes('actividad')) {
        collName = coll.name;
        break;
      }
    }

    if (!collName) {
      throw new Error('No se encontró colección con "actividad" en el nombre');
    }

    console.log(`\n📍 Usando colección: ${collName}\n`);

    const coll = db.collection(collName);
    const totalDocs = await coll.countDocuments({}, { maxTimeMS: 120000 });
    console.log(`📊 Total de registros a procesar: ${totalDocs.toLocaleString()}\n`);

    let processed = 0;
    let renamed = 0;
    let unset = 0;
    let batchNum = 1;
    const BATCH_SIZE = 1000;

    // Mapping de campos legacy a canónicos
    const renamedFields = {
      'ID_Recurso': 'RECURSO',
      'ID Recurso': 'RECURSO',
      'idRecurso': 'RECURSO',
      'Recurso': 'RECURSO',
      'PTS_Total_Baremo': 'PTS_TOTAL_BAREMO',
      'Pts_Total_Baremo': 'PTS_TOTAL_BAREMO',
      'PTS_ACTIVIDAD_BASE': 'PTS_ACTIVIDAD_BASE',
      'Pts_Actividad_Base': 'PTS_ACTIVIDAD_BASE',
      'PTS_DECO_ADICIONAL': 'PTS_DECO_ADICIONAL',
      'Pts_Deco_Adicional': 'PTS_DECO_ADICIONAL',
      'Pts_Deco_Cable': 'PTS_DECO_ADICIONAL',
      'Pts_Deco_Wifi': 'PTS_DECO_ADICIONAL',
      'Pts_Deco_WiFi': 'PTS_DECO_ADICIONAL',
      'PTS_DECO_CABLE': 'PTS_DECO_ADICIONAL',
      'PTS_DECO_WIFI': 'PTS_DECO_ADICIONAL',
      'PTS_REPETIDOR_WIFI': 'PTS_REPETIDOR_WIFI',
      'Pts_Repetidor_Wifi': 'PTS_REPETIDOR_WIFI',
      'PTS_TELEFONO': 'PTS_TELEFONO',
      'Pts_Telefono': 'PTS_TELEFONO',
      'DECOS_ADICIONALES': 'DECOS_ADICIONALES',
      'Decos_Adicionales': 'DECOS_ADICIONALES',
      'Decos_Cable_Adicionales': 'DECOS_ADICIONALES',
      'Decos_WiFi_Adicionales': 'DECOS_ADICIONALES',
      'DECOS_CABLE_ADICIONALES': 'DECOS_ADICIONALES',
      'DECOS_WIFI_ADICIONALES': 'DECOS_ADICIONALES',
      'REPETIDORES_WIFI': 'REPETIDORES_WIFI',
      'Repetidores_WiFi': 'REPETIDORES_WIFI',
      'Repetidores_Wifi': 'REPETIDORES_WIFI',
      'Repetidores_Wifi_Cant': 'REPETIDORES_WIFI',
      'TELEFONOS': 'TELEFONOS',
      'Telefonos': 'TELEFONOS',
      'Telefonos_Cant': 'TELEFONOS',
      'ACTIVIDAD': 'ACTIVIDAD',
      'Actividad': 'ACTIVIDAD',
      'ESTADO': 'ESTADO',
      'Estado': 'ESTADO',
      'SUBTIPO_DE_ACTIVIDAD': 'SUBTIPO_DE_ACTIVIDAD',
      'Subtipo_de_Actividad': 'SUBTIPO_DE_ACTIVIDAD',
      'Subtipo de Actividad': 'SUBTIPO_DE_ACTIVIDAD',
      'NOMBRE': 'NOMBRE',
      'Nombre': 'NOMBRE',
      'RUT_DEL_CLIENTE': 'RUT_DEL_CLIENTE',
      'RUT_del_cliente': 'RUT_DEL_CLIENTE',
      'Rut_del_cliente': 'RUT_DEL_CLIENTE',
      'CIUDAD': 'CIUDAD',
      'Ciudad': 'CIUDAD',
      'VENTANA_DE_SERVICIO': 'VENTANA_DE_SERVICIO',
      'Ventana_de_servicio': 'VENTANA_DE_SERVICIO',
      'VENTANA_DE_LLEGADA': 'VENTANA_DE_LLEGADA',
      'Ventana_de_Llegada': 'VENTANA_DE_LLEGADA',
      'NÚMERO_DE_PETICIÓN': 'NÚMERO_DE_PETICIÓN',
      'Número_de_Petición': 'NÚMERO_DE_PETICIÓN',
      'CODIGO_LPU_BASE': 'CODIGO_LPU_BASE',
      'Codigo_LPU_Base': 'CODIGO_LPU_BASE',
      'DESC_LPU_BASE': 'DESC_LPU_BASE',
      'Desc_LPU_Base': 'DESC_LPU_BASE',
      'CODIGO_LPU_DECO_WIFI': 'CODIGO_LPU_DECO_WIFI',
      'Codigo_LPU_Deco_WiFi': 'CODIGO_LPU_DECO_WIFI',
      'CODIGO_LPU_REPETIDOR': 'CODIGO_LPU_REPETIDOR',
      'Codigo_LPU_Repetidor': 'CODIGO_LPU_REPETIDOR',
      'VALOR_ACTIVIDAD_CLP': 'VALOR_ACTIVIDAD_CLP',
      'Valor_Actividad_CLP': 'VALOR_ACTIVIDAD_CLP',
      'CLIENTE_TARIFA': 'CLIENTE_TARIFA',
      'Cliente_Tarifa': 'CLIENTE_TARIFA',
      'PROYECTO_TARIFA': 'PROYECTO_TARIFA',
      'Proyecto_Tarifa': 'PROYECTO_TARIFA'
    };

    // Campos a eliminar completamente
    const unsetFields = [
      'Pts_Deco_Cable', 'Pts_Deco_Wifi', 'Pts_Deco_Adicional',
      'Decos_Cable_Adicionales', 'Decos_WiFi_Adicionales',
      'Decos_Adicionales', 'Repetidores_WiFi', 'Telefonos', 'Total_Equipos_Extras',
      'Repetidores_Wifi_Cant',
      'PTS_DECOS_ADICIONALES', 'DECOS_ADICIONALES_PTS',
      'REPETIDORES_WIFI_PTS', 'TELEFONOS_PTS',
      'rawData', 'camposCustom', 'fuenteDatos', 'datosRaw',
      'tecnicoId', 'clienteAsociado', 'ingreso',
      'latitud', 'longitud', 'nombreBruto', 'origen',
      'PTS_DECO_CABLE', 'PTS_DECO_WIFI', 'PTOS_DECO_ADICIONAL'
    ];

    // Procesar en batches
    for (let skip = 0; skip < totalDocs; skip += BATCH_SIZE) {
      const docs = await coll.find({})
        .skip(skip)
        .limit(BATCH_SIZE)
        .maxTimeMS(120000)
        .toArray();

      const operations = [];

      for (const doc of docs) {
        const $rename = {};
        const $unset = {};

        // Agrupar renames por destino
        const fieldsByDestination = {}; // { 'RECURSO': ['Recurso', 'ID_Recurso', ...] }
        const fieldsToProcess = [];

        for (const [oldName, newName] of Object.entries(renamedFields)) {
          if (doc[oldName] !== undefined && oldName !== newName) {
            if (!fieldsByDestination[newName]) {
              fieldsByDestination[newName] = [];
            }
            fieldsByDestination[newName].push(oldName);
            fieldsToProcess.push({ oldName, newName });
          }
        }

        const renamedFieldNames = new Set();

        // Para cada destino, renombrar solo UNO (si no existe) y unset los demás
        for (const [destination, sources] of Object.entries(fieldsByDestination)) {
          let renamed = false;

          for (const oldName of sources) {
            if (!renamed && doc[destination] === undefined) {
              // Renombrar el primero si el destino no existe
              $rename[oldName] = destination;
              renamed = true;
              renamedFieldNames.add(oldName);
            } else {
              // Los demás, unset
              $unset[oldName] = '';
              renamedFieldNames.add(oldName);
            }
          }
        }

        // Agrupar unsets (pero NO los campos que ya fueron procesados)
        unsetFields.forEach(field => {
          if (doc[field] !== undefined && !renamedFieldNames.has(field)) {
            $unset[field] = '';
          }
        });

        // Agregar operación si hay cambios
        if (Object.keys($rename).length > 0 || Object.keys($unset).length > 0) {
          const updateOp = {};
          if (Object.keys($rename).length > 0) updateOp.$rename = $rename;
          if (Object.keys($unset).length > 0) updateOp.$unset = $unset;

          operations.push({
            updateOne: {
              filter: { _id: doc._id },
              update: updateOp
            }
          });

          renamed += Object.keys($rename).length;
          unset += Object.keys($unset).length;
        }
      }

      // Ejecutar operaciones
      if (operations.length > 0) {
        const result = await coll.bulkWrite(operations, { maxTimeMS: 120000 });
        processed += docs.length;

        const percentComplete = ((processed / totalDocs) * 100).toFixed(1);
        console.log(
          `[Batch ${batchNum}] ✅ Procesados: ${processed.toLocaleString()} / ${totalDocs.toLocaleString()} ` +
          `(${percentComplete}%) | Renames: ${result.modifiedCount}, Unsets: ${unset}`
        );
      } else {
        processed += docs.length;
        console.log(`[Batch ${batchNum}] ⏭️  Saltados: ${docs.length} (sin cambios)`);
      }

      batchNum++;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('✅ MIGRACIÓN COMPLETADA\n');
    console.log(`📊 Estadísticas finales:`);
    console.log(`   • Total procesados: ${processed.toLocaleString()}`);
    console.log(`   • Total renombrados: ${renamed.toLocaleString()}`);
    console.log(`   • Total eliminados: ${unset.toLocaleString()}`);
    console.log('═'.repeat(70) + '\n');

    // Validación final
    console.log('🔍 Ejecutando validación...\n');

    const valSinRecurso = await coll.countDocuments({ $or: [{ RECURSO: { $exists: false } }, { RECURSO: '' }] }, { maxTimeMS: 120000 });
    const valConPts = await coll.countDocuments({ PTS_TOTAL_BAREMO: { $gte: 0 } }, { maxTimeMS: 120000 });
    const valLegacyPresente = await coll.countDocuments({ $or: [{ 'Pts_Total_Baremo': { $exists: true } }, { 'rawData': { $exists: true } }] }, { maxTimeMS: 120000 });

    console.log(`✅ Validaciones:`);
    console.log(`   • Sin RECURSO: ${valSinRecurso} (debe ser 0)`);
    console.log(`   • Con PTS_TOTAL_BAREMO: ${valConPts.toLocaleString()}`);
    console.log(`   • Legacy aún presente: ${valLegacyPresente} (debe ser 0)`);

    if (valSinRecurso === 0 && valLegacyPresente === 0) {
      console.log('\n✅ ¡MIGRACIÓN EXITOSA! Todos los datos están normalizados.\n');
    } else {
      console.log('\n⚠️ ADVERTENCIA: Algunos registros aún contienen datos legacy.\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

migrate();
