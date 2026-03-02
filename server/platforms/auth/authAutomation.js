const UserGenAi = require('./UserGenAi');
const { sendWelcomeEmail } = require('../../utils/mailer');

/**
 * Crea una cuenta de Portal Colaborador para un candidato contratado
 * @param {Object} candidato Instancia del modelo Candidato
 */
exports.handlePortalAccess = async (candidato) => {
    if (!candidato || !candidato.rut || !candidato.email) {
        console.warn('⚠️ No se puede crear acceso: Faltan datos críticos (RUT o Email)');
        return;
    }

    try {
        // 1. Verificar si ya existe el usuario
        const existe = await UserGenAi.findOne({
            $or: [{ rut: candidato.rut }, { email: candidato.email }]
        });

        if (existe) {
            console.log(`ℹ️ El acceso ya existe para el RUT: ${candidato.rut}. Saltando creación.`);
            return;
        }

        // 2. Generar contraseña temporal (RUT limpio)
        const cleanRut = candidato.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();
        const temporaryPassword = cleanRut;

        // 3. Determinar Rol (Supervisor vs Colaborador)
        const isSupervisor = candidato.position?.toLowerCase().includes('supervisor');
        const assignedRole = isSupervisor ? 'supervisor_hse' : 'user';

        // 4. Crear el usuario
        const newUser = new UserGenAi({
            name: candidato.fullName,
            email: candidato.email,
            password: temporaryPassword,
            rut: cleanRut,
            role: assignedRole,
            cargo: candidato.position,
            telefono: candidato.phone,
            empresa: {
                nombre: candidato.projectName || 'Gen AI',
                rut: candidato.ceco || '',
                plan: 'pro'
            },
            status: 'Activo'
        });

        await newUser.save();
        console.log(`✅ Cuenta de acceso creada para: ${candidato.fullName} (${cleanRut})`);

        // 4. Enviar Email de Bienvenida
        await sendWelcomeEmail({
            email: candidato.email,
            name: candidato.fullName,
            rut: cleanRut,
            password: temporaryPassword
        });

    } catch (error) {
        console.error('❌ Error en handlePortalAccess:', error.message);
    }
};
