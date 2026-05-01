/**
 * Verificar qué modelos de tarifas/baremos existen en MongoDB
 */

const mongoose = require('mongoose');
require('dotenv').config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/genai';

async function check() {
  try {
    await mongoose.connect(mongoUri);
    console.log('🔗 Conectado a MongoDB\n');

    // Importar modelos
    const TarifaLPU = require('./server/platforms/agentetelecom/models/TarifaLPU');
    const Baremo = require('./server/platforms/agentetelecom/models/Baremo');
    const Empresa = require('./server/platforms/auth/models/Empresa');

    // Buscar Ram Ingeniería
    const empresa = await Empresa.findOne({ 
      nombre: { $regex: /ram/i, $options: 'i' } 
    }).select('_id nombre');

    if (!empresa) {
      console.log('❌ No se encontró "Ram Ingeniería"');
      process.exit(1);
    }

    console.log(`✅ Empresa: ${empresa.nombre}\n`);

    // Buscar TarifaLPU
    const tarifasLPU = await TarifaLPU.find({ 
      empresaRef: empresa._id 
    }).select('codigo descripcion puntos activo');
    
    console.log(`📊 TarifaLPU: ${tarifasLPU.length} registros`);
    if (tarifasLPU.length > 0) {
      tarifasLPU.slice(0, 3).forEach(t => {
        console.log(`   - ${t.codigo}: ${t.descripcion} (${t.puntos} pts)`);
      });
    }

    // Buscar Baremo
    const baremos = await Baremo.find({ 
      empresaRef: empresa._id 
    }).select('tipoActividad puntosBase activo');
    
    console.log(`\n📊 Baremo: ${baremos.length} registros`);
    if (baremos.length > 0) {
      baremos.slice(0, 3).forEach(b => {
        console.log(`   - ${b.tipoActividad}: ${b.puntosBase} pts`);
      });
    }

    console.log('\n' + '='.repeat(60));
    if (tarifasLPU.length === 0 && baremos.length > 0) {
      console.log('✅ DIAGNÓSTICO: Usa Baremo, NO TarifaLPU');
      console.log('   → El endpoint debe usar Baremo en lugar de TarifaLPU');
    } else if (tarifasLPU.length > 0) {
      console.log('✅ DIAGNÓSTICO: Usa TarifaLPU');
      console.log('   → El endpoint está en el lugar correcto');
    } else {
      console.log('❌ DIAGNÓSTICO: Sin tarifas configuradas');
      console.log('   → Necesitas crear tarifas en Configuración LPU');
    }

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

check();
