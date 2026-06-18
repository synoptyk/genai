const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    '                placeholder={placeholder}\n{/* Render builder modal when open */}',
    '                placeholder={placeholder}\n            />\n{/* Render builder modal when open */}'
);

content = content.replace(
    '                )}\n\n\n            />\n        </div>',
    '                )}\n        </div>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Syntax fixed.');
