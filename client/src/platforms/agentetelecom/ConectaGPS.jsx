import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../auth/AuthContext';
import {
  MapPin, Navigation, Truck, Users, Wifi, WifiOff, AlertTriangle,
  Search, Filter, RefreshCw, Loader2, Activity, Clock, Gauge,
  Shield, Eye, Route, Phone, Battery, Signal, ChevronRight,
  ChevronDown, X, Zap, Globe, Satellite, Map, BarChart3,
  TrendingUp, CheckCircle, XCircle, Crosshair
} from 'lucide-react';

// ─── ESTILOS GLOBALES ───────────────────────────────────────────────────────
const gpsStyles = `
  @keyframes gps-pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes gps-pulse-alert {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.6); opacity: 0.4; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  @keyframes float-badge {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-3px); }
  }
  .driver-pulse {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.45);
    animation: gps-pulse 2.2s infinite ease-out;
    z-index: -1;
  }
  .driver-pulse-alert {
    background: rgba(239, 68, 68, 0.45);
    animation: gps-pulse-alert 1.4s infinite ease-out;
  }
  .driver-pulse-idle {
    background: rgba(148, 163, 184, 0.4);
    animation: gps-pulse 4s infinite ease-out;
  }
  .driver-pulse-stopped {
    background: rgba(245, 158, 11, 0.4);
    animation: gps-pulse 3s infinite ease-out;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 20px !important;
    padding: 0 !important;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.2) !important;
    border: 1px solid rgba(226,232,240,0.7);
    background: rgba(255,255,255,0.97) !important;
    backdrop-filter: blur(12px);
  }
  .leaflet-popup-content { margin: 0 !important; width: 300px !important; }
  .leaflet-popup-tip { background: rgba(255,255,255,0.97) !important; }
  .leaflet-container { font-family: 'Inter', sans-serif; }
  .custom-scrollbar-gps::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar-gps::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar-gps::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
`;

// ─── CONFIGURACIÓN DE ICONOS LEAFLET ───────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const STATUS_CONFIG = {
  moving:  { color: '#10b981', label: 'En ruta',   pulse: '',                   bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-500' },
  stopped: { color: '#f59e0b', label: 'Detenido',  pulse: 'driver-pulse-stopped', bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-500'   },
  idle:    { color: '#94a3b8', label: 'Sin señal', pulse: 'driver-pulse-idle',   bg: 'bg-slate-50',   text: 'text-slate-500',   badge: 'bg-slate-400'   },
  alert:   { color: '#ef4444', label: 'Alerta',    pulse: 'driver-pulse-alert',  bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-500'     },
};

// ─── GENERADOR DE ICONOS DINÁMICOS ─────────────────────────────────────────
const createDriverIcon = (status, initials) => {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const pulse = s.pulse || 'driver-pulse';
  return L.divIcon({
    className: 'custom-driver-marker',
    html: `
      <div style="position:relative;width:44px;height:44px;cursor:pointer;">
        <div class="${pulse}" style="position:absolute;width:100%;height:100%;border-radius:50%;z-index:0;"></div>
        <div style="
          position:absolute;inset:0;border-radius:50%;
          background:${s.color};border:3px solid white;
          box-shadow:0 4px 14px rgba(0,0,0,0.25);
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:900;color:white;font-family:Inter,sans-serif;
          z-index:2;
        ">${initials}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -48]
  });
};

// ─── DATOS MOCK (reemplazables con API real) ────────────────────────────────
const generateMockDrivers = (empresaId) => [
  { id: 1, empresa_id: empresaId, nombre: 'Carlos Méndez', telefono: '+56 9 8765 4321', vehiculo: 'Camión Ruta Norte', patente: 'BXKZ-91', lat: -33.4489, lng: -70.6693, velocidad: 62, bateria: 87, signal: 4, status: 'moving',  ultimoReporte: new Date(), ruta: 'Ruta Alameda → R-5', kmHoy: 142, historial: [[-33.4589,-70.6793],[-33.4540,-70.6750],[-33.4489,-70.6693]] },
  { id: 2, empresa_id: empresaId, nombre: 'Ana Torres',    telefono: '+56 9 7654 3210', vehiculo: 'Furgón Distribución', patente: 'GCMR-44', lat: -33.4689, lng: -70.6400, velocidad: 0,  bateria: 45, signal: 3, status: 'stopped', ultimoReporte: new Date(Date.now()-300000), ruta: 'Ruta Las Condes', kmHoy: 78,  historial: [[-33.4789,-70.6500],[-33.4740,-70.6450],[-33.4689,-70.6400]] },
  { id: 3, empresa_id: empresaId, nombre: 'Jorge Alvarado',telefono: '+56 9 6543 2109', vehiculo: 'Moto Mensajería',   patente: 'FJRP-23', lat: -33.4289, lng: -70.6893, velocidad: 38, bateria: 92, signal: 5, status: 'moving',  ultimoReporte: new Date(), ruta: 'Ruta Providencia', kmHoy: 215, historial: [[-33.4389,-70.6993],[-33.4350,-70.6950],[-33.4289,-70.6893]] },
  { id: 4, empresa_id: empresaId, nombre: 'María Soto',   telefono: '+56 9 5432 1098', vehiculo: 'Van 3/4',           patente: 'DLKS-77', lat: -33.4950, lng: -70.7100, velocidad: 0,  bateria: 12, signal: 1, status: 'alert',   ultimoReporte: new Date(Date.now()-900000), ruta: 'Ruta Sur — ¡BATERÍA CRÍTICA!', kmHoy: 54,  historial: [[-33.5050,-70.7200],[-33.5000,-70.7150],[-33.4950,-70.7100]] },
  { id: 5, empresa_id: empresaId, nombre: 'Pedro Rojas',  telefono: '+56 9 4321 0987', vehiculo: 'Camioneta 4x4',    patente: 'EMTW-56', lat: -33.3989, lng: -70.5893, velocidad: 88, bateria: 71, signal: 4, status: 'moving',  ultimoReporte: new Date(), ruta: 'Autopista Central', kmHoy: 310, historial: [[-33.4089,-70.5993],[-33.4050,-70.5950],[-33.3989,-70.5893]] },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────
const getInitials = (name) => name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
const formatTime = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff/60)}m`;
  return `hace ${Math.floor(diff/3600)}h`;
};
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ─── MAP CONTROLLER ─────────────────────────────────────────────────────────
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || map.getZoom(), { duration: 1.2, easeLinearity: 0.3 });
  }, [center, zoom, map]);
  return null;
};

