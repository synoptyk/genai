const fs = require('fs');
const path = require('path');

const ccPath = path.join(__dirname, 'client/src/platforms/auth/SystemCommandCenter.jsx');
let cc = fs.readFileSync(ccPath, 'utf8');

// 1. Remove rrhh_seguridad_ppe globally
cc = cc.replace(/\n\s*rrhh_seguridad_ppe:\s*\{\s*ver:\s*false,\s*crear:\s*false,\s*editar:\s*false,\s*bloquear:\s*false,\s*eliminar:\s*false\s*\},?/g, '');
cc = cc.replace(/\{ id: 'rrhh_seguridad_ppe',\s*label:[^}]+},?/g, '');
cc = cc.replace(/'rrhh_seguridad_ppe',?/g, '');

// 2. Add admin_tipos_bono globally next to admin_modelos_bonificacion
cc = cc.replace(
    /\{ id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' \},/g,
    "{ id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },\n                                            { id: 'admin_tipos_bono', label: 'Tipos de Bono' },"
);
// And in the activeModIds arrays
cc = cc.replace(
    /'admin_modelos_bonificacion',/g,
    "'admin_modelos_bonificacion', 'admin_tipos_bono',"
);

// We need to make sure the other 17 modules are also added to Empresa!
// It's safer to just extract the User modal arrays and replace the Empresa arrays properly.

const uModulesStart = cc.indexOf("category: 'Administración', icon: Settings, color: 'indigo',") - 38;
const uModulesEnd = cc.indexOf("].map((seccion, idx) => (") + 1;
const userModulesStr = cc.substring(uModulesStart, uModulesEnd);

const eModulesStart = cc.lastIndexOf("category: 'Administración', icon: Settings, color: 'indigo',") - 42;
const eModulesEnd = cc.lastIndexOf("].map((cat, catIdx) => (") + 1;

// Replace Empresa modules string with User modules string
// However, User uses seccion, Empresa uses cat. We just need to replace the ARRAY, not the `.map` call.
const uArrayStart = cc.indexOf("[", uModulesStart);
const uArrayEnd = cc.indexOf("]", cc.indexOf("category: 'GENAI360'", uModulesStart)) + 1; // End of array
const userArrayStr = cc.substring(uArrayStart, uArrayEnd);

const eArrayStart = cc.indexOf("[", eModulesStart);
const eArrayEnd = cc.indexOf("]", cc.lastIndexOf("category: 'GENAI360'")) + 1; // End of array

cc = cc.substring(0, eArrayStart) + userArrayStr + cc.substring(eArrayEnd);

// Also sync activeModIds
const uActiveModsStrMatch = cc.match(/const activeModIds = \[\s*([\s\S]*?)\s*\]\.map\(m => m\.id\);/);
const eActiveModsRegex = /const activeModIds = \[\s*([\s\S]*?)\s*\];/;

if (uActiveModsStrMatch) {
    cc = cc.replace(eActiveModsRegex, `const activeModIds = [\n${uActiveModsStrMatch[1]}].map(m => m.id);`);
}

fs.writeFileSync(ccPath, cc, 'utf8');
console.log('Fixed gracefully.');
