import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText, Search, Upload, Eye, Check,
    Loader2, Share2,
    Smartphone, ShieldCheck, Info,
    User, Briefcase, MapPin
} from 'lucide-react';
import { candidatosApi } from '../rrhhApi';
import GuiaRequisitosPrint from './GuiaRequisitosPrint';

const MASTER_DOCUMENTS = [
    {
        category: "Identidad y Perfil",
        icon: User,
        color: "indigo",
        items: [
            { name: 'Cédula de Identidad', desc: 'Fotocopia por ambos lados, vigente.' },
            { name: 'Currículum Vitae', desc: 'Versión actualizada con experiencia relevante.' },
            { name: 'Fotografía Tamaño Pasaporte', desc: 'Color, fondo blanco, formato digital.' }
        ]
    },
    {
        category: "Previsión Social",
        icon: ShieldCheck,
        color: "rose",
        items: [
            { name: 'Cert. AFP + 12 Cotizaciones', desc: 'Certificado de afiliación y detalle de últimos 12 meses.' },
            { name: 'Cert. Salud + Valor Plan', desc: 'Certificado Isapre o Fonasa indicando valor del plan.' },
            { name: 'Certificado Cargas Familiares', desc: 'Si corresponde (Punto 10 de la guía).' }
        ]
    },
    {
        category: "Laboral y Estudios",
        icon: Briefcase,
        color: "violet",
        items: [
            { name: 'Certificado de Antecedentes', desc: 'Original vigente (Art. 2 Código del Trabajo).' },
            { name: 'Título / Certificado Estudios', desc: 'Enseñanza Media o Superior (fotocopia).' },
            { name: 'Finiquito o Carta Renuncia', desc: 'Del último empleador, firmado.' },
            { name: 'Cert. de Competencias (Cursos)', desc: 'Diplomas o certificados técnicos adicionales.' }
        ]
    },
    {
        category: "Domicilio y Conducción",
        icon: MapPin,
        color: "emerald",
        items: [
            { name: 'Certificado de Residencia', desc: 'Junta de vecinos, notaría o boleta a su nombre.' },
            { name: 'Licencia de Conducir', desc: 'Si el cargo requiere conducción (Fotocopia ambos lados).' },
            { name: 'Cert. Hoja de Vida Conductor', desc: 'Emitido por Registro Civil (Vigente).' }
        ]
    }
];

