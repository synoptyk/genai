const fs = require('fs');

// Fix Webmail.jsx
const fileClient = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let contentClient = fs.readFileSync(fileClient, 'utf8');

const oldAiCall = `originalText: replyTo ? (replyTo.textBody || replyTo.htmlBody) : null,`;
const newAiCall = `originalText: replyTo ? ((replyTo.textBody || replyTo.htmlBody || '').substring(0, 1500)) : null,`;
contentClient = contentClient.replace(oldAiCall, newAiCall);

const oldError = `setError('⚠️ Cuota de IA agotada. Has alcanzado el límite diario de Gemini. Espera unos minutos e intenta de nuevo.');`;
const newError = `setError('⚠️ Cuota de IA agotada. Has alcanzado el límite de tokens gratuitos de Groq. Se repondrá automáticamente en unos minutos.');`;
contentClient = contentClient.replace(oldError, newError);

fs.writeFileSync(fileClient, contentClient, 'utf8');

// Fix Server model
const fileServer = 'server/platforms/comunicaciones/webmailRoutes.js';
let contentServer = fs.readFileSync(fileServer, 'utf8');

contentServer = contentServer.replace(
    "const GROQ_MODEL = 'llama-3.3-70b-versatile';",
    "const GROQ_MODEL = 'llama3-8b-8192';"
);

fs.writeFileSync(fileServer, contentServer, 'utf8');

console.log('Fixed quota issue by truncating text and using a lighter model.');
