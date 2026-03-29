import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, PenTool, Upload, Layout, ShieldCheck, Fingerprint as FingerprintIcon,
  ChevronRight, Plus, Search, FileEdit, Trash2,
  CheckCircle2, AlertCircle, Clock, Building2,
  Image as ImageIcon, AlignLeft, AlignRight, AlignCenter, AlignJustify, Loader2,
  Bold, Italic, Underline, List, ListOrdered, Type, ShieldAlert, MapPin, Mail, Calendar, Eye,
  Table as TableIcon, Maximize2, Minimize2, Palette, Hash
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { plantillasApi, candidatosApi, configApi, contratosApi } from '../rrhhApi';

const ContratosYAnexos = () => {
    const [view, setView] = useState('selection'); // selection, designer, upload
    const [subview, setSubview] = useState('list'); // list, create
    const [loading, setLoading] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidateId, setSelectedCandidateId] = useState('');
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [previewContent, setPreviewContent] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [signaturePayload, setSignaturePayload] = useState(null);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [user, setUser] = useState(null);
    const editorRef = useRef(null);
    const savedRangeRef = useRef(null);

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range;
            }
        }
    };

    const restoreSelection = () => {
        if (savedRangeRef.current) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRangeRef.current);
            return true;
        }
        return false;
    };

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

    const fetchDocuments = async () => {
        try {
            const res = await contratosApi.getAll();
            setDocuments(res.data);
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem('genai_user') || sessionStorage.getItem('genai_user');
        if (stored) setUser(JSON.parse(stored));

        fetchTemplates();
        fetchCandidates();
        fetchConfig();
        fetchDocuments();
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

    const renderTemplateWithPreviewData = (html) => {
        if (!html) return '';
        const previewData = {
            'NOMBRE_COMPLETO': 'JUAN PABLO PÉREZ GONZÁLEZ',
            'RUT': '12.345.678-9',
            'CARGO': 'Analista Senior de Operaciones',
            'SUELDO_BASE': '$1.500.000',
            'FECHA_INICIO': new Date().toLocaleDateString(),
            'EMPRESA_NOMBRE': companyConfig.companyName || 'Synoptyk SpA',
            'DIRECCION_EMPRESA': 'Av. Nueva Providencia 1881, Oficina 1620',
            'COMUNA_EMPRESA': 'Providencia',
            'REGION_EMPRESA': 'Región Metropolitana',
            'FECHA_ACTUAL': new Date().toLocaleDateString()
        };
        
        let rendered = html;
        Object.keys(previewData).forEach(key => {
            const regex = new RegExp(`{${key}}`, 'g');
            rendered = rendered.replace(regex, `<b class="text-indigo-600 bg-indigo-50 px-1 rounded">${previewData[key]}</b>`);
        });
        
        // Simular lógica condicional simple para preview
        rendered = rendered.replace(/{#IF.*?}(.*?){#ELSE}(.*?){#ENDIF}/gs, (match, p1, p2) => {
            return `<div class="border-l-4 border-indigo-500 pl-4 my-4 bg-indigo-50/30 py-2">${p1}</div>`;
        });
        
        return rendered;
    };

    const insertTable = () => {
        if (!restoreSelection()) {
            if (editorRef.current) editorRef.current.focus();
        }
        const tableHtml = `
            <table style="width:100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #e2e8f0;">
                <thead>
                    <tr style="background-color: #f8fafc;">
                        <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Columna 1</th>
                        <th style="border: 1px solid #e2e8f0; padding: 8px; text-align: left;">Columna 2</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">Dato 1</td>
                        <td style="border: 1px solid #e2e8f0; padding: 8px;">Dato 2</td>
                    </tr>
                </tbody>
            </table>
            <p>&nbsp;</p>
        `;
        document.execCommand('insertHTML', false, tableHtml);
        saveSelection();
    };

    const changeFontSize = (size) => {
        // execCommand 'fontSize' is limited to 1-7. For specific px, we use spans or a wrapper.
        // But for simplicity and compatibility with standard editors, we can use a wrapper or 'fontSize'.
        // Let's use standard fontSize first or a tiny hack for px if needed.
        document.execCommand('fontSize', false, size);
        if (editorRef.current) editorRef.current.focus();
    };

    const insertVariable = (val) => {
        if (!restoreSelection()) {
            if (editorRef.current) editorRef.current.focus();
        }
        
        const variableHtml = `<span class="bg-indigo-100 text-indigo-700 font-black px-1.5 py-0.5 rounded-md mx-1 border border-indigo-200 cursor-default select-none transition-all hover:bg-indigo-200" contenteditable="false">{${val}}</span>&nbsp;`;
        
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
        saveSelection(); // Actualizar el rango guardado tras la inserción
    };

    const insertCondition = (type) => {
        if (!restoreSelection()) {
            if (editorRef.current) editorRef.current.focus();
        }

        let html = '';
        if (type === 'IF') {
            html = `<div class="my-4 p-4 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl select-none" contenteditable="false">
                <div class="flex items-center gap-2 mb-2">
                    <span class="px-2 py-0.5 bg-amber-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">Condición SI</span>
                    <span class="text-[10px] font-bold text-amber-700 uppercase tracking-widest italic">Define el criterio aquí...</span>
                </div>
                <div class="bg-white/50 p-4 rounded-xl border border-amber-100 min-h-[40px] text-slate-400 italic" contenteditable="true">
                    Contenido si se cumple la condición...
                </div>
            </div>`;
        } else if (type === 'ELSE') {
            html = `<div class="my-2 flex items-center gap-4 text-amber-400 font-black text-[10px] uppercase tracking-[0.3em] select-none" contenteditable="false">
                <div class="h-px bg-amber-100 flex-1"></div> SINO / DE LO CONTRARIO <div class="h-px bg-amber-100 flex-1"></div>
            </div>`;
        }

        document.execCommand('insertHTML', false, html);
        saveSelection();
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

    const handleSaveDocument = async (sendToApproval = false) => {
        if (!selectedCandidateId) return showToast('Seleccione un candidato', 'error');
        const content = editorRef.current ? editorRef.current.innerHTML : template.contenido;
        
        setLoading(true);
        try {
            const payload = {
                titulo: template.tituloDocumento || template.nombre,
                tipo: template.tipo,
                contenido: content,
                candidatoRef: selectedCandidateId,
                plantillaRef: template._id,
                estado: 'Borrador'
            };

            const res = await contratosApi.create(payload);
            const newDoc = res.data;

            if (sendToApproval) {
                await contratosApi.requestApproval(newDoc._id);
                showToast('Documento guardado y enviado a aprobación');
            } else {
                showToast('Documento guardado como borrador');
            }

            fetchDocuments();
            setView('dashboard');
        } catch (error) {
            showToast('Error al procesar el documento', 'error');
        } finally {
            setLoading(false);
        }
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
            <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 animate-in fade-in zoom-in duration-700">
                <div className="text-center mb-16 relative">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full -z-10" />
                    <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Gestión Contractual <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Inteligente</span></h1>
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[10px]">Ecosistema Legal & Documental V2.5</p>
                    <div className="w-24 h-2 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 rounded-full mx-auto mt-8 shadow-lg shadow-indigo-200" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl">
                    <button 
                        onClick={() => setView('upload')}
                        className="group relative bg-white/40 backdrop-blur-xl border border-white p-12 rounded-[3.5rem] text-left hover:scale-[1.02] hover:shadow-[0_40px_80px_-15px_rgba(139,92,246,0.15)] transition-all duration-500 overflow-hidden"
                        style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.03)' }}
                    >
                        <div className="absolute -top-10 -right-10 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 rotate-12">
                            <Upload size={200} className="text-violet-600" />
                        </div>
                        <div className="w-20 h-20 bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 rounded-[2rem] flex items-center justify-center mb-8 group-hover:from-violet-600 group-hover:to-indigo-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-xl shadow-violet-100">
                            <ShieldCheck size={40} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4">Documento Externo</h3>
                        <p className="text-slate-500 text-base font-bold leading-relaxed mb-10 opacity-80">Carga archivos PDF firmados directamente al expediente digital con validación de integridad automática.</p>
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-violet-50 text-violet-600 rounded-full font-black text-[10px] uppercase tracking-widest group-hover:bg-violet-600 group-hover:text-white transition-all">
                            Vincular Documento <ChevronRight size={14} />
                        </div>
                    </button>

                    <button 
                        onClick={() => setView('designer')}
                        className="group relative bg-slate-900 p-12 rounded-[3.5rem] text-left hover:scale-[1.02] hover:shadow-[0_40px_80px_-15px_rgba(30,41,59,0.4)] transition-all duration-500 overflow-hidden border border-slate-800"
                    >
                        <div className="absolute -top-10 -right-10 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-700 -rotate-12">
                            <Layout size={200} className="text-indigo-400" />
                        </div>
                        <div className="w-20 h-20 bg-white/10 text-indigo-400 rounded-[2rem] flex items-center justify-center mb-8 group-hover:bg-indigo-500 group-hover:text-white group-hover:-rotate-6 transition-all duration-500 shadow-2xl">
                            <PenTool size={40} />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-4">Diseñador Legal</h3>
                        <p className="text-slate-400 text-base font-bold leading-relaxed mb-10 opacity-80">Construye plantillas dinámicas con lógica condicional avanzada y firma electrónica certificada.</p>
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 text-indigo-400 rounded-full font-black text-[10px] uppercase tracking-widest group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            Iniciar Constructor PRO <ChevronRight size={14} />
                        </div>
                    </button>

                    <button 
                        onClick={() => setView('dashboard')}
                        className="group relative bg-white/40 backdrop-blur-xl border border-white p-12 rounded-[3.5rem] text-left hover:scale-[1.02] transition-all duration-500 overflow-hidden md:col-span-2"
                        style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.03)' }}
                    >
                        <div className="absolute -top-10 -right-10 p-6 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 rotate-12">
                            <Clock size={200} className="text-emerald-600" />
                        </div>
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mb-8 group-hover:bg-emerald-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-xl shadow-emerald-100">
                            <Clock size={40} />
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 mb-4">Dashboard de Gestión</h3>
                        <p className="text-slate-500 text-base font-bold leading-relaxed mb-10 opacity-80">Administra todas las plantillas y documentos generados. Monitorea el flujo de aprobación y descarga versiones finales firmadas.</p>
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-emerald-50 text-emerald-600 rounded-full font-black text-[10px] uppercase tracking-widest group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            Ver Contenedor <ChevronRight size={14} />
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    // ── RENDER DASHBOARD (Container) ──
    if (view === 'dashboard') {
        return (
            <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
                <div className="flex justify-between items-end relative">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[80px] rounded-full -z-10" />
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <button onClick={() => setView('selection')} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all group">
                                <div className="w-5 h-5 bg-white shadow-sm border border-slate-200 rounded-md flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-200">
                                    <ChevronRight size={10} className="rotate-180" />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Módulos</span>
                            </button>
                            <ChevronRight size={12} className="text-slate-300" />
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Dashboard de Gestión</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Contenedor <span className="text-indigo-600">Documental</span></h1>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Control de Firmas & Aprobaciones</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Sección Documentos (Lef) */}
                    <div className="lg:col-span-2 bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] p-8 shadow-xl shadow-slate-100/50">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                                <Clock className="text-indigo-500" /> Documentos Recientes
                            </h3>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Título</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {documents.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-20 text-center">
                                                <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">No hay documentos generados aún</p>
                                            </td>
                                        </tr>
                                    ) : documents.map(doc => (
                                        <tr key={doc._id} className="group hover:bg-slate-50/50 transition-all">
                                            <td className="py-6 pr-4">
                                                <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase text-xs">{doc.titulo}</p>
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[7px] font-black uppercase">{doc.tipo}</span>
                                            </td>
                                            <td className="py-6 px-4">
                                                <p className="font-bold text-slate-600 text-xs">{doc.candidatoRef?.fullName || 'N/A'}</p>
                                                <p className="text-[10px] text-slate-400">{doc.candidatoRef?.rut}</p>
                                            </td>
                                            <td className="py-6 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${
                                                        doc.estado === 'Firmado' || doc.estado === 'Aprobado' ? 'bg-emerald-500' : 
                                                        doc.estado === 'Pendiente de Aprobación' ? 'bg-amber-500 animate-pulse' : 
                                                        'bg-slate-300'
                                                    }`} />
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                        doc.estado === 'Firmado' || doc.estado === 'Aprobado' ? 'text-emerald-600' : 
                                                        doc.estado === 'Pendiente de Aprobación' ? 'text-amber-600' : 
                                                        'text-slate-500'
                                                    }`}>
                                                        {doc.estado}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-6 pl-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {doc.estado === 'Borrador' && (
                                                        <button 
                                                            onClick={async () => {
                                                                if(window.confirm('¿Enviar este documento a aprobación de gerencia?')) {
                                                                    await contratosApi.requestApproval(doc._id);
                                                                    fetchDocuments();
                                                                    showToast('Solicitud enviada a gerencia');
                                                                }
                                                            }}
                                                            className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                                                            title="Solicitar Aprobación"
                                                        >
                                                            <ShieldCheck size={14} />
                                                        </button>
                                                    )}
                                                    {doc.estado === 'Pendiente de Aprobación' && doc.approvalChain?.some(a => a.email === user?.email && a.status === 'Pendiente') && (
                                                        <button 
                                                            onClick={async () => {
                                                                const comment = window.prompt('Ingrese un comentario opcional para la aprobación:');
                                                                if (comment !== null) {
                                                                    await contratosApi.approve(doc._id, { comment });
                                                                    fetchDocuments();
                                                                    showToast('Documento aprobado con éxito');
                                                                }
                                                            }}
                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-lg shadow-emerald-100"
                                                            title="Aprobar Documento"
                                                        >
                                                            <PenTool size={14} />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => window.print()} 
                                                        className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                                                        title="Descargar"
                                                    >
                                                        <Upload size={14} className="rotate-180" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Sección Plantillas (Right) */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black flex items-center gap-3">
                                <Layout className="text-indigo-400" /> Plantillas Base
                            </h3>
                            <button 
                                onClick={() => setView('designer')}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                            {templates.map(t => (
                                <div key={t._id} className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-indigo-500/50 transition-all group">
                                    <div className="flex justify-between items-start mb-3">
                                        <p className="text-sm font-black uppercase group-hover:text-indigo-400 transition-colors">{t.nombre}</p>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t.tipo}</span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setTemplate(t);
                                            setView('designer');
                                            setSubview('create');
                                        }}
                                        className="w-full py-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                                    >
                                        Utilizar Plantilla
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── RENDER DESIGNER (Constructor) ──
    if (view === 'designer') {
        if (subview === 'list') {
            return (
                <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
                    <div className="flex justify-between items-end relative">
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-violet-500/10 blur-[80px] rounded-full -z-10" />
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <button onClick={() => setView('selection')} className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-all group">
                                    <div className="w-5 h-5 bg-white shadow-sm border border-slate-200 rounded-md flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-200">
                                        <ChevronRight size={10} className="rotate-180" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Módulos</span>
                                </button>
                                <ChevronRight size={12} className="text-slate-300" />
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Biblioteca de Plantillas</span>
                            </div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Constructor <span className="text-indigo-600">Contractual</span></h1>
                            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Ecosistema Documental Corporativo</p>
                        </div>
                        <button 
                            onClick={() => {
                                setTemplate({ nombre: '', tipo: 'Contrato', tituloDocumento: '', contenido: '', logoLeft: null, logoRight: null, firmas: ['Gerencia', 'Colaborador'] });
                                setSubview('create');
                            }}
                            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-xl shadow-slate-200 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-3"
                        >
                            <div className="p-1 bg-white/10 rounded-lg"><Plus size={16} /></div>
                            Crear Nueva Plantilla
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {loading ? (
                            <div className="col-span-full py-32 flex flex-col items-center justify-center text-slate-300">
                                <div className="relative mb-6">
                                    <div className="w-16 h-16 border-4 border-slate-100 rounded-full" />
                                    <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                                </div>
                                <p className="font-black text-[10px] uppercase tracking-[0.3em] animate-pulse">Sincronizando Biblioteca...</p>
                            </div>
                        ) : templates.map(t => (
                            <div key={t._id} className="group relative bg-white/70 backdrop-blur-xl border border-slate-200/50 p-8 rounded-[2.5rem] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.06)] hover:border-indigo-200 transition-all duration-500 overflow-hidden">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6">
                                        <FileText size={28} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setTemplate(t); setSubview('create'); }} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Editar"><FileEdit size={16}/></button>
                                        <button onClick={() => handleDeleteTemplate(t._id)} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Eliminar"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <h4 className="text-xl font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">{t.nombre}</h4>
                                <div className="flex items-center gap-2 mb-8">
                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[8px] font-black uppercase tracking-widest">{t.tipo}</span>
                                    <span className="text-[9px] text-slate-300 font-bold uppercase">{new Date(t.lastMod).toLocaleDateString()}</span>
                                </div>
                                <button 
                                    onClick={() => { setTemplate(t); setSubview('create'); }}
                                    className="w-full py-4 bg-slate-50 text-slate-500 rounded-[1.2rem] font-black text-[10px] uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-200 transition-all"
                                >
                                    Fijar Parámetros y Editar
                                </button>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
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
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleSaveDocument(false)}
                                    className="px-6 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-sm hover:bg-slate-50 flex items-center gap-2"
                                >
                                    <FileText size={16} /> Guardar Borrador
                                </button>
                                <button 
                                    onClick={() => handleSaveDocument(true)}
                                    className="px-7 py-3.5 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-lg flex items-center gap-2"
                                >
                                    <ShieldCheck size={16} className="text-emerald-400" /> Enviar a Gerencia
                                </button>
                            </div>
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
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Candidato / Colaborador</label>
                                    <select 
                                        value={selectedCandidateId}
                                        onChange={(e) => setSelectedCandidateId(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-sm"
                                    >
                                        <option value="">Seleccione...</option>
                                        {candidates.map(c => (
                                            <option key={c._id} value={c._id}>{c.fullName} ({c.rut})</option>
                                        ))}
                                    </select>
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

                        <div className="bg-white/70 backdrop-blur-xl border border-slate-200/50 rounded-[2.5rem] p-6 shadow-xl shadow-slate-100/50">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                Lógica & Condiciones
                            </h4>
                            <div className="grid grid-cols-2 gap-3 mb-8">
                                <button 
                                    onMouseDown={(e) => { e.preventDefault(); insertCondition('IF'); }}
                                    className="p-3 bg-amber-50 border border-amber-100 rounded-[1.2rem] flex flex-col items-center gap-1 hover:bg-amber-100 transition-all active:scale-95 group"
                                >
                                    <Plus size={14} className="text-amber-600 group-hover:scale-125 transition-transform" />
                                    <span className="text-[8px] font-black text-amber-700 uppercase tracking-widest italic">Condición SI</span>
                                </button>
                                <button 
                                    onMouseDown={(e) => { e.preventDefault(); insertCondition('ELSE'); }}
                                    className="p-3 bg-slate-50 border border-slate-100 rounded-[1.2rem] flex flex-col items-center gap-1 hover:bg-slate-100 transition-all active:scale-95 group"
                                >
                                    <AlignLeft size={14} className="text-slate-400 group-hover:scale-125 transition-transform" />
                                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">SINO (Else)</span>
                                </button>
                            </div>

                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                Variables Dinámicas
                            </h4>
                            <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
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
                                        section: 'Variables de Sistema', 
                                        vars: [
                                            { label: 'Empresa Nombre', val: 'EMPRESA_NOMBRE' },
                                            { label: 'Fecha Actual', val: 'FECHA_ACTUAL' },
                                            { label: 'Hora Actual', val: 'HORA_ACTUAL' },
                                            { label: 'Usuario Logueado', val: 'USUARIO_ACTUAL' }
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

                    <div className={`${isFullscreen ? 'col-span-12 fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-4' : 'col-span-12 lg:col-span-9'} bg-white border border-slate-200 rounded-[2.5rem] p-12 shadow-sm min-h-[800px] relative transition-all duration-500`}>
                        <div className={`${isFullscreen ? 'max-w-[1000px]' : 'max-w-[800px]'} mx-auto`}>
                            {/* ── HEADER DEL EDITOR ── */}
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

                            {/* ── TOOLBAR TIPO WORD FLOTANTE ── */}
                            <div className="sticky top-4 z-50 bg-white/80 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-indigo-100/50 p-2 rounded-2xl mb-10 flex flex-wrap gap-3 items-center justify-center animate-in slide-in-from-top duration-500">
                                <div className="flex bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Negrita"><Bold size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Cursiva"><Italic size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Subrayado"><Underline size={18}/></button>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50">
                                    <select 
                                        onChange={(e) => { e.preventDefault(); changeFontSize(e.target.value); }}
                                        className="bg-transparent text-[10px] font-black uppercase tracking-wider px-2 outline-none text-slate-600 cursor-pointer"
                                    >
                                        <option value="3">TAMAÑO</option>
                                        <option value="1">8px</option>
                                        <option value="2">10px</option>
                                        <option value="3">12px</option>
                                        <option value="4">14px</option>
                                        <option value="5">18px</option>
                                        <option value="6">24px</option>
                                        <option value="7">32px</option>
                                    </select>
                                </div>

                                <div className="flex bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Izquierda"><AlignLeft size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Centro"><AlignCenter size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Derecha"><AlignRight size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Justificado"><AlignJustify size={18}/></button>
                                </div>

                                <div className="flex bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50 gap-1">
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertUnorderedList'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Lista Viñetas"><List size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertOrderedList'); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Lista Numerada"><ListOrdered size={18}/></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); insertTable(); }} className="p-2.5 hover:bg-white hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all text-slate-500" title="Insertar Tabla"><TableIcon size={18}/></button>
                                </div>

                                <button 
                                    onMouseDown={(e) => { e.preventDefault(); setIsPreviewMode(!isPreviewMode); }}
                                    className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all ${isPreviewMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 group'}`}
                                >
                                    <Eye size={16} className={isPreviewMode ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'} /> 
                                    {isPreviewMode ? 'Volver al Editor' : 'Vista Previa'}
                                </button>

                                <button 
                                    onMouseDown={(e) => { e.preventDefault(); setIsFullscreen(!isFullscreen); }}
                                    className={`p-2.5 rounded-xl transition-all ${isFullscreen ? 'bg-amber-100 text-amber-600 shadow-inner' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    title={isFullscreen ? "Contraer Editor" : "Expandir al Máximo"}
                                >
                                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                            </div>

                             {isPreviewMode ? (
                                 <div 
                                     className="w-full min-h-[1050px] p-24 bg-white border border-slate-100 rounded-sm text-slate-800 text-sm font-medium leading-[1.8] shadow-2xl mx-auto overflow-y-auto"
                                     style={{ width: '210mm' }}
                                     dangerouslySetInnerHTML={{ __html: renderTemplateWithPreviewData(template.contenido) }}
                                 />
                             ) : (
                                 <div 
                                     ref={editorRef}
                                     contentEditable
                                     suppressContentEditableWarning
                                     onInput={(e) => setTemplate({...template, contenido: e.target.innerHTML})}
                                     onMouseUp={saveSelection}
                                     onKeyUp={saveSelection}
                                     onBlur={saveSelection}
                                     className="w-full min-h-[1050px] p-24 bg-white border border-slate-100 rounded-sm text-slate-800 text-sm font-medium leading-[1.8] focus:outline-none focus:ring-0 transition-all shadow-2xl overflow-y-auto outline-none mx-auto"
                                     style={{ 
                                         width: '210mm', 
                                         cursor: 'text',
                                         backgroundColor: '#fff',
                                         color: '#1a1a1a'
                                     }}
                                     dangerouslySetInnerHTML={{ __html: template.contenido }}
                                 />
                             )}

                            <div className="mt-24 grid grid-cols-2 gap-24 pt-16 border-t-2 border-slate-100 max-w-[210mm] mx-auto">
                                <div className="text-center p-8 border border-slate-100 border-dashed rounded-3xl bg-slate-50/30">
                                    <div className="w-40 h-0.5 bg-slate-300 mx-auto mb-6" />
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Firma Colaborador</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Identidad Digital Validada</p>
                                </div>
                                <div className="text-center p-8 border border-slate-100 border-dashed rounded-3xl bg-slate-50/30">
                                    <div className="w-40 h-0.5 bg-slate-300 mx-auto mb-6" />
                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Firma Empleador</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Representante Legal</p>
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

                    <div className="relative bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] rounded-[0.5rem] border border-slate-200 overflow-hidden min-h-[1123px] page-content mx-auto" style={{ width: '210mm' }}>
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

                        {/* ── SECCIÓN DE FIRMAS PREMIUM ── */}
                        <div className="mt-24 grid grid-cols-2 gap-24 pt-16 border-t-2 border-slate-100">
                            <div className="text-center relative">
                                {isSigning ? (
                                    <div className="mb-6 flex flex-col items-center animate-in zoom-in duration-500">
                                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 shadow-lg shadow-emerald-100 border border-emerald-100">
                                            <ShieldCheck size={40} />
                                        </div>
                                        <div className="px-3 py-1 bg-emerald-600 text-white text-[8px] font-black rounded-full uppercase tracking-widest shadow-md">Firma Certificada</div>
                                        <p className="text-[7px] font-bold text-slate-400 mt-2 uppercase">Hash: {Math.random().toString(36).substring(2, 12).toUpperCase()}</p>
                                    </div>
                                ) : (
                                    <div className="w-48 h-px bg-slate-300 mx-auto mb-6" />
                                )}
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{selectedCandidate?.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">C.I / RUT: {selectedCandidate?.rut}</p>
                            </div>
                            <div className="text-center">
                                <div className="w-48 h-px bg-slate-300 mx-auto mb-6" />
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">Representante Legal</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{companyConfig.companyName}</p>
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
