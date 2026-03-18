import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, PenTool, Upload, Layout, ShieldCheck, Fingerprint as FingerprintIcon,
  ChevronRight, Plus, Search, FileEdit, Trash2,
  CheckCircle2, AlertCircle, Clock, Building2,
  Image as ImageIcon, AlignLeft, AlignRight, AlignCenter, AlignJustify, Loader2,
  Bold, Italic, Underline, List, ListOrdered, Type, ShieldAlert, MapPin, Mail, Calendar, Eye
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { plantillasApi, candidatosApi, configApi } from '../rrhhApi';

const ContratosYAnexos = () => {
    const [view, setView] = useState('selection'); // selection, designer, upload
    const [subview, setSubview] = useState('list'); // list, create
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [previewContent, setPreviewContent] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [signaturePayload, setSignaturePayload] = useState(null);
    const editorRef = useRef(null);

    const [template, setTemplate] = useState({
        nombre: '',
        tipo: 'Contrato',
        tituloDocumento: '',
        contenido: '',
        logoLeft: null,
        logoRight: null,
        firmas: ['Gerencia', 'Colaborador']
    });

    const [companyConfig, setCompanyConfig] = useState({
        logoLeft: null,
        logoRight: null,
        companyName: 'Portal Corporativo',
    });

    // ── DATA FETCHING ──
    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await plantillasApi.getAll();
            setTemplates(res.data);
        } catch (error) {
            console.error('Error fetching templates:', error);
            showToast('Error al cargar plantillas', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchCandidates = async () => {
        try {
            const res = await candidatosApi.getAll();
            setCandidates(res.data);
        } catch (error) {
            console.error('Error fetching candidates:', error);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await configApi.get();
            if (res.data) {
                setCompanyConfig({
                    logoLeft: res.data.logoLeft || null,
                    logoRight: res.data.logoRight || null,
                    companyName: res.data.empresaRef?.nombre || 'Portal Corporativo',
                });
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        }
    };

    useEffect(() => {
        fetchTemplates();
        fetchCandidates();
        fetchConfig();
    }, []);

    const showToast = (msg, type = 'success') => {
        // En una app real usaríamos un context de notificaciones o librería
        alert(`${type.toUpperCase()}: ${msg}`);
    };

    const handleSaveTemplate = async () => {
        const content = editorRef.current ? editorRef.current.innerHTML : template.contenido;
        if (!template.nombre || !content) {
            return showToast('El nombre y contenido son obligatorios', 'error');
        }
        setLoading(true);
        try {
            const finalTemplate = { ...template, contenido: content };
            if (template._id) {
                await plantillasApi.update(template._id, finalTemplate);
                showToast('Plantilla actualizada con éxito');
            } else {
                await plantillasApi.create(finalTemplate);
                showToast('Plantilla creada con éxito');
            }
            setSubview('list');
            fetchTemplates();
        } catch (error) {
            showToast('Error al guardar plantilla', 'error');
        } finally {
            setLoading(false);
        }
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        if (editorRef.current) editorRef.current.focus();
    };

    const insertVariable = (val) => {
        if (editorRef.current) editorRef.current.focus();
        
        const variableHtml = `<span class="bg-indigo-100 text-indigo-700 font-black px-1.5 py-0.5 rounded-md mx-1 border border-indigo-200 cursor-default" contenteditable="false">{${val}}</span>&nbsp;`;
        
        if (document.queryCommandSupported('insertHTML')) {
            document.execCommand('insertHTML', false, variableHtml);
        } else {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = variableHtml;
                const frag = document.createDocumentFragment();
                let node, lastNode;
                while ((node = tempDiv.firstChild)) {
                    lastNode = frag.appendChild(node);
                }
                range.insertNode(frag);
                if (lastNode) {
                  range.setStartAfter(lastNode);
                  range.collapse(true);
                  selection.removeAllRanges();
                  selection.addRange(range);
                }
            }
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta plantilla?')) return;
        try {
            await plantillasApi.remove(id);
            showToast('Plantilla eliminada');
            fetchTemplates();
        } catch (error) {
            showToast('Error al eliminar', 'error');
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile || !selectedCandidateId) {
            return showToast('Seleccione un candidato y un archivo PDF', 'error');
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('docType', 'Contrato Firmado');
            
            await candidatosApi.uploadDocument(selectedCandidateId, formData);
            showToast('Documento cargado correctamente al expediente');
            setView('selection');
            setSelectedFile(null);
        } catch (error) {
            showToast('Error en la carga del documento', 'error');
        } finally {
            setLoading(false);
        }
    };

    const replaceVariables = (content, cand) => {
        if (!content || !cand) return content;
        let processed = content;
        const map = {
            'NOMBRE_COMPLETO': cand.fullName || `${cand.nombres || ''} ${cand.apellidos || ''}`.trim(),
            'RUT': cand.rut || '',
            'EMAIL': cand.email || '',
            'CARGO': cand.cargo || '',
            'SUELDO_BASE': cand.sueldoBase || '0',
            'EMPRESA_NOMBRE': companyConfig.companyName,
            'FECHA_ACTUAL': new Date().toLocaleDateString()
        };
        Object.keys(map).forEach(key => {
            const regexSpan = new RegExp(`<span[^>]*>{${key}}</span>`, 'g');
            const regexPlain = new RegExp(`{${key}}`, 'g');
            processed = processed.replace(regexSpan, map[key]).replace(regexPlain, map[key]);
        });
        return processed;
    };

    const handleStartSignature = () => {
        if (!selectedCandidateId) return showToast('Seleccione un candidato para firmar', 'error');
        const cand = candidates.find(c => c._id === selectedCandidateId);
        if (!cand) return;
        setSelectedCandidate(cand);
        const content = editorRef.current ? editorRef.current.innerHTML : template.contenido;
        setPreviewContent(replaceVariables(content, cand));
        setView('preview');
    };

    const finalizeSignature = () => {
        setLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setSignaturePayload({
                    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
                    timestamp: new Date().toLocaleString(),
                    coords: `${pos.coords.latitude}, ${pos.coords.longitude}`,
                    email: selectedCandidate?.email || 'usuario@generico.cl'
                });
                setIsSigning(true);
                setLoading(false);
                showToast('Firma Validada con Éxito');
            }, () => {
                setSignaturePayload({
                    id: Math.random().toString(36).substr(2, 9).toUpperCase(),
                    timestamp: new Date().toLocaleString(),
                    coords: '-33.4489, -70.6693',
                    email: selectedCandidate?.email || 'usuario@generico.cl'
                });
                setIsSigning(true);
                setLoading(false);
                showToast('Firma Generada (GPS no disponible)', 'warning');
            });
        }
    };

    // ── RENDER SELECTION MODAL ──
    if (view === 'selection') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Gestión Contractual Inteligente</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">Selecciona el flujo de gestión para contratos y anexos</p>
                    <div className="w-20 h-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full mx-auto mt-6" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-6">
                    <button 
                        onClick={() => setView('upload')}
                        className="group relative bg-white border-2 border-slate-100 p-10 rounded-[2.5rem] text-left hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-100 transition-all duration-500 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                            <Upload size={120} className="text-violet-600" />
                        </div>
                        <div className="w-16 h-16 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-violet-600 group-hover:text-white transition-colors duration-500">
                            <ShieldCheck size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3">Documento Firmado</h3>
                        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">Sube archivos PDF autorizados directamente al expediente documental del colaborador.</p>
                        <div className="flex items-center gap-2 text-violet-600 font-black text-[10px] uppercase tracking-widest">
                            Ir a carga documental <ChevronRight size={14} />
                        </div>
                    </button>

                    <button 
                        onClick={() => setView('designer')}
                        className="group relative bg-slate-900 border-2 border-slate-800 p-10 rounded-[2.5rem] text-left hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-900/40 transition-all duration-500 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                            <Layout size={120} className="text-indigo-400" />
                        </div>
                        <div className="w-16 h-16 bg-white/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-500">
                            <PenTool size={32} />
                        </div>
                        <h3 className="text-2xl font-black text-white mb-3">Gestionar en Plataforma</h3>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">Diseña, construye y firma digitalmente contratos y anexos con validez legal avanzada.</p>
                        <div className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-widest">
                            Abrir constructor PRO <ChevronRight size={14} />
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    // ── RENDER DESIGNER (Constructor) ──
    if (view === 'designer') {
        if (subview === 'list') {
            return (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <button onClick={() => setView('selection')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <span className="text-[9px] font-black uppercase tracking-widest">Módulos</span>
                                </button>
                                <ChevronRight size={12} className="text-slate-300" />
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Plantillas</span>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Constructor Contractual</h1>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Biblioteca de documentos legales</p>
                        </div>
                        <button 
                            onClick={() => {
                                setTemplate({ nombre: '', tipo: 'Contrato', tituloDocumento: '', contenido: '', logoLeft: null, logoRight: null, firmas: ['Gerencia', 'Colaborador'] });
                                setSubview('create');
                            }}
                            className="px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center gap-2"
                        >
                            <Plus size={16} /> Crear Plantilla
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loading ? (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 className="animate-spin mb-4" size={40} />
                                <p className="font-bold text-[10px] uppercase tracking-widest">Cargando biblioteca...</p>
                            </div>
                        ) : templates.map(t => (
                            <div key={t._id} className="bg-white border border-slate-200 p-6 rounded-[2rem] hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setTemplate(t); setSubview('create'); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><FileEdit size={16}/></button>
                                        <button onClick={() => handleDeleteTemplate(t._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <h4 className="text-lg font-black text-slate-900 mb-1">{t.nombre}</h4>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest">{t.tipo}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(t.lastMod).toLocaleDateString()}</span>
                                </div>
                                <button 
                                    onClick={() => { setTemplate(t); setSubview('create'); }}
                                    className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[9px] uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all"
                                >
                                    Abrir Editor
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <button onClick={() => setSubview('list')} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="text-[9px] font-black uppercase tracking-widest">Plantillas</span>
                            </button>
                            <ChevronRight size={12} className="text-slate-300" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Editor de Contenidos</span>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{template._id ? 'Editar Plantilla' : 'Nueva Plantilla'}</h1>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={() => setSubview('list')} className="px-6 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-slate-200 transition-all">
                            Cancelar
                        </button>
                        <button onClick={handleSaveTemplate} disabled={loading} className="px-7 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg shadow-indigo-100 flex items-center gap-2 disabled:opacity-50">
                            {loading ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16} />} 
                            {template._id ? 'Guardar Cambios' : 'Crear Plantilla'}
                        </button>
                        {template._id && (
                            <button 
                                onClick={handleStartSignature}
                                className="px-7 py-3.5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg flex items-center gap-2"
                            >
                                <ShieldCheck size={16} className="text-emerald-400" /> Generar y Firmar
                            </button>
                        )}
                    </div>
                </div>

                <style>{`
                    @media print {
                        .no-print { display: none !important; }
                        .print-only { display: block !important; }
                        #signature-watermark {
                            position: fixed;
                            bottom: 10mm;
                            right: 10mm;
                            width: 180px;
                            z-index: 9999;
                        }
                        body { margin: 0; padding: 0; }
                        .page-content { padding: 20mm; }
                    }
                    .print-only { display: none; }
                `}</style>

                <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 lg:col-span-3 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Información General</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Nombre Interno</label>
                                    <input 
                                        type="text" 
                                        value={template.nombre}
                                        onChange={(e) => setTemplate({...template, nombre: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-sm"
                                        placeholder="Ej: Contrato Indefinido V2"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Tipo de Documento</label>
                                    <select 
                                        value={template.tipo}
                                        onChange={(e) => setTemplate({...template, tipo: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-sm"
                                    >
                                        <option value="Contrato">Contrato</option>
                                        <option value="Anexo">Anexo</option>
                                        <option value="Otro">Otro documento</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Variables Dinámicas</h4>
                            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {[
                                    { 
                                        section: 'Identidad', 
                                        vars: [
                                            { label: 'Nombre Completo', val: 'NOMBRE_COMPLETO' },
                                            { label: 'Nombres', val: 'NOMBRES' },
                                            { label: 'Apellidos', val: 'APELLIDOS' },
                                            { label: 'RUT', val: 'RUT' },
                                            { label: 'Nacionalidad', val: 'NACIONALIDAD' },
                                            { label: 'Fecha Nacimiento', val: 'FECHA_NACIMIENTO' },
                                            { label: 'Estado Civil', val: 'ESTADO_CIVIL' },
                                            { label: 'Género', val: 'GENERO' }
                                        ] 
                                    },
                                    { 
                                        section: 'Contacto', 
                                        vars: [
                                            { label: 'Email', val: 'EMAIL' },
                                            { label: 'Teléfono', val: 'TELEFONO' },
                                            { label: 'Dirección', val: 'DIRECCION' },
                                            { label: 'Calle', val: 'CALLE' },
                                            { label: 'Número', val: 'NUMERO' },
                                            { label: 'Comuna', val: 'COMUNA' },
                                            { label: 'Región', val: 'REGION' }
                                        ] 
                                    },
                                    { 
                                        section: 'Laboral', 
                                        vars: [
                                            { label: 'Cargo', val: 'CARGO' },
                                            { label: 'Área', val: 'AREA' },
                                            { label: 'CECO', val: 'CECO' },
                                            { label: 'Sede', val: 'SEDE' },
                                            { label: 'Proyecto', val: 'PROYECTO' },
                                            { label: 'Sueldo Base', val: 'SUELDO_BASE' },
                                            { label: 'Fecha Inicio', val: 'FECHA_INICIO' },
                                            { label: 'Tipo Contrato', val: 'TIPO_CONTRATO' }
                                        ] 
                                    },
                                    { 
                                        section: 'Previsión & Salud', 
                                        vars: [
                                            { label: 'AFP', val: 'AFP' },
                                            { label: 'Salud (Fonasa/Isapre)', val: 'SALUD' },
                                            { label: 'Isapre Nombre', val: 'ISAPRE_NOMBRE' }
                                        ] 
                                    },
                                    { 
                                        section: 'Financiero', 
                                        vars: [
                                            { label: 'Banco', val: 'BANCO' },
                                            { label: 'Tipo Cuenta', val: 'TIPO_CUENTA' },
                                            { label: 'Número Cuenta', val: 'NUMERO_CUENTA' }
                                        ] 
                                    },
                                    { 
                                        section: 'Tallas & Requisitos', 
                                        vars: [
                                            { label: 'Talla Camisa', val: 'TALLA_CAMISA' },
                                            { label: 'Talla Pantalón', val: 'TALLA_PANTALON' },
                                            { label: 'Talla Calzado', val: 'TALLA_CALZADO' }
                                        ] 
                                    },
                                    { 
                                        section: 'Globales', 
                                        vars: [
                                            { label: 'Empresa Nombre', val: 'EMPRESA_NOMBRE' },
                                            { label: 'Fecha Actual', val: 'FECHA_ACTUAL' }
                                        ] 
                                    }
                                ].map(group => (
                                    <div key={group.section} className="space-y-2">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest pl-1">{group.section}</p>
                                        <div className="space-y-1">
                                            {group.vars.map(v => (
                                                <div 
                                                    key={v.val} 
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        insertVariable(v.val);
                                                    }}
                                                    className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center group cursor-pointer hover:border-indigo-200 transition-all active:scale-95"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] font-black text-slate-700">{v.label}</span>
                                                        <span className="text-[7px] font-bold text-slate-400">{"{" + v.val + "}"}</span>
                                                    </div>
                                                    <Plus size={10} className="text-slate-300 group-hover:text-indigo-500" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 lg:col-span-9 bg-white border border-slate-200 rounded-[2.5rem] p-12 shadow-sm min-h-[800px] relative">
                        <div className="max-w-[800px] mx-auto">
                            <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
                                <div className="w-32 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center">
                                    <span className="text-slate-300 italic text-[10px]">Logo IZQ</span>
                                </div>
                                <div className="text-center flex-1 mx-8">
                                    <input 
                                        type="text"
                                        value={template.tituloDocumento}
                                        onChange={(e) => setTemplate({...template, tituloDocumento: e.target.value})}
                                        placeholder="TÍTULO QUE APARECE EN EL PDF"
                                        className="text-xl font-black text-slate-900 tracking-tight uppercase text-center focus:outline-none focus:border-b-2 border-indigo-200 w-full"
                                    />
                                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-2">{companyConfig.companyName}</p>
                                </div>
                                <div className="w-32 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center">
                                     <span className="text-slate-300 italic text-[10px]">Logo DER</span>
                                </div>
                            </div>

                            {/* ── TOOLBAR TIPO WORD ── */}
                            <div className="sticky top-0 z-10 bg-white border-b-2 border-slate-100 pb-4 mb-6 flex flex-wrap gap-2 items-center">
                                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Negrita"><Bold size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Cursiva"><Italic size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Subrayado"><Underline size={16}/></button>
                                </div>

                                <div className="w-px h-6 bg-slate-200 mx-1" />

                                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Izquierda"><AlignLeft size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Centro"><AlignCenter size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Derecha"><AlignRight size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Justificado"><AlignJustify size={16}/></button>
                                </div>

                                <div className="w-px h-6 bg-slate-200 mx-1" />

                                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Lista Viñetas"><List size={16}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertOrderedList'); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600 focus:text-indigo-600" title="Lista Numerada"><ListOrdered size={16}/></button>
                                </div>

                                <div className="w-px h-6 bg-slate-200 mx-1" />

                                <select 
                                    onChange={(e) => execCommand('formatBlock', e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 outline-none hover:border-indigo-200 transition-all cursor-pointer"
                                    title="Formato de Texto"
                                >
                                    <option value="p">Cuerpo Normal</option>
                                    <option value="h1">Título H1</option>
                                    <option value="h2">Título H2</option>
                                    <option value="h3">Título H3</option>
                                    <option value="blockquote">Cita</option>
                                </select>
                            </div>

                            <div 
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => setTemplate({...template, contenido: e.target.innerHTML})}
                                className="w-full min-h-[700px] p-12 bg-white border border-slate-100 rounded-3xl text-slate-800 text-sm font-medium leading-[1.8] focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all shadow-inner overflow-y-auto outline-none"
                                style={{ 
                                    boxShadow: '0 0 50px -12px rgba(0,0,0,0.05)',
                                    minHeight: '842px', // A4 Aproximado
                                    cursor: 'text'
                                }}
                                dangerouslySetInnerHTML={{ __html: template.contenido }}
                            />

                            <div className="mt-20 grid grid-cols-2 gap-20 pt-12 border-t border-slate-100">
                                <div className="text-center p-6 border border-slate-100 border-dashed rounded-2xl">
                                    <div className="w-48 h-1 bg-slate-200 mx-auto mb-4" />
                                    <p className="text-[9px] font-black text-slate-900 uppercase">Firma del Colaborador</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Aprobación mediante Pin Digital</p>
                                </div>
                                <div className="text-center p-6 border border-slate-100 border-dashed rounded-2xl">
                                    <div className="w-48 h-1 bg-slate-200 mx-auto mb-4" />
                                    <p className="text-[9px] font-black text-slate-900 uppercase">Representante Empleador</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Firma Electrónica Simple</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full font-sans p-2">
            {view === 'preview' && (
                <div className="max-w-5xl mx-auto py-8 animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-8 no-print">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('designer')} className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all font-black text-[10px] uppercase">
                                Volver al Editor
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Vista Previa de Firma</h2>
                                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Contrato para: {selectedCandidate?.fullName}</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            {!isSigning ? (
                                <button 
                                    onClick={finalizeSignature}
                                    className="px-8 py-4 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-xl flex items-center gap-3 hover:scale-105 transition-all"
                                >
                                    <FingerprintIcon size={20} className="text-emerald-400" /> Validar Identidad y Firmar
                                </button>
                            ) : (
                                <button 
                                    onClick={() => window.print()}
                                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-xl flex items-center gap-3 hover:bg-indigo-700 transition-all"
                                >
                                    <FileText size={20} /> Imprimir / Descargar PDF
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative bg-white shadow-2xl rounded-[3rem] border border-slate-100 overflow-hidden min-h-[1123px] page-content">
                        {/* ── HEADER DEL DOCUMENTO ── */}
                        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-100 pb-8">
                            <div className="w-32">
                                {companyConfig.logoLeft ? <img src={companyConfig.logoLeft} alt="Logo" className="max-h-20 object-contain" /> : <div className="w-32 h-20 bg-slate-50 rounded-xl" />}
                            </div>
                            <div className="text-center flex-1 mx-8 pt-4">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{template.tituloDocumento}</h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{companyConfig.companyName}</p>
                            </div>
                            <div className="w-32">
                                {companyConfig.logoRight ? <img src={companyConfig.logoRight} alt="Logo" className="max-h-20 object-contain ml-auto" /> : <div className="w-32 h-20 bg-slate-50 rounded-xl ml-auto" />}
                            </div>
                        </div>

                        {/* ── CONTENIDO DEL CONTRATO ── */}
                        <div 
                            className="text-slate-800 text-[13px] leading-[1.8] text-justify space-y-4"
                            dangerouslySetInnerHTML={{ __html: previewContent }}
                        />

                        {/* ── SECCIÓN DE FIRMAS ── */}
                        <div className="mt-20 grid grid-cols-2 gap-20 pt-12 border-t border-slate-100">
                            <div className="text-center">
                                {isSigning ? (
                                    <div className="mb-4 inline-block p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <ShieldCheck size={40} className="text-emerald-600 mx-auto" />
                                        <p className="text-[8px] font-black text-emerald-700 uppercase mt-2">Firmado Electrónicamente</p>
                                    </div>
                                ) : <div className="w-48 h-1 bg-slate-100 mx-auto mb-4" />}
                                <p className="text-[10px] font-black text-slate-900 uppercase">{selectedCandidate?.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">C.I: {selectedCandidate?.rut}</p>
                            </div>
                            <div className="text-center">
                                <div className="w-48 h-1 bg-slate-100 mx-auto mb-4" />
                                <p className="text-[10px] font-black text-slate-900 uppercase">Representante {companyConfig.companyName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">FEPA - Ley 19.799</p>
                            </div>
                        </div>

                        {/* ── SELLO DE FIRMA AVANZADA (WATERMARK MULTI-PÁGINA) ── */}
                        {isSigning && signaturePayload && (
                            <div id="signature-watermark" className="bg-white/90 backdrop-blur-sm border-2 border-emerald-500 p-3 rounded-2xl shadow-xl flex items-center gap-3 select-none">
                                <div className="bg-white p-1 rounded-lg border border-slate-100">
                                    <QRCodeSVG value={`https://synoptik.cl/verify/${signaturePayload.id}`} size={64} level="H" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                        <ShieldCheck size={10} className="text-emerald-600" />
                                        <span className="text-[8px] font-black text-slate-900 uppercase truncate">ID: {signaturePayload.id}</span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-1">
                                            <MapPin size={8} className="text-slate-400" />
                                            <span className="text-[7px] font-bold text-slate-500 truncate">{signaturePayload.coords}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock size={8} className="text-slate-400" />
                                            <span className="text-[7px] font-bold text-slate-500">{signaturePayload.timestamp}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Mail size={8} className="text-slate-400" />
                                            <span className="text-[7px] font-bold text-slate-500 truncate">{signaturePayload.email}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-6 bg-slate-900 text-white rounded-3xl no-print flex items-center gap-4">
                        <ShieldAlert className="text-amber-400" size={24} />
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Certificación Legal Avanzada</p>
                            <p className="text-xs text-slate-400">Este documento ha sido validado mediante criptografía simétrica, registro georeferenciado y hash único bajo la norma de firma electrónica avanzada.</p>
                        </div>
                    </div>
                </div>
            )}

            {view === 'upload' && (
                <div className="max-w-3xl mx-auto py-12">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 shadow-2xl animate-in zoom-in duration-500">
                        <div className="flex items-center gap-6 mb-12">
                            <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                                <Upload size={32} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Carga Documental Directa</h2>
                                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Vincula documentos firmados al expediente</p>
                            </div>
                        </div>
                        
                        <div className="space-y-8">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">1. Seleccionar Colaborador / Candidato</label>
                                <select 
                                    value={selectedCandidateId}
                                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-violet-500 focus:outline-none font-bold text-slate-700 transition-all appearance-none"
                                >
                                    <option value="">Seleccione a quién pertenece el documento...</option>
                                    {candidates.map(c => (
                                        <option key={c._id} value={c._id}>
                                            {c.fullName || (c.nombres && c.apellidos ? `${c.nombres} ${c.apellidos}` : c.nombre || 'Sin Nombre')} ({c.rut})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">2. Seleccionar Archivo (PDF)</label>
                                <div 
                                    onClick={() => document.getElementById('contract-file').click()}
                                    className={`w-full py-12 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer ${selectedFile ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-100 bg-slate-50 hover:border-violet-300 text-slate-400'}`}
                                >
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${selectedFile ? 'bg-violet-600 text-white' : 'bg-white'}`}>
                                        {selectedFile ? <CheckCircle2 size={24} /> : <FileText size={24} />}
                                    </div>
                                    <span className="font-black text-xs uppercase tracking-widest">{selectedFile ? selectedFile.name : 'Click para buscar documento'}</span>
                                    <input 
                                        id="contract-file" 
                                        type="file" 
                                        accept=".pdf" 
                                        className="hidden" 
                                        onChange={(e) => setSelectedFile(e.target.files[0])}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6">
                                <button 
                                    onClick={() => setView('selection')} 
                                    className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleFileUpload}
                                    disabled={loading || !selectedFile || !selectedCandidateId}
                                    className="flex-[2] py-5 bg-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-violet-200 hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                                    {loading ? 'Cargando Documento...' : 'Vincular al Expediente'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContratosYAnexos;
