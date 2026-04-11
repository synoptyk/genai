const Empresa = require('./models/Empresa');
const PlatformUser = require('./PlatformUser');
const { sendCompanyUpdateEmail, sendWelcomeEmail } = require('../../utils/mailer');
const notificationService = require('../../utils/notificationService');

// Obtener todas las empresas
exports.getEmpresas = async (req, res) => {
    try {
        const empresas = await Empresa.find().sort({ createdAt: -1 });
        res.json(empresas);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener empresas', error: error.message });
    }
};

// ============================================
// FUNCIONES EXCLUSIVAS PARA EL ADMIN DE SU EMPRESA
// ============================================

// Obtener detalles de la empresa vinculada al Admin
exports.getMiEmpresa = async (req, res) => {
    try {
        if (!req.user.empresaRef) {
            return res.status(404).json({ message: 'El usuario no tiene una empresa vinculada (empresaRef missing)' });
        }
        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) {
            return res.status(404).json({ message: 'La empresa vinculada no existe en la base de datos' });
        }
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener su empresa', error: error.message });
    }
};

// Actualizar detalles de la empresa vinculada al Admin (Con restricciones)
exports.updateMiEmpresa = async (req, res) => {
    try {
        // Obtenemos solo su empresa vinculada
        const empresa = await Empresa.findById(req.user.empresaRef);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });

        const payload = req.body;

        // El Administrador NO puede auto-escalar su plan ni el límite de usuarios
        delete payload.plan;
        delete payload.limiteUsuarios;
        delete payload.valorUsuarioUF;
        delete payload.totalMensualUF;
        delete payload.estado; // Solo el CEO puede suspenderla

        // Actualizar campos aplicables (Logo, Dirección, Empresa, Giro, Web)
        Object.assign(empresa, payload);
        await empresa.save();

        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar su empresa', error: error.message });
    }
};

// ============================================

// Obtener una empresa por ID
exports.getEmpresaById = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.params.id);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la empresa', error: error.message });
    }
};

// Crear una nueva empresa
exports.createEmpresa = async (req, res) => {
    try {
        const { nombre, adminNombre, adminEmail, adminRut, adminPassword, ...restoDatos } = req.body;
        console.log(`🏢 [DEBUG] Creando empresa: ${nombre}`);
        console.log(`👤 [DEBUG] Datos admin recibidos: ${adminEmail ? 'SÍ' : 'NO'} | Email: ${adminEmail}`);

        // Verificar si existe el nombre de la empresa
        const existe = await Empresa.findOne({ nombre });
        if (existe) return res.status(400).json({ message: 'Ya existe una empresa con ese nombre' });

        // Si se nos enviaron datos de admin (flujo de creación desde CEO), verificamos que el email no exista
        if (adminEmail && adminPassword) {
            const adminExiste = await PlatformUser.findOne({ email: adminEmail.toLowerCase().trim() });
            if (adminExiste) {
                return res.status(400).json({ message: 'El correo del administrador ingresado ya está registrado en el sistema' });
            }
        }

        // Normalizar y forzar la estructura de Map para mongoose para los permisos corporativos
        const permisosMap = new Map();
        if (restoDatos.permisosModulos && typeof restoDatos.permisosModulos === 'object') {
            Object.keys(restoDatos.permisosModulos).forEach(key => {
                permisosMap.set(key, restoDatos.permisosModulos[key]);
            });
            restoDatos.permisosModulos = permisosMap;
        }

        const nuevaEmpresa = await Empresa.create({ nombre, ...restoDatos });

        // Si vienen datos de administrador, lo creamos y vinculamos a esta empresa
        if (adminNombre && adminEmail && adminPassword) {
            try {
                // Replicamos CLAVADAMENTE el techo que se le acaba de dar a su empresa
                const nuevoAdmin = new PlatformUser({
                    name: adminNombre.trim(),
                    email: adminEmail.toLowerCase().trim(),
                    password: adminPassword.trim(),
                    rut: adminRut ? adminRut.trim() : undefined,
                    empresa: {
                        nombre: nuevaEmpresa.nombre,
                        rut: nuevaEmpresa.rut || '',
                        plan: nuevaEmpresa.plan
                    },
                    empresaRef: nuevaEmpresa._id,
                    cargo: 'Administrador Maestro',
                    role: 'admin',
                    status: 'Activo',
                    tokenVersion: 1,
                    permisosModulos: permisosMap
                });

                await nuevoAdmin.save();
                console.log(`✅ Administrador Maestro creado para la empresa ${nuevaEmpresa.nombre}: ${nuevoAdmin.email}`);

                // Enviamos un correo de credenciales
                console.log(`📧 [DEBUG] Intentando enviar Welcome Email a: ${nuevoAdmin.email}`);
                const sent = await sendWelcomeEmail({
                    email: nuevoAdmin.email,
                    name: nuevoAdmin.name,
                    rut: adminRut || 'RUT No Definido',
                    password: adminPassword.trim(),
                    companyName: nuevaEmpresa.nombre,
                    companyLogo: nuevaEmpresa.logo
                });
                console.log(`✅ [DEBUG] Resultado Welcome Email: ${sent ? 'SUCCESS' : 'FAILED'}`);
            } catch (e) {
                console.error('🔴 [DEBUG] Falló el proceso de administrador/correo:', e.message);
            }
        }

        // Enviar correo del alta a todos los involucrados (Contactos, Representantes y Admin recién creado)
        try {
            await sendCompanyUpdateEmail(nuevaEmpresa, 'created', adminEmail);
        } catch (e) {
            console.error('🔴 Falló el correo de notificación de empresa:', e.message);
        }

        await notificationService.notifyAction({
            actor: req.user || { email: adminEmail || 'system@genai', name: 'Sistema' },
            moduleKey: 'auth_empresa',
            action: 'creó',
            entityName: `empresa ${nuevaEmpresa.nombre}`,
            entityId: nuevaEmpresa._id,
            companyRef: nuevaEmpresa._id,
            isImportant: true
        });

        res.status(201).json(nuevaEmpresa);
    } catch (error) {
        console.error('🔴 Error en createEmpresa:', error.message);
        res.status(500).json({ message: 'Error al crear la empresa', error: error.message });
    }
};

