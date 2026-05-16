
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { telecomApi as api } from './telecomApi';
import { proyectosApi } from '../rrhh/rrhhApi';
import {
  RefreshCw, Filter, Download, Presentation, Layers,
  BarChart3, Trophy, Activity, Calendar, Users, Target,
  ChevronDown, Search, FileSpreadsheet, DollarSign, TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

// Financial Components
import FinancialDiaTable from './finanzas_components/FinancialDiaTable';
import FinancialDashboard from './finanzas_components/FinancialDashboard';
import FinancialSemanal from './finanzas_components/FinancialSemanal';
import FinancialActividades from './finanzas_components/FinancialActividades';
import FinancialProyectos from './finanzas_components/FinancialProyectos';
import FinancialZonas from './finanzas_components/FinancialZonas';

// Utils
import { getBaremo, formatCLP } from './utils/financialUtils';

// ─── Helpers ────────────────────────────────────────────────────────────────
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
const todayUTC = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
};

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'resumen',       label: 'Resumen Financiero', icon: Presentation },
  { id: 'produccion',   label: 'Producción/Día (CLP)', icon: DollarSign },
  { id: 'ranking',      label: 'Ranking Ingresos',    icon: Trophy },
  { id: 'semanal',      label: 'Evolución Semanal',  icon: BarChart3 },
  { id: 'actividades',  label: 'Mix Actividades',     icon: Activity },
  { id: 'proyectos',    label: 'Rentabilidad Proy.',  icon: Target },
  { id: 'zonas',        label: 'Zonas Geográficas',   icon: Users },
];

const buildMonthOptions = () => {
  const opts = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ label, value });
  }
  return opts;
};
const MONTH_OPTIONS = buildMonthOptions();

