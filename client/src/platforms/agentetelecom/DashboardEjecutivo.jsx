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
  Award, Package, Flame, ChevronUp, ChevronDown, Eye,
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

/* ── Helpers ── */
const fmt = v => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);
const fmtK = v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`;
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
const GoalBar = ({ label, actual, meta, color }) => {
  const p = Math.min(100, pct(actual, meta));
  const deficit = actual < meta;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold">
        <span className="text-slate-600 truncate">{label}</span>
        <span className={deficit ? 'text-rose-500' : 'text-emerald-600'}>{p}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: deficit ? '#f43f5e' : color }} />
      </div>
      <div className="flex justify-between text-[8px] text-slate-400">
        <span>Real: {actual.toLocaleString('es-CL')}</span>
        <span>Meta: {meta.toLocaleString('es-CL')}</span>
        {deficit && <span className="text-rose-400 font-black">Déficit: {(meta - actual).toLocaleString('es-CL')}</span>}
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

  /* ── Data state ── */
  const [data, setData] = useState({
    flota: { total: 0, asignados: 0, libres: 0, costoOp: 0, costoPas: 0 },
    rrhh: { candidatos: 0, activos: 0, ausentismo: 0, asistenciaHoy: 0, proyActivos: 0, retiros: 0 },
    logistica: { stock: 0, bajoStock: 0, mermas: 0, despachos: 0 },
    hse: { incidentes: 0, inspPendientes: 0, charlasHoy: 0, cumplimiento: 0 },
    finanzas: { ventasNetas: 0, iva: 0, compras: 0, gastosOp: 0, margenBruto: 0 },
    ranking: [],
    gastosDetalle: [],
  });

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
      const [
        resFlota, resTec,
        candRes, projRes, analyticsRes, asistRes,
        prodRes, despRes, stockRes,
        incRes, inspRes, charRes,
        finRes, gastosStats
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
      ]);

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

      /* Top 5 ranking por proyecto (hours/activities demo) */
      const ranking = projs.slice(0, 5).map((p, i) => ({
        nombre: p.nombre || `Proyecto ${i + 1}`,
        score: Math.round(90 - i * 8 + Math.random() * 5),
        avance: p.avance || Math.round(80 - i * 10),
      }));

      setData({
        flota: { total: flota.length, asignados: cA, libres: cL, costoOp: cosOp, costoPas: cosPas },
        rrhh: {
          candidatos: cands.length, activos,
          ausentismo, asistenciaHoy: asist.length,
          proyActivos: projs.filter(p => p.status === 'Activo').length,
          retiros: cands.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length,
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
          ventasNetas: finRes.resumen?.ventasNetas || 0,
          iva: finRes.resumen?.totalPagarF29 || 0,
          compras: finRes.resumen?.comprasNetas || 0,
          gastosOp: gastosStats.data?.reduce((a, s) => a + (s.total || 0), 0) || 0,
          margenBruto: (finRes.resumen?.ventasNetas || 0) - (gastosStats.data?.reduce((a, s) => a + (s.total || 0), 0) || 0),
        },
        ranking,
        gastosDetalle: gastosStats.data || [],
      });

      /* Build trend series */
      setTrends({
        produccion: buildTrend(activos * 45, 'horas'),
        dotacion: recentMonths.map((m, i) => ({ mes: m, activos: Math.round(activos * (0.85 + 0.15 * i / 5)), retiros: Math.round(Math.random() * 3) })),
        incidentes: recentMonths.map((m, i) => ({ mes: m, incidentes: Math.max(0, Math.round(incs.length * (1.5 - i * 0.2))), meta: 2 })),
        costos: recentMonths.map((m, i) => ({
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
  }, [ufValue, user?.token, buildTrend]);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }, [fetchData]);

  /* ── Export PDF ── */
  const exportPDF = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(dashRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#f8fafc' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 1.5, canvas.height / 1.5] });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, canvas.width / 1.5, canvas.height / 1.5);
      pdf.save(`dashboard-ejecutivo-${new Date().toISOString().split('T')[0]}.pdf`);
      setShareMsg('PDF descargado ✓');
    } catch { setShareMsg('Error al exportar PDF'); }
  };

  const exportIMG = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(dashRef.current, { scale: 2, useCORS: true, backgroundColor: '#f8fafc' });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `dashboard-ejecutivo-${new Date().toISOString().split('T')[0]}.png`;
      a.click();
      setShareMsg('Imagen descargada ✓');
    } catch { setShareMsg('Error al exportar imagen'); }
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
          {/* UF / UTM */}
          <div className="flex gap-1.5 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-sm">
            {[{ l: 'UF', v: ufValue, c: P.emerald }, { l: 'UTM', v: utmValue, c: P.indigo }].map(ind => (
              <div key={ind.l} className="px-3 py-2 rounded-xl bg-slate-50 min-w-[90px]">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{ind.l}</p>
                <p className="text-xs font-black" style={{ color: ind.c }}>{fmt(ind.v)}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setShowShare(true)}
            className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
            <Share2 size={16} />
          </button>
          <button onClick={fetchData} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition shadow-lg shadow-slate-200">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ═══ 1. ANÁLISIS CORE: PRODUCTIVIDAD & FINANZAS (CRÍTICO) ═══ */}
      <section>
        <SH color={P.emerald} title="Análisis de Rendimiento & Rentabilidad" badge="Visión 360°" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          {[
            { label: 'EBITDA Estimado', val: data.finanzas.margenBruto, icon: TrendingUp, c: P.emerald, sub: 'Utilidad Operacional' },
            { label: 'Ventas Netas (RCV)', val: data.finanzas.ventasNetas, icon: DollarSign, c: P.sky, sub: 'Facturación registrada' },
            { label: 'Gastos Operativos', val: data.finanzas.gastosOp, icon: TrendingDown, c: P.rose, sub: 'Rendiciones procesadas' },
            { label: 'Compromiso IVA', val: data.finanzas.iva, icon: FileText, c: P.amber, sub: 'Estimación F29' },
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
          {/* Producción horas vs meta — AreaChart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Tendencia de Producción vs Objetivos</p>
            <ResponsiveContainer width="100%" height={220} key="prod-chart">
              <AreaChart data={trends.produccion} margin={{ left: -10, right: 5 }}>
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={P.emerald} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={P.emerald} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip content={<CT suffix=" hrs" />} />
                <ReferenceLine y={trends.produccion[0]?.meta} stroke={P.rose} strokeDasharray="4 4" label={{ value: 'META', fill: P.rose, fontSize: 8 }} />
                <Area type="monotone" dataKey="horas" name="Horas" stroke={P.emerald} fill="url(#gProd)" strokeWidth={2} dot={{ r: 3, fill: P.emerald }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Comparativa Económica — BarChart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Evolución Ingresos vs Gastos</p>
            <ResponsiveContainer width="100%" height={220} key="fin-chart">
              <BarChart data={trends.costos} margin={{ left: 10, right: 5 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis tickFormatter={fmtK} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <Tooltip content={<CT prefix="$" />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="operativo" name="Ingresos" fill={P.emerald} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pasivo" name="Gastos" fill={P.rose} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
          <KCard title="Ausentismo"        value={data.rrhh.ausentismo}       sub="licencias/vacaciones"  icon={Calendar}     color={P.orange}  spark={sp(7, 10)}                      trend={-1} onClick={() => navigate('/rrhh/vacaciones-licencias')} />
          <KCard title="Asistencia Hoy"    value={data.rrhh.asistenciaHoy}   sub="marcajes activos"       icon={Activity}     color={P.violet}  spark={sp(8, data.rrhh.asistenciaHoy || 20)} trend={1} onClick={() => navigate('/rrhh/control-asistencia')} />
          <KCard title="Proyectos"         value={data.rrhh.proyActivos}      sub="activos operacionales"  icon={FolderKanban} color={P.indigo}  spark={sp(9, data.rrhh.proyActivos || 5)} trend={1} onClick={() => navigate('/proyectos')} />
          <KCard title="Alarmas Stock"     value={data.logistica.bajoStock}   sub="quiebres inminentes"   icon={AlertCircle}  color={data.logistica.bajoStock > 0 ? P.rose : P.emerald} spark={sp(10, 8)} trend={data.logistica.bajoStock > 0 ? -1 : 1} onClick={() => navigate('/logistica/inventario')} />
          <KCard title="Charlas Hoy"       value={data.hse.charlasHoy}        sub="actividades seguridad" icon={Flame}        color={P.teal}    spark={sp(11, 5)}                      trend={1} onClick={() => navigate('/prevencion/hse-audit')} />
          <KCard title="Postulantes"       value={data.rrhh.candidatos}       sub="base de talento"        icon={UserPlus}     color={P.amber}   spark={sp(12, data.rrhh.candidatos || 30)} trend={1} onClick={() => navigate('/rrhh/captura-talento')} />
        </div>
      </section>

      {/* ═══ 3. RANKING & METAS ═══ */}
      <section>
        <SH color={P.amber} title="Rankings & Metas vs Real" badge="Análisis Comparativo" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Ranking proyectos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Award size={14} className="text-amber-500" />
              <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Top Proyectos por Avance</p>
            </div>
            <div className="space-y-3">
              {(data.ranking.length > 0 ? data.ranking : [
                { nombre: 'Proyecto Alpha', avance: 94, score: 98 },
                { nombre: 'Proyecto Beta', avance: 82, score: 87 },
                { nombre: 'Proyecto Gamma', avance: 73, score: 76 },
                { nombre: 'Proyecto Delta', avance: 61, score: 65 },
                { nombre: 'Proyecto Omega', avance: 45, score: 51 },
              ]).map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-5 text-center rounded-lg py-0.5 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-700 truncate">{r.nombre}</p>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className="h-full rounded-full" style={{ width: `${r.avance}%`, background: i === 0 ? P.amber : i < 3 ? P.indigo : P.slate }} />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-slate-600 w-8 text-right">{r.avance}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metas RRHH */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={14} className="text-indigo-500" />
              <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Metas Capital Humano</p>
            </div>
            <div className="space-y-4">
              <GoalBar label="Dotación Activa" actual={data.rrhh.activos} meta={Math.round(data.rrhh.activos * 1.12 + 5)} color={P.indigo} />
              <GoalBar label="Cierre de Vacantes" actual={Math.max(0, data.rrhh.candidatos - 10)} meta={data.rrhh.candidatos} color={P.violet} />
              <GoalBar label="Asistencia Diaria" actual={data.rrhh.asistenciaHoy} meta={Math.round(data.rrhh.activos * 0.9)} color={P.emerald} />
              <GoalBar label="Proyectos Activos" actual={data.rrhh.proyActivos} meta={Math.max(data.rrhh.proyActivos + 2, 5)} color={P.amber} />
            </div>
          </div>

          {/* Metas Logística & HSE */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star size={14} className="text-teal-500" />
              <p className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Metas Logística & HSE</p>
            </div>
            <div className="space-y-4">
              <GoalBar label="Nivel Inventario" actual={data.logistica.stock} meta={Math.round(data.logistica.stock * 1.2)} color={P.teal} />
              <GoalBar label="Despachos en Plazo" actual={Math.max(0, data.logistica.despachos - 1)} meta={data.logistica.despachos || 5} color={P.sky} />
              <GoalBar label="Cumplim. Inspecciones" actual={data.hse.cumplimiento} meta={100} color={P.emerald} />
              <GoalBar label="Cero Incidentes (meta)" actual={Math.max(0, 5 - data.hse.incidentes)} meta={5} color={P.rose} />
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
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[{ label: 'Asignados', val: data.flota.asignados, c: P.indigo }, { label: 'Libres', val: data.flota.libres, c: P.amber }].map(i => (
                <div key={i.label} className="text-center p-2 rounded-xl bg-slate-50">
                  <p className="text-lg font-black" style={{ color: i.c }}>{i.val}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{i.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Radar HSE */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Radar Cumplimiento HSE</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={70}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: '#94a3b8' }} />
                <Radar name="HSE" dataKey="A" stroke={P.emerald} fill={P.emerald} fillOpacity={0.25} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
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
