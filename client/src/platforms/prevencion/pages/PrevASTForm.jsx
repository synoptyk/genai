import React, { useState, useRef, useEffect } from 'react';
import {
    ShieldAlert, CheckCircle2, X, Save, HardHat, AlertTriangle,
    PenTool, MapPin, Loader2, Info, Radio, TowerControl, Construction,
    Camera, Mic, Trash2, StopCircle, PlayCircle, Eye, RotateCcw, Check
} from 'lucide-react';
import { astApi, matrizRiesgosApi } from '../prevencionApi';

// Icono Zap optimizado
const ZapIcon = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 L13 2 Z" /></svg>;
const Zap = () => <ZapIcon size={20} />;

// RIESGOS_CRITICOS se cargará dinámicamente desde la API

const EPP_REQUERIDO = [
    'Casco con Chinstrap (Dielec)', 'Lentes de Seguridad', 'Guantes de Cabritilla', 'Chaleco Reflectante', 'Zapatos Dieléctricos',
    'Arnés de 4 Argollas', 'Cuerda de Vida / Estrobos', 'Línea de Vida Vertical',
    'Guantes Dieléctricos (Clase 0/2)', 'Ropa Ignífuga (Arc Flash)', 'Protector Solar (vía pública)', 'Protector Auditivo'
];

