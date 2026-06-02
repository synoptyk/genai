const fs = require('fs');
const ccPath = 'client/src/platforms/auth/SystemCommandCenter.jsx';
let lines = fs.readFileSync(ccPath, 'utf8').split('\n');

// Helper to get lines between two markers (start inclusive, end inclusive)
function findBounds(startMarker, endMarker, afterIndex = 0) {
    let start = -1;
    for (let i = afterIndex; i < lines.length; i++) {
        if (lines[i].includes(startMarker)) { start = i; break; }
    }
    let end = -1;
    if (start !== -1) {
        for (let i = start + 1; i < lines.length; i++) {
            if (lines[i].includes(endMarker)) { end = i; break; }
        }
    }
    return { start, end };
}

// 1. Remove rrhh_seguridad_ppe
lines = lines.filter(l => !l.includes("rrhh_seguridad_ppe: { ver: false, crear: false, editar: false, bloquear: false, eliminar: false }"));
lines = lines.map(l => l.replace(/'rrhh_seguridad_ppe',?\s*/g, ''));
lines = lines.filter(l => !l.includes("{ id: 'rrhh_seguridad_ppe'"));

// 2. Add admin_tipos_bono in User section
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("{ id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },")) {
        const match = lines[i].match(/^\s*/);
        lines.splice(i + 1, 0, match[0] + "{ id: 'admin_tipos_bono', label: 'Tipos de Bono' },");
        i++; 
    } else if (lines[i].includes("{ id: 'admin_modelos_bonificacion' },")) {
        lines[i] = lines[i].replace(
            "{ id: 'admin_modelos_bonificacion' },", 
            "{ id: 'admin_modelos_bonificacion' }, { id: 'admin_tipos_bono' },"
        );
    }
}

// 3. Extract User configs
const uActiveBounds = findBounds("const activeModIds = [", "].map(m => m.id);", 0);
const uActiveLines = lines.slice(uActiveBounds.start, uActiveBounds.end + 1);

const uModStartIdx = lines.findIndex((l, i) => i > uActiveBounds.end && l.includes("category: 'Administración'")) - 2; 
const uModEndIdx = lines.findIndex((l, i) => i > uModStartIdx && l.includes("].map((cat, catIdx) => {"));
const uModLines = lines.slice(uModStartIdx, uModEndIdx); 

// 4. Find Empresa configs
const eActiveBounds = findBounds("const activeModIds = [", "let allSelected = true;", uModEndIdx);
let eActiveEndReal = eActiveBounds.end;
while (!lines[eActiveEndReal].includes("];")) { eActiveEndReal--; }

const eModStartIdx = lines.findIndex((l, i) => i > eActiveBounds.end && l.includes("category: 'Administración'")) - 2; 
const eModEndIdx = lines.findIndex((l, i) => i > eModStartIdx && l.includes("].map((cat, catIdx) => ("));

// 5. Replace Empresa configs with User configs
// Replace modules
lines.splice(eModStartIdx, eModEndIdx - eModStartIdx, ...uModLines.map(l => '        ' + l));

// Then replace activeModIds
lines.splice(eActiveBounds.start, eActiveEndReal - eActiveBounds.start + 1, ...uActiveLines.map(l => '                                    ' + l.trim()));

fs.writeFileSync(ccPath, lines.join('\n'), 'utf8');
console.log('Fixed gracefully without breaking anything!');
