const fs = require('fs');
const file = 'server/platforms/auth/authMiddleware.js';
let content = fs.readFileSync(file, 'utf8');

const newMiddleware = `
exports.authorizeAI = (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'No autorizado.' });
        }

        const indPerms = req.user.permisosModulos || {};
        const pMail = indPerms instanceof Map ? indPerms.get('ai_genai_mail') : indPerms['ai_genai_mail'];
        const pInteligencia = indPerms instanceof Map ? indPerms.get('ai_genai_inteligencia') : indPerms['ai_genai_inteligencia'];

        if ((pMail && pMail.ver === true) || (pInteligencia && pInteligencia.ver === true)) {
            return next();
        }

        return res.status(403).json({ 
            message: 'Acceso denegado: Se requiere permiso granular explícito para consumo de Tokens IA (ai_genai_mail / ai_genai_inteligencia).' 
        });
    } catch (err) {
        console.error('AuthorizeAI Error:', err);
        return res.status(500).json({ message: 'Error de autorización IA' });
    }
};
`;

if (!content.includes('exports.authorizeAI =')) {
    content = content + '\n' + newMiddleware;
    fs.writeFileSync(file, content, 'utf8');
}
console.log('authMiddleware patched with authorizeAI');
