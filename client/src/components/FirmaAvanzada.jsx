/**
 * FirmaAvanzada.jsx
 * Componente universal de Firma Electrónica Avanzada para toda la plataforma.
 * Incluye: canvas, QR de verificación, coordenadas GPS, RUT, correo, timestamp y sellos legales.
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, MapPin, ShieldCheck, Clock, User, Mail, Hash, AlertTriangle, PenTool } from 'lucide-react';
import { useAuth } from '../platforms/auth/AuthContext';

/**
 * Props:
 *  - label: string  — texto del encabezado del pad
 *  - rutFirmante: string  — RUT del firmante (auto desde user si no se pasa)
 *  - nombreFirmante: string  — nombre completo del firmante
 *  - emailFirmante: string  — email del firmante para sello
 *  - onSave: (payload: FirmaPayload) => void — callback con todos los datos de la firma
 *  - disabled: bool — bloquea el pad
 *  - colorAccent: string — clase de color Tailwind para el borde activo (default: 'blue')
 */
const FirmaAvanzada = forwardRef(({
    label = 'Firma Electrónica Avanzada',
    rutFirmante,
    nombreFirmante,
    emailFirmante,
    onSave,
    disabled = false,
    colorAccent = 'blue'
}, ref) => {
    const { user } = useAuth();
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasFirma, setHasFirma] = useState(false);
    const [coords, setCoords] = useState(null);
    const [coordsError, setCoordsError] = useState(false);
    const [firmaId] = useState(() => `FA-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`);
    const [timestamp] = useState(() => new Date().toISOString());

    // Resolver datos del firmante
    const rut = rutFirmante || user?.rut || 'No especificado';
    const nombre = nombreFirmante || user?.name || 'No especificado';
    const email = emailFirmante || user?.email || 'No especificado';
    const fechaFormateada = new Date(timestamp).toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // QR URL de verificación
    const qrData = `${window.location.origin}/verificar?id=${firmaId}&rut=${rut}&ts=${timestamp}`;

    // GPS
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCoords({
                    lat: pos.coords.latitude.toFixed(6),
                    lng: pos.coords.longitude.toFixed(6),
                    accuracy: Math.round(pos.coords.accuracy)
                }),
                () => setCoordsError(true),
                { timeout: 8000, maximumAge: 60000 }
            );
        } else {
            setCoordsError(true);
        }
    }, []);

    // Canvas setup
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const imageData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = rect.width * window.devicePixelRatio;
            canvas.height = rect.height * window.devicePixelRatio;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            try { ctx.putImageData(imageData, 0, 0); } catch (_) {}
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    useImperativeHandle(ref, () => ({
        clear: () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setHasFirma(false);
            if (onSave) onSave(null);
        },
        getData: () => buildPayload()
    }));

    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches[0]) {
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top
            };
        }
        return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    };

    const startDrawing = (e) => {
        if (disabled) return;
        e.preventDefault();
        const { offsetX, offsetY } = getCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing || disabled) return;
        e.preventDefault();
        const { offsetX, offsetY } = getCoords(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const buildPayload = () => ({
        imagenBase64: canvasRef.current?.toDataURL('image/png'),
        firmaId,
        timestamp,
        rut,
        nombre,
        email,
        coordenadas: coords,
        qrVerificacion: qrData
    });

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        setHasFirma(true);
        if (onSave) onSave(buildPayload());
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasFirma(false);
        if (onSave) onSave(null);
    };

    return (
        <div className="space-y-4 w-full">
            {/* HEADER */}
            <div className="flex items-center gap-3">
                <div className={`p-2 bg-${colorAccent}-100 text-${colorAccent}-600 rounded-xl`}>
                    <PenTool size={18} />
                </div>
                <div>
                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{label}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase italic">Firma Electrónica Avanzada · Ley 19.799</p>
                </div>
                {hasFirma && (
                    <div className="ml-auto flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1.5 rounded-full">
                        <ShieldCheck size={12} />
                        <span className="text-[9px] font-black uppercase">Firmado</span>
                    </div>
                )}
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
                {/* METADATA BAR */}
                <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-1.5">
                        <Hash size={11} className="text-slate-400 flex-shrink-0" />
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">RUT Firmante</p>
                            <p className="text-[10px] font-black text-slate-700 font-mono">{rut}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <User size={11} className="text-slate-400 flex-shrink-0" />
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Nombre</p>
                            <p className="text-[10px] font-black text-slate-700 truncate max-w-[100px]">{nombre}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Mail size={11} className="text-slate-400 flex-shrink-0" />
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Correo</p>
                            <p className="text-[10px] font-black text-slate-700 truncate max-w-[120px]">{email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={11} className="text-slate-400 flex-shrink-0" />
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Fecha / Hora</p>
                            <p className="text-[10px] font-black text-slate-700 font-mono">{fechaFormateada}</p>
                        </div>
                    </div>
                </div>

                {/* GPS BAR */}
                <div className={`px-5 py-2 flex items-center gap-2 border-b border-slate-100 ${coords ? 'bg-emerald-50' : coordsError ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <MapPin size={11} className={coords ? 'text-emerald-600' : 'text-amber-500'} />
                    {coords ? (
                        <p className="text-[9px] font-black text-emerald-700 font-mono uppercase">
                            GPS VERIFICADO · Lat: {coords.lat} · Lng: {coords.lng} · Precisión: ±{coords.accuracy}m
                        </p>
                    ) : coordsError ? (
                        <div className="flex items-center gap-1.5">
                            <AlertTriangle size={11} className="text-amber-500" />
                            <p className="text-[9px] font-black text-amber-600 uppercase">GPS no disponible — se registra sin coordenadas</p>
                        </div>
                    ) : (
                        <p className="text-[9px] font-bold text-slate-400 uppercase animate-pulse">Obteniendo coordenadas GPS...</p>
                    )}
                </div>

                {/* CANVAS */}
                <div className="relative touch-none" style={{ height: 160 }}>
                    <canvas
                        ref={canvasRef}
                        className={`w-full h-full cursor-crosshair block ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
                        style={{ height: 160 }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                    />
                    {!hasFirma && !disabled && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2 opacity-30">
                            <PenTool size={32} className="text-slate-400" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firme aquí</p>
                        </div>
                    )}
                    {hasFirma && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute top-2 right-2 p-2 bg-white shadow-md rounded-xl text-slate-400 hover:text-rose-500 transition-all border border-slate-100"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* FOOTER LEGAL + QR */}
                <div className="bg-slate-900 px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-blue-400" />
                            <p className="text-[9px] font-black text-white uppercase tracking-widest">Firma Electrónica Avanzada</p>
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase leading-tight">
                            Amparada por Ley N.º 19.799 sobre Documentos Electrónicos.<br />
                            ID de verificación: <span className="text-blue-400 font-mono">{firmaId}</span>
                        </p>
                        <p className="text-[8px] font-mono text-slate-500 mt-1 hidden md:block truncate">{qrData}</p>
                    </div>
                    <div className="flex-shrink-0 bg-white p-2 rounded-xl shadow-lg">
                        <QRCodeSVG
                            value={qrData}
                            size={64}
                            level="M"
                            includeMargin={false}
                        />
                        <p className="text-[7px] font-black text-slate-500 uppercase text-center mt-1 tracking-widest">Verificar QR</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

FirmaAvanzada.displayName = 'FirmaAvanzada';
export default FirmaAvanzada;
