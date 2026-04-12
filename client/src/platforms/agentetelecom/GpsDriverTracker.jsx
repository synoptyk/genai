import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import API_URL from '../../config';
import { MapPin, Play, Square, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const api = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });

const GpsDriverTracker = () => {
  const { token } = useParams();
  const watchRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [driver, setDriver] = useState(null);
  const [position, setPosition] = useState(null);
  const [lastSent, setLastSent] = useState(null);

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
    if (!navigator.geolocation) {
      setError('Este dispositivo no soporta geolocalización.');
      return;
    }
    if (!canTrack) {
      setError('GPS desactivado por tu empresa para este conductor.');
      return;
    }

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
  };

  const stopTracking = () => {
    if (watchRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
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
            <button onClick={startTracking} className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2" disabled={!canTrack}>
              <Play size={16} /> Iniciar GPS
            </button>
          ) : (
            <button onClick={stopTracking} className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl py-3 font-bold text-sm flex items-center justify-center gap-2">
              <Square size={16} /> Detener GPS
            </button>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
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
