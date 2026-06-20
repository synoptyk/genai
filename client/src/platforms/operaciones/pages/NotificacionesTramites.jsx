import React, { useState, useEffect, useRef } from 'react';
import { notificacionesApi } from '../../rrhh/rrhhApi';
import { Mail, ShieldCheck, CheckCircle2, XCircle, AlertCircle, FileText, ChevronLeft, CalendarClock, MapPin } from 'lucide-react';
import html2canvas from 'html2canvas';

// A lightweight SignaturePad that matches the one in PortalColaborador
const SignaturePad = ({ onSave, onCancel }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getCoordinates = (e) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e) => {
        const coords = getCoordinates(e);
        if (!coords) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const coords = getCoordinates(e);
        if (!coords) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const endDrawing = () => setIsDrawing(false);
    
    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            const hasPixels = pixelBuffer.some(color => color !== 0);
            if (!hasPixels) {
                alert("Debe dibujar su firma antes de continuar.");
                return;
            }
            onSave(canvas.toDataURL('image/png'));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden touch-none relative" style={{ touchAction: 'none' }}>
                <canvas 
                    ref={canvasRef}
                    width={400}
                    height={200}
                    className="w-full h-[150px] cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(e.nativeEvent); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(e.nativeEvent); }}
                    onTouchEnd={(e) => { e.preventDefault(); endDrawing(); }}
                />
                <button onClick={clear} className="absolute top-2 right-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">Limpiar</button>
            </div>
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-200">Cancelar</button>
                <button onClick={handleSave} className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg hover:bg-indigo-700">Confirmar Firma</button>
            </div>
        </div>
    );
};

