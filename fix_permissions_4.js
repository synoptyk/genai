const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const ccPath = path.join(ROOT, 'client/src/platforms/auth/SystemCommandCenter.jsx');
let cc = fs.readFileSync(ccPath, 'utf8');

// 1. Extract the good 'modules' array and 'activeModIds' from the User modal
const activeModMatch = cc.match(/const activeModIds = \[\s+([^\]]+)\]\.map\(m => m\.id\);/);
if (!activeModMatch) {
    console.log("Could not find User activeModIds");
    process.exit(1);
}
const userActiveModIdsStr = activeModMatch[1]; // The inner content

// 2. Extract the good 'modules' array
// It starts around "const modules = [" or "\[\s+\{\s+category: 'Administración'"
const modulesMatch = cc.match(/<div className="space-y-6">\s+\{\[\s*([\s\S]*?)\s*\]\.map\(\(seccion, idx\)/);
if (!modulesMatch) {
    console.log("Could not find User modules array");
    process.exit(1);
}
const userModulesStr = modulesMatch[1];

// 3. Now replace in the Empresa modal
// Replace activeModIds
cc = cc.replace(
    /const activeModIds = \[[^\]]+\];/,
    `const activeModIds = [\n                                        ${userActiveModIdsStr}\n                                    ].map(m => m.id);`
);

// Replace modules
cc = cc.replace(
    /<div className="space-y-8">\s+\{\[\s*[\s\S]*?\s*\]\.map\(\(seccion, idx\)/,
    `<div className="space-y-8">\n                                {[\n${userModulesStr}\n                                ].map((seccion, idx)`
);

fs.writeFileSync(ccPath, cc, 'utf8');
console.log("Successfully synchronized Empresa modal with User modal permissions.");
