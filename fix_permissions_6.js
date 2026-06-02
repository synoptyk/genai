const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/platforms/auth/SystemCommandCenter.jsx');
let content = fs.readFileSync(file, 'utf8');

// The User activeModIds is inside onClick for "Seleccionar Todo General" in renderFormModal
const userActiveModsRegex = /const activeModIds = \[\s*([^\]]+)\s*\]\.map\(m => m\.id\);/;
const uMatch1 = content.match(userActiveModsRegex);
const userActiveModIdsStr = uMatch1[1];

// The User modules array is inside renderFormModal
const userModulesRegex = /<div className="space-y-6">\s*\{\[\s*([\s\S]*?)\s*\]\.map\(\(seccion, idx\)/;
const uMatch2 = content.match(userModulesRegex);
const userModulesStr = uMatch2[1];

// Now we replace the Empresa ones (they are further down in renderEmpresaModal)
// It has `const activeModIds = [` instead of `.map` initially, but let's just find the onClick
const empOnClickRegex = /const activeModIds = \[\s*([^\]]+)\s*\];\s*let allSelected = true;/;
content = content.replace(empOnClickRegex, `const activeModIds = [\n                                        ${userActiveModIdsStr}\n                                    ].map(m => m.id);\n\n                                        let allSelected = true;`);

// And replace the Empresa modules array
const empModulesRegex = /<div className="space-y-8">\s*\{\[\s*([\s\S]*?)\s*\]\.map\(\(seccion, idx\)/;
content = content.replace(empModulesRegex, `<div className="space-y-8">\n                                {[\n${userModulesStr}\n                                ].map((seccion, idx)`);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed Empresa modal properly!');
