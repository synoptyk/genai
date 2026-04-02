const jwt = require('jsonwebtoken');
const PlatformUser = require('./PlatformUser');
const ROLES = require('./roles');

exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) return res.status(401).json({ message: 'Sin autorización, no hay token' });

    try {
        const secret = process.env.JWT_SECRET || 'platform_secret_2026';
        if (!process.env.JWT_SECRET) {
            console.warn('⚠️ WARN: JWT_SECRET no definido; usando secret por defecto (no recomendado en producción).');
        }
        const decoded = jwt.verify(token, secret);
        const user = await PlatformUser.findById(decoded.id).select('-password');
        if (!user) {
            console.error(`❌ [Auth] Error: Usuario ID ${decoded.id} no encontrado en DB`);
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }
        
        if (decoded.version !== undefined && user.tokenVersion !== undefined && decoded.version < user.tokenVersion) {
            console.error(`❌ [Auth] Sesión expirada para ${user.email} (Token v${decoded.version} < DB v${user.tokenVersion})`);
            return res.status(401).json({ message: 'Sesión expirada. Inicie sesión de nuevo.' });
        }
            
        req.user = user;

        // FALLBACK LEGACY: Si no tiene empresaRef pero tiene empresa.nombre, inyectar el ID real
        if (!req.user.empresaRef && req.user.empresa?.nombre) {
            const mongoose = require('mongoose');
            const Empresa = mongoose.models.Empresa || mongoose.model('Empresa', new mongoose.Schema({ nombre: String }));
            const empFallback = await Empresa.findOne({ nombre: req.user.empresa.nombre }).select('_id').lean();
            if (empFallback) req.user.empresaRef = empFallback._id;
        }

        // EL OJO DE DIOS: Si es CEO/ADMIN y viene un override, aplicamos el cambio de contexto
        const companyOverride = req.headers['x-company-override'];
        if ([ROLES.SYSTEM_ADMIN, ROLES.CEO, ROLES.ADMIN].includes(user.role) && companyOverride) {
            req.user.empresaRef = companyOverride;
        }

        return next();
    } catch (e) {
        console.error('❌ [Auth] JWT Verify Error:', e.message);
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
        let currentRole = String(req.user.role || '').toLowerCase().trim();
        const currentEmail = String(req.user.email || '').toLowerCase().trim();

        // 🧪 Normalización de variantes (Supervisor HSE -> Supervisor)
        if (currentRole === 'supervisor_hse') currentRole = 'supervisor';
        
        // Bypass absoluto para Administrador del Sistema, CEO (nuevo y legado), Gerencia o Admin
        const isHighLevel = [
            ROLES.SYSTEM_ADMIN, 
            ROLES.CEO, 
            ROLES.CEO_GENAI, // Legacy support
            ROLES.GERENCIA, 
            ROLES.ADMIN
        ].includes(currentRole);

        if (isHighLevel) return next();

        // ─────────────────────────────────────────────────────────────────────
        // LÓGICA DE PERMISOS GRANULARES & ROLES (BLINDAJE 2026)
        // ─────────────────────────────────────────────────────────────────────
        const indPerms = req.user.permisosModulos || {};

        for (const r of roles) {
            const requirement = String(r).trim();

            // 1. Caso: Permiso Granular (Ej: 'rrhh_captura:crear')
            if (requirement.includes(':')) {
                const [moduleKey, action] = requirement.split(':');
                // Normalización: suspender -> bloquear
                const effectiveAction = action === 'suspender' ? 'bloquear' : action;
                
                const p = indPerms instanceof Map ? indPerms.get(moduleKey) : indPerms[moduleKey];
                if (p && p[effectiveAction] === true) {
                    return next();
                }
                // Si llegamos aquí para un permiso granular, NO permitimos heredar por rol simple
                // a menos que sea CEO (ya validado arriba).
            } 
            // 2. Caso: Solo Módulo (Ej: 'rrhh_captura') -> Default a 'ver'
            else if (requirement.includes('_')) {
                const p = indPerms instanceof Map ? indPerms.get(requirement) : indPerms[requirement];
                if (p?.ver === true) return next();
            }
            // 3. Caso: Rol Tradicional (Ej: 'admin', 'gerencia')
            // EL BLINDAJE: Solo permitimos el bypass por rol si el requisito NO es una acción granular
            else {
                const roleLower = requirement.toLowerCase();
                if (currentRole === roleLower) {
                    // Si el rol coincide, verificamos si hay algún permiso granular en la lista de 'roles' (requirements)
                    // que sea de escritura. Si lo hay, forzamos a que el usuario lo tenga.
                    // Pero para simplicidad radical: Si el usuario es admin y el requisito es 'admin', pasa.
                    return next();
                }
            }
        }

        // Error informativo detallado (Blindaje)
        return res.status(403).json({ 
            message: `Acceso denegado: No tienes los permisos necesarios (${roles.join(' o ')}) para esta acción.`,
            debug: {
                currentRole,
                required: roles,
                is_ceo_bypass: isHighLevel
            }
        });
    } catch (err) {
        console.error('Authorize Middleware Error:', err);
        return res.status(500).json({ message: 'Error en proceso de autorización', error: err.message });
    }
};
