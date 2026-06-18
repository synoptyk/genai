const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

const hookInsert = `
    const [savedSignatures, setSavedSignatures] = useState(account?.savedSignatures || []);
    const [signatureName, setSignatureName] = useState('');

    useEffect(() => {
        if (account?.savedSignatures) {
            setSavedSignatures(account.savedSignatures);
        }
    }, [account]);

    const handleSaveNewSignature = async () => {
        if (!sigBuilderHtml) return;
        const name = prompt('Nombre para esta firma (ej. Ventas, Soporte):', 'Mi Firma');
        if (!name) return;

        setSavingSig(true);
        try {
            const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
            const res = await fetch(\`\${API_URL}/api/webmail/accounts/\${account._id}/saved-signatures\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: \`Bearer \${user.token}\`
                },
                body: JSON.stringify({ ...sigProfile, signatureHtml: sigBuilderHtml, name })
            });
            const data = await res.json();
            if (res.ok) {
                setSavedSignatures(data.savedSignatures);
                alert('Firma guardada exitosamente.');
            } else {
                throw new Error(data.message || 'Error guardando firma');
            }
        } catch (err) {
            alert(err.message);
        } finally {
            setSavingSig(false);
        }
    };

    const handleDeleteSignature = async (sigId) => {
        if (!confirm('¿Seguro que deseas eliminar esta firma?')) return;
        try {
            const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
            const res = await fetch(\`\${API_URL}/api/webmail/accounts/\${account._id}/saved-signatures/\${sigId}\`, {
                method: 'DELETE',
                headers: {
                    Authorization: \`Bearer \${user.token}\`
                }
            });
            const data = await res.json();
            if (res.ok) {
                setSavedSignatures(data.savedSignatures);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            alert(err.message);
        }
    };

    const loadSavedSignature = (sig) => {
        setSigProfile({
            nombre: sig.nombre || '',
            cargo: sig.cargo || '',
            phone: sig.phone || '',
            address: sig.address || '',
            logo: sig.logo || '',
            website: sig.website || '',
            styleKey: sig.styleKey || 'corporativa'
        });
        setSigBuilderHtml(sig.signatureHtml || '');
        setSigBuilderTab('preview');
    };
`;

content = content.replace(
    'const [generatingSig, setGeneratingSig] = useState(false);',
    'const [generatingSig, setGeneratingSig] = useState(false);\n' + hookInsert
);

// We will change the save button to call handleSaveNewSignature, 
// and add the list of saved signatures.
// First, find the right sidebar (the preview side) and add the list below it, or add it to the left sidebar.

const rightPanelEnd = `
                                    {/* Action buttons */}
                                    <div className="flex gap-2 p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
                                        <button
                                            type="button"
                                            onClick={saveSignature}
                                            disabled={savingSig || !sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            {savingSig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            {savingSig ? 'Guardando...' : '💾 Fijar como Predefinida'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveNewSignature}
                                            disabled={savingSig || !sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            <Save size={14} /> Guardar Copia
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applyBuilderSignature}
                                            disabled={!sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            <Check size={14} /> Insertar en Correo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
`;

// wait, let's find the original action buttons:
const originalButtons = `                                    {/* Action buttons */}
                                    <div className="flex gap-2 p-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
                                        <button
                                            type="button"
                                            onClick={saveSignature}
                                            disabled={savingSig || !sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            {savingSig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            {savingSig ? 'Guardando...' : '💾 Guardar Firma'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={applyBuilderSignature}
                                            disabled={!sigBuilderHtml}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all disabled:opacity-50"
                                        >
                                            <Check size={14} /> Usar esta Firma
                                        </button>
                                    </div>`;

content = content.replace(originalButtons, rightPanelEnd);

// Now let's inject the Saved Signatures list into the left form panel
const formEnd = `
                                        <button
                                            type="button"
                                            onClick={generateSignatureWithAI}
                                            disabled={generatingSig}
                                            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {generatingSig ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                            {generatingSig ? 'Generando...' : '✨ Generar con IA'}
                                        </button>
                                    </div>
                                    
                                    {/* SAVED SIGNATURES */}
                                    {savedSignatures.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">📁 Mis Firmas Guardadas</p>
                                            <div className="flex flex-col gap-2">
                                                {savedSignatures.map(sig => (
                                                    <div key={sig.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:border-indigo-300 transition-colors">
                                                        <div className="flex flex-col overflow-hidden mr-2">
                                                            <span className="text-xs font-bold text-slate-700 truncate">{sig.name}</span>
                                                            <span className="text-[10px] text-slate-500 truncate">{sig.cargo || 'Sin cargo'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button type="button" onClick={() => loadSavedSignature(sig)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Cargar firma">
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button type="button" onClick={() => handleDeleteSignature(sig.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar firma">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
`;

const originalFormEnd = `                                        <button
                                            type="button"
                                            onClick={generateSignatureWithAI}
                                            disabled={generatingSig}
                                            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {generatingSig ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                            {generatingSig ? 'Generando...' : '✨ Generar con IA'}
                                        </button>
                                    </div>
                                </div>`;

content = content.replace(originalFormEnd, formEnd);

fs.writeFileSync(file, content, 'utf8');
console.log('UI logic added.');
