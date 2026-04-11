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
import { candidatosApi, proyectosApi, asistenciaApi } from '../rrhh/rrhhApi';
import logisticaApi from '../logistica/logisticaApi';
import { incidentesApi, inspeccionesApi, charlasApi } from '../prevencion/prevencionApi';
import API_URL from '../../config';
import { useAuth } from '../auth/AuthContext';
import { useIndicadores } from '../../contexts/IndicadoresContext';

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

   const { user } = useAuth();
   const { ufValue, utmValue } = useIndicadores();

   /* ── fleet & logistica state ── */
   const [loading, setLoading] = useState(true);
   const [metrics, setMetrics] = useState({ totalFlota: 0, totalAsignados: 0, totalLibres: 0, costoTotal: 0, costoOperativo: 0, costoPasivo: 0, porProveedor: {} });
   const [logisticsStats, setLogisticsStats] = useState({ totalStock: 0, productosBajoStock: 0, mermasHoy: 0, despachosActivos: 0 });
   const [listas, setListas] = useState({ asignados: [], libres: [], total: [] });
   const [vistaDetalle, setVistaDetalle] = useState(null);

   /* ── rrhh state ── */
   const [rrhhLoading, setRrhhLoading] = useState(true);
   const [candidates, setCandidates] = useState([]);
   const [proyectos, setProyectos] = useState([]);
   const [globalAnalytics, setGlobalAnalytics] = useState(null);
   const [asistenciaHoy, setAsistenciaHoy] = useState([]);

   /* ── hse state ── */
   const [hseStats, setHseStats] = useState({ incidentesMes: 0, inspeccionesPendientes: 0, charlasHoy: 0 });

   /* ── finanzas state ── */
   const [finanzasStats, setFinanzasStats] = useState({ ventasNetas: 0, comprasNetas: 0, ivaProyectado: 0 });

   const [showProjectPanel, setShowProjectPanel] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [activeModal, setActiveModal] = useState(null); // { type, title, data }

   const fetchAllData = async () => {
      setLoading(true);
      setRefreshing(true);
      try {
         const uf = ufValue || 38000;

         // Execute all module requests in parallel
         const [
            resFlota, resTecnicos, // Flota
            candRes, projRes, analyticsRes, asistRes, // RRHH
            prodRes, despRes, stockRes, // Logística
            incRes, inspRes, charRes, // HSE
            finRes // Finanzas
         ] = await Promise.all([
            telecomApi.get('/vehiculos'),
            telecomApi.get('/tecnicos'),
            candidatosApi.getAll(),
            proyectosApi.getAll(),
            proyectosApi.getAnalyticsGlobal().catch(() => ({ data: null })),
            asistenciaApi.getAll({ fecha: new Date().toISOString().split('T')[0] }).catch(() => ({ data: [] })),
            logisticaApi.get('/productos').catch(() => ({ data: [] })),
            logisticaApi.get('/despachos').catch(() => ({ data: [] })),
            logisticaApi.get('/stock/reporte').catch(() => ({ data: [] })),
            incidentesApi.getAll().catch(() => ({ data: [] })),
            inspeccionesApi.getAll().catch(() => ({ data: [] })),
            charlasApi.getAll().catch(() => ({ data: [] })),
            fetch(`${API_URL}/api/admin/sii/rcv`, {
               headers: { 'Authorization': `Bearer ${user?.token}` }
            }).then(r => r.json()).catch(() => ({}))
         ]);

         // 1. Process Fleet
         const flota = resFlota.data || [];
         const tecnicos = resTecnicos.data || [];
         const patentesOcupadas = new Set();
         const detalleAsignacion = {};
         tecnicos.forEach(t => {
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

         // 2. Process RRHH
         setCandidates(candRes.data || []);
         setProyectos(projRes.data || []);
         setGlobalAnalytics(analyticsRes.data);
         setAsistenciaHoy(asistRes.data || []);
         setRrhhLoading(false);

         // 3. Process Logística
         const totalStock = (stockRes.data || []).reduce((acc, s) => acc + (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0), 0);
         const mermas = (stockRes.data || []).reduce((acc, s) => acc + (s.cantidadMerma || 0), 0);
         setLogisticsStats({
            totalStock,
            productosBajoStock: (prodRes.data || []).filter(p => p.stockActual <= p.stockMinimo).length,
            mermasHoy: mermas,
            despachosActivos: (despRes.data || []).filter(d => ['PENDIENTE', 'RECOGIDO', 'EN_RUTA'].includes(d.status)).length
         });

         // 4. Process HSE
         setHseStats({
            incidentesMes: (incRes.data || []).length,
            inspeccionesPendientes: (inspRes.data || []).filter(i => i.status === 'PENDIENTE').length,
            charlasHoy: (charRes.data || []).filter(c => new Date(c.fecha).toDateString() === new Date().toDateString()).length
         });

         // 5. Process Finanzas
         setFinanzasStats({
            ventasNetas: finRes.resumen?.ventasNetas || 0,
            comprasNetas: finRes.resumen?.comprasNetas || 0,
            ivaProyectado: finRes.resumen?.totalPagarF29 || 0
         });

      } catch (e) {
         console.error('Master fetch error', e);
      } finally {
         setLoading(false);
         setRefreshing(false);
      }
   };

   useEffect(() => {
      fetchAllData();
      const interval = setInterval(fetchAllData, 60000);
      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [ufValue]);

   const handleRefresh = () => fetchAllData();

   /* ── derived RRHH ── */
   const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

   /* ── sub-components ── */
   const KpiCard = ({ title, value, percentage, subtext, icon: Icon, color, onClick }) => (
      <div
         onClick={onClick}
         className={`relative p-5 rounded-2xl border bg-white border-slate-100 shadow-sm cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group`}
      >
         <div className="flex justify-between items-start">
            <div>
               <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">{title}</p>
               <h3 className="text-2xl font-black text-slate-800 tabular-nums">{value}</h3>
            </div>
            <div className={`p-3 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:scale-110 transition-transform`}>
               <Icon size={20} />
            </div>
         </div>
         <div className="mt-4 flex items-center gap-2">
            {percentage !== undefined && <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg bg-${color}-100 text-${color}-700`}>{percentage}%</span>}
            <span className="text-[9px] font-bold text-slate-400 truncate uppercase">{subtext}</span>
         </div>
      </div>
   );

   const MetricDetailModal = ({ isOpen, onClose, title, data, type }) => {
      if (!isOpen) return null;
      return (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-100">
               <div className="flex items-center justify-between px-10 py-8 border-b border-slate-50 bg-slate-50/50">
                  <div>
                     <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{title}</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Detalle Informativo · GENAI360 Intelligence</p>
                  </div>
                  <button onClick={onClose} className="p-4 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl shadow-sm transition-all">
                     <X size={24} />
                  </button>
               </div>
               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                  {type === 'fleet' ? (
                     <table className="w-full text-left text-xs">
                        <thead className="text-slate-500 font-bold uppercase bg-slate-50 sticky top-0">
                           <tr><th className="p-4">Patente</th><th className="p-4">Vehículo</th><th className="p-4">Responsable</th><th className="p-4 text-right">Costo</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                           {data.map((auto, i) => (
                              <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                                 <td className="p-4 font-black text-slate-700">{auto.patente}</td>
                                 <td className="p-4 text-slate-600">{auto.marca} {auto.modelo}</td>
                                 <td className="p-4 font-bold text-indigo-600">{auto.responsable}</td>
                                 <td className="p-4 text-right font-black text-slate-800">{money(auto.costoMesCLP)}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  ) : type === 'logistics' ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {data.map((item, i) => (
                           <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                              <h4 className="font-black text-slate-800 uppercase text-xs mb-2">{item.nombre || item.producto}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Stock: {item.cantidad || item.stockActual} unidades</p>
                           </div>
                        ))}
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                        <Activity size={64} className="opacity-20 mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">Información en proceso de carga...</p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      );
   };

   const ga = globalAnalytics?.totales || null;
   const cntPostulando = candidates.filter(c => ['En Postulación', 'Postulando', 'En Entrevista', 'En Evaluación', 'En Acreditación', 'En Documentación', 'Aprobado'].includes(c.status)).length;
   const cntContratados = candidates.filter(c => c.status === 'Contratado').length;
   const cntFiniquitados = candidates.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
   const proyActivos = proyectos.filter(p => p.status === 'Activo').length;

   return (
      <div className="min-h-full bg-slate-50/50 pb-20 space-y-10">

         {/* ── HEADER PREMIUM ── */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
               <div className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white p-4 rounded-[2rem] shadow-2xl shadow-indigo-100 ring-8 ring-white">
                  <BarChart2 size={28} />
               </div>
               <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
                     Dashboard <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Ejecutivo GENAI360</span>
                  </h1>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                     <Clock size={12} className="text-indigo-400" /> {today}
                  </p>
               </div>
            </div>
            
            <div className="flex items-center gap-3">
               <div className="bg-white/80 backdrop-blur-md border border-white shadow-xl rounded-3xl p-1.5 flex gap-1">
                  {[
                     { l: 'UF', v: ufValue, c: 'emerald' },
                     { l: 'UTM', v: utmValue, c: 'indigo' }
                  ].map(ind => (
                     <div key={ind.l} className="px-5 py-3 rounded-2xl bg-slate-50 border border-slate-100 min-w-[120px]">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{ind.l}</p>
                        <p className={`text-sm font-black text-${ind.c}-600`}>{money(ind.v)}</p>
                     </div>
                  ))}
               </div>
               <button onClick={handleRefresh} className="p-5 bg-slate-900 text-white rounded-3xl hover:bg-black transition-all shadow-xl shadow-slate-200 group">
                  <RefreshCw size={20} className={refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} />
               </button>
            </div>
         </div>

         {/* ── ACCESO RÁPIDO ── */}
         <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
            {QUICK_MODULES.map((mod, i) => {
               const cs = C[mod.color];
               return (
                  <button key={i} onClick={() => navigate(mod.path)}
                     className={`bg-white border-2 ${cs.border} rounded-3xl p-5 flex flex-col items-center gap-3 transition-all shadow-sm hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden`}>
                     <div className="absolute top-0 right-0 w-12 h-12 bg-slate-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform" />
                     <div className={`p-3 ${cs.bg} ${cs.txt} rounded-2xl relative z-10`}><mod.icon size={20} /></div>
                     <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center leading-tight relative z-10">{mod.label}</span>
                  </button>
               );
            })}
         </div>

         {/* ── SECCIÓN: CAPITAL HUMANO (RRHH) ── */}
         <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Gestión de Capital Humano</h2>
               <span className="ml-auto text-[8px] font-black bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-full uppercase tracking-widest">Postulaciones & Dotación</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
               <KpiCard title="Total Postulantes" value={candidates.length} subtext="base de datos" icon={Users} color="indigo" onClick={() => setActiveModal({ type: 'rrhh', title: 'Candidatos Totales', data: candidates })} />
               <KpiCard title="Selección Activa" value={cntPostulando} subtext="en proceso" icon={Clock} color="violet" onClick={() => setActiveModal({ type: 'rrhh', title: 'En Proceso de Selección', data: candidates.filter(c => c.status !== 'Contratado') })} />
               <KpiCard title="Personal Activo" value={ga?.globalAct ?? cntContratados} subtext="contratados" icon={CheckCircle2} color="emerald" onClick={() => navigate('/rrhh/personal-activo')} />
               <KpiCard title="Ausentismo Hoy" value={ga?.globalEnPermiso ?? 0} subtext="licencias/vacaciones" icon={Calendar} color="amber" onClick={() => navigate('/rrhh/vacaciones-licencias')} />
               <KpiCard title="Asistencia Hoy" value={asistenciaHoy.length} subtext="marcajes activos" icon={Activity} color="sky" onClick={() => navigate('/rrhh/control-asistencia')} />
               <KpiCard title="Proyectos Activos" value={proyActivos} subtext="en operación" icon={FolderKanban} color="teal" onClick={() => navigate('/proyectos')} />
            </div>
         </div>

         {/* ── SECCIÓN: LOGÍSTICA & OPERACIONES ── */}
         <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Logística & Activos Críticos</h2>
               <span className="ml-auto text-[8px] font-black bg-amber-100 text-amber-600 px-3 py-1.5 rounded-full uppercase tracking-widest">Inventario & Despachos</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <KpiCard title="Inventario Total" value={logisticsStats.totalStock} subtext="items valorizables" icon={Truck} color="amber" onClick={() => setActiveModal({ type: 'logistics', title: 'Detalle de Inventario', data: [] })} />
               <KpiCard title="Alarmas Stock" value={logisticsStats.productosBajoStock} subtext="quiebres inminentes" icon={AlertCircle} color="rose" onClick={() => navigate('/logistica/inventario')} />
               <KpiCard title="Mermas / Pérdidas" value={logisticsStats.mermasHoy} subtext="daños registrados" icon={TrendingUp} color="orange" onClick={() => navigate('/logistica/movimientos')} />
               <KpiCard title="Despachos Activos" value={logisticsStats.despachosActivos} subtext="en ruta / pendientes" icon={Activity} color="indigo" onClick={() => navigate('/logistica/despachos')} />
            </div>
         </div>

         {/* ── SECCIÓN: SEGURIDAD & SALUD (HSE) ── */}
         <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-2 h-8 bg-rose-600 rounded-full"></div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Seguridad & Salud Ocupacional (HSE)</h2>
               <span className="ml-auto text-[8px] font-black bg-rose-100 text-rose-600 px-3 py-1.5 rounded-full uppercase tracking-widest">Cumplimiento Normativo</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Incidentes del Mes</p>
                     <h3 className={`text-4xl font-black ${hseStats.incidentesMes > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{hseStats.incidentesMes}</h3>
                  </div>
                  <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><ShieldAlert size={28} /></div>
               </div>
               <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Inspecciones Pendientes</p>
                     <h3 className="text-4xl font-black text-slate-800">{hseStats.inspeccionesPendientes}</h3>
                  </div>
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><CheckCircle2 size={28} /></div>
               </div>
               <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                     <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Charlas de Seguridad Hoy</p>
                     <h3 className="text-4xl font-black text-emerald-600">{hseStats.charlasHoy}</h3>
                  </div>
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={28} /></div>
               </div>
            </div>
         </div>

         {/* ── SECCIÓN: ANÁLISIS DE COSTOS (FINANZAS) ── */}
         <div className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
               <div className="w-2 h-8 bg-emerald-600 rounded-full"></div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Análisis Económico & Costos</h2>
               <span className="ml-auto text-[8px] font-black bg-emerald-100 text-emerald-600 px-3 py-1.5 rounded-full uppercase tracking-widest">Consolidado Operativo</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                     <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-2 relative z-10">Ventas Netas (RCV SII)</p>
                     <h3 className="text-4xl font-black tabular-nums relative z-10">{money(finanzasStats.ventasNetas)}</h3>
                     <div className="mt-8 flex items-center gap-2 relative z-10">
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-tighter">Liquidación Proyectada</span>
                     </div>
                  </div>
                  <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
                     <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">IVA a Pagar (F29)</p>
                     <h3 className="text-4xl font-black text-slate-800 tabular-nums">{money(finanzasStats.ivaProyectado)}</h3>
                     <div className="mt-8 flex items-center gap-2">
                        <span className="px-3 py-1 bg-rose-50 text-rose-500 rounded-lg text-[9px] font-black uppercase tracking-tighter">Débito vs Crédito</span>
                     </div>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <h4 className="font-black text-slate-800 text-xs uppercase mb-6 flex items-center gap-2">
                     <DollarSign size={16} className="text-emerald-500" /> Distribución de Costo Flota
                  </h4>
                  <div className="space-y-6">
                     {[
                        { label: 'Costo Operativo', value: metrics.costoOperativo, total: metrics.costoTotal, color: 'emerald' },
                        { label: 'Costo Pasivo', value: metrics.costoPasivo, total: metrics.costoTotal, color: 'amber' },
                     ].map((row, i) => (
                        <div key={i}>
                           <div className="flex justify-between text-[11px] mb-2 font-bold uppercase tracking-tight">
                              <span className="text-slate-500">{row.label}</span>
                              <span className={`text-${row.color}-600`}>{money(row.value)}</span>
                           </div>
                           <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                              <div className={`bg-${row.color}-500 h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-2`} style={{ width: `${pct(row.value, row.total)}%` }}>
                                 <span className="text-[8px] text-white font-black">{pct(row.value, row.total)}%</span>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>

         {/* ── MODAL DE DETALLE ── */}
         <MetricDetailModal
            isOpen={!!activeModal}
            onClose={() => setActiveModal(null)}
            title={activeModal?.title}
            data={activeModal?.data}
            type={activeModal?.type}
         />

      </div>
   );
};

export default DashboardSeguimiento;