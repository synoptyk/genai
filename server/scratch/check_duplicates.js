const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Candidato = require('../platforms/rrhh/models/Candidato');

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const id1 = '6a1da26a4265d045fc34af11';
    const id2 = '6a30772e6854ee283c82a3c3';
    
    const doc1 = await Candidato.findById(id1).lean();
    const doc2 = await Candidato.findById(id2).lean();
    
    console.log('=== DOCUMENT 1 (6a1da26a4265d045fc34af11) ===');
    console.log('Name:', doc1?.fullName);
    console.log('RUT:', doc1?.rut);
    console.log('Status:', doc1?.status);
    console.log('Created At:', doc1?.createdAt);
    console.log('Updated At:', doc1?.updatedAt);
    console.log('Has finiquitoDetalle:', !!doc1?.finiquitoDetalle);
    console.log('Familiar count:', doc1?.listaCargas?.length || 0);
    console.log('Amonestaciones count:', doc1?.amonestaciones?.length || 0);
    console.log('History events count:', doc1?.history?.length || 0);
    console.log('IsActive:', doc1?.isActive);
    
    console.log('\n=== DOCUMENT 2 (6a30772e6854ee283c82a3c3) ===');
    console.log('Name:', doc2?.fullName);
    console.log('RUT:', doc2?.rut);
    console.log('Status:', doc2?.status);
    console.log('Created At:', doc2?.createdAt);
    console.log('Updated At:', doc2?.updatedAt);
    console.log('Has finiquitoDetalle:', !!doc2?.finiquitoDetalle);
    console.log('Familiar count:', doc2?.listaCargas?.length || 0);
    console.log('Amonestaciones count:', doc2?.amonestaciones?.length || 0);
    console.log('History events count:', doc2?.history?.length || 0);
    console.log('IsActive:', doc2?.isActive);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

test();
