/**
 * SCRIPT: Reparación Nuclear GenAI + CEO "Ojo de Dios"
 * Versión: 4.0 (Agresiva y Diagnóstica)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    try {
        console.log('☢️  REPARACIÓN NUCLEAR v4.0 - INICIADA');
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;

        // 1. Diagnóstico Inicial de Empresas
        const allCompanies = await db.collection('empresas').find({}).toArray();
        console.log(`📊 Empresas encontradas: ${allCompanies.length}`);
        allCompanies.forEach(c => console.log(`   - [${c._id}] ${c.nombre} (RUT: ${c.rut})`));

        // 2. Unificación: Buscar GenAI o Synoptyk (con o sin espacios)
        let mainCompany = allCompanies.find(c => /Gen\s*AI/i.test(c.nombre));
        if (!mainCompany) {
            mainCompany = allCompanies.find(c => /Synoptyk/i.test(c.nombre));
        }

        if (mainCompany) {
            console.log(`🎯 Empresa Maestra Seleccionada: ${mainCompany.nombre} (${mainCompany._id})`);
            // Asegurar nombre correcto
            await db.collection('empresas').updateOne(
                { _id: mainCompany._id },
                { $set: { nombre: 'GenAI', slug: 'genai', plan: 'enterprise', estado: 'Activo', limiteUsuarios: 100 } }
            );
        } else {
            console.log('🆕 No se encontró GenAI/Synoptyk. Creando desde cero...');
            const result = await db.collection('empresas').insertOne({
                nombre: 'GenAI',
                slug: 'genai',
                rut: '76.000.000-K',
                plan: 'enterprise',
                estado: 'Activo',
                limiteUsuarios: 100,
                createdAt: new Date()
            });
            mainCompany = { _id: result.insertedId, nombre: 'GenAI' };
        }

        // 3. Corregir Usuarios CEO
        const targetIds = mainCompany._id;
        const possibleEmails = [/ceo/i, /mauricio/i];
        
        console.log('👥 Buscando usuarios CEO por email o rol...');
        const users = await db.collection('usergenais').find({
            $or: [
                { email: { $regex: /ceo|mauricio/i } },
                { role: { $in: ['ceo_genai', 'ceo', 'admin'] } },
                { name: { $regex: /Mauricio/i } }
            ]
        }).toArray();

        console.log(`🔍 Usuarios a procesar: ${users.length}`);

        for (const u of users) {
            console.log(`🛠️  Actualizando: ${u.email}`);
            await db.collection('usergenais').updateOne(
                { _id: u._id },
                { 
                    $set: { 
                        role: 'ceo_genai',
                        empresaRef: targetIds,
                        empresa: {
                            nombre: 'GenAI',
                            rut: '76.000.000-K',
                            plan: 'enterprise'
                        }
                    } 
                }
            );
        }

        // 4. Limpieza de IDs Huérfanos
        // Si hay otras empresas que se llamen "Synoptyk" o similar, las borramos o re-vinculamos
        // Para este caso, solo nos aseguramos de que el usuario principal esté bien.

        console.log('\n🚀 REPARACIÓN v4.0 COMPLETADA.');
        console.log('✅ Tu ID de empresa ahora es:', targetIds);
        console.log('✅ Tu Rol es: ceo_genai');
        console.log('\n⚠️  IMPORTANTE:');
        console.log('1. Debes CERRAR SESIÓN (Logout real) en el navegador.');
        console.log('2. Si el error 404 persiste, borra el LocalStorage de tu navegador.');

    } catch (e) {
        console.error('❌ ERROR CRÍTICO:', e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
