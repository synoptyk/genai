const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/platforms/auth/SystemCommandCenter.jsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Extract the activeModIds and modules from User modal
const activeModsRegex = /const activeModIds = \[\s*([\s\S]*?)\s*\]\.map\(m => m\.id\);/;
const match1 = content.match(activeModsRegex);
if (!match1) { console.log('Err1'); process.exit(1); }
const activeModIdsItems = match1[1];

const modulesRegex = /<div className="space-y-6">\s*\{\[\s*([\s\S]*?)\s*\]\.map\(\(seccion, idx\)/;
const match2 = content.match(modulesRegex);
if (!match2) { console.log('Err2'); process.exit(1); }
const modulesItems = match2[1];

// 2. Define globals to inject at the top (after imports)
const globals = `
const GLOBAL_ACTIVE_MOD_IDS = [
${activeModIdsItems}
].map(m => m.id);

const GLOBAL_MODULES_CONFIG = [
${modulesItems}
];
`;

// Inject globals before `const ESTADOS` or `const ROLES`
content = content.replace('const ROLES = [', globals + '\nconst ROLES = [');

// 3. Replace in User Modal (renderFormModal)
content = content.replace(activeModsRegex, 'const activeModIds = GLOBAL_ACTIVE_MOD_IDS;');
content = content.replace(modulesRegex, '<div className="space-y-6">\n                            {GLOBAL_MODULES_CONFIG.map((seccion, idx)');

// 4. Replace in Empresa Modal (renderEmpresaModal)
const activeModsEmpresaRegex = /const activeModIds = \[\s*([\s\S]*?)\s*\];/;
content = content.replace(activeModsEmpresaRegex, 'const activeModIds = GLOBAL_ACTIVE_MOD_IDS;');

const modulesEmpresaRegex = /<div className="space-y-8">\s*\{\[\s*([\s\S]*?)\s*\]\.map\(\(seccion, idx\)/;
content = content.replace(modulesEmpresaRegex, '<div className="space-y-8">\n                                {GLOBAL_MODULES_CONFIG.map((seccion, idx)');

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully refactored modules config to globals.');
