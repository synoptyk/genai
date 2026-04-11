import React, { useState, useEffect } from 'react';
import {
    GraduationCap, Plus, Search, X,
    Loader2, Info, ShieldCheck,
    Video, Play, FileText, Share2, Globe,
    Image as ImageIcon, Upload,
    ChevronRight
} from 'lucide-react';
import { charlasApi } from '../prevencionApi';
import { candidatosApi } from '../../rrhh/rrhhApi';
import { formatRut, validateRut } from '../../../utils/rutUtils';
import FirmaAvanzada from '../../../components/FirmaAvanzada';

const PrevDifusion = () => {
    const [loading, setLoading] = useState(false);
    const [charlas, setCharlas] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [step, setStep] = useState(1);


    const [newCharla, setNewCharla] = useState({
        titulo: '',
        tipo: 'Capacitación Específica',
        descripcion: '',
        observaciones: '',
        videoUrl: '',
        galeriaFotos: [],
        archivosAdjuntos: [],
        estadoPublicacion: 'Publicado',
        relator: { nombre: '', rut: '', cargo: '', empresa: 'GENAI360' },
        firma: null,
        metadataFirma: null
    });

    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        fetchCharlas();
    }, []);

    const fetchCharlas = async () => {
        setLoading(true);
        try {
            const res = await charlasApi.getAll();
            setCharlas(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (message, type = 'info') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const handleRutSearch = async (rut) => {
        const cleanRut = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        if (cleanRut.length < 8) return;

        setIsSearching(true);
        try {
            const res = await candidatosApi.getAll();
            const candidates = res.data || [];
            const found = candidates.find(c => c.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase() === cleanRut);

            if (found) {
                setNewCharla(prev => ({
                    ...prev,
                    relator: {
                        ...prev.relator,
                        nombre: found.fullName.toUpperCase(),
                        rut: found.rut,
                        cargo: found.position.toUpperCase(),
                        empresa: found.empresa || 'GENAI360'
                    }
                }));
                showAlert('PERSONAL ENCONTRADO', 'success');
            } else {
                showAlert('RUT NO REGISTRADO EN RRHH', 'info');
            }
        } catch (e) {
            console.error(e);
            showAlert('ERROR EN BÚSQUEDA', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'foto') {
                setNewCharla(prev => ({ ...prev, galeriaFotos: [...prev.galeriaFotos, reader.result] }));
                showAlert('FOTO CARGADA', 'success');
            } else {
                setNewCharla(prev => ({ ...prev, archivosAdjuntos: [...prev.archivosAdjuntos, { name: file.name, data: reader.result }] }));
                showAlert('PDF CARGADO', 'success');
            }
        };
        reader.readAsDataURL(file);
    };

    const handleFirmaAvanzada = (payload) => {
        if (payload) {
            setNewCharla(prev => ({
                ...prev,
                firma: payload.imagenBase64,
                metadataFirma: {
                    timestamp: payload.timestamp,
                    gps: payload.coordenadas ? `${payload.coordenadas.lat}, ${payload.coordenadas.lng}` : 'No disponible',
                    qrId: payload.firmaId,
                    rut: payload.rut,
                    nombre: payload.nombre,
                    email: payload.email,
                    qrVerificacion: payload.qrVerificacion
                }
            }));
        } else {
            setNewCharla(prev => ({ ...prev, firma: null, metadataFirma: null }));
        }
    };

    const handleSubmit = async () => {
        if (!newCharla.firma) return showAlert('FIRMA OBLIGATORIA PARA PUBLICAR', 'error');
        setSaving(true);
        try {
            const submission = {
                ...newCharla,
                firmaAvanzada: {
                    signature: newCharla.firma,
                    qrId: newCharla.metadataFirma.qrId,
                    gps: newCharla.metadataFirma.gps,
                    timestamp: newCharla.metadataFirma.timestamp
                }
            };
            await charlasApi.create(submission);
            showAlert('CONTENIDO PUBLICADO EXITOSAMENTE', 'success');
            setShowCreate(false);
            resetForm();
            fetchCharlas();
        } catch {
            showAlert('ERROR AL PUBLICAR', 'error');
        } finally {
            setSaving(false);
        }
    };



    const resetForm = () => {
        setNewCharla({
            titulo: '', tipo: 'Capacitación Específica', descripcion: '', observaciones: '', videoUrl: '',
            galeriaFotos: [], archivosAdjuntos: [], estadoPublicacion: 'Publicado',
            relator: { nombre: '', rut: '', cargo: '', empresa: 'GENAI360' },
            firma: null, metadataFirma: null
        });
        setStep(1);
    };

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20 text-left">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-6">
                    <div className="bg-indigo-600 text-white p-5 rounded-[2rem] shadow-2xl transform rotate-3">
                        <GraduationCap size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none text-left">
                            Centro de <span className="text-indigo-600">Inteligencia GENAI360</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black mt-3 uppercase tracking-[0.4em] text-left">
                            Plataforma Multimedia de Difusión y Capacitación
                        </p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button className="flex items-center gap-3 bg-white border border-slate-100 text-slate-400 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:text-indigo-600 transition-all shadow-sm">
                        <Share2 size={18} /> Compartir Canal
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowCreate(true); }}
                        className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl"
                    >
                        <Plus size={18} /> Nueva Publicación
                    </button>
                </div>
            </div>

            {/* FILTROS Y BUSQUEDA */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
                <div className="lg:col-span-2 relative text-left">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input type="text" placeholder="BUSCAR CAPACITACIONES, VIDEOS O DOCUMENTOS..." className="w-full pl-16 pr-8 py-5 bg-white border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-indigo-500/5 text-xs font-bold uppercase" />
                </div>
                <div className="bg-white p-2 rounded-3xl border border-slate-100 flex gap-2">
                    {['Todos', 'Videos', 'Docs'].map(f => (
                        <button key={f} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${f === 'Todos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50'}`}>{f}</button>
                    ))}
                </div>
                <div className="bg-white p-2 rounded-3xl border border-slate-100 flex items-center justify-center gap-4">
                    <Globe size={18} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Canal Público Activo</span>
                </div>
            </div>

            {/* GRID DE CONTENIDO */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                {loading ? (
                    <div className="col-span-full py-40 text-center flex flex-col items-center gap-6">
                        <div className="w-20 h-20 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em]">Sincronizando Mediateca HSE...</p>
                    </div>
                ) : charlas.length > 0 ? (
                    charlas.map(charla => (
                        <div key={charla._id} className="bg-white rounded-[4rem] border border-slate-100 hover:border-indigo-200 transition-all group shadow-sm hover:shadow-2xl overflow-hidden flex flex-col text-left">
                            <div className="relative aspect-video bg-slate-900 overflow-hidden text-left">
                                {charla.videoUrl ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 group-hover:scale-110 transition-transform">
                                            <Play size={32} fill="currentColor" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-80 flex items-center justify-center">
                                        <ImageIcon size={64} className="text-white/20" />
                                    </div>
                                )}
                                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                                    <span className="bg-slate-900/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border border-white/10">{charla.tipo}</span>
                                </div>
                            </div>
                            <div className="p-10 flex-1 flex flex-col text-left">
                                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-4 leading-tight group-hover:text-indigo-600 transition-colors uppercase">{charla.titulo}</h3>
                                <p className="text-[11px] text-slate-400 font-bold uppercase mb-8 line-clamp-2 leading-relaxed">{charla.descripcion}</p>
                                <div className="mt-auto space-y-4 text-left">
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <ShieldCheck size={20} className="text-indigo-600" />
                                        <div className="text-left">
                                            <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Autorizado por Relator</p>
                                            <p className="text-[10px] font-black text-slate-900 uppercase leading-none">{charla.relator?.nombre}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-lg">
                                            Ver Contenido
                                        </button>
                                        <button className="p-4 bg-white text-slate-400 rounded-2xl hover:text-indigo-600 border border-slate-100">
                                            <Share2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-48 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-100">
                        <Video size={56} className="text-slate-100 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-slate-300 uppercase italic tracking-widest">Canal Multimedia GENAI360 Vacío</h3>
                    </div>
                )}
            </div>

            {/* MODAL */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-white rounded-[4rem] w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-500">
                        <div className="p-10 bg-indigo-600 text-white flex items-center justify-between relative overflow-hidden text-left">
                            <div className="flex items-center gap-6 relative z-10 text-left">
                                <div className="bg-white text-indigo-600 p-4 rounded-2xl shadow-xl">
                                    <Upload size={24} />
                                </div>
                                <div className="text-left">
                                    <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none">Publicador <span className="opacity-60 text-white text-xl">Multimedia GENAI360</span></h2>
                                    <div className="flex gap-2 mt-3 text-left">
                                        {[1, 2, 3, 4].map(s => (
                                            <div key={s} className={`h-1 rounded-full w-10 transition-all duration-500 ${step >= s ? 'bg-white' : 'bg-indigo-400'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="p-4 hover:bg-white/10 rounded-full transition-all text-white"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar text-left font-bold text-slate-900">
                            {step === 1 && (
                                <div className="space-y-8 animate-in slide-in-from-right-10 max-w-4xl mx-auto text-left">
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8 text-left">
                                        <div className="space-y-3 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">RUT del Relator</label>
                                            <div className="relative">
                                                <Search className={`absolute right-4 top-1/2 -translate-y-1/2 ${isSearching ? 'animate-spin text-indigo-500' : 'text-slate-300'}`} size={16} />
                                                <input type="text" placeholder="12.345.678-9" className={`w-full px-6 py-4 rounded-2xl bg-slate-50 border ${newCharla.relator.rut && !validateRut(newCharla.relator.rut) ? 'border-rose-400 focus:border-rose-500 bg-rose-50 text-rose-600' : 'border-slate-200 focus:border-indigo-500 text-slate-800'} outline-none font-bold uppercase text-xs`} value={newCharla.relator.rut} onChange={e => {
                                                    const val = formatRut(e.target.value);
                                                    setNewCharla({ ...newCharla, relator: { ...newCharla.relator, rut: val } });
                                                    if (val.length >= 8) handleRutSearch(val);
                                                }} />
                                            </div>
                                        </div>
                                        <div className="space-y-3 md:col-span-2 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo (Auto)</label>
                                            <input type="text" readOnly className="w-full px-6 py-4 rounded-2xl bg-slate-100 border border-slate-200 outline-none font-black text-slate-900 uppercase text-xs cursor-not-allowed" value={newCharla.relator.nombre} />
                                        </div>
                                        <div className="space-y-3 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cargo (Auto)</label>
                                            <input type="text" readOnly className="w-full px-6 py-4 rounded-2xl bg-slate-100 border border-slate-200 outline-none font-black text-slate-900 uppercase text-xs cursor-not-allowed" value={newCharla.relator.cargo} />
                                        </div>
                                        <div className="space-y-3 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa (Auto)</label>
                                            <input type="text" readOnly className="w-full px-6 py-4 rounded-2xl bg-slate-100 border border-slate-200 outline-none font-black text-slate-900 uppercase text-xs cursor-not-allowed" value={newCharla.relator.empresa} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                        <div className="space-y-3 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título de la Publicación</label>
                                            <input type="text" placeholder="Ej: Seguridad en Instalación..." className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 outline-none font-bold uppercase text-xs" value={newCharla.titulo} onChange={e => setNewCharla({ ...newCharla, titulo: e.target.value })} />
                                        </div>
                                        <div className="space-y-3 text-left">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL de Video</label>
                                            <input type="text" placeholder="https://..." className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-indigo-500 outline-none font-bold text-xs" value={newCharla.videoUrl} onChange={e => setNewCharla({ ...newCharla, videoUrl: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción Técnica</label>
                                        <textarea rows="3" className="w-full p-6 rounded-3xl bg-slate-50 border border-slate-200 focus:border-indigo-500 outline-none font-bold uppercase text-[11px]" value={newCharla.descripcion} onChange={e => setNewCharla({ ...newCharla, descripcion: e.target.value })} />
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Notas del Relator</label>
                                        <textarea rows="3" placeholder="Ej: Importante reforzar..." className="w-full p-6 rounded-3xl bg-slate-50 border border-slate-200 focus:border-indigo-500 outline-none font-bold uppercase text-[11px]" value={newCharla.observaciones} onChange={e => setNewCharla({ ...newCharla, observaciones: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-10 animate-in slide-in-from-right-10 text-center max-w-4xl mx-auto py-10">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] flex items-center justify-center gap-4 text-left">
                                        <div className="w-5 h-5 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[9px]">2</div>
                                        Anexos y Documentación Multimedia
                                    </h4>
                                    <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto text-left">
                                        <label className="aspect-[2/1] bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:border-indigo-400 transition-all cursor-pointer relative">
                                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'foto')} />
                                            <ImageIcon size={28} className="text-slate-300" />
                                            <p className="text-[9px] font-black text-slate-500 uppercase">Cargar Fotos</p>
                                            {newCharla.galeriaFotos.length > 0 && <div className="absolute top-4 right-4 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">{newCharla.galeriaFotos.length}</div>}
                                        </label>
                                        <label className="aspect-[2/1] bg-slate-50 border border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 hover:border-indigo-400 transition-all cursor-pointer relative">
                                            <input type="file" accept="application/pdf" className="hidden" onChange={e => handleFileUpload(e, 'pdf')} />
                                            <FileText size={28} className="text-slate-300" />
                                            <p className="text-[9px] font-black text-slate-500 uppercase">Adjuntar PDF</p>
                                            {newCharla.archivosAdjuntos.length > 0 && <div className="absolute top-4 right-4 bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px]">{newCharla.archivosAdjuntos.length}</div>}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6 animate-in slide-in-from-right-10 py-6 max-w-2xl mx-auto w-full">
                                    <FirmaAvanzada
                                        label="Firma Autorización Publicación"
                                        rutFirmante={newCharla.relator.rut}
                                        nombreFirmante={newCharla.relator.nombre}
                                        emailFirmante={newCharla.relator.email}
                                        onSave={handleFirmaAvanzada}
                                        colorAccent="indigo"
                                    />
                                </div>
                            )}

                            {step === 4 && (
                                <div className="animate-in fade-in py-6 flex flex-col items-center text-left">
                                    <div className="bg-white shadow-2xl rounded-sm border border-slate-100 w-full max-w-[210mm] min-h-[297mm] p-[20mm] relative flex flex-col text-left">
                                        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-10 mb-10 text-left">
                                            <div className="text-left">
                                                <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">Certificado de <span className="text-indigo-600">Difusión GENAI360</span></h1>
                                                <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.4em]">Protocolo v6.0</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[12px] font-black text-slate-900 uppercase leading-none">{newCharla.relator.empresa}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Sede Central - Chile</p>
                                            </div>
                                        </div>
                                        <div className="space-y-12 flex-1 text-left">
                                            <section className="text-left">
                                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-50 pb-2">Identificación del Relator</h4>
                                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                                                    <div><p className="text-[8px] font-black text-slate-400 uppercase leading-none">Nombre</p><p className="text-[9px] font-black uppercase text-slate-800 mt-2">{newCharla.relator.nombre}</p></div>
                                                    <div><p className="text-[8px] font-black text-slate-400 uppercase leading-none">RUT</p><p className="text-[9px] font-black uppercase text-slate-800 mt-2">{newCharla.relator.rut}</p></div>
                                                    <div><p className="text-[8px] font-black text-slate-400 uppercase leading-none">Cargo</p><p className="text-[9px] font-black uppercase text-slate-800 mt-2">{newCharla.relator.cargo}</p></div>
                                                    <div><p className="text-[8px] font-black text-slate-400 uppercase leading-none">Empresa</p><p className="text-[9px] font-black uppercase text-slate-800 mt-2">{newCharla.relator.empresa}</p></div>
                                                </div>
                                            </section>
                                            <section className="text-left">
                                                <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4 border-b border-indigo-50 pb-2">Observaciones</h4>
                                                <div className="p-6 bg-slate-50/50 rounded-2xl min-h-[80px] text-left">
                                                    <p className="text-[10px] font-medium text-slate-600 italic uppercase leading-relaxed">{newCharla.observaciones || 'SIN COMENTARIOS'}</p>
                                                </div>
                                            </section>
                                            <div className="mt-16 grid grid-cols-2 gap-10 items-end border-t border-slate-100 pt-12 text-left">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-40 h-20 border-b border-slate-200 flex items-center justify-center mb-4">
                                                        {newCharla.firma && <img src={newCharla.firma} className="max-h-full max-w-full grayscale" alt="Firma Relator" />}
                                                    </div>
                                                    <p className="text-[9px] font-black text-slate-900 uppercase">Firma del Relator</p>
                                                </div>
                                                <div className="flex gap-4 items-center bg-slate-900 text-white p-6 rounded-3xl shadow-xl text-left">
                                                    <div className="bg-white p-2 rounded-xl">
                                                        {newCharla.metadataFirma && <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`DIF-V5|ID:${newCharla.metadataFirma.qrId}|GPS:${newCharla.metadataFirma.gps}`)}`} className="w-16 h-16" alt="QR Code" />}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-[9px] font-black italic text-indigo-400">CERTIFICACIÓN</p>
                                                        <p className="text-[7px] text-slate-500 uppercase">{newCharla.metadataFirma?.timestamp}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-10 bg-white border-t border-slate-50 flex items-center justify-between gap-6">
                            {step > 1 ? (
                                <button onClick={() => setStep(step - 1)} className="px-10 py-5 rounded-2xl border border-slate-200 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 flex items-center gap-2 transition-all">
                                    <ChevronRight className="rotate-180" size={16} /> Anterior
                                </button>
                            ) : <div />}
                            <div className="flex gap-4">
                                <button onClick={() => setShowCreate(false)} className="px-10 py-5 font-black text-[10px] uppercase text-slate-400 hover:text-rose-600 transition-all">Cancelar</button>
                                {step < 4 ? (
                                    <button onClick={() => {
                                        if (step === 1 && (!newCharla.titulo || !newCharla.relator.nombre)) return showAlert('COMPLETE DATOS OBLIGATORIOS Y RUT', 'error');
                                        if (step === 3 && !newCharla.firma) return showAlert('LA FIRMA ES OBLIGATORIA', 'error');
                                        setStep(step + 1);
                                    }} className="px-12 py-5 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase hover:bg-indigo-600 transition-all shadow-xl flex items-center gap-3">
                                        Continuar <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <button onClick={handleSubmit} disabled={saving || !newCharla.firma} className="px-12 py-5 rounded-2xl bg-indigo-600 text-white font-black text-[10px] uppercase hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-xl flex items-center gap-3">
                                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Globe size={18} /> Publicar Difusión Certificada</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTAS */}
            {alert && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-12 py-6 rounded-full font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl animate-in slide-in-from-bottom-12 z-[200] border-t-4 border-indigo-500 flex items-center gap-6">
                    <div className="bg-white/10 p-2 rounded-full"><Info size={20} className="text-indigo-400" /></div>
                    {alert.message}
                </div>
            )}
        </div>
    );
};

export default PrevDifusion;
