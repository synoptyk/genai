const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

// replace the authorize import to also import authorizeAI
if (!content.includes('authorizeAI')) {
    content = content.replace(/const \{ protect, authorize \} = require\('\.\.\/auth\/authMiddleware'\);/, "const { protect, authorize, authorizeAI } = require('../auth/authMiddleware');");
}

// replace in all /ai/ routes
content = content.replace(/authorize\('solo_altos_mandos'\)/g, 'authorizeAI');

fs.writeFileSync(file, content, 'utf8');
console.log('webmailRoutes patched with authorizeAI');
