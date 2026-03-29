import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Activity, Search, FileSpreadsheet, TrendingUp, Users, Award, Trophy,
  Calendar, CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Star, Target,
  MapPin, BarChart3, Layers, Clock, Hash, Zap,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, EyeOff,
  CheckCircle2, Thermometer, Grid3X3, Presentation, Maximize2, Minimize2,
  DollarSign, Percent, TrendingDown, Briefcase, Calculator,
  Cpu, Tv, Wifi, Smartphone, Box, Package, Anchor, ArrowUpCircle,
  Map, BarChart, LayoutDashboard, Monitor, Users as UsersIcon,
  Settings, Navigation, Lock, Unlock, FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { adminApi } from '../rrhh/rrhhApi';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const pts = (v) => parseFloat(v) || 0;

const CLP = (v) => new Intl.NumberFormat('es-CL', { 
  style: 'currency', 
  currency: 'CLP', 
  maximumFractionDigits: 0 
}).format(Math.round(v || 0));

const fmtPts = CLP;
const fmtCLP = CLP;

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toDateKey = (d) => {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseToUTC = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};

const addDays = (d, n) => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

const toInputDate = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const firstDayOfMonth = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1));
};

// ISO week number (Lun=1, Dom=7)
const getISOWeek = (dateStr) => {
  const d = new Date(dateStr);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return { week: weekNo, year: utc.getUTCFullYear() };
};

// Rango de fechas de una semana ISO
const getWeekRange = (year, week) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1));
  const weekStart = new Date(startOfWeek1);
  weekStart.setUTCDate(weekStart.getUTCDate() + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
};

const getTecnico = (d) => d['Técnico'] || d.Técnico || '';
const getCiudad = (d) => d['Ciudad'] || d.Ciudad || '';
const getSubtipo = (d) => d['Subtipo_de_Actividad'] || d.Subtipo_de_Actividad || '';
const getZona = (d) => d['Zona_de_Trabajo'] || d.Zona_de_Trabajo || '';
const getAgencia = (d) => d['Agencia'] || d.Agencia || '';
const getComuna = (d) => d['Comuna'] || d.Comuna || '';
const getDescLPU = (d) => d['Desc_LPU_Base'] || d.Desc_LPU_Base || '';
const getCodigoLPU = (d) => d['Codigo_LPU_Base'] || d.Codigo_LPU_Base || '';
const getOrderId = (d) => (d['Número_de_Petición'] || d['Número de Petición'] || '').toString();
const isRepair = (d) => getOrderId(d).toUpperCase().startsWith('INC');
const getFecha = (d) => d['fecha'] || d.fecha || '';

const ptsTotal = (d) => pts(d['Pts_Total_Baremo'] || d.Pts_Total_Baremo);
const ptsBase = (d) => pts(d['Pts_Actividad_Base'] || d.Pts_Actividad_Base);
const ptsDeco = (d) => pts(d['Pts_Deco_Adicional'] || d.Pts_Deco_Adicional);
const ptsRepetidor = (d) => pts(d['Pts_Repetidor_WiFi'] || d.Pts_Repetidor_WiFi);
const ptsTelefono = (d) => pts(d['Pts_Telefono'] || d.Pts_Telefono);

// ─────────────────────────────────────────────────────────────
// PERFORMANCE TRACKING COMPONENTS
// ─────────────────────────────────────────────────────────────
const MetaBadge = ({ pts, meta, label }) => {
  if (!meta || meta <= 0) return null;
  const pct = Math.round((pts / meta) * 100);
  let color = 'bg-red-100 text-red-700 border-red-200';
  if (pct >= 100) color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (pct >= 80) color = 'bg-amber-100 text-amber-700 border-amber-200';
  
  return (
    <div className={`inline-flex flex-col items-center px-2 py-1 rounded-lg border ${color} shadow-sm transition-all hover:scale-105`}>
      <span className="text-[11px] font-black">{pct}%</span>
      {label && <span className="text-[8px] font-black uppercase tracking-tighter opacity-70">{label}</span>}
    </div>
  );
};

const MetaGap = ({ pts, meta, compact = false }) => {
  if (!meta || meta <= 0) return null;
  const gap = meta - pts;
  if (gap <= 0) return (
    <div className="flex items-center gap-1 text-emerald-500">
      <Trophy className="w-3 h-3" strokeWidth={3} />
      {!compact && <span className="text-[9px] font-black uppercase tracking-widest">Meta Superada</span>}
    </div>
  );
  
  return (
    <div className="flex items-center gap-1 text-red-500">
      <TrendingDown className="w-3 h-3" strokeWidth={3} />
      <span className="text-[9px] font-black uppercase tracking-widest italic">
        {compact ? `-${Math.round(gap)}` : `Faltan ${Math.round(gap)}`}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MACRO-ZONAS DE CHILE
// ─────────────────────────────────────────────────────────────
const MACRO_ZONAS = {
  'NORTE': ['ARICA', 'ALTO HOSPICIO', 'IQUIQUE', 'ANTOFAGASTA', 'CALAMA', 'COPIAPO', 'LA SERENA', 'COQUIMBO', 'OVALLE'],
  'CENTRO COSTA': ['VALPARAISO', 'VINA DEL MAR', 'QUILPUE', 'VILLA ALEMANA', 'QUILLOTA', 'LOS ANDES', 'SAN ANTONIO'],
  'METROPOLITANA': ['SANTIAGO', 'NUNOA', 'LAS CONDES', 'LA FLORIDA', 'PUENTE ALTO', 'MAIPU', 'PROVIDENCIA', 'SAN MIGUEL', 'RECOLETA', 'MACUL', 'ESTACION CENTRAL', 'PUDAHUEL', 'INDEPENDENCIA', 'QUINTA NORMAL', 'SAN BERNARDO', 'CONCHALI', 'PENALOLEN', 'LA CISTERNA', 'QUILICURA', 'CERRO NAVIA', 'HUECHURABA', 'SAN JOAQUIN'],
  'SUR': ['RANCAGUA', 'TALCA', 'CURICO', 'CHILLAN', 'CONCEPCION', 'TALCAHUANO', 'LOS ANGELES', 'TEMUCO', 'VALDIVIA', 'OSORNO', 'PUERTO MONTT', 'PUNTA ARENAS']
};

// ─────────────────────────────────────────────────────────────
// SORT HOOK
// ─────────────────────────────────────────────────────────────
const useSortable = (defaultKey = 'facturacion', defaultDir = 'desc') => {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const toggle = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);
  const icon = useCallback((key) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-40 inline ml-1" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-emerald-400 inline ml-1" />
      : <ArrowDown className="w-3 h-3 text-emerald-400 inline ml-1" />;
  }, [sortKey, sortDir]);
  return { sortKey, sortDir, toggle, icon };
};