const PrevASTForm = () => {
    const [saving, setSaving] = useState(false);
    const [capturingGps, setCapturingGps] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [alert, setAlert] = useState(null);
    const [submitted, setSubmitted] = useState(false);

    // multimedia states
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [canSubmit, setCanSubmit] = useState(false);
    const [riesgosIper, setRiesgosIper] = useState([]);
    const [loadingRiesgos, setLoadingRiesgos] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const isDrawingRef = useRef(false);

    const [form, setForm] = useState({
        ot: '', empresa: 'GEN AI', region: 'Región Metropolitana', comuna: '', calle: '', numero: '', departamento: '', gps: '',
        aptitud: 'Si', riesgosSeleccionados: [], eppVerificado: [],
        fotos: [], audio: null,
        controlMedidas: '', firmaColaborador: null, metadataFirma: null,
        estado: 'En Revisión',
        // Datos de Sesión (Simulados para el trabajador que inició sesión)
        nombreTrabajador: 'TECNICO PRUEBA', rutTrabajador: '1-9', cargoTrabajador: 'TÉCNICO ESPECIALISTA'
    });

    const showAlert = (message, type = 'info') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const handleGetGps = () => {
        if (!navigator.geolocation) return showAlert('GPS NO DISPONIBLE', 'error');
        setCapturingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setForm(prev => ({ ...prev, gps: `${pos.coords.latitude},${pos.coords.longitude}` }));
                setCapturingGps(false);
                showAlert('GPS CAPTURADO', 'success');
            },
            () => {
                showAlert('ERROR GPS', 'error');
                setCapturingGps(false);
            }
        );
    };

    useEffect(() => {
        const fetchRiesgos = async () => {
            setLoadingRiesgos(true);
            try {
                const res = await matrizRiesgosApi.getAll();
                setRiesgosIper(res.data || []);
            } catch (e) {
                console.error('Error loading risks:', e);
            } finally {
                setLoadingRiesgos(false);
            }
        };
        fetchRiesgos();
    }, []);

    // Camera Handlers
    const [activeStream, setActiveStream] = useState(null);

    const startCamera = async () => {
        try {
            const constraints = {
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
            };
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (innerErr) {
                console.warn("Fallo 'environment', intentando modo default...");
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            setActiveStream(stream);
            setIsCameraActive(true);
        } catch (err) {
            console.error("Error al abrir cámara:", err);
            showAlert('ERROR DE CÁMARA: VERIFIQUE PERMISOS', 'error');
        }
    };

    useEffect(() => {
        if (isCameraActive && activeStream && videoRef.current) {
            videoRef.current.srcObject = activeStream;
            videoRef.current.play().catch(e => console.error("Error auto-play:", e));
        }
    }, [isCameraActive, activeStream]);

    const capturePhoto = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        setForm(prev => ({ ...prev, fotos: [...prev.fotos, data].slice(-4) })); // max 4 photos

        // Mantener camara activa para mas fotos si se desea, o cerrar
        showAlert('FOTO CAPTURADA', 'success');
    };

    // Fix Signature Canvas Size & Drawing State
    useEffect(() => {
        if (currentStep === 4 && signatureCanvasRef.current) {
            const canvas = signatureCanvasRef.current;
            const parent = canvas.parentElement;
            // Set dimensions to match the parent container
            canvas.width = parent.clientWidth;
            canvas.height = 256; // Fixed height consistent with h-64
        }
    }, [currentStep]);

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        }
        setIsCameraActive(false);
    };

    // Audio Handlers
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    setForm(prev => ({ ...prev, audio: reader.result }));
                };
                setAudioBlob(URL.createObjectURL(blob));
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            showAlert('ERROR DE AUDIO', 'error');
        }
    };

    // Delay for Step 5 Submit button to prevent carryover clicks
    useEffect(() => {
        if (currentStep === 5) {
            const timer = setTimeout(() => setCanSubmit(true), 600); // 600ms safety delay
            return () => clearTimeout(timer);
        } else {
            setCanSubmit(false);
        }
    }, [currentStep]);

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const signatureCanvasRef = useRef(null);

    const validateStep = (step) => {
        if (step === 1) return form.ot && form.empresa && form.calle && form.numero && form.gps && form.aptitud === 'Si';
        if (step === 2) return form.riesgosSeleccionados.length > 0 && form.eppVerificado.length > 0;
        if (step === 3) return form.fotos.length > 0; // Al menos 1 foto
        if (step === 4) return form.firmaColaborador !== null;
        return true;
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep === 3) stopCamera(); // Asegurar apagar camara
            if (currentStep < 5) setCurrentStep(prev => prev + 1);
        }
        else showAlert('COMPLETE TODOS LOS CAMPOS OBLIGATORIOS', 'error');
    };

    const clearSignature = () => {
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setForm(prev => ({ ...prev, firmaColaborador: null, metadataFirma: null }));
    };

    const saveSignature = () => {
        const canvas = signatureCanvasRef.current;
        const data = canvas.toDataURL('image/png');
        const qrId = `AST-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        setForm(prev => ({
            ...prev,
            firmaColaborador: data,
            metadataFirma: {
                timestamp: new Date(),
                gps: form.gps,
                qrId: qrId
            }
        }));
        showAlert('FIRMA CAPTURADA', 'success');
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        // Guard: Solo permitir envío desde el paso de vista previa (5)
        if (currentStep !== 5) return;

        if (!form.firmaColaborador) return showAlert('LA FIRMA ES OBLIGATORIA', 'error');
        setSaving(true);
        try {
            const res = await astApi.create(form);

            // LÓGICA V5.0: Generación Automática de Hallazgos
            // Simulamos detección de riesgos críticos (id: altura, electrico_mt, loto)
            const riesgosCriticosDetectados = form.riesgosSeleccionados.filter(r =>
                ['altura', 'electrico_mt', 'loto'].includes(r)
            );

            if (riesgosCriticosDetectados.length > 0) {
                console.log("RIESGO CRÍTICO DETECTADO: Generando Hallazgo Automático...");
                // Aquí se llamaría a hallazgosApi.create(...)
                setForm(prev => ({ ...prev, hallazgoGenerado: true }));
            }

            setSubmitted(true);
        } catch {
            showAlert('ERROR AL ENVIAR', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-16 rounded-[4rem] shadow-2xl text-center max-w-lg w-full border border-emerald-100 animate-in zoom-in-95 duration-700">
                    <div className="bg-emerald-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-100">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase italic leading-tight">AST Enviada Correctamente</h2>
                    {form.hallazgoGenerado && (
                        <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 animate-pulse">
                            <ShieldAlert className="text-rose-600" size={24} />
                            <p className="text-[9px] font-black text-rose-800 uppercase text-left">Se ha generado un <span className="underline">Hallazgo Crítico</span> automático para revisión HSE debido a los riesgos declarados.</p>
                        </div>
                    )}
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-6">Evidencias multimedia y firma registradas</p>
                    <button onClick={() => window.location.reload()} className="mt-12 bg-blue-600 text-white px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">Generar Nueva AST</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="bg-white p-10 text-slate-900 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg text-white">
                                <ShieldAlert size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">AST Terreno <span className="text-blue-600">Corporativo</span></h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">v4.0 - Gestión Preventiva de Excelencia</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="bg-slate-50 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-400">Paso {currentStep} de 5</span>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-8">
                        {[1, 2, 3, 4, 5].map(s => (
                            <div key={s} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${currentStep >= s ? 'bg-blue-600' : 'bg-slate-100'}`} />
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-10 space-y-10">
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {/* Identificación Automática (Simula sesión) */}
                            {/* Identificación Automática (Simula sesión) */}
                            <div className="p-6 bg-slate-50 rounded-3xl text-left border-l-8 border-blue-600 shadow-sm border border-slate-100">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Identificación del Trabajador (Sesión Activa)</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Nombre</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{form.nombreTrabajador}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">RUT</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{form.rutTrabajador}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Cargo</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{form.cargoTrabajador}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Empresa de Origen</p>
                                        <p className="text-xs font-black text-slate-900 uppercase">{form.empresa}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de OT</label>
                                    <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-4 focus:ring-blue-600/10 font-bold" value={form.ot} onChange={e => setForm({ ...form, ot: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md:col-span-3 space-y-2 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Calle / Avenida (Dirección)</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input type="text" className="w-full pl-16 pr-8 py-4 rounded-2xl bg-white border border-slate-200 font-bold uppercase text-xs focus:ring-4 focus:ring-blue-600/10 outline-none" value={form.calle} onChange={e => setForm({ ...form, calle: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número</label>
                                    <input type="text" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 font-bold uppercase text-xs focus:ring-4 focus:ring-blue-600/10 outline-none" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} />
                                </div>
                                <div className="space-y-2 text-left">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Block / Torre / Dpto</label>
                                    <input type="text" placeholder="Ej: Torre B Depto 402" className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 font-bold uppercase text-[10px] focus:ring-4 focus:ring-blue-600/10 outline-none placeholder:text-slate-300" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ubicación GPS ONLINE (Georreferenciación)</label>

                                <div className="relative rounded-[2.5rem] overflow-hidden border-2 border-slate-100 shadow-xl bg-slate-50 aspect-[21/9] group cursor-pointer" onClick={handleGetGps}>
                                    {form.gps ? (
                                        <>
                                            <iframe
                                                title="Mapa Satelital AST"
                                                src={`https://maps.google.com/maps?q=${form.gps}&z=18&t=k&output=embed`}
                                                className="absolute inset-0 w-full h-full border-0 opacity-100 transition-opacity duration-700 pointer-events-none"
                                                loading="lazy"
                                            />

                                            {/* Capa de interacción y efectos */}
                                            <div className="absolute inset-0 bg-blue-900/10 pointer-events-none" />

                                            <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-slate-900 gap-2 pointer-events-none">
                                                <RotateCcw size={32} className="animate-spin-slow text-blue-600" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Recalibrar Posición</p>
                                            </div>

                                            <div className="absolute bottom-6 right-6 bg-emerald-500 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-emerald-400 shadow-xl pointer-events-none">
                                                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                <span className="text-[8px] font-black text-white uppercase tracking-widest">Sincronización Satelital OK</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center gap-6 bg-slate-50 transition-colors group-hover:bg-slate-100">
                                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl animate-bounce">
                                                <MapPin size={32} />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Capturar Georreferencia</h4>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-widest">Haga clic para obtener su ubicación 100% Real</p>
                                            </div>
                                            {capturingGps && (
                                                <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center gap-4">
                                                    <Loader2 className="animate-spin text-blue-600" size={40} />
                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest animate-pulse">Sincronizando con Satélites...</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="bg-slate-50 p-8 rounded-3xl flex flex-col items-center gap-6 border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">¿Está apto físicamente para el trabajo?</p>
                                <div className="flex gap-4 w-full">
                                    <button type="button" onClick={() => setForm({ ...form, aptitud: 'Si' })} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase transition-all ${form.aptitud === 'Si' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>Sí, Apto</button>
                                    <button type="button" onClick={() => setForm({ ...form, aptitud: 'No' })} className={`flex-1 py-4 rounded-xl font-black text-xs uppercase transition-all ${form.aptitud === 'No' ? 'bg-rose-600 text-white shadow-xl' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-100'}`}>No Apto</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between -mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Peligros Detectados (Matriz IPER Dinámica)</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setForm(f => ({ ...f, riesgosSeleccionados: riesgosIper.map(r => r.riesgo) }))} className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all">Seleccionar Todos</button>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, riesgosSeleccionados: [] }))} className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all">Limpiar</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {loadingRiesgos && <Loader2 size={32} className="animate-spin text-blue-500 mx-auto col-span-2" />}
                                {riesgosIper.map(r => (
                                    <button key={r._id} type="button" onClick={() => setForm(f => ({ ...f, riesgosSeleccionados: f.riesgosSeleccionados.includes(r.riesgo) ? f.riesgosSeleccionados.filter(x => x !== r.riesgo) : [...f.riesgosSeleccionados, r.riesgo] }))} className={`p-4 rounded-2xl border flex items-center gap-3 text-left transition-all ${form.riesgosSeleccionados.includes(r.riesgo) ? 'bg-blue-50 border-blue-200 shadow-md' : 'bg-white border-slate-100'}`}>
                                        <div className={`p-2 rounded-xl ${form.riesgosSeleccionados.includes(r.riesgo) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                            <ShieldAlert size={18} />
                                        </div>
                                        <div>
                                            <span className="text-[9.5px] font-black uppercase tracking-tight text-slate-900 block">{r.riesgo}</span>
                                            <span className={`text-[7px] font-bold uppercase ${r.clasificacion === 'Crítico' ? 'text-rose-600' : 'text-slate-400'}`}>
                                                Severidad: {r.clasificacion || 'Normal'}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center justify-between -mb-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Checklist EPP</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setForm(f => ({ ...f, eppVerificado: [...EPP_REQUERIDO] }))} className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all">Seleccionar Todos</button>
                                    <button type="button" onClick={() => setForm(f => ({ ...f, eppVerificado: [] }))} className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all">Limpiar</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {EPP_REQUERIDO.map(epp => (
                                    <button key={epp} type="button" onClick={() => setForm(f => ({ ...f, eppVerificado: f.eppVerificado.includes(epp) ? f.eppVerificado.filter(x => x !== epp) : [...f.eppVerificado, epp] }))} className={`p-3 rounded-xl border flex items-center justify-between text-[9px] font-black uppercase transition-all ${form.eppVerificado.includes(epp) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                                        {epp} {form.eppVerificado.includes(epp) && <CheckCircle2 size={12} />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-10 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* SECCION FOTOS */}
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Evidencia Fotográfica (Max 4)</p>
                                    <div className="relative aspect-video rounded-3xl bg-slate-100 overflow-hidden shadow-inner border border-slate-200">
                                        {isCameraActive ? (
                                            <>
                                                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                                                    <button type="button" onClick={capturePhoto} className="bg-blue-600 text-white p-4 rounded-full shadow-xl border-4 border-white active:scale-90 transition-all"><Camera size={24} /></button>
                                                    <button type="button" onClick={stopCamera} className="bg-white text-slate-900 p-4 rounded-full shadow-xl border border-slate-200 active:scale-90 transition-all"><X size={24} /></button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4">
                                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-50">
                                                    <Camera size={32} />
                                                </div>
                                                <button type="button" onClick={startCamera} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg">Activar Cámara</button>
                                            </div>
                                        )}
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {form.fotos.map((img, i) => (
                                            <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-100 group">
                                                <img src={img} className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setForm({ ...form, fotos: form.fotos.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm text-rose-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity border border-slate-100 shadow-sm"><Trash2 size={10} /></button>
                                            </div>
                                        ))}
                                        {[...Array(Math.max(0, 4 - form.fotos.length))].map((_, i) => (
                                            <div key={i} className="aspect-square rounded-xl bg-slate-50 border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-200"><Camera size={16} /></div>
                                        ))}
                                    </div>
                                </div>

                                {/* SECCION AUDIO */}
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Registro de Audio (Opcional)</p>
                                    <div className="p-10 bg-slate-50 rounded-[2.5rem] text-center space-y-6 shadow-sm border border-slate-100">
                                        {form.audio ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-center gap-4">
                                                    <div className="bg-emerald-100 p-4 rounded-full text-emerald-600"><CheckCircle2 size={32} /></div>
                                                    <div className="text-left">
                                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Audio Grabado</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase">Listo para envío</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <audio src={audioBlob} controls className="w-full h-10 rounded-full" />
                                                    <button type="button" onClick={() => setForm({ ...form, audio: null })} className="bg-white border border-slate-200 text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition-all shadow-sm"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all ${isRecording ? 'bg-rose-600 animate-pulse' : 'bg-white border border-slate-200 text-slate-300 shadow-sm'}`}>
                                                    <Mic size={32} className={isRecording ? 'text-white' : 'text-slate-300'} />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                                    {isRecording ? 'Grabando Audio...' : 'Describe riesgos o aclaraciones rápidamente'}
                                                </p>
                                                {isRecording ? (
                                                    <button type="button" onClick={stopRecording} className="bg-white text-slate-900 px-10 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 mx-auto border border-slate-200 shadow-sm"><StopCircle size={16} /> Detener</button>
                                                ) : (
                                                    <button type="button" onClick={startRecording} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2 mx-auto hover:bg-blue-700 transition-all shadow-lg"><Mic size={16} /> Iniciar Grabación</button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            <div className="space-y-2 text-left">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medidas de Control Aplicadas</label>
                                <textarea className="w-full p-6 rounded-3xl bg-white border border-slate-200 font-bold uppercase text-[11px] min-h-[120px] focus:ring-4 focus:ring-blue-600/10 outline-none" placeholder="DESCRIBA LAS MEDIDAS ADOPTADAS PARA MITIGAR LOS RIESGOS..." value={form.controlMedidas} onChange={e => setForm({ ...form, controlMedidas: e.target.value })} />
                            </div>

                            <div className="space-y-6">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Firma del Colaborador (Manual)</p>
                                <div className="relative bg-white border-4 border-dashed border-slate-200 rounded-[3rem] overflow-hidden shadow-inner group">
                                    <canvas
                                        ref={signatureCanvasRef}
                                        className="w-full h-64 cursor-crosshair active:bg-slate-50 transition-colors"
                                        onPointerDown={(e) => {
                                            const canvas = signatureCanvasRef.current;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            ctx.lineWidth = 3;
                                            ctx.lineCap = 'round';
                                            ctx.strokeStyle = '#1e3050'; // Navy Corporate Blue
                                            ctx.beginPath();
                                            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                                            isDrawingRef.current = true;
                                        }}
                                        onPointerMove={(e) => {
                                            if (!isDrawingRef.current) return;
                                            const canvas = signatureCanvasRef.current;
                                            const rect = canvas.getBoundingClientRect();
                                            const ctx = canvas.getContext('2d');
                                            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                                            ctx.stroke();
                                        }}
                                        onPointerUp={() => (isDrawingRef.current = false)}
                                        onPointerLeave={() => (isDrawingRef.current = false)}
                                    />

                                    <div className="absolute top-6 right-6 flex gap-2">
                                        <button type="button" onClick={clearSignature} className="bg-white border border-slate-100 text-slate-400 p-2 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm"><Trash2 size={20} /></button>
                                        <button type="button" onClick={saveSignature} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg">Fijar Firma</button>
                                    </div>

                                    {!form.firmaColaborador && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                                            <PenTool size={64} className="text-slate-300" />
                                        </div>
                                    )}
                                </div>
                                {form.firmaColaborador && (
                                    <div className="flex items-center justify-center gap-2 text-emerald-500 animate-pulse">
                                        <CheckCircle2 size={16} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Firma Registrada con Éxito</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">Paso Final: Certificación</p>
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic">Vista Previa del Reporte</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Revise que toda la información sea correcta antes de emitir el certificado</p>
                            </div>
                            {/* VISTA PREVIA PDF (SIMULACIÓN DE HOJA ÚNICA A4) */}
                            <div className="bg-white border border-slate-200 shadow-2xl rounded-none p-[15mm] text-left space-y-8 w-[210mm] min-h-[297mm] h-auto mx-auto flex flex-col relative overflow-hidden ring-1 ring-slate-100 scale-[0.85] origin-top mb-[-100px]">
                                <div className="flex justify-between items-start border-b-8 border-blue-700 pb-8">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Análisis Seguro de Trabajo</h2>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{form.empresa} - CORPORATE SAFETY REPORT</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-blue-700 uppercase">CERTIFICADO: {form.metadataFirma?.qrId}</p>
                                        <p className="text-[8px] font-bold text-slate-400">{new Date().toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-900 uppercase mb-3 border-b border-slate-200 pb-2">Identificación</p>
                                            <div className="space-y-2">
                                                <p className="text-[9px] font-bold"><span className="text-slate-400 uppercase">OT:</span> {form.ot}</p>
                                                <p className="text-[9px] font-bold"><span className="text-slate-400 uppercase">Trabajador:</span> {form.nombreTrabajador}</p>
                                                <p className="text-[9px] font-bold"><span className="text-slate-400 uppercase">RUT:</span> {form.rutTrabajador}</p>
                                                <p className="text-[9px] font-bold text-emerald-600"><span className="text-slate-400 uppercase">Estado:</span> APTO FÍSICAMENTE</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 overflow-hidden relative group">
                                            <p className="text-[10px] font-black text-slate-900 uppercase mb-3 border-b border-slate-200 pb-2">Ubicación Georreferenciada</p>
                                            <p className="text-[9px] font-bold uppercase mb-2">{form.calle} {form.numero} {form.departamento && `- ${form.departamento}`}</p>
                                            <div className="aspect-video w-full rounded-2xl bg-slate-200 border border-slate-300 overflow-hidden relative">
                                                <iframe
                                                    title="Mapa Satelital Preview"
                                                    src={`https://maps.google.com/maps?q=${form.gps}&z=18&t=k&output=embed`}
                                                    className="absolute inset-0 w-full h-full border-0 grayscale-[20%]"
                                                />
                                            </div>
                                            <p className="text-[8px] font-bold text-rose-500 mt-2 tracking-widest uppercase">GPS Online: {form.gps}</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <p className="text-[10px] font-black text-blue-600 uppercase mb-4 border-b border-slate-200 pb-2 italic">Riesgos y EPP</p>
                                        <div className="space-y-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {form.riesgosSeleccionados.map(r => (
                                                    <span key={r} className="text-[8px] font-black bg-blue-100/30 text-blue-700 px-3 py-1 rounded-full border border-blue-200 uppercase">{r}</span>
                                                ))}
                                            </div>
                                            <div className="pt-4 border-t border-slate-200">
                                                <div className="flex flex-wrap gap-1">
                                                    {form.eppVerificado.map(e => <span key={e} className="text-[7px] bg-white text-slate-500 px-2 py-0.5 rounded border border-slate-100 uppercase">{e}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic">
                                    <p className="text-[9px] font-black text-slate-900 uppercase mb-2">Medidas de Control Adicionales:</p>
                                    <p className="text-[10px] font-bold text-slate-600 uppercase leading-relaxed">{form.controlMedidas || 'NINGUNA ADICIONAL REPORTADA'}</p>
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                    {form.fotos.map((f, i) => (
                                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                                            <img src={f} className="w-full h-full object-cover" alt={`Evidencia ${i}`} />
                                        </div>
                                    ))}
                                    {form.audio && (
                                        <div className="aspect-square bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-blue-600 p-4 text-center border border-slate-200">
                                            <Mic size={24} className="mb-2" />
                                            <p className="text-[7px] font-black text-slate-900 uppercase leading-tight">Audio de Respaldo</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-end pt-8 border-t-2 border-slate-100 bg-slate-50 -mx-12 px-12 pb-8 rounded-b-[2.5rem]">
                                    <div className="text-center w-72 space-y-3">
                                        <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-inner relative group">
                                            <div className="h-20 flex items-center justify-center">
                                                {form.firmaColaborador && <img src={form.firmaColaborador} className="max-h-full" alt="Firma Trabajador" />}
                                            </div>
                                            <div className="absolute top-2 right-2 opacity-10">
                                                <TowerControl size={40} className="text-blue-600" />
                                            </div>
                                        </div>
                                        <div className="border-t border-blue-700 pt-3 text-left pl-2">
                                            <p className="text-[11px] font-black uppercase tracking-tighter text-slate-900">{form.nombreTrabajador}</p>
                                            <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-tight italic">CERTIFICADO FIRMA ELECTRÓNICA SIMPLE</p>
                                            <p className="text-[7px] font-black text-rose-500 uppercase mt-1 tracking-[0.2em]">RUT: {form.rutTrabajador}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-3 max-w-[200px]">
                                        <div className="w-28 h-28 bg-white border-2 border-slate-100 flex flex-col items-center justify-center p-2 rounded-2xl shadow-lg relative group overflow-hidden">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`AST-CERT:${form.metadataFirma?.qrId}|USER:${form.rutTrabajador}|GPS:${form.gps}`)}`}
                                                alt="QR de Validación"
                                                className="w-full h-full object-contain mb-1"
                                            />
                                            <p className="text-[6px] font-black text-slate-900 uppercase text-center leading-[1.1]">VALIDACIÓN QR ID:<br /><span className="text-blue-600">{form.metadataFirma?.qrId}</span></p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[7px] font-black text-slate-900 uppercase">GPS AUTH: <span className="font-bold text-slate-400">{form.gps}</span></p>
                                            <p className="text-[7px] font-black text-slate-900 uppercase">DATETIME: <span className="font-bold text-slate-400 font-mono tracking-tighter">{new Date().toLocaleString()}</span></p>
                                            <p className="text-[8px] font-black text-emerald-600 uppercase italic mt-1 border-t border-emerald-100 pt-1">Doc. Certificado Centraliza-T</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-6">
                        {currentStep > 1 && (
                            <button type="button" onClick={() => setCurrentStep(p => p - 1)} className="flex-1 py-5 rounded-full border border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Anterior</button>
                        )}
                        {currentStep < 5 ? (
                            <button type="button" onClick={handleNext} className="flex-[2] py-5 rounded-full bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-xl hover:bg-blue-700 transition-all">
                                {currentStep === 4 ? 'Ver Vista Previa' : 'Siguiente Paso'}
                            </button>
                        ) : (
                            <button type="submit" disabled={saving || !canSubmit} className={`flex-[2] py-5 rounded-full text-white font-black text-[10px] uppercase tracking-[0.3em] shadow-xl transition-all flex items-center justify-center gap-4 ${saving || !canSubmit ? 'bg-slate-400 cursor-not-allowed opacity-50' : 'bg-blue-800 hover:scale-105 active:scale-95'}`}>
                                {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Emitir y Enviar Reporte</>}
                            </button>
                        )}
                    </div>
                </form>
            </div>
            {alert && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-slate-900 border border-slate-100 px-8 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest shadow-2xl animate-in slide-in-from-bottom-10 z-[100] border-b-4 border-blue-600">
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${alert.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {alert.type === 'error' ? <X size={16} /> : <Check size={16} />}
                        </div>
                        {alert.message}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrevASTForm;
