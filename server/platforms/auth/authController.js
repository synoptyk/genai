const UserGenAi = require('./UserGenAi');
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
        await user.save();

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            empresa: user.empresa,
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
    const { name, email, password, empresa, cargo, role } = req.body;
    try {
        const exists = await UserGenAi.findOne({ email });
        if (exists) return res.status(400).json({ message: 'El email ya está registrado' });

        const user = await UserGenAi.create({
            name, email, password,
            empresa: empresa || { nombre: 'Gen AI Demo' },
            cargo: cargo || 'Usuario',
            role: role || 'user'
        });

        user.tokenVersion = 1;
        await user.save();

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            empresa: user.empresa,
            token: generateToken(user._id, 1)
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await UserGenAi.findById(req.user._id).select('-password');
        res.json(user);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// GET /api/auth/users (solo CEO)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await UserGenAi.find({}).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// PUT /api/auth/users/:id (solo CEO)
exports.updateUser = async (req, res) => {
    try {
        const user = await UserGenAi.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
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
