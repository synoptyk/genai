import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, Search, 
  Filter, ArrowLeft, MessageSquare, Calendar, Hash, User, 
  Tv, Wifi, ChevronRight, AlertCircle, RefreshCw, Phone, Award
} from 'lucide-react';
import telecomApi from './telecomApi';

const formatRut = (rut) => {
  if (!rut) return '';
  let clean = String(rut).replace(/[^0-9kK]/g, '');
  if (clean.length < 2) return clean;
  let cuerpo = clean.slice(0, -1);
  let dv = clean.slice(-1).toUpperCase();
  let formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedCuerpo}-${dv}`;
};

export default function ApelacionesPanel() {
  const navigate = useNavigate();
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('por_validar'); // 'por_validar', 'aprobada', 'rechazada', 'todas'
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Fetch appeals from backend
  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await telecomApi.get('/tecnicos/produccion/apelaciones');
      setAppeals(res.data || []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
      showNotification('error', 'Error al cargar las apelaciones. Por favor intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();

    const handleNewAppeal = () => {
      console.log("🔄 [ApelacionesPanel] Recibida notificación de nueva apelación en tiempo real. Recargando...");
      fetchAppeals();
    };

    window.addEventListener('newAppealNotif', handleNewAppeal);
    return () => {
      window.removeEventListener('newAppealNotif', handleNewAppeal);
    };
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Resolve Appeal (Approve or Reject)
  const handleResolve = async (status) => {
    if (!selectedAppeal) return;
    if (status === 'rechazada' && !feedback.trim()) {
      showNotification('error', 'Debe ingresar un comentario para poder rechazar la apelación.');
      return;
    }

    setSubmitting(true);
    try {
      await telecomApi.post(`/tecnicos/produccion/apelacion/${selectedAppeal._id}/resolver`, {
        status,
        respuesta: feedback
      });

      showNotification('success', `Apelación ${status === 'aprobada' ? 'APROBADA' : 'RECHAZADA'} con éxito. Los puntos y KPIs se han recalculado.`);
      setSelectedAppeal(null);
      setFeedback('');
      fetchAppeals(); // Reload list
    } catch (err) {
      console.error('Error resolving appeal:', err);
      showNotification('error', err.response?.data?.error || 'Error al procesar la resolución de la apelación.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtering logic
  const filteredAppeals = appeals.filter(a => {
    // Tab filter
    if (activeTab !== 'todas' && a.apelacion?.status !== activeTab) return false;

    // Search filter
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const ot = String(a.peticion || a.ordenId || '').toLowerCase();
    const tech = String(a.tecnicoNombre || a.NOMBRE || '').toLowerCase();
    const act = String(a.actividadVisible || a.actividad || '').toLowerCase();
    
    return ot.includes(term) || tech.includes(term) || act.includes(term);
  });

  // Calculate Metrics
  const metrics = {
    total: appeals.length,
    pending: appeals.filter(a => a.apelacion?.status === 'por_validar').length,
    approved: appeals.filter(a => a.apelacion?.status === 'aprobada').length,
    rejected: appeals.filter(a => a.apelacion?.status === 'rechazada').length,
  };

  return (
    <div className="space-y-6 animate-fade-in p-1 max-w-[1600px] mx-auto text-slate-800">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl transition-all duration-300 transform scale-100 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-250 text-emerald-900 shadow-emerald-100/50' 
            : 'bg-rose-50 border-rose-250 text-rose-900 shadow-rose-100/50'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* Header Premium (Light Theme) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/rendimiento')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-sky-50 text-sky-600 border border-sky-200 rounded-full">
                Módulo Administrativo
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-sky-600" /> Centro de Apelaciones
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Audita, aprueba, rechaza y comenta apelaciones de producción ingresadas por los técnicos en tiempo real.
            </p>
          </div>
        </div>
        <button 
          onClick={fetchAppeals} 
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-all duration-200"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          Refrescar Datos
        </button>
      </div>

      {/* Metrics Grid (Light Theme) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric Total */}
        <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-sky-600"><ClipboardCheck className="w-24 h-24" /></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Apelaciones</span>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-50 border border-sky-100 text-sky-600"><ClipboardCheck className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">{metrics.total}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Registros en el sistema actual</div>
        </div>

        {/* Metric Pending */}
        <div className="relative overflow-hidden bg-white border border-slate-250/90 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-amber-400 transition-all duration-200">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-amber-500"><Clock className="w-24 h-24" /></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pendientes de Validación</span>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 border border-amber-100 text-amber-600"><Clock className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-amber-600 mt-2">{metrics.pending}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Requieren revisión inmediata</div>
        </div>

        {/* Metric Approved */}
        <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-emerald-500 transition-all duration-200">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500"><CheckCircle2 className="w-24 h-24" /></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aprobadas / Puntos Sumados</span>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">{metrics.approved}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Puntos aplicados con éxito</div>
        </div>

        {/* Metric Rejected */}
        <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-rose-500 transition-all duration-200">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-500"><XCircle className="w-24 h-24" /></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Apelaciones Rechazadas</span>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 border border-rose-100 text-rose-600"><XCircle className="w-4 h-4" /></span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-rose-600 mt-2">{metrics.rejected}</div>
          <div className="text-[10px] text-slate-500 mt-1 font-semibold">Desestimadas con retroalimentación</div>
        </div>
      </div>

      {/* Main Control Panel (Light Theme) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Navigation Tabs and Search */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-50/60">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-150/70 border border-slate-200 rounded-xl max-w-fit overflow-x-auto">
            <button 
              onClick={() => setActiveTab('por_validar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'por_validar' 
                  ? 'bg-white shadow-sm border border-slate-200 text-amber-600' 
                  : 'text-slate-500 border border-transparent hover:text-slate-800'
              }`}
            >
              Pendientes ({metrics.pending})
            </button>
            <button 
              onClick={() => setActiveTab('aprobada')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'aprobada' 
                  ? 'bg-white shadow-sm border border-slate-200 text-emerald-600' 
                  : 'text-slate-500 border border-transparent hover:text-slate-800'
              }`}
            >
              Aprobadas ({metrics.approved})
            </button>
            <button 
              onClick={() => setActiveTab('rechazada')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'rechazada' 
                  ? 'bg-white shadow-sm border border-slate-200 text-rose-600' 
                  : 'text-slate-500 border border-transparent hover:text-slate-800'
              }`}
            >
              Rechazadas ({metrics.rejected})
            </button>
            <button 
              onClick={() => setActiveTab('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                activeTab === 'todas' 
                  ? 'bg-slate-800 border border-slate-700 text-white shadow-sm' 
                  : 'text-slate-500 border border-transparent hover:text-slate-800'
              }`}
            >
              Todas ({metrics.total})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por OT, técnico o actividad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-450 outline-none transition-all duration-200 font-medium"
            />
          </div>
        </div>

        {/* Data Table (Light Theme) */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-3 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-500">Cargando apelaciones de producción...</span>
            </div>
          ) : filteredAppeals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-sm font-black text-slate-700">No se encontraron apelaciones</h3>
              <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
                {searchTerm 
                  ? 'Intente cambiando los términos de búsqueda o filtros aplicados.' 
                  : 'No existen registros en el estado seleccionado para este período.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Técnico</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Actividad / Orden ID</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Equipos Solicitados</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Justificación Técnico</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado / Fecha</th>
                  <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAppeals.map((item) => (
                  <tr 
                    key={item._id}
                    className="hover:bg-slate-50/50 transition-all duration-150 group"
                  >
                    {/* Técnico Profile */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600 text-xs overflow-hidden">
                          {item.tecnicoAvatar ? (
                            <img src={item.tecnicoAvatar} alt={item.tecnicoNombre} className="w-full h-full object-cover" />
                          ) : (
                            String(item.tecnicoNombre || 'T').substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-sky-600 transition-colors duration-150">{item.tecnicoNombre}</div>
                          <div className="flex flex-col text-[10px] text-slate-500 mt-0.5 gap-0.5">
                            <span>RUT: {formatRut(item.tecnicoRutFormateado || item.apelacion?.rut || item.rut)}</span>
                            <span className="text-[9px] text-sky-600 font-black tracking-wider uppercase">TOA ID: {item.tecnicoToaId || item.idRecursoToa || 'SIN'}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Actividad / Orden */}
                    <td className="px-5 py-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-black text-slate-900">{item.peticion || item.ordenId || 'S/N'}</span>
                        </div>
                        <div className="text-[10px] text-slate-550 mt-1 font-bold leading-tight">
                          <span className="text-slate-450">Orig:</span> {item.actividadVisible || item.actividad || 'Op. Técnica'} <span className="font-mono text-slate-650 bg-slate-100 px-1 py-0.2 rounded font-black">({item.Pts_Actividad_Base || item.PTS_ACTIVIDAD_BASE || 0} pts)</span>
                          {item.apelacion?.codigoLpu && (
                            <div className="mt-1.5 flex flex-col gap-0.5">
                              <span className="text-[9px] text-amber-700 font-extrabold flex items-center gap-1">
                                ➔ Apela: [{item.apelacion.codigoLpu}] <span className="font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md font-black">({item.apelacion.puntosBase || 0} pts)</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Equipos */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {parseInt(item.apelacion?.equipos?.decos || 0) > 0 && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-650 text-[10px] font-black">
                            <Tv className="w-3.5 h-3.5 text-indigo-500" />
                            {item.apelacion.equipos.decos} Decos
                          </div>
                        )}
                        {parseInt(item.apelacion?.equipos?.repetidores || 0) > 0 && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-150 text-teal-605 text-[10px] font-black">
                            <Wifi className="w-3.5 h-3.5 text-teal-500" />
                            {item.apelacion.equipos.repetidores} WiFi
                          </div>
                        )}
                        {parseInt(item.apelacion?.equipos?.telefonos || 0) > 0 && (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-600 text-[10px] font-black">
                            <Phone className="w-3.5 h-3.5 text-emerald-500" />
                            {item.apelacion.equipos.telefonos} Telf.
                          </div>
                        )}
                        {!item.apelacion?.equipos?.decos && !item.apelacion?.equipos?.repetidores && !item.apelacion?.equipos?.telefonos && (
                          <span className="text-[10px] text-slate-400 font-bold">Sólo revisión de puntos</span>
                        )}
                      </div>
                    </td>

                    {/* Justificación */}
                    <td className="px-5 py-4 max-w-xs">
                      <div className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                        "{item.apelacion?.observacion || 'Sin observaciones ingresadas.'}"
                      </div>
                    </td>

                    {/* Estado / Fecha */}
                    <td className="px-5 py-4">
                      <div>
                        {item.apelacion?.status === 'por_validar' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                            <Clock className="w-2.5 h-2.5" /> Pendiente
                          </span>
                        )}
                        {item.apelacion?.status === 'aprobada' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Aprobada
                          </span>
                        )}
                        {item.apelacion?.status === 'rechazada' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                            <XCircle className="w-2.5 h-2.5" /> Rechazada
                          </span>
                        )}
                        
                        <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1.5 font-bold">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {item.apelacion?.fechaSolicitud 
                            ? new Date(item.apelacion.fechaSolicitud).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : new Date(item.fecha || item.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td className="px-5 py-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedAppeal(item);
                          setFeedback(item.apelacion?.respuesta || '');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-55/70 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200"
                      >
                        {item.apelacion?.status === 'por_validar' ? 'Evaluar' : 'Detalles'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal (Light Theme Glassmorphism overlay) */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up text-slate-800">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Evaluación de Apelación</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">OT: {selectedAppeal.peticion || selectedAppeal.ordenId}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAppeal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 border border-slate-200 transition-all font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Technician Info */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-650 overflow-hidden">
                  {selectedAppeal.tecnicoAvatar ? (
                    <img src={selectedAppeal.tecnicoAvatar} alt={selectedAppeal.tecnicoNombre} className="w-full h-full object-cover" />
                  ) : (
                    String(selectedAppeal.tecnicoNombre || 'T').substring(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-950">{selectedAppeal.tecnicoNombre}</div>
                  <div className="flex flex-col text-[10px] text-slate-500 mt-0.5 font-bold gap-0.5">
                    <span>RUT: {formatRut(selectedAppeal.tecnicoRutFormateado || selectedAppeal.apelacion?.rut || selectedAppeal.rut)}</span>
                    <span>Email: {selectedAppeal.tecnicoEmail || 'Sin email corporativo'}</span>
                    <span className="text-[9px] text-sky-600 font-black tracking-wider uppercase">TOA ID Técnico: {selectedAppeal.tecnicoToaId || selectedAppeal.idRecursoToa || 'Sin ID TOA'}</span>
                  </div>
                </div>
              </div>
                           {/* Motivo de Reclamo Card */}
              {selectedAppeal.apelacion?.motivo && (
                <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-amber-100 text-amber-600">
                    <Award className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block">Motivo Declarado del Reclamo</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5">
                      {selectedAppeal.apelacion.motivo === 'error_mapeo' && 'Actividad o código LPU incorrecto'}
                      {selectedAppeal.apelacion.motivo === 'equipos_faltantes' && 'Equipos adicionales faltantes'}
                      {selectedAppeal.apelacion.motivo === 'puntos_base' && 'Diferencia en puntos base LPU'}
                      {selectedAppeal.apelacion.motivo === 'otro' && 'Otro motivo operacional'}
                      {!['error_mapeo', 'equipos_faltantes', 'puntos_base', 'otro'].includes(selectedAppeal.apelacion.motivo) && selectedAppeal.apelacion.motivo}
                    </span>
                  </div>
                </div>
              )}

              {/* OT Info Details & Comparative Delta Table */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block border-b border-slate-150 pb-1.5">Análisis Comparativo (TOA vs Apelación)</span>
                
                <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-inner">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-black uppercase text-[8px] text-slate-450 tracking-wider">
                        <th className="px-4 py-3">Campo / Parámetro</th>
                        <th className="px-4 py-3">Registrado en TOA</th>
                        <th className="px-4 py-3">Apelado por Técnico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                      {/* Row LPU Code & Actividad */}
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Actividad LPU</td>
                        <td className="px-4 py-3 text-slate-700">
                          {selectedAppeal.actividadVisible || selectedAppeal.actividad || 'Op. Técnica'}
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">Cód: {selectedAppeal.CODIGO_LPU_BASE || selectedAppeal.COD_LPU || selectedAppeal['Cód LPU'] || 'SIN LPU'}</div>
                        </td>
                        <td className="px-4 py-3 bg-amber-50/20 font-bold text-amber-800">
                          {selectedAppeal.apelacion?.codigoLpu ? (
                            <>
                              Apela a: [{selectedAppeal.apelacion.codigoLpu}]
                              <div className="text-[9px] font-bold text-amber-600 mt-0.5 uppercase">Mapeo LPU manual</div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">Sin cambios propuestos</span>
                          )}
                        </td>
                      </tr>

                      {/* Row Puntos Base */}
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Puntos Base</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{selectedAppeal.Pts_Actividad_Base || selectedAppeal.PTS_ACTIVIDAD_BASE || 0} PTS</td>
                        <td className="px-4 py-3 bg-indigo-50/20 font-mono font-black text-indigo-700">
                          {selectedAppeal.apelacion?.puntosBase && selectedAppeal.apelacion?.puntosBase > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <span>{selectedAppeal.apelacion.puntosBase} PTS</span>
                              {selectedAppeal.apelacion.puntosBase !== (selectedAppeal.Pts_Actividad_Base || selectedAppeal.PTS_ACTIVIDAD_BASE || 0) && (
                                <span className="px-1.5 py-0.2 text-[8px] bg-indigo-100 rounded-md text-indigo-700">
                                  {(selectedAppeal.apelacion.puntosBase - (selectedAppeal.Pts_Actividad_Base || selectedAppeal.PTS_ACTIVIDAD_BASE || 0)) > 0 ? '+' : ''}
                                  {(selectedAppeal.apelacion.puntosBase - (selectedAppeal.Pts_Actividad_Base || selectedAppeal.PTS_ACTIVIDAD_BASE || 0)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Sin cambios propuestos</span>
                          )}
                        </td>
                      </tr>

                      {/* Row Decos */}
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Decos Adicionales</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Decos_Adicionales || 0}</td>
                        <td className={`px-4 py-3 font-mono font-black ${parseInt(selectedAppeal.apelacion?.equipos?.decos || 0) !== parseInt(selectedAppeal.Decos_Adicionales || 0) ? 'bg-emerald-50/20 text-emerald-700' : 'text-slate-650'}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{selectedAppeal.apelacion?.equipos?.decos || 0}</span>
                            {parseInt(selectedAppeal.apelacion?.equipos?.decos || 0) !== parseInt(selectedAppeal.Decos_Adicionales || 0) && (
                              <span className="px-1.5 py-0.2 text-[8px] bg-emerald-100 rounded-md text-emerald-700">
                                +{parseInt(selectedAppeal.apelacion.equipos.decos || 0) - parseInt(selectedAppeal.Decos_Adicionales || 0)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Row Repeaters */}
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Repetidores WiFi</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Repetidores_WiFi || 0}</td>
                        <td className={`px-4 py-3 font-mono font-black ${parseInt(selectedAppeal.apelacion?.equipos?.repetidores || 0) !== parseInt(selectedAppeal.Repetidores_WiFi || 0) ? 'bg-emerald-50/20 text-emerald-700' : 'text-slate-650'}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{selectedAppeal.apelacion?.equipos?.repetidores || 0}</span>
                            {parseInt(selectedAppeal.apelacion?.equipos?.repetidores || 0) !== parseInt(selectedAppeal.Repetidores_WiFi || 0) && (
                              <span className="px-1.5 py-0.2 text-[8px] bg-emerald-100 rounded-md text-emerald-700">
                                +{parseInt(selectedAppeal.apelacion.equipos.repetidores || 0) - parseInt(selectedAppeal.Repetidores_WiFi || 0)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Row Telefonos */}
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Teléfonos (Voz)</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Telefonos || 0}</td>
                        <td className={`px-4 py-3 font-mono font-black ${parseInt(selectedAppeal.apelacion?.equipos?.telefonos || 0) !== parseInt(selectedAppeal.Telefonos || 0) ? 'bg-emerald-50/20 text-emerald-700' : 'text-slate-650'}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{selectedAppeal.apelacion?.equipos?.telefonos || 0}</span>
                            {parseInt(selectedAppeal.apelacion?.equipos?.telefonos || 0) !== parseInt(selectedAppeal.Telefonos || 0) && (
                              <span className="px-1.5 py-0.2 text-[8px] bg-emerald-100 rounded-md text-emerald-700">
                                +{parseInt(selectedAppeal.apelacion.equipos.telefonos || 0) - parseInt(selectedAppeal.Telefonos || 0)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Justification Text */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-150 pb-1.5">Observación del Técnico</span>
                <p className="text-xs text-slate-700 mt-2 leading-relaxed italic bg-white p-3 border border-slate-150 rounded-xl font-medium">
                  "{selectedAppeal.apelacion?.observacion || 'Sin justificación ingresada.'}"
                </p>
              </div>

              {/* Comment Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-sky-600" /> Retroalimentación del Supervisor
                </label>
                <textarea 
                  rows="3"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={selectedAppeal.apelacion?.status === 'por_validar' ? "Escriba un comentario o respuesta explicando el porqué de la decisión..." : "Comentario final guardado"}
                  disabled={selectedAppeal.apelacion?.status !== 'por_validar'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-sky-500 focus:bg-white rounded-2xl text-xs text-slate-800 placeholder-slate-400 outline-none transition-all resize-none disabled:opacity-60 font-medium"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
              <button 
                onClick={() => setSelectedAppeal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-850 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cerrar
              </button>
              
              {selectedAppeal.apelacion?.status === 'por_validar' ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleResolve('rechazada')}
                    disabled={submitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-sm shadow-rose-100 border border-rose-600 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button 
                    onClick={() => handleResolve('aprobada')}
                    disabled={submitting}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-sm border border-emerald-600 disabled:opacity-50"
                  >
                    Aprobar en Caliente
                  </button>
                </div>
              ) : (
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  Resuelto el {selectedAppeal.apelacion?.fechaRespuesta 
                    ? new Date(selectedAppeal.apelacion.fechaRespuesta).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
                    : 'N/D'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
