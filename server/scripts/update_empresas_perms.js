const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Empresa = require('../platforms/auth/models/Empresa');

const ADMIN_OBJECT = { ver: true, crear: true, editar: true, suspender: true, bloquear: true, eliminar: true };
const DEFAULT_OBJECT = { ver: false, crear: false, editar: false, suspender: false, bloquear: false, eliminar: false };

async function updateEmpresas() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const empresas = await Empresa.find({});
        console.log(`Encontradas ${empresas.length} empresas.`);
        
        let count = 0;
        for (const emp of empresas) {
            let modified = false;
            if (!emp.permisosModulos) {
                emp.permisosModulos = new Map();
                modified = true;
            }
            if (!emp.permisosModulos.has('flota_eficiencia')) {
                // Dar todo por defecto a las empresas existentes
                emp.permisosModulos.set('flota_eficiencia', { ...ADMIN_OBJECT });
                modified = true;
            }
            if (modified) {
                emp.markModified('permisosModulos');
                await emp.save();
                count++;
            }
        }
        console.log(`Empresas actualizadas: ${count}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
updateEmpresas();
