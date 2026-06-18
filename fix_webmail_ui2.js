const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    '<p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desencriptando Mensaje...</p>',
    '<p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Descargando Mensaje...</p>'
);

fs.writeFileSync(file, content, 'utf8');
console.log('UI loading text fixed.');
