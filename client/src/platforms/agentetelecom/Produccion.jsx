import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Activity, Search, FileSpreadsheet, TrendingUp, Users, Award,
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Star, Target,
  MapPin, BarChart3, Layers, Clock, Hash, Zap,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, EyeOff,
  CheckCircle2, Thermometer, Grid3X3, Presentation, Maximize2, Minimize2,
  Wifi, Tv, Smartphone, Box, Package, Cpu, Fingerprint, Anchor, ArrowUpCircle,
  BarChart, LayoutDashboard, Map, ClipboardList, Trophy, TrendingDown, Users as UsersIcon
} from 'lucide-react';
import { adminApi } from '../rrhh/rrhhApi';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const pts = (v) => parseFloat(v) || 0;

const fmtPts = (v) => {
  const n = typeof v === 'number' ? v : pts(v);
  return n % 1 === 0
    ? n.toLocaleString('es-CL')
    : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

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
        {compact ? `-${Math.round(gap)}` : `Faltan ${Math.round(gap)} pts`}
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
const useSortable = (defaultKey = 'ptsTotal', defaultDir = 'desc') => {
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

// ─────────────────────────────────────────────────────────────
// STAT CARD COMPONENT
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// STAT CARD COMPONENT (Crystal/Premium Light)
// ─────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'emerald', target, achieved, dark = false }) => {
  const themes = {
    emerald: { bg: 'from-emerald-600 to-teal-500', glow: 'shadow-emerald-500/20', icon: dark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    blue: { bg: 'from-blue-600 to-indigo-500', glow: 'shadow-blue-500/20', icon: dark ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-600 border-blue-100' },
    purple: { bg: 'from-purple-600 to-fuchsia-500', glow: 'shadow-purple-500/20', icon: dark ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100' },
    amber: { bg: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/20', icon: dark ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-amber-50 text-amber-600 border-amber-100' }
  };

  const theme = themes[color] || themes.emerald;
  const progress = target > 0 ? Math.min(100, (achieved / target) * 100) : 0;
  const isOver = (achieved && target) ? achieved > target : false;

  const cardClasses = dark 
    ? "group relative bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-3xl p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] transition-all duration-500 hover:shadow-indigo-500/20 hover:scale-[1.02] hover:-translate-y-1 overflow-hidden flex flex-col justify-between h-full"
    : "group relative bg-white/95 backdrop-blur-2xl border border-white rounded-3xl p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.06)] transition-all duration-500 hover:shadow-[0_30px_60px_-10px_rgba(79,70,229,0.12)] hover:scale-[1.02] hover:-translate-y-1.5 overflow-hidden flex flex-col justify-between h-full";

  const labelClasses = dark ? "text-indigo-400" : "text-indigo-700";
  const valueClasses = dark ? "text-white" : "text-slate-900";
  const metaClasses = dark ? "text-slate-400" : "text-slate-800";

  return (
    <div className={cardClasses}>
      <div className={`absolute top-0 right-0 w-80 h-80 bg-gradient-to-br ${theme.bg} opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-1000 blur-3xl -mr-40 -mt-40`} />
      
      <div className="relative z-10">
        <div className={`flex items-start justify-between mb-6`}>
          <div className={`p-3.5 rounded-2xl border shadow-lg ${theme.icon} ${theme.glow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
            <Icon className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <div className="text-right">
            <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-1.5 ${labelClasses}`}>{label}</p>
            <div className={`text-2xl font-black tracking-tighter drop-shadow transition-colors uppercase ${valueClasses}`}>{value}</div>
          </div>
        </div>
        
        {target !== undefined && (
          <div className="space-y-5 mb-4">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest px-2">
              <span className={metaClasses}>Meta: {target.toLocaleString('es-CL')}</span>
              <span className={`px-2.5 py-1 rounded-lg font-bold shadow-sm ${isOver ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : dark ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                  {progress.toFixed(1)}%
              </span>
            </div>
            <div className={`h-4 rounded-full overflow-hidden shadow-inner border p-0.5 ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-100/80 border-white'}`}>
              <div 
                className={`h-full bg-gradient-to-r ${theme.bg} rounded-full transition-all duration-1000 shadow-[0_0_20px_rgba(0,0,0,0.2)] ${theme.glow}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-indigo-50/10 pt-5 flex items-center justify-between relative z-10">
         <span className={`text-[9px] font-black uppercase tracking-[0.2em] opacity-40 ${dark ? 'text-indigo-300' : 'text-slate-500'}`}>{sub || 'Intelligence Data'}</span>
         <div className={`w-8 h-1 rounded-full ${dark ? 'bg-white/10' : 'bg-slate-200'} overflow-hidden`}>
            <div className={`h-full bg-gradient-to-r ${theme.bg} opacity-30`} style={{ width: '100%' }}></div>
         </div>
         {isOver && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-[9px] font-black border border-emerald-400 shadow-lg shadow-emerald-100 animate-pulse shrink-0">
              <Trophy className="w-3 h-3" />
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
  <div className="bg-indigo-50/40 backdrop-blur-sm rounded-xl p-3 border border-indigo-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600" />}
      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xl font-black text-indigo-900 tracking-tight">{value}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// COMPOSITION BAR
// ─────────────────────────────────────────────────────────────
const CompositionBar = ({ base, deco, repetidor, telefono }) => {
  const total = base + deco + repetidor + telefono;
  if (total === 0) return <div className="text-xs text-slate-500">Sin datos</div>;
  const pct = (v) => ((v / total) * 100).toFixed(1);
  const segments = [
    { label: 'Base', value: base, pct: pct(base), color: 'bg-emerald-500' },
    { label: 'Deco', value: deco, pct: pct(deco), color: 'bg-blue-500' },
    { label: 'Repetidor', value: repetidor, pct: pct(repetidor), color: 'bg-purple-500' },
    { label: 'Teléfono', value: telefono, pct: pct(telefono), color: 'bg-amber-500' },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="flex rounded-full overflow-hidden h-4 mb-2">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`${s.color} transition-all`}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${fmtPts(s.value)} pts (${s.pct}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-indigo-400 font-bold">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color} shadow-sm shadow-indigo-100`} />
            <span>{s.label}: {s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const greenScale = (val, meta) => {
  if (val <= 0) return 'bg-indigo-50/30 text-indigo-100';
  const pct = val / (meta || 1);
  if (pct >= 1.2) return 'bg-emerald-600 text-white shadow-lg shadow-emerald-100';
  if (pct >= 1) return 'bg-emerald-500 text-white';
  if (pct >= 0.8) return 'bg-emerald-400 text-white';
  if (pct >= 0.5) return 'bg-emerald-200 text-emerald-800';
  if (pct >= 0.2) return 'bg-emerald-100 text-emerald-700';
  return 'bg-emerald-50 text-emerald-600';
};

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function Produccion() {
  const { user } = useAuth();
  // ── State — datos pre-agregados del servidor ──
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [availableClientes, setAvailableClientes] = useState([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(toInputDate(todayUTC()));
  const [dateTo, setDateTo] = useState(toInputDate(todayUTC()));
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('Completado');
  const [soloVinculados, setSoloVinculados] = useState(false);
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

  useEffect(() => {
    adminApi.getClientes().then(res => setAvailableClientes(res.data)).catch(() => {});
  }, []);

  // ── Fetch data pre-agregada del server (liviano y rápido) ──
  const fetchData = useCallback(async (desde, hasta, est, clis) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (typeof desde === 'string' && desde.length === 10) params.desde = desde;
      if (typeof hasta === 'string' && hasta.length === 10) params.hasta = hasta;
      if (est) params.estado = est;
      if (clis && clis.length > 0) params.clientes = clis;
      const { data } = await api.get('/bot/produccion-stats', { params });
      setServerData(data);
      setLastRefresh(new Date());
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
    fetchTimerRef.current = setTimeout(() => fetchData(dateFrom, dateTo, estadoFilter, selectedClientes), 300);
    refreshTimerRef.current = setInterval(() => fetchData(dateFrom, dateTo, estadoFilter, selectedClientes), 300000); // 5 min
    return () => {
      clearTimeout(fetchTimerRef.current);
      clearInterval(refreshTimerRef.current);
    };
  }, [fetchData, dateFrom, dateTo, estadoFilter, selectedClientes]);

  // ── Technician ranking (filtrado local por búsqueda, tipo y vinculados) ──
  const techRanking = useMemo(() => {
    if (!serverData?.tecnicos) return [];
    let list = serverData.tecnicos;
    const search = searchTech.toLowerCase().trim();
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search));
    if (typeFilter === 'provision') list = list.filter(t => t.provisionCount > 0);
    if (typeFilter === 'reparacion') list = list.filter(t => t.repairCount > 0);
    if (soloVinculados) list = list.filter(t => t.isVinculado);
    return list;
  }, [serverData, searchTech, typeFilter, soloVinculados]);

  // ── Hay filtros locales activos? ──
  const hasLocalFilters = searchTech.trim() !== '' || typeFilter !== 'todos' || soloVinculados;

  // ── Header stats — recalculados desde techRanking filtrado ──
  const headerStats = useMemo(() => {
    if (!serverData?.stats) return { totalOrders: 0, totalPts: 0, avgPtsPerTechPerDay: 0, uniqueTechs: 0, uniqueDays: 0, metaRequired: 0, metaAchieved: 0 };
    
    // Configuración de metas
    const metaConfig = serverData.metaConfig || { metaProduccionDia: 0 };
    const metaDiariaGlobal = metaConfig.metaProduccionDia * (serverData.stats.uniqueTechs || 1);

    // Si no hay filtros locales, usar stats del servidor directamente
    if (!hasLocalFilters) {
      const totalPts = serverData.stats.totalPts;
      const metaRequired = metaDiariaGlobal * serverData.stats.uniqueDays;
      return {
        ...serverData.stats,
        metaRequired,
        metaAchieved: totalPts,
        diff: totalPts - metaRequired
      };
    }

    // Recalcular desde técnicos filtrados
    const totalOrders = techRanking.reduce((s, t) => s + t.orders, 0);
    const totalPts = techRanking.reduce((s, t) => s + t.ptsTotal, 0);
    const uniqueTechs = techRanking.length;
    const allDays = new Set();
    techRanking.forEach(t => {
      if (t.dailyMap) Object.keys(t.dailyMap).forEach(dk => allDays.add(dk));
    });
    const uniqueDays = allDays.size;
    const avgPtsPerTechPerDay = uniqueTechs > 0 && uniqueDays > 0
      ? Math.round((totalPts / uniqueTechs / uniqueDays) * 100) / 100 : 0;
    
    const metaRequired = metaConfig.metaProduccionDia * uniqueTechs * uniqueDays;

    return { 
      totalOrders, 
      totalPts: Math.round(totalPts * 100) / 100, 
      avgPtsPerTechPerDay, 
      uniqueTechs, 
      uniqueDays,
      metaRequired,
      metaAchieved: totalPts,
      diff: totalPts - metaRequired
    };
  }, [serverData, techRanking, hasLocalFilters]);

  const { sortKey: techSortKey, sortDir: techSortDir, toggle: techToggle, icon: techSortIcon } = useSortable('ptsTotal', 'desc');

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

  const techsSummary = useMemo(() => {
    return sortedTechRanking.reduce((acc, t) => ({
      totalQtyDeco: acc.totalQtyDeco + (t.qtyDeco || 0),
      totalQtyRepetidor: acc.totalQtyRepetidor + (t.qtyRepetidor || 0),
    }), { totalQtyDeco: 0, totalQtyRepetidor: 0 });
  }, [sortedTechRanking]);

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
            if (!map[d]) map[d] = { pts: 0, orders: 0, techs: {} };
            map[d].pts += dd.pts;
            map[d].orders += dd.orders;
            map[d].techs[t.name] = (map[d].techs[t.name] || 0) + dd.pts;
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
          if (!cityMap[city]) cityMap[city] = { pts: 0, orders: 0 };
          cityMap[city].pts += data.pts;
          cityMap[city].orders += data.orders;
        });
      });
    }
    const result = {};
    Object.entries(MACRO_ZONAS).forEach(([zone, cities]) => {
      const zoneCities = cities.map((c) => ({
        name: c,
        pts: cityMap[c]?.pts || 0,
        orders: cityMap[c]?.orders || 0,
      }));
      const totalPtsZone = zoneCities.reduce((s, c) => s + c.pts, 0);
      const totalOrdersZone = zoneCities.reduce((s, c) => s + c.orders, 0);
      const maxPts = Math.max(...zoneCities.map((c) => c.pts), 1);
      result[zone] = { cities: zoneCities, totalPts: totalPtsZone, totalOrders: totalOrdersZone, maxPts };
    });
    return result;
  }, [serverData, techRanking, hasLocalFilters]);

  // ── LPU activity data — recalculada desde técnicos filtrados si hay filtros ──
  const lpuData = useMemo(() => {
    if (!hasLocalFilters) return serverData?.lpuActivities || [];
    // Reconstruir desde actividades de técnicos filtrados
    const lpuMap = {};
    techRanking.forEach(t => {
      if (!t.activities) return;
      Object.entries(t.activities).forEach(([desc, data]) => {
        if (!lpuMap[desc]) lpuMap[desc] = { desc, code: '', count: 0, totalPts: 0 };
        lpuMap[desc].count += data.count;
        lpuMap[desc].totalPts += data.pts;
      });
    });
    return Object.values(lpuMap)
      .filter(a => a.totalPts > 0)
      .sort((a, b) => b.totalPts - a.totalPts)
      .map(a => ({ ...a, totalPts: Math.round(a.totalPts * 100) / 100, avgPtsPerUnit: a.count > 0 ? Math.round((a.totalPts / a.count) * 100) / 100 : 0 }));
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
        if (!weekMap[wk]) weekMap[wk] = { week, year, key: wk, orders: 0, pts: 0, days: new Set(), techs: new Set(), dayPts: {} };
        weekMap[wk].orders += dd.orders;
        weekMap[wk].pts += dd.pts;
        weekMap[wk].days.add(dateKey);
        weekMap[wk].techs.add(t.name);
        // Puntos por día de la semana (0=Lun..6=Dom)
        const dt = new Date(dateKey);
        const dow = (dt.getUTCDay() + 6) % 7; // Lun=0, Mar=1, ..., Dom=6
        weekMap[wk].dayPts[dow] = (weekMap[wk].dayPts[dow] || 0) + dd.pts;
      });
    });
    return Object.values(weekMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(w => ({
        ...w,
        pts: Math.round(w.pts * 100) / 100,
        daysCount: w.days.size,
        techsCount: w.techs.size,
        avgPerDay: w.days.size > 0 ? Math.round((w.pts / w.days.size) * 100) / 100 : 0,
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
          if (!weekPts[wk]) weekPts[wk] = { pts: 0, orders: 0 };
          weekPts[wk].pts += dd.pts;
          weekPts[wk].orders += dd.orders;
          total += dd.pts;
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

  // ── Meta de producción configurada por la empresa ──
  const metaConfig = useMemo(() => serverData?.metaConfig || {
    metaProduccionDia: 0, diasLaboralesSemana: 5, diasLaboralesMes: 22,
    metaProduccionSemana: 0, metaProduccionMes: 0
  }, [serverData]);

  // ── Nombre de empresa ──
  const empresaNombre = serverData?.empresaNombre || user?.empresa?.nombre || 'Empresa';

  // ── Client/Project data ──
  const clientProjects = useMemo(() => serverData?.clientProjects || [], [serverData]);

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
          dayPts[dow] = (dayPts[dow] || 0) + dd.pts;
          total += dd.pts;
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
            if (!byType[actName]) byType[actName] = { count: 0, pts: 0 };
            byType[actName].count += actData.count;
            byType[actName].pts += actData.pts;
            actTypeSet.add(actName);
            total += actData.pts;
          });
        }
      });
      if (total > 0) {
        techData.push({ name: t.name, byType, total: Math.round(total * 100) / 100 });
      }
    });

    // Ordenar tipos por pts total descendente
    const activityTypes = [...actTypeSet].sort((a, b) => {
      const ptsA = techData.reduce((s, t) => s + (t.byType[a]?.pts || 0), 0);
      const ptsB = techData.reduce((s, t) => s + (t.byType[b]?.pts || 0), 0);
      return ptsB - ptsA;
    });

    return { techs: techData.sort((a, b) => b.total - a.total), activityTypes };
  }, [selectedWeek, techRanking, serverData]);

  // ── Rendimiento Diario (Últimas 3 Semanas) ──
  const threeWeekDataByTech = useMemo(() => {
    // 1. Encontrar las últimas 3 semanas con datos disponibles en el serverData (filtrado actual)
    const allWeekKeys = weeklyData.map(w => w.key).sort((a, b) => b.localeCompare(a));
    const targetWeeks = allWeekKeys.slice(0, 3).reverse(); // Ordenadas de más antigua a más nueva
    if (targetWeeks.length === 0) return { targetWeeks, techs: [] };

    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    
    const result = techs.map(t => {
      let totalPts3W = 0;
      let totalDays3W = 0;
      const weekStats = {};

      targetWeeks.forEach(wk => {
        let pts = 0;
        let days = 0;
        if (t.dailyMap) {
          Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
            const { week, year } = getISOWeek(dateKey);
            if (`${year}-S${String(week).padStart(2, '0')}` === wk) {
              pts += dd.pts;
              days += 1;
            }
          });
        }
        weekStats[wk] = { pts, days, avg: days > 0 ? (pts / days) : 0 };
        totalPts3W += pts;
        totalDays3W += days;
      });

      const globalAvg = totalDays3W > 0 ? (totalPts3W / totalDays3W) : 0;
      return {
        name: t.name,
        weekStats,
        globalAvg,
        totalPts: totalPts3W,
        totalDays: totalDays3W
      };
    }).filter(t => t.totalDays > 0).sort((a, b) => b.globalAvg - a.globalAvg); // Solo técnicos con actividad en ese periodo

    return { targetWeeks, techs: result };
  }, [techRanking, serverData, weeklyData]);
  
  // ── Datos semanales por técnico (para detalle expandido) ──
  const getWeeklyForTech = useCallback((tech) => {
    if (!tech?.dailyMap) return [];
    const weekMap = {};
    Object.entries(tech.dailyMap).forEach(([dateKey, dd]) => {
      const { week, year } = getISOWeek(dateKey);
      const wk = `${year}-S${String(week).padStart(2, '0')}`;
      if (!weekMap[wk]) weekMap[wk] = { week, year, key: wk, orders: 0, pts: 0, days: new Set() };
      weekMap[wk].orders += dd.orders;
      weekMap[wk].pts += dd.pts;
      weekMap[wk].days.add(dateKey);
    });
    return Object.values(weekMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(w => ({
        ...w,
        pts: Math.round(w.pts * 100) / 100,
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

  // ── Export to Excel (ranking de técnicos) ──
  const exportToExcel = useCallback(() => {
    const rows = sortedTechRanking.map((t, i) => ({
      '#': i + 1,
      'Técnico': t.name,
      'Días Activos': t.activeDays,
      'Órdenes': t.orders,
      'Pts Base': Math.round(t.ptsBase * 100) / 100,
      'Pts Deco': Math.round(t.ptsDeco * 100) / 100,
      'Pts Repetidor': Math.round(t.ptsRepetidor * 100) / 100,
      'Pts Teléfono': Math.round(t.ptsTelefono * 100) / 100,
      'Pts Total': Math.round(t.ptsTotal * 100) / 100,
      'Prom/Día': Math.round(t.avgPerDay * 100) / 100,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción');
    XLSX.writeFile(wb, `produccion_${dateFrom}_${dateTo}.xlsx`);
  }, [sortedTechRanking, dateFrom, dateTo]);

  const downloadRawDB = useCallback(async () => {
    try {
      const params = { estado: estadoFilter };
      if (dateFrom) params.desde = dateFrom;
      if (dateTo) params.hasta = dateTo;
      const { data } = await api.get('/bot/produccion-raw', { params });
      if (!data?.rows?.length) { alert('No hay datos para el rango seleccionado'); return; }
      const ws = XLSX.utils.json_to_sheet(data.rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'BD Producción');
      XLSX.writeFile(wb, `BD_produccion_operativa_${dateFrom}_${dateTo}.xlsx`);
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
    const vals = Object.values(calendarData).map((d) => d.pts);
    return Math.max(...vals, 1);
  }, [calendarData]);

  const calWeeklyTotals = useMemo(() => {
    const weeks = {};
    calendarGrid.forEach((day, idx) => {
      const weekIdx = Math.floor(idx / 7);
      if (!weeks[weekIdx]) weeks[weekIdx] = { pts: 0, orders: 0 };
      if (day && calendarData[day]) {
        weeks[weekIdx].pts += calendarData[day].pts;
        weeks[weekIdx].orders += calendarData[day].orders;
      }
    });
    return weeks;
  }, [calendarGrid, calendarData]);

  const calMonthTotal = useMemo(() => {
    return Object.values(calendarData).reduce(
      (acc, d) => ({ pts: acc.pts + d.pts, orders: acc.orders + d.orders }),
      { pts: 0, orders: 0 }
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



  const greenScaleCal = (value, max) => {
    if (value === 0 || max === 0) return 'bg-white border border-indigo-50/20 opacity-40';
    const ratio = value / max;
    if (ratio > 0.8) return 'bg-emerald-500 text-white border-emerald-600 shadow-md shadow-emerald-100';
    if (ratio > 0.6) return 'bg-emerald-400 text-white border-emerald-500';
    if (ratio > 0.4) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (ratio > 0.2) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-slate-50 text-indigo-200 border-indigo-50/20';
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
  // ── Semáforo color para celdas (Light Theme) ──
  const semaforoColor = (val, meta) => {
    if (!meta || meta <= 0 || val <= 0) return {};
    const pct = val / meta;
    if (pct >= 1) return { background: '#ECFDF5', color: '#065F46', borderLeft: '4px solid #10B981' };
    if (pct >= 0.8) return { background: '#FFFBEB', color: '#92400E', borderLeft: '4px solid #F59E0B' };
    if (pct >= 0.5) return { background: '#FFF7ED', color: '#9A3412', borderLeft: '4px solid #F97316' };
    return { background: '#FEF2F2', color: '#991B1B', borderLeft: '4px solid #EF4444' };
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
  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <div className="relative overflow-hidden bg-white border-b border-slate-200/80 shadow-sm">
        {/* Crystal Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-100/30 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-white border border-slate-200 rounded-[2rem] shadow-xl shadow-slate-200/50 rotate-3 hover:rotate-0 transition-transform duration-500 group">
                  <Activity className="w-10 h-10 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                  Rendimiento <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">Operativo</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <p className="text-[11px] font-black text-indigo-500/60 uppercase tracking-[0.2em]">Agente Telecom • Premium Intelligence</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end mr-2">
                {lastRefresh && (
                  <span className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest">
                    Live Data • {lastRefresh.toLocaleTimeString('es-CL')}
                  </span>
                )}
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full mt-1 border border-emerald-100">Sistema Conectado</span>
              </div>
              <button
                onClick={() => fetchData(dateFrom, dateTo, estadoFilter)}
                disabled={loading}
                className="group flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                Actualizar Datos
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard
              icon={CheckCircle2}
              label="Órdenes Completadas"
              value={headerStats.totalOrders.toLocaleString('es-CL')}
              sub="Rendimiento del periodo"
              color="emerald"
            />
            <StatCard
              icon={Zap}
              label="Puntos Baremo"
              value={fmtPts(headerStats.totalPts)}
              target={metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 ? (metaConfig.metaProduccionMes * headerStats.uniqueTechs) : undefined}
              achieved={headerStats.totalPts}
              sub={metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0
                ? `Meta equipo: ${fmtPts(metaConfig.metaProduccionMes * headerStats.uniqueTechs)}/mes`
                : "Sin meta configurada"}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="Promedio Diario"
              value={fmtPts(headerStats.avgPtsPerTechPerDay)}
              target={metaConfig.metaProduccionDia > 0 ? metaConfig.metaProduccionDia : undefined}
              achieved={headerStats.avgPtsPerTechPerDay}
              sub={metaConfig.metaProduccionDia > 0
                ? `Requerido: ${fmtPts(metaConfig.metaProduccionDia)} pts/téc`
                : `${headerStats.uniqueTechs} técnicos activos`}
              color="purple"
            />
            <StatCard
              icon={Users}
              label="Equipo Activo"
              value={headerStats.uniqueTechs.toLocaleString('es-CL')}
              sub={soloVinculados ? 'Personal Vinculado' : 'Dotación Total'}
              color="amber"
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-12 space-y-10 relative z-10">
        {/* ═══════════════════════ 2. FILTROS (Sticky Master) ═══════════════════════ */}
        <div className="sticky top-0 z-50 py-4 -mx-4 px-4 bg-slate-50/60 backdrop-blur-md border-b border-slate-200/50 shadow-sm transition-all rounded-b-2xl">
          <section id="section-filters" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Filtros Inteligentes</span>
              </div>

              {/* Quick Navigation Links */}
              <div className="flex items-center gap-1 bg-white/70 p-1 rounded-xl border border-slate-200/50 shadow-sm overflow-x-auto no-scrollbar">
                {[
                  { id: 'section-ranking', label: 'Ranking', icon: Award },
                  { id: 'section-equipos', label: 'Equipos', icon: Box },
                  { id: 'section-weekly', label: 'Semanal', icon: Calendar },
                  { id: 'section-activity', label: 'Actividad', icon: Activity },
                  { id: 'section-zones', label: 'Geografía', icon: Map },
                  { id: 'section-calendar', label: 'Calendario', icon: Grid3X3 },
                ].map(nav => (
                  <button
                    key={nav.id}
                    onClick={() => document.getElementById(nav.id)?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50 rounded-lg text-[10px] font-black text-slate-500 hover:text-emerald-600 transition-all border border-transparent hover:border-emerald-100 whitespace-nowrap"
                  >
                    <nav.icon className="w-3.5 h-3.5" />
                    {nav.label}
                  </button>
                ))}
                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                <button
                  onClick={(e) => {
                    const container = e.target.closest('main') || document.querySelector('main');
                    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 rounded-lg text-[10px] font-black text-white transition-all shadow-md shadow-slate-200"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  Subir
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-4 text-slate-700">
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
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
                <div className="text-slate-300 font-black mt-5">→</div>
                <div>
                  <label className="block text-[9px] font-black text-indigo-600/60 mb-1.5 uppercase tracking-widest">Hasta</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
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
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer shadow-sm"
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer shadow-sm"
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
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                    : 'bg-white border-slate-200 text-indigo-200 hover:border-emerald-500 hover:text-emerald-600 shadow-sm'
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
                    className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
              </div>

              <button
                onClick={exportToExcel}
                className="px-5 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition-all flex items-center gap-2 uppercase tracking-widest mb-0.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>

              <button
                onClick={downloadRawDB}
                className="px-5 py-2.5 bg-indigo-600 text-white border border-indigo-700 rounded-xl text-[10px] font-black hover:bg-indigo-700 transition-all flex items-center gap-2 uppercase tracking-widest mb-0.5 shadow-lg shadow-indigo-200"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar BD
              </button>
            </div>
          </section>
        </div>

        {/* ═══════════════════════ 3. RANKING TÉCNICOS (Crystal Master) ═══════════════════════ */}
        <section id="section-ranking" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[1.25rem] bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-sm rotate-3 group-hover:rotate-0 transition-transform">
              <Award className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ranking Master</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Global Performance Leaderboard</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{sortedTechRanking.length} Especialistas Activos</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <button
                onClick={openPresentation}
                className="group flex items-center gap-2.5 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[13px] font-black text-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:shadow-xl hover:shadow-emerald-100/50 transition-all active:scale-95"
              >
                <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Presentación
              </button>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl shadow-indigo-100/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
          <tr className="border-b border-indigo-100/50 bg-gradient-to-r from-slate-50 to-white backdrop-blur-md">
            {[
              { key: null, label: '#', className: 'w-16 text-center' },
              { key: 'name', label: 'Técnico Especialista', className: 'text-left' },
              { key: 'cliente', label: 'Asignación / Cliente', className: 'text-left' },
                      { key: 'activeDays', label: 'Días' },
                      { key: 'orders', label: 'Órdenes' },
                      { key: 'ptsBase', label: 'Base' },
                      { key: 'ptsDeco', label: 'Decos' },
                      { key: 'ptsRepetidor', label: 'WiFi' },
                      { key: 'ptsTotal', label: 'Total' },
                      { key: 'avgPerDay', label: 'Prom/Día' },
                      ...(metaConfig.metaProduccionDia > 0 ? [{ key: null, label: 'Desempeño', className: 'text-center' }] : []),
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-5 text-[10px] font-black text-indigo-200 uppercase tracking-[0.15em] ${col.className || 'text-right'} ${col.key ? 'cursor-pointer hover:text-emerald-600 select-none group transition-colors' : ''}`}
                        onClick={col.key ? () => techToggle(col.key) : undefined}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {col.label}
                          {col.key && <span className="ring-1 ring-slate-200 rounded p-0.5 group-hover:ring-emerald-200">{techSortIcon(col.key)}</span>}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {sortedTechRanking.map((tech, idx) => {
                    const rank = idx + 1;
                    const isExpanded = expandedTech === tech.name;
                    const techPerf = metaConfig.metaProduccionDia > 0 ? perfEmoji(Math.round((tech.avgPerDay / metaConfig.metaProduccionDia) * 100)) : null;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                    return (
                      <React.Fragment key={tech.name}>
                        <tr
                          className={`border-b border-indigo-50/20/80 cursor-pointer transition-all duration-300 ${
                            isExpanded ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => setExpandedTech(isExpanded ? null : tech.name)}
                        >
                          <td className="px-4 py-6 text-center">
                            {rank <= 3 ? (
                                <div className="relative inline-flex items-center justify-center">
                                    <span className="text-2xl drop-shadow-md z-10">{medal}</span>
                                    <div className={`absolute inset-0 scale-150 blur-xl opacity-30 rounded-full ${rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-400' : 'bg-orange-400'}`}></div>
                                </div>
                            ) : (
                                <span className="text-xs font-black text-indigo-200 opacity-50">{rank.toString().padStart(2, '0')}</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-left font-black text-slate-800">
                            <div className="flex items-center gap-2">
                              {tech.name} {techPerf && <span className="text-lg">{techPerf}</span>}
                              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-left text-xs font-bold text-slate-500 max-w-[150px] truncate">
                            {tech.cliente ? <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg border border-blue-100">{tech.cliente}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{tech.activeDays}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{tech.orders.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">{fmtPts(tech.ptsBase)}</td>
                          <td className="px-4 py-4 text-right group">
                            <div className="inline-flex flex-col items-end">
                                <span className="font-black text-indigo-600">{tech.qtyDeco || 0}</span>
                                <span className="text-[9px] font-black text-indigo-200 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">[{fmtPts(tech.ptsDeco)} pts]</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right group">
                            <div className="inline-flex flex-col items-end">
                                <span className="font-black text-violet-600">{tech.qtyRepetidor || 0}</span>
                                <span className="text-[9px] font-black text-indigo-200 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">[{fmtPts(tech.ptsRepetidor)} pts]</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-black text-emerald-600 text-base">{fmtPts(tech.ptsTotal)}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-700">{fmtPts(tech.avgPerDay)}</td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-4 py-4 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <MetaBadge pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                  <MetaGap pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                                </div>
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={metaConfig.metaProduccionDia > 0 ? 11 : 10} className="p-0 bg-emerald-50/20">
                               <div className="p-6 border-t border-emerald-200 animate-in fade-in slide-in-from-top-2 duration-500">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                     <MiniStat label="Puntos Base" value={fmtPts(tech.ptsBase)} icon={Zap} color="slate" />
                                     <MiniStat label="Puntos Decos" value={fmtPts(tech.ptsDeco)} icon={Layers} color="indigo" />
                                     <MiniStat label="Puntos WiFi Kit" value={fmtPts(tech.ptsRepetidor)} icon={Wifi} color="violet" />
                                     <MiniStat label="Puntos Teléfono" value={fmtPts(tech.ptsTelefono)} icon={Smartphone} color="purple" />
                                  </div>
                                  <CompositionBar base={tech.ptsBase} deco={tech.ptsDeco} repetidor={tech.ptsRepetidor} telefono={tech.ptsTelefono} />
                                  <div className="mt-6">
                                    <div className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-3">Daily Performance Heatmap</div>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(tech.dailyMap).slice(0, 14).map(([day, d]) => (
                                         <div key={day} className="flex flex-col items-center gap-1 group/day" title={`${day}: ${fmtPts(d.pts)} pts`}>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${greenScale(d.pts, metaConfig.metaProduccionDia || 40)}`}>
                                               {fmtPts(d.pts)}
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-200 uppercase group-hover/day:text-slate-800">{day.split('-').slice(1).join('/')}</span>
                                         </div>
                                      ))}
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
                    <tr className="bg-slate-50/80 border-t border-slate-200 font-black">
                      <td className="px-4 py-5 text-center text-emerald-600">
                        <Target className="w-5 h-5 mx-auto" strokeWidth={3} />
                      </td>
                      <td className="px-4 py-5 text-left text-slate-800 uppercase tracking-widest text-xs">Total Equipo</td>
                      <td className="px-4 py-5"></td>
                      <td className="px-4 py-5 text-right text-slate-600">{sortedTechRanking.reduce((s, t) => s + t.activeDays, 0)}</td>
                      <td className="px-4 py-5 text-right text-slate-600 font-black">{sortedTechRanking.reduce((s, t) => s + t.orders, 0).toLocaleString('es-CL')}</td>
                      <td className="px-4 py-5 text-right text-slate-600">{fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsBase, 0))}</td>
                      <td className="px-4 py-5 text-right text-indigo-600">{techsSummary.totalQtyDeco}</td>
                      <td className="px-4 py-5 text-right text-violet-600">{techsSummary.totalQtyRepetidor}</td>
                      <td className="px-4 py-5 text-right text-emerald-600 text-lg">{fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsTotal, 0))}</td>
                      <td className="px-4 py-5 text-right text-slate-800">{fmtPts(sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1))}</td>
                      {metaConfig.metaProduccionDia > 0 && <td className="px-4 py-5"></td>}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {sortedTechRanking.length === 0 && (
              <div className="text-center py-20 bg-indigo-50/50">
                <Users className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                <p className="text-indigo-600/70 font-black uppercase tracking-widest text-xs">No se encontraron resultados con los filtros aplicados</p>
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════ 3b. PRODUCCIÓN POR EQUIPOS (NEW) ═══════════════════════ */}
        <section id="section-equipos" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
              <Box className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Producción por Equipos</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Equipment Detailed Analysis</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Desglose de Terminales Instalados</span>
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl shadow-indigo-100/30 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/80 backdrop-blur-md">
                    <th className="px-4 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest w-12">#</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Técnico</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Servicios</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-indigo-600 uppercase tracking-widest">Decos</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-violet-600 uppercase tracking-widest">WiFi</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-purple-600 uppercase tracking-widest">Tel</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-slate-800 uppercase tracking-widest">Total Eq</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Eq / Serv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {sortedTechRanking.map((tech, idx) => {
                    const totalEq = (tech.qtyDeco || 0) + (tech.qtyRepetidor || 0) + (tech.qtyTelefono || 0);
                    const ratio = tech.orders > 0 ? (totalEq / tech.orders).toFixed(2) : '0.00';
                    return (
                      <tr key={tech.name} className="group hover:bg-slate-50/80 transition-all duration-300">
                        <td className="px-4 py-4 text-center text-[11px] font-black text-slate-300">{idx + 1}</td>
                        <td className="px-4 py-4">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{tech.name}</span>
                        </td>
                        <td className="px-4 py-4 text-right font-black text-slate-600">{tech.orders?.toLocaleString('es-CL')}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">{tech.qtyDeco || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex px-2 py-1 bg-violet-50 text-violet-700 rounded-lg text-xs font-black">{tech.qtyRepetidor || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-black">{tech.qtyTelefono || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-right font-black text-slate-800 bg-indigo-50/30">{totalEq}</td>
                        <td className="px-4 py-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                              <div className="w-12 bg-indigo-50/20 h-1.5 rounded-full overflow-hidden">
                                 <div className="bg-emerald-500 h-full" style={{ width: `${Math.min(parseFloat(ratio) * 50, 100)}%` }}></div>
                              </div>
                              <span className="text-[11px] font-black text-emerald-600">{ratio}</span>
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black border-t border-slate-800">
                    <td className="px-4 py-5" colSpan={2}>TOTAL EQUIPO</td>
                    <td className="px-4 py-5 text-right">{sortedTechRanking.reduce((s, t) => s + t.orders, 0).toLocaleString('es-CL')}</td>
                    <td className="px-4 py-5 text-right text-indigo-300">{techsSummary.totalQtyDeco}</td>
                    <td className="px-4 py-5 text-right text-violet-300">{techsSummary.totalQtyRepetidor}</td>
                    <td className="px-4 py-5 text-right text-purple-300">{sortedTechRanking.reduce((s, t) => s + (t.qtyTelefono || 0), 0)}</td>
                    <td className="px-4 py-5 text-right">
                      {techsSummary.totalQtyDeco + techsSummary.totalQtyRepetidor + sortedTechRanking.reduce((s, t) => s + (t.qtyTelefono || 0), 0)}
                    </td>
                    <td className="px-4 py-5 text-right text-emerald-300">
                      {(() => {
                        const totalOrders = sortedTechRanking.reduce((s, t) => s + t.orders, 0);
                        const totalEq = techsSummary.totalQtyDeco + techsSummary.totalQtyRepetidor + sortedTechRanking.reduce((s, t) => s + (t.qtyTelefono || 0), 0);
                        return totalOrders > 0 ? (totalEq / totalOrders).toFixed(2) : '0.00';
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {weeklyData.length > 0 && (
          <section id="section-weekly" className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl shadow-indigo-100/30 p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Análisis Semanal (Heatmap)</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Global Productivity Mapping</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-50/20">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Periodo</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Lun</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Mar</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Mié</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Jue</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Vie</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest text-orange-400">Sáb</th>
                    <th className="px-2 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest text-orange-400">Dom</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Total Pts</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-amber-600 uppercase tracking-widest">Eficiencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {(() => {
                    const maxDayPts = Math.max(...weeklyData.flatMap(w => Object.values(w.dayPts || {})), 1);
                    return weeklyData.map((w) => {
                      const avgPerTech = w.techsCount > 0 ? (w.pts / w.techsCount) : 0;
                      return (
                        <tr key={w.key} className="group hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black tracking-widest">S{String(w.week).padStart(2, '0')}</span>
                            <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-tighter mt-1">{w.range}</p>
                          </td>
                          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                            const val = w.dayPts?.[dow] || 0;
                            return (
                              <td key={dow} className="px-2 py-4 text-center">
                                <div className={`inline-flex items-center justify-center min-w-[36px] h-8 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, (maxDayPts/2)) : 'text-slate-200'}`}>
                                  {val > 0 ? fmtPts(val) : '—'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-right font-black text-emerald-600">{fmtPts(w.pts)}</td>
                          <td className="px-6 py-4 text-right">
                             <MetaBadge pts={avgPerTech} meta={metaConfig.metaProduccionSemana} label="Meta semanal" />
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-50/80 border-t border-slate-200">
                      <td className="px-6 py-5 text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Consolidado Total</td>
                      {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                         const total = weeklyData.reduce((s, w) => s + (w.dayPts?.[dow] || 0), 0);
                         return <td key={dow} className="px-2 py-5 text-center text-[10px] font-bold text-indigo-200">{total > 0 ? fmtPts(total) : '—'}</td>;
                      })}
                      <td className="px-6 py-5 text-right font-black text-emerald-600">{fmtPts(weeklyData.reduce((s, w) => s + w.pts, 0))}</td>
                      <td className="px-6 py-5 text-right font-black text-amber-600">
                        {(() => {
                          const totalPtsAll = weeklyData.reduce((s, w) => s + w.pts, 0);
                          const totalTechsCount = weeklyData.reduce((s, w) => s + w.techsCount, 0);
                          return totalTechsCount > 0 ? fmtPts(totalPtsAll / totalTechsCount) : '—';
                        })()}
                      </td>
                    </tr>
                  </tfoot>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3c. PRODUCCIÓN SEMANAL POR TÉCNICO ═══════════════════════ */}
        {weeklyData.length > 0 && weeklyByTech.length > 0 && (
          <section className="bg-white/70 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-2xl shadow-indigo-100/30 p-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                  <Users className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Cruce por Técnicos</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Weekly Performance Distribution</p>
                </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-50/20">
                    <th className="px-4 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest w-16">#</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest min-w-[200px]">Técnico</th>
                    {weeklyData.map(w => (
                      <th key={w.key} className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">
                         S{String(w.week).padStart(2, '0')}
                      </th>
                    ))}
                    <th className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Total</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-amber-600 uppercase tracking-widest">Prom/Día</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest w-32">Nivel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {(() => {
                    const maxTotal = Math.max(...weeklyByTech.map(t => t.total), 1);
                    const maxCell = Math.max(...weeklyByTech.flatMap(t => weeklyData.map(w => t.weekPts[w.key]?.pts || 0)), 1);
                    return weeklyByTech.map((t, i) => {
                      return (
                        <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-center text-[11px] font-black text-slate-300">{i + 1}</td>
                          <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px]">{t.name}</td>
                          {weeklyData.map(w => {
                            const val = t.weekPts[w.key]?.pts || 0;
                            return (
                              <td key={w.key} className="px-4 py-4 text-right">
                                <div className={`inline-flex items-center justify-center min-w-[36px] h-8 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, (maxCell/2)) : 'text-indigo-50/20'}`}>
                                  {val > 0 ? fmtPts(val) : '—'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-4 text-right font-black text-emerald-600">{fmtPts(t.total)}</td>
                          <td className="px-4 py-4 text-right font-black text-amber-600">{fmtPts(t.avgPerDay)}</td>
                          <td className="px-4 py-4">
                             <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-indigo-50/20 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (t.total / maxTotal) * 100)}%` }} />
                                </div>
                             </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3d. DETALLE SEMANAL: TÉCNICO × DÍA ═══════════════════════ */}
        {weeklyData.length > 0 && (
          <section className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Grid3X3 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Detalle Diario por Semana</h2>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Individual Daily Mapping</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-indigo-50/20 rounded-xl px-4 py-2">
                 <label className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Semana:</label>
                 <select
                   value={selectedWeek}
                   onChange={(e) => setSelectedWeek(e.target.value)}
                   className="bg-transparent text-[11px] font-black text-slate-800 focus:outline-none cursor-pointer"
                 >
                   {weeklyData.map(w => (
                     <option key={w.key} value={w.key}>S{String(w.week).padStart(2, '0')} — {w.range}</option>
                   ))}
                 </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-50/20">
                    <th className="px-4 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest w-16">#</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest min-w-[200px]">Técnico</th>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                       <th key={day} className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">{day}</th>
                    ))}
                    <th className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Total</th>
                    <th className="px-4 py-5 text-right text-[10px] font-black text-amber-600 uppercase tracking-widest">Prom/Día</th>
                    <th className="px-4 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {weeklyDetailByTech.length > 0 ? (
                    weeklyDetailByTech.map((t, i) => {
                      const detailPct = metaConfig.metaProduccionDia > 0 ? (t.avgPerDay / metaConfig.metaProduccionDia) : 0;
                      return (
                        <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-center text-[11px] font-black text-slate-300">{i + 1}</td>
                          <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px]">{t.name}</td>
                          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                            const val = t.dayPts?.[dow] || 0;
                            return (
                              <td key={dow} className="px-4 py-4 text-right">
                                <div className={`inline-flex items-center justify-center min-w-[36px] h-8 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, metaConfig.metaProduccionDia || 40) : 'text-indigo-50/20'}`}>
                                  {val > 0 ? fmtPts(val) : '—'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 text-right font-black text-emerald-600">{fmtPts(t.total)}</td>
                          <td className="px-6 py-4 text-right font-black text-amber-600">{fmtPts(t.avgPerDay)}</td>
                          <td className="px-6 py-4 text-center">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${detailPct >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50/20 text-slate-600'}`}>
                                {Math.round(detailPct * 100)}%
                              </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="px-6 py-20 text-center text-indigo-200 font-black uppercase tracking-widest text-[10px]">
                        No hay datos para la semana seleccionada
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3.X RENDIMIENTO DIARIO (ÚLTIMAS 3 SEMANAS) ═══════════════════════ */}
        {threeWeekDataByTech.targetWeeks.length > 0 && threeWeekDataByTech.techs.length > 0 && (
          <section className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-orange-50 rounded-2xl border border-orange-100">
                <Thermometer className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Consistencia 3 Semanas</h2>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Multi-Week Stability Analysis</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-50/20">
                    <th className="px-4 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest w-16">#</th>
                    <th className="px-4 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest min-w-[200px]">Técnico</th>
                    {threeWeekDataByTech.targetWeeks.map((wk, i) => {
                      const maxWks = threeWeekDataByTech.targetWeeks.length;
                      const label = i === maxWks - 1 ? 'Actual' : i === maxWks - 2 ? '-1 Sem' : '-2 Sem';
                      return (
                        <th key={wk} className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">
                          {label}
                          <div className="text-[9px] font-bold text-slate-300">{wk}</div>
                        </th>
                      );
                    })}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global</th>
                    <th className="px-6 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {threeWeekDataByTech.techs.map((t, i) => {
                    const tMetaPct = metaConfig.metaProduccionDia > 0 ? (t.globalAvg / metaConfig.metaProduccionDia) : 0;
                    return (
                      <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-center text-[11px] font-black text-slate-300">{i + 1}</td>
                        <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px]">{t.name}</td>
                        {threeWeekDataByTech.targetWeeks.map(wk => {
                          const val = t.weekStats[wk]?.avg || 0;
                          const days = t.weekStats[wk]?.days || 0;
                          return (
                            <td key={wk} className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <div className={`inline-flex items-center justify-center min-w-[36px] h-8 px-2 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, metaConfig.metaProduccionDia || 40) : 'text-indigo-50/20'}`}>
                                  {val > 0 ? fmtPts(val) : '—'}
                                </div>
                                {days > 0 && <span className="text-[8px] font-black text-slate-300 mt-1 uppercase tracking-tighter">{days}d</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 text-right font-black text-emerald-600">{fmtPts(t.globalAvg)}</td>
                        <td className="px-6 py-4 text-center">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black ${tMetaPct >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {Math.round(tMetaPct * 100)}%
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3e. DESGLOSE POR TIPO DE ACTIVIDAD ═══════════════════════ */}
        {weeklyData.length > 0 && weeklyActivityByTech.activityTypes.length > 0 && (
          <section id="section-activity" className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-100">
                <Layers className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Mix de Actividades</h2>
                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Activity Type Distribution Matrix</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/50 border-b border-indigo-50/20">
                    <th className="px-6 py-5 text-center text-[10px] font-black text-indigo-200 uppercase tracking-widest w-16">#</th>
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest min-w-[200px]">Técnico</th>
                    {weeklyActivityByTech.activityTypes.map(at => (
                      <th key={at} className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest" title={at}>
                        {at.length > 12 ? at.substring(0, 10) + '..' : at}
                      </th>
                    ))}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/20">
                  {weeklyActivityByTech.techs.map((t, i) => (
                    <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-center text-[11px] font-black text-slate-300">{i + 1}</td>
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px]">{t.name}</td>
                      {weeklyActivityByTech.activityTypes.map(at => {
                        const val = t.byType[at]?.pts || 0;
                        const count = t.byType[at]?.count || 0;
                        const maxForType = Math.max(...weeklyActivityByTech.techs.map(tt => tt.byType[at]?.pts || 0), 1);
                        return (
                          <td key={at} className="px-4 py-4 text-right">
                            <div className="flex flex-col items-end">
                              <div className={`inline-flex items-center justify-center min-w-[36px] h-8 px-2 rounded-lg text-[10px] font-black transition-all ${val > 0 ? `bg-purple-100 text-purple-700 border border-purple-200/50` : 'text-indigo-50/20'}`}>
                                {val > 0 ? fmtPts(val) : '—'}
                              </div>
                              {count > 0 && <span className="text-[8px] font-black text-slate-300 mt-1 uppercase tracking-tighter">{count} órd</span>}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right font-black text-emerald-600 font-black">{fmtPts(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3f. PRODUCCIÓN POR CLIENTE Y PROYECTO ═══════════════════════ */}
        {/* ═══════════════════════ 3f. PRODUCCIÓN POR CLIENTE Y PROYECTO ═══════════════════════ */}
        {clientProjects.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-cyan-50 border border-cyan-100 flex items-center justify-center shadow-sm">
                <BarChart3 className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Distribución por Cliente</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Client & Project Analysis</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">{clientProjects.length} Clientes Activos</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {clientProjects.map((cp, idx) => (
                <div key={`${cp.cliente}-${cp.proyecto}`} className="bg-white/60 backdrop-blur-xl border border-indigo-100/50 rounded-[2.5rem] shadow-xl shadow-slate-200/30 overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
                    <div>
                      <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">{cp.proyecto || 'General'}</div>
                      <div className="text-lg font-black text-slate-800">{cp.cliente}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-600 leading-none">{fmtPts(cp.pts)}</div>
                      <div className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Puntos Totales</div>
                    </div>
                  </div>
                  
                  <div className="p-8 space-y-6 flex-1">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-50/20/50">
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Prom/Día</div>
                        <div className="text-sm font-black text-amber-600">{fmtPts(cp.avgPerDay)}</div>
                      </div>
                      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-50/20/50">
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Órdenes</div>
                        <div className="text-sm font-black text-blue-600">{cp.orders}</div>
                      </div>
                      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-50/20/50">
                        <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Técnicos</div>
                        <div className="text-sm font-black text-purple-600">{cp.techs}</div>
                      </div>
                    </div>

                    {/* Weekly trend simplified */}
                    {Object.keys(cp.weeklyMap).length > 0 && (
                      <div className="space-y-3">
                         <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Tendencia Semanal</div>
                         <div className="flex gap-1.5 items-end h-16 bg-indigo-50/30 rounded-2xl p-4">
                            {Object.entries(cp.weeklyMap).sort(([a],[b]) => a.localeCompare(b)).map(([wk, wd]) => {
                              const maxWk = Math.max(...Object.values(cp.weeklyMap).map(w => w.pts), 1);
                              const h = Math.max(10, (wd.pts / maxWk) * 100);
                              return (
                                <div key={wk} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                                  <div className="w-full bg-cyan-200/50 rounded-t-md group-hover:bg-cyan-400 transition-all cursor-pointer" style={{ height: `${h}%` }} />
                                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none font-black">
                                    {fmtPts(wd.pts)}
                                  </div>
                                </div>
                              );
                            })}
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3g. ALTAS VS REPARACIONES POR CLIENTE ═══════════════════════ */}
        {/* ═══════════════════════ 3g. ALTAS VS REPARACIONES POR CLIENTE ═══════════════════════ */}
        {clientProjects.length > 0 && clientProjects.some(cp => Object.keys(cp.byTipoTrabajo || {}).length > 0) && (
          <section className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-orange-50 border border-orange-100 flex items-center justify-center shadow-sm">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Especialidades por Cliente</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Job Type Distribution</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Altas vs Reparaciones</span>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-xl border border-indigo-100/50 rounded-[2.5rem] shadow-2xl shadow-indigo-100/30 overflow-hidden">
              <div className="overflow-x-auto">
                {(() => {
                  const allTypes = new Set();
                  clientProjects.forEach(cp => { if (cp.byTipoTrabajo) Object.keys(cp.byTipoTrabajo).forEach(t => allTypes.add(t)); });
                  const types = [...allTypes].sort();
                  if (types.length === 0) return <div className="px-6 py-20 text-center text-indigo-200 font-black uppercase tracking-widest text-[10px]">Sin datos de tipo de trabajo</div>;
                  return (
                    <table className="w-full text-sm border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-indigo-50/50">
                          <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest border-b border-indigo-50/20">Cliente / Proyecto</th>
                          {types.map(t => (
                            <th key={t} className="px-4 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest border-b border-indigo-50/20" title={t}>
                              {t.length > 15 ? t.substring(0, 13) + '..' : t}
                            </th>
                          ))}
                          <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-indigo-50/20">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {clientProjects.map((cp, i) => (
                          <tr key={`${cp.cliente}-${cp.proyecto}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-black text-slate-800 uppercase text-[11px]">{cp.cliente}</div>
                              {cp.proyecto && <div className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider">{cp.proyecto}</div>}
                            </td>
                            {types.map(t => {
                              const val = cp.byTipoTrabajo?.[t]?.pts || 0;
                              const ord = cp.byTipoTrabajo?.[t]?.orders || 0;
                              return (
                                <td key={t} className="px-4 py-4 text-right">
                                   <div className="flex flex-col items-end">
                                      <div className={`inline-flex items-center justify-center min-w-[36px] h-8 px-2 rounded-lg text-[10px] font-black transition-all ${val > 0 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'text-indigo-50/20'}`}>
                                        {val > 0 ? fmtPts(val) : '—'}
                                      </div>
                                      {ord > 0 && <span className="text-[8px] font-black text-indigo-200 mt-0.5 uppercase tracking-tighter">{ord} órd</span>}
                                   </div>
                                </td>
                              );
                            })}
                            <td className="px-6 py-4 text-right font-black text-emerald-600">{fmtPts(cp.pts)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 4. MAPAS DE CALOR POR MACRO-ZONA ═══════════════════════ */}
        <section id="section-zones" className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <MapPin className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Análisis Geográfico</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Regional Performance Heatmaps</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
              <div key={zoneName} className="bg-indigo-50/30 border border-indigo-50/20/50 rounded-[2rem] overflow-hidden flex flex-col transition-all hover:shadow-xl hover:shadow-indigo-100/30">
                <div className="px-6 py-5 border-b border-indigo-50/20/50 flex items-center justify-between bg-white/40">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{zoneName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600">{fmtPts(zoneData.totalPts)} pts</span>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-3 gap-3">
                  {zoneData.cities.map((city) => (
                    <div
                      key={city.name}
                      className={`${greenScale(city.pts, zoneData.maxPts)} rounded-xl p-3 border border-transparent transition-all hover:scale-[1.02] cursor-default`}
                    >
                      <div className="text-[9px] font-black uppercase tracking-tight truncate opacity-80" title={city.name}>
                        {city.name}
                      </div>
                      <div className="text-xs font-black mt-1 leading-none">{fmtPts(city.pts)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ 5. PRODUCCIÓN POR ACTIVIDAD LPU ═══════════════════════ */}
        <section className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Desglose LPU</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Catalog Activity Audit Matrix</p>
            </div>
            {metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 && (
              <div className="ml-auto bg-slate-50 border border-indigo-50/20 rounded-2xl px-5 py-3 flex items-center gap-4">
                 <div>
                    <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Meta Mensual</div>
                    <div className="text-sm font-black text-slate-800">{fmtPts(metaConfig.metaProduccionMes * headerStats.uniqueTechs)}</div>
                 </div>
                 <div className="w-px h-8 bg-slate-200"></div>
                 <div className={`text-xs font-black p-2 rounded-lg ${headerStats.totalPts >= (metaConfig.metaProduccionMes * headerStats.uniqueTechs) ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50/20 text-slate-600'}`}>
                    {Math.round((headerStats.totalPts / (metaConfig.metaProduccionMes * headerStats.uniqueTechs)) * 100)}%
                 </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-[2rem] border border-indigo-50/20 shadow-inner bg-indigo-50/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/50 border-b border-indigo-50/20">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Descripción LPU</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-200 uppercase tracking-widest">Código</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Cant</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-indigo-200 uppercase tracking-widest">Ptas/U</th>
                  <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Pts Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-50/20">
                {lpuData.length > 0 ? (
                  lpuData.map((act) => (
                    <tr key={act.desc} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-[11px] truncate max-w-sm" title={act.desc}>{act.desc}</td>
                      <td className="px-6 py-4 font-black text-slate-300 uppercase text-[10px] tracking-widest">{act.code}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-600">{act.count.toLocaleString('es-CL')}</td>
                      <td className="px-6 py-4 text-right font-black text-indigo-200">{fmtPts(act.avgPtsPerUnit)}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600">{fmtPts(act.totalPts)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Sin actividades LPU</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════════════════ 6. CALENDARIO DE PRODUCCIÓN ═══════════════════════ */}
        <section id="section-calendar" className="bg-white/80 backdrop-blur-xl border border-indigo-100/50 shadow-2xl shadow-indigo-100/30 rounded-3xl p-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
              <Calendar className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Calendario Operativo</h2>
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">Daily Volume Distribution Mapping</p>
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-50/20/50 rounded-[2.5rem] overflow-hidden">
            <div className="flex items-center justify-between px-8 py-5 bg-white/50 border-b border-indigo-50/20">
              <button onClick={() => navCalMonth(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-200 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{monthNames[calMonth.month]} {calMonth.year}</h3>
              <button onClick={() => navCalMonth(1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-200 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-8 gap-3 mb-4">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Sem'].map((d) => (
                  <div key={d} className="text-center text-[9px] font-black text-indigo-200 uppercase tracking-widest">{d}</div>
                ))}
              </div>
              {(() => {
                const weeks = [];
                for (let i = 0; i < calendarGrid.length; i += 7) weeks.push(calendarGrid.slice(i, i + 7));
                return weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-8 gap-3 mb-3">
                    {week.map((day, dayIdx) => {
                      if (day === null) return <div key={`blank-${dayIdx}`} className="aspect-square rounded-2xl bg-white/20 border border-indigo-50/20 shadow-inner" />;
                      const dayData = calendarData[day];
                      const hasPts = dayData && dayData.pts > 0;
                      const isSelected = calSelectedDay === day;
                      return (
                        <div key={day} onClick={() => hasPts && setCalSelectedDay(isSelected ? null : day)}
                          className={`aspect-square rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer group
                            ${hasPts ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-sm shadow-emerald-100/30' : 'bg-white border-slate-50 text-slate-200'}
                            ${isSelected ? 'ring-4 ring-indigo-200 scale-95 border-indigo-500 bg-indigo-600 text-white shadow-xl' : 'hover:scale-105 hover:shadow-md'}
                          `}
                        >
                          <span className="text-[11px] font-black">{day}</span>
                          {hasPts && !isSelected && <div className="text-[8px] font-black mt-1 opacity-60">{fmtPts(dayData.pts)}</div>}
                        </div>
                      );
                    })}
                    <div className="aspect-square rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-lg shadow-slate-200 border border-slate-800">
                      <div className="text-[9px] font-black tracking-tight">{calWeeklyTotals[weekIdx] ? fmtPts(calWeeklyTotals[weekIdx].pts) : '0'}</div>
                      <div className="text-[6px] font-black opacity-50 uppercase mt-0.5">PTS</div>
                    </div>
                  </div>
                ));
              })()}

              <div className="mt-8 flex items-center justify-between bg-white border border-indigo-50/20 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100"><Calendar className="w-5 h-5 text-emerald-600" /></div>
                   <div>
                      <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Total Mensual</div>
                      <div className="text-xl font-black text-slate-900">{fmtPts(calMonthTotal.pts)} <span className="text-xs text-slate-300">pts</span></div>
                   </div>
                </div>
                {metaConfig.metaProduccionMes > 0 && (
                   <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-indigo-200 uppercase">Progreso Meta</div>
                        <div className="text-sm font-black text-slate-800">{Math.round((calMonthTotal.pts / (metaConfig.metaProduccionMes * headerStats.uniqueTechs)) * 100)}%</div>
                      </div>
                      <div className="w-24 h-2 bg-indigo-50/20 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (calMonthTotal.pts / (metaConfig.metaProduccionMes * headerStats.uniqueTechs)) * 100)}%` }} />
                      </div>
                   </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 7. EXPORTAR ═══════════════════════ */}
        <section className="pb-12">
          <div className="flex items-center justify-center">
            <button
              onClick={exportToExcel}
              className="group flex items-center gap-3 px-8 py-4 bg-emerald-600 rounded-[1.5rem] text-sm font-black text-white uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 hover:scale-[1.02] active:scale-95"
            >
              <Download className="w-5 h-5 group-hover:animate-bounce" />
              Generar Auditoría Excel
            </button>
          </div>
        </section>
      </div>

      {/* ═══════════════════════ PRESENTATION MODE OVERLAY (Vibrant Executive Revamp) ═══════════════════════ */}
      {presentationMode && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in fade-in zoom-in-95 duration-700 overflow-hidden">
          {/* Executive Background Glows */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse pointer-events-none"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[150px] animate-pulse pointer-events-none" style={{ animationDelay: '3s' }}></div>
          
          {/* Persistent Sidebar/Indicator */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
            {PRESENTATION_SECTIONS.map((s, idx) => (
              <div 
                key={s.id}
                className={`w-1.5 transition-all duration-500 rounded-full ${presentationStep === idx ? 'h-12 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'h-3 bg-white/10'}`}
              />
            ))}
          </div>

          {/* Premium Toolbar */}
          <div className="relative z-10 flex items-center justify-between px-12 py-8 bg-slate-900/40 backdrop-blur-3xl border-b border-white/5 mx-6 mt-6 rounded-[2.5rem] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30 transform rotate-3">
                 <div className="text-3xl text-white drop-shadow-lg">{PRESENTATION_SECTIONS[presentationStep]?.icon}</div>
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{PRESENTATION_SECTIONS[presentationStep]?.title}</h2>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10 uppercase italic">
                      <span className="text-[10px] font-black text-indigo-400">SLIDE</span>
                      <span className="text-[10px] font-black text-white">{presentationStep + 1} / {PRESENTATION_SECTIONS.length}</span>
                   </div>
                   <div className="h-1 w-1 rounded-full bg-white/20"></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{empresaNombre}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="w-80 group">
                <MultiSearchableSelect
                  icon={UsersIcon}
                  options={availableClientes.map(c => ({ label: c.nombre, value: c._id }))}
                  value={selectedClientes}
                  onChange={setSelectedClientes}
                  placeholder="FILTRAR AUDIENCIA..."
                  className="premium-dark-select"
                />
              </div>

              <div className="h-10 w-px bg-white/10"></div>

              <button 
                onClick={closePresentation} 
                className="group flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-200 rounded-2xl border border-white/10 hover:border-rose-500/30 transition-all duration-300 font-black text-[10px] uppercase tracking-[0.2em]"
              >
                <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                <span>Finalizar</span>
              </button>
            </div>
          </div>

          {/* Slide Content Area */}
          <div className="relative flex-1 overflow-y-auto custom-scrollbar p-12">
            <div className="max-w-[1500px] mx-auto w-full animate-in slide-in-from-bottom-8 fade-in duration-700">
              
              {/* SLIDE: RANKING (Executive Table Version) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'ranking' && (
                <div className="space-y-10">
                  <div className="grid grid-cols-4 gap-8">
                    <StatCard icon={Hash} label="Órdenes" value={headerStats.totalOrders.toLocaleString('es-CL')} color="blue" dark={true} />
                    <StatCard icon={Zap} label="Pts Totales" value={fmtPts(headerStats.totalPts)} color="emerald" dark={true} />
                    <StatCard icon={TrendingUp} label="Prom/Día" value={fmtPts(headerStats.avgPtsPerTechPerDay)} color="purple" dark={true} />
                    <StatCard icon={Users} label="Líderes" value={headerStats.uniqueTechs} color="amber" dark={true} />
                  </div>

                  {/* Elite Ranking Table */}
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-8 py-8 text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] w-24">Pos</th>
                            <th className="px-8 py-8 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Técnico Especialista</th>
                            <th className="px-8 py-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Puntos</th>
                            <th className="px-8 py-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Órdenes</th>
                            <th className="px-8 py-8 text-right text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Eficiencia</th>
                            {metaConfig.metaProduccionDia > 0 && <th className="px-8 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Vs Meta</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {sortedTechRanking.map((tech, i) => {
                            const isTop3 = i < 3;
                            return (
                              <tr key={tech.name} className="group hover:bg-white/[0.03] transition-colors">
                                <td className="px-8 py-8 text-center">
                                  {isTop3 ? (
                                    <span className="text-3xl drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">{['🥇','🥈','🥉'][i]}</span>
                                  ) : (
                                    <span className="text-xs font-black text-slate-600 tracking-widest">{ (i+1).toString().padStart(2, '0') }</span>
                                  )}
                                </td>
                                <td className="px-8 py-8">
                                  <div className="flex flex-col">
                                    <span className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{tech.name}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                      {tech.cliente} {tech.proyecto ? `| ${tech.proyecto}` : ''}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-8 py-8 text-right">
                                  <span className="text-2xl font-black text-emerald-400 tracking-tighter">{fmtPts(tech.ptsTotal)}</span>
                                </td>
                                <td className="px-8 py-8 text-right">
                                  <span className="text-xl font-black text-white/80">{tech.orders}</span>
                                </td>
                                <td className="px-8 py-8 text-right">
                                  <span className="text-xl font-black text-indigo-400">{fmtPts(tech.avgPerDay)}</span>
                                  <span className="text-[9px] font-black text-slate-500 block">PTS / DÍA</span>
                                </td>
                                {metaConfig.metaProduccionDia > 0 && (
                                  <td className="px-8 py-8 text-right">
                                    <MetaBadge pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} />
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

              {/* SLIDE: WEEKLY GLOBAL (Executive Table) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-global' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                          <th className="px-10 py-8 text-left text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em]">Intervalo Semanal</th>
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                            <th key={d} className="px-6 py-8 text-right text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{d}</th>
                          ))}
                          <th className="px-10 py-8 text-right text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Total Pts</th>
                          <th className="px-10 py-8 text-right text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Avg/Téc</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {weeklyData.map((w) => {
                          const avgPerTech = w.techsCount > 0 ? (w.pts / w.techsCount) : 0;
                          return (
                            <tr key={w.key} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-10 py-7">
                                <span className="font-black text-white text-base uppercase tracking-tight group-hover:text-indigo-400">Semana {w.week}</span>
                                <p className="text-[10px] font-bold text-slate-200 uppercase tracking-widest mt-1">{w.range}</p>
                              </td>
                              {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                                const val = w.dayPts?.[dow] || 0;
                                return (
                                  <td key={dow} className="px-6 py-7 text-right">
                                    <span className={`font-black text-xs tabular-nums ${val > 0 ? 'text-indigo-200' : 'text-slate-800'}`}>
                                      {val > 0 ? fmtPts(val) : '—'}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-10 py-7 text-right font-black text-emerald-400 text-xl tabular-nums tracking-tighter uppercase">{fmtPts(w.pts)}</td>
                              <td className="px-10 py-7 text-right">
                                 <div className="flex flex-col items-end gap-1.5">
                                    <span className="font-black text-indigo-400 text-sm tabular-nums">{fmtPts(avgPerTech)}</span>
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

              {/* SLIDE: WEEKLY TECH RANKING */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-tech' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-10 py-8 text-left text-[10px] font-black text-indigo-300 uppercase tracking-widest">Recurso Humano</th>
                            {weeklyData.map(w => (
                              <th key={w.key} className="px-6 py-8 text-right text-[10px] font-black text-slate-200 uppercase tracking-widest">S{w.week}</th>
                            ))}
                            <th className="px-10 py-8 text-right text-[10px] font-black text-emerald-400 uppercase tracking-widest">Acumulado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weeklyByTech.map((t) => (
                            <tr key={t.name} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-10 py-6 font-black text-white text-[12px] uppercase tracking-tighter group-hover:text-indigo-300">{t.name}</td>
                              {weeklyData.map(w => {
                                const val = t.weekPts[w.key]?.pts || 0;
                                return (
                                  <td key={w.key} className="px-6 py-6 text-right font-black text-indigo-200 text-xs tabular-nums">
                                    {val > 0 ? fmtPts(val) : '—'}
                                  </td>
                                );
                              })}
                              <td className="px-10 py-6 text-right font-black text-emerald-400 text-lg tabular-nums tracking-tighter">{fmtPts(t.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE: WEEKLY DETAIL (Day by Day) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-detail' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-3xl">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                          <Calendar className="w-8 h-8 text-indigo-400" />
                       </div>
                       <div className="space-y-1">
                          <span className="text-lg font-black text-white uppercase tracking-tight block">Histórico Diario de Producción</span>
                          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.3em]">ANÁLISIS POR SEMANA DE AUDITORÍA</span>
                       </div>
                    </div>
                    <div className="relative group">
                      <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="bg-slate-800/80 border border-white/10 rounded-2xl px-12 py-5 text-xs font-black text-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 appearance-none cursor-pointer hover:bg-slate-700 transition-all shadow-2xl min-w-[340px] uppercase tracking-widest text-center"
                      >
                        {weeklyData.map(w => (
                          <option key={w.key} value={w.key}>SEMANA {String(w.week).padStart(2, '0')} — {w.range}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none group-hover:scale-125 transition-transform" />
                    </div>
                  </div>

                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-8 py-8 text-center text-[10px] font-black text-slate-600 uppercase w-20 tracking-widest">#</th>
                            <th className="px-8 py-8 text-left text-[10px] font-black text-indigo-300 uppercase tracking-widest">Técnico Auditor</th>
                            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, idx) => (
                              <th key={d} className={`px-6 py-8 text-right text-[10px] font-black uppercase tracking-widest ${idx >= 5 ? 'text-orange-400' : 'text-slate-200'}`}>{d}</th>
                            ))}
                            <th className="px-8 py-8 text-right text-[10px] font-black text-emerald-400 uppercase tracking-widest">Semanal</th>
                            <th className="px-8 py-8 text-right text-[10px] font-black text-indigo-400 uppercase tracking-widest">Prom/Día</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weeklyDetailByTech.map((t, i) => (
                            <tr key={t.name} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-8 py-6 text-center">
                                 <span className="text-[10px] font-black text-slate-700 group-hover:text-indigo-400 transition-colors">{(i + 1).toString().padStart(2, '0')}</span>
                              </td>
                              <td className="px-8 py-6 font-black text-white text-[12px] uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{t.name}</td>
                              {[0,1,2,3,4,5,6].map(dow => {
                                const val = t.dayPts?.[dow] || 0;
                                return (
                                  <td key={dow} className="px-6 py-6 text-right">
                                    <span className={`font-black text-xs tabular-nums tracking-tighter ${val > 0 ? 'text-indigo-200' : 'text-slate-800/40'}`}>{val > 0 ? fmtPts(val) : '—'}</span>
                                  </td>
                                );
                              })}
                              <td className="px-8 py-6 text-right font-black text-emerald-400 text-lg tabular-nums tracking-tighter">{fmtPts(t.total)}</td>
                              <td className="px-8 py-6 text-right">
                                 <div className="flex flex-col items-end gap-1.5">
                                    <span className="font-black text-indigo-400 text-xs tabular-nums">{fmtPts(t.avgPerDay)}</span>
                                    <div className="h-0.5 w-10 bg-indigo-500/20 rounded-full">
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

              {/* SLIDE: ACTIVITY MIX */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'activity-type' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-10 py-8 text-left text-[10px] font-black text-indigo-300 uppercase tracking-widest">Especialista</th>
                            {weeklyActivityByTech.activityTypes.map(at => (
                              <th key={at} className="px-8 py-8 text-right text-[10px] font-black text-slate-200 uppercase tracking-widest">{at}</th>
                            ))}
                            <th className="px-10 py-8 text-right text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Semana</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {weeklyActivityByTech.techs.map((t) => (
                            <tr key={t.name} className="hover:bg-white/[0.03] transition-colors group">
                              <td className="px-10 py-6 font-black text-white text-[12px] uppercase group-hover:text-indigo-300">{t.name}</td>
                              {weeklyActivityByTech.activityTypes.map(at => {
                                const val = t.byType[at]?.pts || 0;
                                return (
                                  <td key={at} className="px-8 py-6 text-right font-black text-indigo-200 text-xs tabular-nums">
                                    {val > 0 ? fmtPts(val) : '—'}
                                  </td>
                                );
                              })}
                              <td className="px-10 py-6 text-right font-black text-emerald-400 text-lg tabular-nums tracking-tighter">{fmtPts(t.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE: CLIENT ANALYSIS */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'client-analysis' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {clientProjects.slice(0, 6).map((cp) => (
                      <div key={`${cp.cliente}-${cp.proyecto}`} className="group relative bg-slate-900/30 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden hover:border-indigo-500/30 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2">
                        <div className="p-10 border-b border-white/5 flex items-center justify-between">
                           <div className="space-y-2">
                              <div className="flex items-center gap-4">
                                 <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                 <span className="font-black text-white text-2xl uppercase tracking-tighter">{cp.cliente}</span>
                              </div>
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] pl-6">{cp.proyecto || 'CANAL GENERAL'}</span>
                           </div>
                           <div className="text-right">
                              <div className="text-3xl font-black text-emerald-400 tracking-tighter uppercase tabular-nums">{fmtPts(cp.ptsTotal || cp.pts)} <span className="text-[10px] text-slate-500">PTS</span></div>
                              <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{cp.orders} ÓRDENES</div>
                           </div>
                        </div>

                        <div className="p-10 grid grid-cols-2 gap-8">
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Rendimiento</span>
                              <span className="text-xl font-black text-white">{fmtPts(cp.avgPerDay)} <span className="text-[10px] text-slate-500">AVG</span></span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 text-right">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 block">Provisiones</span>
                              <span className="text-xl font-black text-white">{cp.provisionCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5">
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 block">Reparaciones</span>
                              <span className="text-xl font-black text-white">{cp.repairCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 text-right">
                              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Fza Técnica</span>
                              <span className="text-xl font-black text-white">{cp.techs} TÉCS</span>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SLIDE: CALENDAR (Premium Dark Version) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'calendar' && (
                <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[4rem] p-16 shadow-3xl w-full max-w-6xl">
                    <div className="flex items-end justify-between mb-16 px-4">
                      <div className="space-y-2">
                        <span className="text-sm font-black text-indigo-500 uppercase tracking-[0.4em]">Audit Timeline</span>
                        <h3 className="text-6xl font-black text-white uppercase tracking-tighter">
                          {monthNames[calMonth.month]} <span className="opacity-20">{calMonth.year}</span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-12">
                        <div className="text-right space-y-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga Mensual</span>
                          <div className="text-5xl font-black text-emerald-400 tracking-tighter">{fmtPts(calMonthTotal.pts)}</div>
                        </div>
                        <div className="w-px h-16 bg-white/10"></div>
                        <div className="text-right space-y-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Densidad Órdenes</span>
                          <div className="text-5xl font-black text-white tracking-tighter">{calMonthTotal.orders}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-6">
                      {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
                        <div key={d} className="text-center text-[11px] font-black text-slate-600 uppercase tracking-[0.3em] pb-4">{d}</div>
                      ))}
                      {calendarGrid.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} className="aspect-square opacity-0" />;
                        const dayData = calendarData[day];
                        const hasPts = dayData && dayData.pts > 0;
                        // const intensity = hasPts ? Math.min(100, (dayData.pts / calMaxPts) * 100) : 0; // Not used in this version
                        
                        return (
                          <div 
                            key={day} 
                            className={`aspect-square rounded-3xl border flex flex-col items-center justify-center relative group transition-all duration-300
                              ${hasPts ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/5 border-white/5 opacity-30'}
                            `}
                          >
                            {hasPts && (
                                <div className="absolute inset-0 bg-indigo-500 rounded-3xl blur-2xl opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            )}
                            <span className={`text-2xl font-black ${hasPts ? 'text-white' : 'text-slate-700'}`}>{day}</span>
                            {hasPts && (
                                <div className="text-[10px] font-black text-emerald-400 mt-2 tracking-tighter">{fmtPts(dayData.pts)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SLIDE: ZONES (Executive HeatMap) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'zones-lpu' && (
                <div className="grid grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   {Object.entries(macroZoneData).slice(0, 4).map(([name, data]) => (
                      <div key={name} className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-12 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] relative group hover:scale-[1.02] transition-all duration-500">
                         <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-8">
                            <div className="flex items-center gap-5">
                               <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                                  <MapPin className="w-7 h-7 text-emerald-400" />
                               </div>
                               <div className="space-y-1">
                                  <h4 className="text-3xl font-black text-white uppercase tracking-tighter">{name}</h4>
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Macro Zone Audit</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-4xl font-black text-emerald-400 tracking-tighter uppercase tabular-nums">{fmtPts(data.totalPts)} <span className="text-[10px] text-slate-500/70">PTS</span></div>
                               <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{data.totalOrders} ÓRDENES REGISTRADAS</div>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-8">
                            {data.cities.filter(c => c.pts > 0).slice(0, 6).map(city => (
                               <div key={city.name} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col items-center justify-center hover:bg-white/[0.08] transition-all relative overflow-hidden group/city hover:shadow-2xl hover:scale-105">
                                  <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover/city:opacity-100 transition-opacity"></div>
                                  <span className="text-[10px] font-black text-slate-500 uppercase mb-4 text-center truncate w-full relative z-10 tracking-widest">{city.name}</span>
                                  <span className="text-3xl font-black text-white relative z-10 tabular-nums tracking-tighter">{fmtPts(city.pts)}</span>
                                  <div className="w-10 h-1 bg-emerald-500/20 rounded-full mt-4 group-hover/city:w-20 transition-all duration-500"></div>
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>

          {/* Modern Navigation footer */}
          <div className="flex items-center justify-between px-12 py-8 bg-slate-900/80 backdrop-blur-3xl border-t border-white/5">
            <button
              onClick={prevSlide}
              disabled={presentationStep === 0}
              className={`flex items-center gap-4 px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] shadow-xl ${
                presentationStep === 0
                  ? 'bg-white/5 text-slate-600 cursor-not-allowed border-white/5'
                  : 'bg-indigo-600 text-white hover:bg-indigo-50 border border-indigo-400/50 shadow-indigo-500/20 active:scale-95'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            {/* Premium Section indicators */}
            <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 shadow-inner">
              {PRESENTATION_SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setPresentationStep(i)}
                  className={`relative h-2 rounded-full transition-all duration-500 ${
                    i === presentationStep ? 'w-12 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'w-2 bg-white/10 hover:bg-white/30'
                  }`}
                  title={s.title}
                />
              ))}
            </div>

            <button
              onClick={presentationStep === PRESENTATION_SECTIONS.length - 1 ? closePresentation : nextSlide}
              className="flex items-center gap-4 px-8 py-4 bg-emerald-600 text-white border border-emerald-400/50 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
            >
              {presentationStep === PRESENTATION_SECTIONS.length - 1 ? 'Finalizar' : 'Siguiente'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
