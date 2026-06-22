/**
 * Script de migración para agregar permisos faltantes a usuarios y empresas existentes
 * Nuevos permisos: flota_gps_activos, ai_genai_mail
 * 
 * Uso: node server/scripts/migrate_missing_permissions.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const migratePermissions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { 
      directConnection: true 
    });
    console.log('✓ Conectado a MongoDB');

    const Empresa = require('../platforms/auth/models/Empresa');
    const PlatformUser = require('../platforms/auth/PlatformUser');

    // Definir nuevos permisos a agregar
    const newPermissions = {
      'flota_gps_activos': { ver: false, crear: false, editar: false, bloquear: false, eliminar: false },
      'ai_genai_mail': { ver: false, crear: false, editar: false, bloquear: false, eliminar: false }
    };

    // Migrar empresas
    console.log('\n📦 Migrando permisos en Empresas...');
    const companies = await Empresa.find({});
    let companiesUpdated = 0;

    for (let c of companies) {
      let hasChanges = false;
      if (!c.permisosModulos) c.permisosModulos = new Map();

      for (const [permKey, permValue] of Object.entries(newPermissions)) {
        if (!c.permisosModulos.has(permKey)) {
          c.permisosModulos.set(permKey, permValue);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await c.save();
        companiesUpdated++;
        console.log(`   ✓ ${c.nombre} actualizada`);
      }
    }
    console.log(`✓ ${companiesUpdated}/${companies.length} empresas actualizadas`);

    // Migrar usuarios
    console.log('\n👥 Migrando permisos en Usuarios...');
    const users = await PlatformUser.find({});
    let usersUpdated = 0;

    for (let u of users) {
      let hasChanges = false;
      if (!u.permisosModulos) u.permisosModulos = new Map();

      for (const [permKey, permValue] of Object.entries(newPermissions)) {
        if (!u.permisosModulos.has(permKey)) {
          u.permisosModulos.set(permKey, permValue);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await u.save();
        usersUpdated++;
      }
    }
    console.log(`✓ ${usersUpdated}/${users.length} usuarios actualizados`);

    console.log('\n✨ Migración completada exitosamente');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante migración:', err);
    process.exit(1);
  }
};

migratePermissions();
