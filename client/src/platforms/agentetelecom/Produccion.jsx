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
  CheckCircle2, Thermometer, Grid3X3, Presentation, Maximize2, Minimize2
} from 'lucide-react';

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
const StatCard = ({ icon: Icon, label, value, sub, color = 'emerald' }) => {
  const colors = {
    emerald: 'from-emerald-500/20 to-emerald-700/10 border-emerald-500/30',
    blue: 'from-blue-500/20 to-blue-700/10 border-blue-500/30',
    purple: 'from-purple-500/20 to-purple-700/10 border-purple-500/30',
    amber: 'from-amber-500/20 to-amber-700/10 border-amber-500/30',
  };
  const iconColors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4 backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${iconColors[color]}`} />
        <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MINI STAT CARD (for expanded detail)
// ─────────────────────────────────────────────────────────────
const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-emerald-400" />}
      <span className="text-[10px] text-slate-400 uppercase">{label}</span>
    </div>
    <div className="text-lg font-semibold text-white">{value}</div>
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
      <div className="flex flex-wrap gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-300">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            <span>{s.label}: {s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
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

  // Filters
  const [dateFrom, setDateFrom] = useState(toInputDate(firstDayOfMonth()));
  const [dateTo, setDateTo] = useState(toInputDate(todayUTC()));
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

  // ── Fetch data pre-agregada del server (liviano y rápido) ──
  const fetchData = useCallback(async (desde, hasta, est) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (typeof desde === 'string' && desde.length === 10) params.desde = desde;
      if (typeof hasta === 'string' && hasta.length === 10) params.hasta = hasta;
      if (est) params.estado = est;
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
    fetchTimerRef.current = setTimeout(() => fetchData(dateFrom, dateTo, estadoFilter), 300);
    refreshTimerRef.current = setInterval(() => fetchData(dateFrom, dateTo, estadoFilter), 300000); // 5 min
    return () => {
      clearTimeout(fetchTimerRef.current);
      clearInterval(refreshTimerRef.current);
    };
  }, [fetchData, dateFrom, dateTo, estadoFilter]);

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
    if (!serverData?.stats) return { totalOrders: 0, totalPts: 0, avgPtsPerTechPerDay: 0, uniqueTechs: 0, uniqueDays: 0 };
    // Si no hay filtros locales, usar stats del servidor directamente
    if (!hasLocalFilters) return serverData.stats;
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
    return { totalOrders, totalPts: Math.round(totalPts * 100) / 100, avgPtsPerTechPerDay, uniqueTechs, uniqueDays };
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

  // ── Green scale for heatmaps ──
  const greenScale = (value, max) => {
    if (value === 0 || max === 0) return 'bg-slate-800/50';
    const ratio = value / max;
    if (ratio > 0.8) return 'bg-emerald-600/80';
    if (ratio > 0.6) return 'bg-emerald-600/60';
    if (ratio > 0.4) return 'bg-emerald-500/50';
    if (ratio > 0.2) return 'bg-emerald-500/30';
    return 'bg-emerald-500/15';
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Cargando datos de producción...</p>
        </div>
      </div>
    );
  }

  if (error && !serverData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <X className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 text-lg">{error}</p>
          <button onClick={() => fetchData(dateFrom, dateTo, estadoFilter)} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ═══════════════════════ 1. HEADER ═══════════════════════ */}
      <header className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border-b border-emerald-800/30">
        <div className="max-w-[1600px] mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-emerald-400" />
              <div>
                <h1 className="text-2xl font-bold text-white">Producción TOA</h1>
                <p className="text-sm text-slate-400">Panel de producción y baremo - Agente Telecom</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastRefresh && (
                <span className="text-xs text-slate-500">
                  Última actualización: {lastRefresh.toLocaleTimeString('es-CL')}
                </span>
              )}
              <button
                onClick={() => fetchData(dateFrom, dateTo, estadoFilter)}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={CheckCircle2}
              label={`\u{1F4CB} Órdenes Completadas`}
              value={headerStats.totalOrders.toLocaleString('es-CL')}
              color="emerald"
            />
            <StatCard
              icon={Zap}
              label={`\u{26A1} Total Puntos Baremo`}
              value={fmtPts(headerStats.totalPts)}
              sub={metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0
                ? `Meta equipo: ${fmtPts(metaConfig.metaProduccionMes * headerStats.uniqueTechs)} pts/mes ${perfEmoji(Math.round((headerStats.totalPts / (metaConfig.metaProduccionMes * headerStats.uniqueTechs)) * 100))}`
                : undefined}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label={`\u{1F4C8} Prom Pts/Téc/Día`}
              value={`${fmtPts(headerStats.avgPtsPerTechPerDay)} ${metaConfig.metaProduccionDia > 0 ? perfEmoji(Math.round((headerStats.avgPtsPerTechPerDay / metaConfig.metaProduccionDia) * 100)) : ''}`}
              sub={metaConfig.metaProduccionDia > 0
                ? `Req: ${fmtPts(metaConfig.metaProduccionDia)} pts/día (${Math.round((headerStats.avgPtsPerTechPerDay / metaConfig.metaProduccionDia) * 100)}%)`
                : `${headerStats.uniqueTechs} técnicos \u00D7 ${headerStats.uniqueDays} días`}
              color="purple"
            />
            <StatCard
              icon={Users}
              label={`\u{1F465} Técnicos Activos`}
              value={headerStats.uniqueTechs.toLocaleString('es-CL')}
              sub={soloVinculados ? '\u{1F517} Solo vinculados' : undefined}
              color="amber"
            />
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-8">
        {/* ═══════════════════════ 2. FILTERS BAR ═══════════════════════ */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-slate-300">Filtros</span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {/* Date range */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Quick date buttons */}
            <div className="flex gap-1.5">
              {[
                { key: 'today', label: 'Hoy' },
                { key: 'yesterday', label: 'Ayer' },
                { key: 'last7', label: 'Últ 7 días' },
                { key: 'last30', label: 'Últ 30 días' },
                { key: 'thisMonth', label: 'Este mes' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setQuickDate(btn.key)}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300 hover:bg-emerald-900/40 hover:border-emerald-600/40 transition"
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tipo</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="todos">Todos</option>
                <option value="provision">Provisión</option>
                <option value="reparacion">Reparación</option>
              </select>
            </div>

            {/* Estado filter */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Estado</label>
              <select
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Completado">Completado</option>
                <option value="todos">Todos los estados</option>
                {(serverData?.estados || []).filter(e => e.estado !== 'Completado').map(e => (
                  <option key={e.estado} value={e.estado}>{e.estado} ({e.count.toLocaleString('es-CL')})</option>
                ))}
              </select>
            </div>

            {/* Solo vinculados toggle */}
            <div className="flex items-end">
              <button
                onClick={() => setSoloVinculados(!soloVinculados)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition ${
                  soloVinculados
                    ? 'bg-cyan-700/30 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Mostrar solo técnicos vinculados a la empresa"
              >
                <Users className="w-4 h-4" />
                <span>Vinculados</span>
                {soloVinculados && serverData?.tecnicos && (
                  <span className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-xs font-medium">
                    {serverData.tecnicos.filter(t => t.isVinculado).length}
                  </span>
                )}
              </button>
            </div>

            {/* Search technician */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-slate-400 mb-1">Buscar Técnico</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchTech}
                  onChange={(e) => setSearchTech(e.target.value)}
                  placeholder="Nombre del técnico..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                {searchTech && (
                  <button
                    onClick={() => setSearchTech('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active filter summary */}
          <div className="mt-3 text-xs text-slate-500">
            Mostrando {(headerStats.totalOrders || 0).toLocaleString('es-CL')} órdenes
            {estadoFilter !== 'todos' ? ` ${estadoFilter}` : ' (todos los estados)'}
            {typeFilter !== 'todos' && ` — ${typeFilter === 'provision' ? 'Provisión' : 'Reparación'}`}
            {soloVinculados && ' — Solo vinculados'}
            {searchTech && ` — técnico: "${searchTech}"`}
          </div>
        </section>

        {/* ═══════════════════════ 3. RANKING TÉCNICOS ═══════════════════════ */}
        <section id="section-ranking">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Ranking de Técnicos</h2>
            <span className="text-xs text-slate-500 ml-2">({sortedTechRanking.length} técnicos)</span>
            <button
              onClick={openPresentation}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-purple-700/30 border border-purple-600/30 rounded-lg text-xs text-purple-300 hover:bg-purple-600/40 transition"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Presentación
            </button>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    {[
                      { key: null, label: '#', className: 'w-10 text-center' },
                      { key: 'name', label: 'Técnico', className: 'text-left' },
                      { key: 'cliente', label: 'Cliente / Proyecto', className: 'text-left' },
                      { key: 'activeDays', label: 'Días Activos' },
                      { key: 'orders', label: 'Órdenes' },
                      { key: 'ptsBase', label: 'Pts Base' },
                      { key: 'ptsDeco', label: 'Pts Deco' },
                      { key: 'ptsRepetidor', label: 'Pts Repetidor' },
                      { key: 'ptsTelefono', label: 'Pts Teléfono' },
                      { key: 'ptsTotal', label: 'Pts Total' },
                      { key: 'avgPerDay', label: metaConfig.metaProduccionDia > 0 ? `Prom/Día (req: ${fmtPts(metaConfig.metaProduccionDia)})` : 'Prom/Día' },
                      ...(metaConfig.metaProduccionDia > 0 ? [{ key: null, label: 'vs Meta', className: 'text-center' }] : []),
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-3 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider ${col.className || 'text-right'} ${col.key ? 'cursor-pointer hover:text-emerald-400 select-none' : ''}`}
                        onClick={col.key ? () => techToggle(col.key) : undefined}
                      >
                        {col.label}
                        {col.key && techSortIcon(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTechRanking.map((tech, idx) => {
                    const rank = idx + 1;
                    const medal = rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : rank === 3 ? '\u{1F949}' : `${rank}`;
                    const isExpanded = expandedTech === tech.name;
                    const techMetaPct = metaConfig.metaProduccionDia > 0 ? (tech.avgPerDay / metaConfig.metaProduccionDia) : 0;
                    const techPerf = metaConfig.metaProduccionDia > 0 ? perfEmoji(Math.round(techMetaPct * 100)) : '';

                    return (
                      <React.Fragment key={tech.name}>
                        <tr
                          className={`border-b border-slate-800/50 cursor-pointer transition ${
                            isExpanded ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'
                          } ${rank <= 3 ? 'bg-emerald-950/10' : ''}`}
                          onClick={() => setExpandedTech(isExpanded ? null : tech.name)}
                        >
                          <td className="px-3 py-2.5 text-center font-medium">
                            {rank <= 3 ? <span className="text-lg">{medal}</span> : <span className="text-slate-500">{medal}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-left font-medium text-slate-200">
                            {tech.name} {techPerf && <span className="ml-1">{techPerf}</span>}
                            <ChevronDown className={`w-3.5 h-3.5 inline ml-2 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </td>
                          <td className="px-3 py-2.5 text-left text-xs text-slate-400 max-w-[150px] truncate" title={`${tech.cliente || ''}${tech.proyecto ? ' | ' + tech.proyecto : ''}`}>
                            {tech.cliente ? <><span className="text-cyan-400">{tech.cliente}</span>{tech.proyecto && <span className="text-slate-500"> | {tech.proyecto}</span>}</> : <span className="text-slate-600">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{tech.activeDays}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{tech.orders.toLocaleString('es-CL')}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsBase)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsDeco)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsRepetidor)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsTelefono)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">{fmtPts(tech.ptsTotal)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.avgPerDay)}</td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <MetaBadge pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                <MetaGap pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                              </div>
                            </td>
                          )}
                        </tr>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={metaConfig.metaProduccionDia > 0 ? 12 : 11} className="p-0">
                              <div className="bg-slate-850 border-t border-b border-emerald-800/20 p-5 space-y-5" style={{ background: 'rgba(15,23,42,0.8)' }}>
                                {/* Mini stat cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <MiniStat icon={Hash} label="Total Órdenes" value={tech.orders.toLocaleString('es-CL')} />
                                  <MiniStat icon={Zap} label="Pts Total" value={fmtPts(tech.ptsTotal)} />
                                  <MiniStat icon={Calendar} label="Días Activos" value={tech.activeDays} />
                                  <MiniStat icon={TrendingUp} label="Prom/Día" value={fmtPts(tech.avgPerDay)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                                  {/* Weekly evolution */}
                                  <div className="md:col-span-1">
                                    <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Producción Semanal</h4>
                                    <div className="bg-slate-800/50 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                      <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-slate-800">
                                          <tr>
                                            <th className="px-2 py-1.5 text-left text-slate-400">Sem</th>
                                            <th className="px-2 py-1.5 text-right text-slate-400">Días</th>
                                            <th className="px-2 py-1.5 text-right text-slate-400">Órd</th>
                                            <th className="px-2 py-1.5 text-right text-slate-400">Pts</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {getWeeklyForTech(tech).map(w => (
                                            <tr key={w.key} className="border-t border-slate-700/30">
                                              <td className="px-2 py-1">
                                                <span className="bg-emerald-600/20 text-emerald-400 px-1 py-0.5 rounded text-[10px] font-mono font-bold">S{String(w.week).padStart(2, '0')}</span>
                                              </td>
                                              <td className="px-2 py-1 text-right text-slate-400">{w.daysCount}</td>
                                              <td className="px-2 py-1 text-right text-slate-400">{w.orders}</td>
                                              <td className="px-2 py-1 text-right text-emerald-400">{fmtPts(w.pts)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Daily evolution */}
                                  <div className="md:col-span-1">
                                    <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Evolución Diaria</h4>
                                    <div className="bg-slate-800/50 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                                      <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-slate-800">
                                          <tr>
                                            <th className="px-2 py-1.5 text-left text-slate-400">Día</th>
                                            <th className="px-2 py-1.5 text-right text-slate-400">Órd</th>
                                            <th className="px-2 py-1.5 text-right text-slate-400">Pts</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {Object.entries(tech.dailyMap)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([day, data]) => (
                                              <tr key={day} className="border-t border-slate-700/30">
                                                <td className="px-2 py-1 text-slate-300">{day}</td>
                                                <td className="px-2 py-1 text-right text-slate-400">{data.orders}</td>
                                                <td className="px-2 py-1 text-right text-emerald-400">{fmtPts(data.pts)}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Top 5 activities */}
                                  <div className="md:col-span-1">
                                    <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Top 5 Actividades (LPU)</h4>
                                    <div className="space-y-2">
                                      {Object.entries(tech.activities)
                                        .sort(([, a], [, b]) => b.pts - a.pts)
                                        .slice(0, 5)
                                        .map(([name, data]) => (
                                          <div key={name} className="bg-slate-800/50 rounded-lg p-2">
                                            <div className="text-xs text-slate-300 truncate" title={name}>{name}</div>
                                            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                              <span>{data.count} órdenes</span>
                                              <span className="text-emerald-400 font-medium">{fmtPts(data.pts)} pts</span>
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>

                                  {/* Composition bar */}
                                  <div className="md:col-span-1">
                                    <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Composición de Puntos</h4>
                                    <div className="bg-slate-800/50 rounded-lg p-3">
                                      <CompositionBar
                                        base={tech.ptsBase}
                                        deco={tech.ptsDeco}
                                        repetidor={tech.ptsRepetidor}
                                        telefono={tech.ptsTelefono}
                                      />
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
                    <tr className="bg-slate-800/70 border-t-2 border-emerald-600/30 font-semibold">
                      <td className="px-3 py-3 text-center text-emerald-400">
                        <Target className="w-4 h-4 inline" />
                      </td>
                      <td className="px-3 py-3 text-left text-emerald-400">TOTALES</td>
                      <td className="px-3 py-3 text-right text-slate-300">
                        {/* avg active days */}
                        {sortedTechRanking.length > 0
                          ? (sortedTechRanking.reduce((s, t) => s + t.activeDays, 0) / sortedTechRanking.length).toFixed(1)
                          : 0}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {sortedTechRanking.reduce((s, t) => s + t.orders, 0).toLocaleString('es-CL')}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsBase, 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsDeco, 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsRepetidor, 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsTelefono, 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-emerald-400">
                        {fmtPts(sortedTechRanking.reduce((s, t) => s + t.ptsTotal, 0))}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        {fmtPts(
                          sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)
                        )}
                      </td>
                      {metaConfig.metaProduccionDia > 0 && (
                        <td className="px-3 py-3 text-center">
                          <MetaBadge
                            pts={sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)}
                            meta={metaConfig.metaProduccionDia}
                            label="Promedio vs Meta"
                          />
                          <MetaGap pts={sortedTechRanking.reduce((s, t) => s + t.avgPerDay, 0) / (sortedTechRanking.length || 1)} meta={metaConfig.metaProduccionDia} compact />
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

        {/* ═══════════════════════ 3b. RESUMEN SEMANAL GLOBAL ═══════════════════════ */}
        {weeklyData.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Producción por Semana</h2>
              <span className="text-xs text-slate-500 ml-2">({weeklyData.length} semanas)</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase">Semana</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase">Rango</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Lun</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Mar</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Mié</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Jue</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Vie</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-orange-400/70 uppercase">Sáb</th>
                      <th className="px-2 py-3 text-right text-xs font-medium text-orange-400/70 uppercase">Dom</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Órdenes</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Técnicos</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Pts Total</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Prom/Día</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-amber-400 uppercase" title="Promedio: Total pts ÷ Técnicos que produjeron">
                        {metaConfig.metaProduccionSemana > 0 ? `Prom/Téc (req: ${fmtPts(metaConfig.metaProduccionSemana)})` : 'Prom/Téc'}
                      </th>
                      {metaConfig.metaProduccionSemana > 0 && (
                        <th className="px-3 py-3 text-right text-xs font-medium text-cyan-400 uppercase" title="vs Meta semanal">vs Meta</th>
                      )}
                      <th className="px-3 py-3 text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 150 }}>Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxPts = Math.max(...weeklyData.map(w => w.pts), 1);
                      const maxDayPts = Math.max(...weeklyData.flatMap(w => Object.values(w.dayPts || {})), 1);
                      // Meta por día de la semana: total meta = metaDia * techsCount (producción esperada del equipo ese día)
                      return weeklyData.map((w, i) => {
                        const avgPerTech = w.techsCount > 0 ? Math.round((w.pts / w.techsCount) * 100) / 100 : 0;
                        const weekMetaPct = metaConfig.metaProduccionSemana > 0 ? Math.round((avgPerTech / metaConfig.metaProduccionSemana) * 100) : 0;
                        return (
                        <tr key={w.key} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} hover:bg-slate-800/30 transition`}>
                          <td className="px-3 py-2.5">
                            <span className="bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded text-xs font-mono font-bold">S{String(w.week).padStart(2, '0')}</span>
                            {metaConfig.metaProduccionSemana > 0 && <span className="ml-1 text-[10px]">{perfEmoji(weekMetaPct)}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 text-xs whitespace-nowrap">{w.range}</td>
                          {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                            const val = w.dayPts?.[dow] || 0;
                            // Semáforo: comparar total del día vs meta equipo (metaDia * techsCount)
                            const dayTeamMeta = metaConfig.metaProduccionDia > 0 ? metaConfig.metaProduccionDia * w.techsCount : 0;
                            const useSemaforo = dayTeamMeta > 0 && val > 0;
                            const cellStyle = useSemaforo
                              ? semaforoColor(val, dayTeamMeta)
                              : (val > 0 ? { background: `rgba(16,185,129,${Math.max(0.15, val / maxDayPts) * 0.4})` } : {});
                            return (
                              <td key={dow} className="px-2 py-2.5 text-right text-xs" style={cellStyle}>
                                <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>
                                  {val > 0 ? fmtPts(Math.round(val * 100) / 100) : '\u2014'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 text-right text-slate-200 font-medium">{w.orders.toLocaleString('es-CL')}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{w.techsCount}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold">{fmtPts(w.pts)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(w.avgPerDay)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-400 font-medium">{fmtPts(avgPerTech)}</td>
                          {metaConfig.metaProduccionSemana > 0 && (
                            <td className="px-3 py-2.5 text-right">
                              <MetaBadge pts={avgPerTech} meta={metaConfig.metaProduccionSemana} label="Meta semanal" />
                              <MetaGap pts={avgPerTech} meta={metaConfig.metaProduccionSemana} compact />
                            </td>
                          )}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all" style={{ width: `${(w.pts / maxPts) * 100}%` }} />
                              </div>
                              <span className="text-[10px] text-slate-500 w-8 text-right">{Math.round((w.pts / maxPts) * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                  {weeklyData.length > 1 && (
                    <tfoot>
                      <tr className="bg-slate-800/70 border-t-2 border-emerald-600/30 font-semibold">
                        <td className="px-3 py-3 text-emerald-400">TOTAL</td>
                        <td className="px-3 py-3 text-slate-400 text-xs">{weeklyData.length} sem</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                          const total = weeklyData.reduce((s, w) => s + (w.dayPts?.[dow] || 0), 0);
                          return <td key={dow} className="px-2 py-3 text-right text-xs text-slate-300">{total > 0 ? fmtPts(Math.round(total * 100) / 100) : '—'}</td>;
                        })}
                        <td className="px-3 py-3 text-right text-slate-200">{weeklyData.reduce((s, w) => s + w.orders, 0).toLocaleString('es-CL')}</td>
                        <td className="px-3 py-3 text-right text-slate-300">—</td>
                        <td className="px-3 py-3 text-right text-emerald-400">{fmtPts(weeklyData.reduce((s, w) => s + w.pts, 0))}</td>
                        <td className="px-3 py-3 text-right text-slate-300">
                          {fmtPts(weeklyData.reduce((s, w) => s + w.pts, 0) / Math.max(weeklyData.reduce((s, w) => s + w.daysCount, 0), 1))}
                        </td>
                        <td className="px-3 py-3 text-right text-amber-400">
                          {(() => {
                            const totalPtsAll = weeklyData.reduce((s, w) => s + w.pts, 0);
                            const avgTechs = weeklyData.reduce((s, w) => s + w.techsCount, 0) / weeklyData.length;
                            return avgTechs > 0 ? fmtPts(Math.round((totalPtsAll / weeklyData.length / avgTechs) * 100) / 100) : '—';
                          })()}
                        </td>
                        {metaConfig.metaProduccionSemana > 0 && <td className="px-3 py-3" />}
                        <td className="px-3 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3c. PRODUCCIÓN SEMANAL POR TÉCNICO ═══════════════════════ */}
        {weeklyData.length > 0 && weeklyByTech.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Producción Semanal por Técnico</h2>
              <span className="text-xs text-slate-500 ml-2">({weeklyByTech.length} técnicos × {weeklyData.length} semanas)</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase w-8">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 200 }}>Técnico</th>
                      {weeklyData.map(w => (
                        <th key={w.key} className="px-3 py-3 text-right text-xs font-medium text-cyan-400 uppercase whitespace-nowrap">
                          S{String(w.week).padStart(2, '0')}
                          <div className="text-[9px] text-slate-500 font-normal">{w.range}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Órdenes</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-amber-400 uppercase" title="Promedio por día">
                        {metaConfig.metaProduccionDia > 0 ? `Prom/Día (req: ${fmtPts(metaConfig.metaProduccionDia)})` : 'Prom/Día'}
                      </th>
                      {metaConfig.metaProduccionDia > 0 && (
                        <th className="px-3 py-3 text-right text-xs font-medium text-cyan-400 uppercase" title="vs Meta diaria">vs Meta</th>
                      )}
                      <th className="px-3 py-3 text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 120 }}>Progreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const maxTotal = Math.max(...weeklyByTech.map(t => t.total), 1);
                      const maxCell = Math.max(...weeklyByTech.flatMap(t => weeklyData.map(w => t.weekPts[w.key]?.pts || 0)), 1);
                      return weeklyByTech.map((t, i) => {
                        const tMetaPct = metaConfig.metaProduccionDia > 0 ? Math.round((t.avgPerDay / metaConfig.metaProduccionDia) * 100) : 0;
                        return (
                        <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} hover:bg-slate-800/30 transition`}>
                          <td className="px-3 py-2 text-center text-xs text-slate-500">
                            {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                          </td>
                          <td className="px-3 py-2 text-left text-slate-200 text-xs font-medium truncate max-w-[200px]" title={t.name}>
                            {t.name} {metaConfig.metaProduccionDia > 0 && <span className="ml-1">{perfEmoji(tMetaPct)}</span>}
                          </td>
                          {weeklyData.map(w => {
                            const val = t.weekPts[w.key]?.pts || 0;
                            const cellStyle = metaConfig.metaProduccionSemana > 0 && val > 0
                              ? semaforoColor(val, metaConfig.metaProduccionSemana)
                              : (val > 0 ? { background: `rgba(16,185,129,${Math.max(0.15, val / maxCell) * 0.4})` } : {});
                            return (
                              <td key={w.key} className="px-3 py-2 text-right text-xs" style={cellStyle}>
                                <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '\u2014'}</span>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right text-emerald-400 font-semibold text-xs">{fmtPts(t.total)}</td>
                          <td className="px-3 py-2 text-right text-slate-300 text-xs">{t.orders.toLocaleString('es-CL')}</td>
                          <td className="px-3 py-2 text-right text-amber-400 text-xs font-medium">{fmtPts(t.avgPerDay)}</td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-3 py-2 text-right">
                              <MetaBadge pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                              <MetaGap pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full" style={{ width: `${(t.total / maxTotal) * 100}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                        );
                      });
                    })()}
                  </tbody>
                  {weeklyByTech.length > 1 && (
                    <tfoot>
                      <tr className="bg-slate-800/70 border-t-2 border-emerald-600/30 font-semibold">
                        <td className="px-3 py-3 text-center"><Target className="w-3.5 h-3.5 inline text-emerald-400" /></td>
                        <td className="px-3 py-3 text-left text-emerald-400 text-xs">TOTALES / PROMEDIO</td>
                        {weeklyData.map(w => {
                          const total = weeklyByTech.reduce((s, t) => s + (t.weekPts[w.key]?.pts || 0), 0);
                          return <td key={w.key} className="px-3 py-3 text-right text-emerald-400 text-xs font-semibold">{fmtPts(Math.round(total * 100) / 100)}</td>;
                        })}
                        <td className="px-3 py-3 text-right text-emerald-400 text-xs font-bold">{fmtPts(weeklyByTech.reduce((s, t) => s + t.total, 0))}</td>
                        <td className="px-3 py-3 text-right text-slate-200 text-xs">{weeklyByTech.reduce((s, t) => s + t.orders, 0).toLocaleString('es-CL')}</td>
                        <td className="px-3 py-3 text-right text-amber-400 text-xs">
                          {fmtPts(Math.round((weeklyByTech.reduce((s, t) => s + t.avgPerDay, 0) / weeklyByTech.length) * 100) / 100)}
                        </td>
                        {metaConfig.metaProduccionDia > 0 && <td className="px-3 py-3" />}
                        <td className="px-3 py-3" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3d. DETALLE SEMANAL: TÉCNICO × DÍA ═══════════════════════ */}
        {weeklyData.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Grid3X3 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Detalle Semanal — Técnicos por Día</h2>
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-slate-400">Semana:</label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {weeklyData.map(w => (
                    <option key={w.key} value={w.key}>S{String(w.week).padStart(2, '0')} — {w.range}</option>
                  ))}
                </select>
              </div>
            </div>

            {weeklyDetailByTech.length > 0 ? (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-800/50">
                        <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase w-8">#</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 200 }}>Técnico</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Lun</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Mar</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Mié</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Jue</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-cyan-400 uppercase">Vie</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-orange-400/70 uppercase">Sáb</th>
                        <th className="px-2 py-3 text-right text-xs font-medium text-orange-400/70 uppercase">Dom</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Total</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase">Órd</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-amber-400 uppercase" title="Promedio por día trabajado">
                          {metaConfig.metaProduccionDia > 0 ? `Prom/Día (req: ${fmtPts(metaConfig.metaProduccionDia)})` : 'Prom/Día'}
                        </th>
                        {metaConfig.metaProduccionDia > 0 && (
                          <th className="px-3 py-3 text-right text-xs font-medium text-cyan-400 uppercase">vs Meta</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        return weeklyDetailByTech.map((t, i) => {
                          const detailPct = metaConfig.metaProduccionDia > 0 ? Math.round((t.avgPerDay / metaConfig.metaProduccionDia) * 100) : 0;
                          return (
                          <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} hover:bg-slate-800/30 transition`}>
                            <td className="px-3 py-2 text-center text-xs text-slate-500">
                              {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                            </td>
                            <td className="px-3 py-2 text-left text-slate-200 text-xs font-medium truncate max-w-[200px]" title={t.name}>
                              {t.name} {metaConfig.metaProduccionDia > 0 && <span className="ml-1">{perfEmoji(detailPct)}</span>}
                            </td>
                            {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                              const val = t.dayPts?.[dow] || 0;
                              const cellStyle = metaConfig.metaProduccionDia > 0 && val > 0
                                ? semaforoColor(val, metaConfig.metaProduccionDia)
                                : (val > 0 ? { background: `rgba(16,185,129,${Math.max(0.15, val / 10) * 0.4})` } : {});
                              return (
                                <td key={dow} className="px-2 py-2 text-right text-xs" style={cellStyle}>
                                  <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>
                                    {val > 0 ? fmtPts(Math.round(val * 100) / 100) : '\u2014'}
                                  </span>
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-right text-emerald-400 font-semibold text-xs">{fmtPts(t.total)}</td>
                            <td className="px-3 py-2 text-right text-slate-300 text-xs">{t.orders}</td>
                            <td className="px-3 py-2 text-right text-amber-400 text-xs font-medium">{fmtPts(t.avgPerDay)}</td>
                            {metaConfig.metaProduccionDia > 0 && (
                              <td className="px-3 py-2 text-right">
                                <MetaBadge pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                <MetaGap pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                              </td>
                            )}
                          </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800/70 border-t-2 border-emerald-600/30 font-semibold">
                        <td className="px-3 py-3 text-center"><Target className="w-3.5 h-3.5 inline text-emerald-400" /></td>
                        <td className="px-3 py-3 text-left text-emerald-400 text-xs">TOTAL / PROMEDIO</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                          const total = weeklyDetailByTech.reduce((s, t) => s + (t.dayPts?.[dow] || 0), 0);
                          return <td key={dow} className="px-2 py-3 text-right text-xs text-slate-300">{total > 0 ? fmtPts(Math.round(total * 100) / 100) : '—'}</td>;
                        })}
                        <td className="px-3 py-3 text-right text-emerald-400 text-xs font-bold">{fmtPts(weeklyDetailByTech.reduce((s, t) => s + t.total, 0))}</td>
                        <td className="px-3 py-3 text-right text-slate-200 text-xs">{weeklyDetailByTech.reduce((s, t) => s + t.orders, 0)}</td>
                        <td className="px-3 py-3 text-right text-amber-400 text-xs font-bold">
                          {weeklyDetailByTech.length > 0
                            ? fmtPts(Math.round((weeklyDetailByTech.reduce((s, t) => s + t.total, 0) / weeklyDetailByTech.length) * 100) / 100)
                            : '—'}
                        </td>
                        {metaConfig.metaProduccionDia > 0 && (
                          <td className="px-3 py-3 text-right">
                            {weeklyDetailByTech.length > 0 && (
                              <>
                                <MetaBadge
                                  pts={weeklyDetailByTech.reduce((s, t) => s + t.avgPerDay, 0) / weeklyDetailByTech.length}
                                  meta={metaConfig.metaProduccionDia}
                                  label="Promedio vs Meta"
                                />
                                <MetaGap pts={weeklyDetailByTech.reduce((s, t) => s + t.avgPerDay, 0) / weeklyDetailByTech.length} meta={metaConfig.metaProduccionDia} compact />
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Meta reference bar */}
                {metaConfig.metaProduccionDia > 0 && (
                  <div className="px-4 py-3 bg-slate-800/30 border-t border-slate-700/30 flex items-center gap-4 text-xs text-slate-400">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Meta configurada:</span>
                    <span className="text-cyan-300 font-bold">{fmtPts(metaConfig.metaProduccionDia)} pts/día</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-cyan-300 font-bold">{fmtPts(metaConfig.metaProduccionSemana)} pts/sem</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-cyan-300 font-bold">{fmtPts(metaConfig.metaProduccionMes)} pts/mes</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50" /> {'\u2265'}100%
                      <span className="inline-block w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50" /> {'\u2265'}80%
                      <span className="inline-block w-3 h-3 rounded bg-orange-500/30 border border-orange-500/50" /> {'\u2265'}50%
                      <span className="inline-block w-3 h-3 rounded bg-red-500/30 border border-red-500/50" /> {'<'}50%
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No hay datos para la semana seleccionada
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════ 3.X RENDIMIENTO DIARIO (ÚLTIMAS 3 SEMANAS) ═══════════════════════ */}
        {threeWeekDataByTech.targetWeeks.length > 0 && threeWeekDataByTech.techs.length > 0 && (
          <section id="section-3-week-avg">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Thermometer className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Rendimiento Diario (Últimas 3 Semanas)</h2>
              <span className="text-xs text-slate-500">({threeWeekDataByTech.techs.length} técnicos con actividad)</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase w-8">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 180 }}>Técnico</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase" title="Meta Diaria Configurada">Meta Diaria</th>
                      {threeWeekDataByTech.targetWeeks.map((wk, i) => {
                        const maxWks = threeWeekDataByTech.targetWeeks.length;
                        const label = i === maxWks - 1 ? 'Actual' : i === maxWks - 2 ? '-1 Semana' : '-2 Semanas';
                        return (
                          <th key={wk} className="px-2 py-3 text-right text-xs font-medium text-orange-400 uppercase" title={`Semana ISO: ${wk}`}>
                            {label}
                            <div className="text-[9px] text-slate-500 font-normal">{wk}</div>
                          </th>
                        );
                      })}
                      <th className="px-3 py-3 text-right text-xs font-medium text-emerald-400 uppercase">Prom. 3 Sem</th>
                      {metaConfig.metaProduccionDia > 0 && (
                        <th className="px-3 py-3 text-center text-xs font-medium text-cyan-400 uppercase">vs Meta</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {threeWeekDataByTech.techs.map((t, i) => {
                      const tMetaPct = metaConfig.metaProduccionDia > 0 ? Math.round((t.globalAvg / metaConfig.metaProduccionDia) * 100) : 0;
                      return (
                        <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} hover:bg-slate-800/30 transition`}>
                          <td className="px-3 py-2 text-center text-xs text-slate-500">
                            {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                          </td>
                          <td className="px-3 py-2 text-left text-slate-200 text-xs font-medium truncate max-w-[180px]" title={t.name}>
                            {t.name} {metaConfig.metaProduccionDia > 0 && <span className="ml-1">{perfEmoji(tMetaPct)}</span>}
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400 font-medium text-xs">
                            {metaConfig.metaProduccionDia > 0 ? fmtPts(metaConfig.metaProduccionDia) : '—'}
                          </td>
                          {threeWeekDataByTech.targetWeeks.map(wk => {
                            const val = t.weekStats[wk]?.avg || 0;
                            const days = t.weekStats[wk]?.days || 0;
                            const cellStyle = metaConfig.metaProduccionDia > 0 && val > 0
                              ? semaforoColor(val, metaConfig.metaProduccionDia)
                              : (val > 0 ? { background: `rgba(16,185,129,0.15)` } : {});
                            return (
                              <td key={wk} className="px-2 py-2 text-right text-xs" style={cellStyle}>
                                <div className="flex flex-col items-end">
                                  <span className={val > 0 ? 'text-slate-200 font-medium' : 'text-slate-600'} title={val > 0 ? `${fmtPts(val)} pts/día prom.` : ''}>
                                    {val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}
                                  </span>
                                  {days > 0 && <span className="text-[10px] text-slate-500 leading-none mt-0.5" title={`${days} días activos`}>{days} d</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right text-emerald-400 font-bold text-xs">
                            {fmtPts(Math.round(t.globalAvg * 100) / 100)}
                          </td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-3 py-2 text-center">
                              <MetaGap pts={t.globalAvg} meta={metaConfig.metaProduccionDia} compact />
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3e. DESGLOSE POR TIPO DE ACTIVIDAD ═══════════════════════ */}
        {weeklyData.length > 0 && weeklyActivityByTech.activityTypes.length > 0 && (
          <section id="section-activity-type">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Layers className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Desglose por Tipo de Actividad — Semana {selectedWeek}</h2>
              <span className="text-xs text-slate-500">({weeklyActivityByTech.activityTypes.length} tipos)</span>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase w-8">#</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase" style={{ minWidth: 180 }}>Técnico</th>
                      {weeklyActivityByTech.activityTypes.map(at => (
                        <th key={at} className="px-2 py-3 text-right text-xs font-medium text-purple-400 uppercase" title={at} style={{ minWidth: 70 }}>
                          {at.length > 18 ? at.substring(0, 16) + '…' : at}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right text-xs font-medium text-emerald-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyActivityByTech.techs.map((t, i) => (
                      <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} hover:bg-slate-800/30 transition`}>
                        <td className="px-3 py-2 text-center text-xs text-slate-500">
                          {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                        </td>
                        <td className="px-3 py-2 text-left text-slate-200 text-xs font-medium truncate max-w-[180px]" title={t.name}>
                          {t.name}
                        </td>
                        {weeklyActivityByTech.activityTypes.map(at => {
                          const val = t.byType[at]?.pts || 0;
                          const count = t.byType[at]?.count || 0;
                          const maxForType = Math.max(...weeklyActivityByTech.techs.map(tt => tt.byType[at]?.pts || 0), 1);
                          const intensity = val > 0 ? Math.max(0.15, (val / maxForType) * 0.6) : 0;
                          return (
                            <td key={at} className="px-2 py-2 text-right text-xs" style={val > 0 ? { background: `rgba(168,85,247,${intensity})` } : {}}>
                              <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'} title={val > 0 ? `${count} órd · ${fmtPts(val)} pts` : ''}>
                                {val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right text-emerald-400 font-semibold text-xs">{fmtPts(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/70 border-t-2 border-purple-600/30 font-semibold">
                      <td className="px-3 py-3 text-center"><Target className="w-3.5 h-3.5 inline text-purple-400" /></td>
                      <td className="px-3 py-3 text-left text-purple-400 text-xs">TOTAL</td>
                      {weeklyActivityByTech.activityTypes.map(at => {
                        const colTotal = weeklyActivityByTech.techs.reduce((s, t) => s + (t.byType[at]?.pts || 0), 0);
                        const colCount = weeklyActivityByTech.techs.reduce((s, t) => s + (t.byType[at]?.count || 0), 0);
                        return (
                          <td key={at} className="px-2 py-3 text-right text-xs text-slate-300" title={`${colCount} órd`}>
                            {colTotal > 0 ? fmtPts(Math.round(colTotal * 100) / 100) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right text-emerald-400 text-xs font-bold">
                        {fmtPts(weeklyActivityByTech.techs.reduce((s, t) => s + t.total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3f. PRODUCCIÓN POR CLIENTE Y PROYECTO ═══════════════════════ */}
        {clientProjects.length > 0 && (
          <section id="section-client-project">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">Producción por Cliente y Proyecto</h2>
              <span className="text-xs text-slate-500">({clientProjects.length} clientes)</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {clientProjects.map((cp, idx) => (
                <div key={`${cp.cliente}-${cp.proyecto}`} className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-cyan-300 text-sm">{cp.cliente}</span>
                      {cp.proyecto && <span className="text-slate-400 text-xs ml-2">| {cp.proyecto}</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400">
                      <span className="text-emerald-400 font-bold">{fmtPts(cp.pts)} pts</span>
                      <span>{cp.orders} órd</span>
                      <span>{cp.techs} téc</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Prom/Día</div>
                        <div className="text-sm font-bold text-amber-400">{fmtPts(cp.avgPerDay)}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Provisión</div>
                        <div className="text-sm font-bold text-blue-400">{cp.provisionCount}</div>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">Reparación</div>
                        <div className="text-sm font-bold text-orange-400">{cp.repairCount}</div>
                      </div>
                    </div>
                    {/* Weekly trend */}
                    {Object.keys(cp.weeklyMap).length > 0 && (
                      <div className="flex gap-1 items-end h-12">
                        {Object.entries(cp.weeklyMap).sort(([a],[b]) => a.localeCompare(b)).map(([wk, wd]) => {
                          const maxWk = Math.max(...Object.values(cp.weeklyMap).map(w => w.pts), 1);
                          const h = Math.max(4, (wd.pts / maxWk) * 48);
                          return (
                            <div key={wk} className="flex-1 flex flex-col items-center gap-0.5" title={`${wk}: ${fmtPts(wd.pts)} pts`}>
                              <div className="w-full bg-cyan-500/60 rounded-t" style={{ height: `${h}px` }} />
                              <span className="text-[7px] text-slate-600">{wk.split('-S')[1]}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════ 3g. ALTAS VS REPARACIONES POR CLIENTE ═══════════════════════ */}
        {clientProjects.length > 0 && clientProjects.some(cp => Object.keys(cp.byTipoTrabajo || {}).length > 0) && (
          <section id="section-client-types">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-semibold text-white">Tipos de Trabajo por Cliente</h2>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                {(() => {
                  const allTypes = new Set();
                  clientProjects.forEach(cp => { if (cp.byTipoTrabajo) Object.keys(cp.byTipoTrabajo).forEach(t => allTypes.add(t)); });
                  const types = [...allTypes].sort();
                  if (types.length === 0) return <div className="p-6 text-center text-slate-500">Sin datos de tipo de trabajo</div>;
                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-800/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                          {types.map(t => (
                            <th key={t} className="px-3 py-3 text-right text-xs font-medium text-orange-400 uppercase" title={t}>
                              {t.length > 15 ? t.substring(0, 13) + '…' : t}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right text-xs font-medium text-emerald-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientProjects.map((cp, i) => (
                          <tr key={`${cp.cliente}-${cp.proyecto}`} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                            <td className="px-4 py-2.5 text-left text-xs">
                              <span className="text-cyan-300 font-medium">{cp.cliente}</span>
                              {cp.proyecto && <span className="text-slate-500 ml-1">| {cp.proyecto}</span>}
                            </td>
                            {types.map(t => {
                              const val = cp.byTipoTrabajo?.[t]?.pts || 0;
                              const ord = cp.byTipoTrabajo?.[t]?.orders || 0;
                              return (
                                <td key={t} className="px-3 py-2.5 text-right text-xs" title={`${ord} órd`}>
                                  <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold text-xs">{fmtPts(cp.pts)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-800/70 border-t-2 border-orange-600/30 font-semibold">
                          <td className="px-4 py-3 text-left text-orange-400 text-xs">TOTAL</td>
                          {types.map(t => {
                            const total = clientProjects.reduce((s, cp) => s + (cp.byTipoTrabajo?.[t]?.pts || 0), 0);
                            return <td key={t} className="px-3 py-3 text-right text-xs text-slate-300">{total > 0 ? fmtPts(Math.round(total * 100) / 100) : '—'}</td>;
                          })}
                          <td className="px-4 py-3 text-right text-emerald-400 text-xs font-bold">{fmtPts(clientProjects.reduce((s, cp) => s + cp.pts, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* ═══════════════════════ 4. MAPAS DE CALOR POR MACRO-ZONA ═══════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Mapas de Calor por Macro-Zona</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
              <div key={zoneName} className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                {/* Zone header */}
                <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200">{zoneName}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{fmtPts(zoneData.totalPts)} pts</span>
                    <span>{zoneData.totalOrders.toLocaleString('es-CL')} órd</span>
                  </div>
                </div>

                {/* City grid */}
                <div className="p-3 grid grid-cols-3 gap-2">
                  {zoneData.cities.map((city) => (
                    <div
                      key={city.name}
                      className={`${greenScale(city.pts, zoneData.maxPts)} rounded-lg p-2 border border-slate-700/30 transition`}
                    >
                      <div className="text-[10px] text-slate-300 font-medium truncate" title={city.name}>
                        {city.name}
                      </div>
                      <div className="text-xs text-emerald-400 font-semibold">{fmtPts(city.pts)}</div>
                      <div className="text-[10px] text-slate-500">{city.orders} órd</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════ 5. PRODUCCIÓN POR ACTIVIDAD LPU ═══════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Producción por Actividad LPU</h2>
            <span className="text-xs text-slate-500 ml-2">({lpuData.length} actividades)</span>
            {metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 && (
              <span className="ml-auto text-xs text-slate-400">
                Meta equipo/mes: <span className="text-cyan-300 font-bold">{fmtPts(metaConfig.metaProduccionMes * headerStats.uniqueTechs)} pts</span>
                {' '}<MetaBadge pts={headerStats.totalPts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} label="vs Meta mensual" />
                {' '}<MetaGap pts={headerStats.totalPts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} />
              </span>
            )}
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Actividad LPU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Pts/Unidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Pts Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lpuData.map((act, idx) => (
                    <tr key={act.desc} className={`border-b border-slate-800/50 ${idx % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                      <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate" title={act.desc}>{act.desc}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{act.code}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{act.count.toLocaleString('es-CL')}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300">{fmtPts(act.avgPtsPerUnit)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold">{fmtPts(act.totalPts)}</td>
                    </tr>
                  ))}
                </tbody>
                {lpuData.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800/70 border-t-2 border-emerald-600/30 font-semibold">
                      <td className="px-4 py-3 text-emerald-400" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {lpuData.reduce((s, a) => s + a.count, 0).toLocaleString('es-CL')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">—</td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        {fmtPts(lpuData.reduce((s, a) => s + a.totalPts, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {lpuData.length === 0 && (
              <div className="text-center py-10 text-slate-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No hay actividades LPU con los filtros actuales
              </div>
            )}
          </div>
        </section>

        {/* ═══════════════════════ 6. CALENDARIO DE PRODUCCIÓN ═══════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Calendario de Producción</h2>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
              <button
                onClick={() => navCalMonth(-1)}
                className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-semibold text-slate-200">
                {monthNames[calMonth.month]} {calMonth.year}
              </h3>
              <button
                onClick={() => navCalMonth(1)}
                className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              {/* Day headers */}
              <div className="grid grid-cols-8 gap-1 mb-1">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Sem'].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {(() => {
                const weeks = [];
                for (let i = 0; i < calendarGrid.length; i += 7) {
                  weeks.push(calendarGrid.slice(i, i + 7));
                }
                return weeks.map((week, weekIdx) => (
                  <div key={weekIdx} className="grid grid-cols-8 gap-1 mb-1">
                    {week.map((day, dayIdx) => {
                      if (day === null) {
                        return <div key={`blank-${dayIdx}`} className="aspect-square rounded-lg" />;
                      }
                      const dayData = calendarData[day];
                      const hasPts = dayData && dayData.pts > 0;
                      const isSelected = calSelectedDay === day;

                      return (
                        <div
                          key={day}
                          onClick={() => hasPts && setCalSelectedDay(isSelected ? null : day)}
                          className={`aspect-square rounded-lg border flex flex-col items-center justify-center transition cursor-pointer
                            ${hasPts ? greenScaleCal(dayData.pts, calMaxPts) : ''}
                            ${isSelected ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-slate-700/30'}
                            ${hasPts ? 'hover:border-emerald-500/50' : 'border-slate-800/30'}
                          `}
                        >
                          <span className={`text-xs font-medium ${hasPts ? 'text-slate-200' : 'text-slate-600'}`}>
                            {day}
                          </span>
                          {hasPts && (
                            <>
                              <span className="text-[9px] text-emerald-400 font-semibold leading-tight">
                                {dayData.pts >= 1000 ? `${(dayData.pts / 1000).toFixed(1)}k` : fmtPts(dayData.pts)}
                              </span>
                              <span className="text-[8px] text-slate-500 leading-tight">
                                {dayData.orders}
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {/* Pad with empty cells if week is shorter */}
                    {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                      <div key={`pad-${i}`} className="aspect-square rounded-lg" />
                    ))}
                    {/* Weekly total */}
                    <div className="aspect-square rounded-lg bg-slate-800/40 border border-slate-700/20 flex flex-col items-center justify-center">
                      <span className="text-[9px] text-emerald-400 font-semibold">
                        {calWeeklyTotals[weekIdx] ? fmtPts(calWeeklyTotals[weekIdx].pts) : '0'}
                      </span>
                      <span className="text-[8px] text-slate-500">
                        {calWeeklyTotals[weekIdx]?.orders || 0} órd
                      </span>
                    </div>
                  </div>
                ));
              })()}

              {/* Monthly totals footer */}
              <div className="mt-3 flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                <span className="text-xs text-slate-400">Total del mes</span>
                <div className="flex gap-4 items-center">
                  <span className="text-sm font-semibold text-emerald-400">{fmtPts(calMonthTotal.pts)} pts</span>
                  <span className="text-sm text-slate-300">{calMonthTotal.orders.toLocaleString('es-CL')} órdenes</span>
                  {metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 && (
                    <span className="text-xs text-slate-400">
                      | Meta equipo: {fmtPts(metaConfig.metaProduccionMes * headerStats.uniqueTechs)} pts
                      <MetaBadge pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} label="Meta mensual equipo" />
                      {' '}<MetaGap pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} />
                    </span>
                  )}
                </div>
              </div>

              {/* Selected day detail */}
              {calSelectedDay && calendarData[calSelectedDay] && (
                <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-emerald-700/30">
                  <h4 className="text-xs font-medium text-emerald-400 mb-2">
                    Detalle: {calSelectedDay} de {monthNames[calMonth.month]} {calMonth.year}
                  </h4>
                  <div className="flex gap-4 mb-2 text-xs text-slate-300">
                    <span>{fmtPts(calendarData[calSelectedDay].pts)} pts totales</span>
                    <span>{calendarData[calSelectedDay].orders} órdenes</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">Top técnicos:</div>
                  <div className="space-y-1">
                    {Object.entries(calendarData[calSelectedDay].techs)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 5)
                      .map(([tech, techPts]) => (
                        <div key={tech} className="flex justify-between text-xs">
                          <span className="text-slate-300 truncate mr-2">{tech}</span>
                          <span className="text-emerald-400 font-medium flex-shrink-0">{fmtPts(techPts)} pts</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════════════════ 7. EXPORTAR ═══════════════════════ */}
        <section>
          <div className="flex items-center justify-end">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700/30 border border-emerald-600/30 rounded-lg text-sm text-emerald-300 hover:bg-emerald-600/40 transition"
            >
              <Download className="w-4 h-4" />
              Exportar Ranking a Excel
            </button>
          </div>
        </section>
      </div>

      {/* ═══════════════════════ PRESENTATION MODE OVERLAY ═══════════════════════ */}
      {presentationMode && (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-lg">{PRESENTATION_SECTIONS[presentationStep]?.icon}</span>
              <h2 className="text-lg font-bold text-white">{PRESENTATION_SECTIONS[presentationStep]?.title}</h2>
              <span className="text-xs text-slate-500 ml-2">
                {presentationStep + 1} / {PRESENTATION_SECTIONS.length}
              </span>
              <span className="ml-4 px-3 py-1 bg-cyan-900/30 border border-cyan-700/30 rounded-full text-xs text-cyan-300 font-medium">
                {empresaNombre}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 mr-2">← → o espacio para navegar · Esc para salir</span>
              <button
                onClick={closePresentation}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title="Cerrar presentación (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content — full width, vertically centered for small content */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-start">
            <div className="w-full">
              {/* Slide: Ranking */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'ranking' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={Hash} label="Órdenes" value={headerStats.totalOrders.toLocaleString('es-CL')} color="blue" />
                    <StatCard icon={Zap} label="Pts Totales" value={fmtPts(headerStats.totalPts)} color="emerald" />
                    <StatCard icon={TrendingUp} label="Prom/Día/Téc" value={fmtPts(headerStats.avgPtsPerTechPerDay)} color="purple" />
                    <StatCard icon={Users} label="Técnicos" value={headerStats.uniqueTechs} color="amber" />
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700/50 bg-slate-800/50">
                            <th className="px-4 py-3.5 text-center text-sm font-medium text-slate-400 uppercase w-10">#</th>
                            <th className="px-4 py-3.5 text-left text-sm font-medium text-slate-400 uppercase">Técnico</th>
                            <th className="px-4 py-3.5 text-left text-sm font-medium text-slate-400 uppercase">Cliente / Proyecto</th>
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-slate-400 uppercase">Días</th>
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-slate-400 uppercase">Órd</th>
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-emerald-400 uppercase">Pts Total</th>
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-amber-400 uppercase">Prom/Día</th>
                            {metaConfig.metaProduccionDia > 0 && <th className="px-4 py-3.5 text-right text-sm font-medium text-cyan-400 uppercase">vs Meta</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTechRanking.map((tech, i) => {
                            const techMetaPct = metaConfig.metaProduccionDia > 0 ? Math.round((tech.avgPerDay / metaConfig.metaProduccionDia) * 100) : 0;
                            const isExp = expandedTech === tech.name;
                            return (
                              <React.Fragment key={tech.name}>
                                <tr className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''} cursor-pointer hover:bg-slate-800/30`}
                                  onClick={() => setExpandedTech(isExp ? null : tech.name)}>
                                  <td className="px-4 py-3 text-center text-sm text-slate-500">
                                    {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                                  </td>
                                  <td className="px-4 py-3 text-left text-slate-200 text-sm font-medium">
                                    {tech.name} {metaConfig.metaProduccionDia > 0 && <span className="ml-1">{perfEmoji(techMetaPct)}</span>}
                                    <ChevronDown className={`w-3.5 h-3.5 inline ml-1 text-slate-500 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                                  </td>
                                  <td className="px-4 py-3 text-left text-sm text-slate-400">
                                    {tech.cliente ? <><span className="text-cyan-400">{tech.cliente}</span>{tech.proyecto && <span className="text-slate-500"> | {tech.proyecto}</span>}</> : '—'}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-400 text-sm">{tech.activeDays}</td>
                                  <td className="px-4 py-3 text-right text-slate-400 text-sm">{tech.orders}</td>
                                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold text-sm">{fmtPts(tech.ptsTotal)}</td>
                                  <td className="px-4 py-3 text-right text-amber-400 text-sm">{fmtPts(tech.avgPerDay)}</td>
                                  {metaConfig.metaProduccionDia > 0 && (
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex flex-col items-end gap-0.5">
                                        <MetaBadge pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                        <MetaGap pts={tech.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                                      </div>
                                    </td>
                                  )}
                                </tr>
                                {isExp && (
                                  <tr>
                                    <td colSpan={metaConfig.metaProduccionDia > 0 ? 8 : 7} className="p-0">
                                      <div className="bg-slate-800/40 p-4 border-t border-emerald-800/20">
                                        <div className="grid grid-cols-4 gap-3 mb-3">
                                          <MiniStat label="Pts Base" value={fmtPts(tech.ptsBase)} icon={Zap} />
                                          <MiniStat label="Pts Deco" value={fmtPts(tech.ptsDeco)} icon={Layers} />
                                          <MiniStat label="Provisión" value={tech.provisionCount} icon={CheckCircle2} />
                                          <MiniStat label="Reparación" value={tech.repairCount} icon={Activity} />
                                        </div>
                                        <CompositionBar base={tech.ptsBase} deco={tech.ptsDeco} repetidor={tech.ptsRepetidor} telefono={tech.ptsTelefono} />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Weekly Global */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-global' && weeklyData.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-800/50">
                          <th className="px-5 py-4 text-left text-sm font-medium text-slate-400 uppercase">Semana</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-cyan-400 uppercase">Lun</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-cyan-400 uppercase">Mar</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-cyan-400 uppercase">Mié</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-cyan-400 uppercase">Jue</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-cyan-400 uppercase">Vie</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-orange-400/70 uppercase">Sáb</th>
                          <th className="px-4 py-4 text-right text-sm font-medium text-orange-400/70 uppercase">Dom</th>
                          <th className="px-5 py-4 text-right text-sm font-medium text-emerald-400 uppercase">Total</th>
                          <th className="px-5 py-4 text-right text-sm font-medium text-amber-400 uppercase">Prom/Téc</th>
                          {metaConfig.metaProduccionSemana > 0 && <th className="px-4 py-4 text-right text-sm font-medium text-red-400 uppercase">vs Meta</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyData.map((w, i) => {
                          const avgPerTech = w.techsCount > 0 ? Math.round((w.pts / w.techsCount) * 100) / 100 : 0;
                          return (
                          <tr key={w.key} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                            <td className="px-5 py-3.5 text-slate-300 text-sm font-medium">S{String(w.week).padStart(2, '0')} — {w.range}</td>
                            {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                              const val = w.dayPts?.[dow] || 0;
                              return (
                                <td key={dow} className="px-4 py-3.5 text-right text-sm" style={val > 0 ? { background: `rgba(16,185,129,${Math.max(0.15, val / Math.max(...Object.values(w.dayPts || {}), 1)) * 0.4})` } : {}}>
                                  <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                </td>
                              );
                            })}
                            <td className="px-5 py-3.5 text-right text-emerald-400 font-semibold text-sm">{fmtPts(w.pts)}</td>
                            <td className="px-5 py-3.5 text-right text-amber-400 text-sm">
                              {w.techsCount > 0 ? fmtPts(avgPerTech) : '—'}
                            </td>
                            {metaConfig.metaProduccionSemana > 0 && (
                              <td className="px-4 py-3.5 text-right">
                                <MetaBadge pts={avgPerTech} meta={metaConfig.metaProduccionSemana} label="Meta semanal" />
                                <MetaGap pts={avgPerTech} meta={metaConfig.metaProduccionSemana} compact />
                              </td>
                            )}
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Slide: Weekly by Tech */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-tech' && weeklyByTech.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-800/50">
                          <th className="px-4 py-3.5 text-center text-sm font-medium text-slate-400 uppercase w-10">#</th>
                          <th className="px-4 py-3.5 text-left text-sm font-medium text-slate-400 uppercase">Técnico</th>
                          {weeklyData.map(w => (
                            <th key={w.key} className="px-3 py-3.5 text-right text-sm font-medium text-cyan-400 uppercase">
                              S{String(w.week).padStart(2, '0')}
                            </th>
                          ))}
                          <th className="px-4 py-3.5 text-right text-sm font-medium text-emerald-400 uppercase">Total</th>
                          <th className="px-4 py-3.5 text-right text-sm font-medium text-amber-400 uppercase">Prom/Día</th>
                          {metaConfig.metaProduccionDia > 0 && <th className="px-4 py-3.5 text-right text-sm font-medium text-red-400 uppercase">vs Meta</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyByTech.map((t, i) => (
                          <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                            <td className="px-4 py-3 text-center text-sm text-slate-500">
                              {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                            </td>
                            <td className="px-4 py-3 text-left text-slate-200 text-sm font-medium">{t.name}</td>
                            {weeklyData.map(w => {
                              const val = t.weekPts[w.key]?.pts || 0;
                              const cellStyle = metaConfig.metaProduccionSemana > 0 && val > 0
                                ? semaforoColor(val, metaConfig.metaProduccionSemana)
                                : {};
                              return (
                                <td key={w.key} className="px-3 py-3 text-right text-sm" style={cellStyle}>
                                  <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right text-emerald-400 font-semibold text-sm">{fmtPts(t.total)}</td>
                            <td className="px-4 py-3 text-right text-amber-400 text-sm">{fmtPts(t.avgPerDay)}</td>
                            {metaConfig.metaProduccionDia > 0 && (
                              <td className="px-4 py-3 text-right">
                                <MetaBadge pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                <MetaGap pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Slide: Weekly Detail by Day */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'weekly-detail' && weeklyDetailByTech.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-400">Semana:</label>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value)}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      {weeklyData.map(w => (
                        <option key={w.key} value={w.key}>S{String(w.week).padStart(2, '0')} — {w.range}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700/50 bg-slate-800/50">
                            <th className="px-4 py-3.5 text-center text-sm font-medium text-slate-400 uppercase w-10">#</th>
                            <th className="px-4 py-3.5 text-left text-sm font-medium text-slate-400 uppercase">Técnico</th>
                            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, idx) => (
                              <th key={d} className={`px-3 py-3.5 text-right text-sm font-medium uppercase ${idx >= 5 ? 'text-orange-400/70' : 'text-cyan-400'}`}>{d}</th>
                            ))}
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-emerald-400 uppercase">Total</th>
                            <th className="px-4 py-3.5 text-right text-sm font-medium text-amber-400 uppercase">Prom/Día</th>
                            {metaConfig.metaProduccionDia > 0 && <th className="px-4 py-3.5 text-right text-sm font-medium text-red-400 uppercase">vs Meta</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyDetailByTech.map((t, i) => (
                            <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                              <td className="px-4 py-3 text-center text-sm text-slate-500">
                                {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                              </td>
                              <td className="px-4 py-3 text-left text-slate-200 text-sm font-medium">{t.name}</td>
                              {[0,1,2,3,4,5,6].map(dow => {
                                const val = t.dayPts?.[dow] || 0;
                                const cellStyle = metaConfig.metaProduccionDia > 0 && val > 0 ? semaforoColor(val, metaConfig.metaProduccionDia) : {};
                                return (
                                  <td key={dow} className="px-3 py-3 text-right text-sm" style={cellStyle}>
                                    <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-right text-emerald-400 font-semibold text-sm">{fmtPts(t.total)}</td>
                              <td className="px-4 py-3 text-right text-amber-400 text-sm">{fmtPts(t.avgPerDay)}</td>
                              {metaConfig.metaProduccionDia > 0 && (
                                <td className="px-4 py-3 text-right">
                                  <MetaBadge pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} label="Meta diaria" />
                                  <MetaGap pts={t.avgPerDay} meta={metaConfig.metaProduccionDia} compact />
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Activity Type Breakdown */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'activity-type' && weeklyActivityByTech.activityTypes.length > 0 && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700/50 bg-slate-800/50">
                          <th className="px-4 py-3.5 text-center text-sm font-medium text-slate-400 uppercase w-10">#</th>
                          <th className="px-4 py-3.5 text-left text-sm font-medium text-slate-400 uppercase">Técnico</th>
                          {weeklyActivityByTech.activityTypes.map(at => (
                            <th key={at} className="px-3 py-3.5 text-right text-sm font-medium text-purple-400 uppercase" title={at}>
                              {at.length > 20 ? at.substring(0, 18) + '…' : at}
                            </th>
                          ))}
                          <th className="px-4 py-3.5 text-right text-sm font-medium text-emerald-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyActivityByTech.techs.map((t, i) => (
                          <tr key={t.name} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                            <td className="px-4 py-3 text-center text-sm text-slate-500">
                              {i < 3 ? ['\u{1F947}','\u{1F948}','\u{1F949}'][i] : i + 1}
                            </td>
                            <td className="px-4 py-3 text-left text-slate-200 text-sm font-medium">{t.name}</td>
                            {weeklyActivityByTech.activityTypes.map(at => {
                              const val = t.byType[at]?.pts || 0;
                              return (
                                <td key={at} className="px-3 py-3 text-right text-sm" style={val > 0 ? { background: `rgba(168,85,247,${Math.max(0.15, (val / Math.max(...weeklyActivityByTech.techs.map(tt => tt.byType[at]?.pts || 0), 1)) * 0.6)})` } : {}}>
                                  <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-right text-emerald-400 font-semibold text-sm">{fmtPts(t.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Slide: Combined Client Analysis (Client/Project + Client Types) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'client-analysis' && clientProjects.length > 0 && (
                <div className="space-y-5">
                  {/* Top: Client cards */}
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-3">Producción por Cliente y Proyecto</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {clientProjects.map((cp) => (
                        <div key={`${cp.cliente}-${cp.proyecto}`} className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                          <div className="bg-slate-800/70 px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-cyan-300 text-sm">{cp.cliente}</span>
                              {cp.proyecto && <span className="text-slate-400 text-xs ml-2">| {cp.proyecto}</span>}
                            </div>
                            <div className="flex gap-3 text-xs text-slate-400">
                              <span className="text-emerald-400 font-bold">{fmtPts(cp.pts)} pts</span>
                              <span>{cp.orders} órd</span>
                              <span>{cp.techs} téc</span>
                            </div>
                          </div>
                          <div className="p-3 grid grid-cols-4 gap-2">
                            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                              <div className="text-[10px] text-slate-500 uppercase">Prom/Día</div>
                              <div className="text-base font-bold text-amber-400">{fmtPts(cp.avgPerDay)}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                              <div className="text-[10px] text-slate-500 uppercase">Provisión</div>
                              <div className="text-base font-bold text-blue-400">{cp.provisionCount}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                              <div className="text-[10px] text-slate-500 uppercase">Reparación</div>
                              <div className="text-base font-bold text-orange-400">{cp.repairCount}</div>
                            </div>
                            <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                              <div className="text-[10px] text-slate-500 uppercase">Días Activos</div>
                              <div className="text-base font-bold text-slate-200">{cp.days}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bottom: Client Types table */}
                  <div>
                    <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">Altas vs Reparaciones por Cliente</h3>
                    <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        {(() => {
                          const allTypes = new Set();
                          clientProjects.forEach(cp => { if (cp.byTipoTrabajo) Object.keys(cp.byTipoTrabajo).forEach(t => allTypes.add(t)); });
                          const types = [...allTypes].sort();
                          if (types.length === 0) return <div className="p-6 text-center text-slate-500 text-sm">Sin datos de tipo de trabajo</div>;
                          return (
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-slate-700/50 bg-slate-800/50">
                                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Cliente</th>
                                  {types.map(t => (
                                    <th key={t} className="px-3 py-3 text-right text-xs font-medium text-orange-400 uppercase" title={t}>
                                      {t.length > 15 ? t.substring(0, 13) + '…' : t}
                                    </th>
                                  ))}
                                  <th className="px-4 py-3 text-right text-xs font-medium text-emerald-400 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {clientProjects.map((cp, i) => (
                                  <tr key={`${cp.cliente}-${cp.proyecto}`} className={`border-b border-slate-800/40 ${i % 2 !== 0 ? 'bg-slate-800/15' : ''}`}>
                                    <td className="px-4 py-2.5 text-left text-xs">
                                      <span className="text-cyan-300 font-medium">{cp.cliente}</span>
                                      {cp.proyecto && <span className="text-slate-500 ml-1">| {cp.proyecto}</span>}
                                    </td>
                                    {types.map(t => {
                                      const val = cp.byTipoTrabajo?.[t]?.pts || 0;
                                      return (
                                        <td key={t} className="px-3 py-2.5 text-right text-xs">
                                          <span className={val > 0 ? 'text-slate-200' : 'text-slate-600'}>{val > 0 ? fmtPts(Math.round(val * 100) / 100) : '—'}</span>
                                        </td>
                                      );
                                    })}
                                    <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold text-xs">{fmtPts(cp.pts)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-800/70 border-t-2 border-orange-600/30 font-semibold">
                                  <td className="px-4 py-2.5 text-left text-orange-400 text-xs">TOTAL</td>
                                  {types.map(t => {
                                    const total = clientProjects.reduce((s, cp) => s + (cp.byTipoTrabajo?.[t]?.pts || 0), 0);
                                    return <td key={t} className="px-3 py-2.5 text-right text-xs text-slate-300">{total > 0 ? fmtPts(Math.round(total * 100) / 100) : '—'}</td>;
                                  })}
                                  <td className="px-4 py-2.5 text-right text-emerald-400 text-xs font-bold">{fmtPts(clientProjects.reduce((s, cp) => s + cp.pts, 0))}</td>
                                </tr>
                              </tfoot>
                            </table>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Slide: Combined Zones + LPU */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'zones-lpu' && (
                <div className="space-y-5">
                  {/* Top: Heatmap */}
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-3">Mapas de Calor por Macro-Zona</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
                        <div key={zoneName} className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                          <div className="bg-slate-800/70 px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-emerald-400" />
                              <span className="font-semibold text-slate-200 text-sm">{zoneName}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-slate-400">
                              <span>{fmtPts(zoneData.totalPts)} pts</span>
                              <span>{zoneData.totalOrders.toLocaleString('es-CL')} órd</span>
                            </div>
                          </div>
                          <div className="p-3 grid grid-cols-3 gap-2">
                            {zoneData.cities.map((city) => (
                              <div key={city.name} className={`${greenScale(city.pts, zoneData.maxPts)} rounded-lg p-2 border border-slate-700/30`}>
                                <div className="text-[10px] text-slate-300 font-medium truncate">{city.name}</div>
                                <div className="text-xs text-emerald-400 font-semibold">{fmtPts(city.pts)}</div>
                                <div className="text-[10px] text-slate-500">{city.orders} órd</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bottom: LPU table */}
                  {lpuData.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Producción por Actividad LPU</h3>
                      <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actividad LPU</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Cantidad</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Pts/Unidad</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase">Pts Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lpuData.slice(0, 15).map((act, idx) => (
                                <tr key={act.desc} className={`border-b border-slate-800/50 ${idx % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                                  <td className="px-4 py-2.5 text-slate-300 text-xs" title={act.desc}>{act.desc}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-300 text-xs">{act.count.toLocaleString('es-CL')}</td>
                                  <td className="px-4 py-2.5 text-right text-slate-300 text-xs">{fmtPts(act.avgPtsPerUnit)}</td>
                                  <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold text-xs">{fmtPts(act.totalPts)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {lpuData.length > 15 && (
                            <div className="px-4 py-2 text-center text-[10px] text-slate-500 bg-slate-800/30">
                              +{lpuData.length - 15} actividades más — ver detalle completo en el dashboard
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slide: Calendar */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'calendar' && (
                <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden p-8">
                  <h3 className="text-center text-xl font-semibold text-slate-200 mb-6">
                    {monthNames[calMonth.month]} {calMonth.year}
                  </h3>
                  <div className="max-w-4xl mx-auto">
                    <div className="grid grid-cols-8 gap-3 mb-3">
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Sem'].map((d) => (
                        <div key={d} className="text-center text-sm font-medium text-slate-500 py-1">{d}</div>
                      ))}
                    </div>
                    {(() => {
                      const weeks = [];
                      for (let i = 0; i < calendarGrid.length; i += 7) weeks.push(calendarGrid.slice(i, i + 7));
                      return weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="grid grid-cols-8 gap-3 mb-3">
                          {week.map((day, dayIdx) => {
                            if (day === null) return <div key={`blank-${dayIdx}`} className="aspect-square rounded-lg" />;
                            const dayData = calendarData[day];
                            const hasPts = dayData && dayData.pts > 0;
                            return (
                              <div key={day} className={`aspect-square rounded-lg border flex flex-col items-center justify-center ${hasPts ? greenScaleCal(dayData.pts, calMaxPts) : ''} border-slate-700/30`}>
                                <span className={`text-base font-medium ${hasPts ? 'text-slate-200' : 'text-slate-600'}`}>{day}</span>
                                {hasPts && (
                                  <span className="text-sm text-emerald-400 font-semibold">{dayData.pts >= 1000 ? `${(dayData.pts / 1000).toFixed(1)}k` : fmtPts(dayData.pts)}</span>
                                )}
                              </div>
                            );
                          })}
                          {week.length < 7 && Array.from({ length: 7 - week.length }).map((_, i) => (
                            <div key={`pad-${i}`} className="aspect-square rounded-lg" />
                          ))}
                          <div className="aspect-square rounded-lg bg-slate-800/40 border border-slate-700/20 flex flex-col items-center justify-center">
                            <span className="text-sm text-emerald-400 font-semibold">{calWeeklyTotals[weekIdx] ? fmtPts(calWeeklyTotals[weekIdx].pts) : '0'}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="mt-5 flex items-center justify-center bg-slate-800/50 rounded-lg p-4 border border-slate-700/30">
                    <span className="text-base font-semibold text-emerald-400">{fmtPts(calMonthTotal.pts)} pts</span>
                    <span className="text-base text-slate-300 ml-5">{calMonthTotal.orders.toLocaleString('es-CL')} órdenes</span>
                    {metaConfig.metaProduccionMes > 0 && headerStats.uniqueTechs > 0 && (
                      <span className="ml-5">
                        <MetaBadge pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} label="Meta mensual equipo" />
                        {' '}<MetaGap pts={calMonthTotal.pts} meta={metaConfig.metaProduccionMes * headerStats.uniqueTechs} />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-t border-slate-800">
            <button
              onClick={prevSlide}
              disabled={presentationStep === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                presentationStep === 0
                  ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-700/50 text-slate-200 hover:bg-slate-700 border border-slate-600/30'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            {/* Section dots */}
            <div className="flex items-center gap-2">
              {PRESENTATION_SECTIONS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setPresentationStep(i)}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    i === presentationStep ? 'bg-emerald-400 scale-125' : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                  title={s.title}
                />
              ))}
            </div>

            <button
              onClick={presentationStep === PRESENTATION_SECTIONS.length - 1 ? closePresentation : nextSlide}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700/50 border border-emerald-600/30 rounded-lg text-sm text-emerald-200 hover:bg-emerald-600/50 transition"
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
