const jwt = require('jsonwebtoken');
const UserGenAi = require('./UserGenAi');

exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ message: 'Sin autorización, no hay token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'genai_secret_2026');
        const user = await UserGenAi.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
        
        if (decoded.version !== undefined && user.tokenVersion !== undefined && decoded.version < user.tokenVersion)
            return res.status(401).json({ message: 'Sesión expirada. Inicie sesión de nuevo.' });
            
        req.user = user;

        // EL OJO DE DIOS: Si es CEO y viene un override, aplicamos el cambio de contexto
        const companyOverride = req.headers['x-company-override'];
        if (['ceo_genai', 'ceo'].includes(user.role) && companyOverride) {
            req.user.empresaRef = companyOverride;
        }

        return next();
    } catch (e) {
        return res.status(401).json({ message: 'Token inválido' });
    }
};

exports.authorize = (...roles) => (req, res, next) => {
    try {
        if (!req.user) {
            console.error('CRITICAL: req.user is missing in authorize');
            return res.status(500).json({ message: 'Error interno: contexto de usuario no encontrado' });
        }
        
        // Normalizar rol
        const currentRole = String(req.user.role || '').toLowerCase().trim();
        
        // EL OJO DE DIOS: Bypass absoluto para CEO
        const isCeo = currentRole === 'ceo_genai' || currentRole === 'ceo';
        if (isCeo) return next();

        // Verificar contra lista autorizada (también normalizada)
        const authorizedRoles = roles.map(r => String(r).toLowerCase().trim());
        if (authorizedRoles.includes(currentRole)) return next();

        // Error informativo
        return res.status(403).json({ 
            message: `Acceso denegado: tu rol '${currentRole}' no tiene permisos para este recurso.`,
            debug: {
                currentRole,
                authorizedRoles,
                is_ceo_bypass: isCeo,
                hint: "Si eres CEO, asegúrate de que tu rol en DB sea 'ceo_genai' o 'ceo'"
            }
        });
    } catch (err) {
        console.error('Authorize Middleware Error:', err);
        return res.status(500).json({ message: 'Error en proceso de autorización', error: err.message });
    }
};
