const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

const hookInsert = `
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const fileInputRef = useRef(null);

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        const formData = new FormData();
        formData.append('imagen', file);

        try {
            const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
            const response = await fetch(\`\${API_URL}/api/upload\`, {
                method: 'POST',
                body: formData,
                headers: {
                    Authorization: \`Bearer \${user.token}\`
                }
            });
            const data = await response.json();
            if (response.ok && data.url) {
                setSigProfile(p => ({ ...p, logo: data.url }));
            } else {
                alert('Error al subir la imagen: ' + (data.error || 'Error desconocido'));
            }
        } catch (err) {
            console.error('Error uploading logo:', err);
            alert('Error al subir el logo');
        } finally {
            setUploadingLogo(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };
`;

content = content.replace(
    'const [generatingSig, setGeneratingSig] = useState(false);',
    'const [generatingSig, setGeneratingSig] = useState(false);\n' + hookInsert
);

const oldInput = `
                                                    <input
                                                        type="text"
                                                        placeholder={f.placeholder}
                                                        value={sigProfile[f.key] || ''}
                                                        onChange={e => setSigProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 text-slate-700 placeholder:text-slate-300 transition-all"
                                                    />
`;

const newInput = `
                                                    {f.key === 'logo' ? (
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder={f.placeholder}
                                                                value={sigProfile[f.key] || ''}
                                                                onChange={e => setSigProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                                                className="flex-1 min-w-0 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 text-slate-700 placeholder:text-slate-300 transition-all"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                disabled={uploadingLogo}
                                                                className="px-3 py-2 shrink-0 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center justify-center disabled:opacity-50"
                                                                title="Subir imagen"
                                                            >
                                                                {uploadingLogo ? <Loader2 size={16} className="animate-spin" /> : <Image size={16} />}
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                onChange={handleLogoUpload}
                                                                accept="image/*"
                                                                className="hidden"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            placeholder={f.placeholder}
                                                            value={sigProfile[f.key] || ''}
                                                            onChange={e => setSigProfile(p => ({ ...p, [f.key]: e.target.value }))}
                                                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-slate-50 text-slate-700 placeholder:text-slate-300 transition-all"
                                                        />
                                                    )}
`;

content = content.replace(oldInput, newInput);

fs.writeFileSync(file, content, 'utf8');
console.log('Upload logo logic added.');
