import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import API_URL from '../../config';
import {
  Navigation, Search, RefreshCw, Loader2, MapPin,
  Phone, Gauge, Clock, AlertTriangle, Route, ListOrdered
} from 'lucide-react';

const gpsStyles = `
  .leaflet-popup-content-wrapper {
    border-radius: 16px !important;
    border: 1px solid rgba(226,232,240,0.8);
    background: rgba(255,255,255,0.97) !important;
  }
  .leaflet-popup-content { margin: 0 !important; width: 280px !important; }
`;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const conductoresApi = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });
conductoresApi.interceptors.request.use((cfg) => {
  const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
  if (stored) {
    try {
      const user = JSON.parse(stored);
      if (user?.token) cfg.headers.Authorization = `Bearer ${user.token}`;
    } catch (_) {}
  }
  return cfg;
});

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const formatAgo = (dateValue) => {
  if (!dateValue) return 'sin reporte';
  const diff = Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000);
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
};

const getStatus = (driver) => {
  const ts = driver?.ultimaPosicion?.timestamp ? new Date(driver.ultimaPosicion.timestamp).getTime() : 0;
  const age = ts ? Date.now() - ts : Number.MAX_SAFE_INTEGER;
  const speed = Number(driver?.ultimaPosicion?.velocidad || 0);

  if (!driver.gpsActivo) return 'gps-off';
  if (!ts || age > 10 * 60 * 1000) return 'sin-senal';
  if (speed > 3) return 'en-ruta';
  return 'detenido';
};

const statusMeta = {
  'gps-off': { color: '#64748b', label: 'GPS OFF' },
  'sin-senal': { color: '#f59e0b', label: 'Sin señal' },
  'detenido': { color: '#06b6d4', label: 'Detenido' },
  'en-ruta': { color: '#10b981', label: 'En ruta' },
  'alerta': { color: '#ef4444', label: 'Alerta' },
};

