const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const updatePerms = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { directConnection: true });
    console.log('Connected to DB');

    const Empresa = require('./platforms/auth/models/Empresa');
    const PlatformUser = require('./platforms/auth/PlatformUser');

    const perm = { ver: true, crear: true, editar: true, bloquear: false, suspender: false, eliminar: true };

    // Update companies
    const companies = await Empresa.find({});
    for (let c of companies) {
      if (!c.permisosModulos) c.permisosModulos = new Map();
      c.permisosModulos.set('flota_proveedores', perm);
      await c.save();
    }
    console.log('Companies updated');

    // Update users (admin)
    const users = await PlatformUser.find({ role: 'admin' });
    for (let u of users) {
      if (!u.permisosModulos) u.permisosModulos = new Map();
      u.permisosModulos.set('flota_proveedores', perm);
      await u.save();
    }
    console.log('Users updated');
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

updatePerms();
