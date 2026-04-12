import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config';
import { MapPin, Play, Square, Loader2, AlertTriangle, CheckCircle, Clock, Download, BatteryCharging, Smartphone } from 'lucide-react';

// Detectar iOS (Safari no soporta beforeinstallprompt → mostrar guía manual)
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const api = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });

const GpsDriverTracker = () => {
  const { token } = useParams();
  const watchRef = useRef(null);
  const wakeLockRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState(null);
  const [position, setPosition] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // ── Wake Lock ────────────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockActive(true);
      wakeLockRef.current.addEventListener('release', () => setWakeLockActive(false));
    } catch (_) {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  // Re-adquirir wake lock si la pantalla lo libera al volver al primer plano
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tracking) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tracking, acquireWakeLock]);

  // ── PWA install prompt (Android Chrome) ─────────────────────
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setPwaInstalled(true); setDeferredPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setPwaInstalled(true);
      setDeferredPrompt(null);
    } else if (isIOS()) {
      setShowInstallGuide(true);
    } else {
      setShowInstallGuide(true); // fallback para otros casos
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/live/${token}`);
        setDriver(res.data || null);
      } catch (e) {
        setError(e.response?.data?.error || 'No se pudo validar el enlace GPS.');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (watchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [token]);

  const canTrack = useMemo(() => Boolean(driver?.gpsActivo), [driver]);

  const sendPosition = async (coords) => {
    try {
      setSending(true);
      await api.post(`/live/${token}`, {
        lat: coords.latitude,
        lng: coords.longitude,
        velocidad: coords.speed ? coords.speed * 3.6 : 0,
        heading: typeof coords.heading === 'number' ? coords.heading : null,
        precision: coords.accuracy,
      });
      setLastSent(new Date());
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo enviar ubicación.');
    } finally {
      setSending(false);
    }
  };

  const startTracking = () => {
    setError('');

    if (!window.isSecureContext) {
      setError('La geolocalización requiere un enlace seguro (https).');
      return;
    }

    if (!navigator.geolocation) {
      setError('Este dispositivo no soporta geolocalización.');
      return;
    }
    if (!canTrack) {
      setError('GPS desactivado por tu empresa para este conductor.');
      return;
    }

    // Solicita permiso explícito al usuario antes de iniciar el watch continuo.
    navigator.geolocation.getCurrentPosition(
      async (firstPos) => {
        setPosition(firstPos.coords);
        await sendPosition(firstPos.coords);

        // Activar Wake Lock para mantener página viva con pantalla encendida
        await acquireWakeLock();

        setTracking(true);
        watchRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            setPosition(pos.coords);
            await sendPosition(pos.coords);
          },
          (err) => {
            setError(`Error GPS: ${err.message}`);
            setTracking(false);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 10000,
          }
        );
      },
      (err) => {
        setError(`Permiso GPS no concedido: ${err.message}`);
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  };

  const stopTracking = () => {
    if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    releaseWakeLock();
    setTracking(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center gap-3">
        <Loader2 className="animate-spin" /> Cargando enlace GPS...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white px-4 py-8">
      <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        <h1 className="text-2xl font-black flex items-center gap-2"><MapPin className="text-emerald-400" /> Conecta GPS</h1>
        <p className="text-slate-400 text-sm mt-1">Reporte de ubicación en tiempo real</p>

        {/* ── Banner instalar como app ─────────────────────────── */}
        {!pwaInstalled && (
          <button
            onClick={handleInstall}
            className="mt-4 w-full bg-indigo-600/20 border border-indigo-500/40 rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:bg-indigo-600/30 transition-colors"
          >
            <Smartphone size={22} className="text-indigo-300 shrink-0" />
            <div>
              <p className="text-indigo-200 font-bold text-sm">Instalar como app</p>
              <p className="text-indigo-300/70 text-[11px]">El GPS seguirá activo aunque minimices la pantalla</p>
            </div>
            <Download size={16} className="text-indigo-300 ml-auto shrink-0" />
          </button>
        )}

        {pwaInstalled && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-emerald-300 text-sm font-semibold">
            <CheckCircle size={16} /> App instalada correctamente
          </div>
        )}

        {/* ── Guía iOS manual ──────────────────────────────────── */}
        {showInstallGuide && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm">
            <p className="text-amber-300 font-bold mb-2 flex items-center gap-2"><Smartphone size={15} /> Cómo instalar en iPhone / iPad</p>
            <ol className="text-amber-200/80 space-y-1 text-[12px] list-decimal list-inside">
              <li>Toca el botón Compartir <span className="bg-amber-800/40 px-1 rounded">⎙</span> en Safari</li>
              <li>Desliza y toca <strong>"Añadir a pantalla de inicio"</strong></li>
              <li>Toca <strong>"Añadir"</strong> en la esquina superior derecha</li>
              <li>Abre la app desde tu pantalla de inicio</li>
            </ol>
            <button onClick={() => setShowInstallGuide(false)} className="mt-3 text-[11px] text-amber-400 underline">Cerrar</button>
          </div>
        )}

        {driver && (
          <div className="mt-4 bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
            <p className="text-sm font-bold">{driver.nombre || 'Conductor'}</p>
            <p className="text-xs text-slate-400">Vehículo: {driver.patente || 'Sin patente'}</p>
            <p className="text-xs mt-2">
              Estado GPS: {driver.gpsActivo ? <span className="text-emerald-400 font-bold">ACTIVO</span> : <span className="text-red-400 font-bold">DESACTIVADO</span>}
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-200 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5" /> {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {!tracking ? (
            <button onClick={startTracking} className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
              <Play size={16} /> Iniciar GPS
            </button>
          ) : (
            <button onClick={stopTracking} className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
              <Square size={16} /> Detener GPS
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          {/* Wake Lock status */}
          {tracking && (
            <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold border ${wakeLockActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
              <BatteryCharging size={14} />
              {wakeLockActive
                ? 'Pantalla activa — GPS enviando aunque minimices'
                : 'Wake Lock no disponible — mantén la pantalla encendida'}
            </div>
          )}

          {!tracking && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-[11px] text-slate-400">
              💡 <strong className="text-slate-300">Tip:</strong> Instala la app (botón arriba) y activa GPS. El rastreo continúa aunque pongas el teléfono en el bolsillo.
            </div>
          )}

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
            <p className="text-slate-400 text-xs">Último envío</p>
            <p className="font-semibold flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              {lastSent ? lastSent.toLocaleTimeString() : 'Sin envíos aún'}
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
            <p className="text-slate-400 text-xs">Posición actual</p>
            <p className="font-semibold">{position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : 'Sin posición'}</p>
            <p className="text-xs text-slate-400">Precisión: {position?.accuracy ? `${Math.round(position.accuracy)} m` : 'N/D'}</p>
          </div>

          {sending && <p className="text-emerald-300 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Enviando ubicación...</p>}
          {!sending && tracking && <p className="text-emerald-300 text-xs flex items-center gap-1"><CheckCircle size={12} /> Rastreo activo</p>}
        </div>
      </div>
    </div>
  );
};

export default GpsDriverTracker;