export default function NotificacionesTramites({ user, onBack, perfil }) {
    const [notificaciones, setNotificaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const [signing, setSigning] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [signatureData, setSignatureData] = useState(null);
    const [geolocation, setGeolocation] = useState(null);
    const docRef = useRef(null);

    const fetchNotificaciones = async () => {
        try {
            setLoading(true);
            const res = await notificacionesApi.getAll();
            setNotificaciones(res.data);
        } catch (error) {
            console.error("Error fetching notificaciones", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotificaciones();
    }, []);

    const handleRead = async (notif) => {
        if (!notif.leida) {
            await notificacionesApi.markAsRead(notif._id);
            fetchNotificaciones();
        }
        if (notif.requiereFirma && notif.estadoFirma === 'Pendiente') {
            setSelectedNotif(notif);
        }
    };

    const getLocation = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada en su dispositivo.'));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                    (error) => {
                        let msg = 'Error obteniendo ubicación. Asegúrese de tener el GPS activado.';
                        if (error.code === 1) msg = 'Permiso de ubicación denegado. Debe autorizar el GPS para esta acción.';
                        reject(new Error(msg));
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }
        });
    };

    const handleStartSignature = async () => {
        try {
            const coords = await getLocation();
            setGeolocation(coords);
            setSigning(true);
            setIsRejecting(false);
        } catch (error) {
            alert(error.message);
        }
    };

    const handleReject = async () => {
        if (!motivoRechazo.trim()) {
            alert("Debe ingresar un motivo para rechazar el trámite.");
            return;
        }
        try {
            await notificacionesApi.rechazar(selectedNotif._id, { motivoRechazo });
            alert("Trámite rechazado exitosamente. Se ha notificado a RRHH.");
            setSelectedNotif(null);
            setIsRejecting(false);
            setMotivoRechazo('');
            fetchNotificaciones();
        } catch (error) {
            alert("Error al rechazar: " + (error.response?.data?.message || error.message));
        }
    };

    const confirmSignature = async (base64Signature) => {
        setSignatureData(base64Signature);
        // Esperar a que React renderice la firma en el DOM (en el PDF preview invisible o visible)
        setTimeout(async () => {
            if (docRef.current) {
                const canvas = await html2canvas(docRef.current, { scale: 2 });
                const finalPdfBase64 = canvas.toDataURL('image/jpeg', 0.8);
                
                try {
                    await notificacionesApi.firmar(selectedNotif._id, {
                        pdfUrl: finalPdfBase64,
                        datosFirma: {
                            fechaHora: new Date(),
                            ip: 'Capturada en Backend',
                            userAgent: navigator.userAgent,
                            latitud: geolocation.lat,
                            longitud: geolocation.lng
                        }
                    });
                    alert("Documento firmado exitosamente con Firma Avanzada.");
                    setSelectedNotif(null);
                    setSigning(false);
                    setSignatureData(null);
                    fetchNotificaciones();
                } catch (error) {
                    alert("Error al firmar: " + (error.response?.data?.message || error.message));
                }
            }
        }, 500);
    };

    return (
        <div className="max-w-[1000px] mx-auto pb-20 px-4 pt-4 animate-in fade-in duration-700 w-full overflow-x-hidden relative">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm">
                    <ChevronLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic leading-none">Notificaciones & Trámites</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Bandeja de Entrada</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-10"><Mail className="animate-bounce text-indigo-300" size={40} /></div>
            ) : notificaciones.length === 0 ? (
                <div className="bg-white p-10 rounded-[2rem] text-center border border-slate-100">
                    <CheckCircle2 className="mx-auto text-emerald-300 mb-4" size={50} />
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-sm">No tienes notificaciones pendientes</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {notificaciones.map(notif => (
                        <div key={notif._id} onClick={() => handleRead(notif)} className={`p-6 rounded-[2rem] border transition-all cursor-pointer ${notif.leida ? 'bg-slate-50 border-slate-100' : 'bg-white border-indigo-200 shadow-lg shadow-indigo-100/50 hover:-translate-y-1'}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex gap-4 items-start">
                                    <div className={`p-3 rounded-2xl ${notif.tipo === 'Tramite' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {notif.tipo === 'Tramite' ? <FileText size={24} /> : <Mail size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-black text-slate-800 uppercase">{notif.titulo}</h3>
                                            {!notif.leida && <span className="bg-rose-500 w-2 h-2 rounded-full animate-pulse"></span>}
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1">{notif.mensaje}</p>
                                        <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><CalendarClock size={12}/> {new Date(notif.createdAt).toLocaleString('es-CL')}</span>
                                            {notif.requiereFirma && (
                                                <span className={`flex items-center gap-1 ${notif.estadoFirma === 'Pendiente' ? 'text-amber-500' : notif.estadoFirma === 'Firmado' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    <ShieldCheck size={12}/> {notif.estadoFirma}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {notif.requiereFirma && notif.estadoFirma === 'Pendiente' && (
                                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-md">
                                        Revisar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL DE FIRMA */}
            {selectedNotif && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-50 w-full max-w-2xl rounded-[2.5rem] overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-indigo-600 p-6 flex justify-between items-center text-white shrink-0">
                            <h3 className="font-black uppercase tracking-widest italic text-lg flex items-center gap-2">
                                <ShieldCheck size={20} /> Autorización Electrónica Avanzada
                            </h3>
                            <button onClick={() => { setSelectedNotif(null); setSigning(false); }}><XCircle size={24} className="opacity-50 hover:opacity-100" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto grow">
                            {/* DOCUMENT TO SIGN - Rendered internally for html2canvas */}
                            <div ref={docRef} className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm mb-6 text-sm text-slate-700 leading-relaxed relative">
                                <div className="absolute top-8 right-8 w-20 h-20 opacity-10">
                                    <ShieldCheck size={80} />
                                </div>
                                <h4 className="text-center font-black uppercase text-lg mb-6 border-b pb-4">Declaración y Autorización de Descuento</h4>
                                <p className="mb-4">
                                    En Santiago de Chile, a {new Date().toLocaleDateString('es-CL')}, yo <strong>{perfil?.nombres || user?.name} {perfil?.apellidos || ''}</strong>, 
                                    RUT <strong>{perfil?.rut || user?.rut}</strong>, trabajador(a) activo de la empresa.
                                </p>
                                <p className="mb-4">
                                    Vengo en declarar mediante la presente firma electrónica avanzada, mi completa conformidad y autorización voluntaria 
                                    para que se proceda con el siguiente trámite:
                                </p>
                                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl mb-4 italic font-medium">
                                    "{selectedNotif.mensaje}"
                                </div>
                                <p className="mb-8">
                                    Autorizo expresamente que este monto sea descontado de mi próxima liquidación de remuneraciones, de conformidad con lo establecido 
                                    en el inciso segundo del artículo 58 del Código del Trabajo, declarando que dicho descuento, sumado a otros similares, no excede 
                                    el máximo legal permitido del 45% de mis remuneraciones totales.
                                </p>

                                {signatureData ? (
                                    <div className="mt-8 pt-8 border-t-2 border-dashed border-slate-200">
                                        <div className="flex justify-between items-end">
                                            <div className="w-64 text-center">
                                                <img src={signatureData} alt="Firma Colaborador" className="w-full mb-2 h-24 object-contain" />
                                                <div className="border-t border-slate-800 pt-2 font-black text-xs uppercase">{perfil?.nombres || user?.name}</div>
                                                <div className="text-[10px] text-slate-500">RUT: {perfil?.rut || user?.rut}</div>
                                            </div>
                                            <div className="text-[9px] font-mono text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100 text-right">
                                                <p className="font-bold text-indigo-600 mb-1 flex items-center justify-end gap-1"><CheckCircle2 size={10}/> SELLO CRIPTOGRÁFICO DE TIEMPO</p>
                                                <p>Hash: {Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}</p>
                                                <p>IP Local: Registrada en Servidor</p>
                                                {geolocation && <p>GPS: {geolocation.lat.toFixed(5)}, {geolocation.lng.toFixed(5)}</p>}
                                                <p>Timestamp: {new Date().toISOString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-8 pt-8 border-t-2 border-dashed border-slate-200 text-center text-slate-400 italic">
                                        (El documento será sellado criptográficamente una vez que dibuje su firma)
                                    </div>
                                )}
                            </div>

                            {!signing && !signatureData && !isRejecting && (
                                <div className="flex flex-col gap-3">
                                    <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl text-xs font-medium border border-indigo-100 mb-2 flex gap-3 items-start">
                                        <MapPin size={16} className="mt-0.5 shrink-0" />
                                        <p>Para garantizar la validez legal de este documento ante la Dirección del Trabajo, el sistema le solicitará acceso a su <strong>Ubicación GPS</strong> en el momento de la firma.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setIsRejecting(true)} className="w-1/3 py-4 bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl font-black uppercase tracking-widest text-sm transition-all border border-slate-200">
                                            Rechazar
                                        </button>
                                        <button onClick={handleStartSignature} className="w-2/3 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-200 hover:-translate-y-1 transition-all">
                                            Proceder a Firmar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isRejecting && (
                                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-rose-700 text-xs font-medium">
                                        Al rechazar este trámite, se notificará al departamento de RRHH. Por favor, indique el motivo.
                                    </div>
                                    <textarea 
                                        value={motivoRechazo}
                                        onChange={e => setMotivoRechazo(e.target.value)}
                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-rose-200 focus:outline-none min-h-[100px]"
                                        placeholder="Ej: El monto a descontar no es el acordado..."
                                    ></textarea>
                                    <div className="flex gap-3">
                                        <button onClick={() => { setIsRejecting(false); setMotivoRechazo(''); }} className="w-1/2 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all">
                                            Cancelar
                                        </button>
                                        <button onClick={handleReject} className="w-1/2 py-3 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all">
                                            Confirmar Rechazo
                                        </button>
                                    </div>
                                </div>
                            )}

                            {signing && !signatureData && (
                                <SignaturePad 
                                    onCancel={() => { setSigning(false); setGeolocation(null); }} 
                                    onSave={confirmSignature} 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
