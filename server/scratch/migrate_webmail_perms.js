require('dotenv').config();
const mongoose = require('mongoose');
const Empresa = require('../platforms/auth/models/Empresa');
const PlatformUser = require('../platforms/auth/PlatformUser');

const ADMIN_OBJECT = { ver: true, crear: true, editar: true, suspender: true, bloquear: true, eliminar: true };
const DEFAULT_OBJECT = { ver: false, crear: false, editar: false, suspender: false, bloquear: false, eliminar: false };

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { directConnection: true });
        console.log('Connected to MongoDB');

        // 1. Migrate Companies
        const companies = await Empresa.find({});
        console.log(`Migrating ${companies.length} companies...`);
        let companyCount = 0;
        for (const company of companies) {
            if (!company.permisosModulos) {
                company.permisosModulos = new Map();
            }
            if (!company.permisosModulos.has('social_webmail')) {
                company.permisosModulos.set('social_webmail', { ...ADMIN_OBJECT });
                company.markModified('permisosModulos');
                await company.save();
                companyCount++;
            }
        }
        console.log(`Successfully migrated ${companyCount} companies.`);

        // 2. Migrate Users
        const users = await PlatformUser.find({});
        console.log(`Migrating ${users.length} users...`);
        let userCount = 0;
        for (const user of users) {
            if (!user.permisosModulos) {
                user.permisosModulos = new Map();
            }
            if (!user.permisosModulos.has('social_webmail')) {
                const isAdmin = ['admin', 'system_admin', 'ceo', 'ceo_genai'].includes(user.role);
                user.permisosModulos.set('social_webmail', isAdmin ? { ...ADMIN_OBJECT } : { ...DEFAULT_OBJECT });
                user.markModified('permisosModulos');
                await user.save();
                userCount++;
            }
        }
        console.log(`Successfully migrated ${userCount} users.`);

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        process.exit(0);
    }
}
run();