const GestionDocumental = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(null);
    const [viewMode, setViewMode] = useState('expedientes'); // 'expedientes' or 'requisitos'
    const [copied, setCopied] = useState(false);

    const fetchCandidatos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await candidatosApi.getAll();
            setCandidatos(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const selected = candidatos.find(c => c._id === selectedId);

    useEffect(() => {
        fetchCandidatos();
    }, [fetchCandidatos]);

    const handleUpload = async (e, docType) => {
        if (!selected) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploading(docType);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('docType', docType);
            await candidatosApi.uploadDocument(selected._id, formData);
            fetchCandidatos();
        } catch (e) {
            alert('Error al subir documento');
        } finally {
            setUploading(null);
        }
    };

    const handleUpdateStatus = async (docId, newStatus) => {
        try {
            await candidatosApi.updateDocumentStatus(selected._id, docId, newStatus);
            fetchCandidatos();
        } catch (e) {
            alert('Error al actualizar estado');
        }
    };

    const copyToClipboard = () => {
        let text = "*LISTA DE DOCUMENTOS REQUERIDOS - RRHH*\n\n";
        MASTER_DOCUMENTS.forEach(cat => {
            text += `*${cat.category.toUpperCase()}*\n`;
            cat.items.forEach(item => {
                text += `• ${item.name}: ${item.desc}\n`;
            });
            text += "\n";
        });
        text += "_Por favor entregar estos documentos en formato digital (PDF o Imagen clara) para su procesamiento._";

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filtered = candidatos.filter(c =>
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rut.includes(searchTerm)
    );

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20 animate-in fade-in duration-500 print:p-0">
            {/* Cabecera con Tabs Globales */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="bg-amber-600 text-white p-3.5 rounded-[1.25rem] shadow-xl shadow-amber-200/50">
                        <FileText size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">
                            Gestión <span className="text-amber-600">Documental</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black mt-1 uppercase tracking-[0.2em]">Centro de Control y Cumplimiento Normativo</p>
                    </div>
                </div>

                <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 self-start md:self-center">
                    <button
                        onClick={() => setViewMode('expedientes')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'expedientes' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Expedientes Digitales
                    </button>
                    <button
                        onClick={() => setViewMode('requisitos')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'requisitos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Requisitos Oficiales
                    </button>
                </div>
            </div>

            {viewMode === 'expedientes' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in slide-in-from-left-4 duration-500">
                    {/* Search Sidebar */}
                    <div className="lg:col-span-1 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col h-[700px] overflow-hidden">
                        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar candidato..."
                                    className="w-full pl-11 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[11px] font-black placeholder:text-slate-300 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="animate-spin text-amber-500" size={32} />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando...</span>
                                </div>
                            ) : filtered.length > 0 ? (
                                filtered.map(c => (
                                    <button
                                        key={c._id}
                                        onClick={() => setSelectedId(c._id)}
                                        className={`w-full p-6 text-left transition-all hover:bg-slate-50 border-l-4 ${selectedId === c._id ? 'bg-amber-50/50 border-amber-600 shadow-inner' : 'border-transparent'}`}
                                    >
                                        <p className={`font-black uppercase text-xs truncate transition-colors ${selectedId === c._id ? 'text-amber-700' : 'text-slate-800'}`}>{c.fullName}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-slate-400 font-bold tracking-tight">{c.rut}</span>
                                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase">{c.status}</span>
                                        </div>
                                        <div className="mt-4 bg-slate-100 rounded-full h-1 overflow-hidden">
                                            <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${Math.min((c.documents?.length || 0) * 8, 100)}%` }}></div>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="p-12 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-loose">No se encontraron registros</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main View Expediente */}
                    <div className="lg:col-span-3">
                        {selected ? (
                            <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                                {/* Profile Header */}
                                <div className="bg-slate-900 p-10 rounded-[3.5rem] shadow-2xl text-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                                    <div className="flex items-center gap-8 relative z-10">
                                        <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center text-4xl font-black border border-white/20 shadow-inner">
                                            {selected.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-black uppercase tracking-tight italic">{selected.fullName}</h3>
                                            <div className="flex flex-wrap items-center gap-4 mt-3">
                                                <div className="bg-amber-500 text-slate-900 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight shadow-lg shadow-amber-500/20">{selected.rut}</div>
                                                <span className="w-1.5 h-1.5 bg-white/20 rounded-full"></span>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <Briefcase size={14} className="text-amber-500" />
                                                    <span className="text-[11px] font-bold uppercase tracking-widest">{selected.position}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 relative z-10 px-6 py-4 bg-white/5 rounded-3xl border border-white/10">
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Items Cargados</p>
                                        <p className="text-5xl font-black text-white">{selected.documents?.length || 0} <span className="text-sm text-slate-500">/ 13</span></p>
                                    </div>
                                </div>

                                {/* Documents Grid */}
                                <div className="bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
                                    <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-50">
                                        <div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-xl italic">Expediente Digital 360</h4>
                                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Verificación de requisitos contractuales</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setViewMode('requisitos')}
                                                className="flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-slate-200"
                                            >
                                                <Info size={16} /> Ver Guía de Requisitos
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {[
                                            'Cédula de Identidad',
                                            'Currículum Vitae',
                                            'Certificado de Antecedentes',
                                            'Certificado de Residencia',
                                            'Título / Certificado Estudios',
                                            'Cert. de Competencias (Cursos)',
                                            'Fotografía Tamaño Pasaporte',
                                            'Finiquito o Carta Renuncia',
                                            'Cert. AFP + 12 Cotizaciones',
                                            'Cert. Salud + Valor Plan',
                                            'Certificado Cargas Familiares',
                                            'Licencia de Conducir',
                                            'Cert. Hoja de Vida Conductor'
                                        ].map(type => {
                                            const doc = selected.documents?.find(d => d.docType === type);
                                            return (
                                                <div key={type} className={`group p-6 rounded-3xl border-2 transition-all hover:scale-[1.02] ${doc ? 'border-emerald-50 bg-emerald-50/20' : 'border-slate-50 bg-slate-50/50'}`}>
                                                    <div className="flex flex-col h-full justify-between gap-6">
                                                        <div>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <h5 className="font-black text-slate-800 text-[11px] uppercase tracking-tight leading-tight max-w-[70%]">{type}</h5>
                                                                {doc ? <Check className="text-emerald-500" size={18} /> : (
                                                                    (type === 'Licencia de Conducir' || type === 'Cert. Hoja de Vida Conductor') && selected.requiereLicencia === 'NO' ?
                                                                        <div className="w-1.5 h-1.5 bg-slate-100 rounded-full" /> :
                                                                        <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                                )}
                                                            </div>

                                                            {/* Inyección de Metadata Declarada */}
                                                            <div className="mb-4">
                                                                {type === 'Cert. AFP + 12 Cotizaciones' && selected.afp && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-lg border border-indigo-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Declarado:</span> {selected.afp}
                                                                    </div>
                                                                )}
                                                                {type === 'Cert. Salud + Valor Plan' && selected.previsionSalud && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-rose-600 bg-rose-50/50 px-2 py-1 rounded-lg border border-rose-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Declarado:</span> {selected.previsionSalud} {selected.valorPlan && `(${selected.valorPlan} ${selected.monedaPlan})`}
                                                                    </div>
                                                                )}
                                                                {type === 'Licencia de Conducir' && selected.requiereLicencia === 'SI' && (
                                                                    <div className="flex items-center gap-2 text-[9px] font-black text-orange-600 bg-orange-50/50 px-2 py-1 rounded-lg border border-orange-100">
                                                                        <span className="opacity-50 uppercase tracking-tighter">Vence:</span> {selected.fechaVencimientoLicencia || 'No Ingresado'}
                                                                    </div>
                                                                )}
                                                                {type === 'Fotografía Tamaño Pasaporte' && (selected.shirtSize || selected.pantsSize) && (
                                                                    <div className="flex items-center gap-2 text-[8px] font-black text-slate-500 bg-slate-100/50 px-2 py-1 rounded-lg border border-slate-200 uppercase tracking-tighter">
                                                                        Tallas: {selected.shirtSize}/{selected.pantsSize}/{selected.jacketSize}/{selected.shoeSize}
                                                                    </div>
                                                                )}
                                                                {type === 'Certificado Cargas Familiares' && (
                                                                    <div className={`flex items-center gap-2 text-[9px] font-black px-2 py-1 rounded-lg border uppercase tracking-tighter ${selected.tieneCargas === 'SI' ? 'text-amber-600 bg-amber-50/50 border-amber-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                                                                        {selected.tieneCargas === 'SI' ? `Tiene ${selected.listaCargas?.length || 0} Cargas` : 'Sin Cargas Declaradas'}
                                                                    </div>
                                                                )}
                                                                {type === 'Licencia de Conducir' && selected.requiereLicencia === 'NO' && (
                                                                    <div className="text-[8px] font-black text-slate-400 uppercase italic opacity-60">No requerida para el cargo</div>
                                                                )}
                                                            </div>

                                                            {doc ? (
                                                                <div className="flex flex-col gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm uppercase ${doc.status === 'Verificado' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                                            {doc.status}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[9px] font-bold text-slate-400 italic">Actualizado {new Date(doc.uploadDate).toLocaleDateString()}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-300 uppercase italic tracking-tighter">Pendiente de recepción</span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100/50">
                                                            {doc?.url && (
                                                                <a
                                                                    href={doc.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white text-slate-600 rounded-xl border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-50 transition-all shadow-sm"
                                                                >
                                                                    <Eye size={14} /> Ver
                                                                </a>
                                                            )}
                                                            <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer shadow-sm ${doc ? 'bg-white text-slate-400' : 'bg-amber-600 text-white shadow-amber-100 hover:bg-amber-700'}`}>
                                                                {uploading === type ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                                                {doc ? 'Cambiar' : 'Subir'}
                                                                <input type="file" className="hidden" onChange={e => handleUpload(e, type)} accept=".pdf,image/*" />
                                                            </label>
                                                        </div>

                                                        {doc && doc.status === 'Pendiente' && (
                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                <button
                                                                    onClick={() => handleUpdateStatus(doc._id, 'Verificado')}
                                                                    className="py-2 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                                >
                                                                    Validar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateStatus(doc._id, 'Rechazado')}
                                                                    className="py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                                                >
                                                                    Rechazar
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-[700px] bg-white rounded-[3.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
                                <div className="absolute inset-0 bg-slate-50/30 -z-10" />
                                <div className="bg-slate-50 p-10 rounded-[2.5rem] mb-6 shadow-inner">
                                    <FileText size={80} className="text-slate-200" />
                                </div>
                                <h4 className="font-black uppercase tracking-[0.2em] text-lg text-slate-400">Expediente No Seleccionado</h4>
                                <p className="text-[11px] font-bold text-slate-300 mt-2 max-w-xs text-center leading-loose">Seleccione un colaborador o postulante en el panel lateral para gestionar sus documentos.</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* VISTA DE REQUISITOS OFICIALES (GLOBAL) */
                <div className="max-w-6xl mx-auto animate-in slide-in-from-right-8 duration-700 space-y-10 print:hidden">

                    {/* Hero Section Requisitos */}
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-1000">
                            <Smartphone size={300} />
                        </div>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
                            <div className="max-w-xl pr-10">
                                <h2 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic leading-tight print:hidden">
                                    Guía de <br /> <span className="text-amber-600">Requisitos Oficiales</span>
                                </h2>
                                <p className="text-slate-500 font-bold mt-4 leading-relaxed text-sm print:hidden">
                                    Este documento contiene el desglose legal y corporativo de todos los documentos necesarios para formalizar una contratación. Úselo para guiar a los postulantes y validar ingresos.
                                </p>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl border border-slate-800 hover:bg-slate-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                                    >
                                        <FileText size={16} /> Descargar Guía PDF
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        className={`group flex items-center justify-center gap-4 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all transform active:scale-95 shadow-xl ${copied ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-slate-200'}`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={16} /> ¡Copiado!
                                            </>
                                        ) : (
                                            <>
                                                <Share2 size={16} /> Compartir por WhatsApp
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="shrink-0 hidden lg:block">
                                <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100">
                                    <Smartphone size={100} className="text-amber-600 opacity-20" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Categorías en Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {MASTER_DOCUMENTS.map((cat, idx) => (
                            <div key={idx} className="bg-white rounded-[3.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group">
                                <div className={`p-8 flex items-center gap-6 border-b border-slate-50 transition-colors bg-white group-hover:bg-slate-50/50`}>
                                    <div className={`p-4 rounded-[1.5rem] transition-all duration-500 group-hover:rotate-6 bg-${cat.color}-50 text-${cat.color}-600 shadow-sm`}>
                                        <cat.icon size={28} />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight italic">{cat.category}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">{cat.items.length} Requisitos</p>
                                    </div>
                                </div>
                                <div className="p-8 space-y-6 flex-1">
                                    {cat.items.map((item, i) => (
                                        <div key={i} className="flex gap-4">
                                            <div className="mt-1.5 w-1.5 h-1.5 bg-slate-200 rounded-full shrink-0 group-hover:bg-amber-500 transition-colors" />
                                            <div>
                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.name}</p>
                                                <p className="text-[11px] font-bold text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-900/5 p-10 rounded-[3.5rem] border border-dashed border-slate-200 flex items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="p-4 bg-white rounded-2xl text-amber-600 shadow-sm border border-slate-100">
                                <Info size={24} />
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-loose max-w-2xl">
                                <span className="font-black text-slate-700 uppercase">Nota Importante:</span> Todos los documentos deben ser legibles y estar vigentes al momento de la carga. En caso de extranjeros, la cédula debe estar vigente o contar con certificado de residencia en trámite acreditado.
                            </p>
                        </div>
                        <div className="hidden lg:block h-12 w-1 border-l-2 border-slate-200" />
                        <div className="shrink-0">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center italic opacity-40">AgentPro RRHH v2.5</p>
                        </div>
                    </div>

                    <div className="text-center opacity-30 mt-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] italic">Propiedad de AgentPro © 2026</p>
                    </div>

                </div>
            )}

            {/* Componente de Impresión (Invisible en UI normal) */}
            <GuiaRequisitosPrint />
        </div>
    );
};

export default GestionDocumental;
