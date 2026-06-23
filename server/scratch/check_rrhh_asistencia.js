const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const check = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { directConnection: true });
    
    const PlatformUser = require('../platforms/auth/PlatformUser');
    const users = await PlatformUser.find({}).lean();
    for (const u of users) {
      if (u.permisosModulos && (u.permisosModulos.rrhh_asistencia || u.permisosModulos.get?.('rrhh_asistencia'))) {
        const p = u.permisosModulos.rrhh_asistencia || u.permisosModulos.get?.('rrhh_asistencia');
        console.log(`User: ${u.email} | rrhh_asistencia:`, p);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
check();
