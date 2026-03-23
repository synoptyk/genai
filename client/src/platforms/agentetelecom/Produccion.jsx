import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Activity, Search, FileSpreadsheet, TrendingUp, Users, Award,
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Star, Target,
  MapPin, BarChart3, Layers, Clock, Hash, Zap,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, EyeOff,
  CheckCircle2, Thermometer, Grid3X3
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
  // ── State ──
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  // Filters
  const [dateFrom, setDateFrom] = useState(toInputDate(firstDayOfMonth()));
  const [dateTo, setDateTo] = useState(toInputDate(todayUTC()));
  const [typeFilter, setTypeFilter] = useState('todos');
  const [searchTech, setSearchTech] = useState('');

  // UI state
  const [expandedTech, setExpandedTech] = useState(null);
  const [rawTableOpen, setRawTableOpen] = useState(false);
  const [rawPage, setRawPage] = useState(1);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calSelectedDay, setCalSelectedDay] = useState(null);

  const refreshTimerRef = useRef(null);
  const RAW_PAGE_SIZE = 50;

  // ── Fetch data (envía fechas al server para traer rango completo) ──
  const fetchData = useCallback(async (desde, hasta) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      // Solo enviar si son strings válidas tipo "2026-03-01"
      if (typeof desde === 'string' && desde.length === 10) params.desde = desde;
      if (typeof hasta === 'string' && hasta.length === 10) params.hasta = hasta;
      const { data } = await api.get('/bot/datos-toa', { params });
      setRawData(data.datos || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching TOA data:', err);
      setError('Error al cargar datos de producción');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch cuando cambian las fechas (debounce para evitar doble fetch)
  const fetchTimerRef = useRef(null);
  useEffect(() => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchData(dateFrom, dateTo), 300);
    refreshTimerRef.current = setInterval(() => fetchData(dateFrom, dateTo), 60000);
    return () => {
      clearTimeout(fetchTimerRef.current);
      clearInterval(refreshTimerRef.current);
    };
  }, [fetchData, dateFrom, dateTo]);

  // ── Filtered data ──
  const filteredData = useMemo(() => {
    const from = dateFrom ? parseToUTC(dateFrom) : null;
    const to = dateTo ? parseToUTC(dateTo) : null;
    const search = searchTech.toLowerCase().trim();

    return rawData.filter((d) => {
      // Date filter
      const fecha = getFecha(d);
      if (!fecha) return false;
      const rowDate = parseToUTC(fecha);
      if (from && rowDate < from) return false;
      if (to && rowDate > to) return false;

      // Status filter: only Completado
      const estado = d['Estado'] || d.Estado || '';
      if (estado !== 'Completado') return false;

      // Type filter
      if (typeFilter === 'provision' && isRepair(d)) return false;
      if (typeFilter === 'reparacion' && !isRepair(d)) return false;

      // Search filter
      if (search && !getTecnico(d).toLowerCase().includes(search)) return false;

      return true;
    });
  }, [rawData, dateFrom, dateTo, typeFilter, searchTech]);

  // ── Header stats ──
  const headerStats = useMemo(() => {
    const totalOrders = filteredData.length;
    const totalPts = filteredData.reduce((s, d) => s + ptsTotal(d), 0);
    const techSet = new Set(filteredData.map(getTecnico).filter(Boolean));
    const daySet = new Set(filteredData.map((d) => toDateKey(getFecha(d))));
    const uniqueTechs = techSet.size;
    const uniqueDays = daySet.size;
    const avgPtsPerTechPerDay = uniqueTechs > 0 && uniqueDays > 0
      ? totalPts / uniqueTechs / uniqueDays
      : 0;
    return { totalOrders, totalPts, avgPtsPerTechPerDay, uniqueTechs, uniqueDays };
  }, [filteredData]);

  // ── Technician ranking ──
  const techRanking = useMemo(() => {
    const map = {};
    filteredData.forEach((d) => {
      const tech = getTecnico(d);
      if (!tech) return;
      if (!map[tech]) {
        map[tech] = {
          name: tech,
          orders: 0,
          ptsBase: 0,
          ptsDeco: 0,
          ptsRepetidor: 0,
          ptsTelefono: 0,
          ptsTotal: 0,
          days: new Set(),
          activities: {},
          dailyMap: {},
          rows: [],
        };
      }
      const entry = map[tech];
      entry.orders++;
      entry.ptsBase += ptsBase(d);
      entry.ptsDeco += ptsDeco(d);
      entry.ptsRepetidor += ptsRepetidor(d);
      entry.ptsTelefono += ptsTelefono(d);
      entry.ptsTotal += ptsTotal(d);

      const dk = toDateKey(getFecha(d));
      entry.days.add(dk);

      if (!entry.dailyMap[dk]) entry.dailyMap[dk] = { orders: 0, pts: 0 };
      entry.dailyMap[dk].orders++;
      entry.dailyMap[dk].pts += ptsTotal(d);

      const descLpu = getDescLPU(d);
      if (descLpu) {
        if (!entry.activities[descLpu]) entry.activities[descLpu] = { count: 0, pts: 0 };
        entry.activities[descLpu].count++;
        entry.activities[descLpu].pts += ptsTotal(d);
      }

      entry.rows.push(d);
    });

    return Object.values(map).map((t) => ({
      ...t,
      activeDays: t.days.size,
      avgPerDay: t.days.size > 0 ? t.ptsTotal / t.days.size : 0,
    }));
  }, [filteredData]);

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

  // ── Macro-zone data ──
  const macroZoneData = useMemo(() => {
    const cityMap = {};
    filteredData.forEach((d) => {
      const city = getCiudad(d).toUpperCase().trim();
      if (!city) return;
      if (!cityMap[city]) cityMap[city] = { pts: 0, orders: 0 };
      cityMap[city].pts += ptsTotal(d);
      cityMap[city].orders++;
    });

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
  }, [filteredData]);

  // ── LPU activity data ──
  const lpuData = useMemo(() => {
    const map = {};
    filteredData.forEach((d) => {
      const desc = getDescLPU(d);
      const code = getCodigoLPU(d);
      if (!desc) return;
      const key = desc;
      if (!map[key]) map[key] = { desc, code, count: 0, totalPts: 0 };
      map[key].count++;
      map[key].totalPts += ptsTotal(d);
    });
    return Object.values(map)
      .filter((a) => a.totalPts > 0)
      .sort((a, b) => b.totalPts - a.totalPts)
      .map((a) => ({
        ...a,
        avgPtsPerUnit: a.count > 0 ? a.totalPts / a.count : 0,
      }));
  }, [filteredData]);

  // ── Calendar data ──
  const calendarData = useMemo(() => {
    const map = {};
    filteredData.forEach((d) => {
      const fecha = getFecha(d);
      if (!fecha) return;
      const dt = new Date(fecha);
      const y = dt.getUTCFullYear();
      const m = dt.getUTCMonth();
      if (y === calMonth.year && m === calMonth.month) {
        const day = dt.getUTCDate();
        if (!map[day]) map[day] = { pts: 0, orders: 0, techs: {} };
        map[day].pts += ptsTotal(d);
        map[day].orders++;
        const tech = getTecnico(d);
        if (tech) {
          if (!map[day].techs[tech]) map[day].techs[tech] = 0;
          map[day].techs[tech] += ptsTotal(d);
        }
      }
    });
    return map;
  }, [filteredData, calMonth]);

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

  // ── Export to Excel ──
  const exportToExcel = useCallback(() => {
    const rows = filteredData.map((d) => ({
      'Fecha': fmtDate(getFecha(d)),
      'Técnico': getTecnico(d),
      'Subtipo Actividad': getSubtipo(d),
      'Desc LPU Base': getDescLPU(d),
      'Código LPU': getCodigoLPU(d),
      'Ciudad': getCiudad(d),
      'Zona Trabajo': getZona(d),
      'Agencia': getAgencia(d),
      'Comuna': getComuna(d),
      'Pts Base': ptsBase(d),
      'Pts Deco Adicional': ptsDeco(d),
      'Pts Repetidor WiFi': ptsRepetidor(d),
      'Pts Teléfono': ptsTelefono(d),
      'Pts Total Baremo': ptsTotal(d),
      'Tipo': isRepair(d) ? 'Reparación' : 'Provisión',
      'Nº Petición': getOrderId(d),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción');
    XLSX.writeFile(wb, `produccion_${dateFrom}_${dateTo}.xlsx`);
  }, [filteredData, dateFrom, dateTo]);

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

  // ── Raw table pagination ──
  const rawTableData = useMemo(() => {
    const start = (rawPage - 1) * RAW_PAGE_SIZE;
    return filteredData.slice(start, start + RAW_PAGE_SIZE);
  }, [filteredData, rawPage]);

  const rawTotalPages = Math.ceil(filteredData.length / RAW_PAGE_SIZE) || 1;

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

  // ─── MONTH NAMES ───
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // ─── LOADING / ERROR ───
  if (loading && rawData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-lg">Cargando datos de producción...</p>
        </div>
      </div>
    );
  }

  if (error && rawData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <X className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-red-300 text-lg">{error}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition">
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
                onClick={fetchData}
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
              label="Órdenes Completadas"
              value={headerStats.totalOrders.toLocaleString('es-CL')}
              color="emerald"
            />
            <StatCard
              icon={Zap}
              label="Total Puntos Baremo"
              value={fmtPts(headerStats.totalPts)}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="Prom Pts/Técnico/Día"
              value={fmtPts(headerStats.avgPtsPerTechPerDay)}
              sub={`${headerStats.uniqueTechs} técnicos × ${headerStats.uniqueDays} días`}
              color="purple"
            />
            <StatCard
              icon={Users}
              label="Técnicos Activos"
              value={headerStats.uniqueTechs.toLocaleString('es-CL')}
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
            Mostrando {filteredData.length.toLocaleString('es-CL')} órdenes completadas
            {typeFilter !== 'todos' && ` (${typeFilter === 'provision' ? 'Provisión' : 'Reparación'})`}
            {searchTech && ` — filtro técnico: "${searchTech}"`}
          </div>
        </section>

        {/* ═══════════════════════ 3. RANKING TÉCNICOS ═══════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Ranking de Técnicos</h2>
            <span className="text-xs text-slate-500 ml-2">({sortedTechRanking.length} técnicos)</span>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50">
                    {[
                      { key: null, label: '#', className: 'w-10 text-center' },
                      { key: 'name', label: 'Técnico', className: 'text-left' },
                      { key: 'activeDays', label: 'Días Activos' },
                      { key: 'orders', label: 'Órdenes' },
                      { key: 'ptsBase', label: 'Pts Base' },
                      { key: 'ptsDeco', label: 'Pts Deco' },
                      { key: 'ptsRepetidor', label: 'Pts Repetidor' },
                      { key: 'ptsTelefono', label: 'Pts Teléfono' },
                      { key: 'ptsTotal', label: 'Pts Total' },
                      { key: 'avgPerDay', label: 'Prom/Día' },
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
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
                    const isExpanded = expandedTech === tech.name;

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
                            {tech.name}
                            <ChevronDown className={`w-3.5 h-3.5 inline ml-2 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{tech.activeDays}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{tech.orders.toLocaleString('es-CL')}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsBase)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsDeco)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsRepetidor)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.ptsTelefono)}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">{fmtPts(tech.ptsTotal)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-300">{fmtPts(tech.avgPerDay)}</td>
                        </tr>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-0">
                              <div className="bg-slate-850 border-t border-b border-emerald-800/20 p-5 space-y-5" style={{ background: 'rgba(15,23,42,0.8)' }}>
                                {/* Mini stat cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <MiniStat icon={Hash} label="Total Órdenes" value={tech.orders.toLocaleString('es-CL')} />
                                  <MiniStat icon={Zap} label="Pts Total" value={fmtPts(tech.ptsTotal)} />
                                  <MiniStat icon={Calendar} label="Días Activos" value={tech.activeDays} />
                                  <MiniStat icon={TrendingUp} label="Prom/Día" value={fmtPts(tech.avgPerDay)} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                <div className="flex gap-4">
                  <span className="text-sm font-semibold text-emerald-400">{fmtPts(calMonthTotal.pts)} pts</span>
                  <span className="text-sm text-slate-300">{calMonthTotal.orders.toLocaleString('es-CL')} órdenes</span>
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

        {/* ═══════════════════════ 7. TABLA DE DATOS RAW ═══════════════════════ */}
        <section>
          <div
            className="flex items-center justify-between cursor-pointer bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3 hover:bg-slate-800/50 transition"
            onClick={() => { setRawTableOpen(!rawTableOpen); setRawPage(1); }}
          >
            <div className="flex items-center gap-2">
              {rawTableOpen ? <EyeOff className="w-5 h-5 text-emerald-400" /> : <Eye className="w-5 h-5 text-emerald-400" />}
              <h2 className="text-lg font-semibold text-white">Tabla de Datos</h2>
              <span className="text-xs text-slate-500">({filteredData.length.toLocaleString('es-CL')} registros)</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); exportToExcel(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/30 border border-emerald-600/30 rounded-lg text-xs text-emerald-300 hover:bg-emerald-600/40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${rawTableOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {rawTableOpen && (
            <div className="mt-2 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase">Fecha</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase">Técnico</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase">Subtipo Actividad</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase">Desc LPU Base</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-medium text-slate-400 uppercase">Ciudad</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase">Pts Base</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase">Pts Deco</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase">Pts Rep WiFi</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase">Pts Tel</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-medium text-slate-400 uppercase">Pts Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawTableData.map((d, idx) => (
                      <tr key={idx} className={`border-b border-slate-800/40 ${idx % 2 === 0 ? '' : 'bg-slate-800/15'}`}>
                        <td className="px-3 py-2 text-slate-400">{fmtDate(getFecha(d))}</td>
                        <td className="px-3 py-2 text-slate-300 max-w-[150px] truncate">{getTecnico(d)}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate" title={getSubtipo(d)}>{getSubtipo(d)}</td>
                        <td className="px-3 py-2 text-slate-400 max-w-[180px] truncate" title={getDescLPU(d)}>{getDescLPU(d)}</td>
                        <td className="px-3 py-2 text-slate-400">{getCiudad(d)}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{fmtPts(ptsBase(d))}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{fmtPts(ptsDeco(d))}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{fmtPts(ptsRepetidor(d))}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{fmtPts(ptsTelefono(d))}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 font-medium">{fmtPts(ptsTotal(d))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border-t border-slate-700/50">
                <span className="text-xs text-slate-400">
                  Página {rawPage} de {rawTotalPages} — mostrando {(rawPage - 1) * RAW_PAGE_SIZE + 1} a {Math.min(rawPage * RAW_PAGE_SIZE, filteredData.length)} de {filteredData.length.toLocaleString('es-CL')}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setRawPage(1)}
                    disabled={rawPage === 1}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                  >
                    {'<<'}
                  </button>
                  <button
                    onClick={() => setRawPage((p) => Math.max(1, p - 1))}
                    disabled={rawPage === 1}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRawPage((p) => Math.min(rawTotalPages, p + 1))}
                    disabled={rawPage === rawTotalPages}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setRawPage(rawTotalPages)}
                    disabled={rawPage === rawTotalPages}
                    className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 disabled:opacity-30 hover:bg-slate-700 transition"
                  >
                    {'>>'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
