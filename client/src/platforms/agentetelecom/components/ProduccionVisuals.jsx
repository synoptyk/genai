
import { 
  Activity, TrendingUp, TrendingDown, Users, Package, 
  Target, Zap, Clock, Star, Award, Trophy, Sparkles,
  CalendarCheck, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { 
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Scatter,
  LabelList
} from 'recharts';
import { fmtPts } from '../utils/produccionUtils';

export const MetaBadge = ({ pts, meta, label }) => {
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

export const MetaGap = ({ pts, meta, compact = false }) => {
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

export const useSortable = (defaultKey = 'ptsTotal', defaultDir = 'desc') => {
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

export const PremiumSection = ({ id, title, subtitle, icon: Icon, children, actions }) => (
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

export const CompositionBar = ({ base, decoCable, decoWifi, repetidor, telefono }) => {
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

export const greenScale = (val, meta) => {
  if (val <= 0) return 'bg-indigo-50/30 text-indigo-100';
  const pct = val / (meta || 1);
  if (pct >= 1.2) return 'bg-emerald-600 text-white shadow-lg shadow-emerald-100';
  if (pct >= 1) return 'bg-emerald-500 text-white';
  if (pct >= 0.8) return 'bg-emerald-400 text-white';
  if (pct >= 0.5) return 'bg-emerald-200 text-emerald-800';
  if (pct >= 0.2) return 'bg-emerald-100 text-emerald-700';
  return 'bg-emerald-50 text-emerald-600';
};

export const MiniStat = ({ label, value, icon: Icon }) => (
  <div className="bg-indigo-50/40 backdrop-blur-sm rounded-xl p-3 border border-indigo-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-1.5 mb-1">
      {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600" />}
      <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-xl font-black text-indigo-900 tracking-tight">{value}</div>
  </div>
);

export const StatCard = ({ icon: Icon, label, value, sub, secondSub, color = 'emerald', target }) => {
  const parseNum = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    return parseFloat(v.toString().replace(/\./g, '').replace(',', '.'));
  };

  const valNum = parseNum(value);
  const targetNum = parseNum(target);
  const pct = targetNum > 0 ? Math.min(100, (valNum / targetNum) * 100) : 0;
  const colorClass = color === 'blue' ? 'indigo' : color;

  return (
    <div className="relative group bg-slate-800/90 backdrop-blur-2xl border border-white/20 rounded-2xl p-5 transition-all hover:bg-slate-800 hover:scale-[1.02] overflow-hidden shadow-2xl">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={`w-12 h-12 text-white`} />
      </div>
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.25em] mb-1.5 drop-shadow-sm">{label}</span>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-white tracking-tighter leading-none drop-shadow-lg">{value}</h3>
            {target && <span className="text-[12px] font-bold text-slate-400 whitespace-nowrap">/ {target}</span>}
          </div>
        </div>
        <div className={`p-3 rounded-xl bg-${colorClass}-500/20 border border-${colorClass}-400/40 group-hover:scale-110 transition-transform shadow-inner`}>
          <Icon className={`w-6 h-6 text-${colorClass}-400`} />
        </div>
      </div>
      {(sub || secondSub) && (
        <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-col gap-1.5">
           {sub && (
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{sub}</span>
             </div>
           )}
           {secondSub && (
             <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{secondSub}</span>
             </div>
           )}
          {target && (
            <div className="h-1.5 w-full bg-slate-900/50 rounded-full overflow-hidden border border-white/5 mt-2">
               <div 
                 className={`h-full bg-${colorClass}-500 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-1000 ease-out`} 
                 style={{ width: `${pct}%` }}
               />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const WeeklyGlobalPremium = ({ data, metaConfig, exportToExcel }) => {
  if (!data || data.length === 0) return null;

  const totalMonthPts = data.reduce((acc, w) => acc + w.pts, 0);
  const totalOrders = data.reduce((acc, w) => acc + w.orders, 0);
  const bestWeek = [...data].sort((a, b) => b.pts - a.pts)[0];
  const avgWeeklyPts = totalMonthPts / (data.length || 1);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 group hover:border-indigo-200 transition-all">
          <div className="flex items-center justify-between mb-4">
             <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                <Target size={20} />
             </div>
             <div className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">ACTIVO</div>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Periodo</span>
          <div className="text-3xl font-black text-slate-800 tracking-tighter">{Math.round(totalMonthPts).toLocaleString('es-CL')} <span className="text-sm text-slate-400">pts</span></div>
        </div>

        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between mb-4">
             <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                <Zap size={20} />
             </div>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Promedio Semanal</span>
          <div className="text-3xl font-black text-slate-800 tracking-tighter">{Math.round(avgWeeklyPts).toLocaleString('es-CL')} <span className="text-sm text-slate-400">pts</span></div>
        </div>

        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 group hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between mb-4">
             <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
                <Star size={20} />
             </div>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Mejor Desempeño</span>
          <div className="text-xl font-black text-slate-800 tracking-tight">{bestWeek.label}</div>
          <div className="text-xs font-bold text-amber-600 mt-1">{Math.round(bestWeek.pts)} pts logrados</div>
        </div>

        <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-slate-200/40 group hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between mb-4">
             <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                <Package size={20} />
             </div>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Órdenes Totales</span>
          <div className="text-3xl font-black text-slate-800 tracking-tighter">{totalOrders.toLocaleString('es-CL')}</div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl p-8">
        <div className="flex items-center justify-between mb-8">
           <div>
             <h3 className="text-lg font-black text-slate-900 tracking-tight">Curva de Producción Semanal</h3>
             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Evolución de puntos baremados por semana ISO</p>
           </div>
           <button 
             onClick={() => exportToExcel(data, 'Analisis_Semanal_Telecom')}
             className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
           >
              <CalendarCheck size={14} />
              Exportar Análisis
           </button>
        </div>
        
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <defs>
                <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255,255,255,0.95)', 
                  borderRadius: '1.5rem', 
                  border: 'none', 
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  padding: '1.5rem'
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
              />
              <Area type="monotone" dataKey="pts" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorPts)" />
              <Bar dataKey="orders" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
              <Line type="monotone" dataKey="pts" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
