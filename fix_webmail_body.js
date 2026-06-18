const fs = require('fs');

const fileServer = 'server/platforms/comunicaciones/webmailRoutes.js';
let contentServer = fs.readFileSync(fileServer, 'utf8');

const extractorFunc = `
function extractCleanEmailBody(text) {
    if (!text) return '';
    
    // 1. Cut off previous email threads
    const threadRegexes = [
        /\\r?\\nDe: .*/i,
        /\\r?\\nFrom: .*/i,
        /\\r?\\n--+ ?Original message ?--+/i,
        /\\r?\\nEl .* escribió:/i,
        /\\r?\\nOn .* wrote:/i,
        /\\r?\\n_{10,}/,
        /\\r?\\n> De: .*/i,
        /\\r?\\n> From: .*/i
    ];
    
    let earliestIndex = text.length;
    for (const regex of threadRegexes) {
        const match = text.match(regex);
        if (match && match.index < earliestIndex) {
            earliestIndex = match.index;
        }
    }
    text = text.substring(0, earliestIndex).trim();

    // 2. Cut off signatures
    const sigRegexes = [
        /\\r?\\n-- \\r?\\n/,
        /\\r?\\nSaludos,?(\\r?\\n|$)/i,
        /\\r?\\nAtentamente,?(\\r?\\n|$)/i,
        /\\r?\\nCordialmente,?(\\r?\\n|$)/i,
        /\\r?\\nRegards,?(\\r?\\n|$)/i
    ];

    let earliestSigIndex = text.length;
    for (const regex of sigRegexes) {
        const match = text.match(regex);
        if (match && match.index > text.length * 0.2 && match.index < earliestSigIndex) {
            earliestSigIndex = match.index;
        }
    }
    
    return text.substring(0, earliestSigIndex).trim();
}
`;

if (!contentServer.includes('function extractCleanEmailBody')) {
    contentServer = contentServer.replace(
        "router.post('/ai/draft'",
        extractorFunc + "\nrouter.post('/ai/draft'"
    );
}

const oldLogic = `
        let userContent = \`Instrucción del usuario que responde: "\${instruction}"\`;
        if (originalText) {
            userContent += \`\\n\\nCorreo original al que respondo:\\n"\${originalText}"\`;
        }
`;

const newLogic = `
        let userContent = \`Instrucción del usuario que responde: "\${instruction}"\`;
        if (originalText) {
            const cleanedText = extractCleanEmailBody(originalText);
            userContent += \`\\n\\nCorreo recibido (cuerpo limpio, sin historial ni firmas):\\n"\${cleanedText.substring(0, 1500)}"\`;
        }
`;

contentServer = contentServer.replace(oldLogic, newLogic);

const oldPrompt = `5. NUNCA inventes información, datos, nombres ni fechas que no se te hayan dado explícitamente en la instrucción.`;
const newPrompt = `5. NUNCA inventes información, datos, nombres ni fechas que no se te hayan dado explícitamente en la instrucción.\n6. Ignora cualquier pie de firma residual o información de contacto del correo recibido. Céntrate únicamente en la intención principal del correo recibido.`;

contentServer = contentServer.replace(oldPrompt, newPrompt);

fs.writeFileSync(fileServer, contentServer, 'utf8');
console.log('Done');