const StatCard = ({ icon: Icon, label, value, sub, color = 'emerald', target, achieved, dark = false }) => {
  const colors = {
    emerald: 'from-emerald-500 to-teal-400',
    blue: 'from-blue-500 to-indigo-400',
    purple: 'from-purple-500 to-fuchsia-400',
    amber: 'from-amber-400 to-yellow-300',
    indigo: 'from-indigo-500/80 to-violet-400/80',
    cyan: 'from-cyan-400 to-blue-400',
  };
  
  const iconColors = {
    emerald: dark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: dark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-100',
    purple: dark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
    amber: dark ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: dark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border-indigo-100',
    cyan: dark ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border-cyan-100',
  };

  const progress = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const isOver = target > 0 && achieved > target;

  const cardClasses = dark 
    ? "group relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-500 hover:shadow-indigo-500/20 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden flex flex-col justify-between h-full"
    : "group relative bg-white/95 backdrop-blur-2xl border border-white rounded-2xl p-4 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)] transition-all duration-500 hover:shadow-[0_30px_60px_-10px_rgba(79,70,229,0.12)] hover:scale-[1.02] hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between h-full";

  return (
    <div className={cardClasses}>
      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${colors[color]} opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-1000 blur-3xl -mr-32 -mt-32`} />
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2.5 rounded-xl border shadow-lg ${iconColors[color]} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
            <Icon className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="text-right">
            <p className={`text-[9px] font-black uppercase tracking-[0.25em] mb-1 ${dark ? 'text-indigo-400' : 'text-indigo-700'}`}>{label}</p>
            <div className={`text-xl font-black tracking-tighter drop-shadow transition-colors uppercase ${dark ? 'text-white' : 'text-slate-900'}`}>{value}</div>
          </div>
        </div>
        
        {target !== undefined && (
          <div className="space-y-3 mb-3">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider px-1">
              <span className={dark ? 'text-slate-400' : 'text-slate-800'}>Meta: {CLP(target)}</span>
              <span className={`px-2 py-0.5 rounded-lg font-bold shadow-sm ${isOver ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : dark ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                  {progress.toFixed(1)}%
              </span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden shadow-inner border p-0.5 ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-100/80 border-white'}`}>
              <div className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-1000 shadow-md`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-indigo-50/10 pt-4 flex items-center justify-between relative z-10">
         <span className={`text-[9px] font-black uppercase tracking-[0.15em] opacity-40 ${dark ? 'text-indigo-300' : 'text-slate-500'}`}>{sub || 'Financial Intel'}</span>
         <div className={`w-8 h-1 rounded-full ${dark ? 'bg-white/10' : 'bg-slate-200'} overflow-hidden`}>
            <div className={`h-full bg-gradient-to-r ${colors[color]} opacity-30`} style={{ width: '100%' }}></div>
         </div>
         {isOver && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black border border-emerald-100 shadow-sm animate-pulse">
              <Star className="w-3 h-3 fill-emerald-500" />
            </div>
          )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MINI STAT CARD (for expanded detail)
// ─────────────────────────────────────────────────────────────
const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="bg-indigo-50/30 rounded-2xl p-4 border border-indigo-100/50 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className="w-4 h-4 text-indigo-600" />}
      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-lg font-black text-indigo-900 uppercase">{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// COMPOSITION BAR
// ─────────────────────────────────────────────────────────────
const CompositionBar = ({ base, deco, repetidor, telefono }) => {
  const total = base + deco + repetidor + telefono;
  if (total === 0) return <div className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Sin datos</div>;
  const pct = (v) => ((v / total) * 100).toFixed(1);
  const segments = [
    { label: 'Base', value: base, pct: pct(base), color: 'bg-emerald-500', shadow: 'shadow-emerald-200' },
    { label: 'Deco', value: deco, pct: pct(deco), color: 'bg-blue-500', shadow: 'shadow-blue-200' },
    { label: 'WiFi', value: repetidor, pct: pct(repetidor), color: 'bg-purple-500', shadow: 'shadow-purple-200' },
    { label: 'Tel', value: telefono, pct: pct(telefono), color: 'bg-amber-500', shadow: 'shadow-amber-200' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-indigo-50/20 shadow-inner">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all duration-500 relative group`}
            style={{ width: `${s.pct}%` }}
          >
            <div className={`absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${s.color} ${s.shadow} shadow-sm`} />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {s.label}: 
              <span className="text-indigo-900 ml-1">{s.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function ProduccionVenta() {
  const { user } = useAuth();
  const location = useLocation();
  
  // ── State — datos pre-agregados del servidor ──
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [availableClientes, setAvailableClientes] = useState([]);

  // Filters — Synchronized with location.state from DescargaTOA
  const initialDesde = location.state?.desde || toInputDate(todayUTC());
  const initialHasta = location.state?.hasta || toInputDate(todayUTC());

  const [dateFrom, setDateFrom] = useState(initialDesde);
  const [dateTo, setDateTo] = useState(initialHasta);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('Completado');
  const [soloVinculados, setSoloVinculados] = useState(user?.email?.toLowerCase() !== 'ceo@synoptyk.cl');
  const [searchTech, setSearchTech] = useState('');

  // UI state
  const [expandedTech, setExpandedTech] = useState(null);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calSelectedDay, setCalSelectedDay] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(''); // week key for detail table (e.g. "2026-S12")

  // Presentation mode
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationStep, setPresentationStep] = useState(0);

  const refreshTimerRef = useRef(null);
  
  // ── Meta de producción configurada por la empresa ──
  const metaConfig = useMemo(() => serverData?.metaConfig || {
    metaProduccionDia: 0, diasLaboralesSemana: 5, diasLaboralesMes: 22,
    metaProduccionSemana: 0, metaProduccionMes: 0
  }, [serverData]);

  // ── Nombre de empresa ──
  const empresaNombre = serverData?.empresaNombre || user?.empresa?.nombre || 'Empresa';

  useEffect(() => {
    adminApi.getClientes().then(res => setAvailableClientes(res.data)).catch(() => {});
  }, []);

  // ── Fetch data pre-agregada del server (liviano y rápido) ──
  const fetchData = useCallback(async (desde, hasta, est, clis, type) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (typeof desde === 'string' && desde.length === 10) params.desde = desde;
      if (typeof hasta === 'string' && hasta.length === 10) params.hasta = hasta;
      if (est) params.estado = est;
      if (clis && clis.length > 0) params.clientes = clis;
      if (type && type !== 'todos') params.tipo = type;
      const { data } = await api.get('/bot/produccion-financiera', { params });
      setServerData(data);
      setLastRefresh(new Date());

      // Smart Date: Si estamos cargando el default (hoy) y el server nos dice que el último dato es otro día
      if (data.maxDate && (!desde || desde === toInputDate(todayUTC())) && desde !== data.maxDate) {
        setDateFrom(data.maxDate);
        setDateTo(data.maxDate);
      }
    } catch (err) {
      console.error('Error fetching production stats:', err);
      setError('Error al cargar datos de producción');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch cuando cambian las fechas o estado (debounce)
  const fetchTimerRef = useRef(null);
  useEffect(() => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchData(dateFrom, dateTo, estadoFilter, selectedClientes, typeFilter), 300);
    refreshTimerRef.current = setInterval(() => fetchData(dateFrom, dateTo, estadoFilter, selectedClientes, typeFilter), 300000); // 5 min
    return () => {
      clearTimeout(fetchTimerRef.current);
      clearInterval(refreshTimerRef.current);
    };
  }, [fetchData, dateFrom, dateTo, estadoFilter, selectedClientes, typeFilter]);

  // ── Technician ranking (filtrado local por búsqueda, tipo y vinculados) ──
  const techRanking = useMemo(() => {
    if (!serverData?.tecnicos) return [];
    let list = serverData.tecnicos;
    const search = searchTech.toLowerCase().trim();
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search));
    if (soloVinculados) list = list.filter(t => t.isVinculado);
    
    // Mapear avgPerDay porque el backend financiero se llama avgFactDia
    return list.map(t => ({ ...t, avgPerDay: t.avgFactDia || 0 }));
  }, [serverData, searchTech, soloVinculados]);

  // ── Hay filtros locales activos? ──
  const hasLocalFilters = searchTech.trim() !== '' || soloVinculados;

  // ── Header stats — recalculados desde techRanking filtrado ──
  const headerStats = useMemo(() => {
    if (!serverData?.kpis) return { totalOrders: 0, totalCLP: 0, avgPtsPerTechPerDay: 0, uniqueTechs: 0, uniqueDays: 0, metaRequired: 0, metaAchieved: 0 };
    
    // Metas en Pesos (Cables Conectados con Backend)
    const metasFinancieras = serverData.kpis?.metasFinancieras;
    const metaDiariaGlobal = metasFinancieras?.diaria ? (metasFinancieras.diaria * (serverData.kpis?.uniqueTechs || 1)) : (metaConfig.metaProduccionDia * (serverData.kpis?.uniqueTechs || 1) * (serverData.kpis?.valorPuntoProm || 1000));
    
    // Si no hay filtros locales, usar stats del servidor directamente
    if (!hasLocalFilters) {
      const totalCLP = serverData.kpis.totalFacturacion;
      const metaRequired = metasFinancieras?.diaria ? (metasFinancieras.diaria * serverData.kpis.uniqueTechs * serverData.kpis.uniqueDays) : (metaDiariaGlobal * serverData.kpis.uniqueDays);
      return {
        totalOrders: serverData.kpis.totalOrdenes,
        totalCLP,
        avgPtsPerTechPerDay: serverData.kpis.avgFactTecDia,
        uniqueTechs: serverData.kpis.uniqueTechs,
        uniqueDays: serverData.kpis.uniqueDays,
        equipoCounts: serverData.kpis.equipoCounts || { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 },
        equipoValores: serverData.kpis.equipoValores || { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 },
        metaRequired,
        metaAchieved: totalCLP,
        diff: totalCLP - metaRequired
      };
    }

    // Recalcular desde técnicos filtrados
    const totalOrders = techRanking.reduce((s, t) => s + t.orders, 0);
    const totalCLP = techRanking.reduce((s, t) => s + t.facturacion, 0);
    const uniqueTechs = techRanking.length;
    const allDays = new Set();
    techRanking.forEach(t => {
      if (t.dailyMap) Object.keys(t.dailyMap).forEach(dk => allDays.add(dk));
    });
    const uniqueDays = allDays.size;
    const avgPtsPerTechPerDay = uniqueTechs > 0 && uniqueDays > 0
      ? Math.round((totalCLP / uniqueTechs / uniqueDays)) : 0;

    // ── Equipo & Valorización (DECO, WIFI, MESH, etc.) ──
    const equipoCounts = { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 };
    const equipoValores = { 'Decodificadores': 0, 'Repetidores/Wifi': 0, 'Mesh/Otros': 0 };

    techRanking.forEach(t => {
      if (t.activities) {
        Object.entries(t.activities).forEach(([desc, data]) => {
          const uDesc = desc.toUpperCase();
          if (uDesc.includes('DECO')) {
            equipoCounts['Decodificadores'] += (t.qtyDeco || 0); // Usar qty específica si existe
            equipoValores['Decodificadores'] += data.clp;
          } else if (uDesc.includes('WIFI') || uDesc.includes('REPETIDOR') || uDesc.includes('EXTENDER')) {
            equipoCounts['Repetidores/Wifi'] += (t.qtyRepetidor || 0);
            equipoValores['Repetidores/Wifi'] += data.clp;
          } else if (uDesc.includes('MESH') || uDesc.includes('TEL')) {
            equipoCounts['Mesh/Otros'] += (t.qtyTelefono || 0);
            equipoValores['Mesh/Otros'] += data.clp;
          }
        });
      }
    });

    const metaRequired = metaConfig.metaProduccionDia * uniqueTechs * uniqueDays * (serverData.kpis.valorPuntoProm || 1000);

    return { 
      totalOrders, totalCLP, avgPtsPerTechPerDay, uniqueTechs, uniqueDays, 
      equipoCounts, equipoValores,
      metaRequired,
      metaAchieved: totalCLP,
      diff: totalCLP - metaRequired
    };
  }, [serverData, techRanking, hasLocalFilters]);

  const { sortKey: techSortKey, sortDir: techSortDir, toggle: techToggle, icon: techSortIcon } = useSortable('facturacion', 'desc');

  const sortedTechRanking = useMemo(() => {
    const arr = [...techRanking];
    arr.sort((a, b) => {
      const va = a[techSortKey] ?? 0;
      const vb = b[techSortKey] ?? 0;
      if (typeof va === 'string') return techSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return techSortDir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [techRanking, techSortKey, techSortDir]);

  // ── Calendario — recalculado desde técnicos filtrados ──
  const calendarData = useMemo(() => {
    const map = {};
    const source = hasLocalFilters ? techRanking : null;
    if (source) {
      // Reconstruir calendario desde dailyMap de técnicos filtrados
      source.forEach(t => {
        if (!t.dailyMap) return;
        Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
          const parts = dateKey.split('-');
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const d = parseInt(parts[2]);
          if (y === calMonth.year && m === calMonth.month) {
            if (!map[d]) map[d] = { clp: 0, orders: 0, techs: {} };
            map[d].clp += dd.clp;
            map[d].orders += dd.orders;
            map[d].techs[t.name] = (map[d].techs[t.name] || 0) + dd.clp;
          }
        });
      });
    } else {
      // Sin filtros locales: usar calendario del servidor
      const cal = serverData?.calendar || {};
      Object.entries(cal).forEach(([dateKey, dayData]) => {
        const parts = dateKey.split('-');
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const d = parseInt(parts[2]);
        if (y === calMonth.year && m === calMonth.month) {
          map[d] = dayData;
        }
      });
    }
    return map;
  }, [serverData, techRanking, calMonth, hasLocalFilters]);

  // ── Macro-zone data — recalculado desde técnicos filtrados si hay filtros ──
  const macroZoneData = useMemo(() => {
    let cityMap = serverData?.cities || {};
    if (hasLocalFilters) {
      // Reconstruir cityMap desde técnicos filtrados
      cityMap = {};
      techRanking.forEach(t => {
        if (!t.cityMap) return;
        Object.entries(t.cityMap).forEach(([city, data]) => {
          if (!cityMap[city]) cityMap[city] = { clp: 0, orders: 0 };
          cityMap[city].clp += (data.clp || data.pts || 0); // Flexibilidad
          cityMap[city].orders += data.orders;
        });
      });
    }
    const result = {};
    Object.entries(MACRO_ZONAS).forEach(([zone, cities]) => {
      const zoneTechs = new Set();
      const zoneCities = cities.map((c) => {
        // Find techs in this city
        techRanking.forEach(t => {
          if (t.cityMap?.[c]) zoneTechs.add(t.name);
        });

        return {
          name: c,
          clp: cityMap[c]?.clp || 0,
          orders: cityMap[c]?.orders || 0,
        };
      });
      const totalClpZone = zoneCities.reduce((s, c) => s + c.clp, 0);
      const totalOrdersZone = zoneCities.reduce((s, c) => s + c.orders, 0);
      const maxClp = Math.max(...zoneCities.map((c) => c.clp), 1);
      result[zone] = { 
        cities: zoneCities, 
        totalClp: totalClpZone, 
        totalOrders: totalOrdersZone, 
        maxClp,
        uniqueTechs: zoneTechs.size
      };
    });
    return result;
  }, [serverData, techRanking, hasLocalFilters]);
  
  const zonePerformance = useMemo(() => {
    return Object.entries(macroZoneData).map(([zone, data]) => ({
      zone,
      total: data.totalClp,
      orders: data.totalOrders,
      avgPerTech: data.uniqueTechs > 0 ? (data.totalClp / data.uniqueTechs) : 0
    })).sort((a, b) => b.total - a.total);
  }, [macroZoneData]);

  // ── LPU activity data — recalculada desde técnicos filtrados si hay filtros ──
  const lpuData = useMemo(() => {
    if (!hasLocalFilters) return serverData?.lpuActivities || [];
    // Reconstruir desde actividades de técnicos filtrados
    const lpuMap = {};
    techRanking.forEach(t => {
      if (!t.activities) return;
      Object.entries(t.activities).forEach(([desc, data]) => {
        if (!lpuMap[desc]) lpuMap[desc] = { desc, code: '', count: 0, totalPts: 0, totalCLP: 0 };
        lpuMap[desc].count += data.count;
        lpuMap[desc].totalPts += (data.pts || 0);
        lpuMap[desc].totalCLP += (data.clp || 0);
      });
    });
    return Object.values(lpuMap)
      .filter(a => a.totalCLP > 0)
      .sort((a, b) => b.totalCLP - a.totalCLP)
      .map(a => ({ ...a, avgCLPPerUnit: a.count > 0 ? Math.round(a.totalCLP / a.count) : 0 }));
  }, [serverData, techRanking, hasLocalFilters]);

  // ── Datos semanales — global (todos los técnicos filtrados) ──
  const weeklyData = useMemo(() => {
    const weekMap = {};
    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    techs.forEach(t => {
      if (!t.dailyMap) return;
      Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
        const { week, year } = getISOWeek(dateKey);
        const wk = `${year}-S${String(week).padStart(2, '0')}`;
        if (!weekMap[wk]) weekMap[wk] = { week, year, key: wk, orders: 0, clp: 0, days: new Set(), techs: new Set(), dayPts: {} };
        weekMap[wk].orders += dd.orders;
        weekMap[wk].clp += dd.clp;
        weekMap[wk].days.add(dateKey);
        weekMap[wk].techs.add(t.name);
        // Puntos por día de la semana (0=Lun..6=Dom)
        const dt = new Date(dateKey);
        const dow = (dt.getUTCDay() + 6) % 7; // Lun=0, Mar=1, ..., Dom=6
        weekMap[wk].dayPts[dow] = (weekMap[wk].dayPts[dow] || 0) + dd.clp;
      });
    });
    return Object.values(weekMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(w => ({
        ...w,
        pts: w.clp, // En el financiero, alias de PTS es CLP para compatibilidad de componentes
        clp: Math.round(w.clp * 100) / 100,
        daysCount: w.days.size,
        techsCount: w.techs.size,
        avgPerDay: w.days.size > 0 ? Math.round((w.clp / w.days.size) * 100) / 100 : 0,
        range: getWeekRange(w.year, w.week),
        dayPts: w.dayPts,
        days: undefined,
        techs: undefined,
      }));
  }, [techRanking, serverData]);

  // ── Datos semanales POR TÉCNICO — tabla cruzada técnico × semana ──
  const weeklyByTech = useMemo(() => {
    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    // Obtener las mismas semanas del weeklyData
    const weekKeys = weeklyData.map(w => w.key);
    if (weekKeys.length === 0) return [];

    return techs.map(t => {
      const weekPts = {};
      let total = 0;
      if (t.dailyMap) {
        Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
          const { week, year } = getISOWeek(dateKey);
          const wk = `${year}-S${String(week).padStart(2, '0')}`;
          if (!weekPts[wk]) weekPts[wk] = { clp: 0, orders: 0 };
          weekPts[wk].clp += dd.clp;
          weekPts[wk].orders += dd.orders;
          total += dd.clp;
        });
      }
      return {
        name: t.name,
        weekPts,
        total: Math.round(total * 100) / 100,
        orders: t.orders,
        avgPerDay: t.avgPerDay,
      };
    }).sort((a, b) => b.total - a.total);
  }, [techRanking, serverData, weeklyData]);


  // ── Client/Project data ──
  // ── Client/Project data — recalculado si hay filtros ──
  const clientProjects = useMemo(() => {
    if (!hasLocalFilters) return serverData?.clientProjects || [];
    const map = {};
    techRanking.forEach(t => {
      if (!t.clientMap) return;
      Object.entries(t.clientMap).forEach(([key, data]) => {
        if (!map[key]) map[key] = { cliente: data.cliente, proyecto: data.proyecto, clp: 0, orders: 0, activeDays: new Set() };
        map[key].clp += (data.clp || data.pts || 0);
        map[key].orders += data.orders;
        if (t.dailyMap) Object.keys(t.dailyMap).forEach(dk => map[key].activeDays.add(dk));
      });
    });
    return Object.values(map).map(cp => ({
      ...cp,
      pts: cp.clp, // Alias para compatibilidad
      clp: Math.round(cp.clp * 100) / 100,
      avgPerDay: cp.activeDays.size > 0 ? (cp.clp / cp.activeDays.size) : 0,
      activeDays: undefined
    })).sort((a, b) => b.clp - a.clp);
  }, [serverData, techRanking, hasLocalFilters]);

  // ── Auto-seleccionar última semana cuando cargue weeklyData ──
  useEffect(() => {
    if (weeklyData.length > 0 && !selectedWeek) {
      setSelectedWeek(weeklyData[weeklyData.length - 1].key);
    }
  }, [weeklyData, selectedWeek]);

  // ── Detalle semanal: técnicos × días (Lun-Dom) para la semana seleccionada ──
  const weeklyDetailByTech = useMemo(() => {
    if (!selectedWeek) return [];
    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    const result = [];
    techs.forEach(t => {
      if (!t.dailyMap) return;
      const dayPts = {};
      let total = 0;
      let orders = 0;
      let daysWorked = 0;
      Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
        const { week, year } = getISOWeek(dateKey);
        const wk = `${year}-S${String(week).padStart(2, '0')}`;
        if (wk === selectedWeek) {
          const dt = new Date(dateKey);
          const dow = (dt.getUTCDay() + 6) % 7; // Lun=0..Dom=6
          dayPts[dow] = (dayPts[dow] || 0) + dd.clp;
          total += dd.clp;
          orders += dd.orders;
          daysWorked++;
        }
      });
      if (total > 0) {
        result.push({
          name: t.name,
          dayPts,
          total: Math.round(total * 100) / 100,
          orders,
          daysWorked,
          avgPerDay: daysWorked > 0 ? Math.round((total / daysWorked) * 100) / 100 : 0,
        });
      }
    });
    return result.sort((a, b) => b.total - a.total);
  }, [selectedWeek, techRanking, serverData]);

  // ── Desglose por tipo de actividad por técnico para la semana seleccionada ──
  const weeklyActivityByTech = useMemo(() => {
    if (!selectedWeek) return { techs: [], activityTypes: [] };
    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    const actTypeSet = new Set();
    const techData = [];

    techs.forEach(t => {
      if (!t.dailyMap) return;
      const byType = {};
      let total = 0;
      Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
        const { week, year } = getISOWeek(dateKey);
        const wk = `${year}-S${String(week).padStart(2, '0')}`;
        if (wk === selectedWeek && dd.byActivity) {
          Object.entries(dd.byActivity).forEach(([actName, actData]) => {
            if (!byType[actName]) byType[actName] = { count: 0, clp: 0, pts: 0 };
            byType[actName].count += actData.count;
            byType[actName].clp += (actData.clp || actData.pts || 0);
            byType[actName].pts += (actData.clp || actData.pts || 0); // Alias
            actTypeSet.add(actName);
            total += (actData.clp || actData.pts || 0);
          });
        }
      });
      if (total > 0) {
        techData.push({ name: t.name, byType, total: Math.round(total * 100) / 100 });
      }
    });

    // Ordenar tipos por pts total descendente
    const activityTypes = [...actTypeSet].sort((a, b) => {
      const valA = techData.reduce((s, t) => s + (t.byType[a]?.clp || t.byType[a]?.pts || 0), 0);
      const valB = techData.reduce((s, t) => s + (t.byType[b]?.clp || t.byType[b]?.pts || 0), 0);
      return valB - valA;
    });

    return { techs: techData.sort((a, b) => b.total - a.total), activityTypes };
  }, [selectedWeek, techRanking, serverData]);

  // ── Datos semanales por técnico (para detalle expandido) ──
  const getWeeklyForTech = useCallback((tech) => {
    if (!tech?.dailyMap) return [];
    const weekMap = {};
    Object.entries(tech.dailyMap).forEach(([dateKey, dd]) => {
      const { week, year } = getISOWeek(dateKey);
      const wk = `${year}-S${String(week).padStart(2, '0')}`;
      if (!weekMap[wk]) weekMap[wk] = { week, year, key: wk, orders: 0, clp: 0, days: new Set() };
      weekMap[wk].orders += dd.orders;
      weekMap[wk].clp += dd.clp;
      weekMap[wk].days.add(dateKey);
    });
    return Object.values(weekMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(w => ({
        ...w,
        clp: Math.round(w.pts * 100) / 100,
        daysCount: w.days.size,
        avgPerDay: w.days.size > 0 ? Math.round((w.pts / w.days.size) * 100) / 100 : 0,
        range: getWeekRange(w.year, w.week),
        days: undefined,
      }));
  }, []);

  // ── Quick date buttons ──
  const setQuickDate = useCallback((type) => {
    const t = todayUTC();
    switch (type) {
      case 'today':
        setDateFrom(toInputDate(t));
        setDateTo(toInputDate(t));
        break;
      case 'yesterday': {
        const y = addDays(t, -1);
        setDateFrom(toInputDate(y));
        setDateTo(toInputDate(y));
        break;
      }
      case 'last7':
        setDateFrom(toInputDate(addDays(t, -6)));
        setDateTo(toInputDate(t));
        break;
      case 'last30':
        setDateFrom(toInputDate(addDays(t, -29)));
        setDateTo(toInputDate(t));
        break;
      case 'thisMonth':
        setDateFrom(toInputDate(firstDayOfMonth()));
        setDateTo(toInputDate(t));
        break;
      default:
        break;
    }
  }, []);

  // ── Helper para formato regional Excel (comas) ──
  const toExcelVal = (v) => {
    if (typeof v === 'number') return String(v).replace('.', ',');
    return v;
  };

  // ── Export to Excel (ranking de técnicos) ──
  const exportRankingToExcel = useCallback(() => {
    const rows = sortedTechRanking.map((t, i) => ({
      '#': i + 1,
      'Técnico': t.name,
      'Días Activos': t.activeDays,
      'Órdenes': t.orders,
      'Pts Total': toExcelVal(Math.round(t.facturacion * 100) / 100),
      'Prom/Día': toExcelVal(Math.round(t.avgPerDay * 100) / 100),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking');
    XLSX.writeFile(wb, `ranking_financiero_${dateFrom}_${dateTo}.xlsx`);
  }, [sortedTechRanking, dateFrom, dateTo]);

  const exportSectionToPDF = useCallback(async (elementId, title) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(element, { 
          scale: 1.5, 
          useCORS: true, 
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: -window.scrollY
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.82);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.setFontSize(10);
        pdf.text(title, 10, 10);
        pdf.addImage(imgData, 'JPEG', 0, 15, pdfWidth, Math.min(pdfHeight, 250));
        pdf.save(`${elementId}_${dateFrom}.pdf`);
      } catch (err) {
        console.error('PDF Export Error:', err);
        alert('Error al generar el PDF. Reintente en unos segundos.');
      }
    }, 150);
  }, [dateFrom]);

  const exportWeeklyToExcel = useCallback(() => {
    const rows = weeklyData.map(w => ({
      'Semana': w.week,
      'Rango': w.range,
      'Órdenes': w.orders,
      'Técnicos': w.techsCount,
      'Valorización Total': toExcelVal(w.pts),
      'Prom/Téc': toExcelVal(w.pts / (w.techsCount || 1))
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Semanal');
    XLSX.writeFile(wb, `resumen_semanal_${dateFrom}.xlsx`);
  }, [weeklyData, dateFrom]);

  const exportEquipmentToExcel = useCallback(() => {
    const rows = Object.entries(headerStats.equipoCounts || {}).map(([name, count]) => ({
      'Equipo': name,
      'Cantidad': count,
      'Valorización': toExcelVal(headerStats.equipoValores?.[name] || 0)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, `inventario_equipos_${dateFrom}.xlsx`);
  }, [headerStats, dateFrom]);

  const exportWeeklyTrendToExcel = useCallback(() => {
    const rows = weeklyByTech.map(t => {
      const row = { 'Técnico': t.name };
      weeklyData.forEach(w => {
        row[`S${String(w.week).padStart(2, '0')}`] = toExcelVal(t.weekPts?.[w.key]?.clp || 0);
      });
      row['Acumulado'] = toExcelVal(t.total);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Evolución Semanal');
    XLSX.writeFile(wb, `evolucion_semanal_${dateFrom}.xlsx`);
  }, [weeklyByTech, weeklyData, dateFrom]);

  const exportActivityMixToExcel = useCallback(() => {
    const rows = weeklyActivityByTech.techs.map(t => {
      const row = { 'Técnico': t.name };
      weeklyActivityByTech.activityTypes.forEach(at => {
        row[at] = toExcelVal(t.byType[at]?.pts || 0);
      });
      row['Subtotal'] = toExcelVal(t.total);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mix Actividad');
    XLSX.writeFile(wb, `mix_actividad_${dateFrom}.xlsx`);
  }, [weeklyActivityByTech, dateFrom]);

  const exportWeeklyDetailToExcel = useCallback(() => {
    const rows = weeklyDetailByTech.map(t => {
      const row = { 'Técnico': t.name };
      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((day, i) => {
        row[day] = toExcelVal(t.dayPts?.[i] || 0);
      });
      row['Total Semana'] = toExcelVal(t.total);
      row['Prom/Día'] = toExcelVal(t.avgPerDay);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Semanal');
    XLSX.writeFile(wb, `detalle_semanal_${dateFrom}.xlsx`);
  }, [weeklyDetailByTech, dateFrom]);

  const exportZonesToExcel = useCallback(() => {
    const rows = zonePerformance.map(zp => ({
      'Zona': zp.zone || 'SIN ZONA',
      'Órdenes': zp.orders,
      'Total': toExcelVal(zp.total),
      'Prom/Téc': toExcelVal(zp.avgPerTech)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Zonas');
    XLSX.writeFile(wb, `zonas_${dateFrom}.xlsx`);
  }, [zonePerformance, dateFrom]);

  const downloadRawDB = useCallback(async () => {
    try {
      const params = { estado: estadoFilter };
      if (dateFrom) params.desde = dateFrom;
      if (dateTo) params.hasta = dateTo;
      const { data } = await api.get('/bot/produccion-raw', { params });
      if (!data?.rows?.length) { alert('No hay datos para el rango seleccionado'); return; }
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BD Financiero');
      XLSX.writeFile(wb, `BD_produccion_financiera_${dateFrom}_${dateTo}.xlsx`);
    } catch (err) {
      console.error('Error descargando BD:', err);
      alert('Error al descargar la base de datos');
    }
  }, [estadoFilter, dateFrom, dateTo]);

  // ── Calendar helpers ──
  const calendarGrid = useMemo(() => {
    const year = calMonth.year;
    const month = calMonth.month;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startDow = firstDay.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells = [];
    // Blank cells for days before the 1st
    for (let i = 0; i < (startDow === 0 ? 6 : startDow - 1); i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [calMonth]);

  const calMaxPts = useMemo(() => {
    const vals = Object.values(calendarData).map((d) => d.clp);
    return Math.max(...vals, 1);
  }, [calendarData]);

  const calWeeklyTotals = useMemo(() => {
    const weeks = {};
    calendarGrid.forEach((day, idx) => {
      const weekIdx = Math.floor(idx / 7);
      if (!weeks[weekIdx]) weeks[weekIdx] = { clp: 0, orders: 0 };
      if (day && calendarData[day]) {
        weeks[weekIdx].clp += calendarData[day].clp;
        weeks[weekIdx].orders += calendarData[day].orders;
      }
    });
    return weeks;
  }, [calendarGrid, calendarData]);

  const calMonthTotal = useMemo(() => {
    return Object.values(calendarData).reduce(
      (acc, d) => ({ clp: acc.clp + d.clp, orders: acc.orders + d.orders }),
      { clp: 0, orders: 0 }
    );
  }, [calendarData]);

  const navCalMonth = useCallback((dir) => {
    setCalMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { year: y, month: m };
    });
    setCalSelectedDay(null);
  }, []);

  // ── Presentation mode config ──
  const PRESENTATION_SECTIONS = [
    { id: 'ranking', title: 'Ranking de Técnicos', icon: '🏆' },
    { id: 'weekly-global', title: 'Producción por Semana', icon: '📊' },
    { id: 'weekly-tech', title: 'Producción Semanal por Técnico', icon: '👥' },
    { id: 'weekly-detail', title: 'Detalle Semanal — Técnicos por Día', icon: '📅' },
    { id: 'activity-type', title: 'Desglose por Tipo de Actividad', icon: '🔧' },
    { id: 'client-analysis', title: 'Análisis por Cliente y Proyecto', icon: '🏢' },
    { id: 'zones-lpu', title: 'Zonas y Actividades LPU', icon: '🗺️' },
    { id: 'calendar', title: 'Calendario de Producción', icon: '📆' },
  ];

  const openPresentation = useCallback(() => {
    setPresentationMode(true);
    setPresentationStep(0);
    document.body.style.overflow = 'hidden';
  }, []);

  const closePresentation = useCallback(() => {
    setPresentationMode(false);
    setPresentationStep(0);
    document.body.style.overflow = '';
  }, []);

  const nextSlide = useCallback(() => {
    setPresentationStep(prev => Math.min(prev + 1, PRESENTATION_SECTIONS.length - 1));
  }, []);

  const prevSlide = useCallback(() => {
    setPresentationStep(prev => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation for presentation
  useEffect(() => {
    if (!presentationMode) return;
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
      if (e.key === 'Escape') { e.preventDefault(); closePresentation(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presentationMode, nextSlide, prevSlide, closePresentation]);

  // ── Green scale for heatmaps ──
  const greenScale = (value, max) => {
    if (value === 0 || max === 0) return 'bg-indigo-50/30';
    const ratio = value / max;
    if (ratio > 0.8) return 'bg-indigo-600/80';
    if (ratio > 0.6) return 'bg-indigo-600/60';
    if (ratio > 0.4) return 'bg-indigo-500/50';
    if (ratio > 0.2) return 'bg-indigo-500/30';
    return 'bg-indigo-500/15';
  };

  const greenScaleCal = (value, max) => {
    if (value === 0 || max === 0) return '';
    const ratio = value / max;
    if (ratio > 0.8) return 'bg-emerald-500/70';
    if (ratio > 0.6) return 'bg-emerald-500/50';
    if (ratio > 0.4) return 'bg-emerald-500/35';
    if (ratio > 0.2) return 'bg-emerald-500/20';
    return 'bg-emerald-500/10';
  };

  // ── Emoji helper por rendimiento ──
  const perfEmoji = (pct) => {
    if (pct >= 120) return '\u{1F525}'; // fire
    if (pct >= 100) return '\u{1F44D}'; // thumbs up
    if (pct >= 80) return '\u{26A0}\u{FE0F}'; // warning
    if (pct >= 50) return '\u{1F44E}'; // thumbs down
    return '\u{274C}'; // red X
  };

  // ── Semáforo color para celdas ──
  const semaforoColor = (val, meta) => {
    if (!meta || meta <= 0 || val <= 0) return {};
    const pct = val / meta;
    if (pct >= 1) return { background: 'rgba(16,185,129,0.35)', borderLeft: '3px solid #10b981' };
    if (pct >= 0.8) return { background: 'rgba(234,179,8,0.2)', borderLeft: '3px solid #eab308' };
    if (pct >= 0.5) return { background: 'rgba(249,115,22,0.2)', borderLeft: '3px solid #f97316' };
    return { background: 'rgba(239,68,68,0.15)', borderLeft: '3px solid #ef4444' };
  };

  // ── Meta ratio helper ──
  const MetaBadge = useCallback(({ pts, meta, label, showEmoji = true }) => {
    if (!meta || meta <= 0) return null;
    const pct = Math.round((pts / meta) * 100);
    const emoji = perfEmoji(pct);
    const color = pct >= 100 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : pct >= 80 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      : pct >= 50 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30';
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${color}`} title={`${label}: ${fmtPts(pts)} / ${fmtPts(meta)} pts`}>
        {showEmoji && <span className="text-[10px]">{emoji}</span>}{pct}%
      </span>
    );
  }, []);

  // ── Meta Gap: muestra puntos y % faltante ──
  const MetaGap = useCallback(({ pts, meta, compact = false }) => {
    if (!meta || meta <= 0) return null;
    const gap = meta - pts;
    const gapPct = Math.round(((meta - pts) / meta) * 100);
    if (gap <= 0) return <span className="text-[9px] text-emerald-400 font-medium">{compact ? '✓' : '✓ Meta cumplida'}</span>;
    return (
      <span className="text-[9px] text-red-400/80" title={`Faltan ${fmtPts(gap)} pts (${gapPct}%)`}>
        {compact ? `−${fmtPts(gap)}` : `Faltan ${fmtPts(gap)} pts (${gapPct}%)`}
      </span>
    );
  }, []);

  // ─── MONTH NAMES ───
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // ─── LOADING / ERROR ───
  if (loading && !serverData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-6" />
          <p className="text-indigo-200 font-black uppercase tracking-[0.2em] text-xs">Cargando Inteligencia Financiera...</p>
        </div>
      </div>
    );
  }

  if (error && !serverData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white/70 backdrop-blur-xl border border-red-100 p-12 rounded-[3rem] shadow-2xl shadow-red-100/50 text-center max-w-lg">
          <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-red-100">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-indigo-900 mb-4 tracking-tight">Error de Conexión</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">{error}</p>
          <button 
            onClick={() => fetchData(dateFrom, dateTo, estadoFilter)} 
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-900 transition-all shadow-xl shadow-slate-200 active:scale-95"
          >
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  const navTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${presentationMode ? 'bg-slate-950' : 'bg-[#f0f4ff]'} font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-700 relative overflow-x-hidden`}>
      {/* 3D Dynamic Background Elements */}
      {!presentationMode && (
        <>
          <div className="fixed top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-200/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="fixed bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-200/20 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />
        </>
      )}
      {/* ═══════════════════════ HEADER & STICKY FILTERS ═══════════════════════ */}
      <div className={`sticky top-0 z-[50] transition-all duration-500 ${presentationMode ? 'translate-y-[-100%] pointer-events-none opacity-0' : 'translate-y-0 opacity-100 bg-white/80 backdrop-blur-2xl border-b border-indigo-100/50 shadow-sm shadow-indigo-100/20'}`}>
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-slate-900 rounded-[1.25rem] shadow-xl shadow-indigo-100 transition-transform hover:rotate-3">
                  <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-2">
                  Producción Financiera
                  <span className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] border border-indigo-400 shadow-xl shadow-indigo-100">EXECUTIVE</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">{empresaNombre} — Financial Intelligence</p>
                  {lastRefresh && (
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  )}
                  {lastRefresh && (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                      Sync: {lastRefresh.toLocaleTimeString('es-CL')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Internal Nav Links */}
              <div className="hidden xl:flex items-center bg-indigo-50/20/50 p-1.5 rounded-2xl border border-slate-200/50 mr-4">
                {[
                  { id: 'section-ranking', label: 'Ranking', icon: Trophy },
                  { id: 'section-weekly', label: 'Semanal', icon: CalendarDays },
                  { id: 'section-equipment', label: 'Equipos', icon: Box },
                  { id: 'section-activity', label: 'Mix', icon: Activity },
                  { id: 'section-zones', label: 'Zonas', icon: Map },
                  { id: 'section-calendar', label: 'Calendario', icon: Calendar },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                        const el = document.getElementById(item.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-white hover:shadow-sm rounded-xl transition-all duration-300 text-[10px] font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest"
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-slate-200 mx-2" />
                <button
                    onClick={(e) => {
                      const container = e.target.closest('main') || document.querySelector('main');
                      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-white hover:shadow-sm rounded-xl transition-all duration-300 text-[10px] font-black text-slate-500 hover:text-indigo-600 uppercase tracking-widest"
                >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Subir
                </button>
              </div>

              <button
                onClick={() => fetchData(dateFrom, dateTo, estadoFilter)}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-900 transition-all shadow-lg shadow-slate-200 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Sincronizando...' : 'Actualizar'}
              </button>
            </div>
          </div>

          {/* Collapsible/Advanced Filters Area */}
          <div className="mt-6 pt-6 border-t border-indigo-100/50 flex flex-wrap items-end gap-4 text-slate-700">
            {/* Filtro Clientes */}
            <div className="w-full lg:w-72">
              <MultiSearchableSelect
                label="Clientes / Empresas"
                icon={UsersIcon}
                options={availableClientes.map(c => ({ label: c.nombre, value: c._id }))}
                value={selectedClientes}
                onChange={setSelectedClientes}
                placeholder="— TODAS LAS EMPRESAS —"
              />
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[9px] font-black text-indigo-600/60 mb-1.5 uppercase tracking-widest">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
              <div className="text-slate-300 font-black mt-5">→</div>
              <div>
                <label className="block text-[9px] font-black text-indigo-600/60 mb-1.5 uppercase tracking-widest">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-1.5 mb-0.5">
              {[
                { key: 'today', label: 'Hoy' },
                { key: 'last7', label: '7D' },
                { key: 'thisMonth', label: 'Mes' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setQuickDate(btn.key)}
                  className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <div className="min-w-[130px]">
                <label className="block text-[9px] font-black text-indigo-600/60 mb-1.5 uppercase tracking-widest">Tipo</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
                >
                  <option value="todos">Todos los Tipos</option>
                  <option value="provision">Provisión</option>
                  <option value="reparacion">Reparación</option>
                </select>
              </div>

                <div className="min-w-[150px]">
                <label className="block text-[9px] font-black text-indigo-200 mb-1.5 uppercase tracking-widest">Estado</label>
                <select
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer shadow-sm"
                >
                  <option value="todos">Todos los Estados</option>
                  {(serverData?.estados || []).map(e => (
                    <option key={e.estado} value={e.estado}>{e.estado} ({e.count})</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setSoloVinculados(!soloVinculados)}
              className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-0.5 ${
                soloVinculados 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'bg-white border-slate-200 text-indigo-200 hover:border-indigo-500 hover:text-indigo-600 shadow-sm'
              }`}
            >
              <Anchor className={`w-3.5 h-3.5 ${soloVinculados ? 'animate-pulse' : ''}`} />
              Vinculados
            </button>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-[9px] font-black text-indigo-200 mb-1.5 uppercase tracking-widest">Técnico</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-200" />
                <input
                  type="text"
                  value={searchTech}
                  onChange={(e) => setSearchTech(e.target.value)}
                  placeholder="Buscar técnico..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-12 pb-32">
        {/* ═══════════════════════ 1. KPIs SECTION ═══════════════════════ */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Filtros rápidos en Presentation Mode */}
          <div className="flex gap-4 mb-8">
              <div className="w-80">
                  <MultiSearchableSelect
                      icon={UsersIcon}
                      options={availableClientes.map(c => ({ label: c.nombre, value: c._id }))}
                      value={selectedClientes}
                      onChange={setSelectedClientes}
                      placeholder="— TODAS LAS EMPRESAS —"
                      className="!bg-white/10 !border-white/20 !text-white"
                      theme="dark"
                  />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
            <StatCard
              icon={FileSpreadsheet}
              label="Órdenes Totales"
              value={headerStats.totalOrders.toLocaleString('es-CL')}
              sub="Volumen de Actividad"
              color="indigo"
            />
            <StatCard
              icon={TrendingUp}
              label="Producción Total"
              value={fmtCLP(headerStats.totalCLP)}
              sub="Valorización Bruta"
              color="emerald"
              target={headerStats.metaRequired}
              achieved={headerStats.totalCLP}
            />
            <StatCard
              icon={Calculator}
              label="Promedio Diario"
              value={fmtCLP(headerStats.avgPtsPerTechPerDay)}
              sub="Rentabilidad por Técnico"
              color="purple"
            />
            <StatCard
              icon={Users}
              label="Fuerza Técnica"
              value={headerStats.uniqueTechs.toString()}
              sub={`${headerStats.uniqueDays} Días Activos`}
              color="amber"
            />
          </div>
        </section>


        {/* ═══════════════════════ 3. RANKING TÉCNICOS ═══════════════════════ */}
        {/* ═══════════════════════ 2. RANKING SECTION ═══════════════════════ */}
        <section id="section-ranking" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
                <Award className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-indigo-900 tracking-tight text-indigo-900">Ranking de Rentabilidad</h2>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Technician Revenue Performance Leaders</p>
              </div>
            </div>
            
            <button
              onClick={openPresentation}
              className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
            >
              <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Modo Presentación
            </button>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-[2.5rem] shadow-2xl shadow-indigo-100/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-indigo-50/20 border-b border-indigo-100/50">
                    {[
                      { key: null, label: '#', className: 'w-20 text-center' },
                      { key: 'name', label: 'Técnico', className: 'text-left min-w-[200px]' },
                      { key: 'cliente', label: 'Cliente / Proyecto', className: 'text-left' },
                      { key: 'activeDays', label: 'Días' },
                      { key: 'orders', label: 'Órdenes' },
                      { key: 'facturacion', label: 'Facturación CLP' },
                      { key: 'avgPerDay', label: 'Prom/Día' },
                      ...(metaConfig.metaProduccionDia > 0 ? [{ key: null, label: 'Meta', className: 'text-center' }] : []),
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-6 py-3 text-[9px] font-black text-indigo-400 uppercase tracking-widest sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-indigo-100/50 shadow-sm ${col.className || 'text-right'} ${col.key ? 'cursor-pointer hover:text-indigo-600 select-none transition-colors' : ''}`}
                        onClick={col.key ? () => techToggle(col.key) : undefined}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {col.label}
                          {col.key && techSortIcon(col.key)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {sortedTechRanking.map((tech, idx) => {
                    const rank = idx + 1;
                    const isExpanded = expandedTech === tech.name;
                    const techMetaPct = metaConfig.metaProduccionDia > 0 ? (tech.avgPerDay / (metaConfig.metaProduccionDia * 100)) : 0;
                    const techPerf = metaConfig.metaProduccionDia > 0 ? perfEmoji(Math.round(techMetaPct * 100)) : '';

                    return (
                      <React.Fragment key={tech.name}>
                        <tr
                          className={`group cursor-pointer transition-all duration-300 ${isExpanded ? 'bg-indigo-50/30' : 'hover:bg-indigo-50/20'}`}
                          onClick={() => setExpandedTech(isExpanded ? null : tech.name)}
                        >
                          <td className="px-6 py-3 text-center">
                            {rank <= 3 ? (
                              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-black text-xs ${
                                rank === 1 ? 'bg-amber-100 text-amber-700' : 
                                rank === 1 ? 'bg-amber-100 text-amber-700' :
                                rank === 2 ? 'bg-indigo-50/20 text-slate-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {rank}
                              </div>
                            ) : (
                              <span className="text-[10px] font-black text-slate-300">{rank}</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-indigo-900 uppercase text-[10px] tracking-tight">{tech.name}</span>
                              {techPerf && <span className="text-xs">{techPerf}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            {tech.cliente ? (
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{tech.cliente}</span>
                                {tech.proyecto && <span className="text-[8px] font-bold text-indigo-200 uppercase tracking-tighter truncate max-w-[120px]">{tech.proyecto}</span>}
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-3 text-right font-black text-slate-600 text-[10px] uppercase tracking-tighter tabular-nums">{tech.activeDays}d</td>
                          <td className="px-6 py-3 text-right font-black text-slate-600 text-[10px] uppercase tracking-tighter tabular-nums">{tech.orders}</td>
                          <td className="px-6 py-3 text-right font-black text-emerald-600 text-[10px] uppercase tracking-tighter tabular-nums">{fmtCLP(tech.facturacion)}</td>
                          <td className="px-6 py-3 text-right font-black text-indigo-600 text-[10px] uppercase tracking-tighter tabular-nums">{fmtCLP(tech.avgPerDay)}</td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-6 py-3">
                              <div className="flex flex-col items-end gap-1.5">
                                <div className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                                  techMetaPct >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-50' :
                                  techMetaPct >= 80 ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm shadow-amber-50' :
                                  'bg-red-50 text-red-600 border-red-100 shadow-sm shadow-red-50'
                                }`}>
                                  {Math.round(techMetaPct)}% LOGRADO
                                </div>
                                <div className="text-[9px] font-bold text-indigo-200 tracking-tighter uppercase">
                                  {tech.avgPerDay >= (metaConfig.metaProduccionDia * (serverData.kpis.valorPuntoProm || 1000)) 
                                    ? <span className="text-emerald-500 font-black">✓ META OK</span>
                                    : <span className="text-red-400">GAP: {fmtCLP(tech.avgPerDay - (metaConfig.metaProduccionDia * (serverData.kpis.valorPuntoProm || 1000)))}</span>
                                  }
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={metaConfig.metaProduccionDia > 0 ? 9 : 8} className="p-0 bg-indigo-50/20 transition-all animate-in slide-in-from-top-2 duration-300">
                              <div className="p-12 border-y border-indigo-100/50 bg-white/40 shadow-inner">
                                {/* Rentability Analysis - Premium Card */}
                                <div className="max-w-5xl mx-auto space-y-12">
                                  <div className="flex items-center gap-4 mb-8">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                      <Briefcase className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <h3 className="text-lg font-black text-indigo-900 uppercase tracking-tight">Análisis Ejecutivo: {tech.name}</h3>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-white/90 p-8 rounded-[2.5rem] border border-emerald-100 shadow-xl shadow-emerald-100/50 relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1">
                                      <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400" />
                                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Ingreso Generado</p>
                                      <h4 className="text-3xl font-black text-indigo-900 tracking-tighter">{fmtCLP(tech.facturacion)}</h4>
                                      <p className="text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-tight">Venta Neta Baremo</p>
                                    </div>
                                    <div className="bg-white/90 p-8 rounded-[2.5rem] border border-rose-100 shadow-xl shadow-rose-100/50 relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1">
                                      <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-400" />
                                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Costo Directo</p>
                                      <h4 className="text-3xl font-black text-indigo-900 tracking-tighter">{fmtCLP(tech.sueldoBase + tech.montoBonoFijo)}</h4>
                                      <p className="text-[9px] font-bold text-slate-300 mt-2 uppercase tracking-tight">Sueldo + Bonos</p>
                                    </div>
                                    <div className="bg-indigo-600 p-8 rounded-[2.5rem] border border-indigo-700 shadow-2xl shadow-indigo-200 relative overflow-hidden group transition-all hover:scale-[1.02] active:scale-95">
                                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 opacity-20 blur-3xl" />
                                      <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-2">Margen Operativo</p>
                                      <h4 className="text-3xl font-black text-white tracking-tighter">{fmtCLP(tech.facturacion - (tech.sueldoBase + tech.montoBonoFijo))}</h4>
                                      <div className="mt-4 flex items-center gap-3">
                                        <div className="h-2 bg-white/20 flex-1 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,1)]" style={{ width: `${Math.min(100, Math.max(0, ((tech.facturacion - (tech.sueldoBase + tech.montoBonoFijo)) / Math.max(1, tech.facturacion)) * 100))}%` }} />
                                        </div>
                                        <span className="text-sm font-black text-white">
                                          {Math.round(((tech.facturacion - (tech.sueldoBase + tech.montoBonoFijo)) / Math.max(1, tech.facturacion)) * 100)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest flex items-center gap-2">
                                        <Layers className="w-3.5 h-3.5" /> Composición del Ingreso
                                      </p>
                                      <CompositionBar
                                        base={tech.ptsBase || 0}
                                        deco={tech.ptsDeco || 0}
                                        repetidor={tech.ptsRepetidor || 0}
                                        telefono={tech.ptsTelefono || 0}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <MiniStat label="Provisión" value={tech.provisionCount} icon={CheckCircle2} />
                                      <MiniStat label="Reparación" value={tech.repairCount} icon={Activity} />
                                      <MiniStat label="Tickets" value={tech.orders} icon={Hash} />
                                      <MiniStat label="Días Activos" value={tech.activeDays} icon={Calendar} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Summary totals row */}
                  {sortedTechRanking.length > 0 && (
                    <tr className="bg-indigo-50/20 border-t border-indigo-100/50 font-semibold">
                      <td className="px-6 py-4 text-center text-indigo-600">
                        <Target className="w-4 h-4 inline" />
                      </td>
                      <td className="px-6 py-4 text-left text-indigo-900 font-black uppercase text-[11px] tracking-tight">TOTALES</td>
                      <td className="px-6 py-4 text-indigo-100"></td>
                      <td className="px-6 py-4 text-right text-indigo-400 font-black text-[11px] uppercase tracking-tighter">
                        {/* avg active days */}
                        {sortedTechRanking.length > 0
                          ? (sortedTechRanking.reduce((s, t) => s + t.activeDays, 0) / sortedTechRanking.length).toFixed(1)
                          : 0}d
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 text-[11px] uppercase tracking-tighter">
                        {sortedTechRanking.reduce((s, t) => s + t.orders, 0).toLocaleString('es-CL')}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-600 text-[11px] uppercase tracking-tighter">
                        {fmtCLP(sortedTechRanking.reduce((s, t) => s + t.facturacion, 0))}
                      </td>
                      <td className="px-6 py-4 text-right text-indigo-600 text-[11px] uppercase tracking-tighter">
                        {fmtCLP(
                          sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)
                        )}
                      </td>
                      {metaConfig.metaProduccionDia > 0 && (
                        <td className="px-6 py-4 text-center">
                          <MetaBadge
                            pts={sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)}
                            meta={metaConfig.metaProduccionDia * 100}
                            label="Promedio vs Meta"
                          />
                          <MetaGap pts={sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)} meta={metaConfig.metaProduccionDia * 100} compact />
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sortedTechRanking.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No se encontraron técnicos con los filtros actuales
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════ 3. RESUMEN SEMANAL GLOBAL ═══════════════════════ */}
        {weeklyData.length > 0 && (
          <section id="section-weekly" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6 mt-10">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <CalendarDays className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Rendimiento Semanal Consolidado</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Weekly Aggregate Performance</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={exportWeeklyToExcel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all" title="Exportar Semanal Excel">
                  <FileSpreadsheet size={16} />
                </button>
                <button onClick={() => exportSectionToPDF('section-weekly', 'Rendimiento Semanal')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-all" title="Exportar Semanal PDF">
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Semana / Periodo</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Órdenes</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Técnicos</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Valorización Total</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Prom/Téc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {weeklyData.map((w) => (
                    <tr key={w.key} className="group hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                           <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight">SEMANA {String(w.week).padStart(2, '0')}</span>
                           <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest leading-none mt-0.5">{w.range}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-slate-600 text-[11px]">{w.orders.toLocaleString('es-CL')}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-600 text-[11px]">{w.techsCount}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-indigo-600 text-[11px] tracking-tighter uppercase">{fmtCLP(w.pts)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-emerald-600 text-[11px] tracking-tighter uppercase">{fmtCLP(w.pts / (w.techsCount || 1))}</span>
                          {metaConfig.metaProduccionSemana > 0 && <MetaBadge pts={w.pts / (w.techsCount || 1)} meta={metaConfig.metaProduccionSemana} label="Meta semanal" showEmoji={false} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3. EVOLUCIÓN SEMANAL POR TÉCNICO ═══════════════════════ */}
        {weeklyByTech.length > 0 && (
          <section id="section-weekly-trend" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6 mt-10">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Evolución Semanal por Técnico</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Technician Weekly Revenue Trend</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={exportWeeklyTrendToExcel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all" title="Exportar Evolución Excel">
                  <FileSpreadsheet size={16} />
                </button>
                <button onClick={() => exportSectionToPDF('section-weekly-trend', 'Evolución Semanal')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-all" title="Exportar Evolución PDF">
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Técnico</th>
                    {weeklyData.map(w => (
                      <th key={w.key} className="px-3 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">S{String(w.week).padStart(2, '0')}</th>
                    ))}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {weeklyByTech.map((t) => (
                    <tr key={t.name} className="group hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight truncate max-w-[150px] inline-block">{t.name}</span>
                      </td>
                      {weeklyData.map(w => {
                        const val = t.weekPts?.[w.key]?.clp || 0;
                        return (
                          <td key={w.key} className="px-3 py-4 text-right">
                             <div className={`inline-flex items-center justify-center min-w-[60px] h-8 rounded-xl text-[10px] font-black transition-all ${val > 0 ? 'bg-white shadow-sm border border-indigo-100/50 text-slate-700 font-black' : 'text-slate-200'}`}>
                               {val > 0 ? fmtCLP(val).replace('$', '') : '—'}
                             </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-indigo-600 text-[11px] tracking-tighter uppercase">{fmtCLP(t.total)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}


        {/* ═══════════════════════ 4. DETALLE SEMANAL: TÉCNICOS × DÍA ═══════════════════════ */}
        {weeklyData.length > 0 && (
          <section id="section-weekly-detail" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Grid3X3 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Productividad Diaria por Técnico</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Technician Daily Performance Grid</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 mr-2">
                  <button onClick={exportWeeklyDetailToExcel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all" title="Exportar Detalle Excel">
                    <FileSpreadsheet size={16} />
                  </button>
                  <button onClick={() => exportSectionToPDF('section-weekly-detail', 'Productividad Diaria')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-all" title="Exportar Detalle PDF">
                    <FileText size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4 bg-indigo-50/20/50 p-2 rounded-2xl border border-slate-200/50">
                <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest ml-4">Periodo Seleccionado:</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer appearance-none shadow-sm min-w-[200px]"
                >
                  {weeklyData.map(w => (
                    <option key={w.key} value={w.key}>SEMANA {String(w.week).padStart(2, '0')} ({w.range})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {weeklyDetailByTech.length > 0 ? (
              <div className="overflow-x-auto rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/50 border-b border-indigo-100/50">
                      <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Técnico</th>
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                        <th key={day} className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">{day}</th>
                      ))}
                      <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Total Semana</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Prom/Día</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50/20">
                    {weeklyDetailByTech.map((t) => {
                      const maxDayVal = Math.max(...weeklyDetailByTech.flatMap(tt => Object.values(tt.dayPts || {})), 1);
                      return (
                        <tr key={t.name} className="group hover:bg-indigo-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight">{t.name}</span>
                          </td>
                          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                            const val = t.dayPts?.[dow] || 0;
                            return (
                              <td key={dow} className="px-2 py-4 text-center">
                                <div className={`inline-flex items-center justify-center min-w-[50px] h-9 rounded-xl text-[10px] font-black transition-all ${val > 0 ? greenScale(val, (maxDayVal/2)) : 'text-slate-200'}`}>
                                  {val > 0 ? fmtCLP(val).replace('$', '') : '—'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-right font-black text-emerald-600 text-[11px] uppercase tracking-tighter">{fmtCLP(t.total)}</td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex flex-col items-end">
                              <span className="font-black text-indigo-600 text-[11px] uppercase tracking-tighter">{fmtCLP(t.avgPerDay)}</span>
                              <MetaBadge pts={t.avgPerDay} meta={metaConfig.metaProduccionDia * 100} label="Meta diaria" showEmoji={false} />
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-20 text-center bg-indigo-50/20 border-2 border-dashed border-slate-200 rounded-[2rem]">
                <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-indigo-200 font-black uppercase tracking-widest text-xs">Sin actividad detectada para este periodo</p>
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════ 5. MIX DE ACTIVIDAD (FINANCIERA) ═══════════════════════ */}
        {weeklyActivityByTech.activityTypes.length > 0 && (
          <section id="section-activity" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Activity className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight text-indigo-900">Desglose de Facturación por Actividad</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Revenue Stream by Activity Type</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={exportActivityMixToExcel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all" title="Exportar Mix Actividad Excel">
                  <FileSpreadsheet size={16} />
                </button>
                <button onClick={() => exportSectionToPDF('section-activity', 'Mix de Actividad')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-all" title="Exportar Mix Actividad PDF">
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Técnico</th>
                    {weeklyActivityByTech.activityTypes.map(at => (
                      <th key={at} className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest" title={at}>
                        {at.length > 15 ? at.substring(0, 13) + '…' : at}
                      </th>
                    ))}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {weeklyActivityByTech.techs.map((t) => (
                    <tr key={t.name} className="group hover:bg-indigo-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight">{t.name}</span>
                      </td>
                      {weeklyActivityByTech.activityTypes.map(at => {
                        const val = t.byType[at]?.pts || 0;
                        return (
                          <td key={at} className="px-2 py-4 text-center">
                            <div className={`inline-flex items-center justify-center min-w-[50px] h-8 rounded-xl text-[10px] font-black transition-all ${val > 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100/50' : 'text-slate-200'}`}>
                              {val > 0 ? fmtCLP(val).replace('$', '') : '—'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right font-black text-emerald-600 text-[11px] uppercase tracking-tighter">{fmtCLP(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 7. DISTRIBUCIÓN GEOGRÁFICA ═══════════════════════ */}
        {zonePerformance.length > 0 && (
          <section id="section-zones" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Map className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Rendimiento por Zonas</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Geographic Revenue Distribution</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={exportZonesToExcel} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-emerald-600 transition-all" title="Exportar Zonas Excel">
                  <FileSpreadsheet size={16} />
                </button>
                <button onClick={() => exportSectionToPDF('section-zones', 'Rendimiento por Zonas')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-100 transition-all" title="Exportar Zonas PDF">
                  <FileText size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {zonePerformance.map((zp) => (
                <div key={zp.zone} className="bg-indigo-50/20 border border-indigo-100/50 rounded-[2rem] p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="font-black text-indigo-900 uppercase text-[12px] tracking-tight">{zp.zone || 'SIN ZONA'}</h5>
                    <div className="px-3 py-1 bg-emerald-100/50 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                      {fmtCLP(zp.total)}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className="text-indigo-200 uppercase tracking-widest">Órdenes</span>
                      <span className="text-indigo-900">{zp.orders}</span>
                    </div>
                    <div className="h-1.5 bg-indigo-50/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                        style={{ width: `${Math.min(100, (zp.total / Math.max(...zonePerformance.map(z => z.total), 1)) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black text-indigo-200">
                      <span className="uppercase tracking-widest">Prom/Téc</span>
                      <span className="text-indigo-600">{fmtCLP(zp.avgPerTech)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ 6. PRODUCCIÓN POR CLIENTE Y PROYECTO ═══════════════════════ */}
        {clientProjects.length > 0 && (
          <section id="section-client-project" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Análisis por Cliente & Proyecto</h2>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Revenue Performance by Account</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {clientProjects.map((cp) => (
                <div key={`${cp.cliente}-${cp.proyecto}`} className="group bg-indigo-50/20 hover:bg-white border border-indigo-100/50 hover:border-indigo-100 rounded-[2rem] p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                      <div>
                        <h4 className="font-black text-indigo-900 uppercase text-[13px] tracking-tight">{cp.cliente}</h4>
                        {cp.proyecto && <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">{cp.proyecto}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-indigo-600 text-lg leading-tight">{fmtCLP(cp.pts)}</p>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">{cp.orders} órdenes</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white border border-indigo-100/50 rounded-2xl p-4 text-center">
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">PROMEDIO</p>
                      <p className="font-black text-slate-700 text-sm">{fmtCLP(cp.avgPerDay)}</p>
                    </div>
                    <div className="bg-white border border-indigo-100/50 rounded-2xl p-4 text-center">
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">ALTAS</p>
                      <p className="font-black text-emerald-600 text-sm">{cp.provisionCount}</p>
                    </div>
                    <div className="bg-white border border-indigo-100/50 rounded-2xl p-4 text-center">
                      <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">REPARACIÓN</p>
                      <p className="font-black text-orange-600 text-sm">{cp.repairCount}</p>
                    </div>
                  </div>

                  {/* Micro-chart trend */}
                  {Object.keys(cp.weeklyMap).length > 1 && (
                    <div className="pt-4 border-t border-indigo-100/50">
                      <div className="flex items-end gap-1 h-12 mb-2">
                        {Object.entries(cp.weeklyMap).sort(([a],[b]) => a.localeCompare(b)).map(([wk, wd]) => {
                          const maxWk = Math.max(...Object.values(cp.weeklyMap).map(w => w.pts || 1), 1);
                          const hPct = Math.max(10, (wd.pts / maxWk) * 100);
                          return (
                            <div key={wk} className="flex-1 bg-indigo-50/20 rounded-full relative group/bar overflow-hidden" style={{ height: '100%' }}>
                              <div className="absolute bottom-0 w-full bg-indigo-500/30 group-hover/bar:bg-indigo-500 transition-all rounded-full" style={{ height: `${hPct}%` }} />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">Tendencia Semanal de Facturación</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ 8. DETALLE DE PRODUCCIÓN POR EQUIPOS (NEW) ═══════════════════════ */}
        <section id="section-equipment" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Box className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Inventario & Valorización de Equipos</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Equipment Deployment & Revenue</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             <div className="overflow-hidden rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Equipo / Componente</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Cantidad</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Valorización</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {Object.entries(headerStats.equipoCounts || {}).map(([name, count]) => {
                    const val = headerStats.equipoValores?.[name] || 0;
                    return (
                      <tr key={name} className="group hover:bg-indigo-50/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight">{name}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-600 text-[11px]">{count.toLocaleString('es-CL')}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-600 text-[11px] uppercase tracking-tighter">{fmtCLP(val)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-indigo-50/20/50 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center border border-slate-200/50">
               <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl border border-indigo-100/50 relative mb-6">
                  <div className="absolute inset-2 border-4 border-dashed border-indigo-100 rounded-full animate-[spin_20s_linear_infinite]" />
                  <Package className="w-12 h-12 text-indigo-500" />
               </div>
               <h3 className="text-xl font-black text-indigo-900 uppercase tracking-tight mb-2">Total Equipos Instalados</h3>
               <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-6">Aggregate Equipment Volume</p>
               <div className="text-5xl font-black text-indigo-600 tracking-tighter">
                  {Object.values(headerStats.equipoCounts || {}).reduce((s, c) => s + c, 0).toLocaleString('es-CL')}
               </div>
               <div className="mt-8 flex gap-4">
                  <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm text-[10px] font-black text-slate-600">
                    DECOS: {headerStats.equipoCounts?.['Decodificadores'] || 0}
                  </div>
                  <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm text-[10px] font-black text-slate-600">
                    WIFI: {headerStats.equipoCounts?.['Repetidores/Wifi'] || 0}
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 9. MAPAS DE CALOR POR MACRO-ZONA ═══════════════════════ */}
        <section className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Thermometer className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Geolocalización de Ingresos</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Regional Heatmap & Performance</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
              <div key={zoneName} className="bg-indigo-50/20 border border-indigo-100/50 rounded-[2rem] p-8">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-indigo-100/50">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-indigo-500" />
                    <h5 className="font-black text-indigo-900 uppercase text-[15px] tracking-tight">{zoneName}</h5>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-600 text-lg leading-tight">{fmtCLP(zoneData.totalCLP)}</p>
                    <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">{zoneData.totalOrders} órdenes</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {zoneData.cities.map((city) => (
                    <div
                      key={city.name}
                      className={`p-4 rounded-2xl border transition-all ${city.clp > 0 ? 'bg-white border-indigo-100/50 shadow-sm' : 'bg-indigo-50/20/30 border-transparent text-slate-300'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter truncate w-24" title={city.name}>{city.name}</span>
                        <div className={`w-2 h-2 rounded-full ${city.clp > 0 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      </div>
                      <div className="font-black text-indigo-900 text-xs">{fmtCLP(city.clp)}</div>
                      <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">{city.orders} órd</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ 10. PRODUCCIÓN POR ACTIVIDAD LPU ═══════════════════════ */}
        <section className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Actividades LPU Detalladas</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">LPU Catalog Performance</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-indigo-100/50 shadow-inner bg-indigo-50/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/50 border-b border-indigo-100/50">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Actividad</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Código</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Cant.</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Valorización</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50/20">
                {lpuData.map((act) => (
                  <tr key={act.desc} className="group hover:bg-indigo-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-black text-indigo-900 uppercase text-[11px] tracking-tight truncate max-w-xs inline-block" title={act.desc}>{act.desc}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-indigo-200 font-mono">{act.code}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-slate-600 text-[11px]">{act.count.toLocaleString('es-CL')}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-emerald-600 text-[11px] tracking-tighter uppercase">{fmtCLP(act.totalCLP)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════ 11. CALENDARIO DE PRODUCCIÓN ═══════════════════════ */}
        <section id="section-calendar" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-indigo-100/20 p-6 mb-20">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <Calendar className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-indigo-900 tracking-tight">Calendario de Facturación</h2>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Daily Revenue Overview</p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-indigo-50/20/50 rounded-2xl border border-slate-200/50">
              <button onClick={() => navCalMonth(-1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronLeft className="w-5 h-5 text-indigo-200" /></button>
              <div className="px-6 py-2 bg-white rounded-xl shadow-sm">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">{monthNames[calMonth.month]} {calMonth.year}</span>
              </div>
              <button onClick={() => navCalMonth(1)} className="p-2 hover:bg-white rounded-xl transition-all"><ChevronRight className="w-5 h-5 text-indigo-200" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 lg:grid-cols-8 gap-4">
             {/* Day Headers */}
             {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Semana'].map((d, i) => (
               <div key={d} className={`text-center py-2 text-[10px] font-black uppercase tracking-widest ${i === 7 ? 'text-indigo-600' : 'text-indigo-200'}`}>
                 {d}
               </div>
             ))}

             {/* Dynamic Grid */}
             {(() => {
                const weeks = [];
                for (let i = 0; i < calendarGrid.length; i += 7) weeks.push(calendarGrid.slice(i, i + 7));
                return weeks.map((week, weekIdx) => (
                   <React.Fragment key={weekIdx}>
                     {week.map((day, idx) => {
                       if (day === null) return <div key={`empty-${idx}`} className="aspect-square opacity-0" />;
                       const dayData = calendarData[day];
                       const hasData = dayData && dayData.clp > 0;
                       return (
                         <div
                           key={day}
                           className={`aspect-square rounded-3xl border transition-all p-3 flex flex-col justify-between group cursor-default
                             ${hasData ? 'bg-white border-indigo-100/50 shadow-sm hover:shadow-md' : 'bg-indigo-50/20 border-transparent'}
                           `}
                         >
                           <span className={`text-[11px] font-black ${hasData ? 'text-indigo-900' : 'text-slate-300'}`}>{day}</span>
                           {hasData && (
                             <div className="text-right">
                               <p className="text-[10px] font-black text-emerald-600 tracking-tighter">{fmtCLP(dayData.clp)}</p>
                               <p className="text-[8px] font-bold text-indigo-200 uppercase">{dayData.orders} ÓRD</p>
                             </div>
                           )}
                         </div>
                       );
                     })}
                     {/* Weekly Summary Cell */}
                     <div className="aspect-square rounded-3xl bg-indigo-50 border border-indigo-100 p-3 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">W{weekIdx + 1}</span>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-indigo-600 tracking-tighter">{fmtCLP(calWeeklyTotals[weekIdx]?.clp || 0)}</p>
                           <p className="text-[8px] font-bold text-indigo-400 uppercase">{calWeeklyTotals[weekIdx]?.orders || 0} TOT</p>
                        </div>
                     </div>
                   </React.Fragment>
                ));
             })()}
          </div>
        </section>

        {/* ═══════════════════════ 7. EXPORTAR ═══════════════════════ */}
        <section>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={exportRankingToExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700/30 border border-emerald-600/30 rounded-lg text-sm text-emerald-300 hover:bg-emerald-600/40 transition"
            >
              <Download className="w-4 h-4" />
              Exportar Ranking a Excel
            </button>
            <button
              onClick={downloadRawDB}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 border border-indigo-700 rounded-lg text-sm text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-300/20"
            >
              <Download className="w-4 h-4" />
              Descargar BD
            </button>
          </div>
        </section>

      </div>

      {/* ═══════════════════════ PRESENTATION MODE OVERLAY (Vibrant Executive) ═══════════════════════ */}
      {presentationMode && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 to-slate-900 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-4 bg-slate-900/80 backdrop-blur-3xl border-b border-white/5 mx-6 mt-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                <Presentation className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="space-y-0.5">
                <h1 className="text-xl font-black text-white uppercase tracking-tight">
                  {PRESENTATION_SECTIONS[presentationStep]?.title}
                </h1>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  {PRESENTATION_SECTIONS[presentationStep]?.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {presentationStep + 1} / {PRESENTATION_SECTIONS.length}
              </span>
              <button
                onClick={closePresentation}
                className="p-2 bg-white/5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors shadow-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content — full width, vertically centered for small content */}
          <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-start">
            <div className="w-full max-w-[1500px] mx-auto">
              {/* Slide: Ranking (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'ranking' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Hash} label="Órdenes" value={headerStats.totalOrders.toLocaleString('es-CL')} color="blue" sub="Volumen Total" dark={true} />
                    <StatCard icon={Zap} label="Pts Totales" value={fmtPts(headerStats.totalCLP)} color="emerald" sub="Productividad" dark={true} />
                    <StatCard icon={TrendingUp} label="Prom/Día/Téc" value={fmtPts(headerStats.avgPtsPerTechPerDay)} color="purple" sub="Eficiencia" dark={true} />
                    <StatCard icon={Users} label="Fuerza Técnica" value={headerStats.uniqueTechs} color="amber" sub="Personal Activo" dark={true} />
                  </div>
                  
                  <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-6 py-4 text-center text-[9px] font-black text-slate-400 uppercase w-20 tracking-[0.3em]">#</th>
                            <th className="px-6 py-4 text-left text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em]">Líder Técnico</th>
                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Cliente / Canal</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Métrica</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em]">Producción Bruta</th>
                            {metaConfig.metaProduccionDia > 0 && <th className="px-6 py-4 text-right text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em]">Performance</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {sortedTechRanking.map((tech, i) => {
                            const techMetaPct = metaConfig.metaProduccionDia > 0 ? Math.round((tech.avgPerDay / metaConfig.metaProduccionDia) * 100) : 0;
                            return (
                              <tr key={tech.name} className="group hover:bg-white/[0.03] transition-all duration-300">
                                <td className="px-6 py-3 text-center">
                                   <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center font-black text-[10px] ${i < 3 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-600'}`}>
                                      {i + 1}
                                   </div>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center font-black text-xs text-indigo-300 border border-white/5 group-hover:border-indigo-500/30 transition-colors shadow-xl">
                                      {tech.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="font-black text-white uppercase text-xs tracking-tight group-hover:text-indigo-300 transition-colors">{tech.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex flex-col">
                                     <span className="text-[9px] font-black text-indigo-300/60 uppercase tracking-wider">{tech.cliente || '—'}</span>
                                     <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">{tech.proyecto}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right font-black text-slate-400 text-[10px] tabular-nums">{tech.activeDays} DÍAS | {tech.orders} ÓRD</td>
                                <td className="px-6 py-3 text-right">
                                   <div className="text-emerald-400 font-black text-sm tracking-tighter uppercase">{fmtCLP(tech.facturacion)}</div>
                                </td>
                                {metaConfig.metaProduccionDia > 0 && (
                                  <td className="px-10 py-6 text-right">
                                     <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-[10px] font-black border border-indigo-500/20 uppercase italic">
                                          CUMPLIMIENTO: {techMetaPct}%
                                        </div>
                                        <MetaGap pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                                     </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: semanal (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-global' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                  <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Intervalo Temporal</th>
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                            <th key={d} className="px-4 py-4 text-right text-[10px] font-black text-slate-200 uppercase tracking-[0.3em]">{d}</th>
                          ))}
                          <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Total Bruto</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Avg/Téc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {weeklyData.map((w) => {
                          const avgPerTech = w.techsCount > 0 ? (w.pts / w.techsCount) : 0;
                          return (
                            <tr key={w.key} className="hover:bg-white/[0.03] transition-all duration-300 group">
                              <td className="px-10 py-7">
                                <span className="font-black text-white text-[13px] uppercase tracking-[0.1em] group-hover:text-indigo-300 transition-colors">SEMANA {w.week}</span>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-1">{w.range}</p>
                              </td>
                              {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                                const val = w.dayPts?.[dow] || 0;
                                const maxDay = Math.max(...Object.values(w.dayPts || {}), 1);
                                return (
                                  <td key={dow} className="px-6 py-7 text-right">
                                    <div className="relative inline-block">
                                       <span className={`relative z-10 font-black text-xs tabular-nums group-hover:scale-110 transition-transform inline-block ${val > 0 ? 'text-indigo-200' : 'text-slate-800'}`}>
                                          {val > 0 ? fmtPts(val) : '—'}
                                       </span>
                                       {val > 0 && (
                                         <div 
                                           className="absolute bottom-[-4px] left-0 h-1 bg-indigo-500/30 rounded-full" 
                                           style={{ width: `${(val/maxDay)*100}%` }}
                                         />
                                       )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-10 py-7 text-right font-black text-emerald-400 text-base tabular-nums tracking-tighter uppercase">{fmtCLP(w.pts)}</td>
                              <td className="px-10 py-7 text-right">
                                 <div className="flex flex-col items-end gap-1.5">
                                    <span className="font-black text-indigo-400 text-[13px] tabular-nums uppercase tracking-tighter">{fmtPts(avgPerTech)}</span>
                                    <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                       <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (avgPerTech / metaConfig.metaProduccionSemana) * 100)}%` }} />
                                    </div>
                                 </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Slide: Detalle Semanal (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-detail' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                  <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-6">
                       <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
                          <Calendar className="w-7 h-7 text-indigo-400" />
                       </div>
                       <div className="space-y-1">
                          <span className="text-sm font-black text-white uppercase tracking-[0.2em] block">Ventana Temporal</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FILTRO AUDIENCIA ESPECÍFICO</span>
                       </div>
                    </div>
                    <div className="relative group">
                      <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="bg-slate-800 border border-white/10 rounded-2xl px-10 py-5 text-xs font-black text-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 appearance-none cursor-pointer hover:bg-slate-700 transition-all shadow-2xl min-w-[320px] uppercase tracking-widest"
                      >
                        {weeklyData.map(w => (
                          <option key={w.key} value={w.key}>S{String(w.week).padStart(2, '0')} — {w.range}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none group-hover:scale-125 transition-transform" />
                    </div>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_45px_100px_-25px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-200 uppercase w-16 tracking-widest">#</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-indigo-300 uppercase tracking-widest">Recurso</th>
                            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, idx) => (
                              <th key={d} className={`px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest ${idx >= 5 ? 'text-orange-400' : 'text-slate-200'}`}>{d}</th>
                            ))}
                            <th className="px-6 py-4 text-right text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-indigo-400 uppercase tracking-widest">Prom/Día</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weeklyDetailByTech.map((t, i) => (
                            <tr key={t.name} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-6 py-3 text-center">
                                 <span className="text-[10px] font-black text-slate-600 group-hover:text-indigo-400 transition-colors">{i + 1}</span>
                              </td>
                              <td className="px-6 py-3 font-black text-white text-[10px] uppercase tracking-tighter group-hover:text-indigo-300 transition-colors">{t.name}</td>
                              {[0,1,2,3,4,5,6].map(dow => {
                                const val = t.dayPts?.[dow] || 0;
                                return (
                                  <td key={dow} className="px-4 py-3 text-right">
                                    <span className={`font-black text-[10px] tabular-nums ${val > 0 ? 'text-indigo-200' : 'text-slate-800'}`}>{val > 0 ? fmtPts(val) : '—'}</span>
                                  </td>
                                );
                              })}
                              <td className="px-6 py-3 text-right font-black text-emerald-400 text-xs tracking-tighter uppercase tabular-nums">{fmtPts(t.total)}</td>
                              <td className="px-6 py-3 text-right">
                                 <div className="flex flex-col items-end gap-0.5">
                                    <span className="font-black text-indigo-400 text-[10px] tabular-nums uppercase">{fmtPts(t.avgPerDay)}</span>
                                    <div className="h-0.5 w-8 bg-indigo-500/20 rounded-full">
                                       <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (t.avgPerDay / metaConfig.metaProduccionDia) * 100)}%` }} />
                                    </div>
                                 </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Activity Mix (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'activity-type' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                   <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_45px_100px_-25px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-10 py-8 text-left text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Recurso Humano</th>
                            {weeklyActivityByTech.activityTypes.map(at => (
                              <th key={at} className="px-8 py-8 text-right text-[10px] font-black text-slate-200 uppercase tracking-[0.3em]">{at}</th>
                            ))}
                            <th className="px-10 py-8 text-right text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Total Bruto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weeklyActivityByTech.techs.map((t) => (
                            <tr key={t.name} className="hover:bg-white/[0.03] transition-all duration-300 group">
                              <td className="px-10 py-6 font-black text-white text-[12px] uppercase tracking-tighter group-hover:text-indigo-300 transition-colors">{t.name}</td>
                              {weeklyActivityByTech.activityTypes.map(at => {
                                const val = t.byType[at]?.pts || 0;
                                return (
                                  <td key={at} className="px-8 py-6 text-right font-black text-indigo-200 text-[11px] tabular-nums">
                                    {val > 0 ? fmtPts(val) : '—'}
                                  </td>
                                );
                              })}
                              <td className="px-10 py-6 text-right font-black text-emerald-400 text-base tabular-nums tracking-tighter uppercase">{fmtCLP(t.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Client Analysis (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'client-analysis' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   {clientProjects.slice(0, 4).map((cp) => (
                      <div key={`${cp.cliente}-${cp.proyecto}`} className="group relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.4)] overflow-hidden hover:border-indigo-500/30 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2">
                        {/* Header Section */}
                        <div className="p-10 border-b border-white/5 flex items-center justify-between">
                           <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                 <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                 <span className="font-black text-white text-xl uppercase tracking-tighter">{cp.cliente}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-5">{cp.proyecto || 'CANAL GENERAL'}</span>
                           </div>
                           <div className="text-right">
                              <div className="text-2xl font-black text-emerald-400 uppercase tracking-tighter tabular-nums">{fmtCLP(cp.pts)}</div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">PRODUCCIÓN TOTAL</div>
                           </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="p-10 grid grid-cols-2 gap-6">
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">PROM. DIARIO</span>
                              <span className="text-lg font-black text-white uppercase tabular-nums">{fmtCLP(cp.avgPerDay)}</span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center text-right">
                              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">PROVISIÓN</span>
                              <span className="text-lg font-black text-white uppercase tabular-nums">{cp.provisionCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center">
                              <span className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">REPARACIÓN</span>
                              <span className="text-lg font-black text-white uppercase tabular-nums">{cp.repairCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-center text-right">
                              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">FZA. TÉCNICA</span>
                              <span className="text-lg font-black text-white uppercase tabular-nums">{cp.techs} TÉC.</span>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slide: Geografía & LPU (Executive Dark) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'zones-lpu' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                  {/* Heatmaps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
                      <div key={zoneName} className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-xl overflow-hidden group hover:scale-[1.01] transition-transform duration-500">
                        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                               <MapPin className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="font-black text-white text-sm uppercase tracking-widest">{zoneName}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-emerald-400 font-black text-base tracking-tighter uppercase tabular-nums">{fmtCLP(zoneData.totalCLP)}</div>
                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{zoneData.totalOrders} ÓRDENES</div>
                          </div>
                        </div>
                        <div className="p-4 grid grid-cols-3 gap-3">
                          {zoneData.cities.map((city) => (
                            <div key={city.name} className="relative group/city">
                               <div className="absolute inset-0 bg-indigo-500/5 rounded-xl border border-white/5 transform group-hover/city:scale-105 transition-transform duration-300"></div>
                               <div className="relative p-3 text-center">
                                  <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest truncate mb-0.5">{city.name}</div>
                                  <div className="text-xs text-white font-black tabular-nums">{fmtPts(city.pts)}</div>
                               </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LPU Detailed Table */}
                  <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-white/5">
                        <h3 className="text-xs font-black text-indigo-300 uppercase tracking-[0.3em]">Desglose de Facturación por Actividad LPU</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5">
                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Descriptor de Actividad</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Volumen</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor Uni</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-emerald-400 uppercase tracking-widest">Facturación Bruta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {lpuData.slice(0, 15).map((act) => (
                            <tr key={act.desc} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-6 py-2 text-white/80 font-bold text-[10px] uppercase truncate max-w-md group-hover:text-white transition-colors">{act.desc}</td>
                              <td className="px-6 py-2 text-right font-black text-slate-300 text-[10px] tabular-nums">{act.count.toLocaleString('es-CL')}</td>
                              <td className="px-6 py-2 text-right font-black text-slate-400 text-[10px] tabular-nums">{fmtPts(act.avgPtsPerUnit)}</td>
                              <td className="px-6 py-2 text-right font-black text-emerald-400 text-xs tabular-nums tracking-tighter uppercase">{fmtCLP(act.totalCLP)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Calendar (Executive touch) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'calendar' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 px-6">
                  <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-2xl p-6">
                    <h3 className="text-center text-xl font-black text-white uppercase tracking-[0.4em] mb-6">
                      {monthNames[calMonth.month]} {calMonth.year}
                    </h3>
                    <div className="max-w-4xl mx-auto">
                      <div className="grid grid-cols-8 gap-2 mb-2">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Sem'].map((d) => (
                          <div key={d} className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">{d}</div>
                        ))}
                      </div>
                      {(() => {
                        const weeks = [];
                        for (let i = 0; i < calendarGrid.length; i += 7) weeks.push(calendarGrid.slice(i, i + 7));
                        return weeks.map((week, weekIdx) => (
                          <div key={weekIdx} className="grid grid-cols-8 gap-2 mb-2">
                            {week.map((day, dayIdx) => {
                              if (day === null) return <div key={`blank-${dayIdx}`} className="aspect-square rounded-xl bg-white/[0.02]" />;
                              const dayData = calendarData[day];
                              const hasPts = dayData && dayData.pts > 0;
                              return (
                                <div key={day} className={`aspect-square rounded-xl border transition-all duration-300 flex flex-col items-center justify-center relative overflow-hidden group/day ${hasPts ? greenScaleCal(dayData.pts, calMaxPts) : 'bg-white/5 border-white/5 hover:bg-white/[0.05]'}`}>
                                  <span className={`text-[11px] font-black transition-colors ${hasPts ? 'text-white' : 'text-slate-700'}`}>{day}</span>
                                  {hasPts && (
                                    <span className="text-[8px] text-emerald-400 font-black mt-0.5 tabular-nums">{dayData.pts >= 1000 ? `${(dayData.pts / 1000).toFixed(1)}k` : fmtPts(dayData.pts)}</span>
                                  )}
                                  {hasPts && <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/day:opacity-100 transition-opacity" />}
                                </div>
                              );
                            })}
                            {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                              <div key={`pad-${i}`} className="aspect-square rounded-2xl bg-white/[0.02]" />
                            ))}
                            <div className="aspect-square rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center shadow-lg">
                              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-tighter mb-1">Sem</span>
                              <span className="text-xs text-white font-black">{calWeeklyTotals[weekIdx] ? fmtPts(calWeeklyTotals[weekIdx].pts) : '0'}</span>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="mt-12 flex items-center justify-center gap-12 bg-indigo-500/5 rounded-[2rem] p-8 border border-white/5">
                      <div className="flex flex-col items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Producción Total</span>
                         <span className="text-2xl font-black text-emerald-400 tabular-nums">{fmtPts(calMonthTotal.pts)} pts</span>
                      </div>
                      <div className="w-px h-10 bg-white/10"></div>
                      <div className="flex flex-col items-center">
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Volumen Gestión</span>
                         <span className="text-2xl font-black text-white tabular-nums">{calMonthTotal.orders.toLocaleString('es-CL')} ÓRD.</span>
                      </div>
                      {metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 && (
                        <>
                          <div className="w-px h-10 bg-white/10"></div>
                          <div className="flex flex-col items-end">
                             <MetaBadge pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} label="Meta mensual equipo" />
                             <div className="mt-1"><MetaGap pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} /></div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modern Navigation footer */}
          <div className="flex items-center justify-between px-8 py-4 bg-slate-900/80 backdrop-blur-3xl border-t border-white/5 rounded-2xl mx-6 mb-6">
            <button
              onClick={prevSlide}
              disabled={presentationStep === 0}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl transition-all font-black text-[9px] uppercase tracking-[0.2em] shadow-xl ${
                presentationStep === 0
                  ? 'bg-white/5 text-slate-600 cursor-not-allowed border-white/5'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-400/50 shadow-indigo-500/20 active:scale-95'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>

            {/* Premium Section indicators */}
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5 shadow-inner">
              {PRESENTATION_SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setPresentationStep(i)}
                  className={`relative h-1.5 rounded-full transition-all duration-500 ${
                    i === presentationStep ? 'w-8 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'w-1.5 bg-white/10 hover:bg-white/30'
                  }`}
                  title={s.title}
                />
              ))}
            </div>

            <button
              onClick={presentationStep === PRESENTATION_SECTIONS.length - 1 ? closePresentation : nextSlide}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white border border-emerald-400/50 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
            >
              {presentationStep === PRESENTATION_SECTIONS.length - 1 ? 'Finalizar' : 'Siguiente'}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
