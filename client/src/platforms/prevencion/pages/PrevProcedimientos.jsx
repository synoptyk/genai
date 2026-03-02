import React, { useState, useEffect, useRef } from 'react';
import {
    BookOpen, Search, FileText, Download, Eye, Plus, X,
    Save, Camera, PenTool, ShieldCheck, MapPin, Loader2,
    CheckCircle2, UploadCloud, AlertCircle
} from 'lucide-react';
import { procedimientosApi } from '../prevencionApi';

const PrevProcedimientos = () => {
    const [loading, setLoading] = useState(false);
    const [procedimientos, setProcedimientos] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [step, setStep] = useState(1); // 1: Datos, 2: Documentos y Evidencia, 3: Firma

    const [newProc, setNewProc] = useState({
        codigo: '',
        titulo: '',
        descripcion: '',
        categoria: 'Operativo',
        pdfFile: null,
        imagenReferencia: null,
        fotoCarnet: null,
        firma: null,
        metadataFirma: null
    });

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [streaming, setStreaming] = useState(false);

    useEffect(() => {
        fetchProcedimientos();
    }, []);

    const fetchProcedimientos = async () => {
        setLoading(true);
        try {
            const res = await procedimientosApi.getAll();
            setProcedimientos(res.data || []);
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

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            setNewProc({ ...newProc, pdfFile: file });
            showAlert('PDF CARGADO', 'success');
        } else {
            showAlert('SÓLO ARCHIVOS PDF', 'error');
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewProc({ ...newProc, imagenReferencia: reader.result });
                showAlert('IMAGEN REFERENCIAL CARGADA', 'success');
            };
            reader.readAsDataURL(file);
        } else {
            showAlert('SÓLO ARCHIVOS DE IMAGEN', 'error');
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoRef.current.srcObject = stream;
            setStreaming(true);
        } catch (err) {
            showAlert('ERROR AL ACCEDER A CÁMARA', 'error');
        }
    };

    const takePhoto = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/png');
        setNewProc({ ...newProc, fotoCarnet: data });

        // Stop camera
        const stream = video.srcObject;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        setStreaming(false);
        showAlert('FOTO CAPTURADA', 'success');
    };

    const handleSign = () => {
        if (!navigator.geolocation) return showAlert('GPS REQUERIDO PARA FIRMA', 'error');

        navigator.geolocation.getCurrentPosition((pos) => {
            const metadata = {
                timestamp: new Date().toISOString(),
                gps: `${pos.coords.latitude}, ${pos.coords.longitude}`,
                qrId: `PTS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                rutFirmante: '12.345.678-9', // Mock
                nombreFirmante: 'JUAN PREVENCIONISTA' // Mock
            };
            setNewProc({ ...newProc, firma: 'FIRMA_STAMP_PRO', metadataFirma: metadata });
            showAlert('FIRMA Y METADATOS GENERADOS', 'success');
        });
    };

    const handleSubmit = async () => {
        if (!newProc.firma) return showAlert('LA FIRMA ES OBLIGATORIA', 'error');
        setSaving(true);
        try {
            const submission = {
                codigo: newProc.codigo,
                titulo: newProc.titulo,
                descripcion: newProc.descripcion,
                categoria: newProc.categoria,
                pdfUrl: 'URL_PDF_SIMULADO', // En un entorno real se subiría a Cloudinary
                imagenReferenciaUrl: newProc.imagenReferencia, // Base64 simulado
                evidencia: { fotoCarnetPrev: newProc.fotoCarnet },
                firmaAvanzada: {
                    signature: newProc.firma,
                    qrId: newProc.metadataFirma.qrId,
                    gps: newProc.metadataFirma.gps,
                    timestamp: newProc.metadataFirma.timestamp,
                    rutFirmante: newProc.metadataFirma.rutFirmante,
                    nombreFirmante: newProc.metadataFirma.nombreFirmante
                }
            };
            await procedimientosApi.create(submission);
            showAlert('PTS CREADO EXITOSAMENTE', 'success');
            setShowCreate(false);
            setStep(1);
            setNewProc({ codigo: '', titulo: '', descripcion: '', categoria: 'Operativo', pdfFile: null, fotoCarnet: null, firma: null, metadataFirma: null });
            fetchProcedimientos();
        } catch {
            showAlert('ERROR AL GUARDAR', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <div className="bg-rose-600 text-white p-4 rounded-[1.5rem] shadow-xl shadow-rose-200 transform -rotate-3">
                        <BookOpen size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Repositorio <span className="text-rose-600">PTS PRO</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.3em]">Gestión Normativa y Procedimientos de Trabajo Seguro</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-slate-200"
                >
                    <Plus size={18} /> Crear Nuevo PTS
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 mb-10 shadow-sm flex items-center gap-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input type="text" placeholder="BUSCAR PROCEDIMIENTO, CÓDIGO O PALABRA CLAVE..." className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-rose-500/5 text-xs font-bold uppercase tracking-wider" />
                </div>
                <div className="h-10 w-px bg-slate-100" />
                <div className="flex gap-2">
                    {['Todos', 'Operativo', 'Eléctrico', 'Telecom'].map(cat => (
                        <button key={cat} className="px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-50 transition-all text-slate-400">{cat}</button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <div className="col-span-full py-40 text-center flex flex-col items-center gap-6">
                        <div className="w-16 h-16 border-4 border-rose-50 border-t-rose-600 rounded-full animate-spin"></div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Consultando Repositorio...</p>
                    </div>
                ) : procedimientos.length > 0 ? (
                    procedimientos.map(proc => (
                        <div key={proc._id} className="bg-white p-0 rounded-[2.5rem] border border-slate-100 hover:border-rose-200 transition-all group shadow-sm hover:shadow-xl hover:shadow-rose-500/5 relative overflow-hidden flex flex-col">
                            {proc.imagenReferenciaUrl && (
                                <div className="w-full h-40 overflow-hidden relative">
                                    <img src={proc.imagenReferenciaUrl} className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500 group-hover:scale-110" alt="Referencia PTS" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                                </div>
                            )}
                            <div className="p-8 relative z-10 flex-1">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[5rem] -mr-8 -mt-8 -z-10 transition-all group-hover:bg-rose-50 opacity-50" />
                                <div className="flex justify-between items-start mb-6">
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg group-hover:bg-rose-600 transition-colors">
                                        <FileText size={24} />
                                    </div>
                                    <span className="text-[10px] font-black bg-slate-100 px-4 py-2 rounded-xl uppercase text-slate-500 border border-white shadow-sm">{proc.codigo}</span>
                                </div>
                                <h3 className="font-black text-slate-900 text-base leading-tight mb-3 uppercase italic tracking-tight">{proc.titulo}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-6 line-clamp-2 leading-relaxed">{proc.descripcion}</p>

                                <div className="flex items-center gap-3 mb-8 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <ShieldCheck size={16} className="text-emerald-600" />
                                    <p className="text-[9px] font-black text-emerald-700 uppercase leading-none">Firmado y Validado HSE</p>
                                </div>

                                <div className="flex gap-2">
                                    <button className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100">
                                        <Eye size={16} /> Ver PDF
                                    </button>
                                    <button className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-white hover:text-rose-600 border border-transparent hover:border-rose-100 transition-all shadow-sm">
                                        <Download size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-48 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <BookOpen size={32} className="text-slate-200" />
                        </div>
                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No se encontraron procedimientos registrados</p>
                    </div>
                )}
            </div>

            {/* MODAL CREACION PTS */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xl animate-in fade-in">
                    <div className="bg-white rounded-[4rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-500">
                        <div className="p-10 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="bg-rose-600 p-4 rounded-2xl shadow-lg">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">Crear Nuevo <span className="text-rose-400">Procedimiento</span></h2>
                                    <div className="flex gap-2 mt-2">
                                        {[1, 2, 3].map(s => (
                                            <div key={s} className={`h-1 rounded-full w-12 transition-all ${step >= s ? 'bg-rose-500' : 'bg-slate-700'}`} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="p-4 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"><X size={28} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                            {step === 1 && (
                                <div className="space-y-8 animate-in slide-in-from-right-10">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código Registro</label>
                                            <input type="text" placeholder="Ej: PTS-TEL-001" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs" value={newProc.codigo} onChange={e => setNewProc({ ...newProc, codigo: e.target.value })} />
                                        </div>
                                        <div className="md:col-span-2 space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Título del Procedimiento</label>
                                            <input type="text" placeholder="NOMBRE COMPLETO" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs" value={newProc.titulo} onChange={e => setNewProc({ ...newProc, titulo: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-left">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción Breve / Objetivo</label>
                                        <textarea rows="4" className="w-full p-6 rounded-3xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs" value={newProc.descripcion} onChange={e => setNewProc({ ...newProc, descripcion: e.target.value })} />
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-10 animate-in slide-in-from-right-10 text-left">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {/* 1. PDF FILE */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 text-center">1. Documento PDF</h4>
                                            <label className="flex flex-col items-center justify-center w-full h-56 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all group overflow-hidden">
                                                <div className="flex flex-col items-center justify-center p-6 text-center">
                                                    {newProc.pdfFile ? (
                                                        <>
                                                            <div className="bg-emerald-500 p-3 rounded-full text-white mb-3 shadow-lg animate-bounce"><CheckCircle2 size={24} /></div>
                                                            <p className="text-[9px] font-black text-slate-900 uppercase truncate w-full px-4">{newProc.pdfFile.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UploadCloud size={32} className="text-slate-300 group-hover:text-rose-500 mb-3 transition-transform group-hover:scale-110" />
                                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cargar PDF</p>
                                                        </>
                                                    )}
                                                </div>
                                                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} />
                                            </label>
                                        </div>

                                        {/* 2. REFERENCE IMAGE */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 text-center">2. Imagen Referencial</h4>
                                            <label className="flex flex-col items-center justify-center w-full h-56 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group overflow-hidden relative">
                                                {newProc.imagenReferencia ? (
                                                    <div className="relative w-full h-full group">
                                                        <img src={newProc.imagenReferencia} className="w-full h-full object-cover" alt="Referencia" />
                                                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <p className="text-white text-[8px] font-black uppercase">Cambiar Imagen</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center p-6 text-center">
                                                        <UploadCloud size={32} className="text-slate-300 group-hover:text-blue-500 mb-3 transition-transform group-hover:scale-110" />
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagen Referencia</p>
                                                    </div>
                                                )}
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                            </label>
                                        </div>

                                        {/* 3. HSE PHOTO */}
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 text-center">3. Foto Carnet HSE</h4>
                                            <div className="relative w-full h-56 rounded-[2.5rem] bg-slate-900 overflow-hidden shadow-2xl group flex flex-col">
                                                {newProc.fotoCarnet ? (
                                                    <div className="relative h-full">
                                                        <img src={newProc.fotoCarnet} className="w-full h-full object-cover" alt="Carnet" />
                                                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => { setNewProc({ ...newProc, fotoCarnet: null }); startCamera(); }} className="bg-white text-slate-900 px-6 py-3 rounded-full font-black text-[9px] uppercase">Tomar de Nuevo</button>
                                                        </div>
                                                    </div>
                                                ) : streaming ? (
                                                    <div className="relative h-full">
                                                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale contrast-125" />
                                                        <button onClick={takePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-rose-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all border-2 border-white"><Camera size={24} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                                                        <Camera size={32} className="text-slate-700 mb-3" />
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4">Captura Credencial</p>
                                                        <button onClick={startCamera} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase hover:bg-rose-600 transition-all">Activar Cámara</button>
                                                    </div>
                                                )}
                                            </div>
                                            <canvas ref={canvasRef} className="hidden" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-10 animate-in slide-in-from-right-10 flex flex-col items-center py-10">
                                    <div className="max-w-md w-full p-12 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[4rem] text-center">
                                        {newProc.firma ? (
                                            <div className="space-y-6">
                                                <div className="bg-emerald-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-white shadow-xl animate-in zoom-in"><CheckCircle2 size={48} /></div>
                                                <div>
                                                    <p className="text-[11px] font-black uppercase text-slate-900 tracking-widest">Firma Avanzada Aceptada</p>
                                                    <p className="text-[8px] font-bold text-emerald-600 uppercase mt-2">Validado vía GPS & Coordenadas</p>
                                                </div>
                                                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-left grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">QR Registro</p>
                                                        <p className="text-[9px] font-black text-slate-900">{newProc.metadataFirma.qrId}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">GPS Pos</p>
                                                        <p className="text-[9px] font-black text-slate-900 truncate">{newProc.metadataFirma.gps}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={handleSign} className="group p-12 bg-white rounded-[3rem] border border-slate-100 shadow-2xl hover:border-rose-500 transition-all flex flex-col items-center gap-6">
                                                <div className="bg-slate-900 p-8 rounded-[2rem] group-hover:bg-rose-600 transition-colors shadow-xl">
                                                    <PenTool size={48} className="text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 leading-tight">Presione para validar con</p>
                                                    <p className="text-[12px] font-black uppercase italic text-rose-600 tracking-tighter mt-1">Firma Electrónica Avanzada</p>
                                                </div>
                                                <div className="flex items-center gap-2 mt-2 opacity-50">
                                                    <MapPin size={12} />
                                                    <span className="text-[8px] font-black uppercase">GPS Requerido</span>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 p-6 bg-rose-50 rounded-[2rem] border border-rose-100 max-w-lg">
                                        <AlertCircle className="text-rose-600 shrink-0" size={24} />
                                        <p className="text-[9px] font-bold text-rose-800 uppercase text-left leading-relaxed">Al firmar, usted declara haber revisado el documento y certifica la veracidad de los datos. El sistema estampará sus datos de geolocalización y rut para trazabilidad legal.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-4">
                            {step > 1 && (
                                <button onClick={() => setStep(step - 1)} className="px-10 py-5 rounded-full border-2 border-slate-200 text-slate-400 font-black text-[11px] uppercase tracking-widest hover:bg-white">Atrás</button>
                            )}
                            <div className="flex-1" />
                            {step < 3 ? (
                                <button
                                    onClick={() => {
                                        if (step === 1 && (!newProc.codigo || !newProc.titulo)) return showAlert('COMPLETE CÓDIGO Y TÍTULO', 'error');
                                        if (step === 2 && (!newProc.pdfFile || !newProc.fotoCarnet)) return showAlert('CARGUE EL PDF Y LA FOTO DEL CARNET', 'error');
                                        setStep(step + 1);
                                    }}
                                    className="px-12 py-5 rounded-full bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl"
                                >
                                    Siguiente Paso
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={saving || !newProc.firma}
                                    className="px-12 py-5 rounded-full bg-rose-600 text-white font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-rose-700 disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Publicar Procedimiento</>}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTAS PREMIUM */}
            {alert && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-10 py-5 rounded-[2.5rem] font-black text-[10px] uppercase tracking-widest shadow-2xl animate-in slide-in-from-bottom-10 z-[200] border border-slate-800 flex items-center gap-4">
                    <div className={`${alert.type === 'error' ? 'bg-rose-600' : 'bg-emerald-500'} p-2 rounded-full`}>
                        {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                    {alert.message}
                </div>
            )}
        </div>
    );
};

export default PrevProcedimientos;
