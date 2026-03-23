const fs = require('fs');

let content = fs.readFileSync('/tmp/Produccion_backup.jsx', 'utf8');

// 1. Rename Component
content = content.replace(/export default function Produccion\(\)/g, "export default function ProduccionVenta()");

// 2. Change API endpoint
content = content.replace(/'\/bot\/produccion-stats\?/, "'/bot/produccion-financiera?");

// 3. Redefine fmtPts to use CLP
const clpFunc = `const CLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
const fmtPts = CLP;`;
content = content.replace(/const fmtPts = [\s\S]*?\n\};/, clpFunc);

// 4. Update texts and titles
content = content.replace(/Ranking de Técnicos por Producción/g, "Ranking de Técnicos por Facturación");
content = content.replace(/>Puntos Totales</g, ">Facturación<");
content = content.replace(/Total Puntos/g, "Facturación Total");

// 5. Update data field mappings from API response
// data.stats -> data.kpis
content = content.replace(/data\.stats/g, "data.kpis");
// Field renames
content = content.replace(/kpis\.totalPts/g, "kpis.totalFacturacion");
content = content.replace(/kpis\.totalOrders/g, "kpis.totalOrdenes");
content = content.replace(/kpis\.avgPtsPerTechPerDay/g, "kpis.avgFactTecDia");

// Replace tech properties correctly using regex without breaking pure variable names
content = content.replace(/\.ptsTotal/g, ".facturacion");
content = content.replace(/'ptsTotal'/g, "'facturacion'");

// Daily map properties
content = content.replace(/\.dailyMap\[(.*?)\]\.pts/g, ".dailyMap[$1].clp");
content = content.replace(/\.pts \+/g, ".clp +"); // For some reduce functions
content = content.replace(/pts:/g, "clp:"); // Inside object destructuring or properties if any, but let's be careful.

// We know `Produccion.jsx` uses:
// - Object.values(t.dailyMap).reduce((s, v) => s + v.pts, 0)
// - d.pts inside maps.
// Let's do a slightly safer replace for `.pts` -> `.clp` for specific known object structures:
content = content.replace(/v\.pts/g, "v.clp");
content = content.replace(/d\.pts/g, "d.clp");
content = content.replace(/a\.totalPts/g, "a.totalCLP");
content = content.replace(/a\.totalCLP \+/g, "a.totalCLP +"); 

content = content.replace(/\.totalPts/g, ".totalCLP");

// 6. In Produccion.jsx, it uses `ptsTotal(doc)` helper. But we overrode `.ptsTotal` property access.
// Let's replace 'Pts Totales:' with 'Facturación:'
content = content.replace(/Pts Totales:/g, "Facturación:");

// 7. Change Semaphores. Meta de produccion is now metaFactMes.
content = content.replace(/data\.metaConfig\?\.metaProduccionSemana/g, "data.kpis?.metaFactMes / 4"); // Approximate week
content = content.replace(/data\.metaConfig\?\.metaProduccionMes/g, "data.kpis?.metaFactMes");
content = content.replace(/data\.metaConfig\?\.metaProduccionDia/g, "(data.kpis?.metaFactMes / 22)");

// Save output
fs.writeFileSync('client/src/platforms/agentetelecom/ProduccionVenta.jsx', content);
console.log("Migration complete!");
