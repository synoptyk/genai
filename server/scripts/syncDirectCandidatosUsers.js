const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { formatRut, cleanRut: sanitizeRut } = require('../utils/rutUtils');
const PlatformUser = require('../platforms/auth/PlatformUser');
const Candidato = require('../platforms/rrhh/models/Candidato');
const Empresa = require('../platforms/auth/models/Empresa');

const defaultPermisosColaborador = {
    op_colaborador: { ver: true, crear: false, editar: false, bloquear: false, eliminar: false },
    prev_ast: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    rrhh_documental: { ver: true, crear: false, editar: false, bloquear: false, eliminar: false }
};

const defaultPermisosSupervisor = {
    op_supervision: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    op_colaborador: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    prev_inspecciones: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    prev_charlas: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    prev_ast: { ver: true, crear: true, editar: true, bloquear: false, eliminar: false },
    rrhh_documental: { ver: true, crear: true, editar: false, bloquear: false, eliminar: false }
};

async function syncDirect() {
    console.log('📡 Conectando a MongoDB en', process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@'));
    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
    });

    const db = mongoose.connection.db;
    console.log('🍃 Conectado a la base de datos:', db.databaseName);

    // Obtener empresa por defecto (RAM INGENIERIA) si falta empresaRef
    let defaultEmpresa = await Empresa.findOne({ nombre: /RAM/i });
    if (!defaultEmpresa) defaultEmpresa = await Empresa.findOne({});
    const defaultEmpresaId = defaultEmpresa?._id;
    const defaultEmpresaName = defaultEmpresa?.nombre || 'RAM INGENIERIA';
    const defaultEmpresaRut = defaultEmpresa?.rut || '77.123.456-7';

    console.log(`🏢 Empresa por defecto: ${defaultEmpresaName} (${defaultEmpresaId})`);

    const candidatos = await Candidato.find({}).lean();
    console.log(`📋 Total de colaboradores en Candidato: ${candidatos.length}`);

    let creados = 0;
    let actualizados = 0;
    let suspendidos = 0;
    let sinCambios = 0;

    for (const c of candidatos) {
        if (!c.rut) {
            console.log(`⚠️ Candidato sin RUT omitido: ${c.fullName}`);
            continue;
        }

        const rawRut = String(c.rut).trim();
        const rLimpio = sanitizeRut(rawRut).toUpperCase();
        const rFormateado = formatRut(rLimpio);

        // Limpiar email si viene con caracteres no deseados
        let cleanEmail = (c.email || '').toLowerCase().replace(/[<>]/g, '').trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            // Si no tiene email, generamos uno corporativo basado en el RUT
            cleanEmail = `${rLimpio.toLowerCase()}@rambox.cl`;
        }

        // Determinar status objetivo
        const isActivo = ['En Terreno', 'Listo Terreno', 'Contratado', 'Activo', 'Aprobado'].includes(c.status);
        const isBaja = ['Finiquitado', 'Retirado', 'Rechazado', 'Inactivo', 'Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica'].includes(c.status);

        // Buscar si ya existe PlatformUser por RUT o Email
        let existingUser = await PlatformUser.findOne({
            $or: [
                { rut: rFormateado },
                { rut: rLimpio },
                { rut: rawRut },
                { email: cleanEmail }
            ]
        });

        const isSupervisor = (c.position || '').toLowerCase().includes('supervisor');
        const role = isSupervisor ? 'supervisor_hse' : 'user';
        const empresaRefId = c.empresaRef || defaultEmpresaId;

        if (existingUser) {
            let modificado = false;

            // Si está activo en RRHH pero suspendido o inactivo en PlatformUser, reactivarlo
            if (isActivo && existingUser.status !== 'Activo') {
                existingUser.status = 'Activo';
                modificado = true;
                console.log(`🔄 Reactivando usuario a Activo: ${existingUser.name} (${rFormateado})`);
            } else if (isBaja && existingUser.status === 'Activo' && !['system_admin', 'ceo', 'admin'].includes(existingUser.role)) {
                // Si está finiquitado o inactivo en RRHH pero seguía activo en PlatformUser, suspenderlo
                existingUser.status = 'Suspendido';
                modificado = true;
                suspendidos++;
                console.log(`⏸️ Suspendiendo usuario por baja en RRHH: ${existingUser.name} (${rFormateado})`);
            }

            // Asegurar RUT formateado
            if (existingUser.rut !== rFormateado) {
                existingUser.rut = rFormateado;
                modificado = true;
            }

            // Asegurar cargo
            if (c.position && existingUser.cargo !== c.position) {
                existingUser.cargo = c.position;
                modificado = true;
            }

            // Asegurar empresaRef
            if (!existingUser.empresaRef && empresaRefId) {
                existingUser.empresaRef = empresaRefId;
                modificado = true;
            }

            if (modificado) {
                await existingUser.save();
                actualizados++;
            } else {
                sinCambios++;
            }
        } else {
            // NO EXISTE: Si es activo, creamos su usuario activo; si es histórico/finiquitado, creamos en estado Suspendido
            const targetStatus = isActivo ? 'Activo' : 'Suspendido';

            // Contraseña inicial: su RUT sin puntos ni guión
            const tempPassword = rLimpio;

            const newUser = new PlatformUser({
                name: c.fullName,
                email: cleanEmail,
                password: tempPassword,
                rut: rFormateado,
                role: role,
                cargo: c.position || 'Técnico Telecomunicaciones',
                telefono: c.phone || '',
                empresaRef: empresaRefId,
                empresa: {
                    nombre: c.projectName || defaultEmpresaName,
                    rut: defaultEmpresaRut,
                    plan: 'pro'
                },
                status: targetStatus,
                permisosModulos: isSupervisor ? defaultPermisosSupervisor : defaultPermisosColaborador
            });

            await newUser.save();
            creados++;
            console.log(`✅ [${targetStatus}] Usuario CREADO: ${c.fullName} | RUT: ${rFormateado} | Email: ${cleanEmail} | Clave: [RUT]`);
        }
    }

    console.log('\n📊 RESUMEN DE SINCRONIZACIÓN PLATFORM_USER:');
    console.log(`   - Usuarios Nuevos Creados: ${creados}`);
    console.log(`   - Usuarios Actualizados: ${actualizados}`);
    console.log(`   - Usuarios Suspendidos por Baja: ${suspendidos}`);
    console.log(`   - Sin Cambios Necesarios: ${sinCambios}`);

    // Sincronizar colección 'usergenais' con la colección 'users' para que Compass y queries legacy estén 100% al día
    console.log('\n🔄 Replicando usergenais -> users (para MongoDB Compass y compatibilidad)...');
    await db.collection('users').deleteMany({});
    await db.collection('usergenais').aggregate([{ $out: 'users' }]).toArray();
    const finalUsersCount = await db.collection('users').countDocuments();
    const finalUsergenaisCount = await db.collection('usergenais').countDocuments();
    console.log(`✅ Colección 'users' actualizada: ${finalUsersCount} documentos.`);
    console.log(`✅ Colección 'usergenais' actualizada: ${finalUsergenaisCount} documentos.`);

    await mongoose.disconnect();
    console.log('👋 Desconectado de MongoDB.');
}

syncDirect().catch(err => {
    console.error('❌ Error en syncDirect:', err);
    process.exit(1);
});
