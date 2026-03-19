import React, { useState, useEffect, useRef } from 'react';
import {
    Camera, MapPin, QrCode, ClipboardCheck,
    CheckCircle2, AlertTriangle, X, Save,
    Truck, User, Calendar, BarChart3,
    ChevronRight, ChevronLeft, Download, Share2,
    FileText, PenTool, Mail, Hash, Search, Loader2
} from 'lucide-react';
import api from '../../../api/api';
import { useAuth } from '../../auth/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatRut, validateRut } from '../../../utils/rutUtils';
import FirmaAvanzada from '../../../components/FirmaAvanzada';

const CheckListVehicular = ({ vehiculo, tecnico, tipoInicial = 'Inspección Rutinaria', onSave, onClose }) => {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [coords, setCoords] = useState(null);
    const [emailPersonal, setEmailPersonal] = useState('');
    const [qrCodeId, setQrCodeId] = useState('');
    const [firmaPayload, setFirmaPayload] = useState(null);
    const [firmaSupervisorPayload, setFirmaSupervisorPayload] = useState(null);
    const previewRef = useRef(null);

    // --- BÚSQUEDA DE TÉCNICO ---
    const [searching, setSearching] = useState(false);
    const [localTecnico, setLocalTecnico] = useState(tecnico || { nombre: '', rut: '', cargo: '', email: '' });

    const handleSearchTecnico = async (rut) => {
        const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
        if (cleanRut.length < 7) return;

        setSearching(true);
        try {
            const res = await api.get(`/api/tecnicos/rut/${cleanRut}`);
            if (res.data) {
                const tec = res.data;
                setLocalTecnico(tec);
                if (tec.email) setEmailPersonal(tec.email);

                // --- INTELIGENCIA ADICIONAL: Auto-completar datos de la ficha ---
                setChecklist(prev => ({
                    ...prev,
                    proyecto: tec.ceco || tec.proyecto || prev.proyecto,
                    vencimientoLicencia: tec.fechaVencimientoLicencia
                        ? new Date(tec.fechaVencimientoLicencia).toISOString().split('T')[0]
                        : prev.vencimientoLicencia
                }));
            }
        } catch (error) {
            console.error("Error buscando técnico:", error);
            // No alertamos para no interrumpir el flujo si es un RUT nuevo
        } finally {
            setSearching(false);
        }
    };

    // --- BÚSQUEDA DE VEHÍCULO (PATENTE) ---
    const [searchingVehiculo, setSearchingVehiculo] = useState(false);
    const [vehiculosFound, setVehiculosFound] = useState([]);
    const [showNewVehicleForm, setShowNewVehicleForm] = useState(false);
    const [localVehiculo, setLocalVehiculo] = useState(vehiculo || { patente: '', marca: '', modelo: '', anio: '' });

    const handleSearchVehiculo = async (pat) => {
        const cleanPat = pat.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (cleanPat.length < 3) {
            setVehiculosFound([]);
            return;
        }

        setSearchingVehiculo(true);
        try {
            const res = await api.get(`/api/vehiculos/search?q=${cleanPat}`);
            setVehiculosFound(res.data || []);

            // Si hay una coincidencia exacta, cargarla automáticamente
            const exactMatch = res.data.find(v => v.patente === cleanPat);
            if (exactMatch) {
                setLocalVehiculo(exactMatch);
                setShowNewVehicleForm(false);
            }
        } catch (error) {
            console.error("Error buscando vehículo:", error);
        } finally {
            setSearchingVehiculo(false);
        }
    };

    const handleCreateVehiculo = async () => {
        if (!localVehiculo.patente || !localVehiculo.marca || !localVehiculo.modelo) {
            alert("Por favor complete Patente, Marca y Modelo para registrar el vehículo.");
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/api/vehiculos', {
                patente: localVehiculo.patente,
                marca: localVehiculo.marca,
                modelo: localVehiculo.modelo,
                anio: localVehiculo.anio || new Date().getFullYear(),
                estadoOperativo: 'Operativa',
                estadoLogistico: 'En Patio'
            });
            setLocalVehiculo(res.data);
            setShowNewVehicleForm(false);
            alert("Vehículo registrado exitosamente en el módulo de Flota.");
        } catch (error) {
            console.error("Error creando vehículo:", error);
            alert(error.response?.data?.error || "Error al registrar el vehículo.");
        } finally {
            setLoading(false);
        }
    };

    const [checklist, setChecklist] = useState({
        proyecto: '',
        lugar: '',
        licenciaConducir: '',
        vencimientoLicencia: '',
        kmEntrega: '',
        kmDevolucion: '',

        // Exteriores
        lucesPrincipales: 'OK',
        lucesIntermitentes: 'OK',
        lucesReversa: 'OK',
        limpiaParabrisas: 'OK',
        espejoIzq: 'OK', espejoDer: 'OK', vidriosLaterales: 'OK', parabrisasDel: 'OK',
        parabrisasTras: 'OK', taponesLlantas: 'OK', tapaGasolina: 'OK', carroceria: 'OK',
        parachoquesDel: 'OK', parachoquesTras: 'OK', patentes: 'OK', calefaccion: 'OK', radio: 'OK',

        // Interiores / Motor / Seguridad
        pantalla: 'OK', bocina: 'OK', encendedor: 'OK', retrovisor: 'OK', cinturones: 'OK',
        pisosGoma: 'OK', jaladorPuertas: 'OK', sujetadorMano: 'OK', tarjetaCombustible: 'OK',
        docSoap: 'OK', docInspeccionTec: 'OK', docPadron: 'OK', docPolizaSeguro: 'OK',
        gata: 'OK', llaveRueda: 'OK', estucheLlave: 'OK', triangulo: 'OK',

        nivelAceite: 'OK',
        nivelRefrigerante: 'OK',
        nivelLiquidoFrenos: 'OK',
        estadoBateria: 'OK',
        chalecoReflectante: 'OK',

        // Accesorios
        llantaRepuesto: 'OK', extintor: 'OK', botiquin: 'OK', portaEscalas: 'OK',
        cajaSeguridad: 'OK', candadoBle: 'OK', chapaSeguridad: 'OK', llaveControl: 'OK',
        manualUso: 'OK', procedimientos: 'OK', correspondeContrato: 'OK', aseo: 'OK',
        estadoPintura: 'OK', estadoCarroceria: 'OK', branding: 'OK',

        combustible: '1/2',
        kilometraje: '',
        observaciones: '',
        detallesItems: {} // Para guardar notas por ítem: { lucesPrincipales: 'Foco roto' }
    });

    const [activeTab, setActiveTab] = useState('exteriores');
    const [photos, setPhotos] = useState({
        frontal: null,
        trasera: null,
        lateralIzq: null,
        lateralDer: null,
        tablero: null,
        adicionales: []
    });



    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("Error GPS:", err)
            );
        }
    }, []);

    const handlePhotoUpload = (e, target) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (target === 'adicionales') {
                    setPhotos(prev => ({ ...prev, adicionales: [...prev.adicionales, reader.result] }));
                } else {
                    setPhotos(prev => ({ ...prev, [target]: reader.result }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!firmaPayload?.imagenBase64) {
            alert('Se requiere la firma del colaborador / técnico.');
            return;
        }
        if (!firmaSupervisorPayload?.imagenBase64) {
            alert('Se requiere la firma del supervisor.');
            return;
        }
        setLoading(true);
        try {
            const vehiculoId = localVehiculo?._id;
            if (!vehiculoId) {
                console.error("❌ Error: ID de vehículo no encontrado.");
                alert("Error: Debe seleccionar o registrar un vehículo para continuar.");
                setLoading(false);
                return;
            }

            const payload = {
                tecnicoId: localTecnico?._id,
                checklist: checklist,
                coordenadas: coords,
                fotos: photos,
                emailPersonal: emailPersonal,
                firmaColaborador: firmaPayload?.imagenBase64 || null,
                firmaSupervisor: firmaSupervisorPayload?.imagenBase64 || null,
                tipo: tipoInicial
            };

            const response = await api.post(`/api/vehiculos/${vehiculoId}/checklist`, payload);

            setQrCodeId(response.data.qrCodeId);
            setStep(5); // Paso de Éxito / Compartir
            if (onSave) onSave();
        } catch (error) {
            console.error("Error guardando checklist:", error);
            alert('Error al guardar el checklist');
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        const element = previewRef.current;
        if (!element) return;
        setLoading(true);
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Checklist_${localVehiculo.patente}_${new Date().toLocaleDateString()}.pdf`);
        } catch (err) {
            console.error("PDF Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const OptionRow = ({ label, field, customOpts }) => {
        const opts = customOpts || ['OK', 'DETALLE', 'FALLA'];
        const isAnomaly = checklist[field] === 'DETALLE' || checklist[field] === 'FALLA' || checklist[field] === 'VENCIDO' || checklist[field] === 'FALTA' || checklist[field] === 'VENCIDA';

        return (
            <div className="space-y-3 p-4 bg-white/40 backdrop-blur-md rounded-[2rem] border border-white/20 hover:bg-white/60 transition-all group">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{label}</span>
                    <div className="flex gap-1.5">
                        {opts.map(opt => (
                            <button
                                key={opt}
                                onClick={() => setChecklist(prev => ({ ...prev, [field]: opt }))}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${checklist[field] === opt
                                    ? opt === 'OK' || opt === 'VIGENTE' || opt === 'LLENO' || opt === 'CARGADO' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                                        : opt === 'DETALLE' || opt === 'PROVISORIO' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                            : 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                                    : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                                    }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>

                {isAnomaly && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        <textarea
                            placeholder={`Describa el detalle o falla detectada en ${label.toLowerCase()}...`}
                            className="w-full p-4 bg-white/80 border-2 border-slate-100 rounded-2xl font-bold text-[11px] text-slate-700 outline-none focus:border-amber-400 transition-all resize-none h-20 shadow-inner"
                            value={checklist.detallesItems[field] || ''}
                            onChange={(e) => setChecklist(prev => ({
                                ...prev,
                                detallesItems: { ...prev.detallesItems, [field]: e.target.value }
                            }))}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[2000] flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <div className="bg-slate-50 w-full max-w-6xl h-full md:h-[90vh] md:rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20 relative">

                {/* DECORACIÓN FONDO */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />

                {/* HEADER PREMIUM */}
                <div className="p-8 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between z-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-blue-200 animate-pulse">
                            <ClipboardCheck size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic leading-none">Smart Checklist</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">v3.0 Advanced</span>
                                <div className="h-1 w-1 bg-slate-300 rounded-full" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Paso {step} de 5</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-4 bg-slate-100 text-slate-400 rounded-3xl hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
                        <X size={24} />
                    </button>
                </div>

                {/* AREA DE CONTENIDO */}
                <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 custom-scrollbar z-10 relative">

                    {/* PASO 1: IDENTIFICACIÓN INTELIGENTE */}
                    {step === 1 && (
                        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* BUSCADOR DE TÉCNICO POR RUT */}
                            <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 text-blue-600"><Search size={120} /></div>
                                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                    <div className="p-4 bg-blue-100 text-blue-600 rounded-[1.5rem]"><User size={32} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase italic">Identificación del Técnico</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Ingrese RUT para auto-completar ficha</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">RUT Colaborador</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="12.345.678-9"
                                                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                                value={localTecnico.rut}
                                                onChange={(e) => {
                                                    const val = formatRut(e.target.value);
                                                    setLocalTecnico(prev => ({ ...prev, rut: val }));
                                                    if (validateRut(val)) handleSearchTecnico(val);
                                                }}
                                            />
                                            {searching && <Loader2 className="absolute right-4 top-5 animate-spin text-blue-500" size={20} />}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Completo</label>
                                        <input
                                            type="text"
                                            readOnly={!!localTecnico._id}
                                            placeholder="Nombre del técnico..."
                                            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                            value={localTecnico.nombre || localTecnico.nombres || ''}
                                            onChange={(e) => setLocalTecnico(prev => ({ ...prev, nombre: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cargo</label>
                                        <input
                                            type="text"
                                            readOnly={!!localTecnico._id}
                                            placeholder="Cargo..."
                                            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all uppercase"
                                            value={localTecnico.cargo}
                                            onChange={(e) => setLocalTecnico(prev => ({ ...prev, cargo: e.target.value }))}
                                        />
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">
                                            <Mail size={14} className="inline mr-2" /> Correo de Notificación (Personal)
                                        </label>
                                        <input
                                            type="email"
                                            placeholder="usuario@ejemplo.com"
                                            className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-blue-500 transition-all"
                                            value={emailPersonal}
                                            onChange={(e) => setEmailPersonal(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BUSCADOR DE VEHÍCULO POR PATENTE */}
                            <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-600"><Truck size={120} /></div>
                                <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                                    <div className="p-4 bg-indigo-100 text-indigo-600 rounded-[1.5rem]"><Truck size={32} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase italic">Identificación del Vehículo</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Seleccione o registre la patente en Flota</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1 space-y-2 relative">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Patente</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="AAAA-00"
                                                className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                                                value={localVehiculo.patente}
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase();
                                                    setLocalVehiculo(prev => ({ ...prev, patente: val }));
                                                    handleSearchVehiculo(val);
                                                }}
                                            />
                                            {searchingVehiculo && <Loader2 className="absolute right-4 top-5 animate-spin text-indigo-500" size={20} />}
                                        </div>

                                        {/* Dropdown de Resultados */}
                                        {!showNewVehicleForm && vehiculosFound.length > 0 && (
                                            <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                {vehiculosFound.map(v => (
                                                    <button
                                                        key={v._id}
                                                        onClick={() => {
                                                            setLocalVehiculo(v);
                                                            setVehiculosFound([]);
                                                        }}
                                                        className="w-full p-4 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0"
                                                    >
                                                        <div>
                                                            <p className="text-sm font-black text-slate-800 uppercase">{v.patente}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{v.marca} {v.modelo}</p>
                                                        </div>
                                                        <ChevronRight size={16} className="text-slate-300" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Botón para nueva patente */}
                                        {localVehiculo.patente.length >= 6 && !showNewVehicleForm && !vehiculosFound.find(v => v.patente === localVehiculo.patente) && (
                                            <button
                                                onClick={() => setShowNewVehicleForm(true)}
                                                className="w-full mt-2 p-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Save size={14} /> Registrar como Nueva Patente
                                            </button>
                                        )}
                                    </div>

                                    {showNewVehicleForm && (
                                        <>
                                            <div className="space-y-2 animate-in zoom-in-95">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Marca</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Toyota..."
                                                    className="w-full p-5 bg-white border-2 border-indigo-100 rounded-2xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                                                    value={localVehiculo.marca}
                                                    onChange={(e) => setLocalVehiculo(prev => ({ ...prev, marca: e.target.value }))}
                                                />
                                            </div>
                                            <div className="space-y-2 animate-in zoom-in-95">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Modelo</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Hilux..."
                                                    className="w-full p-5 bg-white border-2 border-indigo-100 rounded-2xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                                                    value={localVehiculo.modelo}
                                                    onChange={(e) => setLocalVehiculo(prev => ({ ...prev, modelo: e.target.value }))}
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex justify-end gap-3 animate-in fade-in">
                                                <button onClick={() => setShowNewVehicleForm(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                                                <button
                                                    onClick={handleCreateVehiculo}
                                                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100"
                                                >
                                                    Confirmar y Guardar en Flota
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {!showNewVehicleForm && localVehiculo._id && (
                                        <div className="md:col-span-2 flex items-center gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in">
                                            <div className="p-3 bg-white rounded-xl shadow-sm"><Truck className="text-indigo-600" size={24} /></div>
                                            <div className="flex-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Datos Confirmados</p>
                                                <h4 className="text-lg font-black text-slate-800 uppercase mt-1 italic leading-none">{localVehiculo.marca} {localVehiculo.modelo} • {localVehiculo.anio || '2024'}</h4>
                                            </div>
                                            <button onClick={() => { setLocalVehiculo({ patente: '', marca: '', modelo: '', anio: '' }); setVehiculosFound([]); }} className="p-3 text-slate-300 hover:text-rose-500 transition-colors">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">
                                        <Hash size={14} /> Proyecto o Centro de Costo
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ingrese el proyecto..."
                                        className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-lg text-slate-800 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                                        value={checklist.proyecto}
                                        onChange={(e) => setChecklist(prev => ({ ...prev, proyecto: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">
                                        <MapPin size={14} /> Lugar de Inspección
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Base Santiago..."
                                        className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-lg text-slate-800 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                                        value={checklist.lugar}
                                        onChange={(e) => setChecklist(prev => ({ ...prev, lugar: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">
                                        <BarChart3 size={14} /> Kilometraje del Vehículo
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Ej: 45000"
                                        className="w-full p-6 bg-white border-2 border-slate-100 rounded-[2rem] font-black text-lg text-slate-800 outline-none focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5 transition-all shadow-sm"
                                        value={checklist.kilometraje}
                                        onChange={(e) => setChecklist(prev => ({ ...prev, kilometraje: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 2: INSPECCIÓN TÉCNICA 360° */}
                    {step === 2 && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex bg-slate-200/50 p-2 rounded-[2.5rem] gap-2 max-w-3xl mx-auto backdrop-blur-md border border-white/50 shadow-inner overflow-x-auto no-scrollbar">
                                {['exteriores', 'interiores', 'motor y seguridad', 'accesorios'].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-none px-8 py-4 rounded-[1.8rem] text-[11px] font-black uppercase tracking-[0.1em] transition-all duration-300 ${activeTab === tab ? 'bg-white text-blue-600 shadow-xl scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {activeTab === 'exteriores' && (
                                    <>
                                        <OptionRow label="Luces Principales" field="lucesPrincipales" />
                                        <OptionRow label="Luces Intermitentes / Warning" field="lucesIntermitentes" />
                                        <OptionRow label="Luces de Reversa" field="lucesReversa" />
                                        <OptionRow label="Sist. Limpia Parabrisas" field="limpiaParabrisas" />
                                        <OptionRow label="Espejos Laterales" field="espejoIzq" />
                                        <OptionRow label="Vidrios y Cristales" field="vidriosLaterales" />
                                        <OptionRow label="Estado Carrocería" field="carroceria" />
                                        <OptionRow label="Neumáticos y Llantas" field="taponesLlantas" />
                                        <OptionRow label="Tapa Combustible" field="tapaGasolina" />
                                        <OptionRow label="Parachoques" field="parachoquesDel" />
                                        <OptionRow label="Placas Patentes" field="patentes" />
                                    </>
                                )}
                                {activeTab === 'interiores' && (
                                    <>
                                        <OptionRow label="Pantalla / Dash" field="pantalla" />
                                        <OptionRow label="Bocina / Claxon" field="bocina" />
                                        <OptionRow label="Cinturones Seguridad" field="cinturones" />
                                        <OptionRow label="Sist. Calefacción/AC" field="calefaccion" />
                                        <OptionRow label="Pisos y Tapiz" field="pisosGoma" />
                                        <OptionRow label="Radio" field="radio" />
                                    </>
                                )}
                                {activeTab === 'motor y seguridad' && (
                                    <>
                                        <OptionRow label="Nivel de Aceite Motor" field="nivelAceite" customOpts={['NORMAL', 'BAJO', 'CRÍTICO']} />
                                        <OptionRow label="Líquido Refrigerante" field="nivelRefrigerante" customOpts={['NORMAL', 'BAJO', 'FALTA']} />
                                        <OptionRow label="Líquido de Frenos" field="nivelLiquidoFrenos" customOpts={['NORMAL', 'BAJO', 'FALTA']} />
                                        <OptionRow label="Estado de Batería" field="estadoBateria" customOpts={['OK', 'SULFATADA', 'DÉBIL']} />
                                        <OptionRow label="Chaleco Reflectante" field="chalecoReflectante" customOpts={['SÍ', 'NO', 'DAÑADO']} />
                                        <OptionRow label="Caja Seguridad" field="cajaSeguridad" />
                                    </>
                                )}
                                {activeTab === 'accesorios' && (
                                    <>
                                        <OptionRow label="Padrón Vehicular" field="docPadron" customOpts={['VIGENTE', 'PROVISORIO', 'VENCIDO']} />
                                        <OptionRow label="Permiso SOAP" field="docSoap" customOpts={['VIGENTE', 'FALTA']} />
                                        <OptionRow label="Rev. Técnica" field="docInspeccionTec" customOpts={['VIGENTE', 'VENCIDA']} />
                                        <OptionRow label="Extintor Incendio" field="extintor" customOpts={['CARGADO', 'VENCIDO', 'FALTA']} />
                                        <OptionRow label="Rueda Repuesto" field="llantaRepuesto" />
                                        <OptionRow label="Gata y Herramientas" field="gata" />
                                        <OptionRow label="Botiquín Prim. Aux" field="botiquin" />
                                    </>
                                )}
                            </div>

                            {(activeTab === 'exteriores' || activeTab === 'motor y seguridad') && (
                                <div className="max-w-2xl mx-auto p-10 bg-slate-900 rounded-[3.5rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                                    <Truck className="absolute -right-10 -bottom-10 opacity-10" size={240} />
                                    <div className="relative z-10 text-center">
                                        <label className="text-[12px] font-black uppercase tracking-[0.4em] opacity-60">Nivel de Combustible Actual</label>
                                        <div className="grid grid-cols-5 gap-3 mt-8">
                                            {['RESERVA', '1/4', '1/2', '3/4', 'LLENO'].map(nivel => (
                                                <button
                                                    key={nivel}
                                                    onClick={() => setChecklist({ ...checklist, combustible: nivel })}
                                                    className={`py-5 rounded-2xl text-[10px] font-black transition-all border-2 ${checklist.combustible === nivel ? 'bg-white text-slate-900 border-white shadow-xl shadow-white/10 scale-105' : 'bg-transparent border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                                >
                                                    {nivel}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3: REGISTRO FOTOGRÁFICO */}
                    {step === 3 && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {[
                                    { id: 'frontal', label: 'Estructura Frontal', icon: Truck },
                                    { id: 'trasera', label: 'Estructura Trasera', icon: Truck },
                                    { id: 'lateralIzq', label: 'Perfil Izquierdo', icon: Truck },
                                    { id: 'lateralDer', label: 'Perfil Derecho', icon: Truck },
                                    { id: 'tablero', label: 'Kilometraje / Dash', icon: BarChart3 }
                                ].map(quad => (
                                    <div key={quad.id} className="relative group perspective-1000">
                                        <label className={`block w-full h-56 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden relative shadow-sm ${photos[quad.id] ? 'border-emerald-500/50 bg-emerald-50' : 'border-slate-200 bg-white hover:border-blue-500/50 hover:bg-blue-50/50'}`}>
                                            <input type="file" className="hidden" accept="image/*" capture="camera" onChange={(e) => handlePhotoUpload(e, quad.id)} />
                                            {photos[quad.id] ? (
                                                <div className="relative w-full h-full">
                                                    <img src={photos[quad.id]} alt={quad.label} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <Camera className="text-white" size={32} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center p-8">
                                                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                                                        <Camera size={28} />
                                                    </div>
                                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{quad.label}</span>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 italic">Click para capturar</p>
                                                </div>
                                            )}
                                        </label>
                                        {photos[quad.id] && (
                                            <button onClick={() => setPhotos(prev => ({ ...prev, [quad.id]: null }))} className="absolute -top-3 -right-3 p-3 bg-white text-rose-500 border border-rose-100 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all">
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="max-w-3xl mx-auto p-10 bg-white border-2 border-slate-100 rounded-[3rem] space-y-4 shadow-sm">
                                <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4 italic">
                                    <FileText size={16} /> Observaciones Críticas del Supervisor
                                </label>
                                <textarea
                                    className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-bold text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none h-40 shadow-inner"
                                    placeholder="Describa cualquier daño, faltante o anomalía detectada en el vehículo..."
                                    value={checklist.observaciones}
                                    onChange={(e) => setChecklist(prev => ({ ...prev, observaciones: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}

                    {/* PASO 4: VISTA PREVIA Y FIRMA AVANZADA */}
                    {step === 4 && (
                        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

                            {/* DOCUMENTO DE VISTA PREVIA */}
                            <div ref={previewRef} className="bg-white p-12 md:p-16 rounded-[4rem] shadow-2xl border-t-[1rem] border-blue-600 max-w-4xl mx-auto space-y-12 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
                                    <Truck size={200} />
                                </div>

                                <div className="flex justify-between items-start border-b border-slate-100 pb-10">
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Acta de Inspección</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Sincronización Gen AI · Platform</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-900 uppercase">Patente Registro</p>
                                        <p className="text-2xl font-mono font-black text-blue-600 uppercase tracking-wider">{localVehiculo.patente}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Técnico</p>
                                        <p className="text-sm font-black text-slate-800 uppercase mt-1">{localTecnico.nombre || localTecnico.nombres || 'No especificado'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Supervisor</p>
                                        <p className="text-sm font-black text-slate-800 uppercase mt-1">{user?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Proyecto</p>
                                        <p className="text-sm font-black text-slate-800 uppercase mt-1">{checklist.proyecto || 'General'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase italic">Fecha Certificada</p>
                                        <p className="text-sm font-black text-slate-800 uppercase mt-1">{new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* RESUMEN RAPIDO */}
                                <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm"><BarChart3 size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Kilometraje</p>
                                            <p className="text-xl font-black text-slate-800">{checklist.kilometraje} KM</p>
                                        </div>
                                    </div>
                                    <div className="h-12 w-[1px] bg-slate-200" />
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm"><Truck size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Combustible</p>
                                            <p className="text-xl font-black text-slate-800">{checklist.combustible}</p>
                                        </div>
                                    </div>
                                    <div className="h-12 w-[1px] bg-slate-200" />
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm"><CheckCircle2 size={24} /></div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Resultado</p>
                                            <p className="text-xl font-black text-slate-800 uppercase italic">
                                                {Object.values(checklist).some(v => v === 'FALLA' || v === 'DETALLE') ? 'Observado' : 'Conforme'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* LISTADO DE OBSERVACIONES Y DETALLES */}
                                {Object.keys(checklist.detallesItems).length > 0 && (
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-2">
                                            <AlertTriangle size={14} className="text-amber-500" /> Hallazgos y Observaciones Detalladas
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3">
                                            {Object.entries(checklist.detallesItems).map(([key, value]) => value && (
                                                <div key={key} className="p-5 bg-amber-50/50 border border-amber-100 rounded-3xl flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-tight italic">
                                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-600 italic">"{value}"</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* FIRMAS — COLABORADOR Y SUPERVISOR */}
                            <div className="max-w-2xl mx-auto py-8 space-y-8">
                                {/* Firma Colaborador */}
                                <div className="space-y-3">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] pl-1">1. Firma del Colaborador / Técnico</p>
                                    <FirmaAvanzada
                                        label="Firma del Colaborador — Certificación Vehicular"
                                        rutFirmante={localTecnico.rut}
                                        nombreFirmante={localTecnico.nombre || localTecnico.nombres}
                                        emailFirmante={localTecnico.email}
                                        onSave={(payload) => setFirmaPayload(payload)}
                                        colorAccent="slate"
                                    />
                                    {firmaPayload?.imagenBase64 && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                            <span className="text-[10px] font-black text-emerald-700 uppercase">Colaborador firmó</span>
                                        </div>
                                    )}
                                </div>

                                {/* Firma Supervisor */}
                                <div className="space-y-3 pt-6 border-t border-slate-100">
                                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.3em] pl-1">2. Firma del Supervisor</p>
                                    <FirmaAvanzada
                                        label="Firma del Supervisor — Validación y Conformidad"
                                        rutFirmante={user?.rut}
                                        nombreFirmante={user?.name}
                                        emailFirmante={user?.email}
                                        onSave={(payload) => setFirmaSupervisorPayload(payload)}
                                        colorAccent="blue"
                                    />
                                    {firmaSupervisorPayload?.imagenBase64 && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                            <span className="text-[10px] font-black text-emerald-700 uppercase">Supervisor firmó</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PASO 5: EXITO / COMPARTIR */}
                    {step === 5 && (
                        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto space-y-12 animate-in zoom-in-95 duration-700">
                            <div className="relative">
                                <div className="w-48 h-48 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 animate-bounce transition-all">
                                    <CheckCircle2 size={80} className="text-white" />
                                </div>
                                <div className="absolute -top-4 -right-4 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-emerald-50 border-emerald-500 text-emerald-600 animate-pulse font-black italic">
                                    OK
                                </div>
                            </div>

                            <div className="text-center space-y-4">
                                <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">¡Registro Exitoso!</h2>
                                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest max-w-md mx-auto">
                                    La inspección ha sido procesada, firmada y almacenada en el historial de la flota. Se han enviado las notificaciones correspondientes.
                                </p>
                            </div>

                            {/* CERTIFICADO DIGITAL */}
                            <div className="w-full p-10 bg-white rounded-[4rem] shadow-2xl border-2 border-emerald-100 flex items-center gap-10">
                                <div className="p-6 bg-slate-900 rounded-[2.5rem] shadow-xl">
                                    <QRCodeSVG value={qrCodeId} size={120} hlevel="H" fgColor="#FFFFFF" bgColor="#0f172a" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validación Certificada</p>
                                    <p className="text-2xl font-black text-slate-900 font-mono tracking-widest uppercase">{qrCodeId}</p>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase italic">Escanea para verificar autenticidad</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 w-full gap-4">
                                <button
                                    onClick={downloadPDF}
                                    className="flex items-center justify-center gap-3 p-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:scale-[1.02] transition-all"
                                >
                                    <Download size={20} /> Descargar PDF
                                </button>
                                <button
                                    className="flex items-center justify-center gap-3 p-6 bg-blue-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:scale-[1.02] transition-all"
                                >
                                    <Share2 size={20} /> Compartir Registro
                                </button>
                            </div>

                            <button
                                onClick={onClose}
                                className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 transition-colors py-4"
                            >
                                Volver al Portal de Supervisión
                            </button>
                        </div>
                    )}

                </div>

                {/* FOOTER NAVEGACION (OCULTO EN PASO FINAL) */}
                {step < 5 && (
                    <div className="p-8 bg-white/80 backdrop-blur-md border-t border-slate-100 flex gap-4 md:px-12 z-10">
                        {step > 1 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="p-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-slate-200 flex items-center gap-2 group"
                            >
                                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Atrás
                            </button>
                        )}

                        {step < 4 ? (
                            <button
                                onClick={() => setStep(step + 1)}
                                className="flex-1 p-6 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 transition-all hover:scale-[1.02] hover:bg-blue-600 flex items-center justify-center gap-2 group"
                            >
                                Siguiente Paso <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex-1 p-6 bg-emerald-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-200 transition-all hover:scale-[1.02] flex items-center justify-center gap-3 group"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-3 italic"><BarChart3 className="animate-spin" size={20} /> Procesando Certificado...</span>
                                ) : (
                                    <><PenTool size={20} /> Finalizar & Firmar Digitalmente</>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckListVehicular;
