import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CalendarRange, Clock3, Gauge, History, MapPinned, Route, Search, UserRound } from 'lucide-react';
import API_URL from '../../config';

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

const toInputDate = (d) => {
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
};

const humanDuration = (minutes) => {
  const total = Number(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
};

const HistorialRutas = () => {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      from: toInputDate(from),
      to: toInputDate(now),
      conductorId: '',
      minDistanceKm: '0',
    };
  });

  const loadDrivers = useCallback(async () => {
    const res = await conductoresApi.get('/');
    setDrivers(Array.isArray(res.data) ? res.data : []);
  }, []);

  const loadHistory = useCallback(async () => {
    setFetching(true);
    try {
      const res = await conductoresApi.get('/historial-rutas', {
        params: {
          from: filters.from,
          to: filters.to,
          conductorId: filters.conductorId || undefined,
          minDistanceKm: Number(filters.minDistanceKm || 0),
          limit: 180,
        },
      });
      const rows = Array.isArray(res.data?.routes) ? res.data.routes : [];
      setRoutes(rows);
      setSummary(res.data?.summary || null);
      if (rows.length === 0) {
        setSelected(null);
      } else if (!selected || !rows.some((x) => x.id === selected.id)) {
        setSelected(rows[0]);
      }
    } catch (e) {
      console.error('HistorialRutas load error', e);
      setRoutes([]);
      setSummary(null);
      setSelected(null);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, [filters.from, filters.to, filters.conductorId, filters.minDistanceKm, selected]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        await loadDrivers();
        await loadHistory();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [loadDrivers, loadHistory]);

  const selectedPath = useMemo(() => {
    if (!selected?.path) return [];
    return selected.path
      .filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
      .map((p) => [Number(p.lat), Number(p.lng)]);
  }, [selected]);

  const mapCenter = selectedPath.length ? selectedPath[0] : [-33.4489, -70.6693];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <History size={24} className="text-indigo-600" /> Historial de Rutas
            </h1>
            <p className="text-sm text-slate-500 mt-1">Módulo de trazabilidad por conductor, rango horario y distancia recorrida.</p>
          </div>
          <button
            onClick={loadHistory}
            disabled={fetching}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60"
          >
            {fetching ? 'Actualizando...' : 'Actualizar historial'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-5">
          <label className="text-xs font-bold text-slate-600">
            Desde
            <input
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-xs font-bold text-slate-600">
            Hasta
            <input
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-xs font-bold text-slate-600">
            Conductor
            <select
              value={filters.conductorId}
              onChange={(e) => setFilters((prev) => ({ ...prev, conductorId: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
            >
              <option value="">Todos los conductores</option>
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>{d.nombre}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600">
            Distancia mínima (km)
            <input
              type="number"
              min="0"
              step="0.1"
              value={filters.minDistanceKm}
              onChange={(e) => setFilters((prev) => ({ ...prev, minDistanceKm: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </label>

          <button
            onClick={loadHistory}
            disabled={fetching}
            className="mt-[22px] h-[42px] rounded-xl border border-slate-300 bg-slate-50 text-slate-700 text-sm font-bold hover:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Search size={15} /> Aplicar filtros
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Rutas" value={summary?.totalRoutes ?? routes.length} icon={Route} />
        <Metric label="Km totales" value={`${summary?.totalDistanceKm ?? 0} km`} icon={MapPinned} />
        <Metric label="Duración prom." value={humanDuration(summary?.avgDurationMin || 0)} icon={Clock3} />
        <Metric label="Conductores activos" value={summary?.activeDrivers ?? 0} icon={UserRound} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700">Rutas registradas</p>
          </div>

          <div className="overflow-auto max-h-[620px]">
            {loading && <p className="p-6 text-sm text-slate-500">Cargando historial...</p>}
            {!loading && routes.length === 0 && <p className="p-6 text-sm text-slate-500">No se encontraron rutas para el filtro seleccionado.</p>}

            {!loading && routes.length > 0 && (
              <table className="w-full text-sm">
                <thead className="bg-white sticky top-0 z-10">
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="px-4 py-3">Conductor</th>
                    <th className="px-4 py-3">Inicio</th>
                    <th className="px-4 py-3">Fin</th>
                    <th className="px-4 py-3">Duración</th>
                    <th className="px-4 py-3">Distancia</th>
                    <th className="px-4 py-3">Vel. prom.</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r) => {
                    const isActive = selected?.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className={`border-b border-slate-100 cursor-pointer ${isActive ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{r.conductor?.nombre || '-'}</p>
                          <p className="text-xs text-slate-500">{r.conductor?.patente || 'sin patente'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatTime(r.startAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatTime(r.endAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{humanDuration(r.durationMin)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.distanceKm} km</td>
                        <td className="px-4 py-3 text-slate-700">{r.avgSpeed} km/h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">Detalle de ruta</p>
            {!selected && <p className="text-sm text-slate-500">Selecciona una ruta para revisar el detalle.</p>}
            {selected && (
              <div className="space-y-2 text-sm">
                <DetailItem icon={UserRound} label="Conductor" value={selected.conductor?.nombre || '-'} />
                <DetailItem icon={CalendarRange} label="Inicio" value={formatTime(selected.startAt)} />
                <DetailItem icon={CalendarRange} label="Fin" value={formatTime(selected.endAt)} />
                <DetailItem icon={Clock3} label="Duración" value={humanDuration(selected.durationMin)} />
                <DetailItem icon={Route} label="Distancia" value={`${selected.distanceKm} km`} />
                <DetailItem icon={Gauge} label="Velocidad" value={`${selected.avgSpeed} km/h prom. · ${selected.maxSpeed} km/h máx.`} />
                <DetailItem icon={MapPinned} label="Puntos" value={`${selected.pointsCount} muestras`} />
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-2 shadow-sm h-[420px]">
            <MapContainer center={mapCenter} zoom={13} className="h-full w-full rounded-2xl" scrollWheelZoom>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />

              {selectedPath.length >= 2 && (
                <Polyline positions={selectedPath} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.75 }} />
              )}

              {selectedPath.length > 0 && (
                <Marker position={selectedPath[0]}>
                  <Popup>Inicio</Popup>
                </Marker>
              )}

              {selectedPath.length > 1 && (
                <Marker position={selectedPath[selectedPath.length - 1]}>
                  <Popup>Fin</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value, icon: Icon }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2">
      <Icon size={14} className="text-indigo-500" /> {label}
    </p>
    <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
  </div>
);

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
    <Icon size={14} className="mt-0.5 text-indigo-500" />
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  </div>
);

export default HistorialRutas;
