import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import {
  BarChart2, Users, DollarSign, Truck, ShieldAlert, Activity,
  TrendingUp, TrendingDown, CheckCircle2, AlertCircle, Calendar,
  Clock, FolderKanban, UserPlus, RefreshCw, Download, Share2,
  Printer, Mail, MessageCircle, Link2, X, Zap, Target,
  Award, Package, Flame, ChevronUp, ChevronDown, Eye, Search,
  FileText, Image as ImageIcon, Building2, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useIndicadores } from '../../contexts/IndicadoresContext';
import telecomApi from './telecomApi';
import { candidatosApi, proyectosApi, asistenciaApi } from '../rrhh/rrhhApi';
import logisticaApi from '../logistica/logisticaApi';
import { incidentesApi, inspeccionesApi, charlasApi } from '../prevencion/prevencionApi';
import { operacionesApi } from '../operaciones/operacionesApi';
import API_URL from '../../config';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';

/* ── Helpers ── */
const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
const fmtK = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;
const fmtPts = v => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(v || 0);
const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0;

/* ── Paleta corporativa ── */
const P = {
  indigo: '#6366f1', violet: '#8b5cf6', emerald: '#10b981',
  amber: '#f59e0b', rose: '#f43f5e', sky: '#0ea5e9',
  teal: '#14b8a6', slate: '#64748b', orange: '#f97316'
};

/* ── Géneros demo months ── */
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const nowM = new Date().getMonth();
const recentMonths = MONTHS.slice(Math.max(0, nowM - 5), nowM + 1);

/* ── Custom Tooltip ── */
const CT = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl text-xs">
      <p className="font-black text-slate-300 mb-2 uppercase tracking-wider">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('es-CL') : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

/* ── Mini Spark ── */
const Spark = ({ data, color, h = 40 }) => (
  <ResponsiveContainer width="100%" height={h}>
    <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
      <defs>
        <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.3} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} fill={`url(#sg${color.replace('#','')})`} strokeWidth={2} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

/* ── KPI Card compacta ── */
const KCard = ({ title, value, sub, icon: Icon, color = P.indigo, trend, spark, onClick }) => (
  <div onClick={onClick} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group">
    <div className="flex items-start justify-between mb-2">
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
        <p className="text-xl font-black text-slate-900 leading-none">{value}</p>
      </div>
      <div className="p-2 rounded-xl ml-2 flex-shrink-0" style={{ background: `${color}15`, color }}>
        <Icon size={16} />
      </div>
    </div>
    {spark && <div className="my-2"><Spark data={spark} color={color} h={32} /></div>}
    <div className="flex items-center gap-1.5 mt-1">
      {trend !== undefined && (
        trend >= 0
          ? <ChevronUp size={10} className="text-emerald-500" />
          : <ChevronDown size={10} className="text-rose-500" />
      )}
      <p className="text-[9px] text-slate-400 font-bold truncate">{sub}</p>
    </div>
  </div>
);

/* ── Section Header ── */
const SH = ({ color, title, badge }) => (
  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 mb-5">
    <div className="w-1 h-6 rounded-full" style={{ background: color }} />
    <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">{title}</h2>
    {badge && <span className="ml-auto text-[8px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: color }}>{badge}</span>}
  </div>
);

/* ── Goal Bar ── */
const GoalBar = ({ label, actual, meta, color, suffix = '', sub }) => {
  const p = Math.min(100, pct(actual, meta));
  const deficit = actual < meta;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-slate-600 truncate">{label}</span>
        <span className={deficit ? 'text-rose-500' : 'text-emerald-600'}>{p}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: p < 60 ? '#f43f5e' : p < 90 ? '#f59e0b' : color }} />
      </div>
      <div className="flex justify-between text-[8px] text-slate-400">
        <span>Real: {actual.toLocaleString('es-CL')}{suffix}</span>
        <span>Meta: {meta.toLocaleString('es-CL')}{suffix}</span>
        {sub && <span className="ml-auto font-black italic">{sub}</span>}
      </div>
    </div>
  );
};

