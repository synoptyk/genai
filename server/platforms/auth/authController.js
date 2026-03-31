const PlatformUser = require('./PlatformUser');
const Tecnico = require('../agentetelecom/models/Tecnico');
const Candidato = require('../rrhh/models/Candidato');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendWelcomeEmail, sendUpdateNotification } = require('../../utils/mailer');
const notificationService = require('../../utils/notificationService');

const generateToken = (id, version = 0) => {
    return jwt.sign({ id: id.toString(), version }, process.env.JWT_SECRET || 'platform_secret_2026', {
        expiresIn: '30d'
    });
};

// POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await PlatformUser.findOne({ email }).populate('empresaRef');
        if (!user) return res.status(401).json({ message: 'Email no registrado en el sistema' });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

        if (user.status !== 'Activo' && !['system_admin', 'ceo'].includes(user.role))
            return res.status(401).json({ message: 'Cuenta suspendida o inactiva. Contacte al administrador.' });

        user.tokenVersion = (user.tokenVersion || 0) + 1;
        user.ultimoAcceso = new Date();

        // Registrar historial de acceso
        if (!user.loginHistory) user.loginHistory = [];
        user.loginHistory.unshift({
            fecha: new Date(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        // Mantener solo los últimos 20 registros
        if (user.loginHistory.length > 20) {
            user.loginHistory = user.loginHistory.slice(0, 20);
        }

        // Si el usuario tiene un PIN de seguridad configurado, NO entregamos el token todavía
        if (user.loginPin) {
            return res.json({ 
                requirePin: true, 
                email: user.email, 
                name: user.name,
                avatar: user.avatar 
            });
        }

        await user.save();

        let rutStr = user.rut;
        if (!rutStr) {
            // Optimización: Búsqueda exacta indexada en lugar de RegExp
            const tech = await Tecnico.findOne({ email: email.toLowerCase().trim() });
            if (tech) {
                rutStr = tech.rut;
            } else {
                const cand = await Candidato.findOne({ email: email.toLowerCase().trim() });
                if (cand) rutStr = cand.rut;
            }
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            corporateEmail: user.corporateEmail,
            rut: rutStr || 'Rut No Definido',
            role: user.role,
            empresa: user.empresa,
            empresaRef: user.empresaRef,
            permisosModulos: user.permisosModulos,
            cargo: user.cargo,
            avatar: user.avatar,
            token: generateToken(user._id, user.tokenVersion)
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// POST /api/auth/register (solo CEO puede crear usuarios o auto-registro)
exports.register = async (req, res) => {
    const { name, email, corporateEmail, password, empresa, empresaRef, cargo, role, permisosModulos, status, rut, sendEmailCredentials } = req.body;
    try {
        // ── Validaciones básicas ──────────────────────────────────────
        if (!name || !email) {
            return res.status(400).json({ message: 'Nombre y email son obligatorios' });
        }
        if (!password || password.trim().length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // ── Validar Token Obligatorio (Autenticación Forzada) ─────────
        let reqUser = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'platform_secret_2026');
                reqUser = await PlatformUser.findById(decoded.id).select('-password');
                if (!reqUser) return res.status(401).json({ message: 'La sesión actual (token) pertenece a un usuario que ya no existe. Cierre sesión y vuelva a entrar.' });

                // Aplicar el mismo parche que en authMiddleware: tolerar versiones superiores o iguales
                if (decoded.version !== undefined && reqUser.tokenVersion !== undefined && decoded.version < reqUser.tokenVersion) {
                    return res.status(401).json({ message: 'Token de sesión expirado o inválido. Por favor, cierre sesión e ingrese nuevamente para crear usuarios.' });
                }
            } catch (err) {
                return res.status(401).json({ message: 'Token de sesión expirado o inválido. Por favor, cierre sesión e ingrese nuevamente para crear usuarios.' });
            }
        }

        // Si la ruta ahora está protegida por middleware, `req.user` vendrá inyectado.
        reqUser = reqUser || req.user;

        if (!reqUser) {
            // Registro público (auto-servicio)
            if (role === 'system_admin' || role === 'admin') {
                return res.status(403).json({ message: 'No autorizado para crear roles administrativos del sistema.' });
            }
        }

        const exists = await PlatformUser.findOne({ email: email.toLowerCase().trim() });
        if (exists) return res.status(400).json({ message: 'El email ya está registrado' });

        // ── Resolver nombre de empresa y límites ──────────────────────
        let empresaData = empresa || { nombre: 'Enterprise Platform' };
        let finalEmpresaRef = empresaRef;

        // Si es Admin de empresa, forzamos la creación a su propia empresa
        if (reqUser && reqUser.role === 'admin') {
            finalEmpresaRef = reqUser.empresaRef;
            if (role === 'system_admin' || role === 'ceo') {
                return res.status(403).json({ message: 'Un administrador no puede crear roles CEO.' });
            }
        }

        if (finalEmpresaRef) {
            try {
                const Empresa = require('./models/Empresa');
                const empDoc = await Empresa.findById(finalEmpresaRef);
                if (empDoc) {
                    empresaData = {
                        nombre: empDoc.nombre,
                        rut: empDoc.rut || '',
                        plan: empDoc.plan || 'starter'
                    };

                    // Control de Límite de Usuarios (solo validamos si no es CEO maestro creando)
                    if (reqUser && !['system_admin', 'ceo'].includes(reqUser.role)) {
                        const count = await PlatformUser.countDocuments({ empresaRef: finalEmpresaRef });
                        const maxUsers = empDoc.limiteUsuarios || 5;
                        if (count >= maxUsers) {
                            return res.status(403).json({
                                message: `Límite de usuarios alcanzado (${count}/${maxUsers}). Contacta a Operaciones o Administración para ampliar tu plan.`
                            });
                        }
                    }
                }
            } catch (empErr) {
                console.warn('No se pudo resolver empresaRef, usando default:', empErr.message);
            }
        }

        // ── Convertir permisosModulos a Map compatible ────────────────
        const permisosMap = new Map();
        if (permisosModulos && typeof permisosModulos === 'object') {
            Object.keys(permisosModulos).forEach(key => {
                permisosMap.set(key, permisosModulos[key]);
            });
        }

        // ── Crear usuario (una sola llamada a save → un solo hash) ────
        const user = new PlatformUser({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            corporateEmail: corporateEmail ? corporateEmail.toLowerCase().trim() : undefined,
            password: password.trim(),       // el pre('save') hashea AQUÍ y solo AQUÍ
            rut: rut ? rut.trim() : undefined,
            empresa: empresaData,
            cargo: cargo || 'Usuario',
            role: role || 'user',
            status: status || 'Activo',
            tokenVersion: 1,
            permisosModulos: permisosMap
        });

        if (finalEmpresaRef) user.empresaRef = finalEmpresaRef;

        await user.save();

        console.log(`✅ Usuario creado: ${user.email} | role: ${user.role}`);

        // Notificación para lo creado (actor + admins del módulo admin) 
        try {
            await notificationService.notifyAction({
                actor: reqUser || user,
                moduleKey: 'admin_historial',
                action: 'creó',
                entityName: `usuario ${user.name}`,
                entityId: user._id,
                companyRef: user.empresaRef || reqUser?.empresaRef,
                isImportant: user.role === 'admin' || user.role === 'ceo',
                messageExtra: `Rol: ${user.role}`
            });
        } catch (notifErr) {
            console.error('Error notificando creación de usuario:', notifErr.message);
        }

        if (sendEmailCredentials) {
            try {
                await sendWelcomeEmail({
                    email: user.email,
                    name: user.name,
                    rut: rut || 'RUT No Definido',
                    password: password.trim(),
                    companyName: user.empresa?.nombre,
                    companyLogo: user.empresa?.logo
                });
            } catch (e) {
                console.error('🔴 Error enviando credenciales de registro:', e.message);
            }
        }

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            corporateEmail: user.corporateEmail,
            role: user.role,
            empresa: user.empresa,
            empresaRef: finalEmpresaRef, // El ID o el Doc si es necesario, pero usualmente el frontend prefiere el ID aquí y luego GetMe refresca
            permisosModulos: Object.fromEntries(user.permisosModulos),
            token: generateToken(user._id, 1)
        });
    } catch (e) {
        console.error('Error en register:', e.message);
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await PlatformUser.findById(req.user._id)
            .select('-password')
            .populate('empresaRef', 'nombre rut plan limiteUsuarios permisosModulos estado');
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users — Tenant-isolated:
//   system_admin → ve TODOS (todas las empresas, incluyendo la administración)
//   ceo, admin, etc. → solo su empresa y jamás usuarios administrativos internos
exports.getAllUsers = async (req, res) => {
    try {
        const currentEmail = req.user.email?.toLowerCase().trim();
        if (req.user.role === 'system_admin' || currentEmail === 'admin@platform-os.cl') {
            // SysAdmin o Email Maestro: visión global sin restricciones
            filter = {};
        } else if (req.user.role === 'admin' || req.user.role === 'ceo') {
            // Admin/CEO de empresa: ven sus usuarios Y usuarios huérfanos (para poder vincularlos)
            filter = {
                $or: [
                    { empresaRef: req.user.empresaRef },
                    { empresaRef: null },
                    { empresaRef: { $exists: false } }
                ],
                role: { $ne: 'system_admin' }
            };
        } else {
            // Resto: solo su empresa
            filter = {
                empresaRef: req.user.empresaRef,
                role: { $ne: 'system_admin' }
            };
        }
        const users = await PlatformUser.find(filter)
            .select('-password')
            .populate('empresaRef', 'nombre rut plan limiteUsuarios permisosModulos estado')
            .sort({ createdAt: -1 });
        res.json(users);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};


// PUT /api/auth/users/:id
exports.updateUser = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA (CEO total, Admin ve los suyos + huérfanos)
        let filter;
        if (['system_admin', 'ceo'].includes(req.user.role)) {
            filter = { _id: req.params.id };
        } else if (req.user.role === 'admin') {
            filter = { 
                _id: req.params.id, 
                $or: [
                    { empresaRef: req.user.empresaRef },
                    { empresaRef: null },
                    { empresaRef: { $exists: false } }
                ] 
            };
        } else {
            filter = { _id: req.params.id, empresaRef: req.user.empresaRef };
        }

        const user = await PlatformUser.findOne(filter);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o sin acceso' });

        const payload = req.body;

        // Actualizar campos simples
        const simpleFields = ['name', 'email', 'corporateEmail', 'role', 'cargo', 'status', 'empresaRef'];
        simpleFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== '') {
                user[field] = payload[field];
            }
        });

        // Sincronizar objeto empresa si se cambió empresaRef
        if (payload.empresaRef) {
            try {
                const Empresa = require('./models/Empresa');
                const empDoc = await Empresa.findById(payload.empresaRef);
                if (empDoc) {
                    user.empresa = {
                        nombre: empDoc.nombre,
                        rut: empDoc.rut || '',
                        plan: empDoc.plan || 'starter'
                    };
                }
            } catch (err) {
                console.warn('Error sincronizando empresa object:', err.message);
            }
        }

        // permisosModulos: convertir de objeto plano a Map conservando todas las claves granulares
        if (payload.permisosModulos && typeof payload.permisosModulos === 'object') {
            const permisosMap = new Map();
            Object.keys(payload.permisosModulos).forEach(key => {
                permisosMap.set(key, payload.permisosModulos[key]);
            });
            user.permisosModulos = permisosMap;
        }

        // Contraseña: SOLO actualizar si viene, no está vacía y tiene al menos 6 caracteres
        if (payload.password && typeof payload.password === 'string' && payload.password.trim().length >= 6) {
            user.password = payload.password.trim();
            console.log(`🔐 Contraseña actualizada para: ${user.email}`);

            if (payload.sendEmailCredentials) {
                try {
                    await sendWelcomeEmail({
                        email: user.email,
                        name: user.name,
                        rut: payload.rut || 'RUT No Definido',
                        password: payload.password.trim(),
                        companyName: user.empresa?.nombre,
                        companyLogo: user.empresa?.logo
                    });
                } catch (e) {
                    console.error('🔴 Error enviando credenciales actualizadas:', e.message);
                }
            }
        }

        await user.save();

        // Notificación de actualización de perfil para actor + admins
        try {
            await notificationService.notifyAction({
                actor: req.user,
                moduleKey: 'admin_historial',
                action: 'actualizó',
                entityName: `usuario ${user.name}`,
                entityId: user._id,
                companyRef: user.empresaRef,
                isImportant: true,
                messageExtra: `Role antiguo/actual: ${payload.role || user.role}`
            });
        } catch (notifErr) {
            console.error('Error notificando actualización de usuario:', notifErr.message);
        }

        // Repoblar para la respuesta
        const updatedUser = await PlatformUser.findById(user._id)
            .select('-password').populate('empresaRef', 'nombre rut plan modulosActivos');

        res.json(updatedUser);
    } catch (e) {
        console.error('Error en updateUser:', e.message);
        res.status(500).json({ message: e.message });
    }
};

