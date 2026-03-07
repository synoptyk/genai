const UserGenAi = require('./UserGenAi');
const Tecnico = require('../agentetelecom/models/Tecnico');
const Candidato = require('../rrhh/models/Candidato');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendWelcomeEmail, sendUpdateNotification } = require('../../utils/mailer');

const generateToken = (id, version = 0) => {
    return jwt.sign({ id, version }, process.env.JWT_SECRET || 'genai_secret_2026', {
        expiresIn: '30d'
    });
};

// POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await UserGenAi.findOne({ email }).populate('empresaRef');
        if (!user) return res.status(401).json({ message: 'Email no registrado en el sistema' });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ message: 'Contraseña incorrecta' });

        if (user.status !== 'Activo' && user.role !== 'ceo_genai')
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
    const { name, email, password, empresa, empresaRef, cargo, role, permisosModulos, status, rut, sendEmailCredentials } = req.body;
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
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'genai_secret_2026');
                reqUser = await UserGenAi.findById(decoded.id).select('-password');
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
            if (role === 'ceo_genai' || role === 'admin') {
                return res.status(403).json({ message: 'No autorizado para crear roles administrativos del sistema.' });
            }
        }

        const exists = await UserGenAi.findOne({ email: email.toLowerCase().trim() });
        if (exists) return res.status(400).json({ message: 'El email ya está registrado' });

        // ── Resolver nombre de empresa y límites ──────────────────────
        let empresaData = empresa || { nombre: 'Gen AI' };
        let finalEmpresaRef = empresaRef;

        // Si es Admin de empresa, forzamos la creación a su propia empresa
        if (reqUser && reqUser.role === 'admin') {
            finalEmpresaRef = reqUser.empresaRef;
            if (role === 'ceo_genai' || role === 'ceo') {
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
                    if (reqUser && !['ceo_genai', 'ceo'].includes(reqUser.role)) {
                        const count = await UserGenAi.countDocuments({ empresaRef: finalEmpresaRef });
                        const maxUsers = empDoc.limiteUsuarios || 5;
                        if (count >= maxUsers) {
                            return res.status(403).json({
                                message: `Límite de usuarios alcanzado (${count}/${maxUsers}). Contacta a Gen AI u Operaciones (CEO) para ampliar tu plan.`
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
        const defaultModulos = ['rrhh', 'prevencion', 'operaciones', 'agentetelecom', 'comercial', 'finanzas'];
        const defaultPerm = { ver: false, crear: false, editar: false, suspender: false, eliminar: false };

        if (permisosModulos && typeof permisosModulos === 'object') {
            defaultModulos.forEach(mod => {
                permisosMap.set(mod, permisosModulos[mod] || defaultPerm);
            });
        } else {
            defaultModulos.forEach(mod => permisosMap.set(mod, defaultPerm));
        }

        // ── Crear usuario (una sola llamada a save → un solo hash) ────
        const user = new UserGenAi({
            name: name.trim(),
            email: email.toLowerCase().trim(),
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
        const user = await UserGenAi.findById(req.user._id)
            .select('-password')
            .populate('empresaRef', 'nombre rut plan limiteUsuarios permisosModulos estado');
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users (Admin ve su empresa, CEO ve todo)
exports.getAllUsers = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const filter = req.user.role === 'ceo_genai' ? {} : { empresaRef: req.user.empresaRef };
        const users = await UserGenAi.find(filter)
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
        // 🔒 FILTRO POR EMPRESA
        const filter = req.user.role === 'ceo_genai' ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const user = await UserGenAi.findOne(filter);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o sin acceso' });

        const payload = req.body;

        // Actualizar campos simples
        const simpleFields = ['name', 'email', 'role', 'cargo', 'status', 'empresaRef'];
        simpleFields.forEach(field => {
            if (payload[field] !== undefined && payload[field] !== '') {
                user[field] = payload[field];
            }
        });

        // permisosModulos: convertir de objeto plano a Map si es necesario
        if (payload.permisosModulos && typeof payload.permisosModulos === 'object') {
            const defaultModulos = ['rrhh', 'prevencion', 'operaciones', 'agentetelecom', 'comercial', 'finanzas'];
            const defaultPerm = { ver: false, crear: false, editar: false, suspender: false, eliminar: false };
            const permisosMap = new Map();
            defaultModulos.forEach(mod => {
                permisosMap.set(mod, payload.permisosModulos[mod] || defaultPerm);
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

        // Repoblar para la respuesta
        const updatedUser = await UserGenAi.findById(user._id)
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
        const filter = req.user.role === 'ceo_genai' ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const result = await UserGenAi.findOneAndDelete(filter);
        if (!result) return res.status(404).json({ message: 'No encontrado o sin acceso' });
        res.json({ message: 'Usuario eliminado' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/stats/portales
exports.getPortalStats = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const filter = req.user.role === 'ceo_genai' ? {} : { empresaRef: req.user.empresaRef };

        const total = await UserGenAi.countDocuments(filter);
        const activosHoy = await UserGenAi.countDocuments({
            ...filter,
            ultimoAcceso: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        const suspendidos = await UserGenAi.countDocuments({ ...filter, status: 'Suspendido' });

        const porRol = await UserGenAi.aggregate([
            { $match: filter }, // 🔒 FILTRO EN AGGREGATION
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        res.json({
            total,
            activosHoy,
            suspendidos,
            porRol
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users/:id/history
exports.getUserHistory = async (req, res) => {
    try {
        // 🔒 FILTRO POR EMPRESA
        const filter = req.user.role === 'ceo_genai' ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const user = await UserGenAi.findOne(filter).select('loginHistory');
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
        const filter = req.user.role === 'ceo_genai' ? { _id: req.params.id } : { _id: req.params.id, empresaRef: req.user.empresaRef };
        const user = await UserGenAi.findOne(filter).populate('empresaRef');

        if (!user) return res.status(404).json({ message: 'Usuario no encontrado o sin acceso' });

        if (!password) {
            return res.status(400).json({ message: 'Debe proporcionar la contraseña para el reenvío' });
        }

        // 🔒 PROTECCIÓN DE JERARQUÍA: Un admin no puede resetear la clave de un CEO u otro admin externo
        if (req.user.role !== 'ceo_genai' && (user.role === 'ceo_genai' || user.role === 'ceo')) {
            return res.status(403).json({ message: 'No tienes permisos de jerarquía para alterar una cuenta CEO.' });
        }

        const empresaActual = user.empresaRef || user.empresa || {};

        console.log(`📡 Intentando reenvío de credenciales para: ${user.email}`);
        console.log(`🏢 Empresa detectada: ${empresaActual.nombre || 'Ninguna'} | Logo: ${empresaActual.logo ? 'Sí' : 'No'}`);

        // --- 🔐 PASO CRÍTICO: ACTUALIZAR EN BASE DE DATOS ---
        user.password = password.trim();
        await user.save(); // Esto dispara el hash en el modelo UserGenAi.js
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
