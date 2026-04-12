import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import API_URL from '../../config';
import { useAuth } from '../auth/AuthContext';
import { formatRut, validateRut } from '../../utils/rutUtils';
import {
  Users, Plus, Pencil, Trash2, Search, Filter, ChevronDown, ChevronUp,
  Truck, Phone, CreditCard, MapPin, Gauge, CheckCircle, XCircle,
  AlertTriangle, Loader2, X, Save, Link2, FolderOpen, Navigation,
  ToggleLeft, ToggleRight, Eye, UserCheck, Activity, Building2, Car
} from 'lucide-react';

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const conductoresApi = axios.create({ baseURL: `${API_URL}/api/rrhh/conductores` });
conductoresApi.interceptors.request.use(cfg => {
  const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
  if (stored) { try { const u = JSON.parse(stored); if (u?.token) cfg.headers.Authorization = `Bearer ${u.token}`; } catch (_) {} }
  return cfg;
});

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const TAMANOS = ['Moto', 'Auto', 'Camioneta', 'Furgón 3/4', 'Van', 'Camión Pequeño', 'Camión Mediano', 'Camión Grande', 'Semi-remolque', 'Otro'];
const LICENCIAS = ['A1', 'A2', 'A3', 'A4', 'B', 'C', 'D', 'F', 'Otra'];
const ESTADOS = ['Activo', 'Inactivo', 'Suspendido', 'De Vacaciones'];
const STATUS_COLOR = {
  Activo: 'emerald', Inactivo: 'slate', Suspendido: 'red', 'De Vacaciones': 'amber'
};

