const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('), document.body)}', ', document.body)}');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed extra parenthesis.');
