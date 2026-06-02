const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'client/src/platforms/auth/SystemCommandCenter.jsx');
let content = fs.readFileSync(file, 'utf8');

const lines = content.split('\n');

// Extract User activeModIds
const userActiveStart = lines.findIndex(l => l.includes("const activeModIds = [") && l.includes("{ id: 'admin_resumen_ejecutivo' }"));
const userActiveEnd = lines.findIndex((l, i) => i > userActiveStart && l.includes("].map(m => m.id);"));
const userActiveMods = lines.slice(userActiveStart, userActiveEnd + 1).join('\n');

// Extract User modules
const userModsStart = lines.findIndex(l => l.includes("category: 'Administración'") && !l.includes("category: 'Administración', icon: Settings, color: 'indigo',")) - 2; 
// Let's just find exactly by line number since I just viewed them:
// 601:                             {[
// 744:                                 ].map((seccion, idx) => (
const userModules = lines.slice(601, 744).join('\n');

// Extract Empresa activeModIds
const empActiveStart = lines.findIndex(l => l.includes("const activeModIds = [") && l.includes("'admin_resumen_ejecutivo'"));
const empActiveEnd = lines.findIndex((l, i) => i > empActiveStart && l.includes("let allSelected = true;"));

// Extract Empresa modules
// 1185:                                 {[
// 1324:                                 ].map((cat, catIdx) => (
const empModulesStart = 1184;
const empModulesEnd = 1323;

// Now let's do the replacement via string replace, but safely.
// For activeModIds:
let empActiveContent = lines.slice(empActiveStart, empActiveEnd).join('\n');
content = content.replace(empActiveContent, userActiveMods);

// For modules:
let empModulesContent = lines.slice(empModulesStart, empModulesEnd + 1).join('\n');
// Ensure indentation is correct
let userModulesIndented = lines.slice(601, 744).map(l => '        ' + l).join('\n'); 
content = content.replace(empModulesContent, userModulesIndented);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed Empresa Modal using exact line references!');
