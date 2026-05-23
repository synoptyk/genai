import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocation } from 'react-router-dom';
import { telecomApi as api } from './telecomApi';
import { proyectosApi } from '../rrhh/rrhhApi';
import {
  RefreshCw, Filter, Download, Presentation, Layers,
  BarChart3, Trophy, Activity, Calendar, Users, Target,
  ChevronDown, Search, FileSpreadsheet, ListFilter
} from 'lucide-react';
import * as XLSX from 'xlsx';


import ProduccionDiaTable from './components/ProduccionDiaTable';
import ProduccionDashboard from './components/ProduccionDashboard';
import ProduccionSemanal from './components/ProduccionSemanal';
import ProduccionActividades from './components/ProduccionActividades';
import ProduccionProyectos from './components/ProduccionProyectos';
import ProduccionZonas from './components/ProduccionZonas';
import DashboardSeguimientoDia from './components/DashboardSeguimientoDia';

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
  { id: 'resumen',       label: 'Resumen',        icon: Presentation },
  { id: 'produccion',   label: 'Producción/Día',  icon: Layers },
  { id: 'seguimiento',  label: 'Dashboard Seg. Día', icon: Activity },
  { id: 'ranking',      label: 'Ranking',         icon: Trophy },
  { id: 'semanal',      label: 'Semanal',         icon: BarChart3 },
  { id: 'actividades',  label: 'Actividades',     icon: Activity },
  { id: 'proyectos',    label: 'Proyectos',       icon: Target },
  { id: 'zonas',        label: 'Zonas',           icon: Users },
];

// ─── Meses disponibles ────────────────────────────────────────────────────────
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

