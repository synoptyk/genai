const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { createPortal } from')) {
    content = content.replace("import React, {", "import React, {");
    const importIdx = content.indexOf("import React");
    const endOfImport = content.indexOf('\n', importIdx);
    content = content.slice(0, endOfImport + 1) + "import { createPortal } from 'react-dom';\n" + content.slice(endOfImport + 1);
}

content = content.replace(
    '{showSignatureBuilder && (',
    '{showSignatureBuilder && createPortal('
);

content = content.replace(
    '                )}\n        </div>',
    '                ), document.body)}\n        </div>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Portal fixed.');
