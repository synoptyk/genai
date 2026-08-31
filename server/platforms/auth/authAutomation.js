const PlatformUser = require('./PlatformUser');
const { sendWelcomeEmail } = require('../../utils/mailer');
const { formatRut, cleanRut: sanitizeRut } = require('../../utils/rutUtils');
const mongoose = require('mongoose');

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

/**
 * Crea o actualiza una cuenta de Portal Colaborador para un candidato
 * @param {Object} candidato Instancia del modelo Candidato
 */
exports.handlePortalAccess = async (candidato) => {
    if (!candidato || !candidato.rut) {
        console.warn('⚠️ No se puede crear acceso: Falta RUT del colaborador');
        return;
    }

    try {
        const rawRut = String(candidato.rut).trim();
        const rLimpio = sanitizeRut(rawRut).toUpperCase();
        const rFormateado = formatRut(rLimpio);

        let cleanEmail = (candidato.email || '').toLowerCase().replace(/[<>]/g, '').trim();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            cleanEmail = `${rLimpio.toLowerCase()}@rambox.cl`;
        }

        const isActivo = ['En Terreno', 'Listo Terreno', 'Contratado', 'Activo', 'Aprobado'].includes(candidato.status);
        const isBaja = ['Finiquitado', 'Retirado', 'Rechazado', 'Inactivo', 'Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica'].includes(candidato.status);

        // 1. Verificar si ya existe el usuario
        let user = await PlatformUser.findOne({
            $or: [
                { rut: rFormateado },
                { rut: rLimpio },
                { rut: rawRut },
                { email: cleanEmail }
            ]
        });

        const isSupervisor = (candidato.position || '').toLowerCase().includes('supervisor');
        const assignedRole = isSupervisor ? 'supervisor_hse' : 'user';

        if (user) {
            let modificado = false;
            if (isActivo && user.status !== 'Activo') {
                user.status = 'Activo';
                modificado = true;
            } else if (isBaja && user.status === 'Activo' && !['system_admin', 'ceo', 'admin'].includes(user.role)) {
                user.status = 'Suspendido';
                modificado = true;
            }
            if (candidato.position && user.cargo !== candidato.position) {
                user.cargo = candidato.position;
                modificado = true;
            }
            if (candidato.empresaRef && (!user.empresaRef || String(user.empresaRef) !== String(candidato.empresaRef))) {
                user.empresaRef = candidato.empresaRef;
                modificado = true;
            }

            if (modificado) {
                await user.save();
                console.log(`🔄 Cuenta de acceso actualizada para: ${candidato.fullName} (${user.status})`);
            }
        } else {
            // 2. Crear el usuario
            const targetStatus = isActivo ? 'Activo' : 'Suspendido';
            const temporaryPassword = rLimpio;

            user = new PlatformUser({
                name: candidato.fullName,
                email: cleanEmail,
                password: temporaryPassword,
                rut: rFormateado,
                role: assignedRole,
                cargo: candidato.position || 'Técnico Telecomunicaciones',
                telefono: candidato.phone,
                empresaRef: candidato.empresaRef || undefined,
                empresa: {
                    nombre: candidato.projectName || 'RAM INGENIERIA',
                    rut: candidato.ceco || '',
                    plan: 'pro'
                },
                status: targetStatus,
                permisosModulos: isSupervisor ? defaultPermisosSupervisor : defaultPermisosColaborador
            });

            await user.save();
            console.log(`✅ Cuenta de acceso creada para: ${candidato.fullName} (${rFormateado}) - Estado: ${targetStatus}`);

            // Enviar email si es un email real
            if (cleanEmail && !cleanEmail.endsWith('@rambox.cl')) {
                try {
                    await sendWelcomeEmail({
                        email: cleanEmail,
                        name: candidato.fullName,
                        rut: rFormateado,
                        password: temporaryPassword
                    });
                } catch (e) {
                    console.warn('⚠️ No se pudo enviar email de bienvenida:', e.message);
                }
            }
        }

        // Replicar a la colección 'users' para mantener coherencia en MongoDB Compass
        try {
            const db = mongoose.connection.db;
            if (db) {
                await db.collection('users').deleteMany({});
                await db.collection('usergenais').aggregate([{ $out: 'users' }]).toArray();
            }
        } catch (repErr) {
            console.warn('⚠️ Error replicando usergenais -> users:', repErr.message);
        }
    } catch (error) {
        console.error('❌ Error en handlePortalAccess:', error.message);
    }
};
