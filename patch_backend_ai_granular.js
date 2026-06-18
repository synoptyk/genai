const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

// We need to add granular permission check before generating AI responses.
// In webmailRoutes.js, we have routes like router.post('/ai/draft', ...

// The middleware `protect` handles attaching req.user.
// So we can just check req.user.permisosModulos... inside the AI routes!
const granularCheckCode = `
    // Granular AI Permissions Check
    if (!req.user || !req.user.permisosModulos || !req.user.permisosModulos.ai_genai_mail || !req.user.permisosModulos.ai_genai_mail.ver) {
        return res.status(403).json({ error: 'Acceso Denegado: Permiso granular AI_GENAI_MAIL requerido para consumo de tokens IA.' });
    }
`;

// Replace in /ai/draft
content = content.replace(
    /router\.post\('\/ai\/draft',\s*protect,\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/,
    "router.post('/ai/draft', protect, async (req, res) => {\n" + granularCheckCode
);

// Replace in /ai/summarize
content = content.replace(
    /router\.post\('\/ai\/summarize',\s*protect,\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/,
    "router.post('/ai/summarize', protect, async (req, res) => {\n" + granularCheckCode
);

// Replace in /ai/smart-replies
content = content.replace(
    /router\.post\('\/ai\/smart-replies',\s*protect,\s*async\s*\(\s*req,\s*res\s*\)\s*=>\s*\{/,
    "router.post('/ai/smart-replies', protect, async (req, res) => {\n" + granularCheckCode
);

fs.writeFileSync(file, content, 'utf8');
console.log('Backend granular AI permissions applied.');
