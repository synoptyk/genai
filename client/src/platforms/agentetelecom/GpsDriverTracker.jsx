import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config';
import {
  AlertTriangle, ArrowDown, ArrowUp, BatteryCharging, CheckCircle, CheckCircle2, Clock, Download,
  ExternalLink, Loader2, MapPin, Navigation, PackageCheck, Play, Plus, Route,
  Smartphone, Square, Wand2, XCircle
} from 'lucide-react';
import DireccionAutocomplete from './components/DireccionAutocomplete';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

const api = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });

const humanDuration = (minutes) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${mins}m`;
};

const buildGoogleMapsUrl = (stop) => {
  if (!stop) return '#';
  if (Number.isFinite(Number(stop.lat)) && Number.isFinite(Number(stop.lng))) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}&travelmode=driving`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.direccion || '')}`;
};

const buildWazeUrl = (stop) => {
  if (!stop || !Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) return '#';
  return `https://www.waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
};

const stopBadge = (status) => {
  switch (status) {
    case 'ENTREGADO': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'CERRADO': return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'EN_CURSO': return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    default: return 'bg-slate-700/40 text-slate-200 border-slate-600';
  }
};

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
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeAction, setRouteAction] = useState('');
  const [completionNote, setCompletionNote] = useState('');

  // ── Estado para modo "Crear mi ruta" del conductor ────────────────────
  const [driverView, setDriverView] = useState('route'); // 'route' | 'create'
  const [createForm, setCreateForm] = useState({
    nombreRuta: '',
    autoOptimize: true,
    stops: [{ tempId: 'd-0', direccion: '', clienteNombre: '', notas: '', codigoPostal: '', comuna: '', region: '', lat: '', lng: '' }],
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const loadDriverAndRoute = useCallback(async (silent = false) => {
    if (!silent) setRouteLoading(true);
    try {
      const res = await api.get(`/live/${token}/ruta-actual`);
      setDriver(res.data?.conductor || null);
      setActiveRoute(res.data?.route || null);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo validar el enlace GPS.');
    } finally {
      if (!silent) {
        setRouteLoading(false);
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && tracking) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tracking, acquireWakeLock]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setPwaInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    loadDriverAndRoute(false);
    const interval = setInterval(() => loadDriverAndRoute(true), 15000);
    return () => clearInterval(interval);
  }, [loadDriverAndRoute]);

  useEffect(() => () => {
    if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    releaseWakeLock();
  }, [releaseWakeLock]);

  const canTrack = useMemo(() => Boolean(driver?.gpsActivo), [driver]);
  const currentStop = activeRoute?.currentStop || null;
  const nextStops = useMemo(() => {
    if (!Array.isArray(activeRoute?.stops)) return [];
    const currentSequence = Number(currentStop?.sequence || 0);
    return activeRoute.stops.filter((stop) => Number(stop.sequence) > currentSequence).slice(0, 4);
  }, [activeRoute, currentStop]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setPwaInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowInstallGuide(true || isIOS());
    }
  };

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

    navigator.geolocation.getCurrentPosition(
      async (firstPos) => {
        setPosition(firstPos.coords);
        await sendPosition(firstPos.coords);
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
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
      },
      (err) => {
        setError(`Permiso GPS no concedido: ${err.message}`);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
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

  const handleStartRoute = async () => {
    setRouteAction('start');
    try {
      const res = await api.post(`/live/${token}/ruta-actual/iniciar`);
      setActiveRoute(res.data?.route || null);
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo iniciar la ruta.');
    } finally {
      setRouteAction('');
    }
  };

  const closeCurrentStop = async (status) => {
    if (!currentStop?._id) return;
    setRouteAction(status);
    try {
      const res = await api.patch(`/live/${token}/ruta-actual/stops/${currentStop._id}`, {
        status,
        completionNote,
      });
      setActiveRoute(res.data?.route || null);
      setCompletionNote('');
      setError('');
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cerrar la parada.');
    } finally {
      setRouteAction('');
    }
  };

  // ── Helpers para el modo “Crear mi ruta” ────────────────────────────
  const makeDriverStop = () => ({
    tempId: `d-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    direccion: '', clienteNombre: '', notas: '',
    codigoPostal: '', comuna: '', region: '', lat: '', lng: '',
  });

  const addDriverStop = () => {
    if (createForm.stops.length >= 20) return;
    setCreateForm((p) => ({ ...p, stops: [...p.stops, makeDriverStop()] }));
  };

  const removeDriverStop = (tempId) => {
    setCreateForm((p) => ({
      ...p,
      stops: p.stops.length <= 1 ? p.stops : p.stops.filter((s) => s.tempId !== tempId),
    }));
  };

  const moveDriverStop = (idx, delta) => {
    setCreateForm((p) => {
      const arr = [...p.stops];
      const newIdx = idx + delta;
      if (newIdx < 0 || newIdx >= arr.length) return p;
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return { ...p, stops: arr };
    });
  };

  const updateDriverStop = (tempId, key, value) => {
    setCreateForm((p) => ({
      ...p,
      stops: p.stops.map((s) => s.tempId === tempId ? { ...s, [key]: value } : s),
    }));
  };

  const updateDriverStopFromSuggestion = (tempId, sug) => {
    setCreateForm((p) => ({
      ...p,
      stops: p.stops.map((s) =>
        s.tempId === tempId
          ? {
              ...s,
              direccion: sug.display || sug.direccion || '',
              codigoPostal: sug.codigoPostal || '',
              comuna: sug.comuna || s.comuna,
              region: sug.region || s.region,
              lat: sug.lat ?? s.lat,
              lng: sug.lng ?? s.lng,
            }
          : s
      ),
    }));
  };

  const handleDriverCreateRoute = async () => {
    const validStops = createForm.stops.filter((s) => String(s.direccion || '').trim());
    if (validStops.length === 0) {
      setCreateError('Debes ingresar al menos una dirección.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const payload = {
        nombreRuta: createForm.nombreRuta.trim() || undefined,
        autoOptimize: createForm.autoOptimize,
        stops: validStops.map((s) => ({
          direccion: s.direccion,
          clienteNombre: s.clienteNombre,
          comuna: s.comuna,
          region: s.region,
          notas: s.notas,
          lat: s.lat || undefined,
          lng: s.lng || undefined,
        })),
      };
      const res = await api.post(`/live/${token}/mis-rutas`, payload);
      setActiveRoute(res.data?.route || null);
      setDriverView('route');
      setCreateForm({ nombreRuta: '', autoOptimize: true, stops: [makeDriverStop()] });
    } catch (e) {
      setCreateError(e.response?.data?.error || 'No se pudo crear la ruta.');
    } finally {
      setCreating(false);
    }
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
      <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2"><MapPin className="text-emerald-400" /> Conecta GPS</h1>
            <p className="text-slate-400 text-sm mt-1">GPS en vivo + ejecución guiada de entregas</p>
          </div>
          {routeLoading && <Loader2 size={18} className="animate-spin text-slate-400 mt-1" />}
        </div>

        {!pwaInstalled && (
          <button
            onClick={handleInstall}
            className="mt-4 w-full bg-indigo-600/20 border border-indigo-500/40 rounded-2xl px-4 py-3 flex items-center gap-3 text-left hover:bg-indigo-600/30 transition-colors"
          >
            <Smartphone size={22} className="text-indigo-300 shrink-0" />
            <div>
              <p className="text-indigo-200 font-bold text-sm">Instalar como app</p>
              <p className="text-indigo-300/70 text-[11px]">Mantén el GPS activo y abre la ruta del día sin depender del navegador.</p>
            </div>
            <Download size={16} className="text-indigo-300 ml-auto shrink-0" />
          </button>
        )}

        {pwaInstalled && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-emerald-300 text-sm font-semibold">
            <CheckCircle size={16} /> App instalada correctamente
          </div>
        )}

        {showInstallGuide && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-sm">
            <p className="text-amber-300 font-bold mb-2 flex items-center gap-2"><Smartphone size={15} /> Cómo instalar en iPhone / iPad</p>
            <ol className="text-amber-200/80 space-y-1 text-[12px] list-decimal list-inside">
              <li>Toca el botón Compartir en Safari</li>
              <li>Desliza y toca Añadir a pantalla de inicio</li>
              <li>Toca Añadir en la esquina superior derecha</li>
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
          {tracking && (
            <div className={`rounded-xl px-3 py-2 flex items-center gap-2 text-xs font-semibold border ${wakeLockActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
              <BatteryCharging size={14} />
              {wakeLockActive ? 'Pantalla activa para mantener el GPS en primer plano' : 'Wake Lock no disponible; mantén la pantalla encendida'}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-400 text-xs">Último envío</p>
              <p className="font-semibold flex items-center gap-2 mt-1">
                <Clock size={14} className="text-slate-400" />
                {lastSent ? lastSent.toLocaleTimeString() : 'Sin envíos aún'}
              </p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
              <p className="text-slate-400 text-xs">Posición actual</p>
              <p className="font-semibold mt-1">{position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : 'Sin posición'}</p>
              <p className="text-xs text-slate-400">Precisión: {position?.accuracy ? `${Math.round(position.accuracy)} m` : 'N/D'}</p>
            </div>
          </div>

          {sending && <p className="text-emerald-300 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Enviando ubicación...</p>}
          {!sending && tracking && <p className="text-emerald-300 text-xs flex items-center gap-1"><CheckCircle size={12} /> Rastreo activo</p>}
        </div>

        <div className="mt-6 border-t border-slate-700 pt-5 space-y-4">
          {/* ── Toggle de vista ────────────────────────── */}
          <div className="flex gap-1 p-1 bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setDriverView('route')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${driverView === 'route' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Route size={13} /> Ruta asignada
            </button>
            <button
              type="button"
              onClick={() => setDriverView('create')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${driverView === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Plus size={13} /> Crear mi ruta
            </button>
          </div>

          {/* ── Ruta asignada ────────────────────────── */}
          {driverView === 'route' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Ruta del día</p>
                  <p className="text-sm text-slate-500 mt-1">La plataforma te muestra una parada a la vez y avanza automáticamente cuando cierres la entrega.</p>
                </div>
                <button
                  onClick={() => loadDriverAndRoute(true)}
                  className="px-3 py-2 rounded-xl border border-slate-700 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Actualizar
                </button>
              </div>

              {!activeRoute && (
                <div className="bg-slate-800/60 border border-slate-700 rounded-2xl px-4 py-4 text-sm text-slate-300">
                  No tienes una ruta guiada asignada todavía. Cuando te asignen una, aparecerá aquí con la siguiente dirección y los botones de cierre.
                </div>
              )}

          {activeRoute && (
            <div className="space-y-4">
              <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white flex items-center gap-2"><Route size={18} className="text-indigo-300" /> {activeRoute.nombreRuta}</p>
                    <p className="text-xs text-slate-400 mt-1">{activeRoute.completedStops}/{activeRoute.totalStops} completadas · {activeRoute.totalDistanceKm || 0} km · {humanDuration(activeRoute.totalDurationMin)}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${stopBadge(activeRoute.estado === 'EN_CURSO' ? 'EN_CURSO' : activeRoute.estado === 'COMPLETADA' ? 'ENTREGADO' : 'PENDIENTE')}`}>
                    {String(activeRoute.estado || '').replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${activeRoute.progressPct || 0}%` }} />
                </div>

                {activeRoute.estado === 'PLANIFICADA' && (
                  <button
                    onClick={handleStartRoute}
                    disabled={routeAction === 'start'}
                    className="mt-4 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {routeAction === 'start' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {routeAction === 'start' ? 'Iniciando ruta...' : 'Iniciar ruta guiada'}
                  </button>
                )}
              </div>

              {currentStop && (
                <div className="bg-gradient-to-br from-indigo-500/15 to-slate-800/70 border border-indigo-500/30 rounded-3xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-widest text-indigo-300">Parada actual</p>
                      <p className="text-xl font-black text-white mt-1">#{currentStop.sequence} de {activeRoute.totalStops}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${stopBadge(currentStop.status)}`}>
                      {String(currentStop.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-lg font-semibold text-white">{currentStop.clienteNombre || 'Entrega programada'}</p>
                    <p className="text-sm text-slate-200">{currentStop.direccionNormalizada || currentStop.direccion}</p>
                    <p className="text-xs text-slate-400">{[currentStop.comuna, currentStop.region].filter(Boolean).join(' · ') || 'Sin comuna / región'}</p>
                    {currentStop.contactoNombre && (
                      <p className="text-xs text-slate-300">Contacto: {currentStop.contactoNombre} {currentStop.contactoTelefono ? `· ${currentStop.contactoTelefono}` : ''}</p>
                    )}
                    {currentStop.notas && <p className="text-xs text-slate-300">Nota: {currentStop.notas}</p>}
                    <p className="text-xs text-slate-400">ETA estimada desde salida: {humanDuration(currentStop.etaMin)}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <a
                      href={buildGoogleMapsUrl(currentStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-white text-slate-900 py-3 px-4 text-sm font-bold flex items-center justify-center gap-2"
                    >
                      <Navigation size={16} /> Abrir Google Maps
                    </a>
                    <a
                      href={buildWazeUrl(currentStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-600 text-white py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-800"
                    >
                      <ExternalLink size={16} /> Abrir Waze
                    </a>
                  </div>

                  {activeRoute.estado === 'EN_CURSO' && (
                    <>
                      <textarea
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                        rows={3}
                        className="mt-4 w-full rounded-2xl border border-slate-600 bg-slate-950/60 px-4 py-3 text-sm text-white resize-none"
                        placeholder="Notas de cierre: nombre de quien recibe, observación, incidencia, etc."
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        <button
                          onClick={() => closeCurrentStop('ENTREGADO')}
                          disabled={Boolean(routeAction)}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {routeAction === 'ENTREGADO' ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                          Marcar entregado
                        </button>
                        <button
                          onClick={() => closeCurrentStop('CERRADO')}
                          disabled={Boolean(routeAction)}
                          className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {routeAction === 'CERRADO' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                          Marcar cerrado
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!currentStop && activeRoute.estado === 'COMPLETADA' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-5 text-emerald-200">
                  <p className="text-lg font-black flex items-center gap-2"><CheckCircle2 size={18} /> Ruta completada</p>
                  <p className="text-sm mt-2">Todas las paradas fueron cerradas. Espera la siguiente asignación.</p>
                </div>
              )}

              {nextStops.length > 0 && (
                <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Próximas paradas</p>
                  <div className="mt-3 space-y-2">
                    {nextStops.map((stop) => (
                      <div key={stop._id} className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">#{stop.sequence} · {stop.clienteNombre || 'Entrega programada'}</p>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${stopBadge(stop.status)}`}>
                            {String(stop.status || '').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-2">{stop.direccionNormalizada || stop.direccion}</p>
                        <p className="text-[11px] text-slate-400 mt-1">ETA aprox. {humanDuration(stop.etaMin)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}

          {/* ── Crear mi ruta ────────────────────────── */}
          {driverView === 'create' && (
            <div className="space-y-4">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-red-200 text-sm flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {createError}
                </div>
              )}

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                <input
                  value={createForm.nombreRuta}
                  onChange={(e) => setCreateForm((p) => ({ ...p, nombreRuta: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Nombre de mi ruta (opcional)"
                />

                {/* Toggle auto-optimizar */}
                <div className="flex items-center justify-between gap-3 bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-sm font-bold text-white">{createForm.autoOptimize ? '⚡ Auto-optimizar orden' : '✋ Mi orden exacto'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {createForm.autoOptimize
                        ? 'La IA calcula la secuencia más eficiente entre tus paradas.'
                        : 'Ordena tú con las flechas ↑↓ y nosotros calculamos los tiempos.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, autoOptimize: !p.autoOptimize }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${createForm.autoOptimize ? 'bg-indigo-600' : 'bg-slate-600'}`}
                  >
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${createForm.autoOptimize ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              {/* Lista de paradas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Mis paradas ({createForm.stops.length})</p>
                  <button
                    type="button"
                    onClick={addDriverStop}
                    disabled={createForm.stops.length >= 20}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold hover:bg-indigo-600/50 disabled:opacity-40"
                  >
                    + Agregar parada
                  </button>
                </div>

                {createForm.stops.map((stop, idx) => (
                  <div key={stop.tempId} className="border border-slate-700 rounded-2xl p-3 space-y-2.5 bg-slate-800/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-indigo-400">Parada {idx + 1}</span>
                        {!createForm.autoOptimize && (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveDriverStop(idx, -1)}
                              className="p-1 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 transition-colors"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === createForm.stops.length - 1}
                              onClick={() => moveDriverStop(idx, 1)}
                              className="p-1 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 transition-colors"
                            >
                              <ArrowDown size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDriverStop(stop.tempId)}
                        disabled={createForm.stops.length <= 1}
                        className="text-[11px] text-rose-500 hover:text-rose-400 disabled:opacity-30"
                      >
                        Quitar
                      </button>
                    </div>

                    <DireccionAutocomplete
                      value={stop.direccion}
                      onChange={(text) => updateDriverStop(stop.tempId, 'direccion', text)}
                      onSelect={(sug) => updateDriverStopFromSuggestion(stop.tempId, sug)}
                      placeholder="Dirección de entrega..."
                      darkMode
                      currentPosition={position ? { lat: position.latitude, lng: position.longitude } : null}
                    />

                    <input
                      value={stop.clienteNombre}
                      onChange={(e) => updateDriverStop(stop.tempId, 'clienteNombre', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Cliente / referencia (opcional)"
                    />

                    {stop.codigoPostal && (
                      <p className="text-[11px] text-indigo-400 font-semibold flex items-center gap-1">
                        <MapPin size={10} /> CP {stop.codigoPostal}{stop.comuna ? ` · ${stop.comuna}` : ''}
                      </p>
                    )}

                    <input
                      value={stop.notas}
                      onChange={(e) => updateDriverStop(stop.tempId, 'notas', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Notas: piso, empresa, código de acceso, etc."
                    />
                  </div>
                ))}
              </div>

              {activeRoute && (
                <div className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  Si creas una nueva ruta, se cancelará la ruta actual asignada.
                </div>
              )}

              <button
                type="button"
                onClick={handleDriverCreateRoute}
                disabled={creating}
                className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
              >
                {creating
                  ? <><Loader2 size={16} className="animate-spin" /> Calculando ruta...</>
                  : <><Wand2 size={16} /> {createForm.autoOptimize ? 'Calcular ruta óptima' : 'Crear mi ruta'}</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GpsDriverTracker;