// ─── Semanas ─────────────────────────────────────────────────────────────────
const WEEK_OPTIONS = ['Todas', 'S1', 'S2', 'S3', 'S4', 'S5'];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Produccion() {
  const { user } = useAuth();
  const location = useLocation();

  // Filters
  const [dateFrom, setDateFrom] = useState(toInputDate(firstDayOfMonth()));
  const [dateTo,   setDateTo]   = useState(toInputDate(todayUTC()));
  const [selectedMonths,   setSelectedMonths]   = useState([]);
  const [selectedWeeks,    setSelectedWeeks]    = useState([]);
  const [selectedProyectos, setSelectedProyectos] = useState([]);
  const [selectedEstados,   setSelectedEstados]   = useState(['Completado']);
  const [actividadFilter,  setActividadFilter]  = useState('');
  const [searchTech,       setSearchTech]       = useState('');
  const [showFilters,      setShowFilters]       = useState(false);
  const [showEstadoFilters, setShowEstadoFilters] = useState(false);
  
  const [selectedZonas,    setSelectedZonas]    = useState([]);
  const [selectedTecnicos, setSelectedTecnicos] = useState([]);
  const [selectedCategorias, setSelectedCategorias] = useState([]);
  const [showZonasFilters, setShowZonasFilters] = useState(false);
  const [showTecnicosFilters, setShowTecnicosFilters] = useState(false);
  const [showCategoriasFilters, setShowCategoriasFilters] = useState(false);
  
  const [availableZonas, setAvailableZonas] = useState([]);
  const [availableTecnicos, setAvailableTecnicos] = useState([]);

  // Data
  const [serverData,   setServerData]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState(null);
  const [availableProyectos, setAvailableProyectos] = useState([]);

  // UI
  const [activeTab, setActiveTab] = useState('produccion');
  const [activeDiagnostic, setActiveDiagnostic] = useState(null);

  // Dashboard data derived
  const [dashboardData, setDashboardData] = useState(null);

  // Sync from location.state (navegación desde DescargaTOA)
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

  // Fetch datos de producción
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        desde: dateFrom,
        hasta: dateTo,
        estado: selectedEstados.length > 0 ? selectedEstados.join(',') : 'todos',
        type: '',
        months: selectedMonths.join(','),
        weeks: selectedWeeks.join(','),
        proyectos: selectedProyectos.join(','),
        actividad: actividadFilter,
        zonas: selectedZonas.join(','),
        tecnicos: selectedTecnicos.join(','),
        categorias: selectedCategorias.join(','),
      };

      const res = await api.get('/bot/produccion-stats', { params });
      const d = res.data;
      setServerData(d);
      setLastRefresh(new Date());

      // Construir dashboardData desde la respuesta del servidor
      const techList = d.tecnicos || d.techRanking || [];
      setDashboardData({
        techRanking: techList
          .map(t => ({ 
            name: t.name || t.fullName || 'Sin Nombre', 
            pts: t.ptsTotal || t.monthTotal || 0,
            status: t.status,
            activeDays: t.activeDays || 0
          }))
          .sort((a, b) => b.pts - a.pts),
        techStats: techList.map(t => ({
          name: t.name || t.fullName,
          daysWorked: t.activeDays || 0,
        })),
        projectionData: d.projectionData || [],
        elapsedDays: d.stats?.uniqueDays || d.productiveDaysCount || d.elapsedDays || 0,
        guaranteedMetaTechs: d.guaranteedMetaTechs || 0,
        calendarData: d.calendar || {},
      });

    } catch (err) {
      console.error('❌ Error cargando producción:', err);
      console.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedEstados, actividadFilter, selectedMonths, selectedWeeks, selectedProyectos, selectedZonas, selectedTecnicos, selectedCategorias]);

  useEffect(() => {
    if (serverData) {
      if (selectedZonas.length === 0) {
        setAvailableZonas(Object.keys(serverData.cities || {}).sort());
      }
      if (selectedTecnicos.length === 0) {
        setAvailableTecnicos(serverData.tecnicos || []);
      }
    }
  }, [serverData, selectedZonas.length, selectedTecnicos.length]);

  // Cascada de filtros: Si cambia la zona, limpiar los técnicos seleccionados
  // Esto obliga a que la lista de availableTecnicos se re-calcule con la nueva zona.
  useEffect(() => {
    setSelectedTecnicos([]);
  }, [selectedZonas]);

  // Fetch inicial y al cambiar filtros
  const fetchTimer = useRef(null);
  useEffect(() => {
    clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(fetchData, 300);
    return () => clearTimeout(fetchTimer.current);
  }, [fetchData]);

  // Exportar Excel
  const handleExportExcel = () => {
    if (!serverData?.tecnicos?.length) return;
    
    // Sanear datos para el Excel: Solo columnas planas y útiles
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
    XLSX.utils.book_append_sheet(wb, ws, 'Producción_Consolidada');
    XLSX.writeFile(wb, `auditoria_produccion_${dateFrom}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Derivar datos para ProduccionDiaTable
  const tecnicos   = serverData?.tecnicos   || [];
  const stats      = serverData?.stats      || {};
  const metaConfig = serverData?.metaConfig || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── HEADER BAR ──────────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white border-b border-slate-700 shadow-xl">
        <div className="max-w-full px-4 py-2 flex items-center gap-3 flex-wrap">

          {/* Badge Telecom Premium */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-white/10">
            <Activity size={10} className="animate-pulse" />
            TELECOM PREMIUM
          </div>

          {/* Buscador Global en Franja */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-600/50 px-3 py-1.5 rounded-xl text-[10px] text-slate-300 w-full max-w-[220px] focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
            <Search size={11} className="text-slate-500" />
            <input
              type="text"
              placeholder="Buscar especialista..."
              value={searchTech}
              onChange={e => setSearchTech(e.target.value)}
              className="bg-transparent outline-none text-white font-bold placeholder:text-slate-500 w-full"
            />
          </div>

          {/* Proyectos */}
          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer transition-all" onClick={() => setShowFilters(f => !f)}>
            <Filter size={11} className="text-indigo-400" />
            <span className="font-bold">
              {selectedProyectos.length === 0
                ? 'Lista de Proyectos'
                : `${selectedProyectos.length} Proyecto(s)`}
            </span>
            <ChevronDown size={11} className="text-slate-400" />
            {showFilters && availableProyectos.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[200px] p-2">
                {availableProyectos.map(p => (
                  <label key={p} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedProyectos.includes(p)}
                      onChange={() => setSelectedProyectos(prev =>
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      )}
                      className="accent-indigo-500"
                    />
                    {p}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Zonas */}
          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer transition-all" onClick={() => setShowZonasFilters(f => !f)}>
            <Filter size={11} className="text-indigo-400" />
            <span className="font-bold">
              {selectedZonas.length === 0
                ? 'Lista de Zonas'
                : `${selectedZonas.length} Zona(s)`}
            </span>
            <ChevronDown size={11} className="text-slate-400" />
            {showZonasFilters && availableZonas.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[200px] max-h-60 overflow-y-auto p-2" onClick={e => e.stopPropagation()}>
                {availableZonas.map(z => (
                  <label key={z} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedZonas.includes(z)}
                      onChange={() => setSelectedZonas(prev =>
                        prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]
                      )}
                      className="accent-indigo-500"
                    />
                    {z}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Técnicos */}
          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer transition-all" onClick={() => setShowTecnicosFilters(f => !f)}>
            <Users size={11} className="text-indigo-400" />
            <span className="font-bold">
              {selectedTecnicos.length === 0
                ? 'Lista de Técnicos'
                : `${selectedTecnicos.length} Técnico(s)`}
            </span>
            <ChevronDown size={11} className="text-slate-400" />
            {showTecnicosFilters && availableTecnicos.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[280px] max-h-60 overflow-y-auto p-2" onClick={e => e.stopPropagation()}>
                {availableTecnicos.map(t => {
                  const techId = t.idRecursoToa || t.name;
                  return (
                    <label key={techId} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px] text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedTecnicos.includes(techId)}
                        onChange={() => setSelectedTecnicos(prev =>
                          prev.includes(techId) ? prev.filter(x => x !== techId) : [...prev, techId]
                        )}
                        className="accent-indigo-500"
                      />
                      {t.idRecursoToa} - {t.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mes */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300">
            <Calendar size={11} className="text-indigo-400" />
            <select
              value={selectedMonths[0] || ''}
              onChange={e => setSelectedMonths(e.target.value ? [e.target.value] : [])}
              className="bg-transparent outline-none text-white font-bold cursor-pointer"
            >
              <option value="" className="bg-slate-900">Mes: Actual</option>
              {MONTH_OPTIONS.map(m => (
                <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer transition-all" onClick={() => setShowEstadoFilters(f => !f)}>
            <Activity size={11} className="text-indigo-400" />
            <span className="font-bold">
              {selectedEstados.length === 0
                ? 'Estado: Todos'
                : `${selectedEstados.length} Estado(s)`}
            </span>
            <ChevronDown size={11} className="text-slate-400" />
            {showEstadoFilters && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[200px] p-2 max-h-60 overflow-y-auto" onClick={e => e.stopPropagation()}>
                {(serverData?.estados?.map(e => e.estado) || ['Completado', 'Cancelado', 'Pendiente', 'No Realizado', 'No Realizada']).map(st => (
                  <label key={st} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedEstados.includes(st)}
                      onChange={() => setSelectedEstados(prev =>
                        prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]
                      )}
                      className="accent-indigo-500"
                    />
                    {st}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Categorías (Altas/Inst, Rutinas, Reparaciones) */}
          <div className="relative flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 cursor-pointer transition-all" onClick={() => setShowCategoriasFilters(f => !f)}>
            <ListFilter size={11} className="text-indigo-400" />
            <span className="font-bold">
              {selectedCategorias.length === 0
                ? 'Categorías: Todas'
                : `${selectedCategorias.length} Categoría(s)`}
            </span>
            <ChevronDown size={11} className="text-slate-400" />
            {showCategoriasFilters && (
              <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50 min-w-[200px] p-2 max-h-60 overflow-y-auto" onClick={e => e.stopPropagation()}>
                {['Altas/Inst', 'Rutinas', 'Reparaciones'].map(cat => (
                  <label key={cat} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 rounded-lg cursor-pointer text-[10px] text-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedCategorias.includes(cat)}
                      onChange={() => setSelectedCategorias(prev =>
                        prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat]
                      )}
                      className="accent-indigo-500"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actividad */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 max-w-[150px]">
            <Layers size={11} className="text-indigo-400" />
            <select
              value={actividadFilter}
              onChange={e => setActividadFilter(e.target.value)}
              className="bg-transparent outline-none text-white font-bold cursor-pointer w-full"
            >
              <option value="" className="bg-slate-900">Actividad: Todas</option>
              {serverData?.lpuActivities?.slice(0, 15).map(act => (
                <option key={act.desc} value={act.desc} className="bg-slate-900">
                  {act.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de fechas */}
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 px-3 py-1.5 rounded-lg text-[10px] text-slate-300">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent outline-none text-white font-bold [color-scheme:dark] w-28"
            />
            <span className="text-slate-500">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent outline-none text-white font-bold [color-scheme:dark] w-28"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Base Auditoría */}
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all group"
              title="Descargar resumen de auditoría técnicos"
            >
              <FileSpreadsheet size={11} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              Auditoría
            </button>

            {/* Base Operativa */}
            <button
              onClick={() => {
                // Generando Base de Datos...
                api.get('/bot/exportar-toa', { 
                  params: { desde: dateFrom, hasta: dateTo, mode: 'raw' },
                  responseType: 'blob'
                }).then(res => {
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `base_operativa_${dateFrom}_${dateTo}.xlsx`);
                  document.body.appendChild(link);
                  link.click();
                  alert('Descarga iniciada');
                }).catch(err => {
                  console.error(err);
                  alert('Error al exportar');
                });
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 group"
              title="Descargar base de datos operativa (cruda)"
            >
              <Download size={11} className="text-white group-hover:animate-bounce" />
              Base Operativa
            </button>

            {/* Actualizar */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
        </div>

        {/* ── TABS ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 px-4 pb-0 border-t border-slate-700/50">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <tab.icon size={11} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENIDO ───────────────────────────────────────────────── */}
      <div className="p-4">
        {/* Resumen ejecutivo */}
        {activeTab === 'resumen' && (
          <ProduccionDashboard 
            dashboardData={dashboardData} 
            metaConfig={metaConfig}
            stats={stats}
            tecnicos={tecnicos}
            clientProjects={serverData?.clientProjects || []}
            cities={serverData?.cities || {}}
            dateFrom={dateFrom}
            lpuActivities={serverData?.lpuActivities || []}
          />
        )}

        {/* Producción/Día - tabla principal */}
        {activeTab === 'produccion' && (
          <ProduccionDiaTable
            tecnicos={tecnicos}
            stats={stats}
            metaConfig={metaConfig}
            dateFrom={dateFrom}
            selectedMonths={selectedMonths}
            selectedWeeks={selectedWeeks}
            searchTech={searchTech}
            setSearchTech={setSearchTech}
            setActiveDiagnostic={setActiveDiagnostic}
          />
        )}

        {/* Ranking */}
        {activeTab === 'ranking' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-amber-500" />
              Ranking de Especialistas
            </h2>
            {tecnicos.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-sm">No hay datos para el período seleccionado</div>
            ) : (
              <div className="space-y-2">
                {[...tecnicos]
                  .filter(t => !searchTech || (t.name || t.fullName || '').toLowerCase().includes(searchTech.toLowerCase()))
                  .sort((a, b) => (b.monthTotal || b.ptsTotal || 0) - (a.monthTotal || a.ptsTotal || 0))
                  .map((t, i) => {
                    const pts = t.monthTotal || t.ptsTotal || 0;
                    const meta = (metaConfig.metaProduccionDia || 7.5) * (serverData?.productiveDaysCount || 22);
                    const pct = meta > 0 ? Math.min(100, (pts / meta) * 100) : 0;
                    return (
                      <div key={t.name || i} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all border border-transparent hover:border-indigo-100">
                        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-slate-700' : i === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-bold text-slate-800 flex-1">{t.name || t.fullName}</span>
                        <span className="text-xs text-slate-500">{t.proyecto || '—'}</span>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="h-2 bg-slate-200 rounded-full flex-1 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] font-black text-indigo-600 w-10 text-right">{pts.toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Semanal */}
        {activeTab === 'semanal' && (
          <ProduccionSemanal 
            calendar={serverData?.calendar || {}} 
            clientProjects={serverData?.clientProjects || []} 
          />
        )}

        {/* Actividades */}
        {activeTab === 'actividades' && (
          <ProduccionActividades 
            lpuActivities={serverData?.lpuActivities || []} 
          />
        )}

        {/* Proyectos */}
        {activeTab === 'proyectos' && (
          <ProduccionProyectos 
            clientProjects={(serverData?.clientProjects || []).map(cp => {
              const metaDiaria = serverData?.metaConfig?.metaProduccionDia || 7.5;
              const projectMeta = (serverData?.tecnicos || [])
                .filter(t => t.proyecto === cp.proyecto)
                .reduce((acc, t) => acc + ((t.activeDays || 0) * metaDiaria), 0);
              return { ...cp, metaEsperada: projectMeta };
            })} 
          />
        )}

        {/* Zonas */}
        {activeTab === 'zonas' && (
          <ProduccionZonas 
            cities={serverData?.cities || {}} 
          />
        )}

        {/* Seguimiento Día */}
        {activeTab === 'seguimiento' && (
          <DashboardSeguimientoDia
            tecnicos={tecnicos}
            dateFrom={dateFrom}
            selectedMonths={selectedMonths}
            metaConfig={metaConfig}
          />
        )}
      </div>

      {/* ── MODAL DIAGNÓSTICO ────────────────────────────────────────── */}
      {activeDiagnostic && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden">
            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl ${activeDiagnostic.pct < 0.5 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                  <Activity size={24} className="animate-pulse" />
                </div>
                <button onClick={() => setActiveDiagnostic(null)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors">
                   <ChevronDown size={24} />
                </button>
              </div>
              
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">{activeDiagnostic.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">ID TOA: {activeDiagnostic.id}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Promedio Actual</p>
                  <p className="text-2xl font-black text-indigo-600">{activeDiagnostic.avg} pts</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Diaria</p>
                  <p className="text-2xl font-black text-slate-800">{activeDiagnostic.meta} pts</p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-1 rounded-full ${activeDiagnostic.pct < 0.5 ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  <p className="text-sm font-medium text-slate-600 leading-relaxed italic">
                    "{activeDiagnostic.message}"
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setActiveDiagnostic(null)}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
              >
                Entendido, Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Botón Generar Auditoría Flotante ─────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleExportExcel}
          disabled={!serverData?.tecnicos?.length}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-900/40 transition-all hover:scale-105"
        >
          <FileSpreadsheet size={14} />
          Generar Auditoría Excel
        </button>
      </div>
    </div>
  );
}
