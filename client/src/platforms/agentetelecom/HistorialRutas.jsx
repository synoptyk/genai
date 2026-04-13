import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowDown, ArrowUp, CalendarRange, Clock3, Gauge, History, Loader2,
  MapPinned, PauseCircle, RefreshCw, Route, Search, Trash2, Truck, UserRound
} from 'lucide-react';
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
    hour: '2-digit', minute: '2-digit',
  });
};

const humanDuration = (minutes) => {
  const total = Number(minutes || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
};

const estadoRouteClass = (estado) => {
  switch (estado) {
    case 'EN_CURSO': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PLANIFICADA': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'COMPLETADA': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'CANCELADA': return 'bg-rose-50 text-rose-700 border-rose-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const estadoDriverClass = (estado) => {
  switch (estado) {
    case 'Activo': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Suspendido': return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'De Vacaciones': return 'bg-amber-50 text-amber-700 border-amber-200';
    default: return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const renderLocation = (loc) => {
  if (!loc) return 'Sin ubicación';
  return loc.comuna || loc.region || loc.direccion || 'Sin ubicación';
};

const HistorialRutas = () => {
  const [tab, setTab] = useState('control');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const [controlSummary, setControlSummary] = useState(null);
  const [controlRoutes, setControlRoutes] = useState([]);
  const [controlDrivers, setControlDrivers] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [historyRoutes, setHistoryRoutes] = useState([]);
  const [historySummary, setHistorySummary] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return {
      from: toInputDate(from),
      to: toInputDate(now),
      conductorId: '',
      minDistanceKm: '0',
      estado: '',
      search: '',
      reassignConductorId: '',
      keepOrderOnReassign: false,
    };
  });

  const loadControlCenter = useCallback(async () => {
    const res = await conductoresApi.get('/control-centro');
    const routes = Array.isArray(res.data?.routes) ? res.data.routes : [];
    const drivers = Array.isArray(res.data?.conductores) ? res.data.conductores : [];

    setControlSummary(res.data?.summary || null);
    setControlRoutes(routes);
    setControlDrivers(drivers);
    setSelectedRoute((prev) => {
      if (!routes.length) return null;
      if (prev) {
        const fresh = routes.find((r) => r._id === prev._id);
        if (fresh) return fresh;
      }
      return routes[0];
    });
  }, []);

  const loadHistory = useCallback(async () => {
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
    setHistoryRoutes(rows);
    setHistorySummary(res.data?.summary || null);
    setSelectedHistory((prev) => {
      if (!rows.length) return null;
      if (prev) {
        const fresh = rows.find((x) => x.id === prev.id);
        if (fresh) return fresh;
      }
      return rows[0];
    });
  }, [filters.from, filters.to, filters.conductorId, filters.minDistanceKm]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadControlCenter(), loadHistory()]);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo cargar el centro de control.');
    } finally {
      setLoading(false);
    }
  }, [loadControlCenter, loadHistory]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const refreshControlOnly = useCallback(async () => {
    try {
      await loadControlCenter();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo actualizar control centro.');
    }
  }, [loadControlCenter]);

  const runAction = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      await refreshControlOnly();
    } catch (e) {
      setError(e.response?.data?.error || 'Acción no completada.');
    } finally {
      setBusy('');
    }
  };

  const suspendRoute = (routeId) => runAction(`suspend-${routeId}`, async () => {
    await conductoresApi.patch(`/rutas-guiadas/${routeId}/suspender`, { reason: 'Suspendida desde Historial/Control' });
  });

  const deleteRoute = (routeId) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta ruta? Esta acción no se puede deshacer.')) return;
    runAction(`delete-${routeId}`, async () => {
      await conductoresApi.delete(`/rutas-guiadas/${routeId}`);
    });
  };

  const reassignRoute = (routeId) => {
    if (!filters.reassignConductorId) {
      setError('Selecciona un conductor para reasignar la ruta.');
      return;
    }

    runAction(`reassign-${routeId}`, async () => {
      await conductoresApi.patch(`/rutas-guiadas/${routeId}/reasignar`, {
        conductorId: filters.reassignConductorId,
        keepOrder: filters.keepOrderOnReassign,
      });
    });
  };

  const moveStop = (routeId, stopId, direction) => runAction(`move-${routeId}-${stopId}-${direction}`, async () => {
    await conductoresApi.patch(`/rutas-guiadas/${routeId}/mover-parada`, { stopId, direction });
  });

  const updateDriverState = (driverId, payload) => runAction(`driver-${driverId}-${JSON.stringify(payload)}`, async () => {
    await conductoresApi.patch(`/control/conductores/${driverId}/estado`, payload);
  });

  const filteredControlRoutes = useMemo(() => {
    return controlRoutes.filter((r) => {
      const matchStatus = !filters.estado || r.estado === filters.estado;
      const q = filters.search.trim().toLowerCase();
      const text = `${r.nombreRuta || ''} ${r?.conductorRef?.nombre || ''} ${r?.conductorRef?.patente || ''}`.toLowerCase();
      const matchSearch = !q || text.includes(q);
      return matchStatus && matchSearch;
    });
  }, [controlRoutes, filters.estado, filters.search]);

  const selectedRoutePath = useMemo(() => {
    if (!Array.isArray(selectedRoute?.polyline)) return [];
    return selectedRoute.polyline
      .filter((p) => Array.isArray(p) && p.length === 2)
      .map((p) => [Number(p[0]), Number(p[1])]);
  }, [selectedRoute]);

  const selectedHistoryPath = useMemo(() => {
    if (!selectedHistory?.path) return [];
    return selectedHistory.path
      .filter((p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)))
      .map((p) => [Number(p.lat), Number(p.lng)]);
  }, [selectedHistory]);

  const controlMapCenter = selectedRoutePath.length ? selectedRoutePath[0] : [-33.4489, -70.6693];
  const historyMapCenter = selectedHistoryPath.length ? selectedHistoryPath[0] : [-33.4489, -70.6693];

  return (
    <div className="space-y-5">
      <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Truck size={24} className="text-indigo-600" /> Centro de Historial, Seguimiento y Control
            </h1>
            <p className="text-sm text-slate-500 mt-1">Control total de rutas creadas y flota: suspender, eliminar, mover paradas, reasignar conductores y supervisar GPS.</p>
          </div>
          <button
            onClick={refreshAll}
            disabled={loading || Boolean(busy)}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualizar Centro
          </button>
        </div>

        <div className="mt-4 flex gap-2 p-1 bg-slate-100 rounded-2xl w-full sm:w-fit">
          <button
            onClick={() => setTab('control')}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'control' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >
            Control Operacional
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${tab === 'history' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
          >
            Historial GPS
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600 font-semibold">{error}</p>}
      </section>

      {tab === 'control' && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Rutas totales" value={controlSummary?.totalRoutes ?? controlRoutes.length} icon={Route} />
            <Metric label="Rutas en curso" value={controlSummary?.activeRoutes ?? 0} icon={MapPinned} />
            <Metric label="Conductores" value={controlSummary?.totalConductores ?? controlDrivers.length} icon={UserRound} />
            <Metric label="GPS online" value={controlSummary?.gpsOnline ?? 0} icon={Gauge} />
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <label className="text-xs font-bold text-slate-600 md:col-span-1 xl:col-span-1">
              Buscar ruta o conductor
              <input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                placeholder="Nombre ruta, conductor, patente"
              />
            </label>
            <label className="text-xs font-bold text-slate-600 md:col-span-1 xl:col-span-1">
              Estado ruta
              <select
                value={filters.estado}
                onChange={(e) => setFilters((prev) => ({ ...prev, estado: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                <option value="PLANIFICADA">Planificada</option>
                <option value="EN_CURSO">En curso</option>
                <option value="COMPLETADA">Completada</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600 md:col-span-1 xl:col-span-2">
              Reasignar a conductor
              <select
                value={filters.reassignConductorId}
                onChange={(e) => setFilters((prev) => ({ ...prev, reassignConductorId: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="">Selecciona conductor</option>
                {controlDrivers.map((d) => (
                  <option key={d._id} value={d._id}>{d.nombre} · {d.patente || 'sin patente'}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600 flex items-end">
              <span className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 w-full">
                <input
                  type="checkbox"
                  checked={filters.keepOrderOnReassign}
                  onChange={(e) => setFilters((prev) => ({ ...prev, keepOrderOnReassign: e.target.checked }))}
                />
                Mantener orden manual
              </span>
            </label>
          </section>

          <section className="grid grid-cols-1 2xl:grid-cols-12 gap-4">
            <div className="2xl:col-span-4 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Rutas para control</p>
              </div>

              <div className="max-h-[720px] overflow-auto p-3 space-y-3">
                {loading && <p className="text-sm text-slate-500">Cargando...</p>}
                {!loading && filteredControlRoutes.length === 0 && <p className="text-sm text-slate-500">No hay rutas con ese filtro.</p>}

                {!loading && filteredControlRoutes.map((r) => (
                  <div key={r._id} className={`border rounded-2xl p-3 ${selectedRoute?._id === r._id ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}>
                    <button className="w-full text-left" onClick={() => setSelectedRoute(r)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">{r.nombreRuta}</p>
                          <p className="text-xs text-slate-500 mt-1">{r?.conductorRef?.nombre || 'Sin conductor'} · {r?.conductorRef?.patente || 'sin patente'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full border text-[10px] font-black ${estadoRouteClass(r.estado)}`}>{r.estado}</span>
                      </div>
                    </button>

                    <p className="text-[11px] text-slate-500 mt-2">{r.completedStops}/{r.totalStops} completadas · {r.totalDistanceKm || 0} km · {humanDuration(r.totalDurationMin)}</p>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        onClick={() => suspendRoute(r._id)}
                        disabled={Boolean(busy)}
                        className="rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-xs font-bold py-2 hover:bg-amber-100 disabled:opacity-60 flex items-center justify-center gap-1"
                      >
                        <PauseCircle size={12} /> Suspender
                      </button>
                      <button
                        onClick={() => deleteRoute(r._id)}
                        disabled={Boolean(busy)}
                        className="rounded-xl border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold py-2 hover:bg-rose-100 disabled:opacity-60 flex items-center justify-center gap-1"
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="2xl:col-span-5 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4">
              {!selectedRoute && <p className="text-sm text-slate-500">Selecciona una ruta para control detallado.</p>}
              {selectedRoute && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider font-black text-slate-500">Ruta seleccionada</p>
                      <h3 className="text-lg font-black text-slate-900">{selectedRoute.nombreRuta}</h3>
                      <p className="text-xs text-slate-500 mt-1">{selectedRoute?.conductorRef?.nombre || '-'} · {selectedRoute?.conductorRef?.patente || 'sin patente'}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black ${estadoRouteClass(selectedRoute.estado)}`}>{selectedRoute.estado}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => reassignRoute(selectedRoute._id)}
                      disabled={Boolean(busy)}
                      className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                    >
                      Reasignar ruta
                    </button>
                    <button
                      onClick={refreshControlOnly}
                      disabled={Boolean(busy)}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-60"
                    >
                      Refrescar
                    </button>
                  </div>

                  <div className="h-[280px] rounded-2xl overflow-hidden border border-slate-200">
                    <MapContainer center={controlMapCenter} zoom={12} className="h-full w-full" scrollWheelZoom>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                      {selectedRoutePath.length >= 2 && (
                        <Polyline positions={selectedRoutePath} pathOptions={{ color: '#4f46e5', weight: 5, opacity: 0.75 }} />
                      )}
                      {selectedRoutePath.length > 0 && (
                        <Marker position={selectedRoutePath[0]}>
                          <Popup>Origen</Popup>
                        </Marker>
                      )}
                    </MapContainer>
                  </div>

                  <div className="space-y-2 max-h-[280px] overflow-auto pr-1">
                    {(selectedRoute.stops || []).map((s, idx) => (
                      <div key={s._id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">#{s.sequence} · {s.clienteNombre || 'Entrega'}</p>
                            <p className="text-xs text-slate-600 mt-1">{s.direccionNormalizada || s.direccion}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${estadoRouteClass(s.status === 'EN_CURSO' ? 'EN_CURSO' : s.status === 'PENDIENTE' ? 'PLANIFICADA' : 'COMPLETADA')}`}>{s.status}</span>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            disabled={idx === 0 || Boolean(busy)}
                            onClick={() => moveStop(selectedRoute._id, s._id, 'up')}
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
                          >
                            <ArrowUp size={11} /> Subir
                          </button>
                          <button
                            disabled={idx === (selectedRoute.stops || []).length - 1 || Boolean(busy)}
                            onClick={() => moveStop(selectedRoute._id, s._id, 'down')}
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
                          >
                            <ArrowDown size={11} /> Bajar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="2xl:col-span-3 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">Control de conductores y vehículos</p>
              <div className="space-y-2 max-h-[720px] overflow-auto pr-1">
                {controlDrivers.map((d) => (
                  <div key={d._id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{d.nombre}</p>
                        <p className="text-xs text-slate-500">{d.patente || 'sin patente'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${estadoDriverClass(d.estado)}`}>{d.estado}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">GPS: {d.gpsActivo ? 'ACTIVO' : 'INACTIVO'} · Última señal: {formatTime(d?.ultimaPosicion?.timestamp)}</p>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <button
                        onClick={() => updateDriverState(d._id, { estado: 'Suspendido' })}
                        disabled={Boolean(busy)}
                        className="rounded-lg border border-rose-300 bg-rose-50 text-rose-700 text-xs font-bold py-1.5 hover:bg-rose-100 disabled:opacity-60"
                      >
                        Suspender
                      </button>
                      <button
                        onClick={() => updateDriverState(d._id, { estado: 'Activo', gpsActivo: true })}
                        disabled={Boolean(busy)}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold py-1.5 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        Reactivar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {tab === 'history' && (
        <>
          <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
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
                  {controlDrivers.map((d) => (
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
                disabled={loading || Boolean(busy)}
                className="mt-[22px] h-[42px] rounded-xl border border-slate-300 bg-slate-50 text-slate-700 text-sm font-bold hover:bg-slate-100 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Search size={15} /> Aplicar filtros
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Rutas" value={historySummary?.totalRoutes ?? historyRoutes.length} icon={History} />
            <Metric label="Km totales" value={`${historySummary?.totalDistanceKm ?? 0} km`} icon={MapPinned} />
            <Metric label="Duración prom." value={humanDuration(historySummary?.avgDurationMin || 0)} icon={Clock3} />
            <Metric label="Conductores activos" value={historySummary?.activeDrivers ?? 0} icon={UserRound} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-3 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700">Rutas históricas GPS</p>
              </div>

              <div className="overflow-auto max-h-[620px]">
                {historyRoutes.length === 0 && <p className="p-6 text-sm text-slate-500">No se encontraron rutas para el filtro seleccionado.</p>}

                {historyRoutes.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-white sticky top-0 z-10">
                      <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="px-4 py-3">Conductor</th>
                        <th className="px-4 py-3">Inicio</th>
                        <th className="px-4 py-3">Fin</th>
                        <th className="px-4 py-3">Duración</th>
                        <th className="px-4 py-3">Distancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRoutes.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedHistory(r)}
                          className={`border-b border-slate-100 cursor-pointer ${selectedHistory?.id === r.id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{r.conductor?.nombre || '-'}</p>
                            <p className="text-xs text-slate-500">{r.conductor?.patente || 'sin patente'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{formatTime(r.startAt)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatTime(r.endAt)}</td>
                          <td className="px-4 py-3 text-slate-700">{humanDuration(r.durationMin)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{r.distanceKm} km</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="xl:col-span-2 space-y-4">
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">Detalle ruta histórica</p>
                {!selectedHistory && <p className="text-sm text-slate-500">Selecciona una ruta para revisar el detalle.</p>}
                {selectedHistory && (
                  <div className="space-y-2 text-sm">
                    <DetailItem icon={UserRound} label="Conductor" value={selectedHistory.conductor?.nombre || '-'} />
                    <DetailItem icon={CalendarRange} label="Inicio" value={formatTime(selectedHistory.startAt)} />
                    <DetailItem icon={CalendarRange} label="Fin" value={formatTime(selectedHistory.endAt)} />
                    <DetailItem icon={Clock3} label="Duración" value={humanDuration(selectedHistory.durationMin)} />
                    <DetailItem icon={Route} label="Distancia" value={`${selectedHistory.distanceKm} km`} />
                    <DetailItem icon={Gauge} label="Velocidad" value={`${selectedHistory.avgSpeed} km/h prom. · ${selectedHistory.maxSpeed} km/h máx.`} />
                    <DetailItem icon={MapPinned} label="Inicio" value={selectedHistory?.startLocation?.direccion || renderLocation(selectedHistory?.startLocation)} />
                    <DetailItem icon={MapPinned} label="Fin" value={selectedHistory?.endLocation?.direccion || renderLocation(selectedHistory?.endLocation)} />
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-2 shadow-sm h-[420px]">
                <MapContainer center={historyMapCenter} zoom={13} className="h-full w-full rounded-2xl" scrollWheelZoom>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  {selectedHistoryPath.length >= 2 && (
                    <Polyline positions={selectedHistoryPath} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.75 }} />
                  )}
                  {selectedHistoryPath.length > 0 && (
                    <Marker position={selectedHistoryPath[0]}>
                      <Popup>Inicio</Popup>
                    </Marker>
                  )}
                  {selectedHistoryPath.length > 1 && (
                    <Marker position={selectedHistoryPath[selectedHistoryPath.length - 1]}>
                      <Popup>Fin</Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
            </div>
          </section>
        </>
      )}
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
