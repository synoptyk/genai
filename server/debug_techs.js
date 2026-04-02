const mongoose = require('mongoose');
const Tecnico = require('./server/platforms/agentetelecom/models/Tecnico');
const User = require('./server/platforms/auth/PlatformUser');
const Empresa = require('./server/platforms/admin/models/Empresa');

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genai');
  const user = await User.findOne({ name: /Mauricio/i });
  console.log('User Mauricio:', user?.name, 'Role:', user?.role, 'EmpresaRef:', user?.empresaRef, 'EmpresaName:', user?.empresa?.nombre);
  
  if (user?.empresaRef) {
    const count = await Tecnico.countDocuments({ empresaRef: user.empresaRef });
    console.log('Technicians for EmpresaRef:', count);
    
    // Also try by Empresa Object if the ID is just a string
    const count2 = await Tecnico.countDocuments({ empresaRef: String(user.empresaRef) });
    console.log('Technicians for EmpresaRef (string):', count2);
  } else if (user?.empresa?.nombre) {
    const emp = await Empresa.findOne({ nombre: user.empresa.nombre });
    console.log('Found Empresa by Name:', emp?._id);
    if (emp) {
      const count = await Tecnico.countDocuments({ empresaRef: emp._id });
      console.log('Technicians for found Empresa:', count);
    }
  }
  process.exit(0);
}
check();
