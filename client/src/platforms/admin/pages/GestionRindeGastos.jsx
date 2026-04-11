import React, { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, Wallet, Clock, CheckCircle2, XCircle, 
  Download, Filter, Search, Eye, FileText, TrendingUp,
  Building2, Users, Calendar, ArrowUpRight, ArrowDownRight,
  ShieldCheck, AlertCircle, Receipt
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { telecomApi as api } from '../../agentetelecom/telecomApi';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

const GestionRindeGastos = () => {
  const { user } = useAuth();
  const { hasPermission } = useCheckPermission();
  const canEdit = hasPermission('admin_gestion_gastos', 'editar');
  const [gastos, setGastos] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedGasto, setSelectedGasto] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [resGastos, resStats] = await Promise.all([
        api.get('/operaciones/gastos/all'),
        api.get('/operaciones/gastos/stats')
      ]);
      setGastos(resGastos.data);
      setStats(resStats.data);
    } catch (error) {
      console.error("Error fetching admin data:", error);
      showToast("Error al cargar datos administrativos", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, nuevoEstado) => {
    if (!canEdit) {
      showToast('No tienes permiso para gestionar aprobaciones', 'error');
      return;
    }

    try {
      const comentario = prompt("Comentario de Gerencia:");
      await api.patch(`/operaciones/gastos/${id}/estado`, { 
        estado: nuevoEstado, 
        comentarioGerente: comentario 
      });
      showToast(`Gasto ${nuevoEstado.toLowerCase()} por Gerencia`);
      fetchAllData();
      setSelectedGasto(null);
    } catch (error) {
      showToast("Error al procesar aprobación", "error");
    }
  };

  const totals = {
    total: gastos.reduce((s, g) => s + g.monto, 0),
    neto: gastos.reduce((s, g) => s + (g.montoNeto || 0), 0),
    ivaRecup: gastos.reduce((s, g) => s + (g.ivaRecuperable || 0), 0),
    ivaPerdido: gastos.reduce((s, g) => s + (g.ivaPerdido || 0), 0),
    pendientes: gastos.filter(g => g.estado === 'PENDIENTE' || g.estado === 'GERENCIA').length
  };

  const filteredGastos = gastos.filter(g => 
    g.nombre?.toLowerCase().includes(filter.toLowerCase()) || 
    g.rut?.includes(filter) ||
    g.tipoGasto?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 animate-in fade-in duration-700 font-sans">
      {/* Header Admin */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-200">
                <ShieldCheck className="text-white" size={24} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión <span className="text-indigo-600">Admin</span> Gastos</h1>
            </div>
            <p className="text-slate-500 font-medium ml-1">Panel de auditoría, reportería tributaria y flujos de gerencia</p>
          </div>
          
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} /> Exportar Reporte Mensual
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Rendido" value={totals.total} icon={Wallet} color="indigo" sub={`Neto: $${totals.neto.toLocaleString('es-CL')}`} />
          <StatCard title="IVA Recuperable" value={totals.ivaRecup} icon={TrendingUp} color="emerald" sub="Facturas validadas" />
          <StatCard title="IVA Perdido" value={totals.ivaPerdido} icon={AlertCircle} color="amber" sub="Boletas de servicios" />
          <StatCard title="Pendientes" value={totals.pendientes} icon={Clock} color="rose" sub="Requieren atención" isRaw />
        </div>

        {/* Analytics & History */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Table */}
          <div className="lg:col-span-12 bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] shadow-2xl shadow-slate-200 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por técnico, RUT o tipo..." 
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                  {['Todos', 'Pendientes', 'Gerencia'].map(t => (
                    <button key={t} className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/30">
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha / ID</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Doc / Tipo</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Bruto</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">IVA (R/P)</th>
                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                    <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="p-20 text-center"><div className="animate-spin text-indigo-600 mx-auto w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full"/></td></tr>
                  ) : filteredGastos.map(g => (
                    <tr key={g._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-bold text-slate-700">
                        {new Date(g.fechaGasto).toLocaleDateString()}<br/>
                        <span className="text-[9px] font-black text-slate-300 uppercase">#{g._id.slice(-6)}</span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">{g.nombre?.charAt(0)}</div>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-900 leading-tight">{g.nombre}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{g.rut}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className={`text-[9px] font-black uppercase tracking-tighter ${g.tipoDocumento === 'FACTURA' ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {g.tipoDocumento}
                          </span>
                          <span className="text-xs font-bold text-slate-600">{g.tipoGasto} {g.subtipoOtros && `(${g.subtipoOtros})`}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-black text-slate-900">$ {g.monto.toLocaleString('es-CL')}</td>
                      <td className="px-8 py-5">
                         <div className="flex flex-col">
                            {g.ivaRecuperable > 0 && <span className="text-[10px] font-black text-emerald-600">+ ${g.ivaRecuperable.toLocaleString('es-CL')} (R)</span>}
                            {g.ivaPerdido > 0 && <span className="text-[10px] font-black text-rose-400">- ${g.ivaPerdido.toLocaleString('es-CL')} (P)</span>}
                            {!g.ivaRecuperable && !g.ivaPerdido && <span className="text-slate-300">-</span>}
                         </div>
                      </td>
                      <td className="px-8 py-5">
                        <StatusBadge estado={g.estado} />
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => setSelectedGasto(g)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedGasto && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar modal: Image */}
            <div className="md:w-1/2 bg-slate-100 p-8 flex flex-col items-center justify-center border-r border-slate-200">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Comprobante de Gasto</p>
               <img src={selectedGasto.comprobanteUrl} className="max-w-full max-h-[400px] object-contain rounded-2xl shadow-lg border-4 border-white" alt="Boleta"/>
               {selectedGasto.evidenciaAutorizacionUrl && (
                 <div className="mt-8 w-full">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Evidencia de Autorización</p>
                    <img src={selectedGasto.evidenciaAutorizacionUrl} className="w-full h-32 object-cover rounded-2xl shadow-sm opacity-80 hover:opacity-100 transition-all cursor-pointer" alt="Evidencia"/>
                 </div>
               )}
            </div>
            {/* Content modal */}
            <div className="md:w-1/2 p-10 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Detalle de Rendición</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {selectedGasto._id}</p>
                  </div>
                  <button onClick={() => setSelectedGasto(null)} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:bg-slate-200">
                    <XCircle size={20}/>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Colaborador</p>
                    <p className="text-sm font-black text-slate-900">{selectedGasto.nombre}</p>
                    <p className="text-[10px] font-bold text-slate-500">{selectedGasto.rut}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Monto Rendido</p>
                    <p className="text-2xl font-black text-indigo-600">$ {selectedGasto.monto.toLocaleString('es-CL')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tipo de Gasto</p>
                    <p className="text-sm font-black text-slate-900">{selectedGasto.tipoGasto} {selectedGasto.subtipoOtros && `(${selectedGasto.subtipoOtros})`}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Autorizado por</p>
                    <p className="text-sm font-black text-emerald-600">{selectedGasto.autorizador || 'No especificado'}</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Desglose Tributario</p>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-slate-600">Neto:</span>
                      <span className="text-[11px] font-black text-slate-900">$ {selectedGasto.montoNeto?.toLocaleString('es-CL')}</span>
                   </div>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-bold text-slate-600">IVA {selectedGasto.tipoDocumento === 'FACTURA' ? 'Recuperable' : 'Perdido'}:</span>
                      <span className={`text-[11px] font-black ${selectedGasto.tipoDocumento === 'FACTURA' ? 'text-emerald-600' : 'text-rose-400'}`}>
                        $ { (selectedGasto.ivaRecuperable || selectedGasto.ivaPerdido)?.toLocaleString('es-CL') }
                      </span>
                   </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descripción</p>
                  <p className="text-sm text-slate-600 leading-relaxed italic">"{selectedGasto.descripcion || 'Sin descripción adicional.'}"</p>
                </div>
              </div>

              {/* Botones de acción Gerencia */}
              {selectedGasto.estado === 'GERENCIA' && (
                <div className="mt-10 flex gap-4">
                  <button 
                    onClick={() => handleUpdateStatus(selectedGasto._id, 'RECHAZADO')}
                    disabled={!canEdit}
                    className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-2xl border border-red-100 hover:bg-red-600 hover:text-white transition-all uppercase text-[10px] tracking-widest shadow-lg shadow-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Rechazar de Raíz
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedGasto._id, 'APROBADO')}
                    disabled={!canEdit}
                    className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-all uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Aprobación Gerencia
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[200] px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-wide shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

// Sub-componentes
const StatCard = ({ title, value, icon: Icon, color, sub, isRaw }) => {
  const styles = {
    indigo: "from-indigo-600 to-indigo-700 shadow-indigo-100 text-indigo-100",
    emerald: "from-emerald-500 to-emerald-600 shadow-emerald-100 text-emerald-50",
    amber: "from-amber-400 to-amber-500 shadow-amber-100 text-amber-50",
    rose: "from-rose-500 to-rose-600 shadow-rose-100 text-rose-50"
  };
  return (
    <div className={`bg-white border border-slate-200 p-7 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:translate-y-[-4px] transition-all`}>
      <div className={`inline-flex p-3 rounded-2xl mb-5 bg-${color}-50 text-${color}-600`}>
        <Icon size={22} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-3xl font-black text-slate-900 leading-tight">
          {isRaw ? value : `$ ${value.toLocaleString('es-CL')}`}
        </p>
        <p className={`text-[10px] font-bold mt-2 text-${color}-600 uppercase tracking-tighter`}>{sub}</p>
      </div>
    </div>
  );
};

const StatusBadge = ({ estado }) => {
  const config = {
    PENDIENTE: { color: 'bg-amber-100 text-amber-700', icon: Clock },
    GERENCIA: { color: 'bg-indigo-100 text-indigo-700', icon: ShieldCheck },
    APROBADO: { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    RECHAZADO: { color: 'bg-red-100 text-red-700', icon: XCircle },
    PAGADO: { color: 'bg-blue-100 text-blue-700', icon: Wallet }
  };
  const { color, icon: Icon } = config[estado] || config.PENDIENTE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${color}`}>
      <Icon size={12} strokeWidth={3} />
      {estado}
    </span>
  );
};

export default GestionRindeGastos;
