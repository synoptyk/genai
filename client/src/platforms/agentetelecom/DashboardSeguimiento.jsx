import React, { useState, useEffect } from 'react';
import telecomApi from './telecomApi';
import { useNavigate } from 'react-router-dom';
import {
   Truck, Users, DollarSign, Wallet,
   BarChart2, ChevronDown, Car, AlertCircle, X, Loader2,
   UserPlus, CheckCircle2, UserX, FolderKanban, Clock,
   TrendingUp, Activity, RefreshCw, Building2, ShieldAlert,
   Calendar
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhh/rrhhApi';

/* ── helpers ── */
const money = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);
const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0;

/* ── quick-access modules ── */
const QUICK_MODULES = [
   { label: 'Administración RRHH', path: '/rrhh', icon: Users, color: 'indigo' },
   { label: 'Captura de Talento', path: '/rrhh/captura-talento', icon: UserPlus, color: 'amber' },
   { label: 'Proyectos', path: '/proyectos', icon: FolderKanban, color: 'teal' },
   { label: 'Personal Activo', path: '/rrhh/personal-activo', icon: CheckCircle2, color: 'emerald' },
   { label: 'Vacaciones', path: '/rrhh/vacaciones-licencias', icon: Calendar, color: 'sky' },
   { label: 'Flota', path: '/flota', icon: Truck, color: 'slate' },
   { label: 'HSE Auditoría', path: '/prevencion/hse-audit', icon: ShieldAlert, color: 'rose' },
   { label: 'Asistencia', path: '/rrhh/control-asistencia', icon: Activity, color: 'violet' },
];

const C = {
   indigo: { bg: 'bg-indigo-50', txt: 'text-indigo-600', dot: 'bg-indigo-500', border: 'border-indigo-100', hover: 'hover:border-indigo-300' },
   amber: { bg: 'bg-amber-50', txt: 'text-amber-600', dot: 'bg-amber-500', border: 'border-amber-100', hover: 'hover:border-amber-300' },
   teal: { bg: 'bg-teal-50', txt: 'text-teal-600', dot: 'bg-teal-500', border: 'border-teal-100', hover: 'hover:border-teal-300' },
   emerald: { bg: 'bg-emerald-50', txt: 'text-emerald-600', dot: 'bg-emerald-500', border: 'border-emerald-100', hover: 'hover:border-emerald-300' },
   sky: { bg: 'bg-sky-50', txt: 'text-sky-600', dot: 'bg-sky-500', border: 'border-sky-100', hover: 'hover:border-sky-300' },
   slate: { bg: 'bg-slate-50', txt: 'text-slate-600', dot: 'bg-slate-500', border: 'border-slate-100', hover: 'hover:border-slate-300' },
   rose: { bg: 'bg-rose-50', txt: 'text-rose-600', dot: 'bg-rose-500', border: 'border-rose-100', hover: 'hover:border-rose-300' },
   violet: { bg: 'bg-violet-50', txt: 'text-violet-600', dot: 'bg-violet-500', border: 'border-violet-100', hover: 'hover:border-violet-300' },
};