// Actualizar una empresa
exports.updateEmpresa = async (req, res) => {
    try {
        const empresa = await Empresa.findById(req.params.id);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });

        const payload = req.body;
        const changesDetected = [];

        const fieldLabels = {
            nombre: 'Razón Social',
            plan: 'Plan de Servicio',
            estado: 'Estado Operativo',
            limiteUsuarios: 'Límite de Usuarios',
            modoServicio: 'Modo de Servicio',
            giroComercial: 'Giro Comercial',
            email: 'Email de Contacto'
        };

        // Rastrear cambios antes de guardar
        Object.keys(fieldLabels).forEach(field => {
            if (payload[field] !== undefined && String(empresa[field]) !== String(payload[field])) {
                changesDetected.push({
                    label: fieldLabels[field],
                    value: payload[field]
                });
            }
        });

        // Actualizar campos
        Object.assign(empresa, payload);

        // Convertir permisos explícitamente a un mapa nuevo si vienen en el payload, y sincronizar al Master
        if (payload.permisosModulos && typeof payload.permisosModulos === 'object') {
            const permisosMap = new Map();
            Object.keys(payload.permisosModulos).forEach(key => {
                permisosMap.set(key, payload.permisosModulos[key]);
            });
            empresa.permisosModulos = permisosMap;

            // Sincronizar Inmediatamente con todos los Administradores de esta Empresa para que tengan los derechos de asignarlos a los demás
            try {
                await PlatformUser.updateMany(
                    { empresaRef: empresa._id, role: 'admin' },
                    { $set: { permisosModulos: permisosMap } }
                );
            } catch (syncErr) {
                console.error("🔴 Error sincronizando permisos al Usuario Admin Maestro:", syncErr.message);
            }
        }

        await empresa.save();

        // Enviar notificación detallada si hubo cambios
        if (changesDetected.length > 0) {
            try {
                // Notificamos a los contactos comerciales de la empresa
                const toEmails = empresa.contactosComerciales?.map(c => c.email).join(', ') || empresa.email;
                /* 
                // 🤫 SILENCIADO: Ahora se envían por Resumen Ejecutivo (Cron)
                if (toEmails) {
                    const { sendUpdateNotification } = require('../../utils/mailer');
                    await sendUpdateNotification({
                        email: toEmails,
                        name: empresa.nombre,
                        changes: changesDetected,
                        companyName: 'GENAI360 Platform',
                        companyLogo: empresa.logo
                    });
                }
                */

                // También enviamos el aviso interno al CEO y representantes (layout actualizado)
                // Se inyecta la variable action='updated' y los changesDetected
                await sendCompanyUpdateEmail(empresa, 'updated', null, changesDetected);
            } catch (e) {
                console.error('🔴 Error enviando notificaciones de empresa:', e.message);
            }
        }

        await notificationService.notifyAction({
            actor: req.user,
            moduleKey: 'auth_empresa',
            action: 'actualizó',
            entityName: `empresa ${empresa.nombre}`,
            entityId: empresa._id,
            companyRef: empresa._id,
            isImportant: true,
            messageExtra: `campos modificados: ${changesDetected.map(c => c.label).join(', ') || 'ninguno'}`
        });

        res.json(empresa);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la empresa', error: error.message });
    }
};

// Eliminar una empresa
exports.deleteEmpresa = async (req, res) => {
    try {
        const empresa = await Empresa.findByIdAndDelete(req.params.id);
        if (!empresa) return res.status(404).json({ message: 'Empresa no encontrada' });
        res.json({ message: 'Empresa eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar la empresa', error: error.message });
    }
};
