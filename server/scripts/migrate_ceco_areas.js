const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const EmpresaConfig = require('../platforms/rrhh/models/EmpresaConfig');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('--- Iniciando migración de CECOs ---');

        const configs = await EmpresaConfig.find({});
        console.log(`Documentos a procesar: ${configs.length}`);

        for (const config of configs) {
            let changed = false;
            
            config.cecos = config.cecos.map(ceco => {
                // Si ya tiene areasAsociadas y es un array, lo respetamos
                if (ceco.areasAsociadas && Array.isArray(ceco.areasAsociadas)) {
                    return ceco;
                }

                // Obtener el valor antiguo de areaAsociada (mongoose puede guardarlo en _doc si no está en el schema actual)
                const oldArea = ceco.areaAsociada;
                
                // Creamos el nuevo campo
                const newCeco = {
                    nombre: ceco.nombre,
                    areasAsociadas: oldArea ? [oldArea] : []
                };

                changed = true;
                return newCeco;
            });

            if (changed) {
                // Usamos markModified porque modificamos un array
                config.markModified('cecos');
                await config.save();
                console.log(`Config de empresa ${config.empresaRef} actualizada.`);
            }
        }

        console.log('--- Migración completada con éxito ---');
        process.exit(0);
    } catch (error) {
        console.error('Error durante la migración:', error);
        process.exit(1);
    }
}

migrate();
function calculateAge(birthday) {
    if (!birthday) return null;
    const ageDifMs = Date.now() - new Date(birthday).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}
