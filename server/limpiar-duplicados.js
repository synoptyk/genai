const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://adminReclutando:SecureMongo2026.%23@34.27.229.165:27017/genai?authSource=admin';

// =============================================================================
// MAPA DE LIMPIEZA: columna_a_eliminar → columna_canonica_a_mantener
// La canónica recibirá los valores de la duplicada (si está vacía)
// =============================================================================
const MAPA_LIMPIEZA = {
  // MAYÚSCULAS → CamelCase con underscores (formato exacto de TOA)
  'CIUDAD': 'Ciudad',
  'CODIGO_LPU_BASE': 'Codigo_LPU_Base',
  'DECOS_ADICIONALES': 'Decos_Adicionales',
  'DESC_LPU_BASE': 'Desc_LPU_Base',
  'ESTADO': 'Estado',
  'NOMBRE': 'Nombre',
  'NÚMERO_DE_PETICIÓN': 'Número_de_Petición',
  'PTS_ACTIVIDAD_BASE': 'Pts_Actividad_Base',
  'PTS_DECO_ADICIONAL': 'Pts_Deco_Adicional',
  'PTS_TELEFONO': 'Pts_Telefono',
  'PTS_TOTAL_BAREMO': 'Pts_Total_Baremo',
  'REPETIDORES_WIFI': 'Repetidores_WiFi',
  'RUT_DEL_CLIENTE': 'RUT_del_cliente',
  'SUBTIPO_DE_ACTIVIDAD': 'Subtipo_de_Actividad',
  'TELEFONOS': 'Telefonos',
  'VENTANA_DE_LLEGADA': 'Ventana_de_Llegada',
  'VENTANA_DE_SERVICIO': 'Ventana_de_servicio',

  // Versiones con espacios → versión con underscores (estándar TOA)
  'Direccion Polar X': 'Direccion_Polar_X',
  'Direccion Polar Y': 'Direccion_Polar_Y',
  'ID Recurso': 'ID_Recurso',
  'Intervalo de tiempo': 'Intervalo_de_tiempo',
  'Numero orden': 'Numero_orden',
  'Número de Petición': 'Número_de_Petición',
  'Puntos Valor Actividad': 'Puntos_Valor_Actividad',
  'Send day before confirmation alert': 'Send_day_before_confirmation_alert',
  'Ventana de Llegada': 'Ventana_de_Llegada',
  'Ventana de servicio': 'Ventana_de_servicio'
};

async function limpiar() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado a MongoDB\n');

  const Actividad = mongoose.connection.db.collection('actividads');
  const total = await Actividad.countDocuments({});
  console.log(`📊 Total documentos en colección: ${total.toLocaleString()}\n`);

  console.log('🧹 INICIANDO LIMPIEZA DE COLUMNAS DUPLICADAS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const reporte = [];

  for (const [duplicada, canonica] of Object.entries(MAPA_LIMPIEZA)) {
    process.stdout.write(`  Procesando "${duplicada}" → "${canonica}"... `);

    // Paso 1: Copiar valores de la duplicada a la canónica (solo si la canónica está vacía)
    // Esto evita perder datos si solo la duplicada tiene el valor
    const docsConDuplicada = await Actividad.countDocuments({
      [duplicada]: { $exists: true, $ne: null, $ne: '' }
    });

    let copiados = 0;
    if (docsConDuplicada > 0) {
      // Usar aggregation pipeline para copiar valor solo si canónica está vacía
      const result = await Actividad.updateMany(
        {
          [duplicada]: { $exists: true, $ne: null, $ne: '' },
          $or: [
            { [canonica]: { $exists: false } },
            { [canonica]: null },
            { [canonica]: '' }
          ]
        },
        [
          {
            $set: {
              [canonica]: { $ifNull: [`$${canonica}`, `$${duplicada}`] }
            }
          }
        ]
      );
      copiados = result.modifiedCount;
    }

    // Paso 2: Eliminar la columna duplicada
    const resultUnset = await Actividad.updateMany(
      { [duplicada]: { $exists: true } },
      { $unset: { [duplicada]: '' } }
    );

    console.log(`✅ Copiados: ${copiados}, Eliminados: ${resultUnset.modifiedCount}`);

    reporte.push({
      duplicada,
      canonica,
      docsConDuplicada,
      copiados,
      eliminados: resultUnset.modifiedCount
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 REPORTE FINAL DE LIMPIEZA\n');

  let totalCopiados = 0;
  let totalEliminados = 0;
  reporte.forEach(r => {
    if (r.copiados > 0 || r.eliminados > 0) {
      console.log(`  ${r.duplicada} → ${r.canonica}`);
      console.log(`    Copiados (canónica estaba vacía): ${r.copiados}`);
      console.log(`    Eliminada de docs: ${r.eliminados}`);
    }
    totalCopiados += r.copiados;
    totalEliminados += r.eliminados;
  });

  console.log(`\n✅ TOTAL: ${totalCopiados} valores rescatados, ${totalEliminados} columnas duplicadas eliminadas\n`);

  // Verificación final
  console.log('🔍 VERIFICACIÓN: Columnas duplicadas restantes...\n');
  const muestra = await Actividad.find({}).limit(500).toArray();
  const columnasUnicas = new Set();
  muestra.forEach(d => Object.keys(d).forEach(k => columnasUnicas.add(k)));

  const duplicadasRestantes = Object.keys(MAPA_LIMPIEZA).filter(d => columnasUnicas.has(d));
  if (duplicadasRestantes.length > 0) {
    console.log('  ⚠️  Aún hay columnas duplicadas:');
    duplicadasRestantes.forEach(d => console.log(`    - ${d}`));
  } else {
    console.log('  ✅ Todas las columnas duplicadas fueron eliminadas');
  }

  console.log(`\n📋 Total columnas únicas restantes en muestra: ${columnasUnicas.size}\n`);

  await mongoose.disconnect();
  console.log('✅ Limpieza completada exitosamente\n');
}

limpiar().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