const DashboardSeguimiento = () => {
   const navigate = useNavigate();

   /* ── fleet state ── */
   const [loading, setLoading] = useState(true);
   const [valorUF, setValorUF] = useState(0);
   const [metrics, setMetrics] = useState({ totalFlota: 0, totalAsignados: 0, totalLibres: 0, costoTotal: 0, costoOperativo: 0, costoPasivo: 0, porProveedor: {} });
   const [listas, setListas] = useState({ asignados: [], libres: [], total: [] });
   const [vistaDetalle, setVistaDetalle] = useState(null);

   /* ── rrhh state ── */
   const [rrhhLoading, setRrhhLoading] = useState(true);
   const [candidates, setCandidates] = useState([]);
   const [proyectos, setProyectos] = useState([]);
   const [globalAnalytics, setGlobalAnalytics] = useState(null);
   const [showProjectPanel, setShowProjectPanel] = useState(true);
   const [refreshing, setRefreshing] = useState(false);

   /* ── fetch UF ── */
   const fetchUF = async () => {
      try {
         const r = await telecomApi.get('/indicadores?tipo=uf');
         const v = r.data.serie[0].valor;
         setValorUF(v);
         return v;
      } catch { return 38000; }
   };

   /* ── fetch fleet ── */
   const fetchFleet = async () => {
      try {
         const uf = await fetchUF();
         const [resFlota, resRRHH] = await Promise.all([
            telecomApi.get('/vehiculos'),
            telecomApi.get('/tecnicos'),
         ]);
         const flota = resFlota.data;
         const rrhh = resRRHH.data;

         const patentesOcupadas = new Set();
         const detalleAsignacion = {};
         rrhh.forEach(t => {
            const pat = t.patente || t.vehiculoAsignado?.patente;
            if (pat) {
               const k = pat.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
               patentesOcupadas.add(k);
               detalleAsignacion[k] = t.nombre;
            }
         });

         let cntA = 0, cntL = 0, costoOp = 0, costoPas = 0;
         const listA = [], listL = [], countProv = {};

         const flotaP = flota.map(auto => {
            const k = auto.patente ? auto.patente.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : 'S/P';
            const base = parseFloat(auto.valorLeasing || auto.valor || 0);
            const costoMesCLP = auto.moneda === 'CLP' ? base : Math.round(base * uf);
            const etiquetaCosto = auto.moneda === 'CLP' ? `$${base.toLocaleString('es-CL')}` : `UF ${base}`;
            const estaAsignado = patentesOcupadas.has(k);
            const responsable = detalleAsignacion[k] || 'Sin Conductor';
            const prov = auto.proveedor || 'No Identificado';
            countProv[prov] = (countProv[prov] || 0) + 1;
            const d = { ...auto, responsable, costoMesCLP, etiquetaCosto, estado: estaAsignado ? 'ASIGNADO' : 'LIBRE' };
            if (estaAsignado) { cntA++; costoOp += costoMesCLP; listA.push(d); }
            else { cntL++; costoPas += costoMesCLP; listL.push(d); }
            return d;
         });

         setMetrics({ totalFlota: flota.length, totalAsignados: cntA, totalLibres: cntL, costoTotal: costoOp + costoPas, costoOperativo: costoOp, costoPasivo: costoPas, porProveedor: countProv });
         setListas({ total: flotaP, asignados: listA, libres: listL });
      } catch (e) { console.error('Fleet error', e); }
      finally { setLoading(false); }
   };

   /* ── fetch rrhh ── */
   const fetchRrhh = async () => {
      setRrhhLoading(true);
      try {
         const [candRes, projRes, analyticsRes] = await Promise.all([
            candidatosApi.getAll(),
            proyectosApi.getAll(),
            proyectosApi.getAnalyticsGlobal().catch(() => ({ data: null })),
         ]);
         setCandidates(candRes.data || []);
         setProyectos(projRes.data || []);
         setGlobalAnalytics(analyticsRes.data);
      } catch (e) { console.error('RRHH error', e); }
      finally { setRrhhLoading(false); }
   };

   useEffect(() => {
      fetchFleet();
      fetchRrhh();
      const interval = setInterval(fetchFleet, 30000);
      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const handleRefresh = async () => {
      setRefreshing(true);
      await Promise.all([fetchFleet(), fetchRrhh()]);
      setRefreshing(false);
   };

   /* ── derived RRHH ── */
   const ga = globalAnalytics?.totales || null;
   const cntPostulando = candidates.filter(c => ['En Postulación', 'Postulando', 'En Entrevista', 'En Evaluación', 'En Acreditación', 'En Documentación', 'Aprobado'].includes(c.status)).length;
   const cntContratados = candidates.filter(c => c.status === 'Contratado').length;
   const cntFiniquitados = candidates.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
   const proyActivos = proyectos.filter(p => p.status === 'Activo').length;

   const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

   /* ── sub-component ── */
   const KpiCard = ({ title, value, percentage, subtext, icon: Icon, color, active, onClick }) => (
      <div
         onClick={onClick}
         className={`relative p-5 rounded-2xl border cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${active ? `bg-${color}-50 border-${color}-500 ring-1 ring-${color}-500 shadow-md` : 'bg-white border-slate-200 shadow-sm'
            }`}
      >
         <div className="flex justify-between items-start">
            <div>
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-1">{title}</p>
               <h3 className="text-3xl font-black text-slate-800">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-${color}-100 text-${color}-600`}><Icon size={24} /></div>
         </div>
         <div className="mt-4 flex items-center gap-2">
            {percentage !== undefined && <span className={`text-xs font-bold px-2 py-0.5 rounded bg-${color}-100 text-${color}-700`}>{percentage}%</span>}
            <span className="text-[10px] font-bold text-slate-400 truncate">{subtext}</span>
         </div>
         {active && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2"><div className="w-4 h-4 bg-white border-b border-r border-slate-200 rotate-45" /></div>}
      </div>
   );

   return (
      <div className="min-h-full bg-slate-50/50 pb-20 space-y-8">

         {/* ── HEADER ── */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200">
                  <BarChart2 size={24} />
               </div>
               <div>
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                     Dashboard <span className="text-indigo-600">Financiero & Operativo</span>
                  </h1>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5 capitalize">{today}</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               {valorUF > 0 && (
                  <div className="bg-white border border-emerald-100 rounded-2xl px-5 py-3 text-right shadow-sm">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">UF Hoy</p>
                     <p className="text-lg font-black text-emerald-600">{money(valorUF)}</p>
                  </div>
               )}
               <button
                  onClick={handleRefresh}
                  className={`flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-wider hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm`}
               >
                  <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                  Actualizar
               </button>
            </div>
         </div>

         {/* ── MÓDULOS ACCESO RÁPIDO ── */}
         <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Acceso Rápido</p>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
               {QUICK_MODULES.map((mod, i) => {
                  const cs = C[mod.color];
                  return (
                     <button key={i} onClick={() => navigate(mod.path)}
                        className={`bg-white border ${cs.border} ${cs.hover} rounded-2xl p-4 flex flex-col items-center gap-2.5 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 group`}>
                        <div className={`p-2.5 ${cs.bg} ${cs.txt} rounded-xl group-hover:scale-110 transition-transform`}><mod.icon size={18} /></div>
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wide text-center leading-tight">{mod.label}</span>
                     </button>
                  );
               })}
            </div>
         </div>

         {/* ── SECCIÓN RRHH & PROYECTOS ── */}
         <div>
            <div className="flex items-center gap-2 mb-4">
               <Building2 size={14} className="text-indigo-500" />
               <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Administración RRHH & Proyectos</p>
               <span className="text-[8px] font-black bg-indigo-100 text-indigo-500 px-2 py-0.5 rounded-full">En tiempo real</span>
            </div>

            {/* RRHH KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
               {[
                  { label: 'Registros', value: candidates.length, icon: Users, dot: 'bg-indigo-500', sub: 'total sistema' },
                  { label: 'En Proceso', value: cntPostulando, icon: Clock, dot: 'bg-violet-500', sub: 'selección activa' },
                  { label: 'Contratados', value: ga?.globalAct ?? cntContratados, icon: CheckCircle2, dot: 'bg-emerald-500', sub: 'personal activo' },
                  { label: 'En Permiso', value: ga?.globalEnPermiso ?? 0, icon: Calendar, dot: 'bg-amber-500', sub: 'licencia/vacación hoy' },
                  { label: 'Finiquitados', value: ga?.globalFin ?? cntFiniquitados, icon: UserX, dot: 'bg-rose-500', sub: 'histórico salidas' },
                  { label: 'Proyectos', value: proyActivos, icon: FolderKanban, dot: 'bg-teal-500', sub: `${proyectos.length} total` },
                  { label: 'Cobertura', value: ga ? `${ga.coberturaGlobal}%` : '—', icon: TrendingUp, dot: 'bg-sky-500', sub: 'dotación cubierta' },
               ].map((card, i) => (
                  <div key={i} className="bg-white border border-slate-100 rounded-[1.5rem] p-4 shadow-sm hover:shadow-md transition-all group">
                     <div className="flex items-center justify-between mb-3">
                        <div className={`w-8 h-8 ${card.dot} rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
                           <card.icon size={15} className="text-white" />
                        </div>
                        {rrhhLoading && <Loader2 size={12} className="animate-spin text-slate-300" />}
                     </div>
                     <div className="text-2xl font-black text-slate-800 tracking-tighter leading-none">{card.value}</div>
                     <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{card.label}</div>
                     <div className="text-[8px] font-bold text-slate-300 mt-0.5">{card.sub}</div>
                  </div>
               ))}
            </div>

            {/* Project analytics collapsible */}
            {globalAnalytics?.proyectos?.length > 0 && (
               <div className="bg-white border border-indigo-100 rounded-[2rem] overflow-hidden shadow-sm">
                  <button onClick={() => setShowProjectPanel(v => !v)}
                     className="w-full flex items-center justify-between px-7 py-5 hover:bg-indigo-50/30 transition-all">
                     <div className="flex items-center gap-3">
                        <FolderKanban size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Operación de Reclutamiento por Proyecto</span>
                     </div>
                     <ChevronDown size={15} className={`text-indigo-400 transition-transform duration-300 ${showProjectPanel ? 'rotate-180' : ''}`} />
                  </button>
                  {showProjectPanel && (
                     <div className="px-7 pb-7 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {globalAnalytics.proyectos.map(p => {
                           const cob = p.cobertura ?? 0;
                           const barColor = cob >= 100 ? 'bg-emerald-500' : cob >= 60 ? 'bg-indigo-500' : 'bg-amber-400';
                           const txtColor = cob >= 100 ? 'text-emerald-600' : cob >= 60 ? 'text-indigo-600' : 'text-amber-600';
                           return (
                              <div key={p._id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate('/proyectos')}>
                                 <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0 mr-2">
                                       <p className="font-black text-slate-900 text-xs leading-tight truncate">{p.nombreProyecto}</p>
                                       <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full mt-1 inline-block">{p.centroCosto}</span>
                                    </div>
                                    <span className={`text-xl font-black ${txtColor} flex-shrink-0`}>{cob}%</span>
                                 </div>
                                 <div className="grid grid-cols-5 gap-1 mb-3">
                                    {[
                                       { l: 'Req.', v: p.requerido, bg: 'bg-slate-100', t: 'text-slate-700' },
                                       { l: 'Act.', v: p.activos, bg: 'bg-emerald-50', t: 'text-emerald-700' },
                                       { l: 'Perm.', v: p.enPermiso, bg: 'bg-amber-50', t: 'text-amber-700' },
                                       { l: 'Post.', v: p.postulando, bg: 'bg-indigo-50', t: 'text-indigo-700' },
                                       { l: 'Pend.', v: p.pendientes, bg: p.pendientes > 0 ? 'bg-red-50' : 'bg-emerald-50', t: p.pendientes > 0 ? 'text-red-700' : 'text-emerald-700' },
                                    ].map((s, si) => (
                                       <div key={si} className={`${s.bg} rounded-lg p-1.5 text-center`}>
                                          <p className={`text-xs font-black ${s.t}`}>{s.v ?? 0}</p>
                                          <p className={`text-[6px] font-bold uppercase ${s.t} opacity-70`}>{s.l}</p>
                                       </div>
                                    ))}
                                 </div>
                                 <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${Math.min(cob, 100)}%` }} />
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* ── SECCIÓN FLOTA ── */}
         <div>
            <div className="flex items-center gap-2 mb-4">
               <Truck size={14} className="text-slate-500" />
               <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Flota Vehicular</p>
               {valorUF > 0 && <span className="text-[8px] font-semibold text-slate-400">· UF {money(valorUF)}</span>}
            </div>

            {loading ? (
               <div className="flex items-center justify-center h-32 bg-white rounded-2xl border border-slate-100 shadow-sm">
                  <Loader2 className="animate-spin text-blue-500" size={28} />
               </div>
            ) : (
               <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                     <KpiCard title="Total Flota" value={metrics.totalFlota} subtext="registrados" icon={Truck} color="slate" active={vistaDetalle === 'total'} onClick={() => setVistaDetalle(vistaDetalle === 'total' ? null : 'total')} />
                     <KpiCard title="Asignados" value={metrics.totalAsignados} percentage={pct(metrics.totalAsignados, metrics.totalFlota)} subtext={money(metrics.costoOperativo) + ' / mes'} icon={Users} color="emerald" active={vistaDetalle === 'asignados'} onClick={() => setVistaDetalle(vistaDetalle === 'asignados' ? null : 'asignados')} />
                     <KpiCard title="Libres / Stock" value={metrics.totalLibres} percentage={pct(metrics.totalLibres, metrics.totalFlota)} subtext={money(metrics.costoPasivo) + ' (Pérdida)'} icon={AlertCircle} color="amber" active={vistaDetalle === 'libres'} onClick={() => setVistaDetalle(vistaDetalle === 'libres' ? null : 'libres')} />
                     <KpiCard title="Costo Total Mensual" value={money(metrics.costoTotal)} subtext="estimado flota completa" icon={Wallet} color="blue" active={false} onClick={() => { }} />
                  </div>

                  {vistaDetalle && (
                     <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mb-4 animate-in zoom-in-95 duration-300">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                           <h3 className="font-black text-slate-700 uppercase text-xs flex items-center gap-2">
                              <ChevronDown size={16} /> {vistaDetalle === 'total' ? 'Inventario Completo' : vistaDetalle === 'asignados' ? 'Vehículos con Responsable' : 'Vehículos Libres (Stock)'}
                           </h3>
                           <button onClick={() => setVistaDetalle(null)} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
                        </div>
                        <div className="max-h-72 overflow-y-auto custom-scrollbar">
                           <table className="w-full text-left text-xs">
                              <thead className="text-slate-500 font-bold uppercase bg-slate-50 sticky top-0 z-10">
                                 <tr>
                                    <th className="p-3">Patente</th>
                                    <th className="p-3">Vehículo</th>
                                    <th className="p-3">Proveedor</th>
                                    <th className="p-3">Responsable</th>
                                    <th className="p-3 text-right">Contrato</th>
                                    <th className="p-3 text-right">CLP/mes</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                 {listas[vistaDetalle].map((auto, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                       <td className="p-3 font-black text-slate-700">{auto.patente}</td>
                                       <td className="p-3 text-slate-600">{auto.marca} {auto.modelo}</td>
                                       <td className="p-3"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 border border-slate-200">{auto.proveedor}</span></td>
                                       <td className="p-3">{auto.estado === 'ASIGNADO' ? <span className="text-emerald-700 font-bold flex items-center gap-1"><Users size={12} />{auto.responsable}</span> : <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">SIN ASIGNAR</span>}</td>
                                       <td className="p-3 text-right font-mono text-slate-500">{auto.etiquetaCosto}</td>
                                       <td className="p-3 text-right font-mono font-bold text-slate-700">{money(auto.costoMesCLP)}</td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  )}

                  {/* Cost analysis */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 text-xs uppercase mb-5 flex items-center gap-2">
                           <DollarSign size={14} className="text-emerald-500" /> Análisis de Costos
                        </h4>
                        <div className="space-y-5">
                           {[
                              { label: 'Costo Operativo (Produciendo)', value: metrics.costoOperativo, total: metrics.costoTotal, color: 'emerald' },
                              { label: 'Costo Pasivo (Detenidos/Libres)', value: metrics.costoPasivo, total: metrics.costoTotal, color: 'amber' },
                           ].map((row, i) => (
                              <div key={i}>
                                 <div className="flex justify-between text-xs mb-1">
                                    <span className="font-bold text-slate-600">{row.label}</span>
                                    <span className={`font-mono text-${row.color}-600 font-bold`}>{money(row.value)}</span>
                                 </div>
                                 <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                    <div className={`bg-${row.color}-500 h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2`} style={{ width: `${pct(row.value, row.total)}%` }}>
                                       <span className="text-[8px] text-white font-bold">{pct(row.value, row.total)}%</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-700 text-xs uppercase mb-5 flex items-center gap-2">
                           <Car size={14} className="text-blue-500" /> Distribución por Proveedor
                        </h4>
                        <div className="space-y-3 overflow-y-auto max-h-48 custom-scrollbar pr-2">
                           {Object.entries(metrics.porProveedor).map(([nombre, cantidad]) => (
                              <div key={nombre} className="flex items-center gap-4">
                                 <div className="w-28 text-xs font-bold text-slate-500 uppercase truncate">{nombre}</div>
                                 <div className="flex-1">
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                       <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${pct(cantidad, metrics.totalFlota)}%` }} />
                                    </div>
                                 </div>
                                 <div className="w-14 text-right text-xs font-bold text-slate-700">{cantidad} unid.</div>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </>
            )}
         </div>
      </div>
   );
};

export default DashboardSeguimiento;