const EMPTY_FORM = {
  nombre: '', rut: '', telefono: '', email: '',
  patente: '', marca: '', modelo: '', tamano: 'Camioneta', anio: '', color: '',
  estado: 'Activo', licenciaClase: 'B', licenciaVence: '',
  candidatoRef: '', proyectoRef: '', notas: ''
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const badge = (color, label) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-${color}-50 text-${color}-700 border border-${color}-200`}>
    {label}
  </span>
);

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const MisConductores = () => {
  const { user } = useAuth();
  const [conductores, setConductores]     = useState([]);
  const [candidatos, setCandidatos]       = useState([]);
  const [proyectos, setProyectos]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [search, setSearch]               = useState('');
  const [filterEstado, setFilterEstado]   = useState('all');
  const [showForm, setShowForm]           = useState(false);
  const [editId, setEditId]               = useState(null);
  const [form, setForm]                   = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]       = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Carga de datos ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, candidRes, proyRes] = await Promise.allSettled([
        conductoresApi.get('/'),
        conductoresApi.get('/lookup/candidatos'),
        conductoresApi.get('/lookup/proyectos'),
      ]);
      if (cRes.status === 'fulfilled')    setConductores(cRes.value.data || []);
      if (candidRes.status === 'fulfilled') setCandidatos(candidRes.value.data || []);
      if (proyRes.status === 'fulfilled')  setProyectos(proyRes.value.data || []);
    } catch (e) {
      setError('Error cargando datos. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => conductores.filter(c => {
    const q = search.toLowerCase();
    const matchText = !q || c.nombre?.toLowerCase().includes(q) || c.rut?.toLowerCase().includes(q) ||
      c.patente?.toLowerCase().includes(q) || c.marca?.toLowerCase().includes(q) || c.modelo?.toLowerCase().includes(q);
    const matchEstado = filterEstado === 'all' || c.estado === filterEstado;
    return matchText && matchEstado;
  }), [conductores, search, filterEstado]);

  const stats = useMemo(() => ({
    total:    conductores.length,
    activos:  conductores.filter(c => c.estado === 'Activo').length,
    gpsOn:    conductores.filter(c => c.gpsActivo).length,
    proyectoAsignados: conductores.filter(c => c.proyectoRef).length,
  }), [conductores]);

  // ── Formulario ────────────────────────────────────────────────────────────
  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setFormErrors({}); setShowForm(true); };
  const openEdit = (c) => {
    setForm({
      nombre: c.nombre || '', rut: c.rut || '', telefono: c.telefono || '', email: c.email || '',
      patente: c.patente || '', marca: c.marca || '', modelo: c.modelo || '',
      tamano: c.tamano || 'Camioneta', anio: c.anio || '', color: c.color || '',
      estado: c.estado || 'Activo', licenciaClase: c.licenciaClase || 'B',
      licenciaVence: c.licenciaVence ? c.licenciaVence.substring(0, 10) : '',
      candidatoRef: c.candidatoRef?._id || c.candidatoRef || '',
      proyectoRef: c.proyectoRef?._id || c.proyectoRef || '',
      notas: c.notas || ''
    });
    setEditId(c._id);
    setFormErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.rut.trim()) e.rut = 'Requerido';
    else if (!validateRut(form.rut)) e.rut = 'RUT inválido';
    if (!form.patente.trim()) e.patente = 'Requerido';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        rut: form.rut,
        patente: form.patente.toUpperCase().replace(/\s/g, ''),
        candidatoRef: form.candidatoRef || null,
        proyectoRef: form.proyectoRef || null,
        anio: form.anio ? Number(form.anio) : undefined,
        licenciaVence: form.licenciaVence || undefined,
      };
      if (editId) {
        await conductoresApi.put(`/${editId}`, payload);
      } else {
        await conductoresApi.post('/', payload);
      }
      setShowForm(false);
      setEditId(null);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await conductoresApi.delete(`/${id}`);
      setDeleteConfirm(null);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || 'Error al eliminar.');
    }
  };

  const toggleGps = async (c) => {
    try {
      const updated = await conductoresApi.patch(`/${c._id}/gps`, { gpsActivo: !c.gpsActivo });
      setConductores(prev => prev.map(x => x._id === c._id ? updated.data : x));
    } catch (e) {
      setError('Error actualizando GPS.');
    }
  };

  const regenerateGpsToken = async (c) => {
    try {
      const res = await conductoresApi.patch(`/${c._id}/gps-token`);
      const newToken = res.data?.gpsToken;
      if (!newToken) return;
      setConductores(prev => prev.map(x => x._id === c._id ? { ...x, gpsToken: newToken } : x));
    } catch (e) {
      setError('Error regenerando token GPS.');
    }
  };

  const copyGpsLink = async (c) => {
    try {
      const base = window.location.origin;
      const link = `${base}/gps/live/${c.gpsToken}`;
      await navigator.clipboard.writeText(link);
    } catch (e) {
      setError('No se pudo copiar el enlace GPS.');
    }
  };

  // ── Autocompletar desde candidato RRHH ───────────────────────────────────
  const handleCandidatoSelect = (candidatoId) => {
    const c = candidatos.find(c => c._id === candidatoId);
    if (c) {
      setForm(prev => ({
        ...prev,
        candidatoRef: candidatoId,
        nombre: c.nombre || prev.nombre,
        rut: c.rut || prev.rut,
        telefono: c.telefono || prev.telefono,
        email: c.email || prev.email,
      }));
    } else {
      setForm(prev => ({ ...prev, candidatoRef: '' }));
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-indigo-50/30 p-4 sm:p-6 md:p-8">
      {error && (
        <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-medium">
          <AlertTriangle size={16} className="flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 flex items-center gap-2">
            <Truck size={28} className="text-indigo-600" />
            Mis <span className="text-indigo-600">Conductores</span>
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestión de conductores y vehículos — Distribución 360</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all active:scale-95"
        >
          <Plus size={16} /> Registrar Conductor
        </button>
      </div>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: <Users size={18} />, label: 'Total conductores', value: stats.total, color: 'indigo' },
          { icon: <UserCheck size={18} />, label: 'Activos', value: stats.activos, color: 'emerald' },
          { icon: <Navigation size={18} />, label: 'GPS activo', value: stats.gpsOn, color: 'sky' },
          { icon: <FolderOpen size={18} />, label: 'Con proyecto', value: stats.proyectoAsignados, color: 'violet' },
        ].map((s, i) => (
          <div key={i} className={`bg-white border border-${s.color}-100 rounded-2xl p-4 shadow-sm`}>
            <div className={`flex items-center gap-2 text-${s.color}-600 mb-2`}>{s.icon}<span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span></div>
            <p className={`text-3xl font-black text-${s.color}-600`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── FILTROS ───────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUT, patente, marca..."
            className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', ...ESTADOS].map(e => (
            <button
              key={e}
              onClick={() => setFilterEstado(e)}
              className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                filterEstado === e
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >{e === 'all' ? 'Todos' : e}</button>
          ))}
        </div>
      </div>

      {/* ── TABLA ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
            <span className="text-sm font-bold">Cargando conductores...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <Truck size={40} className="text-slate-200" />
            <p className="font-bold text-sm">Sin conductores registrados</p>
            <button onClick={openNew} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1"><Plus size={12} /> Registrar primer conductor</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Conductor', 'RUT', 'Contacto', 'Vehículo', 'Patente', 'Tamaño', 'Proyecto', 'Estado', 'GPS', 'Enlace GPS', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => {
                  const sc = STATUS_COLOR[c.estado] || 'slate';
                  return (
                    <tr key={c._id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Conductor */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                            {c.nombre?.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-xs whitespace-nowrap">{c.nombre}</p>
                            {c.candidatoRef && <p className="text-[9px] text-indigo-500 flex items-center gap-0.5 mt-0.5"><Link2 size={8} /> Vinculado RRHH</p>}
                          </div>
                        </div>
                      </td>
                      {/* RUT */}
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">{c.rut}</td>
                      {/* Contacto */}
                      <td className="px-4 py-3">
                        {c.telefono && <p className="text-slate-600 text-xs flex items-center gap-1"><Phone size={10} className="text-slate-400" />{c.telefono}</p>}
                        {c.email && <p className="text-slate-400 text-[10px] truncate max-w-[130px]">{c.email}</p>}
                      </td>
                      {/* Vehículo */}
                      <td className="px-4 py-3">
                        <p className="text-slate-700 font-semibold text-xs">{[c.marca, c.modelo].filter(Boolean).join(' ') || '—'}</p>
                        {c.anio && <p className="text-[10px] text-slate-400">{c.anio} · {c.color}</p>}
                      </td>
                      {/* Patente */}
                      <td className="px-4 py-3">
                        <span className="bg-slate-900 text-white font-black text-[11px] px-2 py-1 rounded-lg tracking-widest">{c.patente || '—'}</span>
                      </td>
                      {/* Tamaño */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-slate-600"><Car size={12} className="text-slate-400" />{c.tamano}</span>
                      </td>
                      {/* Proyecto */}
                      <td className="px-4 py-3">
                        {c.proyectoRef
                          ? <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-lg font-bold">{c.proyectoRef?.nombreProyecto || 'Asignado'}</span>
                          : <span className="text-slate-300 text-[10px]">—</span>}
                      </td>
                      {/* Estado */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {badge(sc, c.estado)}
                      </td>
                      {/* GPS toggle */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleGps(c)}
                          title={c.gpsActivo ? 'Desactivar GPS' : 'Activar GPS'}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all ${
                            c.gpsActivo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {c.gpsActivo
                            ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>LIVE</>
                            : <><div className="w-2 h-2 rounded-full bg-slate-300" />OFF</>
                          }
                        </button>
                      </td>
                      {/* Enlace GPS */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyGpsLink(c)}
                            className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-black hover:bg-sky-100"
                            title="Copiar enlace GPS para celular"
                          >
                            Copiar
                          </button>
                          <button
                            onClick={() => regenerateGpsToken(c)}
                            className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black hover:bg-amber-100"
                            title="Regenerar token GPS"
                          >
                            Regenerar
                          </button>
                        </div>
                      </td>
                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors" title="Editar">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteConfirm(c)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/50 text-[10px] text-slate-400 font-medium">
              {filtered.length} conductor{filtered.length !== 1 ? 'es' : ''} · Solo tus registros de empresa
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL FORMULARIO ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="text-lg font-black text-slate-800">{editId ? 'Editar Conductor' : 'Registrar Conductor'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Completa los datos del conductor y su vehículo</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Vinculación RRHH */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                <p className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mb-3"><Link2 size={13} /> Vincular con RRHH (opcional)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trabajador de Captura de Talento</label>
                    <select
                      value={form.candidatoRef}
                      onChange={e => handleCandidatoSelect(e.target.value)}
                      className="w-full border border-indigo-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">— Sin vincular —</option>
                      {candidatos.map(c => <option key={c._id} value={c._id}>{c.nombre} · {c.rut}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Proyecto Asignado</label>
                    <select
                      value={form.proyectoRef}
                      onChange={e => setForm(p => ({ ...p, proyectoRef: e.target.value }))}
                      className="w-full border border-indigo-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">— Sin proyecto —</option>
                      {proyectos.map(p => <option key={p._id} value={p._id}>{p.nombreProyecto} {p.centroCosto ? `(${p.centroCosto})` : ''}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Datos Personales */}
              <section>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Users size={11} /> Datos Personales</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nombre Completo *" error={formErrors.nombre}>
                    <input type="text" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                      className={inputCls(formErrors.nombre)} placeholder="Ej: Juan Pérez González" />
                  </Field>
                  <Field label="RUT *" error={formErrors.rut}>
                    <input type="text" value={form.rut}
                      onChange={e => setForm(p => ({ ...p, rut: formatRut(e.target.value) }))}
                      className={inputCls(formErrors.rut)} placeholder="12.345.678-9" />
                  </Field>
                  <Field label="Teléfono / Celular">
                    <input type="tel" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                      className={inputCls()} placeholder="+56 9 1234 5678" />
                  </Field>
                  <Field label="Email">
                    <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className={inputCls()} placeholder="conductor@empresa.cl" />
                  </Field>
                </div>
              </section>

              {/* Vehículo */}
              <section>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Truck size={11} /> Vehículo</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Patente *" error={formErrors.patente}>
                    <input type="text" value={form.patente}
                      onChange={e => setForm(p => ({ ...p, patente: e.target.value.toUpperCase() }))}
                      className={`${inputCls(formErrors.patente)} font-mono tracking-widest uppercase`} placeholder="BXKZ-91" />
                  </Field>
                  <Field label="Marca">
                    <input type="text" value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))}
                      className={inputCls()} placeholder="Toyota, Hyundai..." />
                  </Field>
                  <Field label="Modelo">
                    <input type="text" value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))}
                      className={inputCls()} placeholder="Hilux, Accent..." />
                  </Field>
                  <Field label="Tamaño / Tipo">
                    <select value={form.tamano} onChange={e => setForm(p => ({ ...p, tamano: e.target.value }))} className={inputCls()}>
                      {TAMANOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Año">
                    <input type="number" value={form.anio} onChange={e => setForm(p => ({ ...p, anio: e.target.value }))}
                      className={inputCls()} placeholder="2022" min="1990" max="2030" />
                  </Field>
                  <Field label="Color">
                    <input type="text" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                      className={inputCls()} placeholder="Blanco" />
                  </Field>
                </div>
              </section>

              {/* Licencia + Estado */}
              <section>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><CreditCard size={11} /> Habilitación</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Clase Licencia">
                    <select value={form.licenciaClase} onChange={e => setForm(p => ({ ...p, licenciaClase: e.target.value }))} className={inputCls()}>
                      {LICENCIAS.map(l => <option key={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Vencimiento Licencia">
                    <input type="date" value={form.licenciaVence} onChange={e => setForm(p => ({ ...p, licenciaVence: e.target.value }))} className={inputCls()} />
                  </Field>
                  <Field label="Estado">
                    <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={inputCls()}>
                      {ESTADOS.map(e => <option key={e}>{e}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              {/* Notas */}
              <Field label="Notas internas">
                <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  rows={2} className={inputCls()} placeholder="Observaciones, restricciones de ruta, etc." />
              </Field>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all disabled:opacity-70">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINAR ─────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-red-500" />
            </div>
            <h3 className="font-black text-slate-800 text-lg">¿Eliminar conductor?</h3>
            <p className="text-slate-500 text-sm mt-1 mb-5">
              <strong>{deleteConfirm.nombre}</strong> · {deleteConfirm.patente}<br/>
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 text-sm">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm._id)} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-200">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── INFO GPS ─────────────────────────────────────────────────────── */}
      <div className="mt-6 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <Navigation size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-emerald-800 font-black text-sm">¿Cómo funciona el GPS en tiempo real?</p>
          <p className="text-emerald-700 text-xs mt-1 leading-relaxed">
            Copia el <strong>Enlace GPS</strong> de cada conductor y envíalo a su celular. Al abrirlo, el conductor inicia el rastreo desde su navegador.
            La plataforma usa el GPS nativo del dispositivo mediante la API del navegador y guarda posiciones reales en base de datos, <strong>sin datos simulados</strong>.
            La empresa solo ve sus propios conductores y vehículos (aislamiento total por empresa).
          </p>
        </div>
      </div>

      {/* ── CONEXIONES 360 ───────────────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <Users size={14} />, title: 'Captura de Talento', desc: 'Vincula con trabajadores ya registrados en RRHH. Los datos se sincronizan automáticamente.', color: 'violet' },
          { icon: <FolderOpen size={14} />, title: 'Proyectos', desc: 'Asigna conductores a proyectos de Administración para trazabilidad de costos y rutas.', color: 'indigo' },
          { icon: <Navigation size={14} />, title: 'Conecta GPS', desc: 'Los conductores registrados aquí aparecen en el mapa de Conecta GPS con su vehículo.', color: 'emerald' },
        ].map((c, i) => (
          <div key={i} className={`bg-${c.color}-50 border border-${c.color}-100 rounded-2xl p-3 flex items-start gap-2`}>
            <span className={`text-${c.color}-600 flex-shrink-0 mt-0.5`}>{c.icon}</span>
            <div>
              <p className={`text-${c.color}-800 font-black text-xs`}>{c.title}</p>
              <p className={`text-${c.color}-700 text-[10px] mt-0.5 leading-relaxed`}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── HELPERS DE UI ──────────────────────────────────────────────────────────
const inputCls = (err) =>
  `w-full border ${err ? 'border-red-300 bg-red-50' : 'border-slate-200'} rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all`;

const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
    {children}
    {error && <p className="text-red-500 text-[10px] mt-0.5 font-medium">{error}</p>}
  </div>
);

export default MisConductores;
