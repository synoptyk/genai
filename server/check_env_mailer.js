require('dotenv').config();
const mailer = require('./utils/mailer');
console.log('--- Verificación de Configuración ---');
console.log('SMTP_EMAIL:', process.env.SMTP_EMAIL);
process.exit(0);
