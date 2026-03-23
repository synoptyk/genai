import React, { useState, useEffect, useCallback } from 'react';
import { telecomApi as api } from './telecomApi';
import {
  DollarSign, Users, Plus, Trash2, Edit3,
  Save, X, Search, TrendingUp, CreditCard,
  Building2, Palette, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Hash, FileText, Eye, Coins, ArrowUpRight, Loader2
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const formatCLP = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  return '$' + Math.round(Number(n)).toLocaleString('es-CL');
};

const COLORES_PRESET = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

// ─── Componente Principal ───────────────────────────────────────────────────────
const Tarifario = () => {
  // Estado principal
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    cliente: '', proyecto: '', descripcion: '',
    valor_punto: '', moneda: 'CLP', iva_incluido: false,
    activo: true, color: '#3b82f6'
  });

  // Resumen de producción
  const [resumen, setResumen] = useState(null);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [expandedCliente, setExpandedCliente] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // Toast helper
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Cargar clientes ─────────────────────────────────────────────────────────
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/valor-punto');
      setClientes(res.data);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      showToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ── Cargar resumen de producción valorizada ─────────────────────────────────
  const fetchResumen = useCallback(async () => {
    setLoadingResumen(true);
    try {
      // Obtener datos TOA para calcular resumen
      const res = await api.get('/bot/datos-toa');
      const datos = res.data?.datos || [];

      // Agrupar por Cliente_Tarifa
      const porCliente = {};
      let totalGeneral = 0;
      let totalPuntos = 0;
      let totalOrdenes = 0;

      datos.forEach(d => {
        const pts = parseFloat(d.Pts_Total_Baremo) || 0;
        const valor = parseFloat(d.Valor_Actividad_CLP) || 0;
        const cliente = d.Cliente_Tarifa || 'Sin Asignar';

        if (!porCliente[cliente]) {
          porCliente[cliente] = { ordenes: 0, puntos: 0, valor: 0 };
        }
        porCliente[cliente].ordenes++;
        porCliente[cliente].puntos += pts;
        porCliente[cliente].valor += valor;
        totalGeneral += valor;
        totalPuntos += pts;
        totalOrdenes++;
      });

      setResumen({ porCliente, totalGeneral, totalPuntos, totalOrdenes });
    } catch (error) {
      console.error('Error cargando resumen:', error);
    } finally {
      setLoadingResumen(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
    fetchResumen();
  }, [fetchClientes, fetchResumen]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, valor_punto: parseFloat(form.valor_punto) || 0 };
      if (isEditing) {
        await api.put(`/valor-punto/${form._id}`, payload);
        showToast('Cliente actualizado correctamente');
      } else {
        await api.post('/valor-punto', payload);
        showToast('Nuevo cliente creado correctamente');
      }
      setModalOpen(false);
      fetchClientes();
      fetchResumen();
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar el cliente "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/valor-punto/${id}`);
      showToast('Cliente eliminado');
      fetchClientes();
      fetchResumen();
    } catch (error) {
      showToast('Error al eliminar', 'error');
    }
  };

  const toggleActivo = async (cliente) => {
    try {
      await api.put(`/valor-punto/${cliente._id}`, { activo: !cliente.activo });
      fetchClientes();
      showToast(`Cliente ${!cliente.activo ? 'activado' : 'desactivado'}`);
    } catch (error) {
      showToast('Error al cambiar estado', 'error');
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setForm({ ...item });
      setIsEditing(true);
    } else {
      setForm({
        cliente: '', proyecto: '', descripcion: '',
        valor_punto: '', moneda: 'CLP', iva_incluido: false,
        activo: true, color: COLORES_PRESET[clientes.length % COLORES_PRESET.length]
      });
      setIsEditing(false);
    }
    setModalOpen(true);
  };

  // ── Filtro ──────────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    c.cliente.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.proyecto || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in duration-500 pb-20 max-w-[100vw] overflow-x-hidden">

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] animate-in slide-in-from-right duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 mb-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
        </div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                  <CreditCard className="text-indigo-400" size={28} />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                    Tarifario <span className="text-indigo-400">&</span> Baremos
                  </h1>
                  <p className="text-indigo-300/70 text-xs font-bold tracking-widest mt-0.5">
                    VALORIZACIÓN FINANCIERA POR PUNTO BAREMO
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-xs mt-3 max-w-xl">
                Configure el precio por punto baremo para cada cliente o proyecto.
                Cada orden se valoriza automáticamente multiplicando sus puntos de producción
                por el valor configurado aquí.
              </p>
            </div>

            <button
              onClick={() => openModal()}
              className="group bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all whitespace-nowrap"
            >
              <Plus size={18} /> Nuevo Cliente / Proyecto
            </button>
          </div>

          {/* ── Stat Cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            <StatCard
              icon={Building2} label="Clientes Activos"
              value={clientes.filter(c => c.activo).length}
              color="indigo" loading={loading}
            />
            <StatCard
              icon={Coins} label="Puntos Totales"
              value={resumen ? resumen.totalPuntos.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '—'}
              color="amber" loading={loadingResumen}
            />
            <StatCard
              icon={Hash} label="Órdenes Valorizadas"
              value={resumen ? resumen.totalOrdenes.toLocaleString('es-CL') : '—'}
              color="cyan" loading={loadingResumen}
            />
            <StatCard
              icon={DollarSign} label="Valor Total"
              value={resumen ? formatCLP(resumen.totalGeneral) : '—'}
              color="emerald" loading={loadingResumen}
              highlight
            />
          </div>
        </div>
      </div>

      {/* ── Barra de búsqueda ──────────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por cliente, proyecto o descripción..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="text-xs text-slate-400 font-bold">
          {clientesFiltrados.length} de {clientes.length} clientes
        </div>
      </div>

      {/* ── Tarjetas de Clientes/Proyectos ─────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : clientes.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center">
          <div className="inline-flex p-4 bg-indigo-50 rounded-2xl mb-4">
            <Users className="text-indigo-400" size={40} />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-2">Sin Clientes Configurados</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Agregue clientes o proyectos con su valor por punto baremo para comenzar a valorizar la producción de su equipo.
          </p>
          <button
            onClick={() => openModal()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase inline-flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus size={18} /> Crear Primer Cliente
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clientesFiltrados.map((cliente) => {
            const resumenCliente = resumen?.porCliente?.[cliente.cliente];
            const isExpanded = expandedCliente === cliente._id;

            return (
              <div
                key={cliente._id}
                className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                  !cliente.activo ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                {/* Barra de color superior */}
                <div className="h-1.5" style={{ backgroundColor: cliente.color || '#3b82f6' }} />

                <div className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-4">
                    {/* Info principal */}
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                        style={{ backgroundColor: cliente.color || '#3b82f6' }}
                      >
                        {cliente.cliente?.charAt(0) || '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-black text-slate-800 tracking-tight">
                            {cliente.cliente}
                          </h3>
                          {cliente.proyecto && (
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase">
                              {cliente.proyecto}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            cliente.activo
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {cliente.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        {cliente.descripcion && (
                          <p className="text-slate-400 text-xs mt-1 truncate max-w-lg">{cliente.descripcion}</p>
                        )}
                      </div>
                    </div>

                    {/* Valor punto + stats */}
                    <div className="flex items-center gap-6">
                      {/* Valor por punto */}
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor / Punto</p>
                        <p className="text-2xl font-black text-indigo-600 tracking-tight">
                          {formatCLP(cliente.valor_punto)}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {cliente.moneda} {cliente.iva_incluido ? '(IVA incluido)' : '(+ IVA)'}
                        </p>
                      </div>

                      {/* Stats del resumen */}
                      {resumenCliente && (
                        <>
                          <div className="h-12 w-px bg-slate-200" />
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Órdenes</p>
                            <p className="text-lg font-black text-slate-700">{resumenCliente.ordenes.toLocaleString('es-CL')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Puntos</p>
                            <p className="text-lg font-black text-amber-600">{resumenCliente.puntos.toLocaleString('es-CL', { maximumFractionDigits: 1 })}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Valor Total</p>
                            <p className="text-lg font-black text-emerald-600">{formatCLP(resumenCliente.valor)}</p>
                          </div>
                        </>
                      )}

                      {/* Acciones */}
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={() => setExpandedCliente(isExpanded ? null : cliente._id)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button
                          onClick={() => toggleActivo(cliente)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={cliente.activo ? 'Desactivar' : 'Activar'}
                        >
                          {cliente.activo ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                        </button>
                        <button
                          onClick={() => openModal(cliente)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente._id, cliente.cliente)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Panel expandido con detalles */}
                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <DetailBox label="Moneda" value={cliente.moneda} />
                        <DetailBox label="IVA Incluido" value={cliente.iva_incluido ? 'Sí' : 'No'} />
                        <DetailBox label="Estado" value={cliente.activo ? 'Activo' : 'Inactivo'} />
                        <DetailBox label="Color" value={
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cliente.color }} />
                            <span className="font-mono text-[10px]">{cliente.color}</span>
                          </div>
                        } />
                      </div>

                      {/* Ejemplo de cálculo */}
                      <div className="bg-slate-50 rounded-xl p-4 mt-4">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                          <TrendingUp size={12} /> Ejemplo de Cálculo
                        </h4>
                        <div className="flex items-center gap-3 text-sm flex-wrap">
                          <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-black">
                            1 Punto Baremo
                          </span>
                          <span className="text-slate-400">×</span>
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-black">
                            {formatCLP(cliente.valor_punto)}
                          </span>
                          <span className="text-slate-400">=</span>
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-black">
                            {formatCLP(cliente.valor_punto)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm mt-3 flex-wrap">
                          <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-black">
                            3.75 Puntos (Triple Play)
                          </span>
                          <span className="text-slate-400">×</span>
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-black">
                            {formatCLP(cliente.valor_punto)}
                          </span>
                          <span className="text-slate-400">=</span>
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-black flex items-center gap-1">
                            <ArrowUpRight size={14} />
                            {formatCLP(3.75 * cliente.valor_punto)}
                          </span>
                        </div>
                      </div>

                      {/* Timestamps */}
                      <div className="flex gap-6 mt-4 text-[10px] text-slate-400">
                        {cliente.createdAt && (
                          <span>Creado: {new Date(cliente.createdAt).toLocaleDateString('es-CL')}</span>
                        )}
                        {cliente.updatedAt && (
                          <span>Actualizado: {new Date(cliente.updatedAt).toLocaleDateString('es-CL')}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Guía de uso ────────────────────────────────────────────────────── */}
      <div className="mt-10 bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-8">
        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-4">
          <Eye size={18} className="text-indigo-500" />
          ¿Cómo funciona la Valorización?
        </h3>
        <div className="grid md:grid-cols-3 gap-6 text-xs text-slate-600">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-black text-indigo-600">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">1</span>
              Configurar Clientes
            </div>
            <p className="leading-relaxed">
              Agregue cada cliente o proyecto con su <strong>valor por punto baremo</strong>.
              Cada empresa puede tener múltiples clientes con precios diferentes.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-black text-indigo-600">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">2</span>
              Cálculo Automático
            </div>
            <p className="leading-relaxed">
              Cada orden descargada tiene sus <strong>puntos baremo</strong> calculados según
              la configuración LPU. El sistema multiplica puntos × valor para obtener el monto.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-black text-indigo-600">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">3</span>
              Visualización
            </div>
            <p className="leading-relaxed">
              En la tabla de <strong>Descarga TOA</strong> y en las exportaciones Excel,
              cada orden muestra su valor monetario: <code className="bg-white px-1.5 py-0.5 rounded text-indigo-600 font-mono">Valor_Actividad_CLP</code>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modal Crear/Editar ─────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 flex justify-between items-center">
              <h3 className="font-black text-white text-sm uppercase flex items-center gap-2">
                {isEditing ? <Edit3 size={18} /> : <Plus size={18} />}
                {isEditing ? 'Editar Cliente / Proyecto' : 'Nuevo Cliente / Proyecto'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Cliente y Proyecto */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                    Cliente <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    placeholder="Ej: MOVISTAR"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-indigo-500 uppercase transition-all"
                    value={form.cliente}
                    onChange={e => setForm({ ...form, cliente: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Proyecto</label>
                  <input
                    placeholder="Ej: Residencial, FTTH"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    value={form.proyecto}
                    onChange={e => setForm({ ...form, proyecto: e.target.value })}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Descripción</label>
                <textarea
                  rows="2"
                  placeholder="Nota descriptiva del cliente o proyecto..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-indigo-500 resize-none transition-all"
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                />
              </div>

              {/* Valor por Punto + Moneda */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                    Valor por Punto <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                      value={form.valor_punto}
                      onChange={e => setForm({ ...form, valor_punto: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Moneda</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    value={form.moneda}
                    onChange={e => setForm({ ...form, moneda: e.target.value })}
                  >
                    <option value="CLP">CLP (Peso Chileno)</option>
                    <option value="USD">USD (Dólar)</option>
                    <option value="UF">UF</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">IVA Incluido</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, iva_incluido: !form.iva_incluido })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      form.iva_incluido
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    {form.iva_incluido ? <ToggleRight size={18} className="text-emerald-500" /> : <ToggleLeft size={18} />}
                    {form.iva_incluido ? 'Sí' : 'No'}
                  </button>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2 flex items-center gap-1.5">
                  <Palette size={12} /> Color Identificador
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLORES_PRESET.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-lg transition-all ${
                        form.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                    title="Color personalizado"
                  />
                </div>
              </div>

              {/* Preview del cálculo */}
              {form.valor_punto && parseFloat(form.valor_punto) > 0 && (
                <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Vista previa del cálculo</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">1 Pto</span>
                    <span className="text-slate-400">×</span>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold">{formatCLP(parseFloat(form.valor_punto))}</span>
                    <span className="text-slate-400">=</span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black">{formatCLP(parseFloat(form.valor_punto))}</span>
                    <span className="text-slate-300 mx-1">|</span>
                    <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-bold">3.75 Pts</span>
                    <span className="text-slate-400">=</span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black">{formatCLP(3.75 * parseFloat(form.valor_punto))}</span>
                  </div>
                </div>
              )}

              {/* Botón guardar */}
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-componentes ────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, loading: isLoading, highlight }) => {
  const colors = {
    indigo: 'from-indigo-500/20 to-indigo-600/10 text-indigo-400 border-indigo-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 text-amber-400 border-amber-500/20',
    cyan: 'from-cyan-500/20 to-cyan-600/10 text-cyan-400 border-cyan-500/20',
    emerald: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/20',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={`text-${color}-400`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className={`text-xl font-black text-white ${highlight ? 'text-2xl' : ''}`}>
        {isLoading ? <Loader2 size={18} className="animate-spin" /> : value}
      </p>
    </div>
  );
};

const DetailBox = ({ label, value }) => (
  <div className="bg-slate-50 rounded-lg p-3">
    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
    <div className="text-xs font-bold text-slate-700">{value}</div>
  </div>
);

export default Tarifario;