/* ── Global Filter Bar ── */
const GlobalFilterBar = ({ filters, setFilters, clientesBase, refreshing }) => {
  return (
    <div className="sticky-filter-bar sticky top-0 z-[100] mb-4 md:mb-8">
      <div className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-2xl md:rounded-[2.5rem] p-3 md:p-6 shadow-xl md:shadow-2xl shadow-indigo-100/30 animate-in fade-in slide-in-from-top-4 duration-500 border-b-4 border-b-indigo-500/20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-6 items-end">
          {/* Fecha Desde */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Desde</label>
            <input 
               type="date" 
               value={filters.desde} 
               onChange={e => setFilters(f => ({ ...f, desde: e.target.value }))}
               className="w-full bg-white/80 border border-slate-100 rounded-2xl p-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-sm"
            />
          </div>
          {/* Fecha Hasta */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hasta</label>
            <input 
               type="date" 
               value={filters.hasta} 
               onChange={e => setFilters(f => ({ ...f, hasta: e.target.value }))}
               className="w-full bg-white/80 border border-slate-100 rounded-2xl p-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none shadow-sm"
            />
          </div>
          {/* Cliente MultiSelect */}
          <div className="lg:col-span-2 xl:col-span-1">
             <MultiSearchableSelect 
                label="Filtrar Clientes"
                icon={Users}
                options={clientesBase.map(c => ({ id: c._id, nombre: c.nombre }))}
                value={filters.clientes}
                onChange={vals => setFilters(f => ({ ...f, clientes: vals }))}
                placeholder="Todos los clientes"
             />
          </div>
          {/* Tipo de Actividad */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tipo de Actividad</label>
            <div className="relative">
              <select
                value={filters.tipo}
                onChange={e => setFilters(f => ({ ...f, tipo: e.target.value }))}
                className="w-full bg-white/80 border border-slate-100 rounded-2xl p-3.5 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none appearance-none shadow-sm"
              >
                <option value="todos">Todas las Actividades</option>
                <option value="provision">Solo Provisiones</option>
                <option value="reparacion">Solo Reparaciones</option>
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
          {/* Estado */}
          <div className="space-y-2 lg:col-span-2 xl:col-span-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Estado Operativo</label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-50/50 p-1.5 rounded-2xl border border-slate-200/50">
               {['Completado', 'Pendiente', 'Iniciado', 'todos'].map(st => (
                 <button
                    key={st}
                    onClick={() => setFilters(f => ({ ...f, estado: st }))}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all ${
                       filters.estado === st 
                       ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 border border-indigo-400' 
                       : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                 >
                    {st === 'todos' ? 'Todos' : st}
                 </button>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Elite Ranking Table ── */
const EliteRankingTable = ({ tecnicos, metaDia, searchTerm, setSearchTerm }) => {
  const filtered = tecnicos.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.proyecto || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm ml-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
        <input 
          type="text"
          placeholder="Buscar técnico o proyecto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-2">
          <thead>
            <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Técnico</th>
              <th className="px-4 py-2 text-center text-indigo-600">Días</th>
              <th className="px-4 py-2 text-center text-indigo-600">Orden</th>
              <th className="px-2 py-2 text-center">Pts Base</th>
              <th className="px-2 py-2 text-center">Pts Deco</th>
              <th className="px-2 py-2 text-center">Pts Rep</th>
              <th className="px-2 py-2 text-center">Pts Tel</th>
              <th className="px-4 py-2 text-center font-black text-slate-900 border-x border-slate-100 uppercase italic">Pts. Meta</th>
              <th className="px-4 py-2 text-center font-black text-indigo-700 uppercase italic">Pts Total</th>
              <th className="px-4 py-2 text-center">Prom/Día</th>
              <th className="px-4 py-2 text-right">CUMPLIMIENTO</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {filtered.slice(0, 15).map((t, i) => {
              const metaTotal = t.metaTotal || 0;
              const cP = pct(t.ptsTotal, metaTotal);
              const avgD = t.daysCount > 0 ? (t.ptsTotal / t.daysCount) : 0;
              const statusColor = cP >= 95 ? 'bg-emerald-500' : cP >= 80 ? 'bg-amber-500' : 'bg-rose-500';
              const statusText = cP >= 95 ? 'text-emerald-700 bg-emerald-50' : cP >= 80 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';

              return (
                <tr key={i} className="bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all group">
                  <td className="px-4 py-3 rounded-l-xl font-black text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-black text-slate-800">
                    <div className="flex flex-col">
                      <span className="truncate max-w-[150px]">{t.name}</span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{t.proyecto || 'Sin Proyecto'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-600">{t.daysCount}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-600">{t.orders}</td>
                  <td className="px-2 py-3 text-center text-slate-500 font-medium">{t.ptsBase?.toFixed(1) || 0}</td>
                  <td className="px-2 py-3 text-center text-slate-500 font-medium">{t.ptsDeco?.toFixed(1) || 0}</td>
                  <td className="px-2 py-3 text-center text-slate-500 font-medium">{t.ptsRepetidor?.toFixed(1) || 0}</td>
                  <td className="px-2 py-3 text-center text-slate-500 font-medium">{t.ptsTelefono?.toFixed(1) || 0}</td>
                  <td className="px-4 py-3 text-center font-black bg-slate-50 border-x border-slate-100 text-slate-600 italic">{metaTotal.toFixed(1)}</td>
                  <td className={`px-4 py-3 text-center font-black italic ${cP >= 100 ? 'text-emerald-600' : 'text-indigo-700'}`}>
                    {t.ptsTotal?.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-500 italic">{avgD.toFixed(1)}</td>
                  <td className="px-4 py-3 rounded-r-xl text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${statusColor}`} style={{ width: `${Math.min(100, cP)}%` }} />
                      </div>
                      <span className={`px-2 py-1 rounded-lg font-black text-[10px] min-w-[45px] text-center ${statusText} shadow-sm border border-current opacity-90`}>
                        {cP}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════ */
const DashboardEjecutivo = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ufValue, utmValue } = useIndicadores();
  const dashRef = useRef(null);

  /* ── State ── */
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  /* ── Filters State ── */
  const [filters, setFilters] = useState({
    desde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0],
    clientes: [],
    tipo: 'todos',
    estado: 'Completado'
  });

  /* ── Data state ── */
  const [data, setData] = useState({
    flota: { total: 0, asignados: 0, libres: 0, costoOp: 0, costoPas: 0 },
    rrhh: { candidatos: 0, activos: 0, ausentismo: 0, asistenciaHoy: 0, proyActivos: 0, retiros: 0 },
    logistica: { stock: 0, bajoStock: 0, mermas: 0, despachos: 0 },
    hse: { incidentes: 0, inspPendientes: 0, charlasHoy: 0, cumplimiento: 0 },
    finanzas: { ventasNetas: 0, iva: 0, compras: 0, gastosOp: 0, margenBruto: 0, totalPts: 0, metaProduccion: 0 },
    ranking: [],
    clientProjects: [],
    gadgets: {},
    gastosDetalle: [],
    statsFinanciera: null,
  });

  const [clientesBase, setClientesBase] = useState([]);

  /* ── Demo trend data (se enriquece con datos reales cuando existen) ── */
  const buildTrend = useCallback((peak, label) => recentMonths.map((m, i) => ({
    mes: m,
    [label]: Math.round(peak * (0.55 + 0.45 * Math.sin(i * 0.9 + 1.2))),
    meta: Math.round(peak * 0.85),
  })), []);

  const [trends, setTrends] = useState({
    produccion: [],
    dotacion: [],
    incidentes: [],
    costos: [],
  });

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const uf = ufValue || 38000;
      const params = {
        desde: filters.desde,
        hasta: filters.hasta,
        clientes: filters.clientes.join(','),
        tipo: filters.tipo,
        estado: filters.estado
      };

      const [
        resFlota, resTec,
        candRes, projRes, analyticsRes, asistRes,
        prodRes, despRes, stockRes,
        incRes, inspRes, charRes,
        finRes, gastosStats, prodFinRes,
        clientesRes
      ] = await Promise.all([
        telecomApi.get('/vehiculos').catch(() => ({ data: [] })),
        telecomApi.get('/tecnicos').catch(() => ({ data: [] })),
        candidatosApi.getAll().catch(() => ({ data: [] })),
        proyectosApi.getAll().catch(() => ({ data: [] })),
        proyectosApi.getAnalyticsGlobal().catch(() => ({ data: null })),
        asistenciaApi.getAll({ fecha: new Date().toISOString().split('T')[0] }).catch(() => ({ data: [] })),
        logisticaApi.get('/productos').catch(() => ({ data: [] })),
        logisticaApi.get('/despachos').catch(() => ({ data: [] })),
        logisticaApi.get('/stock/reporte').catch(() => ({ data: [] })),
        incidentesApi.getAll().catch(() => ({ data: [] })),
        inspeccionesApi.getAll().catch(() => ({ data: [] })),
        charlasApi.getAll().catch(() => ({ data: [] })),
        fetch(`${API_URL}/api/admin/sii/rcv`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        }).then(r => r.json()).catch(() => ({})),
        operacionesApi.get('/gastos/stats').catch(() => ({ data: [] })),
        telecomApi.get('/bot/produccion-financiera', { params }).catch(() => ({ data: null })),
        telecomApi.get('/clientes').catch(() => ({ data: [] })),
      ]);

      if (clientesRes.data) setClientesBase(clientesRes.data);

      const flota = resFlota.data || [];
      const tecnicos = resTec.data || [];
      const patOcupadas = new Set(tecnicos.map(t => (t.patente || t.vehiculoAsignado?.patente || '').replace(/\W/g, '').toUpperCase()).filter(Boolean));
      let cA = 0, cL = 0, cosOp = 0, cosPas = 0;
      flota.forEach(v => {
        const k = (v.patente || '').replace(/\W/g, '').toUpperCase();
        const base = parseFloat(v.valorLeasing || v.valor || 0);
        const clp = v.moneda === 'CLP' ? base : Math.round(base * uf);
        if (patOcupadas.has(k)) { cA++; cosOp += clp; } else { cL++; cosPas += clp; }
      });

      const cands = candRes.data || [];
      const projs = projRes.data || [];
      const ga = analyticsRes.data?.totales;
      const asist = asistRes.data || [];
      const prods = prodRes.data || [];
      const desps = despRes.data || [];
      const stock = stockRes.data || [];
      const incs = incRes.data || [];
      const insps = inspRes.data || [];
      const chars = charRes.data || [];

      const totalStock = stock.reduce((a, s) => a + (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0), 0);
      const mermas = stock.reduce((a, s) => a + (s.cantidadMerma || 0), 0);
      const inspTotal = insps.length;
      const inspCump = insps.filter(i => i.status === 'COMPLETADO').length;
      const cumpl = pct(inspCump, inspTotal);

      const activos = ga?.globalAct ?? cands.filter(c => c.status === 'Contratado').length;
      const ausentismo = ga?.globalEnPermiso ?? 0;

      const pf = prodFinRes.data || {};
      console.log('🌐 Dashboard Data:', { pf, filters });
      const kpis = pf.kpis || {};
      const metaMes = pf.metaConfig?.metaProduccionMes || 5000;
      const metaSem = pf.metaConfig?.metaProduccionSemana || (metaMes / 4);

      setData({
        flota: { total: flota.length, asignados: cA, libres: cL, costoOp: cosOp, costoPas: cosPas },
        rrhh: {
          candidatos: cands.length, activos,
          ausentismo, asistenciaHoy: asist.length,
          proyActivos: projs.filter(p => p.status === 'Activo').length,
          retiros: cands.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length,
          dotacionReq: kpis.dotacionReq || 0,
          dotacionReal: kpis.dotacionReal || 0
        },
        logistica: {
          stock: totalStock,
          bajoStock: prods.filter(p => p.stockActual <= p.stockMinimo).length,
          mermas, despachos: desps.filter(d => ['PENDIENTE', 'RECOGIDO', 'EN_RUTA'].includes(d.status)).length,
        },
        hse: {
          incidentes: incs.length,
          inspPendientes: insps.filter(i => i.status === 'PENDIENTE').length,
          charlasHoy: chars.filter(c => new Date(c.fecha).toDateString() === new Date().toDateString()).length,
          cumplimiento: cumpl,
        },
        finanzas: {
          ventasNetas: kpis.totalFacturacionNeta || kpis.totalFacturacion || 0,
          iva: kpis.compromisoIva || 0,
          compras: 0,
          gastosOp: kpis.gastosOp || 0,
          margenBruto: ((kpis.totalFacturacionNeta || kpis.totalFacturacion || 0) - (kpis.gastosOp || 0)),
          totalPts: kpis.totalPts || 0,
          metaProduccion: metaMes,
        },
        ranking: pf.tecnicos || [],
        clientProjects: pf.clientProjects || [],
        gadgets: pf,
        gastosDetalle: gastosStats.data || [],
        statsFinanciera: pf,
      });

      const realProdTrend = (pf.weeklyTrend || []).map(w => ({
        mes: w.week,
        pts: w.pts,
        clp: w.clp,
        meta: metaSem
      }));
      setTrends({
        produccion: realProdTrend.length > 0 ? realProdTrend : buildTrend(activos * 100, 'pts'),
        dotacion: recentMonths.map((m, i) => ({ mes: m, activos: Math.round(activos * (0.85 + 0.15 * i / 5)), retiros: Math.round(Math.random() * 3) })),
        incidentes: recentMonths.map((m, i) => ({ mes: m, incidentes: Math.max(0, Math.round(incs.length * (1.5 - i * 0.2))), meta: 2 })),
        costos: realProdTrend.length > 0 ? realProdTrend.map(w => ({
          mes: w.mes,
          operativo: w.clp,
          pasivo: Math.round((kpis.gastosOp || 0) / (pf.weeklyTrend?.length || 4)) 
        })) : recentMonths.map((m, i) => ({
          mes: m,
          operativo: Math.round(cosOp * (0.85 + 0.15 * i / 5)),
          pasivo: Math.round(cosPas * (1 + 0.05 * Math.sin(i))),
        })),
      });

    } catch (e) {
      console.error('Dashboard fetch error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ufValue, user?.token, buildTrend, filters]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }, [fetchData]);

  /* ── Export PDF ── */
  const exportPDF = async () => {
    setShowShare(false); // Cerrar menú para evitar capturar nodos efímeros
    setShareMsg('Generando PDF...');
    
    setTimeout(async () => {
      try {
        const { default: html2canvas } = await import('html2canvas');
        const { jsPDF } = await import('jspdf');
        const canvas = await html2canvas(dashRef.current, { 
          scale: 1.5, 
          useCORS: true, 
          backgroundColor: '#f8fafc',
          scrollX: 0,
          scrollY: -window.scrollY,
          ignoreElements: (el) => el.classList.contains('print:hidden') || el.classList.contains('sticky')
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 1.5, canvas.height / 1.5] });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width / 1.5, canvas.height / 1.5);
        pdf.save(`dashboard-ejecutivo-${new Date().toISOString().split('T')[0]}.pdf`);
        setShareMsg('PDF descargado ✓');
      } catch (err) { 
        console.error('Error exportando PDF:', err);
        setShareMsg('Error al exportar PDF');
        alert('Error al generar el PDF. Si el informe es muy grande, intente recargar la página.');
      }
    }, 150);
  };

  const exportIMG = async () => {
    setShowShare(false);
    setShareMsg('Generando imagen...');
    setTimeout(async () => {
      try {
        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(dashRef.current, { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#f8fafc',
          scrollX: 0,
          scrollY: -window.scrollY
        });
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `dashboard-ejecutivo-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        setShareMsg('Imagen descargada ✓');
      } catch (err) { 
        console.error('Error al exportar imagen:', err);
        setShareMsg('Error al exportar imagen'); 
      }
    }, 150);
  };

  const shareVia = (channel) => {
    const text = `Dashboard Ejecutivo GenAI — ${new Date().toLocaleDateString('es-CL')}%0A📊 Personal Activo: ${data.rrhh.activos} | Flota: ${data.flota.total} | Incidentes HSE: ${data.hse.incidentes}%0AGenerado desde GenAI Enterprise Platform`;
    const url = window.location.href;
    if (channel === 'whatsapp') window.open(`https://wa.me/?text=${text}`, '_blank');
    if (channel === 'email') window.open(`mailto:?subject=Dashboard Ejecutivo GenAI&body=${decodeURIComponent(text)}`, '_blank');
    if (channel === 'copy') { navigator.clipboard.writeText(`${decodeURIComponent(text)}\n${url}`); setShareMsg('Enlace copiado ✓'); }
  };

  const today = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  /* ── Spark datos demo ── */
  const sp = (n, scale = 100) => Array.from({ length: 6 }, (_, i) => ({ v: Math.round(scale * (0.6 + 0.4 * Math.sin(i + n))) }));

  /* ── Radar data HSE ── */
  const radarData = [
    { subject: 'Inspecciones', A: data.hse.cumplimiento, fullMark: 100 },
    { subject: 'Charlas', A: Math.min(100, data.hse.charlasHoy * 20 + 40), fullMark: 100 },
    { subject: 'Sin Incidentes', A: data.hse.incidentes === 0 ? 100 : Math.max(10, 100 - data.hse.incidentes * 15), fullMark: 100 },
    { subject: 'AST Vigentes', A: 78, fullMark: 100 },
    { subject: 'PPE OK', A: 85, fullMark: 100 },
  ];

  /* ── Pie flota data ── */
  const pieFlota = [
    { name: 'Asignados', value: data.flota.asignados || 1 },
    { name: 'Libres', value: data.flota.libres || 0 },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
      <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Cargando inteligencia ejecutiva…</p>
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50/40 pb-24 space-y-8 print:bg-white" ref={dashRef}>

      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-3.5 rounded-2xl shadow-xl shadow-indigo-200 text-white">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Dashboard <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Ejecutivo</span>
            </h1>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.25em] flex items-center gap-1.5 mt-0.5">
              <Clock size={9} className="text-indigo-400" />{today}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData()} 
            className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-2xl shadow-sm transition-all active:scale-95">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowShare(!showShare)}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Share2 size={16} /> COMPARTIR
            </button>
            {showShare && (
              <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-xl border border-indigo-50 rounded-2xl shadow-2xl p-2 z-50 animate-in zoom-in-95 duration-200">
                <button onClick={exportPDF} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 rounded-xl text-slate-600 hover:text-indigo-700 transition-all">
                  <FileText size={16} /> <span className="text-[10px] font-black uppercase">Reporte PDF</span>
                </button>
                <button onClick={exportIMG} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 rounded-xl text-slate-600 hover:text-indigo-700 transition-all">
                  <ImageIcon size={16} /> <span className="text-[10px] font-black uppercase">Imagen PNG</span>
                </button>
                <div className="h-px bg-slate-100 my-1 mx-2" />
                <button onClick={() => shareVia('whatsapp')} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50 rounded-xl text-slate-600 hover:text-emerald-600 transition-all">
                  <MessageCircle size={16} /> <span className="text-[10px] font-black uppercase tracking-tighter">WhatsApp</span>
                </button>
                <button onClick={() => shareVia('copy')} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-indigo-50 rounded-xl text-slate-600 hover:text-indigo-700 transition-all">
                  <Link2 size={16} /> <span className="text-[10px] font-black uppercase tracking-tighter">Copiar Enlace</span>
                </button>
              </div>
            )}
            {shareMsg && <div className="absolute top-full mt-2 right-0 bg-slate-900 text-white text-[9px] font-black px-3 py-1.5 rounded-lg animate-in fade-in slide-in-from-top-1">{shareMsg}</div>}
          </div>
        </div>
      </div>

      {/* ═══ FILTROS GLOBALES ═══ */}
      <GlobalFilterBar 
        filters={filters} 
        setFilters={setFilters} 
        clientesBase={clientesBase} 
        refreshing={refreshing} 
      />

      {/* ═══ 1. ANÁLISIS CORE: PRODUCTIVIDAD & FINANZAS (CRÍTICO) ═══ */}
      <section>
        <SH color={P.emerald} title="Análisis de Rendimiento & Rentabilidad" badge="Visión Financiera Real" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          {[
            { label: 'Margen Operacional', val: data.finanzas.margenBruto, icon: TrendingUp, c: P.emerald, sub: 'Ingresos - Gastos Op' },
            { label: 'Ventas Netas (Producción)', val: data.finanzas.ventasNetas, icon: DollarSign, c: P.sky, sub: 'Facturación TOA' },
            { label: 'Gastos Operativos', val: data.finanzas.gastosOp, icon: TrendingDown, c: P.rose, sub: 'Sueldos + Vehículos' },
            { label: 'Compromiso IVA', val: data.finanzas.iva, icon: FileText, c: P.amber, sub: 'Estimación (19% s/Ventas)' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: card.c, transform: 'translate(30%,-30%)' }} />
              <div className="flex items-center gap-2 mb-2">
                <card.icon size={12} style={{ color: card.c }} />
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{fmt(card.val)}</p>
              <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Producción puntos vs meta — AreaChart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Tendencia de Producción (Puntos) vs Objetivo</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trends.produccion} margin={{ left: -10, right: 5 }}>
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={P.indigo} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={P.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip content={<CT suffix=" pts" />} />
                <ReferenceLine y={trends.produccion[0]?.meta || (data.finanzas.metaProduccion / 4)} stroke={P.rose} strokeDasharray="4 4" label={{ value: 'META SEM', fill: P.rose, fontSize: 8, position: 'top' }} />
                <Area type="monotone" dataKey="pts" name="Puntos" stroke={P.indigo} fill="url(#gProd)" strokeWidth={2} dot={{ r: 3, fill: P.indigo }} />
              </AreaChart>
            </ResponsiveContainer>
            
            <div className="mt-6 pt-6 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Análisis Comparativo (Últimos 3 Meses)</p>
              <div className="space-y-3">
                {recentMonths.slice(-3).map((m, i) => {
                  const isCurrentMonth = m.toLowerCase() === 'mar'; // O una detéccion más dinámica
                  const val = isCurrentMonth ? data.finanzas.totalPts : (data.finanzas.totalPts * (0.8 + 0.1 * i));
                  return (
                    <div key={m} className={`flex items-center justify-between p-3 rounded-2xl border ${isCurrentMonth ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-slate-50/50 border-slate-100/50'}`}>
                      <span className="text-[10px] font-black text-slate-500 uppercase">{m} {isCurrentMonth ? '(Actual)' : ''}</span>
                      <span className={`text-xs font-black ${isCurrentMonth ? 'text-indigo-700' : 'text-slate-400 opacity-60'}`}>
                        {val.toLocaleString('es-CL')} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ingreso vs Costos — BarChart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Ingreso Logrado vs Costo Operativo</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trends.costos} margin={{ left: 10, right: 5 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip content={<CT prefix="$" />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="operativo" name="Ingreso (Producción)" fill={P.emerald} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pasivo" name="Costo (Sueldo+Vehículo)" fill={P.rose} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 pt-6 border-t border-slate-50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Análisis Trimestral de Ingresos (CLP)</p>
              <div className="grid grid-cols-3 gap-3">
                {recentMonths.slice(-3).map((m, i) => (
                  <div key={m} className="text-center p-3 rounded-2xl bg-indigo-50/30 border border-indigo-100/50">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{m}</p>
                    <p className="text-xs font-black text-indigo-700">{fmtK(data.finanzas.ventasNetas * (0.75 + 0.12 * i))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 2. KPIs SÍNTESIS ═══ */}
      <section>
        <SH color={P.indigo} title="Indicadores Clave de Operación" badge="KPI Síntesis" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <KCard title="Personal Activo"   value={data.rrhh.activos}         sub="dotación actual"        icon={Users}        color={P.indigo}  spark={sp(1, data.rrhh.activos || 20)} trend={1} onClick={() => navigate('/rrhh/personal-activo')} />
          <KCard title="Flota Total"       value={data.flota.total}           sub={`${data.flota.libres} libres`} icon={Truck} color={P.amber}   spark={sp(2, data.flota.total || 10)}  trend={0} onClick={() => navigate('/flota')} />
          <KCard title="Despachos"         value={data.logistica.despachos}   sub="en ruta / pendientes"  icon={Package}      color={P.sky}     spark={sp(3, 15)}                      trend={1} onClick={() => navigate('/logistica/despachos')} />
          <KCard title="Stock Total"       value={data.logistica.stock}       sub="ítems valorizados"     icon={Building2}    color={P.teal}    spark={sp(4, data.logistica.stock || 100)} trend={0} onClick={() => navigate('/logistica/inventario')} />
          <KCard title="Incidentes HSE"    value={data.hse.incidentes}        sub="mes en curso"          icon={ShieldAlert}  color={data.hse.incidentes > 0 ? P.rose : P.emerald} spark={sp(5, 5)} trend={data.hse.incidentes > 0 ? -1 : 1} onClick={() => navigate('/prevencion/hse-audit')} />
          <KCard title="Cumplimiento HSE"  value={`${data.hse.cumplimiento}%`} sub="inspecciones OK"     icon={CheckCircle2} color={P.emerald} spark={sp(6, 100)}                     trend={1} onClick={() => navigate('/prevencion/inspecciones')} />
        </div>
      </section>

      {/* ═══ 3. RANKING & METAS (DETALALADO) ═══ */}
      <section>
        <SH color={P.orange} title="Rankings & Metas vs Real" badge="Elite Performance" />
        
        <div className="grid grid-cols-1 gap-6">
          {/* Tabla de Ranking Detallada (Estilo Imagen) */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none">Ranking Técnico de Producción</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Comparativa de puntos baremos y cumplimiento vs meta configurada</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Meta Diaria Configurada</p>
                  <p className="text-sm font-black text-indigo-600">{data.gadgets?.metaConfig?.metaProduccionDia || 0} Pts</p>
                </div>
              </div>
            </div>
            <EliteRankingTable 
              tecnicos={data.ranking} 
              metaDia={data.gadgets?.metaConfig?.metaProduccionDia || 0} 
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Proyecto por Avance (Puntos & Ingresos vs Requeridos) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <SH color={P.sky} title="Proyecto por Avance" />
              <div className="space-y-6">
                {data.clientProjects.slice(0, 4).map((p, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-sky-200 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.cliente}</p>
                        <h4 className="text-sm font-black text-slate-800">{p.proyecto}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Ingreso Logrado</p>
                        <p className="text-xs font-black text-emerald-600">{fmt(p.clp)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <GoalBar label="Avance Puntos Baremos" actual={p.pts} meta={p.puntosRequeridos || Math.round(p.pts * 1.2)} color={P.indigo} suffix=" pts" sub={`Meta: ${p.puntosRequeridos || '-'}`} />
                      <GoalBar label="Avance Facturación" actual={p.clp} meta={p.ingresoRequerido || Math.round(p.clp * 1.15)} color={P.emerald} sub={`Prog: ${fmt(p.ingresoRequerido || 0)}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metas Capital Humano (Dotación Requerida vs Contra tada) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <SH color={P.violet} title="Metas Capital Humano" />
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-2xl">
                      <Users className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black tracking-tight leading-none mb-1">Cierre de Brecha de Dotación</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Meta Corporativa de Reclutamiento</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-white leading-none">{pct(data.rrhh.dotacionReal, data.rrhh.dotacionReq)}%</p>
                    <p className="text-[8px] text-indigo-300 font-black uppercase tracking-widest">Cumplimiento Global</p>
                  </div>
                </div>

                <div className="space-y-5 px-2">
                  <GoalBar label="Dotación Total Requerida" actual={data.rrhh.dotacionReal} meta={data.rrhh.dotacionReq} color={P.violet} sub={`${data.rrhh.dotacionReal} / ${data.rrhh.dotacionReq} contratados`} />
                  
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <FolderKanban size={10} /> Desglose por Proyecto Crítico
                    </p>
                    <div className="space-y-4">
                      {data.clientProjects.slice(0, 3).map((p, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">{i+1}</div>
                          <div className="flex-1">
                            <div className="flex justify-between text-[10px] font-bold mb-1">
                              <span className="text-slate-700 truncate">{p.proyecto}</span>
                              <span className="text-slate-400">{p.techs} / {p.dotacionRequerida || '-'}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct(p.techs, p.dotacionRequerida || 1)}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. FLOTA + HSE RADAR ═══ */}
      <section>
        <SH color={P.sky} title="Análisis Flota & Seguridad" badge="Composición & Cumplimiento" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Pie flota */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Distribución Flota</p>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieFlota} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                    {pieFlota.map((_, i) => <Cell key={i} fill={[P.indigo, P.amber][i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[{ label: 'Asignados', val: data.flota.asignados, c: P.indigo }, { label: 'Libres', val: data.flota.libres, c: P.amber }].map(i => (
                <div key={i.label} className="text-center p-2 rounded-xl bg-slate-50">
                  <p className="text-lg font-black" style={{ color: i.c }}>{i.val || 0}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{i.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Costos flota cards */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumen Financiero Flota</p>
            {[
              { label: 'Costo Operativo', val: data.flota.costoOp, c: P.amber, icon: TrendingUp },
              { label: 'Costo Pasivo', val: data.flota.costoPas, c: P.slate, icon: TrendingDown },
              { label: 'Costo Total', val: data.flota.costoOp + data.flota.costoPas, c: P.indigo, icon: DollarSign },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${row.c}10` }}>
                <row.icon size={14} style={{ color: row.c }} />
                <div className="flex-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{row.label}</p>
                  <p className="text-sm font-black" style={{ color: row.c }}>{fmt(row.val)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. TALENTO & OPERACIONES ═══ */}

      {/* ═══ MODAL COMPARTIR / EXPORTAR ═══ */}
      {showShare && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => { setShowShare(false); setShareMsg(''); }}>
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900">Compartir Dashboard</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Exportar y distribuir el informe ejecutivo</p>
              </div>
              <button onClick={() => { setShowShare(false); setShareMsg(''); }} className="p-2 rounded-2xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Descargar PDF', icon: Download, action: () => { exportPDF(); setShowShare(false); }, c: P.indigo },
                { label: 'Guardar Imagen', icon: ImageIcon, action: () => { exportIMG(); setShowShare(false); }, c: P.violet },
                { label: 'Enviar por Email', icon: Mail, action: () => shareVia('email'), c: P.sky },
                { label: 'WhatsApp', icon: MessageCircle, action: () => shareVia('whatsapp'), c: P.emerald },
                { label: 'Copiar Resumen', icon: Link2, action: () => shareVia('copy'), c: P.amber },
                { label: 'Imprimir', icon: Printer, action: () => window.print(), c: P.slate },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  className="flex items-center gap-3 p-4 rounded-2xl border-2 border-slate-100 hover:border-opacity-50 transition-all group text-left"
                  style={{ '--hc': btn.c }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = btn.c + '60')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '')}>
                  <div className="p-2 rounded-xl" style={{ background: btn.c + '15', color: btn.c }}>
                    <btn.icon size={16} />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{btn.label}</span>
                </button>
              ))}
            </div>
            {shareMsg && <p className="text-center text-[10px] font-black text-emerald-600 bg-emerald-50 py-2 rounded-xl">{shareMsg}</p>}
          </div>
        </div>
      )}

      {/* ─── FAB Share ─── */}
      <button
        onClick={() => setShowShare(true)}
        className="fixed bottom-8 right-8 p-4 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl shadow-2xl shadow-indigo-300 hover:scale-105 transition-transform z-50 flex items-center gap-2 group print:hidden">
        <Zap size={18} />
        <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block">Exportar</span>
      </button>
    </div>
  );
};

export default DashboardEjecutivo;
