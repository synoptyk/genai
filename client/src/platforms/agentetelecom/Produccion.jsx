import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Activity, Search, FileSpreadsheet, TrendingUp, Users, Award,
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Star, Medal, Target,
  MapPin, BarChart3, Layers, Clock, Hash, Zap,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, EyeOff,
  CheckCircle2, PieChart
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const pts = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const fmtPts = (v) => {
  const n = typeof v === 'number' ? v : pts(v);
  return n % 1 === 0 ? n.toLocaleString('es-CL') : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const toDateKey = (d) => {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`;
};

const parseToUTC = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const today = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};

const addDays = (d, n) => {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
};

const startOfMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

const endOfMonth = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

const isSameDay = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();

const isWithinRange = (date, from, to) => date >= from && date <= to;

const getDaysInMonth = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const getWeekday = (year, month, day) => new Date(Date.UTC(year, month, day)).getUTCDay();

const isRepairOrder = (record) => {
  const id = record['Número de Petición'] || record.ordenId || '';
  return id.toString().toUpperCase().startsWith('INC');
};

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
const Produccion = () => {
  // --- STATE ---
  const [dataRaw, setDataRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Filters
  const [fechaDesde, setFechaDesde] = useState(() => startOfMonth(today()));
  const [fechaHasta, setFechaHasta] = useState(() => today());
  const [tipoFilter, setTipoFilter] = useState('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Interactive state
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => { const t = today(); return { year: t.getUTCFullYear(), month: t.getUTCMonth() }; });
  const [sortConfig, setSortConfig] = useState({ key: 'ptsTotal', dir: 'desc' });
  const [zonaSortKey, setZonaSortKey] = useState('ptsTotal');
  const [rawPage, setRawPage] = useState(0);
  const [showRawData, setShowRawData] = useState(false);
  const RAW_PAGE_SIZE = 50;

  // --- DATA FETCH ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/bot/datos-toa');
      const payload = res.data;
      const records = payload.datos || payload || [];
      setDataRaw(records);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error cargando datos TOA:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // --- FILTERED DATA ---
  const filteredData = useMemo(() => {
    let d = dataRaw.filter(r => r.Estado === 'Completado');

    // Date range
    d = d.filter(r => {
      if (!r.fecha) return false;
      const rd = parseToUTC(r.fecha);
      return isWithinRange(rd, fechaDesde, fechaHasta);
    });

    // Type filter
    if (tipoFilter === 'PROVISION') d = d.filter(r => !isRepairOrder(r));
    if (tipoFilter === 'REPARACION') d = d.filter(r => isRepairOrder(r));

    // Search
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      d = d.filter(r => {
        const recurso = (r.Recurso || '').toLowerCase();
        return recurso.includes(q);
      });
    }

    return d;
  }, [dataRaw, fechaDesde, fechaHasta, tipoFilter, busqueda]);

  // --- HEADER STATS ---
  const headerStats = useMemo(() => {
    const totalOrdenes = filteredData.length;
    const totalPts = filteredData.reduce((s, r) => s + pts(r.Pts_Total_Baremo), 0);
    const techSet = new Set(filteredData.map(r => r.Recurso).filter(Boolean));
    const tecnicos = techSet.size;

    // Days per technician
    const techDays = {};
    filteredData.forEach(r => {
      const tech = r.Recurso;
      if (!tech) return;
      const dk = toDateKey(r.fecha);
      if (!techDays[tech]) techDays[tech] = new Set();
      techDays[tech].add(dk);
    });
    const totalTechDays = Object.values(techDays).reduce((s, set) => s + set.size, 0);
    const promPtsTecDia = totalTechDays > 0 ? totalPts / totalTechDays : 0;

    return { totalOrdenes, totalPts, tecnicos, promPtsTecDia };
  }, [filteredData]);

  // --- TECHNICIAN RANKING ---
  const techRanking = useMemo(() => {
    const map = {};
    filteredData.forEach(r => {
      const name = r.Recurso;
      if (!name) return;
      if (!map[name]) {
        map[name] = {
          nombre: name,
          id: r.ID_Recurso || r['ID Recurso'] || '',
          ordenes: 0,
          ptsBase: 0,
          ptsDeco: 0,
          ptsRepetidor: 0,
          ptsTelefono: 0,
          ptsTotal: 0,
          dias: new Set(),
          ciudad: r.Ciudad || '',
          zona: r.Zona_Trabajo || r['Zona Trabajo'] || ''
        };
      }
      const t = map[name];
      t.ordenes++;
      t.ptsBase += pts(r.Pts_Actividad_Base);
      t.ptsDeco += pts(r.Pts_Deco_Adicional);
      t.ptsRepetidor += pts(r.Pts_Repetidor_WiFi);
      t.ptsTelefono += pts(r.Pts_Telefono);
      t.ptsTotal += pts(r.Pts_Total_Baremo);
      t.dias.add(toDateKey(r.fecha));
    });

    return Object.values(map).map(t => ({
      ...t,
      diasActivos: t.dias.size,
      promDia: t.dias.size > 0 ? t.ptsTotal / t.dias.size : 0
    }));
  }, [filteredData]);

  const sortedRanking = useMemo(() => {
    const arr = [...techRanking];
    arr.sort((a, b) => {
      const va = a[sortConfig.key] ?? 0;
      const vb = b[sortConfig.key] ?? 0;
      return sortConfig.dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return arr;
  }, [techRanking, sortConfig]);

  const rankingTotals = useMemo(() => {
    return techRanking.reduce((acc, t) => ({
      ordenes: acc.ordenes + t.ordenes,
      ptsBase: acc.ptsBase + t.ptsBase,
      ptsDeco: acc.ptsDeco + t.ptsDeco,
      ptsRepetidor: acc.ptsRepetidor + t.ptsRepetidor,
      ptsTelefono: acc.ptsTelefono + t.ptsTelefono,
      ptsTotal: acc.ptsTotal + t.ptsTotal,
      diasActivos: acc.diasActivos + t.diasActivos,
    }), { ordenes: 0, ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0, diasActivos: 0 });
  }, [techRanking]);

  // --- ZONE PRODUCTION ---
  const zoneData = useMemo(() => {
    const map = {};
    filteredData.forEach(r => {
      const zone = r.Zona_Trabajo || r['Zona Trabajo'] || r.Ciudad || 'Sin Zona';
      if (!map[zone]) {
        map[zone] = { zona: zone, ciudad: r.Ciudad || '', ordenes: 0, ptsTotal: 0, tecnicos: new Set() };
      }
      map[zone].ordenes++;
      map[zone].ptsTotal += pts(r.Pts_Total_Baremo);
      if (r.Recurso) map[zone].tecnicos.add(r.Recurso);
    });
    const arr = Object.values(map).map(z => ({
      ...z,
      numTecnicos: z.tecnicos.size,
      promPtsTec: z.tecnicos.size > 0 ? z.ptsTotal / z.tecnicos.size : 0
    }));
    arr.sort((a, b) => b[zonaSortKey] - a[zonaSortKey]);
    return arr;
  }, [filteredData, zonaSortKey]);

  const maxZonePts = useMemo(() => Math.max(...zoneData.map(z => z.ptsTotal), 1), [zoneData]);

  // --- ACTIVITY TYPE PRODUCTION ---
  const activityData = useMemo(() => {
    const map = {};
    filteredData.forEach(r => {
      const desc = r.Desc_LPU_Base || 'Sin LPU';
      const code = r.Codigo_LPU_Base || '';
      const key = `${code}|${desc}`;
      if (!map[key]) map[key] = { desc, code, cantidad: 0, ptsTotal: 0 };
      map[key].cantidad++;
      map[key].ptsTotal += pts(r.Pts_Total_Baremo);
    });
    const arr = Object.values(map).map(a => ({
      ...a,
      ptsUnitario: a.cantidad > 0 ? a.ptsTotal / a.cantidad : 0
    }));
    arr.sort((a, b) => b.ptsTotal - a.ptsTotal);
    return arr;
  }, [filteredData]);

  // --- CALENDAR DATA ---
  const calendarData = useMemo(() => {
    const map = {};
    filteredData.forEach(r => {
      const d = new Date(r.fecha);
      if (d.getUTCFullYear() !== calendarMonth.year || d.getUTCMonth() !== calendarMonth.month) return;
      const day = d.getUTCDate();
      if (!map[day]) map[day] = { pts: 0, ordenes: 0, tecnicos: new Set() };
      map[day].pts += pts(r.Pts_Total_Baremo);
      map[day].ordenes++;
      if (r.Recurso) map[day].tecnicos.add(r.Recurso);
    });
    return map;
  }, [filteredData, calendarMonth]);

  const maxCalendarPts = useMemo(() => Math.max(...Object.values(calendarData).map(d => d.pts), 1), [calendarData]);

  // --- DAY DETAIL (when clicking calendar) ---
  const dayDetail = useMemo(() => {
    if (selectedDay === null) return [];
    const map = {};
    filteredData.forEach(r => {
      const d = new Date(r.fecha);
      if (d.getUTCFullYear() !== calendarMonth.year || d.getUTCMonth() !== calendarMonth.month || d.getUTCDate() !== selectedDay) return;
      const name = r.Recurso || 'Desconocido';
      if (!map[name]) map[name] = { nombre: name, ordenes: 0, ptsBase: 0, ptsDeco: 0, ptsRepetidor: 0, ptsTelefono: 0, ptsTotal: 0 };
      map[name].ordenes++;
      map[name].ptsBase += pts(r.Pts_Actividad_Base);
      map[name].ptsDeco += pts(r.Pts_Deco_Adicional);
      map[name].ptsRepetidor += pts(r.Pts_Repetidor_WiFi);
      map[name].ptsTelefono += pts(r.Pts_Telefono);
      map[name].ptsTotal += pts(r.Pts_Total_Baremo);
    });
    return Object.values(map).sort((a, b) => b.ptsTotal - a.ptsTotal);
  }, [filteredData, selectedDay, calendarMonth]);

  // --- TECHNICIAN DETAIL ---
  const techDetail = useMemo(() => {
    if (!selectedTechnician) return null;
    const records = filteredData.filter(r => r.Recurso === selectedTechnician);
    if (records.length === 0) return null;

    const totalOrdenes = records.length;
    const totalPts = records.reduce((s, r) => s + pts(r.Pts_Total_Baremo), 0);
    const ptsBase = records.reduce((s, r) => s + pts(r.Pts_Actividad_Base), 0);
    const ptsDeco = records.reduce((s, r) => s + pts(r.Pts_Deco_Adicional), 0);
    const ptsRepetidor = records.reduce((s, r) => s + pts(r.Pts_Repetidor_WiFi), 0);
    const ptsTelefono = records.reduce((s, r) => s + pts(r.Pts_Telefono), 0);
    const ptsExtras = ptsDeco + ptsRepetidor + ptsTelefono;

    const dayMap = {};
    records.forEach(r => {
      const dk = toDateKey(r.fecha);
      if (!dayMap[dk]) dayMap[dk] = { fecha: r.fecha, ordenes: 0, ptsBase: 0, ptsExtras: 0, ptsTotal: 0 };
      dayMap[dk].ordenes++;
      dayMap[dk].ptsBase += pts(r.Pts_Actividad_Base);
      dayMap[dk].ptsExtras += pts(r.Pts_Deco_Adicional) + pts(r.Pts_Repetidor_WiFi) + pts(r.Pts_Telefono);
      dayMap[dk].ptsTotal += pts(r.Pts_Total_Baremo);
    });
    const dailyEvolution = Object.values(dayMap).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const diasActivos = dailyEvolution.length;
    const promDia = diasActivos > 0 ? totalPts / diasActivos : 0;

    // Top activities
    const actMap = {};
    records.forEach(r => {
      const key = r.Desc_LPU_Base || r.Codigo_LPU_Base || 'Sin LPU';
      if (!actMap[key]) actMap[key] = { desc: key, code: r.Codigo_LPU_Base || '', cantidad: 0, pts: 0 };
      actMap[key].cantidad++;
      actMap[key].pts += pts(r.Pts_Total_Baremo);
    });
    const topActivities = Object.values(actMap).sort((a, b) => b.pts - a.pts).slice(0, 8);

    return {
      nombre: selectedTechnician,
      totalOrdenes, totalPts, promDia, diasActivos,
      ptsBase, ptsDeco, ptsRepetidor, ptsTelefono, ptsExtras,
      dailyEvolution, topActivities
    };
  }, [filteredData, selectedTechnician]);

  // --- RAW DATA PAGINATION ---
  const rawDataPage = useMemo(() => {
    const start = rawPage * RAW_PAGE_SIZE;
    return filteredData.slice(start, start + RAW_PAGE_SIZE);
  }, [filteredData, rawPage]);

  const totalRawPages = Math.ceil(filteredData.length / RAW_PAGE_SIZE);

  // --- HANDLERS ---
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  const setQuickDate = useCallback((type) => {
    const t = today();
    switch (type) {
      case 'hoy': setFechaDesde(t); setFechaHasta(t); break;
      case 'ayer': { const y = addDays(t, -1); setFechaDesde(y); setFechaHasta(y); break; }
      case '7d': setFechaDesde(addDays(t, -6)); setFechaHasta(t); break;
      case '30d': setFechaDesde(addDays(t, -29)); setFechaHasta(t); break;
      case 'mes': setFechaDesde(startOfMonth(t)); setFechaHasta(t); break;
      default: break;
    }
    setRawPage(0);
  }, []);

  const exportToExcel = useCallback(() => {
    if (filteredData.length === 0) return;
    const rows = filteredData.map(r => ({
      Fecha: fmtDate(r.fecha),
      Tecnico: r.Recurso || '',
      ID_Recurso: r.ID_Recurso || r['ID Recurso'] || '',
      Actividad: r.Actividad || '',
      Subtipo: r.Subtipo_de_Actividad || r['Subtipo de Actividad'] || '',
      LPU_Codigo: r.Codigo_LPU_Base || '',
      LPU_Descripcion: r.Desc_LPU_Base || '',
      Pts_Base: pts(r.Pts_Actividad_Base),
      Pts_Deco: pts(r.Pts_Deco_Adicional),
      Pts_Repetidor: pts(r.Pts_Repetidor_WiFi),
      Pts_Telefono: pts(r.Pts_Telefono),
      Pts_Total: pts(r.Pts_Total_Baremo),
      Ciudad: r.Ciudad || '',
      Zona: r.Zona_Trabajo || r['Zona Trabajo'] || '',
      Estado: r.Estado || '',
      Tipo: isRepairOrder(r) ? 'Reparación' : 'Provisión'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción');

    // Ranking sheet
    const rankRows = sortedRanking.map((t, i) => ({
      '#': i + 1,
      Tecnico: t.nombre,
      Dias_Activos: t.diasActivos,
      Ordenes: t.ordenes,
      Pts_Base: t.ptsBase,
      Pts_Deco: t.ptsDeco,
      Pts_Repetidor: t.ptsRepetidor,
      Pts_Telefono: t.ptsTelefono,
      Pts_Total: t.ptsTotal,
      Promedio_Dia: Math.round(t.promDia * 100) / 100
    }));
    const ws2 = XLSX.utils.json_to_sheet(rankRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Ranking');

    XLSX.writeFile(wb, `Produccion_Baremo_${fmtDate(new Date()).replace(/\//g, '-')}.xlsx`);
  }, [filteredData, sortedRanking]);

  const prevMonth = useCallback(() => {
    setCalendarMonth(prev => {
      const m = prev.month - 1;
      return m < 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: m };
    });
    setSelectedDay(null);
  }, []);

  const nextMonth = useCallback(() => {
    setCalendarMonth(prev => {
      const m = prev.month + 1;
      return m > 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: m };
    });
    setSelectedDay(null);
  }, []);

  // --- SORT ICON ---
  const SortIcon = ({ col }) => {
    if (sortConfig.key !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortConfig.dir === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />;
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const medalBg = ['bg-yellow-400/10 border-yellow-400/30', 'bg-gray-300/10 border-gray-300/30', 'bg-amber-600/10 border-amber-600/30'];

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* ──── 1. HEADER ──── */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border-b border-emerald-900/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-xl">
                  <BarChart3 className="w-7 h-7 text-emerald-400" />
                </div>
                Producción Operativa
              </h1>
              <p className="text-slate-400 mt-1 text-sm">Seguimiento de Puntos Baremo</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {lastUpdate && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {lastUpdate.toLocaleTimeString('es-CL')}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg text-xs border border-emerald-700/40 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs border border-blue-700/40 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Excel
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="Total Órdenes"
              value={headerStats.totalOrdenes.toLocaleString('es-CL')}
              sublabel="Completadas"
              color="emerald"
            />
            <StatCard
              icon={<Target className="w-5 h-5" />}
              label="Total Puntos Baremo"
              value={fmtPts(headerStats.totalPts)}
              sublabel="Pts acumulados"
              color="blue"
            />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Promedio Pts/Téc/Día"
              value={fmtPts(headerStats.promPtsTecDia)}
              sublabel="Productividad"
              color="purple"
            />
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Técnicos Activos"
              value={headerStats.tecnicos}
              sublabel="En período"
              color="amber"
            />
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ──── 2. FILTROS ──── */}
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-slate-300">Filtros</span>
          </div>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            {/* Date range */}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde.toISOString().slice(0, 10)}
                  onChange={e => { setFechaDesde(parseToUTC(e.target.value)); setRawPage(0); }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta.toISOString().slice(0, 10)}
                  onChange={e => { setFechaHasta(parseToUTC(e.target.value)); setRawPage(0); }}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
                />
              </div>
            </div>

            {/* Quick date buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'hoy', label: 'Hoy' },
                { key: 'ayer', label: 'Ayer' },
                { key: '7d', label: 'Últ 7 días' },
                { key: '30d', label: 'Últ 30 días' },
                { key: 'mes', label: 'Este mes' }
              ].map(b => (
                <button
                  key={b.key}
                  onClick={() => setQuickDate(b.key)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-600/50 transition-all"
                >
                  {b.label}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div className="flex gap-1.5">
              {['TODOS', 'PROVISION', 'REPARACION'].map(t => (
                <button
                  key={t}
                  onClick={() => { setTipoFilter(t); setRawPage(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    tipoFilter === t
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {t === 'PROVISION' ? 'Provisión' : t === 'REPARACION' ? 'Reparación' : 'Todos'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar técnico..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setRawPage(0); }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* No data message */}
        {filteredData.length === 0 && !loading && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 p-12 text-center">
            <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-lg">Sin datos para los filtros seleccionados</p>
            <p className="text-slate-600 text-sm mt-1">Ajusta el rango de fechas o los filtros</p>
          </div>
        )}

        {filteredData.length > 0 && (
          <>
            {/* ──── 3. RANKING TÉCNICOS ──── */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-lg">Ranking Técnicos</h2>
                <span className="ml-auto text-xs text-slate-500">{techRanking.length} técnicos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                      <th className="px-3 py-2.5 text-left w-10">#</th>
                      <th className="px-3 py-2.5 text-left cursor-pointer hover:text-emerald-400" onClick={() => handleSort('nombre')}>
                        <span className="flex items-center gap-1">Técnico <SortIcon col="nombre" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('diasActivos')}>
                        <span className="flex items-center gap-1 justify-center">Días <SortIcon col="diasActivos" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ordenes')}>
                        <span className="flex items-center gap-1 justify-center">Órdenes <SortIcon col="ordenes" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ptsBase')}>
                        <span className="flex items-center gap-1 justify-center">Pts Base <SortIcon col="ptsBase" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ptsDeco')}>
                        <span className="flex items-center gap-1 justify-center">Pts Deco <SortIcon col="ptsDeco" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ptsRepetidor')}>
                        <span className="flex items-center gap-1 justify-center">Pts Repetidor <SortIcon col="ptsRepetidor" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ptsTelefono')}>
                        <span className="flex items-center gap-1 justify-center">Pts Teléfono <SortIcon col="ptsTelefono" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('ptsTotal')}>
                        <span className="flex items-center gap-1 justify-center font-bold">Pts Total <SortIcon col="ptsTotal" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center cursor-pointer hover:text-emerald-400" onClick={() => handleSort('promDia')}>
                        <span className="flex items-center gap-1 justify-center">Prom/Día <SortIcon col="promDia" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRanking.map((t, i) => {
                      // Find the rank position based on ptsTotal descending for medal assignment
                      const ptsSorted = [...techRanking].sort((a, b) => b.ptsTotal - a.ptsTotal);
                      const realRank = ptsSorted.findIndex(x => x.nombre === t.nombre);
                      const isSelected = selectedTechnician === t.nombre;

                      return (
                        <React.Fragment key={t.nombre}>
                          <tr
                            className={`border-b border-slate-800/40 transition-all cursor-pointer ${
                              isSelected ? 'bg-emerald-900/20' : 'hover:bg-slate-800/40'
                            } ${realRank < 3 ? medalBg[realRank] + ' border' : ''}`}
                            onClick={() => setSelectedTechnician(isSelected ? null : t.nombre)}
                          >
                            <td className="px-3 py-2.5 text-center">
                              {realRank < 3 ? (
                                <span className={`flex items-center justify-center ${medalColors[realRank]}`}>
                                  <Medal className="w-4 h-4" />
                                </span>
                              ) : (
                                <span className="text-slate-500">{i + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-medium">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">{t.nombre}</span>
                                {t.zona && <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded hidden lg:inline">{t.zona}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-300">{t.diasActivos}</td>
                            <td className="px-3 py-2.5 text-center text-slate-300">{t.ordenes}</td>
                            <td className="px-3 py-2.5 text-center text-sky-300">{fmtPts(t.ptsBase)}</td>
                            <td className="px-3 py-2.5 text-center text-violet-300">{fmtPts(t.ptsDeco)}</td>
                            <td className="px-3 py-2.5 text-center text-teal-300">{fmtPts(t.ptsRepetidor)}</td>
                            <td className="px-3 py-2.5 text-center text-orange-300">{fmtPts(t.ptsTelefono)}</td>
                            <td className="px-3 py-2.5 text-center font-bold text-emerald-400">{fmtPts(t.ptsTotal)}</td>
                            <td className="px-3 py-2.5 text-center text-slate-300">{fmtPts(t.promDia)}</td>
                            <td className="px-3 py-2.5 text-center">
                              {isSelected ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </td>
                          </tr>

                          {/* ──── 7. INLINE TECH DETAIL ──── */}
                          {isSelected && techDetail && (
                            <tr>
                              <td colSpan={11} className="p-0">
                                <TechDetailPanel detail={techDetail} onClose={() => setSelectedTechnician(null)} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Summary row */}
                    <tr className="bg-slate-800/70 font-semibold text-emerald-300 border-t-2 border-emerald-600/30">
                      <td className="px-3 py-2.5" colSpan={2}>
                        <span className="flex items-center gap-1"><Layers className="w-4 h-4" /> TOTALES</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">{rankingTotals.diasActivos}</td>
                      <td className="px-3 py-2.5 text-center">{rankingTotals.ordenes.toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2.5 text-center">{fmtPts(rankingTotals.ptsBase)}</td>
                      <td className="px-3 py-2.5 text-center">{fmtPts(rankingTotals.ptsDeco)}</td>
                      <td className="px-3 py-2.5 text-center">{fmtPts(rankingTotals.ptsRepetidor)}</td>
                      <td className="px-3 py-2.5 text-center">{fmtPts(rankingTotals.ptsTelefono)}</td>
                      <td className="px-3 py-2.5 text-center font-bold">{fmtPts(rankingTotals.ptsTotal)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {rankingTotals.diasActivos > 0 ? fmtPts(rankingTotals.ptsTotal / rankingTotals.diasActivos) : '0'}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ──── 4. PRODUCCIÓN POR ZONA ──── */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                <h2 className="font-semibold text-lg">Producción por Zona</h2>
                <div className="ml-auto flex gap-1.5">
                  {[
                    { key: 'ptsTotal', label: 'Puntos' },
                    { key: 'ordenes', label: 'Órdenes' },
                    { key: 'numTecnicos', label: 'Técnicos' }
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setZonaSortKey(s.key)}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        zonaSortKey === s.key
                          ? 'bg-teal-600/30 text-teal-300 border border-teal-500/40'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {zoneData.map(z => (
                  <div key={z.zona} className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 hover:border-teal-600/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm truncate pr-2">{z.zona}</h3>
                      <span className="text-emerald-400 font-bold text-sm whitespace-nowrap">{fmtPts(z.ptsTotal)} pts</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                      <span>{z.ordenes} órdenes</span>
                      <span>{z.numTecnicos} técnicos</span>
                      <span>{fmtPts(z.promPtsTec)} pts/téc</span>
                    </div>
                    {/* Bar */}
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${(z.ptsTotal / maxZonePts) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {zoneData.length === 0 && (
                  <p className="text-slate-500 text-sm col-span-full text-center py-4">Sin datos de zona</p>
                )}
              </div>
            </div>

            {/* ──── 5. PRODUCCIÓN POR TIPO DE ACTIVIDAD ──── */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800/60 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <h2 className="font-semibold text-lg">Producción por Tipo de Actividad</h2>
                <span className="ml-auto text-xs text-slate-500">{activityData.length} tipos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase">
                      <th className="px-4 py-2.5 text-left">Actividad LPU</th>
                      <th className="px-4 py-2.5 text-left">Código</th>
                      <th className="px-4 py-2.5 text-center">Cantidad</th>
                      <th className="px-4 py-2.5 text-center">Pts Unitario</th>
                      <th className="px-4 py-2.5 text-center">Pts Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityData.map((a, i) => (
                      <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2 text-slate-200 max-w-[300px] truncate">{a.desc}</td>
                        <td className="px-4 py-2 text-slate-400 font-mono text-xs">{a.code || '-'}</td>
                        <td className="px-4 py-2 text-center text-slate-300">{a.cantidad}</td>
                        <td className="px-4 py-2 text-center text-slate-300">{fmtPts(a.ptsUnitario)}</td>
                        <td className="px-4 py-2 text-center font-semibold text-purple-300">{fmtPts(a.ptsTotal)}</td>
                      </tr>
                    ))}
                    {activityData.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6 text-slate-500">Sin datos</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ──── 6. CALENDARIO DE PRODUCCIÓN ──── */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <h2 className="font-semibold text-lg">Calendario de Producción</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-400" />
                  </button>
                  <span className="text-sm font-medium min-w-[140px] text-center">
                    {MESES[calendarMonth.month]} {calendarMonth.year}
                  </span>
                  <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                {/* Calendar grid */}
                <div className="grid grid-cols-8 gap-1 text-xs">
                  {/* Header */}
                  {DIAS_SEMANA.map(d => (
                    <div key={d} className="text-center text-slate-500 font-medium py-1">{d}</div>
                  ))}
                  <div className="text-center text-slate-500 font-medium py-1">Sem</div>

                  {/* Days */}
                  {(() => {
                    const { year, month } = calendarMonth;
                    const daysInMonth = getDaysInMonth(year, month);
                    const firstWeekday = getWeekday(year, month, 1);
                    const cells = [];
                    let weekPts = 0;

                    // Empty cells before first day
                    for (let i = 0; i < firstWeekday; i++) {
                      cells.push(<div key={`empty-${i}`} className="h-12" />);
                    }

                    for (let day = 1; day <= daysInMonth; day++) {
                      const data = calendarData[day];
                      const dayPts = data ? data.pts : 0;
                      weekPts += dayPts;
                      const intensity = maxCalendarPts > 0 ? dayPts / maxCalendarPts : 0;
                      const isToday = (() => { const t = today(); return year === t.getUTCFullYear() && month === t.getUTCMonth() && day === t.getUTCDate(); })();
                      const isSelectedDay = selectedDay === day;
                      const weekday = (firstWeekday + day - 1) % 7;

                      cells.push(
                        <div
                          key={`day-${day}`}
                          onClick={() => setSelectedDay(isSelectedDay ? null : day)}
                          className={`h-12 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all border ${
                            isSelectedDay
                              ? 'border-blue-400 bg-blue-500/20'
                              : isToday
                              ? 'border-emerald-500/50 bg-emerald-500/10'
                              : 'border-transparent hover:border-slate-600'
                          }`}
                          style={dayPts > 0 ? { backgroundColor: `rgba(16, 185, 129, ${0.08 + intensity * 0.35})` } : {}}
                        >
                          <span className={`text-[11px] ${isToday ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>{day}</span>
                          {dayPts > 0 && (
                            <span className="text-[10px] font-medium text-emerald-300 mt-0.5">{dayPts % 1 === 0 ? dayPts : dayPts.toFixed(1)}</span>
                          )}
                        </div>
                      );

                      // Weekly total after Saturday or last day
                      if (weekday === 6 || day === daysInMonth) {
                        cells.push(
                          <div key={`week-${day}`} className="h-12 rounded-lg flex items-center justify-center bg-slate-800/50 border border-slate-700/30">
                            <span className="text-[10px] font-semibold text-blue-300">{weekPts > 0 ? fmtPts(weekPts) : '-'}</span>
                          </div>
                        );
                        weekPts = 0;
                        // Fill remaining cells in the last week
                        if (day === daysInMonth && weekday < 6) {
                          for (let j = weekday + 1; j < 7; j++) {
                            cells.push(<div key={`trail-${j}`} className="h-12" />);
                          }
                        }
                      }
                    }

                    return cells;
                  })()}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <span>Menos</span>
                  <div className="flex gap-1">
                    {[0.05, 0.15, 0.25, 0.35, 0.45].map((op, i) => (
                      <div key={i} className="w-4 h-4 rounded" style={{ backgroundColor: `rgba(16, 185, 129, ${op})` }} />
                    ))}
                  </div>
                  <span>Más puntos</span>
                </div>
              </div>

              {/* Day detail panel */}
              {selectedDay !== null && dayDetail.length > 0 && (
                <div className="border-t border-slate-800/60 px-4 py-3 bg-slate-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-blue-300">
                      Detalle {selectedDay} de {MESES[calendarMonth.month]} {calendarMonth.year}
                    </h3>
                    <button onClick={() => setSelectedDay(null)} className="text-slate-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 uppercase">
                          <th className="px-3 py-1.5 text-left">Técnico</th>
                          <th className="px-3 py-1.5 text-center">Órdenes</th>
                          <th className="px-3 py-1.5 text-center">Pts Base</th>
                          <th className="px-3 py-1.5 text-center">Pts Deco</th>
                          <th className="px-3 py-1.5 text-center">Pts Repetidor</th>
                          <th className="px-3 py-1.5 text-center">Pts Teléfono</th>
                          <th className="px-3 py-1.5 text-center font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayDetail.map(t => (
                          <tr key={t.nombre} className="border-b border-slate-800/30">
                            <td className="px-3 py-1.5 text-slate-200">{t.nombre}</td>
                            <td className="px-3 py-1.5 text-center text-slate-300">{t.ordenes}</td>
                            <td className="px-3 py-1.5 text-center text-sky-300">{fmtPts(t.ptsBase)}</td>
                            <td className="px-3 py-1.5 text-center text-violet-300">{fmtPts(t.ptsDeco)}</td>
                            <td className="px-3 py-1.5 text-center text-teal-300">{fmtPts(t.ptsRepetidor)}</td>
                            <td className="px-3 py-1.5 text-center text-orange-300">{fmtPts(t.ptsTelefono)}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-emerald-400">{fmtPts(t.ptsTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* ──── 8. TABLA DE DATOS ──── */}
            <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-800/60 overflow-hidden">
              <div
                className="px-4 py-3 border-b border-slate-800/60 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setShowRawData(!showRawData)}
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                  <h2 className="font-semibold text-lg">Tabla de Datos</h2>
                  <span className="text-xs text-slate-500 ml-2">{filteredData.length} registros</span>
                </div>
                <div className="flex items-center gap-2">
                  {showRawData ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  {showRawData ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {showRawData && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-800/50 text-slate-400 uppercase">
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Técnico</th>
                          <th className="px-3 py-2 text-left">Actividad</th>
                          <th className="px-3 py-2 text-left">LPU Descripción</th>
                          <th className="px-3 py-2 text-center">Pts Base</th>
                          <th className="px-3 py-2 text-center">Pts Deco</th>
                          <th className="px-3 py-2 text-center">Pts Repetidor</th>
                          <th className="px-3 py-2 text-center">Pts Teléfono</th>
                          <th className="px-3 py-2 text-center font-bold">Pts Total</th>
                          <th className="px-3 py-2 text-left">Ciudad</th>
                          <th className="px-3 py-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rawDataPage.map((r, i) => (
                          <tr key={i} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                            <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                            <td className="px-3 py-1.5 text-slate-200 max-w-[150px] truncate">{r.Recurso || '-'}</td>
                            <td className="px-3 py-1.5 text-slate-300 max-w-[120px] truncate">{r.Actividad || '-'}</td>
                            <td className="px-3 py-1.5 text-slate-300 max-w-[200px] truncate">{r.Desc_LPU_Base || '-'}</td>
                            <td className="px-3 py-1.5 text-center text-sky-300">{fmtPts(r.Pts_Actividad_Base)}</td>
                            <td className="px-3 py-1.5 text-center text-violet-300">{fmtPts(r.Pts_Deco_Adicional)}</td>
                            <td className="px-3 py-1.5 text-center text-teal-300">{fmtPts(r.Pts_Repetidor_WiFi)}</td>
                            <td className="px-3 py-1.5 text-center text-orange-300">{fmtPts(r.Pts_Telefono)}</td>
                            <td className="px-3 py-1.5 text-center font-semibold text-emerald-400">{fmtPts(r.Pts_Total_Baremo)}</td>
                            <td className="px-3 py-1.5 text-slate-400">{r.Ciudad || '-'}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">{r.Estado}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalRawPages > 1 && (
                    <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        Mostrando {rawPage * RAW_PAGE_SIZE + 1}-{Math.min((rawPage + 1) * RAW_PAGE_SIZE, filteredData.length)} de {filteredData.length}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setRawPage(p => Math.max(0, p - 1))}
                          disabled={rawPage === 0}
                          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-400 px-2">
                          {rawPage + 1} / {totalRawPages}
                        </span>
                        <button
                          onClick={() => setRawPage(p => Math.min(totalRawPages - 1, p + 1))}
                          disabled={rawPage >= totalRawPages - 1}
                          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, sublabel, color }) => {
  const colors = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-700/40 text-emerald-400',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-700/40 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-700/40 text-purple-400',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-700/40 text-amber-400'
  };
  const c = colors[color] || colors.emerald;
  return (
    <div className={`bg-gradient-to-br ${c} rounded-xl border p-4 backdrop-blur-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-bold">{value}</div>
      <p className="text-xs text-slate-500 mt-1">{sublabel}</p>
    </div>
  );
};

const TechDetailPanel = ({ detail, onClose }) => {
  const d = detail;
  const totalWithExtras = d.ptsBase + d.ptsExtras;
  const basePercent = totalWithExtras > 0 ? (d.ptsBase / totalWithExtras) * 100 : 0;
  const decoPercent = totalWithExtras > 0 ? (d.ptsDeco / totalWithExtras) * 100 : 0;
  const repPercent = totalWithExtras > 0 ? (d.ptsRepetidor / totalWithExtras) * 100 : 0;
  const telPercent = totalWithExtras > 0 ? (d.ptsTelefono / totalWithExtras) * 100 : 0;

  return (
    <div className="bg-slate-800/60 border-t border-b border-emerald-700/30 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-emerald-300 flex items-center gap-2">
          <Star className="w-4 h-4" />
          Detalle: {d.nombre}
        </h3>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total Órdenes" value={d.totalOrdenes} color="text-slate-200" />
        <MiniStat label="Total Pts" value={fmtPts(d.totalPts)} color="text-emerald-400" />
        <MiniStat label="Promedio/Día" value={fmtPts(d.promDia)} color="text-blue-400" />
        <MiniStat label="Días Activos" value={d.diasActivos} color="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily evolution */}
        <div className="lg:col-span-2">
          <h4 className="text-xs text-slate-400 uppercase font-medium mb-2">Evolución Diaria</h4>
          <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-500 uppercase">
                  <th className="px-2 py-1.5 text-left">Fecha</th>
                  <th className="px-2 py-1.5 text-center">Órdenes</th>
                  <th className="px-2 py-1.5 text-center">Pts Base</th>
                  <th className="px-2 py-1.5 text-center">Pts Extras</th>
                  <th className="px-2 py-1.5 text-center font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {d.dailyEvolution.map((day, i) => (
                  <tr key={i} className="border-b border-slate-700/30">
                    <td className="px-2 py-1 text-slate-300">{fmtDate(day.fecha)}</td>
                    <td className="px-2 py-1 text-center text-slate-300">{day.ordenes}</td>
                    <td className="px-2 py-1 text-center text-sky-300">{fmtPts(day.ptsBase)}</td>
                    <td className="px-2 py-1 text-center text-violet-300">{fmtPts(day.ptsExtras)}</td>
                    <td className="px-2 py-1 text-center font-semibold text-emerald-400">{fmtPts(day.ptsTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: composition + top activities */}
        <div className="space-y-4">
          {/* Points composition */}
          <div>
            <h4 className="text-xs text-slate-400 uppercase font-medium mb-2 flex items-center gap-1">
              <PieChart className="w-3 h-3" /> Composición de Puntos
            </h4>
            <div className="space-y-2">
              <CompositionBar label="Base" value={d.ptsBase} percent={basePercent} color="bg-sky-500" />
              <CompositionBar label="Deco" value={d.ptsDeco} percent={decoPercent} color="bg-violet-500" />
              <CompositionBar label="Repetidor" value={d.ptsRepetidor} percent={repPercent} color="bg-teal-500" />
              <CompositionBar label="Teléfono" value={d.ptsTelefono} percent={telPercent} color="bg-orange-500" />
            </div>
            {/* Stacked bar */}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex mt-2">
              {basePercent > 0 && <div className="h-full bg-sky-500" style={{ width: `${basePercent}%` }} />}
              {decoPercent > 0 && <div className="h-full bg-violet-500" style={{ width: `${decoPercent}%` }} />}
              {repPercent > 0 && <div className="h-full bg-teal-500" style={{ width: `${repPercent}%` }} />}
              {telPercent > 0 && <div className="h-full bg-orange-500" style={{ width: `${telPercent}%` }} />}
            </div>
          </div>

          {/* Top activities */}
          <div>
            <h4 className="text-xs text-slate-400 uppercase font-medium mb-2">Top Actividades</h4>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {d.topActivities.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-slate-700/30 rounded px-2 py-1.5">
                  <span className="text-slate-300 truncate max-w-[140px]" title={a.desc}>{a.desc}</span>
                  <div className="flex items-center gap-2 text-slate-400 whitespace-nowrap">
                    <span>{a.cantidad}x</span>
                    <span className="text-emerald-400 font-medium">{fmtPts(a.pts)} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, color }) => (
  <div className="bg-slate-700/30 rounded-lg p-2.5 text-center">
    <p className="text-[10px] text-slate-500 uppercase">{label}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
  </div>
);

const CompositionBar = ({ label, value, percent, color }) => (
  <div className="flex items-center gap-2 text-xs">
    <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
    <span className="text-slate-400 w-16">{label}</span>
    <span className="text-slate-300 font-medium w-12 text-right">{fmtPts(value)}</span>
    <span className="text-slate-500 w-10 text-right">{percent.toFixed(1)}%</span>
  </div>
);

export default Produccion;