export default function ProduccionVenta() {
  const { user } = useAuth();
  const location = useLocation();

  // Filters
  const [dateFrom, setDateFrom] = useState(toInputDate(firstDayOfMonth()));
  const [dateTo,   setDateTo]   = useState(toInputDate(todayUTC()));
  const [selectedMonths,   setSelectedMonths]   = useState([]);
  const [selectedProyectos, setSelectedProyectos] = useState([]);
  const [estadoFilter,     setEstadoFilter]     = useState('Completado');
  const [searchTech,       setSearchTech]       = useState('');
  const [showFilters,      setShowFilters]       = useState(false);

  // Data
  const [serverData,   setServerData]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [availableProyectos, setAvailableProyectos] = useState([]);

  // UI
  const [activeTab, setActiveTab] = useState('resumen');
  const [dashboardData, setDashboardData] = useState(null);

  // Sync from location.state
  useEffect(() => {
    if (location.state?.desde) setDateFrom(location.state.desde);
    if (location.state?.hasta) setDateTo(location.state.hasta);
    if (location.state?.proyectos) setSelectedProyectos(location.state.proyectos);
  }, [location.state]);

  // Cargar proyectos disponibles
  useEffect(() => {
    proyectosApi.getAll()
      .then(res => {
        const list = res.data || [];
        setAvailableProyectos(
          list.map(p => p.nombreProyecto || p.projectName || p.nombre || p.name || '').filter(Boolean)
        );
      })
      .catch(() => {});
  }, []);

  // Fetch datos (Using Telecom endpoint for parity and accuracy)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        desde: dateFrom,
        hasta: dateTo,
        estado: estadoFilter,
        months: selectedMonths.join(','),
        proyectos: selectedProyectos.join(','),
      };

      const res = await api.get('/bot/produccion-stats', { params });
      const d = res.data;
      setServerData(d);

      const techList = d.tecnicos || [];
      const transformedDashboardData = {
        techRanking: techList.map(t => {
          const baremo = getBaremo(t.proyecto || t.cliente);
          return {
            name: t.name || t.fullName,
            clp: t.facturacion || (t.ptsTotal * baremo),
            activeDays: t.activeDays || 0,
            status: t.status
          };
        }).sort((a,b) => b.clp - a.clp),
        elapsedDays: d.stats?.uniqueDays || d.elapsedDays || 0,
        calendarData: Object.entries(d.calendar || {}).reduce((acc, [date, dayData]) => {
          const baremo = getBaremo('DEFAULT');
          acc[date] = {
            clp: dayData.clp || (dayData.pts * baremo),
            orders: dayData.orders
          };
          return acc;
        }, {}),
        guaranteedMetaTechs: d.guaranteedMetaTechs || 0,
        techStats: techList.map(t => ({ name: t.name || t.fullName, daysWorked: t.activeDays || 0 })),
      };
      setDashboardData(transformedDashboardData);

    } catch (err) {
      console.error('❌ Error cargando producción financiera:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, estadoFilter, selectedMonths, selectedProyectos]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  // Auditoría Excel (The exact one the user loves)
  const handleExportExcel = () => {
    if (!serverData?.tecnicos?.length) return;
    const exportData = serverData.tecnicos.map(t => ({
      'Especialista': t.name || t.fullName || '—',
      'ID TOA': t.idRecursoToa || '—',
      'Proyecto': t.proyecto || '—',
      'CECO': t.ceco || '—',
      'Sede': t.sede || '—',
      'Estado': t.status || t.estado || 'Activo',
      'Órdenes Totales': t.orders || 0,
      'Puntos Base': t.ptsBase || 0,
      'Puntos Deco': t.ptsDeco || 0,
      'Puntos Repetidor': t.ptsRepetidor || 0,
      'Puntos Teléfono': t.ptsTelefono || 0,
      'Puntos Totales': t.ptsTotal || 0,
      'Días con Producción Realizada': t.activeDays || 0,
      'Promedio Diario': t.avgPerDay || 0,
      'Facturación Bruta': t.facturacion || 0,
      'Retención': t.retencion || 0,
      'Facturación Neta': t.facturacionNeta || 0,
      'RR %': t.rrRealPercent ? `${t.rrRealPercent.toFixed(1)}%` : '0%'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría_Financiera');
    XLSX.writeFile(wb, `auditoria_financiera_${dateFrom}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const stats = serverData?.stats || {};
  const metaConfig = serverData?.metaConfig || {};
  const tecnicos = serverData?.tecnicos || [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── HEADER ── */}
      <div className="bg-slate-900 text-white border-b border-slate-700 shadow-xl">
        <div className="max-w-full px-4 py-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-white/10">
            <DollarSign size={10} className="animate-pulse" />
            PRODUCCIÓN FINANCIERA
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-600/50 px-3 py-1.5 rounded-xl text-[10px] text-slate-300 w-full max-w-[220px]">
            <Search size={11} className="text-slate-500" />
            <input
              type="text"
              placeholder="Buscar especialista..."
              value={searchTech}
              onChange={e => setSearchTech(e.target.value)}
              className="bg-transparent outline-none text-white font-bold placeholder:text-slate-500 w-full"
            />
          </div>

          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={11} className="text-emerald-400" />
            <span className="font-bold">{selectedProyectos.length === 0 ? 'Lista de Proyectos' : `${selectedProyectos.length} Proy.`}</span>
            <ChevronDown size={11} />
            {showFilters && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[200px] p-2">
                {availableProyectos.map(p => (
                  <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px]">
                    <input type="checkbox" checked={selectedProyectos.includes(p)} onChange={() => setSelectedProyectos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])} className="accent-emerald-500" />
                    {p}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px]">
            <Calendar size={11} className="text-emerald-400" />
            <select value={selectedMonths[0] || ''} onChange={e => setSelectedMonths(e.target.value ? [e.target.value] : [])} className="bg-transparent outline-none text-white font-bold">
              <option value="">Mes: Actual</option>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px]">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent outline-none text-white font-bold [color-scheme:dark] w-28" />
            <span className="text-slate-500">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent outline-none text-white font-bold [color-scheme:dark] w-28" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleExportExcel} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
              <FileSpreadsheet size={11} className="text-emerald-400" />
              Auditoría
            </button>
            <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-4 pb-0 border-t border-slate-700/50">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${activeTab === tab.id ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="p-4">
        {activeTab === 'resumen' && <FinancialDashboard dashboardData={dashboardData} metaConfig={metaConfig} stats={stats} />}
        {activeTab === 'produccion' && (
          <FinancialDiaTable 
            tecnicos={tecnicos} 
            stats={stats} 
            metaConfig={metaConfig} 
            dateFrom={dateFrom} 
            selectedMonths={selectedMonths} 
            searchTech={searchTech} 
            setSearchTech={setSearchTech} 
          />
        )}
        {activeTab === 'ranking' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              Ranking de Ingresos por Especialista
            </h2>
            <div className="space-y-2">
              {dashboardData?.techRanking
                ?.filter(t => !searchTech || t.name.toLowerCase().includes(searchTech.toLowerCase()))
                .map((t, i) => {
                  const metaRef = (metaConfig.metaProduccionDia || 7.5) * (serverData?.productiveDaysCount || 22) * getBaremo(t.proyecto || 'DEFAULT');
                  const pct = metaRef > 0 ? Math.min(100, (t.clp / metaRef) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100">
                      <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                      <span className="text-sm font-bold text-slate-800 flex-1">{t.name}</span>
                      <div className="flex items-center gap-4 min-w-[150px]">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-black text-emerald-600 w-24 text-right">{formatCLP(t.clp)}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        {activeTab === 'semanal' && <FinancialSemanal calendar={dashboardData?.calendarData} />}
        {activeTab === 'actividades' && (
          <FinancialActividades 
            lpuActivities={(serverData?.lpuActivities || []).map(act => ({
              ...act,
              totalCLP: (act.totalPts || 0) * getBaremo('DEFAULT')
            }))} 
          />
        )}
        {activeTab === 'proyectos' && (
          <FinancialProyectos 
            clientProjects={(serverData?.clientProjects || []).map(cp => {
              const baremo = getBaremo(cp.proyecto || cp.cliente);
              const metaDiariaPts = metaConfig.metaProduccionDia || 7.5;
              const projectMetaPts = (serverData?.tecnicos || [])
                .filter(t => t.proyecto === cp.proyecto)
                .reduce((acc, t) => acc + ((t.activeDays || 0) * metaDiariaPts), 0);
              return { 
                ...cp, 
                clp: (cp.pts || 0) * baremo,
                avgFactDia: (cp.avgPerDay || 0) * baremo,
                metaEsperada: projectMetaPts * baremo
              };
            })} 
          />
        )}
        {activeTab === 'zonas' && (
          <FinancialZonas 
            cities={Object.entries(serverData?.cities || {}).reduce((acc, [name, data]) => {
              acc[name] = { ...data, clp: (data.pts || 0) * getBaremo('DEFAULT') };
              return acc;
            }, {})} 
          />
        )}
      </div>
    </div>
  );
}
