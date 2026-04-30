import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Activity, Search, FileSpreadsheet, TrendingUp, Users, Award,
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, Filter, RefreshCw, Star, Target,
  MapPin, BarChart3, Layers, Clock, Hash, Zap,
  ArrowUpDown, ArrowUp, ArrowDown, X, Eye, EyeOff,
  CheckCircle2, Thermometer, Grid3X3, Presentation, Maximize2, Minimize2,
  Wifi, Tv, Smartphone, Box, Package, Cpu, Fingerprint, Anchor, ArrowUpCircle, Database,
  BarChart, LayoutDashboard, Map, ClipboardList, Trophy, TrendingDown, Users as UsersIcon, FileText,
  Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { adminApi } from '../rrhh/rrhhApi';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const pts = (v) => parseFloat(v) || 0;

const getFeriadosChile = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + e * 2 + i * 2 - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(Date.UTC(year, month - 1, day));
  const viernesSanto = new Date(easter.getTime() - 2 * 86400000);
  const sabadoSanto = new Date(easter.getTime() - 1 * 86400000);

  const format = (d) => d.toISOString().split('T')[0];

  const holidays = [
    `${year}-01-01`, format(viernesSanto), format(sabadoSanto),
    `${year}-05-01`, `${year}-05-21`, `${year}-06-20`, `${year}-07-16`, 
    `${year}-08-15`, `${year}-09-18`, `${year}-09-19`, `${year}-11-01`, 
    `${year}-12-08`, `${year}-12-25`
  ];

  if (year === 2024 || year === 2025 || year === 2026) {
     if (year === 2026) holidays.push(`${year}-06-21`);
  }

  const applyMovableRule = (dateStr) => {
    const d = new Date(`${dateStr}T00:00:00Z`);
    const dow = d.getUTCDay();
    if (dow === 2) d.setUTCDate(d.getUTCDate() - 1);
    else if (dow === 3) d.setUTCDate(d.getUTCDate() - 2);
    else if (dow === 4) d.setUTCDate(d.getUTCDate() - 3);
    else if (dow === 5) d.setUTCDate(d.getUTCDate() + 3);
    return format(d);
  };

  holidays.push(applyMovableRule(`${year}-06-29`));
  holidays.push(applyMovableRule(`${year}-10-12`));

  const oct31 = new Date(`${year}-10-31T00:00:00Z`);
  const oct31Dow = oct31.getUTCDay();
  if (oct31Dow === 2) oct31.setUTCDate(30);
  else if (oct31Dow === 3) oct31.setUTCDate(oct31.getUTCDate() + 2);
  holidays.push(format(oct31));

  const sep18 = new Date(`${year}-09-18T00:00:00Z`);
  const sep18Dow = sep18.getUTCDay();
  if (sep18Dow === 2) holidays.push(`${year}-09-17`);
  if (sep18Dow === 4) holidays.push(`${year}-09-20`);

  return holidays;
};
const fmtPts = (v) => {
  const n = typeof v === 'number' ? v : pts(v);
  return n % 1 === 0
    ? n.toLocaleString('es-CL')
    : n.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
};