// DELETE /api/auth/users/:id
exports.deleteUser = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const filter = ['system_admin', 'ceo'].includes(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const result = await PlatformUser.findOneAndDelete(filter);
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Usuario eliminado' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/stats/portales
exports.getPortalStats = async (req, res) => {
    try {
        // 🔒 Mismo aislamiento que getAllUsers
        const filter = req.user.role === 'system_admin'
            ? {}
            : { empresaRef: req.user.empresaRef, role: { $ne: 'system_admin' } };

        const total = await PlatformUser.countDocuments(filter);
        const activosHoy = await PlatformUser.countDocuments({
            ...filter,
            ultimoAcceso: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        const suspendidos = await PlatformUser.countDocuments({ ...filter, status: 'Suspendido' });

        const porRol = await PlatformUser.aggregate([
            { $match: filter },
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        res.json({ total, activosHoy, suspendidos, porRol });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users/:id/history
exports.getUserHistory = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const filter = ['system_admin', 'ceo'].includes(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const user = await PlatformUser.findOne(filter).select('loginHistory');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o sin acceso' });
        res.json(user.loginHistory || []);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};
// POST /api/auth/users/:id/resend-credentials
exports.resendCredentials = async (req, res) => {
    try {
        const { password } = req.body;
        // 🔒 FILTRO POR EMPRESA
        const filter = ['system_admin', 'ceo'].includes(req.user.role) ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const user = await PlatformUser.findOne(filter).populate('empresaRef');

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o sin acceso' });

        if (!password) {
            return res.status(400).json({ message: 'Debe proporcionar la contraseña para el reenvío' });
        }

        // 🔒 PROTECCIÓN DE JERARQUÍA: Un admin no puede resetear la clave de un CEO u otro admin externo
        if (!['system_admin', 'ceo'].includes(req.user.role) && (user.role === 'system_admin' || user.role === 'ceo')) {
            return res.status(403).json({ message: 'No tienes permisos de jerarquía para alterar una cuenta CEO.' });
        }

        const empresaActual = user.empresaRef || user.empresa || {};

        console.log(`📡 Intentando reenvío de credenciales para: ${user.email}`);
        console.log(`🏢 Empresa detectada: ${empresaActual.nombre || 'Ninguna'} | Logo: ${empresaActual.logo ? 'Sí' : 'No'}`);

        // --- 🔐 PASO CRÍTICO: ACTUALIZAR EN BASE DE DATOS ---
        user.password = password.trim();
        await user.save(); // Esto dispara el hash en el modelo PlatformUser.js
        console.log(`✅ Contraseña actualizada en DB para: ${user.email}`);

        await sendWelcomeEmail({
            email: user.email,
            name: user.name,
            rut: user.rut || 'RUT No Definido',
            password: password.trim(),
            companyName: empresaActual.nombre,
            companyLogo: empresaActual.logo
        });

        res.json({ message: 'Credenciales actualizadas y enviadas con éxito' });
    } catch (e) {
        console.error('Error en resendCredentials:', e.message);
        res.status(500).json({ message: e.message });
    }
};

// POST /api/auth/verify-pin
exports.verifyPin = async (req, res) => {
    const { email, pin } = req.body;
    try {
        const user = await PlatformUser.findOne({ email }).populate('empresaRef');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        // Comparación simple por ahora o bcrypt si decidimos hashearlo
        // Para PIN de 4 dígitos, a veces es más práctico directo si el DB es seguro,
        // pero usemos comparacion directa por ahora.
        if (user.loginPin !== pin) {
            return res.status(401).json({ message: 'PIN incorrecto' });
        }

        user.tokenVersion = (user.tokenVersion || 0) + 1;
        user.ultimoAcceso = new Date();

        // Evitar fallos de validación en usuarios legacy si falta el campo empresa.nombre
        if (!user.empresa || !user.empresa.nombre) {
            user.empresa = { 
                nombre: user.empresaRef?.nombre || 'Enterprise Platform',
                plan: 'starter'
            };
        }

        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            corporateEmail: user.corporateEmail,
            role: user.role,
            empresa: user.empresa,
            empresaRef: user.empresaRef,
            permisosModulos: user.permisosModulos instanceof Map ? Object.fromEntries(user.permisosModulos) : user.permisosModulos,
            cargo: user.cargo,
            avatar: user.avatar,
            token: generateToken(user._id, user.tokenVersion)
        });
    } catch (e) {
        console.error('❌ [Auth] Error en verifyPin:', e);
        res.status(500).json({ message: e.message });
    }
};

// POST /api/auth/setup-pin (Autenticado)
exports.setupPin = async (req, res) => {
    const { pin } = req.body;
    try {
        if (!pin || pin.length !== 4) return res.status(400).json({ message: 'El PIN debe ser de 4 dígitos' });
        
        const user = await PlatformUser.findById(req.user._id);
        user.loginPin = pin;
        await user.save();

        res.json({ message: 'PIN configurado con éxito' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// POST /api/auth/reset-pin/:id (Admin/CEO)
exports.resetPin = async (req, res) => {
    try {
        // Solo CEO o Admin de la misma empresa
        const user = await PlatformUser.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        if (!['system_admin', 'ceo'].includes(req.user.role) && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'No autorizado' });
        }

        user.loginPin = undefined;
        await user.save();

        res.json({ message: 'PIN reiniciado con éxito. El usuario podrá entrar solo con contraseña.' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};
