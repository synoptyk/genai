const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

const oldAiDraft = `router.post('/ai/draft', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { instruction, originalText } = req.body;
        let userContent = \`Instrucción: "\${instruction}"\`;
        if (originalText) {
            userContent += \`\\n\\nCorreo original al que respondo:\\n"\${originalText}"\`;
        }
        const result = await groqChat(
            'Eres un experto asistente corporativo. Redacta correos profesionales en español. Responde SOLO con el cuerpo del correo en HTML limpio (sin <html>, <head> ni <body>). Usa lenguaje profesional y educado.',
            userContent
        );`;

const newAiDraft = `router.post('/ai/draft', protect, authorize('social_webmail'), async (req, res) => {
    try {
        const { instruction, originalText, responderName, responderEmail } = req.body;
        
        let userContent = \`Instrucción del usuario que responde: "\${instruction}"\`;
        if (originalText) {
            userContent += \`\\n\\nCorreo original al que respondo:\\n"\${originalText}"\`;
        }
        
        const identityName = responderName || 'el usuario';
        const identityEmail = responderEmail ? \` (\${responderEmail})\` : '';
        
        const prompt = \`Eres un asistente corporativo de redacción de correos.
Tu tarea es redactar o responder un correo electrónico en nombre de: \${identityName}\${identityEmail}.
REGLAS ESTRICTAS:
1. Sé extremadamente breve y conciso, no te explayes. Ve directo al grano sin relleno.
2. Mantén un tono muy humano, natural, educado y profesional.
3. Asegúrate SIEMPRE de que la firma, despedida o cierre del correo esté a nombre tuyo (\${identityName}), sin importar quién envió el correo original o quién lo recibe.
4. Responde SOLO con el cuerpo del correo en HTML limpio (puedes usar <b>, <p>, <br>), sin etiquetas <html> ni bloques markdown \`\`\`.
5. NUNCA inventes información, datos, nombres ni fechas que no se te hayan dado explícitamente en la instrucción.\`;

        const result = await groqChat(prompt, userContent);`;

content = content.replace(oldAiDraft, newAiDraft);

fs.writeFileSync(file, content, 'utf8');
console.log('webmailRoutes.js AI prompt fixed.');