// ─── TILE LAYERS ─────────────────────────────────────────────────────────────
const TILES = {
  light:     { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',    attribution: '© CartoDB' },
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',               attribution: '© CartoDB' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '© Esri' },
  terrain:   { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                             attribution: '© OpenTopoMap' },
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
const ConectaGPS = () => {
  const { user } = useAuth();
  const empresaId = user?.empresa_id || user?.empresaId || 'default';

  const [drivers, setDrivers]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState(null);
  const [mapType, setMapType]           = useState('dark');
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showRoute, setShowRoute]       = useState(true);
  const [showGeofence, setShowGeofence] = useState(false);
  const [panelOpen, setPanelOpen]       = useState(true);
  const [viewState, setViewState]       = useState({ center: [-33.4489, -70.6693], zoom: 11 });
  const [lastUpdate, setLastUpdate]     = useState(new Date());
  const [syncing, setSyncing]           = useState(false);
  const intervalRef = useRef(null);

  // ── Fetch / Simulación ──────────────────────────────────────────────────
  const loadDrivers = useCallback(() => {
    // Simula movimiento real incrementando posiciones levemente
    setDrivers(prev => {
      if (prev.length === 0) return generateMockDrivers(empresaId);
      return prev.map(d => {
        if (d.status !== 'moving') return d;
        const newLat = d.lat + (Math.random() - 0.5) * 0.001;
        const newLng = d.lng + (Math.random() - 0.5) * 0.001;
        return {
          ...d,
          lat: newLat, lng: newLng,
          velocidad: Math.max(0, d.velocidad + Math.floor((Math.random()-0.4)*8)),
          ultimoReporte: new Date(),
          historial: [...d.historial.slice(-8), [newLat, newLng]],
          kmHoy: d.kmHoy + haversineKm(d.lat, d.lng, newLat, newLng),
        };
      });
    });
    setLastUpdate(new Date());
    setLoading(false);
  }, [empresaId]);

  useEffect(() => {
    loadDrivers();
    intervalRef.current = setInterval(loadDrivers, 5000);
    return () => clearInterval(intervalRef.current);
  }, [loadDrivers]);

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => { loadDrivers(); setSyncing(false); }, 800);
  };

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => drivers.filter(d => {
    const matchText = d.nombre.toLowerCase().includes(search.toLowerCase()) ||
                      d.patente.toLowerCase().includes(search.toLowerCase()) ||
                      d.vehiculo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchText && matchStatus;
  }), [drivers, search, statusFilter]);

  // ── Estadísticas ────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    drivers.length,
    moving:   drivers.filter(d => d.status === 'moving').length,
    stopped:  drivers.filter(d => d.status === 'stopped').length,
    alert:    drivers.filter(d => d.status === 'alert').length,
    avgSpeed: drivers.filter(d => d.status === 'moving').reduce((s, d) => s + d.velocidad, 0) / Math.max(1, drivers.filter(d => d.status === 'moving').length),
    kmTotal:  drivers.reduce((s, d) => s + d.kmHoy, 0),
  }), [drivers]);

  // ── Seleccionar conductor ────────────────────────────────────────────────
  const handleSelect = (d) => {
    setSelected(d);
    setViewState({ center: [d.lat, d.lng], zoom: 16 });
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-slate-950 rounded-2xl">
      <style>{gpsStyles}</style>

      {/* ── HEADER FLOTANTE ──────────────────────────────────────────────── */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex flex-col gap-2 pointer-events-none">
        {/* Barra superior */}
        <div className="flex items-center justify-between gap-2">
          {/* Logo / Título */}
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-2xl px-4 py-2.5 pointer-events-auto shadow-2xl flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none flex items-center gap-1.5">
                Conecta <span className="text-emerald-400">GPS</span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">LIVE</span>
              </p>
              <p className="text-slate-400 text-[10px] font-medium mt-0.5">
                Actualizado {formatTime(lastUpdate)} · {stats.total} conductores
              </p>
            </div>
          </div>

          {/* Controles derecha */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Tipo de mapa */}
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-xl p-1 shadow-xl flex gap-1">
              {[
                { key: 'dark',      icon: <Map size={14} />,       title: 'Oscuro'    },
                { key: 'light',     icon: <Globe size={14} />,     title: 'Claro'     },
                { key: 'satellite', icon: <Satellite size={14} />, title: 'Satélite'  },
              ].map(({ key, icon, title }) => (
                <button
                  key={key}
                  onClick={() => setMapType(key)}
                  title={title}
                  className={`p-2 rounded-lg transition-all text-xs font-bold ${mapType === key ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'}`}
                >{icon}</button>
              ))}
            </div>

            {/* Ruta / Geocerca */}
            <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 rounded-xl p-1 shadow-xl flex gap-1">
              <button onClick={() => setShowRoute(v => !v)} title="Mostrar ruta" className={`p-2 rounded-lg transition-all ${showRoute ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'}`}>
                <Route size={14} />
              </button>
              <button onClick={() => setShowGeofence(v => !v)} title="Geocercas" className={`p-2 rounded-lg transition-all ${showGeofence ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700/60'}`}>
                <Shield size={14} />
              </button>
            </div>

            {/* Sync */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 p-2.5 rounded-xl shadow-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all disabled:opacity-60 pointer-events-auto"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin text-emerald-400' : ''} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 pointer-events-auto">
          {[
            { label: 'En ruta',   value: stats.moving,  color: 'emerald', icon: <Navigation size={12} /> },
            { label: 'Detenidos', value: stats.stopped, color: 'amber',   icon: <Clock size={12} />      },
            { label: 'Alertas',   value: stats.alert,   color: 'red',     icon: <AlertTriangle size={12} /> },
            { label: 'Vel. Prom', value: `${stats.avgSpeed.toFixed(0)} km/h`, color: 'blue', icon: <Gauge size={12} /> },
            { label: 'Km Hoy',   value: `${stats.kmTotal.toFixed(0)} km`, color: 'violet', icon: <TrendingUp size={12} /> },
          ].map((s, i) => (
            <div key={i} className={`bg-slate-900/90 backdrop-blur-xl border border-${s.color}-500/25 rounded-xl px-3 py-1.5 shadow-lg flex items-center gap-1.5`}>
              <span className={`text-${s.color}-400`}>{s.icon}</span>
              <div>
                <p className="text-white font-black text-xs leading-none">{s.value}</p>
                <p className="text-slate-500 text-[9px] font-medium">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LAYOUT PRINCIPAL ──────────────────────────────────────────────── */}
      <div className="flex h-full relative z-0">

        {/* ── PANEL LATERAL ──────────────────────────────────────────────── */}
        <div className={`
          absolute left-0 top-0 bottom-0 z-[400]
          ${panelOpen ? 'w-80 xl:w-96' : 'w-0'}
          transition-all duration-300 ease-in-out overflow-hidden
        `}>
          <div className="flex flex-col h-full w-80 xl:w-96 bg-slate-900/97 border-r border-slate-700/50 backdrop-blur-2xl shadow-2xl pt-32">

            {/* Buscador */}
            <div className="px-4 pb-3 pt-1">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar conductor, patente..."
                  className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs font-medium placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all"
                />
              </div>
            </div>

            {/* Filtros de estado */}
            <div className="px-4 pb-3">
              <div className="flex bg-slate-800/60 p-1 rounded-xl gap-1">
                {[
                  { key: 'all',     label: 'Todos' },
                  { key: 'moving',  label: 'En ruta' },
                  { key: 'stopped', label: 'Detenido' },
                  { key: 'alert',   label: 'Alerta' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all ${
                      statusFilter === f.key
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >{f.label}</button>
                ))}
              </div>
            </div>

            {/* Lista de conductores */}
            <div className="flex-1 overflow-y-auto custom-scrollbar-gps px-3 space-y-2 pb-4">
              {loading && (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <Loader2 size={28} className="animate-spin text-emerald-500" />
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">Conectando...</p>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                  <WifiOff size={24} />
                  <p className="text-xs font-bold">Sin resultados</p>
                </div>
              )}

              {!loading && filtered.map(d => {
                const s = STATUS_CONFIG[d.status];
                const isSelected = selected?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => handleSelect(d)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-800/50 border-slate-700/40 hover:bg-slate-800 hover:border-slate-600/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0 w-10 h-10">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm border-2 border-white/10"
                          style={{ background: s.color }}
                        >
                          {getInitials(d.nombre)}
                        </div>
                        <div
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900"
                          style={{ background: s.color }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-white font-bold text-xs truncate">{d.nombre}</p>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full text-white flex-shrink-0`} style={{ background: s.color }}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[10px] truncate mt-0.5">{d.vehiculo} · {d.patente}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Gauge size={9} />{d.velocidad} km/h</span>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1"><Battery size={9} />{d.bateria}%</span>
                          <span className="text-[10px] text-slate-500">{formatTime(d.ultimoReporte)}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className={`text-slate-600 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90 text-emerald-400' : ''}`} />
                    </div>

                    {/* Ruta activa */}
                    {d.status === 'moving' && (
                      <div className="mt-2 flex items-center gap-1.5 bg-emerald-500/10 rounded-lg px-2 py-1">
                        <Navigation size={9} className="text-emerald-400 flex-shrink-0" />
                        <p className="text-emerald-300 text-[9px] font-bold truncate">{d.ruta}</p>
                      </div>
                    )}
                    {d.status === 'alert' && (
                      <div className="mt-2 flex items-center gap-1.5 bg-red-500/10 rounded-lg px-2 py-1">
                        <AlertTriangle size={9} className="text-red-400 flex-shrink-0 animate-pulse" />
                        <p className="text-red-300 text-[9px] font-bold truncate">{d.ruta}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer del panel */}
            <div className="px-4 pb-4 pt-2 border-t border-slate-800">
              <p className="text-[9px] text-slate-600 font-medium text-center uppercase tracking-wider">
                Datos aislados por empresa · Solo tus conductores
              </p>
            </div>
          </div>
        </div>

        {/* Toggle panel */}
        <button
          onClick={() => setPanelOpen(v => !v)}
          className={`absolute top-1/2 -translate-y-1/2 z-[450] w-5 h-12 bg-slate-800 border border-slate-700 rounded-r-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all shadow-xl ${panelOpen ? 'left-80 xl:left-96' : 'left-0'}`}
        >
          <ChevronRight size={12} className={`transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* ── MAPA ─────────────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-slate-950">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
                  <MapPin size={28} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400" />
                </div>
                <p className="text-slate-400 text-sm font-bold">Iniciando sistema GPS...</p>
                <p className="text-slate-600 text-xs mt-1">Conectando con conductores</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={viewState.center}
              zoom={viewState.zoom}
              className="w-full h-full"
              zoomControl={false}
            >
              <MapController center={viewState.center} zoom={viewState.zoom} />

              <TileLayer
                url={TILES[mapType].url}
                attribution={TILES[mapType].attribution}
                maxZoom={19}
              />

              {/* Geocercas (si están activas) */}
              {showGeofence && filtered.map(d => (
                <Circle
                  key={`gf-${d.id}`}
                  center={[d.lat, d.lng]}
                  radius={500}
                  pathOptions={{ color: STATUS_CONFIG[d.status].color, fillOpacity: 0.04, weight: 1.5, dashArray: '6 4' }}
                />
              ))}

              {/* Historial de ruta */}
              {showRoute && selected && (
                <Polyline
                  positions={selected.historial}
                  pathOptions={{ color: '#10b981', weight: 3, opacity: 0.7, dashArray: '8 4' }}
                />
              )}

              {/* Marcadores de conductores */}
              {filtered.map(d => (
                <Marker
                  key={d.id}
                  position={[d.lat, d.lng]}
                  icon={createDriverIcon(d.status, getInitials(d.nombre))}
                  eventHandlers={{ click: () => handleSelect(d) }}
                >
                  <Popup>
                    <DriverPopup driver={d} />
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          {/* Panel de detalle flotante (conductor seleccionado) */}
          {selected && (
            <DriverDetailPanel driver={selected} onClose={() => setSelected(null)} />
          )}
        </div>
      </div>
    </div>
  );
};

// ─── POPUP DEL MARCADOR ──────────────────────────────────────────────────────
const DriverPopup = ({ driver: d }) => {
  const s = STATUS_CONFIG[d.status];
  return (
    <div className="bg-white rounded-2xl overflow-hidden w-72">
      <div className="px-4 py-3 flex items-center gap-3" style={{ background: `${s.color}18` }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ background: s.color }}>
          {getInitials(d.nombre)}
        </div>
        <div>
          <p className="font-black text-slate-800 text-sm">{d.nombre}</p>
          <p className="text-xs text-slate-500 font-medium">{d.vehiculo}</p>
        </div>
        <span className="ml-auto text-xs font-black px-2 py-1 rounded-full text-white" style={{ background: s.color }}>{s.label}</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {[
          { icon: <Gauge size={12} />, label: 'Velocidad', value: `${d.velocidad} km/h`, color: 'blue' },
          { icon: <Battery size={12} />, label: 'Batería', value: `${d.bateria}%`, color: d.bateria < 20 ? 'red' : 'emerald' },
          { icon: <Signal size={12} />, label: 'Señal', value: `${d.signal}/5`, color: 'violet' },
        ].map((item, i) => (
          <div key={i} className="bg-slate-50 rounded-xl p-2 text-center">
            <div className={`flex items-center justify-center gap-1 text-${item.color}-600 mb-1`}>{item.icon}</div>
            <p className="font-black text-slate-700 text-xs">{item.value}</p>
            <p className="text-[9px] text-slate-400 font-medium">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <div className="bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-2">
          <Navigation size={11} className="text-slate-400" />
          <p className="text-xs text-slate-600 font-medium truncate">{d.ruta}</p>
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Clock size={9} /> {formatTime(d.ultimoReporte)}</span>
          <span className="flex items-center gap-1"><TrendingUp size={9} /> {d.kmHoy.toFixed(1)} km hoy</span>
        </div>
      </div>
    </div>
  );
};

// ─── PANEL DE DETALLE FLOTANTE ───────────────────────────────────────────────
const DriverDetailPanel = ({ driver: d, onClose }) => {
  const s = STATUS_CONFIG[d.status];
  return (
    <div className="absolute bottom-4 right-4 z-[400] w-72 pointer-events-auto">
      <div className="bg-slate-900/97 backdrop-blur-2xl border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: `${s.color}22` }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-base border-2 border-white/10" style={{ background: s.color }}>
            {getInitials(d.nombre)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-sm truncate">{d.nombre}</p>
            <p className="text-slate-400 text-[10px] font-medium">{d.patente} · {d.vehiculo}</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        {/* Stats grid */}
        <div className="p-3 grid grid-cols-2 gap-2">
          {[
            { icon: <Gauge size={14} />,       label: 'Velocidad',  value: `${d.velocidad} km/h`,       color: 'blue'    },
            { icon: <TrendingUp size={14} />,   label: 'Km hoy',     value: `${d.kmHoy.toFixed(1)} km`,  color: 'violet'  },
            { icon: <Battery size={14} />,      label: 'Batería',    value: `${d.bateria}%`,             color: d.bateria < 20 ? 'red' : 'emerald' },
            { icon: <Signal size={14} />,       label: 'Señal GPS',  value: `${d.signal}/5`,             color: 'sky'     },
          ].map((item, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-2.5">
              <div className={`flex items-center gap-1.5 text-${item.color}-400 mb-1`}>
                {item.icon}
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{item.label}</span>
              </div>
              <p className="text-white font-black text-sm">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Ruta */}
        <div className="px-3 pb-2">
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-2xl p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Route size={11} className="text-emerald-400" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Ruta activa</span>
            </div>
            <p className="text-slate-300 text-xs font-medium">{d.ruta}</p>
          </div>
        </div>

        {/* Teléfono + tiempo */}
        <div className="px-3 pb-3 flex items-center justify-between">
          <a
            href={`tel:${d.telefono}`}
            className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors"
          >
            <Phone size={12} /> {d.telefono}
          </a>
          <p className="text-slate-600 text-[10px] font-medium flex items-center gap-1">
            <Clock size={9} /> {formatTime(d.ultimoReporte)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConectaGPS;