const createIcon = (status, initials) => {
  const meta = statusMeta[status] || statusMeta['sin-senal'];
  return L.divIcon({
    className: 'conductor-marker',
    html: `<div style="width:40px;height:40px;border-radius:999px;background:${meta.color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.2)">${initials}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -42],
  });
};

const MapFly = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 1.1 });
  }, [center, zoom, map]);
  return null;
};

const ConectaGPS = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [mapType, setMapType] = useState('light');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showStats, setShowStats] = useState(false);
  const [selected, setSelected] = useState(null);
  const [routeData, setRouteData] = useState({ points: [], summary: null, streets: [], snappedGeometry: [] });
  const [routeLoading, setRouteLoading] = useState(false);
  const [timeWindow, setTimeWindow] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setHours(8, 0, 0, 0);
    const to = new Date(now);
    return {
      from: from.toISOString().slice(0, 16),
      to: to.toISOString().slice(0, 16),
    };
  });
  const [viewState, setViewState] = useState({ center: [-33.4489, -70.6693], zoom: 11 });
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadDrivers = useCallback(async () => {
    try {
      const res = await conductoresApi.get('/');
      const rows = Array.isArray(res.data) ? res.data : [];
      setDrivers(rows);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('ConectaGPS load error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
    const interval = setInterval(loadDrivers, 5000);
    return () => clearInterval(interval);
  }, [loadDrivers]);

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      const text = `${d.nombre || ''} ${d.rut || ''} ${d.patente || ''} ${d.marca || ''} ${d.modelo || ''}`.toLowerCase();
      const matchText = !search.trim() || text.includes(search.toLowerCase());
      const status = getStatus(d);
      const matchStatus = statusFilter === 'all' || status === statusFilter;
      return matchText && matchStatus;
    });
  }, [drivers, search, statusFilter]);

  const mapeables = useMemo(() => filtered.filter((d) => {
    const lat = d?.ultimaPosicion?.lat;
    const lng = d?.ultimaPosicion?.lng;
    return typeof lat === 'number' && typeof lng === 'number';
  }), [filtered]);

  const stats = useMemo(() => {
    const mapped = drivers.map((d) => {
      const status = getStatus(d);
      const ageMs = d?.ultimaPosicion?.timestamp ? Date.now() - new Date(d.ultimaPosicion.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      const speed = Number(d?.ultimaPosicion?.velocidad || 0);
      const isAlert = status !== 'gps-off' && (ageMs > 15 * 60 * 1000 || speed > 110);
      return { status: isAlert ? 'alerta' : status };
    });

    const avgSpeedBase = drivers
      .map((d) => Number(d?.ultimaPosicion?.velocidad || 0))
      .filter((v) => v > 0);

    return {
      total: drivers.length,
      enRuta: mapped.filter((x) => x.status === 'en-ruta').length,
      detenidos: mapped.filter((x) => x.status === 'detenido').length,
      alertas: mapped.filter((x) => x.status === 'alerta').length,
      avgSpeed: avgSpeedBase.length ? (avgSpeedBase.reduce((a, b) => a + b, 0) / avgSpeedBase.length) : 0,
      conPosicion: mapeables.length,
    };
  }, [drivers, mapeables]);

  const onSelect = (d) => {
    setSelected(d);
    if (typeof d?.ultimaPosicion?.lat === 'number' && typeof d?.ultimaPosicion?.lng === 'number') {
      setViewState({ center: [d.ultimaPosicion.lat, d.ultimaPosicion.lng], zoom: 15 });
    }
  };

  const loadTrajectory = useCallback(async (driverId, fromIso, toIso) => {
    if (!driverId) return;
    setRouteLoading(true);
    try {
      const res = await conductoresApi.get(`/${driverId}/trayecto`, { params: { from: fromIso, to: toIso } });
      const points = Array.isArray(res.data?.points) ? res.data.points : [];

      let streets = [];
      let snappedGeometry = [];

      if (points.length >= 2) {
        const sampled = points.filter((_, idx) => idx % Math.ceil(points.length / 80) === 0).slice(0, 100);
        const coords = sampled.map((p) => `${p.lng},${p.lat}`).join(';');
        if (coords.split(';').length >= 2) {
          try {
            const osrm = await axios.get(`https://router.project-osrm.org/route/v1/driving/${coords}`, {
              params: {
                overview: 'full',
                geometries: 'geojson',
                steps: true,
              },
              timeout: 12000,
            });
            const route = osrm.data?.routes?.[0];
            snappedGeometry = route?.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
            const names = (route?.legs || [])
              .flatMap((l) => l.steps || [])
              .map((s) => String(s.name || '').trim())
              .filter((n) => n && n.toLowerCase() !== 'unnamed road');
            streets = Array.from(new Set(names)).slice(0, 20);
          } catch (_) {
            // Si OSRM falla, mantenemos ruta directa por puntos sin romper la experiencia.
          }
        }
      }

      setRouteData({
        points,
        summary: res.data?.summary || null,
        streets,
        snappedGeometry,
      });
    } catch (e) {
      console.error('ConectaGPS trayecto error', e);
      setRouteData({ points: [], summary: null, streets: [], snappedGeometry: [] });
    } finally {
      setRouteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected?._id) {
      setRouteData({ points: [], summary: null, streets: [], snappedGeometry: [] });
      return;
    }
    loadTrajectory(selected._id, timeWindow.from, timeWindow.to);
  }, [selected?._id, timeWindow.from, timeWindow.to, loadTrajectory]);

  const handleSync = async () => {
    setSyncing(true);
    await loadDrivers();
    setSyncing(false);
  };

  return (
    <div className="h-full w-full bg-slate-900 rounded-2xl overflow-hidden relative">
      <style>{gpsStyles}</style>

      <div className="absolute top-3 left-3 right-3 z-[500] flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center justify-between gap-2">
          <div className="bg-slate-950/95 border border-slate-700 rounded-2xl px-4 py-2.5 pointer-events-auto">
            <p className="text-white font-black text-sm">Conecta GPS <span className="text-emerald-400">Real Time</span></p>
            <p className="text-slate-400 text-[11px]">Última actualización: {formatAgo(lastUpdate)}</p>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowStats((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border ${showStats ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-slate-950/95 text-slate-300 border-slate-700'}`}
            >
              {showStats ? 'Ocultar métricas' : 'Ver métricas'}
            </button>
            <div className="bg-slate-950/95 border border-slate-700 rounded-xl p-1 flex gap-1">
              {['dark', 'light', 'satellite'].map((key) => (
                <button
                  key={key}
                  onClick={() => setMapType(key)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold ${mapType === key ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {key}
                </button>
              ))}
            </div>
            <button onClick={handleSync} className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl text-slate-300 hover:text-emerald-400" disabled={syncing}>
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
          </div>
        </div>

        {showStats && (
          <div className="pointer-events-auto flex flex-wrap gap-1.5 max-w-[540px]">
            <Stat label="Total" value={stats.total} color="indigo" />
            <Stat label="En ruta" value={stats.enRuta} color="emerald" />
            <Stat label="Detenidos" value={stats.detenidos} color="cyan" />
            <Stat label="Alertas" value={stats.alertas} color="red" />
            <Stat label="Con posición" value={stats.conPosicion} color="violet" />
            <Stat label="Vel prom" value={`${stats.avgSpeed.toFixed(0)} km/h`} color="sky" />
          </div>
        )}
      </div>

      <div className="flex h-full">
        <aside className="w-80 xl:w-96 bg-slate-950/98 border-r border-slate-700 pt-28 flex flex-col">
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar conductor, RUT, patente..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div className="px-4 pb-3 flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'en-ruta', label: 'En ruta' },
              { key: 'detenido', label: 'Detenido' },
              { key: 'sin-senal', label: 'Sin señal' },
              { key: 'gps-off', label: 'GPS OFF' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusFilter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
            {loading && (
              <div className="h-32 flex items-center justify-center text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin" /> Cargando conductores...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="h-32 flex items-center justify-center text-slate-500 text-sm">No hay resultados</div>
            )}

            {!loading && filtered.map((d) => {
              const status = getStatus(d);
              const meta = statusMeta[status];
              const selectedRow = selected?._id === d._id;
              return (
                <button
                  key={d._id}
                  onClick={() => onSelect(d)}
                  className={`w-full text-left rounded-2xl border p-3 transition-all ${selectedRow ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/70 border-slate-700/50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-white font-bold text-xs">{d.nombre}</p>
                      <p className="text-slate-400 text-[10px]">{d.rut} · {d.patente || 'sin patente'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white" style={{ background: meta.color }}>{meta.label}</span>
                  </div>
                  <p className="text-slate-500 text-[10px] mt-1">Último reporte: {formatAgo(d?.ultimaPosicion?.timestamp)}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 relative">
          <MapContainer center={viewState.center} zoom={viewState.zoom} className="h-full w-full" zoomControl={false}>
            <MapFly center={viewState.center} zoom={viewState.zoom} />
            <TileLayer url={TILES[mapType]} />

            {routeData.snappedGeometry.length >= 2 && (
              <Polyline positions={routeData.snappedGeometry} pathOptions={{ color: '#22d3ee', weight: 5, opacity: 0.75 }} />
            )}

            {routeData.snappedGeometry.length < 2 && routeData.points.length >= 2 && (
              <Polyline positions={routeData.points.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#22d3ee', weight: 4, opacity: 0.65 }} />
            )}

            {mapeables.map((d) => {
              const status = getStatus(d);
              const initials = String(d.nombre || '?').split(' ').slice(0, 2).map((x) => x[0]).join('').toUpperCase();
              return (
                <Marker
                  key={d._id}
                  position={[d.ultimaPosicion.lat, d.ultimaPosicion.lng]}
                  icon={createIcon(status, initials)}
                  eventHandlers={{ click: () => onSelect(d) }}
                >
                  <Popup>
                    <DriverPopup driver={d} status={status} />
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {!loading && mapeables.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/90 border border-slate-700 rounded-2xl px-6 py-4 text-center">
                <p className="text-white font-bold">Sin posiciones GPS reportadas</p>
                <p className="text-slate-400 text-sm mt-1">Activa GPS en Mis Conductores y comparte el enlace GPS al conductor.</p>
              </div>
            </div>
          )}

          {selected && (
            <div className="absolute right-4 bottom-4 w-[360px] max-h-[70vh] overflow-y-auto bg-slate-950/92 border border-slate-700 rounded-2xl p-3 z-[500]">
              <p className="text-white text-xs font-black flex items-center gap-2"><Route size={14} /> Recorrido y Orden de Ruta</p>
              <p className="text-slate-400 text-[10px] mt-0.5">{selected.nombre} · {selected.patente || 'sin patente'}</p>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <label className="text-[10px] text-slate-400">
                  Desde
                  <input
                    type="datetime-local"
                    value={timeWindow.from}
                    onChange={(e) => setTimeWindow((p) => ({ ...p, from: e.target.value }))}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                  />
                </label>
                <label className="text-[10px] text-slate-400">
                  Hasta
                  <input
                    type="datetime-local"
                    value={timeWindow.to}
                    onChange={(e) => setTimeWindow((p) => ({ ...p, to: e.target.value }))}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                  />
                </label>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                  <p className="text-slate-500">Puntos</p>
                  <p className="text-cyan-300 font-black">{routeData.summary?.points || routeData.points.length}</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                  <p className="text-slate-500">Distancia</p>
                  <p className="text-cyan-300 font-black">{routeData.summary?.distanceKm || 0} km</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-2 border border-slate-800">
                  <p className="text-slate-500">Vel. prom</p>
                  <p className="text-cyan-300 font-black">{routeData.summary?.avgSpeed || 0} km/h</p>
                </div>
              </div>

              <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-xl p-2">
                <p className="text-[10px] font-bold text-slate-300 mb-1">Calles transitadas</p>
                {routeLoading && <p className="text-[10px] text-slate-500">Calculando trazado...</p>}
                {!routeLoading && routeData.streets.length === 0 && <p className="text-[10px] text-slate-500">Sin datos de calles para este rango.</p>}
                {!routeLoading && routeData.streets.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {routeData.streets.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200 text-[10px]">{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 bg-slate-900/80 border border-slate-800 rounded-xl p-2">
                <p className="text-[10px] font-bold text-slate-300 mb-1 flex items-center gap-1"><ListOrdered size={12} /> Orden de desplazamiento</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {(routeData.points || []).slice(-20).map((p, idx) => (
                    <div key={`${p.timestamp}-${idx}`} className="text-[10px] text-slate-300 bg-slate-800/70 rounded-md px-2 py-1 flex items-center justify-between gap-2">
                      <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                      <span className="text-slate-400">{Number(p.velocidad || 0).toFixed(0)} km/h</span>
                      <span className="text-slate-500">{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const Stat = ({ label, value, color }) => (
  <div className={`bg-slate-950/72 backdrop-blur-md border border-${color}-400/20 rounded-lg px-2 py-1.5 min-w-[78px] shadow-sm`}>
    <p className="text-slate-400 text-[8px] font-bold uppercase tracking-wide leading-none">{label}</p>
    <p className={`text-${color}-300 font-black text-xs leading-tight mt-0.5 truncate`}>{value}</p>
  </div>
);

const DriverPopup = ({ driver, status }) => {
  const meta = statusMeta[status] || statusMeta['sin-senal'];
  return (
    <div className="w-72 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-black text-slate-800 text-sm">{driver.nombre}</p>
        <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-black" style={{ background: meta.color }}>{meta.label}</span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{driver.rut} · {driver.patente || 'sin patente'}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Cell icon={<Gauge size={12} />} label="Velocidad" value={`${Number(driver?.ultimaPosicion?.velocidad || 0)} km/h`} />
        <Cell icon={<Clock size={12} />} label="Reporte" value={formatAgo(driver?.ultimaPosicion?.timestamp)} />
        <Cell icon={<Phone size={12} />} label="Teléfono" value={driver.telefono || '—'} />
        <Cell icon={<MapPin size={12} />} label="Posición" value={driver?.ultimaPosicion ? `${driver.ultimaPosicion.lat?.toFixed(5)}, ${driver.ultimaPosicion.lng?.toFixed(5)}` : '—'} />
      </div>
    </div>
  );
};

const Cell = ({ icon, label, value }) => (
  <div className="bg-slate-50 rounded-xl p-2">
    <p className="text-slate-400 text-[9px] font-bold uppercase flex items-center gap-1 mb-0.5">{icon}{label}</p>
    <p className="text-slate-700 text-xs font-semibold truncate">{value}</p>
  </div>
);

export default ConectaGPS;
