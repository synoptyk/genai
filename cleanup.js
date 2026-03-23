const fs = require('fs');
let content = fs.readFileSync('client/src/platforms/agentetelecom/ProduccionVenta.jsx', 'utf8');

// Remove table headers
content = content.replace(/<th[^>]*>Pts Base<\/th>/g, '');
content = content.replace(/<th[^>]*>Deco<\/th>/g, '');
content = content.replace(/<th[^>]*>Repetidor<\/th>/g, '');
content = content.replace(/<th[^>]*>Teléfono<\/th>/g, '');

// Remove table columns keys in mobile view
content = content.replace(/\{ key: 'ptsBase', label: 'Pts Base' \},/g, '');
content = content.replace(/\{ key: 'ptsDeco', label: 'Deco' \},/g, '');
content = content.replace(/\{ key: 'ptsRepetidor', label: 'Repetidor' \},/g, '');
content = content.replace(/\{ key: 'ptsTelefono', label: 'Teléfono' \},/g, '');

// Remove table cells
content = content.replace(/<td[^>]*>{fmtPts\(tech\.ptsBase\)}<\/td>/g, '');
content = content.replace(/<td[^>]*>{fmtPts\(tech\.ptsDeco\)}<\/td>/g, '');
content = content.replace(/<td[^>]*>{fmtPts\(tech\.ptsRepetidor\)}<\/td>/g, '');
content = content.replace(/<td[^>]*>{fmtPts\(tech\.ptsTelefono\)}<\/td>/g, '');

// Remove CompositionBar renders
content = content.replace(/<CompositionBar base=\{tech\.ptsBase\}[^>]*\/>/g, '');
content = content.replace(/<td colSpan=\{4\}[^>]*>\s*<CompositionBar[^>]*\/>\s*<\/td>/g, ''); // In table totals
content = content.replace(/<MiniStat label="Pts Base"[^>]*\/>/g, '');
content = content.replace(/<MiniStat label="Pts Deco"[^>]*\/>/g, '');
content = content.replace(/<MiniStat label="Repetidores"[^>]*\/>/g, '');
content = content.replace(/<MiniStat label="Teléfonos"[^>]*\/>/g, '');

// Remove totals
content = content.replace(/\{fmtPts\(sortedTechRanking\.reduce\(\(s, t\) => s \+ t\.ptsBase, 0\)\)\}/g, '');
content = content.replace(/\{fmtPts\(sortedTechRanking\.reduce\(\(s, t\) => s \+ t\.ptsDeco, 0\)\)\}/g, '');
content = content.replace(/\{fmtPts\(sortedTechRanking\.reduce\(\(s, t\) => s \+ t\.ptsRepetidor, 0\)\)\}/g, '');
content = content.replace(/\{fmtPts\(sortedTechRanking\.reduce\(\(s, t\) => s \+ t\.ptsTelefono, 0\)\)\}/g, '');

// Excel export cleanup
content = content.replace(/'Pts Base': Math\.round\(t\.ptsBase \* 100\) \/ 100,/g, '');
content = content.replace(/'Pts Deco': Math\.round\(t\.ptsDeco \* 100\) \/ 100,/g, '');
content = content.replace(/'Pts Repetidor': Math\.round\(t\.ptsRepetidor \* 100\) \/ 100,/g, '');
content = content.replace(/'Pts Teléfono': Math\.round\(t\.ptsTelefono \* 100\) \/ 100,/g, '');

fs.writeFileSync('client/src/platforms/agentetelecom/ProduccionVenta.jsx', content);
console.log('Cleanup complete');
