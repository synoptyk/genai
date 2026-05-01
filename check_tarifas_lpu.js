/**
 * Verificar que TarifaLPU esté correctamente configurado
 * Ejecutar: node check_tarifas_lpu.js (desde /server)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function checkTarifas() {
  try {
    console.log('🔗 Conectando a MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado\n');

    // Importar modelos
    const TarifaLPU = require('./platforms/agentetelecom/models/TarifaLPU');
    const Empresa = require('./platforms/auth/models/Empresa');

    // Buscar Ram Ingeniería
    console.log('🔍 Buscando empresa "Ram Ingeniería"...');
    const empresa = await Empresa.findOne({ 
      nombre: { $regex: /ram/i, $options: 'i' } 
    }).select('_id nombre');

    if (!empresa) {
      console.log('❌ Empresa "Ram Ingeniería" no encontrada');
      const empresas = await Empresa.find({}).select('_id nombre').limit(5);
      console.log('\n📋 Empresas disponibles:');
      empresas.forEach(e => console.log(`   - ${e.nombre} (${e._id})`));
      process.exit(0);
    }

    console.log(`✅ Encontrada: ${empresa.nombre} (${empresa._id})\n`);

    // Buscar tarifas para esa empresa
    console.log('📊 Buscando TarifaLPU para esta empresa...');
    const tarifas = await TarifaLPU.find({ 
      empresaRef: empresa._id, 
      activo: true 
    }).select('codigo descripcion puntos grupo activo').limit(10);

    console.log(`\n📈 Tarifas LPU encontradas: ${tarifas.length}\n`);

    if (tarifas.length === 0) {
      console.log('⚠️  ¡NO HAY TARIFAS LPU! Este es el problema.');
      console.log('   → Debes configurarlas en el módulo "Configuración LPU"');
      process.exit(0);
    }

    console.log('Primeras 10 tarifas:');
    tarifas.forEach((t, i) => {
      console.log(`   ${i+1}. ${t.codigo} - ${t.descripcion} (${t.puntos} pts) [${t.grupo}]`);
    });

    console.log('\n✅ Todo parece estar en orden con TarifaLPU');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkTarifas();
