const jwt = require('jsonwebtoken');
const UserGenAi = require('./UserGenAi');

exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'genai_secret_2026');
            const user = await UserGenAi.findById(decoded.id).select('-password');
            if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
            // Solo rechaza si el token es más viejo que el actual (forzado por cambio de contraseña o logout forzado)
            if (decoded.version !== undefined && user.tokenVersion !== undefined && decoded.version < user.tokenVersion)
                return res.status(401).json({ message: 'Sesión expirada. Inicie sesión de nuevo.' });
            req.user = user;
            return next();
        } catch (e) {
            return res.status(401).json({ message: 'Token inválido' });
        }
    }
    return res.status(401).json({ message: 'Sin autorización, no hay token' });
};

exports.authorize = (...roles) => (req, res, next) => {
    // EL OJO DE DIOS: El CEO siempre tiene acceso a todo.
    if (req.user.role === 'ceo_genai') return next();

    if (!roles.includes(req.user.role))
        return res.status(403).json({ message: `Rol '${req.user.role}' no autorizado para este recurso` });
    next();
};
