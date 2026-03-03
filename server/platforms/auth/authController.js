const UserGenAi = require('./UserGenAi');
const Tecnico = require('../agentetelecom/models/Tecnico');
const Candidato = require('../rrhh/models/Candidato');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateToken = (id, version = 0) => {
    return jwt.sign({ id, version }, process.env.JWT_SECRET || 'genai_secret_2026', {
        expiresIn: '30d'
    });
};

// POST /api/auth/login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await UserGenAi.findOne({ email });
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
            const tech = await Tecnico.findOne({ email: new RegExp('^' + email + '$', 'i') });
            if (tech) { rutStr = tech.rut; }
            else {
                const cand = await Candidato.findOne({ email: new RegExp('^' + email + '$', 'i') });
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
    const { name, email, password, empresa, empresaRef, cargo, role, permisosModulos, status } = req.body;
    try {
        if (!password || password.trim().length < 6) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
        }

        const exists = await UserGenAi.findOne({ email });
        if (exists) return res.status(400).json({ message: 'El email ya está registrado' });

        // Usamos `new + save()` UNA SOLA VEZ para que el pre('save') hook hashee correctamente
        const user = new UserGenAi({
            name,
            email,
            password: password.trim(),
            empresa: empresa || { nombre: 'Gen AI Demo' },
            cargo: cargo || 'Usuario',
            role: role || 'user',
            status: status || 'Activo',
            tokenVersion: 1
        });

        if (empresaRef) user.empresaRef = empresaRef;
        if (permisosModulos) user.permisosModulos = permisosModulos;

        await user.save(); // el pre('save') hookea y hashea SOLO AQUÍ

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            rut: user.rut || 'Rut No Definido',
            role: user.role,
            empresa: user.empresa,
            empresaRef: user.empresaRef,
            permisosModulos: user.permisosModulos,
            token: generateToken(user._id, 1)
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await UserGenAi.findById(req.user._id).select('-password').populate('empresaRef', 'nombre rut plan modulosActivos');
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users (solo CEO)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await UserGenAi.find({}).select('-password').populate('empresaRef', 'nombre rut plan modulosActivos').sort({ createdAt: -1 });
        res.json(users);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// PUT /api/auth/users/:id (solo CEO)
exports.updateUser = async (req, res) => {
    try {
        const user = await UserGenAi.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

        const payload = req.body;

        // Actualizar campos simples
        const simpleFields = ['name', 'email', 'role', 'cargo', 'status', 'empresaRef', 'permisosModulos'];
        simpleFields.forEach(field => {
            if (payload[field] !== undefined) {
                user[field] = payload[field];
            }
        });

        // Contraseña: SOLO actualizar si viene, no está vacía y tiene al menos 6 caracteres
        if (payload.password && typeof payload.password === 'string' && payload.password.trim().length >= 6) {
            user.password = payload.password.trim();
        }

        await user.save();

        // Repoblar para la respuesta
        const updatedUser = await UserGenAi.findById(user._id)
            .select('-password').populate('empresaRef', 'nombre rut plan modulosActivos');

        res.json(updatedUser);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// DELETE /api/auth/users/:id (solo CEO)
exports.deleteUser = async (req, res) => {
    try {
        await UserGenAi.findByIdAndDelete(req.params.id);
        res.json({ message: 'Usuario eliminado' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/stats/portales
exports.getPortalStats = async (req, res) => {
    try {
        const total = await UserGenAi.countDocuments({});
        const activosHoy = await UserGenAi.countDocuments({
            ultimoAcceso: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        });
        const suspendidos = await UserGenAi.countDocuments({ status: 'Suspendido' });

        const porRol = await UserGenAi.aggregate([
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
        const user = await UserGenAi.findById(req.params.id).select('loginHistory');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user.loginHistory || []);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};
