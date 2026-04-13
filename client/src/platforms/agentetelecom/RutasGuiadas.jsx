import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowDown, ArrowUp, CheckCircle2, Clock3, Loader2, MapPinned, Navigation, Plus,
  Route, Search, Truck, UserRound, XCircle
} from 'lucide-react';
import API_URL from '../../config';
import DireccionAutocomplete from './components/DireccionAutocomplete';

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

const makeStop = () => ({
  tempId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  clienteNombre: '',
  direccion: '',
  comuna: '',
  region: '',
  codigoPostal: '',
  lat: '',
  lng: '',
  contactoNombre: '',
  contactoTelefono: '',
  notas: '',
});

const STATUS_META = {
  PLANIFICADA: 'bg-amber-50 text-amber-700 border-amber-200',
  EN_CURSO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETADA: 'bg-sky-50 text-sky-700 border-sky-200',
  CANCELADA: 'bg-rose-50 text-rose-700 border-rose-200',
  PENDIENTE: 'bg-slate-50 text-slate-700 border-slate-200',
  ENTREGADO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CERRADO: 'bg-orange-50 text-orange-700 border-orange-200',
  EN_CURSO_STOP: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const formatStatus = (value) => String(value || '').replace(/_/g, ' ');

const routeBadgeClass = (status) => STATUS_META[status] || STATUS_META.PENDIENTE;

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

const RutasGuiadas = () => {
  const [conductores, setConductores] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingRouteId, setStartingRouteId] = useState('');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ conductorId: '', estado: '' });
  const [form, setForm] = useState({
    nombreRuta: '',
    conductorId: '',
    autoOptimize: true,
    notas: '',
    originMode: 'DRIVER_CURRENT',
    originLabel: '',
    originDireccion: '',
    originComuna: '',
    originRegion: '',
    originLat: '',
    originLng: '',
    stops: [makeStop(), makeStop()],
  });

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [conductoresRes, routesRes] = await Promise.all([
        conductoresApi.get('/'),
        conductoresApi.get('/rutas-guiadas', { params: filters }),
      ]);

      const conductoresRows = Array.isArray(conductoresRes.data) ? conductoresRes.data : [];
      const routeRows = Array.isArray(routesRes.data) ? routesRes.data : [];

      setConductores(conductoresRows);
      setRoutes(routeRows);
      setSelectedRoute((prev) => {
        if (!routeRows.length) return null;
        if (prev) {
          const fresh = routeRows.find((row) => row._id === prev._id);
          if (fresh) return fresh;
        }
        return routeRows[0];
      });
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudieron cargar las rutas guiadas.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const selectedPath = useMemo(() => {
    if (!Array.isArray(selectedRoute?.polyline) || selectedRoute.polyline.length === 0) return [];
    return selectedRoute.polyline
      .filter((point) => Array.isArray(point) && point.length === 2)
      .map((point) => [Number(point[0]), Number(point[1])]);
  }, [selectedRoute]);

  const mapCenter = useMemo(() => {
    if (selectedPath.length) return selectedPath[0];
    const currentStop = selectedRoute?.currentStop;
    if (currentStop && Number.isFinite(Number(currentStop.lat)) && Number.isFinite(Number(currentStop.lng))) {
      return [Number(currentStop.lat), Number(currentStop.lng)];
    }
    return [-33.4489, -70.6693];
  }, [selectedPath, selectedRoute]);

  const stats = useMemo(() => ({
    total: routes.length,
    enCurso: routes.filter((route) => route.estado === 'EN_CURSO').length,
    completadas: routes.filter((route) => route.estado === 'COMPLETADA').length,
    pendientes: routes.reduce((acc, route) => acc + Number(route.totalStops || 0) - Number(route.completedStops || 0), 0),
  }), [routes]);

  const visibleRoutes = useMemo(() => routes.filter((route) => {
    const matchDriver = !filters.conductorId || route?.conductorRef?._id === filters.conductorId;
    const matchStatus = !filters.estado || route.estado === filters.estado;
    return matchDriver && matchStatus;
  }), [routes, filters]);

  const updateStop = (tempId, key, value) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) => stop.tempId === tempId ? { ...stop, [key]: value } : stop),
    }));
  };

  // Rellena todos los campos de una parada a partir de la sugerencia del autocomplete
  const updateStopFromSuggestion = (tempId, sug) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.map((stop) =>
        stop.tempId === tempId
          ? {
              ...stop,
              direccion: sug.display || sug.direccion || '',
              comuna: sug.comuna || stop.comuna,
              region: sug.region || stop.region,
              codigoPostal: sug.codigoPostal || '',
              lat: sug.lat ?? stop.lat,
              lng: sug.lng ?? stop.lng,
            }
          : stop
      ),
    }));
  };

  // Rellena campos del origen manual a partir del autocomplete
  const applyOriginSuggestion = (sug) => {
    setForm((prev) => ({
      ...prev,
      originDireccion: sug.display || sug.direccion || prev.originDireccion,
      originComuna: sug.comuna || prev.originComuna,
      originRegion: sug.region || prev.originRegion,
      originLat: sug.lat ?? prev.originLat,
      originLng: sug.lng ?? prev.originLng,
    }));
  };

  const addStop = () => setForm((prev) => ({ ...prev, stops: [...prev.stops, makeStop()] }));

  const moveStop = (index, delta) => {
    setForm((prev) => {
      const next = [...prev.stops];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, stops: next };
    });
  };

  const removeStop = (tempId) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.length <= 1 ? prev.stops : prev.stops.filter((stop) => stop.tempId !== tempId),
    }));
  };

  const resetForm = () => {
    setForm({
      nombreRuta: '',
      conductorId: '',
      autoOptimize: true,
      notas: '',
      originMode: 'DRIVER_CURRENT',
      originLabel: '',
      originDireccion: '',
      originComuna: '',
      originRegion: '',
      originLat: '',
      originLng: '',
      stops: [makeStop(), makeStop()],
    });
  };

  const handleCreateRoute = async () => {
    const validStops = form.stops.filter((stop) => String(stop.direccion || '').trim());
    if (!form.conductorId) {
      setError('Debes seleccionar un conductor.');
      return;
    }
    if (validStops.length === 0) {
      setError('Debes ingresar al menos una parada válida.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        nombreRuta: form.nombreRuta || 'Ruta guiada del día',
        conductorId: form.conductorId,
        autoOptimize: form.autoOptimize,
        notas: form.notas,
        origin: {
          mode: form.originMode,
          label: form.originLabel,
          direccion: form.originDireccion,
          comuna: form.originComuna,
          region: form.originRegion,
          lat: form.originLat || undefined,
          lng: form.originLng || undefined,
        },
        stops: validStops.map((stop) => ({
          clienteNombre: stop.clienteNombre,
          direccion: stop.direccion,
          comuna: stop.comuna,
          region: stop.region,
          lat: stop.lat || undefined,
          lng: stop.lng || undefined,
          contactoNombre: stop.contactoNombre,
          contactoTelefono: stop.contactoTelefono,
          notas: stop.notas,
        })),
      };

      const res = await conductoresApi.post('/rutas-guiadas', payload);
      const created = res.data;
      setRoutes((prev) => [created, ...prev]);
      setSelectedRoute(created);
      resetForm();
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo crear la ruta.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartRoute = async (routeId) => {
    setStartingRouteId(routeId);
    setError('');
    try {
      const res = await conductoresApi.patch(`/rutas-guiadas/${routeId}/iniciar`);
      const updated = res.data;
      setRoutes((prev) => prev.map((route) => route._id === updated._id ? updated : route));
      setSelectedRoute(updated);
    } catch (e) {
      setError(e.response?.data?.error || 'No se pudo iniciar la ruta.');
    } finally {
      setStartingRouteId('');
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <XCircle size={16} /> {error}
        </div>
      )}

      <section className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Route size={24} className="text-indigo-600" /> Rutas Guiadas
            </h1>
            <p className="text-sm text-slate-500 mt-1">Planifica direcciones, optimiza secuencia y ejecuta entregas una a una desde el link GPS del conductor.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full lg:w-auto">
            <Metric icon={Truck} label="Rutas" value={stats.total} tone="indigo" />
            <Metric icon={Navigation} label="En curso" value={stats.enCurso} tone="emerald" />
            <Metric icon={CheckCircle2} label="Completadas" value={stats.completadas} tone="sky" />
            <Metric icon={Clock3} label="Pendientes" value={stats.pendientes} tone="amber" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-12 gap-5">
        <div className="2xl:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Planificador</p>
              <p className="text-sm text-slate-500 mt-1">Modo inteligente: optimiza por IA o respeta tu orden manual 1,2,3.</p>
            </div>
            <button
              onClick={resetForm}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>

          <label className="block text-xs font-bold text-slate-600">
            Nombre de la ruta
            <input
              value={form.nombreRuta}
              onChange={(e) => setForm((prev) => ({ ...prev, nombreRuta: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              placeholder="Ruta Reparto Zona Norte"
            />
          </label>

          <label className="block text-xs font-bold text-slate-600">
            Conductor asignado
            <select
              value={form.conductorId}
              onChange={(e) => setForm((prev) => ({ ...prev, conductorId: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
            >
              <option value="">Selecciona conductor</option>
              {conductores.map((conductor) => (
                <option key={conductor._id} value={conductor._id}>{conductor.nombre} · {conductor.patente || 'sin patente'}</option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Estrategia de ruteo</p>
                <p className="text-xs text-slate-500 mt-1">
                  {form.autoOptimize
                    ? 'AUTO_OPTIMIZADA: el sistema calcula la secuencia mas rapida.'
                    : 'MANUAL: se respeta el orden que definas en las paradas.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, autoOptimize: !prev.autoOptimize }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${form.autoOptimize ? 'bg-indigo-600' : 'bg-slate-500'}`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.autoOptimize ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-600">
              Origen de la ruta
              <select
                value={form.originMode}
                onChange={(e) => setForm((prev) => ({ ...prev, originMode: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="DRIVER_CURRENT">Ubicación actual del conductor</option>
                <option value="MANUAL">Origen manual</option>
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-600">
              Alias del origen
              <input
                value={form.originLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, originLabel: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                placeholder="Bodega Central"
                disabled={form.originMode !== 'MANUAL'}
              />
            </label>
          </div>

          {form.originMode === 'MANUAL' && (
            <div className="space-y-3">
              <DireccionAutocomplete
                label="Dirección origen"
                value={form.originDireccion}
                onChange={(text) => setForm((prev) => ({ ...prev, originDireccion: text }))}
                onSelect={applyOriginSuggestion}
                placeholder="Av. Principal 1234, Santiago"
              />
              {form.originDireccion && (
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={form.originComuna}
                    onChange={(e) => setForm((prev) => ({ ...prev, originComuna: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm"
                    placeholder="Comuna"
                  />
                  <input
                    value={form.originRegion}
                    onChange={(e) => setForm((prev) => ({ ...prev, originRegion: e.target.value }))}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-sm col-span-2"
                    placeholder="Región"
                  />
                </div>
              )}
            </div>
          )}

          <label className="block text-xs font-bold text-slate-600">
            Notas generales
            <textarea
              value={form.notas}
              onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
              rows={3}
              className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none"
              placeholder="Indicaciones para el conductor, horario, tipo de carga..."
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Paradas</p>
              <button
                onClick={addStop}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus size={14} /> Agregar parada
              </button>
            </div>

            {form.stops.map((stop, index) => (
              <div key={stop.tempId} className="border border-slate-200 rounded-2xl p-3 space-y-3 bg-slate-50/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-black text-slate-700">Parada {index + 1}</p>
                    {!form.autoOptimize && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveStop(index, -1)}
                          disabled={index === 0}
                          className="p-1 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStop(index, 1)}
                          disabled={index === form.stops.length - 1}
                          className="p-1 rounded-md border border-slate-300 text-slate-600 disabled:opacity-40"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeStop(stop.tempId)}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700"
                    disabled={form.stops.length <= 1}
                  >
                    Quitar
                  </button>
                </div>

                <input
                  value={stop.clienteNombre}
                  onChange={(e) => updateStop(stop.tempId, 'clienteNombre', e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
                  placeholder="Cliente / empresa"
                />

                {/* ── Autocomplete de dirección ── */}
                <DireccionAutocomplete
                  value={stop.direccion}
                  onChange={(text) => updateStop(stop.tempId, 'direccion', text)}
                  onSelect={(sug) => updateStopFromSuggestion(stop.tempId, sug)}
                  placeholder="Dirección completa..."
                />

                {/* Código postal + autocompletado */}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={stop.codigoPostal || ''}
                    onChange={(e) => updateStop(stop.tempId, 'codigoPostal', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder="Cód. postal"
                  />
                  <input
                    value={stop.comuna}
                    onChange={(e) => updateStop(stop.tempId, 'comuna', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder="Comuna"
                  />
                  <input
                    value={stop.region}
                    onChange={(e) => updateStop(stop.tempId, 'region', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                    placeholder="Región"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={stop.contactoNombre}
                    onChange={(e) => updateStop(stop.tempId, 'contactoNombre', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
                    placeholder="Contacto"
                  />
                  <input
                    value={stop.contactoTelefono}
                    onChange={(e) => updateStop(stop.tempId, 'contactoTelefono', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
                    placeholder="Teléfono"
                  />
                </div>

                <textarea
                  value={stop.notas}
                  onChange={(e) => updateStop(stop.tempId, 'notas', e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none bg-white"
                  placeholder="Observaciones de entrega"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleCreateRoute}
            disabled={saving}
            className="w-full rounded-2xl bg-indigo-600 text-white py-3 font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />}
            {saving
              ? (form.autoOptimize ? 'Optimizando y creando ruta...' : 'Creando ruta manual...')
              : (form.autoOptimize ? 'Crear ruta optimizada' : 'Crear ruta en orden manual')}
          </button>
        </div>

        <div className="2xl:col-span-3 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Rutas creadas</p>
              <p className="text-sm text-slate-500 mt-1">Supervisa la secuencia, progreso y siguiente parada activa.</p>
            </div>
            <button
              onClick={loadBase}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 mb-4">
            <label className="text-xs font-bold text-slate-600">
              Filtrar conductor
              <select
                value={filters.conductorId}
                onChange={(e) => setFilters((prev) => ({ ...prev, conductorId: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                {conductores.map((conductor) => (
                  <option key={conductor._id} value={conductor._id}>{conductor.nombre}</option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold text-slate-600">
              Filtrar estado
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
          </div>

          <div className="space-y-3 max-h-[880px] overflow-y-auto pr-1">
            {loading && (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
                <Loader2 size={16} className="animate-spin" /> Cargando rutas...
              </div>
            )}

            {!loading && visibleRoutes.length === 0 && (
              <div className="border border-dashed border-slate-300 rounded-2xl px-4 py-8 text-center text-sm text-slate-500">
                No hay rutas para el filtro actual.
              </div>
            )}

            {!loading && visibleRoutes.map((route) => (
              <button
                key={route._id}
                onClick={() => setSelectedRoute(route)}
                className={`w-full text-left border rounded-2xl p-4 transition-all ${selectedRoute?._id === route._id ? 'border-indigo-400 bg-indigo-50/70' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{route.nombreRuta}</p>
                    <p className="text-xs text-slate-500 mt-1">{route?.conductorRef?.nombre || 'Sin conductor'} · {route?.conductorRef?.patente || 'sin patente'}</p>
                    <p className="text-[10px] mt-1 font-bold text-slate-500">
                      {(route.optimizationMode || 'AUTO_OPTIMIZADA') === 'MANUAL' ? 'MANUAL' : 'AUTO_OPTIMIZADA'}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${routeBadgeClass(route.estado)}`}>
                    {formatStatus(route.estado)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] text-slate-600">
                  <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                    <p className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Distancia</p>
                    <p className="font-bold text-slate-800">{route.totalDistanceKm || 0} km</p>
                  </div>
                  <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                    <p className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Duración</p>
                    <p className="font-bold text-slate-800">{humanDuration(route.totalDurationMin)}</p>
                  </div>
                  <div className="bg-white/80 border border-slate-200 rounded-xl px-3 py-2">
                    <p className="text-slate-400 uppercase tracking-wider text-[9px] font-black">Avance</p>
                    <p className="font-bold text-slate-800">{route.completedStops}/{route.totalStops}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${route.progressPct || 0}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2 truncate">Siguiente: {route.currentStop?.direccionNormalizada || route.currentStop?.direccion || 'Ruta completada'}</p>
                </div>

                {route.estado === 'PLANIFICADA' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRoute(route._id);
                    }}
                    disabled={startingRouteId === route._id}
                    className="mt-3 w-full rounded-xl bg-emerald-600 text-white py-2 text-xs font-bold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {startingRouteId === route._id ? 'Iniciando...' : 'Iniciar ruta'}
                  </button>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="2xl:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          {!selectedRoute && (
            <div className="h-full min-h-[640px] flex items-center justify-center text-center text-slate-500 text-sm border border-dashed border-slate-300 rounded-2xl">
              Selecciona una ruta para ver el detalle optimizado, mapa y orden de entregas.
            </div>
          )}

          {selectedRoute && (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Ruta seleccionada</p>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{selectedRoute.nombreRuta}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedRoute?.conductorRef?.nombre || 'Sin conductor'} · {selectedRoute?.conductorRef?.patente || 'sin patente'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider ${routeBadgeClass(selectedRoute.estado)}`}>
                    {formatStatus(selectedRoute.estado)}
                  </span>
                  <span className="px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 bg-slate-50">
                    {(selectedRoute.optimizationMode || 'AUTO_OPTIMIZADA') === 'MANUAL' ? 'MANUAL' : 'AUTO OPTIMIZADA'}
                  </span>
                  {selectedRoute.currentStop && (
                    <a
                      href={buildGoogleMapsUrl(selectedRoute.currentStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                      Google Maps
                    </a>
                  )}
                  {selectedRoute.currentStop && Number.isFinite(Number(selectedRoute.currentStop.lat)) && (
                    <a
                      href={buildWazeUrl(selectedRoute.currentStop)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-full border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                    >
                      Waze
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetailCard icon={MapPinned} label="Km planificados" value={`${selectedRoute.totalDistanceKm || 0} km`} />
                <DetailCard icon={Clock3} label="Duración estimada" value={humanDuration(selectedRoute.totalDurationMin)} />
                <DetailCard icon={CheckCircle2} label="Paradas completadas" value={`${selectedRoute.completedStops}/${selectedRoute.totalStops}`} />
                <DetailCard icon={UserRound} label="Siguiente parada" value={selectedRoute.currentStop ? `${selectedRoute.currentStop.sequence}/${selectedRoute.totalStops}` : 'Finalizada'} />
              </div>

              <div className="h-[340px] rounded-3xl overflow-hidden border border-slate-200">
                <MapContainer center={mapCenter} zoom={12} className="h-full w-full" zoomControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  {selectedPath.length >= 2 && (
                    <Polyline positions={selectedPath} pathOptions={{ color: '#4f46e5', weight: 5, opacity: 0.75 }} />
                  )}

                  {selectedRoute?.origen?.lat != null && selectedRoute?.origen?.lng != null && (
                    <Marker position={[selectedRoute.origen.lat, selectedRoute.origen.lng]}>
                      <Popup>
                        <strong>Origen</strong>
                        <br />
                        {selectedRoute.origen.label || selectedRoute.origen.direccion || 'Origen'}
                      </Popup>
                    </Marker>
                  )}

                  {selectedRoute.stops.map((stop) => (
                    <Marker key={stop._id} position={[stop.lat, stop.lng]}>
                      <Popup>
                        <strong>Parada {stop.sequence}</strong>
                        <br />
                        {stop.clienteNombre || stop.direccionNormalizada || stop.direccion}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">Parada actual</p>
                  {selectedRoute.currentStop ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-black text-slate-900">#{selectedRoute.currentStop.sequence}</p>
                        <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${routeBadgeClass(selectedRoute.currentStop.status === 'EN_CURSO' ? 'EN_CURSO_STOP' : selectedRoute.currentStop.status)}`}>
                          {formatStatus(selectedRoute.currentStop.status)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{selectedRoute.currentStop.clienteNombre || 'Entrega programada'}</p>
                      <p className="text-sm text-slate-600">{selectedRoute.currentStop.direccionNormalizada || selectedRoute.currentStop.direccion}</p>
                      <p className="text-xs text-slate-500">{[selectedRoute.currentStop.comuna, selectedRoute.currentStop.region].filter(Boolean).join(' · ') || 'Sin comuna / región'}</p>
                      {selectedRoute.currentStop.contactoNombre && (
                        <p className="text-xs text-slate-600">Contacto: {selectedRoute.currentStop.contactoNombre} {selectedRoute.currentStop.contactoTelefono ? `· ${selectedRoute.currentStop.contactoTelefono}` : ''}</p>
                      )}
                      {selectedRoute.currentStop.notas && <p className="text-xs text-slate-600">Nota: {selectedRoute.currentStop.notas}</p>}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">La ruta ya completó todas sus entregas.</p>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-600">Notas y origen</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p><span className="font-bold">Origen:</span> {selectedRoute.origen?.label || selectedRoute.origen?.direccion || 'Ubicación del conductor'}</p>
                    <p><span className="font-bold">Inicio modo:</span> {selectedRoute.origen?.mode === 'MANUAL' ? 'Origen manual' : 'Ubicación actual del conductor'}</p>
                    <p><span className="font-bold">Notas:</span> {selectedRoute.notas || 'Sin notas generales'}</p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Search size={14} /> Orden de entregas
                  </p>
                  <p className="text-xs text-slate-500">El conductor las verá una a una en su link GPS.</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                  {selectedRoute.stops.map((stop) => (
                    <div key={stop._id} className="px-4 py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">{stop.sequence}</span>
                          <p className="text-sm font-semibold text-slate-900 truncate">{stop.clienteNombre || 'Parada de entrega'}</p>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">{stop.direccionNormalizada || stop.direccion}</p>
                        <p className="text-xs text-slate-500 mt-1">ETA aprox. {humanDuration(stop.etaMin)} · {stop.distanceFromPreviousKm} km desde la anterior</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${routeBadgeClass(stop.status === 'EN_CURSO' ? 'EN_CURSO_STOP' : stop.status)}`}>
                        {formatStatus(stop.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    indigo: 'border-indigo-100 text-indigo-700 bg-indigo-50/50',
    emerald: 'border-emerald-100 text-emerald-700 bg-emerald-50/50',
    sky: 'border-sky-100 text-sky-700 bg-sky-50/50',
    amber: 'border-amber-100 text-amber-700 bg-amber-50/50',
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.indigo}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider opacity-80">
        <Icon size={15} /> {label}
      </div>
      <p className="text-2xl font-black mt-2">{value}</p>
    </div>
  );
};

const DetailCard = ({ icon: Icon, label, value }) => (
  <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70">
    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
      <Icon size={14} /> {label}
    </p>
    <p className="text-base font-black text-slate-900 mt-2">{value}</p>
  </div>
);

export default RutasGuiadas;