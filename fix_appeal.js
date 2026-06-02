const fs = require('fs');
const ccPath = 'client/src/platforms/operaciones/pages/PortalColaborador.jsx';
let lines = fs.readFileSync(ccPath, 'utf8').split('\n');

for(let i=0; i<lines.length; i++) {
    if (lines[i].includes('import {') && lines[i].includes('Wrench, Shield, Cpu, Layers,')) {
        if (!lines[i].includes('Check,')) {
            lines[i] = lines[i].replace('Wrench, Shield,', 'Wrench, Shield, Check,');
        }
    }

    if (lines[i].includes("const [appealForm, setAppealForm] = useState({ decos: 0, repetidores: 0, observacion: '' });")) {
        lines[i] = "    const [appealForm, setAppealForm] = useState({ decos: 0, repetidores: 0, observacion: '', actividadIncorrecta: false });";
    }

    if (lines[i].includes("observacion: ot.apelacion?.observacion || ''")) {
        lines.splice(i+1, 0, "            actividadIncorrecta: ot.apelacion?.motivo === 'actividad_incorrecta' || false");
        lines[i] = "            observacion: ot.apelacion?.observacion || '',";
        i++;
    }

    if (lines[i].includes("observacion: appealForm.observacion") && lines[i-1].includes("repetidores: appealForm.repetidores")) {
        lines.splice(i, 0, "                motivo: appealForm.actividadIncorrecta ? 'actividad_incorrecta' : 'equipos_adicionales',");
        i++;
    }

    if (lines[i].includes("<div className=\"grid grid-cols-2 gap-6\">") && lines[i-1].includes("<div className=\"space-y-6 animate-in slide-in-from-bottom duration-500\">")) {
        const toggleUI = `
                                                    <div 
                                                        className="flex items-center gap-3 px-6 py-4 bg-rose-50 border border-rose-100 rounded-3xl cursor-pointer hover:bg-rose-100 transition-colors shadow-sm"
                                                        onClick={() => setAppealForm({ ...appealForm, actividadIncorrecta: !appealForm.actividadIncorrecta })}
                                                    >
                                                        <div className={\`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors \${appealForm.actividadIncorrecta ? 'bg-rose-500 border-rose-500 text-white shadow-md' : 'bg-white border-rose-200'}\`}>
                                                            {appealForm.actividadIncorrecta && <Check size={16} strokeWidth={4} />}
                                                        </div>
                                                        <span className="text-[11px] font-black text-rose-700 uppercase tracking-[0.2em] italic select-none mt-0.5">La actividad registrada es incorrecta</span>
                                                    </div>
`;
        lines.splice(i, 0, toggleUI);
        i++;
    }

    if (lines[i].includes("placeholder=\"Describe detalladamente los equipos instalados que no aparecen en el cálculo automático...\"")) {
        lines[i] = `                                                            placeholder={appealForm.actividadIncorrecta ? "Indica qué actividad realizaste realmente y explica el error del registro..." : "Describe detalladamente los equipos instalados que no aparecen en el cálculo automático..."}`;
    }
}

fs.writeFileSync(ccPath, lines.join('\n'), 'utf8');
console.log('Fixed appeal logic');