// Helper para contar d\u00EDas h\u00E1biles (Lunes a Viernes) transcurridos en un rango
const countBusinessDays = (startStr, endStr) => {
  if (!startStr || !endStr) return 0;
  // Usar mediod\u00EDa para evitar problemas de zona horaria al iterar
  const start = new Date(startStr + 'T12:00:00Z');
  const end = new Date(endStr + 'T12:00:00Z');
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const actualEnd = end > today ? today : end;
  if (start > actualEnd) return 0;

  let count = 0;
  let cur = new Date(start);
  while (cur <= actualEnd) {
    const day = cur.getUTCDay();
    // En este sistema, solo el Domingo (0) se considera no laboral por defecto para la meta
    if (day !== 0) count++; 
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
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
  if (!dateStr) return new Date(NaN);
  let d = new Date(dateStr);
  
  // Soporte para formato DD/MM/YYYY si falla el constructor nativo
  if (isNaN(d.getTime()) && typeof dateStr === 'string' && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // Asumimos DD/MM/YYYY
      d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
      return d;
    }
  }

  if (isNaN(d.getTime())) return d;
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

const toExcelVal = (val) => {
  if (typeof val === 'number') return val;
  // Si es un número en string, intentamos convertirlo
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)) && /^-?\d+(\.\d+)?$/.test(val)) {
    return Number(val);
  }
  return val;
};
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
    ? "group relative bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-lg transition-all duration-500 hover:shadow-indigo-500/20 hover:scale-[1.02] overflow-hidden flex flex-col justify-between h-full"
    : "group relative bg-white/90 backdrop-blur-xl border border-slate-200 rounded-xl p-3 shadow-md transition-all duration-500 hover:shadow-lg hover:border-indigo-300 hover:scale-[1.02] overflow-hidden flex flex-col justify-between h-full";

  const labelClasses = dark ? "text-indigo-400" : "text-indigo-600";
  const valueClasses = dark ? "text-white" : "text-slate-900";
  const metaClasses = dark ? "text-slate-400" : "text-slate-700";

  return (
    <div className={cardClasses}>
      <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${theme.bg} opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-1000 blur-3xl -mr-24 -mt-24`} />

      <div className="relative z-10">
        <div className={`flex items-start justify-between mb-3`}>
          <div className={`p-2 rounded-lg border shadow-sm ${theme.icon} group-hover:scale-110 transition-all duration-500`}>
            <Icon className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div className="text-right">
            <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${labelClasses}`}>{label}</p>
            <div className={`text-lg font-black tracking-tighter drop-shadow transition-colors uppercase ${valueClasses}`}>{value}</div>
          </div>
        </div>
        
        {target !== undefined && (
          <div className="space-y-3 mb-3">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest px-2">
              <span className={metaClasses}>Meta: {target.toLocaleString('es-CL')}</span>
              <span className={`px-2 py-0.5 rounded-lg font-bold shadow-sm ${isOver ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : dark ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                  {progress.toFixed(1)}%
              </span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden shadow-inner border p-0.5 ${dark ? 'bg-white/5 border-white/10' : 'bg-slate-100/80 border-white'}`}>
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
// PREMIUM SECTION WRAPPER
// ─────────────────────────────────────────────────────────────
const PremiumSection = ({ id, title, subtitle, icon: Icon, children, actions }) => (
  <section id={id} className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
    <div className="flex items-center justify-between gap-4 mb-2 px-2">
      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shadow-sm">
            <Icon className="w-6 h-6 text-indigo-600" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">{title}</h2>
          {subtitle && <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
    
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl shadow-indigo-100/30 overflow-hidden p-2 sm:p-6">
      {children}
    </div>
  </section>
);


// ─────────────────────────────────────────────────────────────
// COMPOSITION BAR
// ─────────────────────────────────────────────────────────────
const CompositionBar = ({ base, decoCable, decoWifi, repetidor, telefono }) => {
  const total = base + (decoCable || 0) + (decoWifi || 0) + repetidor + telefono;
  if (total === 0) return <div className="text-xs text-slate-500">Sin datos</div>;
  const pct = (v) => ((v / total) * 100).toFixed(1);
  const segments = [
    { label: 'Base', value: base, pct: pct(base), color: 'bg-emerald-500' },
    { label: 'Decos (CAT)', value: decoCable || 0, pct: pct(decoCable || 0), color: 'bg-blue-500' },
    { label: 'Decos (WIFI)', value: decoWifi || 0, pct: pct(decoWifi || 0), color: 'bg-indigo-500' },
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

// Mapa de colores personalizado: Rojo, Amarillo, Naranja, Verde
const colorScaleProduccion = (val, meta) => {
  if (val <= 0) return 'bg-slate-100 text-slate-400';
  const pct = val / (meta || 1);
  if (pct >= 1) return 'bg-green-500 text-white shadow-lg shadow-green-100';      // Verde
  if (pct >= 0.75) return 'bg-orange-500 text-white shadow-md shadow-orange-100'; // Naranja
  if (pct >= 0.5) return 'bg-yellow-400 text-yellow-900 shadow-md shadow-yellow-100'; // Amarillo
  return 'bg-red-500 text-white shadow-md shadow-red-100';                         // Rojo
};

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: ProduccionDiaTable
// ═══════════════════════════════════════════════════════════════════════
const ProduccionDiaTable = ({ tecnicos = [], stats = {}, metaConfig = {} }) => {
  const meta = metaConfig.metaProduccionDia || 40;

  // Generar días del mes actual
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Función color basada en porcentaje de meta
  const getColorClass = (val) => {
    if (val <= 0) return 'bg-gray-100 text-gray-500';
    const pct = val / meta;
    if (pct >= 1) return 'bg-green-500 text-white font-bold';
    if (pct >= 0.75) return 'bg-orange-500 text-white font-bold';
    if (pct >= 0.5) return 'bg-yellow-400 text-gray-900 font-bold';
    return 'bg-red-500 text-white font-bold';
  };

  return (
    <div className="w-full">
      {/* ENCABEZADO */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Producción del Mes</h3>
          <p className="text-sm text-slate-500">
            {new Date(year, month).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-blue-600">{Math.round(stats.totalPts || 0)}</div>
          <div className="text-xs text-slate-500">Puntos Total</div>
        </div>
      </div>

      {/* TABLA */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          {/* HEAD */}
          <thead>
            <tr className="bg-slate-800 text-white border-b-2 border-slate-700 sticky top-0 z-20">
              <th className="px-4 py-3 text-left font-black sticky left-0 z-30 bg-slate-800 min-w-[220px]">
                Técnico
              </th>
              <th className="px-3 py-3 text-center font-black text-xs w-24">ID Recurso</th>
              <th className="px-3 py-3 text-center font-black text-xs w-28">F. Inicio</th>
              {days.map(d => {
                const isWeekend = new Date(year, month, d).getDay() % 6 === 0;
                return (
                  <th
                    key={d}
                    className={`px-2 py-2 text-center font-bold text-xs w-10 ${
                      isWeekend ? 'bg-slate-700' : ''
                    }`}
                  >
                    {d}
                  </th>
                );
              })}
              <th className="px-3 py-3 text-center font-black text-xs w-20">Producción</th>
              <th className="px-3 py-3 text-center font-black text-xs w-16">Órdenes</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {tecnicos.length === 0 ? (
              <tr>
                <td colSpan={days.length + 4} className="px-4 py-8 text-center text-slate-500">
                  No hay técnicos con producción en este período
                </td>
              </tr>
            ) : (
              tecnicos.map(t => (
                <tr
                  key={t._id}
                  className="border-b border-slate-200 hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3 font-bold sticky left-0 z-10 bg-white text-blue-700">
                    <div>{t.fullName}</div>
                    <div className="text-xs text-slate-500">{t.rut}</div>
                  </td>
                  <td className="px-3 py-3 text-center text-xs font-black text-indigo-600">
                    {t.idRecursoToa || '—'}
                  </td>
                  <td className="px-3 py-3 text-center text-sm font-medium text-slate-600">
                    {t.contractStartDate}
                  </td>
                  {days.map(d => {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const pts = t.dailyMap[dateKey]?.pts || 0;
                    const isWeekend = new Date(year, month, d).getDay() % 6 === 0;

                    return (
                      <td
                        key={d}
                        className={`px-2 py-2 text-center text-xs font-bold w-10 rounded ${
                          isWeekend ? 'bg-slate-50' : ''
                        } ${getColorClass(pts)}`}
                      >
                        {pts > 0 ? Math.round(pts) : '—'}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center font-bold text-blue-600">
                    {Math.round(t.monthTotal)}
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">
                    {t.ordersCount}
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* FOOTER - TOTALES */}
          {tecnicos.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                <td className="px-4 py-3 sticky left-0 z-10 bg-slate-100 text-slate-900">
                  TOTAL
                </td>
                <td className="px-3 py-3 text-center">—</td>
                <td className="px-3 py-3 text-center">—</td>
                {days.map(d => {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const totalDia = tecnicos.reduce((s, t) => s + (t.dailyMap[dateKey]?.pts || 0), 0);
                  const isWeekend = new Date(year, month, d).getDay() % 6 === 0;

                  return (
                    <td
                      key={d}
                      className={`px-2 py-2 text-center text-xs font-bold w-10 rounded border border-slate-300 ${
                        isWeekend ? 'bg-slate-100' : 'bg-white'
                      } ${getColorClass(totalDia)}`}
                    >
                      {Math.round(totalDia) > 0 ? Math.round(totalDia) : '—'}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center text-slate-900">
                  {Math.round(stats.totalPts || 0)}
                </td>
                <td className="px-3 py-3 text-center text-slate-900">
                  {stats.totalOrders || 0}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
const ANALYSIS_SECTIONS = [
  { id: 'section-main', label: 'Producción', icon: Grid3X3 },
  { id: 'section-ranking', label: 'Ranking', icon: Award },
  { id: 'section-weekly-global', label: 'Semanal', icon: BarChart3 },
  { id: 'section-weekly-tech', label: 'Técnico', icon: Users },
  { id: 'section-activity-type', label: 'Actividad', icon: Layers },
  { id: 'section-client-analysis', label: 'Cliente', icon: BarChart3 },
  { id: 'section-zones-lpu', label: 'Zonas', icon: MapPin },
  { id: 'section-calendar', label: 'Calendario', icon: Calendar },
  { id: 'section-weekly-detail', label: 'Detalle', icon: FileText },
];


const PRESENTATION_SECTIONS = [
  { id: 'ranking', title: 'Ranking de Técnicos', icon: '🏆' },
  { id: 'weekly-global', title: 'Producción Semanal', icon: '📊' },
  { id: 'weekly-tech', title: 'Semanal por Técnico', icon: '👥' },
  { id: 'activity-type', title: 'Desglose por Actividad', icon: '🔧' },
  { id: 'client-analysis', title: 'Análisis Cliente/Proyecto', icon: '🏢' },
  { id: 'zones-lpu', title: 'Zonas y LPU', icon: '🗺️' },
  { id: 'calendar', title: 'Calendario', icon: '📆' },
  { id: 'weekly-detail', title: 'Detalle Diario', icon: '📅' },
];


// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function Produccion() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // ── State — datos pre-agregados del servidor ──
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [availableClientes, setAvailableClientes] = useState([]);

  // Filters — Synchronized with location.state from DescargaTOA
  const initialDesde = location.state?.desde || toInputDate(firstDayOfMonth());
  const initialHasta = location.state?.hasta || toInputDate(todayUTC());

  const [dateFrom, setDateFrom] = useState(initialDesde);
  const [dateTo, setDateTo] = useState(initialHasta);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('todos');
  const [estadoFilter, setEstadoFilter] = useState('Completado');
  const [soloVinculados, setSoloVinculados] = useState(!['ceo_genai', 'ceo'].includes(user?.role?.toLowerCase()));
  const [searchTech, setSearchTech] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('TODOS');
  const [filtroProyecto, setFiltroProyecto] = useState('TODOS');

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

  // Expanded section mode (for interactive buttons)
  const [expandedSection, setExpandedSection] = useState('section-produccion-dia');

  const refreshTimerRef = useRef(null);

  useEffect(() => {
    adminApi.getClientes().then(res => setAvailableClientes(res.data)).catch(() => {});
  }, []);

  // ── Fetch data pre-agregada del server (liviano y rápido) ──
  const fetchData = useCallback(async (desde, hasta, est, clis, type) => {
    try {
      setLoading(true);
      setError(null);

      // Intentar cargar del nuevo endpoint limpio para Producción Día
      try {
        const { data: telecomData } = await api.get('/produccion-dia-telecom');
        setServerData(telecomData);
        setLastRefresh(new Date());
      } catch (telecomErr) {
        // Fallback al endpoint antiguo si falla
        console.log('Usando endpoint antiguo de producción-stats...');
        const params = {};
        if (typeof desde === 'string' && desde.length === 10) params.desde = desde;
        if (typeof hasta === 'string' && hasta.length === 10) params.hasta = hasta;
        if (est) params.estado = est;
        if (clis && clis.length > 0) params.clientes = clis;
        if (type && type !== 'todos') params.tipo = type;
        const { data } = await api.get('/bot/produccion-stats', { params });
        setServerData(data);
        setLastRefresh(new Date());
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
    // Deduplicar por nombre normalizado (red de seguridad ante duplicados del backend)
    const seenNamesIdx = {};
    const dedupedList = [];
    serverData.tecnicos.forEach(t => {
      const norm = (t.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (seenNamesIdx[norm] === undefined) {
        seenNamesIdx[norm] = dedupedList.length;
        dedupedList.push(t);
      } else {
        // Fusionar producción si hay un duplicado remanente
        const idx = seenNamesIdx[norm];
        const ex = dedupedList[idx];
        dedupedList[idx] = {
          ...ex,
          orders:      (ex.orders   || 0) + (t.orders   || 0),
          ptsTotal:    (ex.ptsTotal || 0) + (t.ptsTotal || 0),
          idRecurso:   ex.idRecurso   || t.idRecurso,
          isVinculado: ex.isVinculado || t.isVinculado,
          inicioContrato: ex.inicioContrato || t.inicioContrato,
        };
      }
    });
    let list = dedupedList.filter(t => t.isVinculado);
    const search = searchTech.toLowerCase().trim();
    if (search) list = list.filter(t => (t.name || '').toLowerCase().includes(search));
    if (soloVinculados) list = list.filter(t => t.isVinculado);
    return list;
  }, [serverData, searchTech, soloVinculados]);

  // ── Hay filtros locales activos? ──
  const hasLocalFilters = searchTech.trim() !== '' || typeFilter !== 'todos' || soloVinculados;

  const elapsedBusinessDays = useMemo(() => {
    return countBusinessDays(dateFrom, dateTo);
  }, [dateFrom, dateTo]);

  // ── Header stats — recalculados desde techRanking filtrado ──
  const headerStats = useMemo(() => {
    if (!serverData?.stats) return { totalOrders: 0, totalPts: 0, avgPtsPerTechPerDay: 0, uniqueTechs: 0, uniqueDays: 0, metaRequired: 0, metaAchieved: 0 };
    
    // Configuración de metas
    const metaConfig = serverData.metaConfig || { metaProduccionDia: 0 };
    const metaDiariaGlobal = metaConfig.metaProduccionDia * (serverData.stats.uniqueTechs || 1);

    // Si no hay filtros locales, usar stats del servidor directamente
    if (!hasLocalFilters) {
      const totalPts = serverData.stats.totalPts;
      const metaRequired = metaDiariaGlobal * (elapsedBusinessDays || 1);
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
    
    const metaRequired = metaConfig.metaProduccionDia * uniqueTechs * (elapsedBusinessDays || 1);

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
  }, [serverData, techRanking, hasLocalFilters, elapsedBusinessDays]);

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
        ...t,
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
          ...t,
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
        techData.push({ ...t, name: t.name, byType, total: Math.round(total * 100) / 100 });
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
        ...t,
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
      'Pts Base': toExcelVal(t.ptsBase),
      'Pts Deco CAT': toExcelVal(t.ptsDecoCable || t.ptsDeco),
      'Pts Deco WIFI': toExcelVal(t.ptsDecoWifi),
      'Pts Repetidor': toExcelVal(t.ptsRepetidor),
      'Pts Teléfono': toExcelVal(t.ptsTelefono),
      'Pts Total': toExcelVal(t.ptsTotal),
      'Prom/Día': toExcelVal(t.avgPerDay),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Producción');
    XLSX.writeFile(wb, `produccion_${dateFrom}_${dateTo}.xlsx`);
  }, [sortedTechRanking, dateFrom, dateTo]);

  const exportWeeklyToExcel = useCallback(() => {
    const rows = weeklyData.map(w => ({
      'Semana': w.week,
      'Rango': w.range,
      'Órdenes': w.orders,
      'Técnicos': w.techsCount,
      'Pts Total': toExcelVal(w.pts),
      'Prom/Téc': toExcelVal(w.pts / (w.techsCount || 1))
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Semanal');
    XLSX.writeFile(wb, `resumen_semanal_${dateFrom}.xlsx`);
  }, [weeklyData, dateFrom]);

  const exportWeeklyTrendToExcel = useCallback(() => {
    const rows = threeWeekDataByTech.techs.map(t => {
      const row = { 'Técnico': t.name };
      threeWeekDataByTech.targetWeeks.forEach(wk => {
        row[wk] = toExcelVal(t.weekStats[wk]?.avg || 0);
      });
      row['Global'] = toExcelVal(t.globalAvg);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tendencia Semanal');
    XLSX.writeFile(wb, `tendencia_semanal_${dateFrom}.xlsx`);
  }, [threeWeekDataByTech, dateFrom]);

  const exportLpuToExcel = useCallback(() => {
    const rows = lpuData.map(a => ({
      'Actividad': a.desc,
      'Cantidad': a.count,
      'Pts Total': toExcelVal(a.totalPts),
      'Avg Pts/Unit': toExcelVal(a.avgPtsPerUnit)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Actividad LPU');
    XLSX.writeFile(wb, `actividad_lpu_${dateFrom}.xlsx`);
  }, [lpuData, dateFrom]);

  const exportEquipmentToExcel = useCallback(() => {
    const rows = [
      { 'Componente': 'Decodificadores', 'Cantidad': techsSummary.totalQtyDeco },
      { 'Componente': 'Decodificadores Cable (CAT)', 'Cantidad': techsSummary.totalQtyDecoCable },
      { 'Componente': 'Decodificadores WIFI', 'Cantidad': techsSummary.totalQtyDecoWifi },
      { 'Componente': 'Repetidores/Wifi', 'Cantidad': techsSummary.totalQtyRepetidor }
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    XLSX.writeFile(wb, `equipos_${dateFrom}.xlsx`);
  }, [techsSummary, dateFrom]);

  const exportZonesToExcel = useCallback(() => {
    const rows = Object.entries(macroZoneData).flatMap(([zone, data]) => 
      data.cities.map(c => ({
        'Zona': zone,
        'Ciudad': c.name,
        'Órdenes': c.orders,
        'Puntos': toExcelVal(c.pts)
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Zonas');
    XLSX.writeFile(wb, `zonas_${dateFrom}.xlsx`);
  }, [macroZoneData, dateFrom]);

  const exportSectionToPDF = useCallback(async (sectionId, title) => {
    const element = document.getElementById(sectionId);
    if (!element) return;
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(element, { 
          scale: 1.5, 
          useCORS: true, 
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: -window.scrollY,
          ignoreElements: (el) => el.classList.contains('sticky') || el.classList.contains('print:hidden')
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.setFontSize(10);
        pdf.text(`GENAI360 - ${title}`, 10, 10);
        pdf.text(`Periodo: ${fmtDate(dateFrom)} - ${fmtDate(dateTo)}`, 10, 15);
        pdf.addImage(imgData, 'JPEG', 0, 20, pdfWidth, Math.min(pdfHeight, 250));
        pdf.save(`${sectionId}_${dateFrom}.pdf`);
      } catch (err) {
        console.error('Error generating PDF:', err);
        alert('Error al generar el PDF. Si el error persiste, intente refrescar la página.');
      }
    }, 150);
  }, [dateFrom, dateTo]);

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

  // Sync calMonth con dateFrom si cambia el filtro superior
  useEffect(() => {
    if (dateFrom) {
      const d = parseToUTC(dateFrom);
      setCalMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    }
  }, [dateFrom]);

  const navCalMonth = useCallback((dir) => {
    setCalMonth((prev) => {
      let m = prev.month + dir;
      let y = prev.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      
      // Also update the global dateFrom/dateTo so data is fetched
      const newMonthStart = new Date(Date.UTC(y, m, 1));
      const newMonthEnd = new Date(Date.UTC(y, m + 1, 0));
      const today = todayUTC();
      const actualEnd = newMonthEnd > today ? today : newMonthEnd;
      
      setDateFrom(toInputDate(newMonthStart));
      setDateTo(toInputDate(actualEnd));

      return { year: y, month: m };
    });
    setCalSelectedDay(null);
  }, []);

  const monthDaysArray = useMemo(() => {
    const year = calMonth.year;
    const month = calMonth.month;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, month, d));
      const dow = dt.getUTCDay(); // 0 = Sun, 1 = Mon...
      days.push({ day: d, dow });
    }
    return days;
  }, [calMonth]);

  const produccionDiaData = useMemo(() => {
    const techs = techRanking.length > 0 ? techRanking : (serverData?.tecnicos || []);
    return techs.map(t => {
      const dayPts = {};
      let totalPts = 0;
      if (t.dailyMap) {
        Object.entries(t.dailyMap).forEach(([dateKey, dd]) => {
          const parts = dateKey.split('-');
          const y = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const d = parseInt(parts[2]);
          if (y === calMonth.year && m === calMonth.month) {
            dayPts[d] = dd.pts;
            totalPts += dd.pts;
          }
        });
      }
      return {
        ...t,
        dayPts,
        monthTotal: totalPts,
      };
    }).sort((a, b) => b.monthTotal - a.monthTotal)
    .filter(t => {
      // Show operativos always
      if (t.status !== 'Finiquitado') return true;
      // Show finiquitados ONLY if they have production in current month
      return t.monthTotal > 0;
    });
  }, [techRanking, serverData, calMonth]);

  // Extract unique clientes and proyectos for filters
  const clientesYProyectos = useMemo(() => {
    const clientes = new Set();
    const proyectos = new Set();

    produccionDiaData.forEach(t => {
      if (t.cliente) clientes.add(t.cliente);
      if (t.proyecto) proyectos.add(t.proyecto);
    });

    return {
      clientes: Array.from(clientes).sort(),
      proyectos: Array.from(proyectos).sort()
    };
  }, [produccionDiaData]);

  // Filter produccionDiaData by cliente, proyecto y cargo (TECNICO TELECOMUNICACIONES)
  const produccionDiaDataFiltrada = useMemo(() => {
    return produccionDiaData.filter(t => {
      if (filtroCliente !== 'TODOS' && t.cliente !== filtroCliente) return false;
      if (filtroProyecto !== 'TODOS' && t.proyecto !== filtroProyecto) return false;
      // NUEVO: Solo mostrar técnicos con cargo que incluya "TELECOMUNICACIONES"
      // Ahora usa el position de Captura de Talento como fuente de verdad
      if (t.cargo && !t.cargo.toUpperCase().includes('TELECOMUNICACIONES')) return false;
      return true;
    });
  }, [produccionDiaData, filtroCliente, filtroProyecto]);

  // Por defecto, mostrar la primera sección ya manejada arriba

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

  // ─── SECTION BUTTON COMPONENT ───
  const SectionButton = ({ id, title, icon, sectionId }) => (
    <button
      onClick={() => setExpandedSection(id)}
      className="group flex flex-col items-center justify-center gap-2 px-3 py-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all shadow-sm hover:shadow-md text-center active:scale-95"
    >
      <div className="text-lg">{icon}</div>
      <div className="flex-1">
        <h3 className="text-[8px] font-black text-slate-800 uppercase leading-tight whitespace-nowrap">{title}</h3>
      </div>
    </button>
  );

  // ─── LOADING / ERROR ───
  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${presentationMode ? 'bg-slate-950' : 'bg-[#F8FAFC]'} text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900 overflow-x-hidden`}>
      {/* ─── CRYSTAL BACKGROUND ─── */}
      {!presentationMode && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-100/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/20 rounded-full blur-[120px]" />
        </div>
      )}

      {/* ═══════════════════════ STICKY COMPACT HEADER & FILTERS ═══════════════════════ */}
      <div className={`sticky-filter-bar sticky top-0 z-[100] transition-all duration-500 ${presentationMode ? 'translate-y-[-100%] opacity-0 h-0 overflow-hidden' : 'translate-y-0 opacity-100'}`}>
        {/* Upper Mini Header */}
        <div className="bg-slate-900 text-white px-3 sm:px-4 md:px-8 py-2 flex items-center justify-between border-b border-white/5 gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div onClick={() => navigate(-1)} className="cursor-pointer flex items-center gap-2 group">
              <div className="p-1.5 bg-emerald-500 rounded-lg group-hover:bg-emerald-400 transition-colors">
                <Activity size={14} className="text-white" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] hidden sm:block">Telecomunicaciones <span className="text-emerald-400">PREMIUM</span></span>
            </div>
            <div className="h-4 w-px bg-white/10 hidden md:block" />
            <div className="hidden md:flex items-center gap-4">
               {[
                { id: 'section-ranking', label: 'Ranking', icon: Award },
                { id: 'section-equipos', label: 'Equipos', icon: Box },
                { id: 'section-weekly', label: 'Semanal', icon: Calendar },
                { id: 'section-zones', label: 'Geografía', icon: Map },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
                >
                  <item.icon size={10} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
             {lastRefresh && (
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
                  Live: {lastRefresh.toLocaleTimeString('es-CL')}
                </span>
             )}
             <button
               onClick={() => fetchData(dateFrom, dateTo, estadoFilter)}
               disabled={loading}
               className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
             >
               <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
               {loading ? 'Sync' : 'Actualizar'}
             </button>
          </div>
        </div>

        {/* Compact Filters Bar */}
        <div className="bg-white/80 backdrop-blur-2xl border-b border-slate-200 shadow-xl shadow-slate-200/20 px-3 sm:px-4 md:px-8 py-3">
          <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row items-center gap-3 sm:gap-4 filter-bar">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 flex-1 w-full mobile-1col">
              <MultiSearchableSelect
                variant="compact"
                label="EMPRESAS"
                icon={UsersIcon}
                options={availableClientes.map(c => ({ label: c.nombre, value: c._id }))}
                value={selectedClientes}
                onChange={setSelectedClientes}
              />
              
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <Calendar size={12} className="text-emerald-500" />
                <div className="flex items-center gap-1.5">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-[10px] font-black text-slate-700 focus:outline-none" />
                  <span className="text-slate-300">→</span>
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-[10px] font-black text-slate-700 focus:outline-none" />
                </div>
                <div className="flex gap-1 border-l border-slate-200 ml-2 pl-2">
                  {['today', 'last7', 'thisMonth'].map(k => (
                    <button key={k} onClick={() => setQuickDate(k)} className="text-[8px] font-black text-slate-400 hover:text-emerald-600 uppercase transition-colors px-1">
                      {k === 'today' ? 'Hoy' : k === 'last7' ? '7D' : 'Mes'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none appearance-none cursor-pointer hover:bg-white transition-colors">
                  <option value="todos">TIPO: TODOS</option>
                  <option value="provision">PROVISIÓN</option>
                  <option value="reparacion">REPARACIÓN</option>
                </select>
                <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none appearance-none cursor-pointer hover:bg-white transition-colors">
                  <option value="todos">ESTADO: TODOS</option>
                  {(serverData?.estados || []).map(e => <option key={e.estado} value={e.estado}>{e.estado.toUpperCase()}</option>)}
                </select>
                <select value={filtroProyecto} onChange={(e) => setFiltroProyecto(e.target.value)} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none appearance-none cursor-pointer hover:bg-white transition-colors">
                  <option value="TODOS">PROYECTO: TODOS</option>
                  {clientesYProyectos.proyectos.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSoloVinculados(!soloVinculados)} 
                  className={`flex-1 px-4 py-2 rounded-xl border transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest ${soloVinculados ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-emerald-600'}`}
                >
                  <Anchor size={12} className={soloVinculados ? 'animate-pulse' : ''} />
                  <span>Vinculados</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-100 pt-3 xl:pt-0 xl:pl-4">
              <div className="flex-1 xl:w-48 relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-400 transition-colors" size={12} />
                <input 
                  type="text" 
                  value={searchTech} 
                  onChange={(e) => setSearchTech(e.target.value)} 
                  placeholder="NOMBRE TÉCNICO..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[10px] font-black text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-emerald-300 transition-all outline-none" 
                />
              </div>

              <div className="flex gap-2">
                <button onClick={exportToExcel} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all shadow-sm active:scale-90" title="Exportar Excel">
                  <Download size={16} />
                </button>
                <button onClick={downloadRawDB} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-90" title="Descargar BD">
                  <Database size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-12 space-y-6 sm:space-y-10 relative z-10">
        {/* KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
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
                : "Promedio acumulado"}
              color="blue"
            />
            <StatCard
              icon={TrendingUp}
              label="Promedio Diario"
              value={fmtPts(headerStats.avgPtsPerTechPerDay)}
              target={metaConfig.metaProduccionDia > 0 ? metaConfig.metaProduccionDia : undefined}
              achieved={headerStats.avgPtsPerTechPerDay}
              sub={metaConfig.metaProduccionDia > 0
                ? `Meta: ${fmtPts(metaConfig.metaProduccionDia)} pts/téc`
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

        {/* ═══════════════════════ 2. ANÁLISIS RÁPIDO (Buttons - STICKY) ═══════════════════════ */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-slate-50 to-white/95 backdrop-blur-md border-b border-slate-200 p-4 rounded-b-3xl shadow-xl shadow-slate-200/50">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {ANALYSIS_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setExpandedSection(section.id)}
                className={`group flex flex-col items-center justify-center gap-2 px-3 py-3.5 rounded-2xl border transition-all shadow-sm text-center active:scale-95
                  ${expandedSection === section.id
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-100 ring-4 ring-indigo-50'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600'}
                `}
                style={{ minWidth: 80 }}
              >
                <section.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${expandedSection === section.id ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-black uppercase leading-tight tracking-widest ${expandedSection === section.id ? 'text-white' : 'text-slate-500'}`}>{section.label}</span>
              </button>
            ))}
          </div>
        </div>



        {/* ═══════════════════════ DYNAMIC CONTENT AREA ═══════════════════════ */}
        <div className="min-h-[600px]">

        {/* ═══════════════════════ SECTION: PRODUCCIÓN DÍA - NUEVA LIMPIA ═══════════════════════ */}
        {expandedSection === 'section-produccion-dia' && (
          <div className="p-8">
            <ProduccionDiaTable
              tecnicos={serverData?.tecnicos || []}
              stats={serverData?.stats || {}}
              metaConfig={metaConfig}
            />
          </div>
        )}


        {/* ═══════════════════════ SECTION: RANKING ═══════════════════════ */}
        {expandedSection === 'section-ranking' && (
          <PremiumSection
            id="section-ranking"
            title="Ranking Master"
            subtitle="Global Performance Leaderboard"
            icon={Award}
            actions={
              <button
                onClick={openPresentation}
                className="group flex items-center gap-2.5 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm"
              >
                <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                PRESENTACIÓN
              </button>
            }
          >
            <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-indigo-100/50">
                    {[
                      { key: null, label: '#', className: 'w-16 text-center' },
                      { key: 'name', label: 'Técnico Especialista', className: 'text-left' },
                      { key: 'cliente', label: 'Asignación', className: 'text-left' },
                      { key: 'activeDays', label: 'Días' },
                      { key: 'orders', label: 'Órdenes' },
                      { key: 'rrRealPercent', label: 'RR%' },
                      { key: 'ptsTotal', label: 'Total Pts' },
                      { key: 'avgPerDay', label: 'Prom/Día' },
                      ...(metaConfig.metaProduccionDia > 0 ? [{ key: null, label: 'Desempeño', className: 'text-center' }] : []),
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-4 text-[9px] font-black text-indigo-400 uppercase tracking-widest ${col.className || 'text-right'} ${col.key ? 'cursor-pointer hover:text-emerald-600 transition-colors' : ''}`}
                        onClick={col.key ? () => techToggle(col.key) : undefined}
                      >
                        <div className={`flex items-center gap-1 ${col.className?.includes('left') ? 'justify-start' : (col.className?.includes('center') ? 'justify-center' : 'justify-end')}`}>
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
                    let techElapsedDays = elapsedBusinessDays;
                    if (tech.inicioContrato) {
                      const dtInicio = parseToUTC(tech.inicioContrato);
                      const dtDesde = new Date(dateFrom + 'T12:00:00Z');
                      if (!isNaN(dtInicio.getTime()) && dtInicio > dtDesde) {
                        techElapsedDays = countBusinessDays(dtInicio.toISOString().split('T')[0], dateTo);
                      }
                    }
                    const targetPeriodo = metaConfig.metaProduccionDia * (techElapsedDays || 0);
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                    return (
                      <React.Fragment key={tech.idUnique || tech.name}>
                        <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-50/30' : ''}`} onClick={() => setExpandedTech(isExpanded ? null : tech.name)}>
                          <td className="px-4 py-4 text-center font-black text-[10px] text-slate-300">
                            {medal || rank.toString().padStart(2, '0')}
                          </td>
                          <td className="px-4 py-4 text-left font-black text-slate-800 uppercase text-[10px]">{tech.name}</td>
                          <td className="px-4 py-4 text-left text-[9px] font-bold text-indigo-400">{tech.cliente || '—'}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600 tabular-nums">{tech.activeDays}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600 tabular-nums">{tech.orders.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-4 text-center font-black text-[10px] text-emerald-500">{(tech.rrRealPercent || 0).toFixed(1)}%</td>
                          <td className="px-4 py-4 text-right font-black text-emerald-600 text-xs tabular-nums">{fmtPts(tech.ptsTotal)}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-700 text-[10px] tabular-nums">{fmtPts(tech.avgPerDay)}</td>
                          {metaConfig.metaProduccionDia > 0 && (
                            <td className="px-4 py-4 text-center">
                              <MetaBadge pts={tech.ptsTotal} meta={targetPeriodo} />
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-emerald-50/20">
                            <td colSpan={metaConfig.metaProduccionDia > 0 ? 9 : 8} className="p-8">
                               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                  <MiniStat label="Puntos Base" value={fmtPts(tech.ptsBase)} icon={Zap} color="slate" />
                                  <MiniStat label="Deco Adicional" value={fmtPts(tech.ptsDeco)} icon={Layers} color="indigo" />
                                  <MiniStat label="WiFi Kit" value={fmtPts(tech.ptsRepetidor)} icon={Wifi} color="violet" />
                                  <MiniStat label="Total Puntos" value={fmtPts(tech.ptsTotal)} icon={Award} color="emerald" />
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
          </PremiumSection>
        )}


        {/* ═══════════════════════ SECTION: WEEKLY GLOBAL ═══════════════════════ */}
        {expandedSection === 'section-weekly-global' && (
          <PremiumSection
            id="section-weekly-global"
            title="Análisis Semanal"
            subtitle="Heatmap de productividad global"
            icon={BarChart3}
            actions={
              <button onClick={exportWeeklyToExcel} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
                <FileSpreadsheet size={18} />
              </button>
            }
          >
            <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-400 uppercase tracking-widest">Semana</th>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                      <th key={d} className="px-2 py-5 text-center text-[10px] font-black text-indigo-400 uppercase tracking-widest">{d}</th>
                    ))}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Pts</th>
                    <th className="px-6 py-5 text-right text-[10px] font-black text-amber-600 uppercase tracking-widest">Eficiencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/10">
                  {weeklyData.map((w) => {
                    const avgPerTech = w.techsCount > 0 ? (w.pts / w.techsCount) : 0;
                    return (
                      <tr key={w.key} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2 py-0.5 bg-slate-900 text-white rounded text-[9px] font-black tracking-widest mb-1">S{String(w.week).padStart(2, '0')}</span>
                          <div className="text-[10px] font-bold text-indigo-200 uppercase">{w.range}</div>
                        </td>
                        {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                          const val = w.dayPts?.[dow] || 0;
                          return (
                            <td key={dow} className="px-2 py-4 text-center">
                              <div className={`inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, 200) : 'text-slate-100'}`}>
                                {val > 0 ? fmtPts(val) : '—'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 text-right font-black text-emerald-600 text-xs tabular-nums">{fmtPts(w.pts)}</td>
                        <td className="px-6 py-4 text-right">
                          <MetaBadge pts={avgPerTech} meta={metaConfig.metaProduccionSemana} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumSection>
        )}

        {/* ═══════════════════════ SECTION: WEEKLY TECH ═══════════════════════ */}
        {expandedSection === 'section-weekly-tech' && (
          <div className="space-y-12">
            <PremiumSection
              id="section-weekly-tech"
              title="Cruce por Técnicos"
              subtitle="Distribución semanal de desempeño"
              icon={Users}
              actions={
                <button onClick={exportWeeklyTrendToExcel} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
                  <FileSpreadsheet size={18} />
                </button>
              }
            >
              <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-indigo-100/50">
                      <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-400 uppercase tracking-widest">Técnico</th>
                      {weeklyData.map(w => (
                        <th key={w.key} className="px-4 py-5 text-right text-[10px] font-black text-indigo-400 uppercase tracking-widest">S{String(w.week).padStart(2, '0')}</th>
                      ))}
                      <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total</th>
                      <th className="px-6 py-5 text-right text-[10px] font-black text-amber-600 uppercase tracking-widest">Prom/Día</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50/10">
                    {weeklyByTech.map((t) => (
                      <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-800 uppercase text-[10px]">{t.name}</td>
                        {weeklyData.map(w => {
                          const val = t.weekPts[w.key]?.pts || 0;
                          return (
                            <td key={w.key} className="px-4 py-4 text-right">
                              <div className={`inline-flex items-center justify-center min-w-[32px] h-8 rounded-lg text-[10px] font-black transition-all ${val > 0 ? greenScale(val, 200) : 'text-slate-100'}`}>
                                {val > 0 ? fmtPts(val) : '—'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 text-right font-black text-emerald-600 text-xs tabular-nums">{fmtPts(t.total)}</td>
                        <td className="px-6 py-4 text-right font-black text-amber-600 text-[10px] tabular-nums">{fmtPts(t.avgPerDay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumSection>

            <PremiumSection
              id="section-weekly-consistency"
              title="Consistencia 3 Semanas"
              subtitle="Análisis de estabilidad operativa"
              icon={Thermometer}
            >
              <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
                      {threeWeekDataByTech.targetWeeks.map((wk, i) => (
                        <th key={wk} className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {i === threeWeekDataByTech.targetWeeks.length - 1 ? 'Actual' : `- ${threeWeekDataByTech.targetWeeks.length - 1 - i} Sem`}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right text-[9px] font-black text-emerald-600 uppercase tracking-widest">Global</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {threeWeekDataByTech.techs.map(t => (
                      <tr key={t.name} className="hover:bg-white/80 transition-colors">
                        <td className="px-6 py-3 font-black text-slate-700 uppercase text-[9px]">{t.name}</td>
                        {threeWeekDataByTech.targetWeeks.map(wk => (
                          <td key={wk} className="px-6 py-3 text-right">
                            <div className={`inline-flex px-2 py-0.5 rounded font-black text-[9px] ${t.weekStats[wk]?.avg > 0 ? greenScale(t.weekStats[wk].avg, 40) : 'text-slate-100'}`}>
                              {t.weekStats[wk]?.avg > 0 ? fmtPts(t.weekStats[wk].avg) : '—'}
                            </div>
                          </td>
                        ))}
                        <td className="px-6 py-3 text-right font-black text-emerald-600 text-[10px] tabular-nums">{fmtPts(t.globalAvg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PremiumSection>
          </div>
        )}


        {/* ═══════════════════════ SECTION: ACTIVITY TYPE ═══════════════════════ */}
        {expandedSection === 'section-activity-type' && (
          <PremiumSection
            id="section-activity-type"
            title="Mix de Actividades"
            subtitle="Distribución por tipo de trabajo"
            icon={Layers}
            actions={
              <button onClick={exportLpuToExcel} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
                <FileSpreadsheet size={18} />
              </button>
            }
          >
            <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/20">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-indigo-100/50">
                    <th className="px-6 py-5 text-left text-[10px] font-black text-indigo-400 uppercase tracking-widest">Técnico</th>
                    {weeklyActivityByTech.activityTypes.map(at => (
                      <th key={at} className="px-4 py-5 text-right text-[10px] font-black text-indigo-400 uppercase tracking-widest">{at}</th>
                    ))}
                    <th className="px-6 py-5 text-right text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50/10">
                  {weeklyActivityByTech.techs.map((t) => (
                    <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-800 uppercase text-[10px]">{t.name}</td>
                      {weeklyActivityByTech.activityTypes.map(at => {
                        const val = t.byType[at]?.pts || 0;
                        return (
                          <td key={at} className="px-4 py-4 text-right">
                            <div className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-black tabular-nums ${val > 0 ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'text-slate-100'}`}>
                              {val > 0 ? fmtPts(val) : '—'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-right font-black text-emerald-600 text-xs">{fmtPts(t.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumSection>
        )}

        {/* ═══════════════════════ SECTION: CLIENT ANALYSIS ═══════════════════════ */}
        {expandedSection === 'section-client-analysis' && (
          <PremiumSection
            id="section-client-analysis"
            title="Análisis por Cliente"
            subtitle="Desempeño y distribución de proyectos"
            icon={BarChart3}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {clientProjects.map((cp) => (
                <div key={`${cp.cliente}-${cp.proyecto}`} className="bg-white/80 border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col hover:shadow-indigo-100 transition-all">
                  <div className="px-8 py-6 border-b border-slate-50 bg-indigo-50/20 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">{cp.proyecto || 'General'}</div>
                      <div className="text-lg font-black text-slate-800 uppercase">{cp.cliente}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-emerald-600 tracking-tighter tabular-nums">{fmtPts(cp.pts)}</div>
                      <div className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">PTS TOTALES</div>
                    </div>
                  </div>
                  <div className="p-8">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Prom/Día</div>
                        <div className="text-sm font-black text-amber-600 tabular-nums">{fmtPts(cp.avgPerDay)}</div>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Órdenes</div>
                        <div className="text-sm font-black text-blue-600 tabular-nums">{cp.orders}</div>
                      </div>
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Técnicos</div>
                        <div className="text-sm font-black text-purple-600 tabular-nums">{cp.techs}</div>
                      </div>
                    </div>
                    {Object.keys(cp.byTipoTrabajo || {}).length > 0 && (
                      <div className="space-y-2">
                         <div className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">Especialidades</div>
                         <div className="flex flex-wrap gap-2">
                            {Object.entries(cp.byTipoTrabajo).map(([tipo, data]) => (
                               <div key={tipo} className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase">
                                 {tipo}: <span className="text-indigo-600 tabular-nums">{fmtPts(data.pts)}</span>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PremiumSection>
        )}


        {/* ═══════════════════════ SECTION: ZONES & LPU ═══════════════════════ */}
        {expandedSection === 'section-zones-lpu' && (
          <PremiumSection
            id="section-zones-lpu"
            title="Zonas y Tecnologías"
            subtitle="Análisis geográfico y detalle de baremos LPU"
            icon={MapPin}
            actions={
              <button onClick={exportZonesToExcel} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-emerald-600 transition-all shadow-sm">
                <FileSpreadsheet size={18} />
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {Object.entries(macroZoneData).map(([zoneName, zoneData]) => (
                <div key={zoneName} className="bg-white/80 border border-slate-200 rounded-[2.5rem] p-8 shadow-xl">
                   <div className="flex items-center justify-between mb-6">
                      <div className="font-black text-slate-800 uppercase tracking-tight text-lg">{zoneName}</div>
                      <div className="text-lg font-black text-emerald-600 tabular-nums">{fmtPts(zoneData.totalPts)} <span className="text-[8px] uppercase">pts</span></div>
                   </div>
                   <div className="space-y-3">
                      {Object.entries(zoneData.cities).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([city, pts]) => (
                         <div key={city} className="flex items-center justify-between group">
                            <span className="text-[10px] font-bold text-slate-500 uppercase group-hover:text-slate-800 transition-colors">{city}</span>
                            <div className="flex items-center gap-2">
                               <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{ width: `${(pts / zoneData.totalPts) * 100}%` }} />
                               </div>
                               <span className="text-[10px] font-black text-slate-400 w-12 text-right tabular-nums">{fmtPts(pts)}</span>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
              ))}
            </div>

            <div className="bg-white/60 border border-slate-200 rounded-[2.5rem] p-6 sm:p-8">
               <div className="text-center mb-6">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Auditoría Detallada LPU</h3>
               </div>
               <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/10">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-indigo-50/20">
                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Actividad</th>
                        <th className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Cant</th>
                        <th className="px-6 py-4 text-right text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {lpuData.map(act => (
                         <tr key={act.desc} className="hover:bg-white transition-colors">
                            <td className="px-6 py-3 font-black text-slate-700 uppercase text-[9px] truncate max-w-xs">{act.desc}</td>
                            <td className="px-6 py-3 font-bold text-slate-300 text-[8px] tracking-tighter tabular-nums">{act.code}</td>
                            <td className="px-6 py-3 text-right font-black text-slate-500 text-[9px] tabular-nums">{act.count}</td>
                            <td className="px-6 py-3 text-right font-black text-emerald-600 text-[10px] tabular-nums">{fmtPts(act.totalPts)}</td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </PremiumSection>
        )}


        {/* ═══════════════════════ SECTION: CALENDAR ═══════════════════════ */}
        {expandedSection === 'section-calendar' && (
          <PremiumSection
            id="section-calendar"
            title="Agenda de Producción"
            subtitle="Vista mensual de hitos operativos"
            icon={Calendar}
            actions={
              <div className="flex gap-2">
                <button onClick={() => navCalMonth(-1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">
                  <ChevronLeft size={18} />
                </button>
                <div className="px-6 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-[11px] font-black text-slate-800 uppercase tracking-widest shadow-sm">
                  {monthNames[calMonth.month]} {calMonth.year}
                </div>
                <button onClick={() => navCalMonth(1)} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm">
                  <ChevronRight size={18} />
                </button>
              </div>
            }
          >
             <div className="grid grid-cols-8 gap-4 mb-6">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom', 'Semana'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em]">{d}</div>
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
          </PremiumSection>
        )}

        {/* ═══════════════════════ SECTION: WEEKLY DETAIL ═══════════════════════ */}
        {expandedSection === 'section-weekly-detail' && (
          <PremiumSection
            id="section-weekly-detail"
            title="Detalle Semanal por Técnico"
            subtitle="Desglose diario para la semana seleccionada"
            icon={FileText}
          >
            <div className="overflow-x-auto rounded-[1.5rem] border border-indigo-50/20">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest sticky left-0 z-20 bg-slate-900 border-r border-slate-800">Técnico</th>
                    <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest">Semana</th>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                      <th key={d} className="px-2 py-4 text-center text-[10px] font-black uppercase tracking-widest border-l border-slate-800/50">{d}</th>
                    ))}
                    <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest bg-indigo-900">Total</th>
                    <th className="px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest bg-emerald-900">Prom</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {weeklyDetailByTech.map((t) => (
                    <tr key={t.name} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4 text-left font-black text-slate-800 text-[10px] uppercase sticky left-0 z-10 bg-white border-r border-slate-100">{t.name}</td>
                      <td className="px-4 py-4 text-left text-[10px] font-bold text-indigo-400 uppercase">{selectedWeek}</td>
                      {[0, 1, 2, 3, 4, 5, 6].map(dow => {
                        const val = t.dayPts?.[dow] || 0;
                        return (
                          <td key={dow} className="px-2 py-4 text-center text-[10px] font-bold tabular-nums border-l border-slate-50">
                            {val > 0 ? fmtPts(val) : '—'}
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center font-black text-indigo-600 bg-indigo-50/20 tabular-nums">{fmtPts(t.total)}</td>
                      <td className="px-4 py-4 text-center font-bold text-emerald-600 bg-emerald-50/20 tabular-nums">{fmtPts(t.avgPerDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumSection>
        )}


        {/* ═══════════════════════ 7. EXPORTAR ═══════════════════════ */}
        <section className="pb-12 pt-8">
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
          <div className="relative z-10 flex items-center justify-between px-8 py-4 bg-slate-900/40 backdrop-blur-3xl border-b border-white/5 mx-6 mt-6 rounded-2xl shadow-2xl shadow-black/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-2xl shadow-indigo-500/30 transform rotate-3">
                 <div className="text-2xl text-white drop-shadow-lg">{PRESENTATION_SECTIONS[presentationStep]?.icon}</div>
              </div>
              <div className="space-y-0.5">
                <h2 className="text-xl font-black text-white tracking-tighter uppercase">{PRESENTATION_SECTIONS[presentationStep]?.title}</h2>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full border border-white/10 uppercase italic">
                      <span className="text-[8px] font-black text-indigo-400">SLIDE</span>
                      <span className="text-[8px] font-black text-white">{presentationStep + 1} / {PRESENTATION_SECTIONS.length}</span>
                   </div>
                   <div className="h-1 w-1 rounded-full bg-white/20"></div>
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">{empresaNombre}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="w-64 group">
                <MultiSearchableSelect
                  icon={UsersIcon}
                  options={availableClientes.map(c => ({ label: c.nombre, value: c._id }))}
                  value={selectedClientes}
                  onChange={setSelectedClientes}
                  placeholder="FILTRAR AUDIENCIA..."
                  className="premium-dark-select"
                />
              </div>

              <div className="h-8 w-px bg-white/10"></div>

              <button 
                onClick={closePresentation} 
                className="group flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-200 rounded-xl border border-white/10 hover:border-rose-500/30 transition-all duration-300 font-black text-[9px] uppercase tracking-[0.2em]"
              >
                <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                <span>Finalizar</span>
              </button>
            </div>
          </div>

          {/* Slide Content Area */}
          <div className="relative flex-1 overflow-y-auto custom-scrollbar p-12">
            <div className="max-w-[1500px] mx-auto w-full animate-in slide-in-from-bottom-8 fade-in duration-700">
              
              {/* SLIDE: RANKING (Executive Table Version) */}
              {PRESENTATION_SECTIONS[presentationStep]?.id === 'ranking' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <StatCard icon={Hash} label="Órdenes" value={headerStats.totalOrders.toLocaleString('es-CL')} color="blue" dark={true} />
                    <StatCard icon={Zap} label="Pts Totales" value={fmtPts(headerStats.totalPts)} color="emerald" dark={true} />
                    <StatCard icon={TrendingUp} label="Prom/Día" value={fmtPts(headerStats.avgPtsPerTechPerDay)} color="purple" dark={true} />
                    <StatCard icon={Users} label="Líderes" value={headerStats.uniqueTechs} color="amber" dark={true} />
                  </div>

                  {/* Elite Ranking Table */}
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10">
                            <th className="px-6 py-4 text-center text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] w-20">Pos</th>
                            <th className="px-6 py-4 text-left text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Técnico Especialista</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Puntos</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Órdenes</th>
                            <th className="px-6 py-4 text-right text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Eficiencia</th>
                            {metaConfig.metaProduccionDia > 0 && <th className="px-6 py-4 text-right text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Vs Meta</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {sortedTechRanking.map((tech, i) => {
                            const isTop3 = i < 3;
                            return (
                              <tr key={tech.idUnique || tech.name} className="group hover:bg-white/[0.03] transition-colors">
                                <td className="px-6 py-3 text-center">
                                  {isTop3 ? (
                                    <span className="text-2xl drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">{['🥇','🥈','🥉'][i]}</span>
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-600 tracking-widest">{ (i+1).toString().padStart(2, '0') }</span>
                                  )}
                                </td>
                                <td className="px-6 py-3">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{tech.name}</span>
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                      {tech.cliente} {tech.proyecto ? `| ${tech.proyecto}` : ''}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <span className="text-lg font-black text-emerald-400 tracking-tighter">{fmtPts(tech.ptsTotal)}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <span className="text-base font-black text-white/80">{tech.orders}</span>
                                </td>
                                <td className="px-6 py-3 text-right">
                                  <span className="text-base font-black text-indigo-400">{fmtPts(tech.avgPerDay)}</span>
                                  <span className="text-[8px] font-black text-slate-500 block">PTS / DÍA</span>
                                </td>
                                {metaConfig.metaProduccionDia > 0 && (
                                  <td className="px-6 py-3 text-right">
                                    <MetaBadge pts={tech.ptsTotal} meta={metaConfig.metaProduccionDia * (elapsedBusinessDays || 1)} />
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
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
                            <tr key={t.idUnique || t.name} className="hover:bg-white/[0.03] transition-colors group">
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-3xl p-6 rounded-2xl border border-white/10 shadow-3xl">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                          <Calendar className="w-6 h-6 text-indigo-400" />
                       </div>
                       <div className="space-y-0.5">
                          <span className="text-base font-black text-white uppercase tracking-tight block">Histórico Diario de Producción</span>
                          <span className="text-[8px] font-bold text-slate-200 uppercase tracking-[0.3em]">ANÁLISIS POR SEMANA DE AUDITORÍA</span>
                       </div>
                    </div>
                    <div className="relative group">
                      <select
                        value={selectedWeek}
                        onChange={(e) => setSelectedWeek(e.target.value)}
                        className="bg-slate-800/80 border border-white/10 rounded-xl px-8 py-3 text-[10px] font-black text-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 appearance-none cursor-pointer hover:bg-slate-700 transition-all shadow-2xl min-w-[280px] uppercase tracking-widest text-center"
                      >
                        {weeklyData.map(w => (
                          <option key={w.key} value={w.key}>SEMANA {String(w.week).padStart(2, '0')} — {w.range}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 pointer-events-none group-hover:scale-125 transition-transform" />
                    </div>
                  </div>

                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
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
                            <tr key={t.idUnique || t.name} className="hover:bg-white/[0.03] transition-colors group">
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
                            <tr key={t.idUnique || t.name} className="hover:bg-white/[0.03] transition-colors group">
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clientProjects.slice(0, 6).map((cp) => (
                      <div key={`${cp.cliente}-${cp.proyecto}`} className="group relative bg-slate-900/30 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-xl overflow-hidden hover:border-indigo-500/30 transition-all duration-500 hover:scale-[1.01] hover:-translate-y-1">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                           <div className="space-y-0.5">
                              <div className="flex items-center gap-3">
                                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                 <span className="font-black text-white text-base uppercase tracking-tight">{cp.cliente}</span>
                              </div>
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] pl-4">{cp.proyecto || 'CANAL GENERAL'}</span>
                           </div>
                           <div className="text-right">
                              <div className="text-xl font-black text-emerald-400 tracking-tighter uppercase tabular-nums">{fmtPts(cp.ptsTotal || cp.pts)} <span className="text-[8px] text-slate-500">PTS</span></div>
                              <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{cp.orders} ÓRDENES</div>
                           </div>
                        </div>

                        <div className="p-4 grid grid-cols-2 gap-4">
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-0.5 block">Rendimiento</span>
                              <span className="text-sm font-black text-white">{fmtPts(cp.avgPerDay)} <span className="text-[8px] text-slate-500">AVG</span></span>
                           </div>
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-right">
                              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5 block">Provisiones</span>
                              <span className="text-sm font-black text-white">{cp.provisionCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-0.5 block">Reparaciones</span>
                              <span className="text-sm font-black text-white">{cp.repairCount}</span>
                           </div>
                           <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-right">
                              <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-0.5 block">Fza Técnica</span>
                              <span className="text-sm font-black text-white">{cp.techs} TÉCS</span>
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
                  <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-2xl p-6 shadow-3xl w-full max-w-5xl">
                    <div className="flex items-end justify-between mb-4 px-4 pb-4 border-b border-white/5">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Audit Timeline</span>
                        <h3 className="text-4xl font-black text-white uppercase tracking-tighter">
                          {monthNames[calMonth.month]} <span className="opacity-20">{calMonth.year}</span>
                        </h3>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right space-y-0.5">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Carga Mensual</span>
                          <div className="text-2xl font-black text-emerald-400 tracking-tighter">{fmtPts(calMonthTotal.pts)}</div>
                        </div>
                        <div className="w-px h-10 bg-white/10"></div>
                        <div className="text-right space-y-0.5">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Densidad Órdenes</span>
                          <div className="text-2xl font-black text-white tracking-tighter">{calMonthTotal.orders}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'].map((d) => (
                        <div key={d} className="text-center text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] pb-2">{d}</div>
                      ))}
                      {calendarGrid.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} className="aspect-square opacity-0" />;
                        const dayData = calendarData[day];
                        const hasPts = dayData && dayData.pts > 0;
                        
                        return (
                          <div 
                            key={day} 
                            className={`aspect-square rounded-xl border flex flex-col items-center justify-center relative group transition-all duration-300
                              ${hasPts ? 'bg-indigo-600/20 border-indigo-500/30' : 'bg-white/5 border-white/5 opacity-30'}
                            `}
                          >
                            <span className={`text-base font-black ${hasPts ? 'text-white' : 'text-slate-700'}`}>{day}</span>
                            {hasPts && (
                                <div className="text-[8px] font-black text-emerald-400 mt-1 tracking-tighter">{fmtPts(dayData.pts)}</div>
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
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                   {Object.entries(macroZoneData).slice(0, 4).map(([name, data]) => (
                      <div key={name} className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 overflow-hidden shadow-xl relative group hover:scale-[1.01] transition-all duration-500">
                         <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                                  <MapPin className="w-5 h-5 text-emerald-400" />
                               </div>
                               <div className="space-y-0.5">
                                  <h4 className="text-lg font-black text-white uppercase tracking-tight">{name}</h4>
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Macro Zone Audit</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="text-xl font-black text-emerald-400 tracking-tighter uppercase tabular-nums">{fmtPts(data.totalPts)} <span className="text-[8px] text-slate-500/70">PTS</span></div>
                               <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{data.totalOrders} ÓRDENES</div>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            {data.cities.filter(c => c.pts > 0).slice(0, 6).map(city => (
                               <div key={city.name} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-white/[0.08] transition-all relative overflow-hidden group/city">
                                  <span className="text-[8px] font-black text-slate-500 uppercase mb-2 text-center truncate w-full relative z-10 tracking-widest">{city.name}</span>
                                  <span className="text-xl font-black text-white relative z-10 tabular-nums tracking-tighter">{fmtPts(city.pts)}</span>
                                  <div className="w-6 h-0.5 bg-emerald-500/20 rounded-full mt-2 group-hover/city:w-12 transition-all duration-500"></div>
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



      {/* ── MOBILE QUICK ACTION HUB ── */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-4 md:hidden z-[100]">
        <button
          onClick={openPresentation}
          className="p-4 bg-emerald-600 text-white rounded-full shadow-2xl active:scale-90 transition-all border-2 border-emerald-400/50"
        >
          <Presentation className="w-6 h-6" />
        </button>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="p-4 bg-white/90 backdrop-blur-md text-emerald-600 border border-slate-200 rounded-full shadow-2xl active:scale-90 transition-all"
        >
          <ArrowUpCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
