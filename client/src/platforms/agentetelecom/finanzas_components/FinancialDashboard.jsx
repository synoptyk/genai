
import React from 'react';
import { 
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, Line, Cell, LabelList 
} from 'recharts';
import { 
  CalendarCheck, TrendingUp, Star, TrendingDown, Trophy, Target, Users, BarChart3, Activity, DollarSign
} from 'lucide-react';
import { formatCLP, getBaremo } from '../utils/financialUtils';

const CustomTooltip = ({ active, payload, title }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-2xl border border-white/10 p-6 rounded-[2rem] shadow-2xl min-w-[250px]">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
           <div className="w-2 h-8 bg-emerald-500 rounded-full" />
           <p className="text-[10px] font-black text-white uppercase tracking-widest">{title}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl">
           <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Monto</p>
           <p className="text-2xl font-black text-white">{formatCLP(payload[0].value)}</p>
        </div>
      </div>
    );
  }
  return null;
};

const FinancialDashboard = ({ dashboardData, metaConfig = {}, stats = {} }) => {
  if (!dashboardData) return null;

  const techRanking = dashboardData.techRanking || [];
  const elapsedDays = dashboardData.elapsedDays || 0;
  const calendarData = dashboardData.calendarData || {};
  const totalDaysInMonth = metaConfig.diasLaboralesMes || 22;
  const remainingWorkDays = Math.max(0, totalDaysInMonth - elapsedDays);

  // Baremo de referencia para metas generales
  const baremoRef = getBaremo('DEFAULT');
  const metaDiariaPts = metaConfig.metaProduccionDia || 7.5;
  const metaDiariaCLP = metaDiariaPts * baremoRef;

  // Cálculos Financieros
  const totalCLP = techRanking.reduce((acc, t) => acc + (t.clp || 0), 0);
  const techsWithProd = techRanking.filter(t => (t.clp || 0) > 0);
  const numTecnicosActivos = techsWithProd.length || 1;

  // Metas Inteligentes
  const metaAcumuladaReal = techRanking.reduce((acc, t) => acc + ((t.activeDays || 0) * metaDiariaCLP), 0);
  const metaMesEquipoReal = techRanking.reduce((acc, t) => {
    const daysWillWork = (t.activeDays || 0) + remainingWorkDays;
    return acc + (daysWillWork * metaDiariaCLP);
  }, 0);

  const avgDiarioEquipo = (elapsedDays > 0 && numTecnicosActivos > 0) ? (totalCLP / numTecnicosActivos / elapsedDays) : 0;
  
  const pctDia = metaDiariaCLP > 0 ? (avgDiarioEquipo / metaDiariaCLP) * 100 : 0;
  const pctMes = metaMesEquipoReal > 0 ? (totalCLP / metaMesEquipoReal) * 100 : 0;
  const pctCumplimiento = metaAcumuladaReal > 0 ? (totalCLP / metaAcumuladaReal) * 100 : 0;
  
  const totalProyectado = techRanking.reduce((acc, t) => {
    if ((t.clp || 0) <= 0) return acc;
    if (t.status === 'Finiquitado' || t.status === 'Retirado') return acc + t.clp;
    const techActiveDays = t.activeDays || elapsedDays || 1;
    return acc + ((t.clp / techActiveDays) * totalDaysInMonth);
  }, 0);

  const pctProyeccion = metaMesEquipoReal > 0 ? (totalProyectado / metaMesEquipoReal) * 100 : 0;

  // Tendencia diaria
  const trendData = Object.entries(calendarData || {})
    .map(([date, d]) => ({
      date: date.split('-').slice(2).join('/'),
      fullDate: date,
      clp: Math.round(d.clp || 0),
      meta: Math.round(metaDiariaCLP * numTecnicosActivos)
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  const top10Techs = techRanking.slice(0, 10);
  const bottom10Techs = [...techRanking]
    .filter(t => t.clp > 0)
    .sort((a, b) => a.clp - b.clp)
    .slice(0, 10);

  return (
    <div className="space-y-10 animate-in fade-in zoom-in duration-1000 pb-20">
      
      {/* ── KPIS EJECUTIVOS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-12 -mt-12" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cumplimiento</p>
              <h4 className="text-sm font-black text-slate-700">Meta Financiera</h4>
            </div>
          </div>
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Diario</span>
                <span className={`text-xs font-black ${pctDia >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pctDia.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(100, pctDia)}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Mensual</span>
                <span className={`text-xs font-black ${pctMes >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pctMes.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, pctMes)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-12 -mt-12" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Actual</p>
              <h4 className="text-sm font-black text-slate-700">Ingresos Brutos</h4>
            </div>
          </div>
          <div className="relative">
            <p className="text-3xl font-black text-slate-800 tabular-nums tracking-tighter">
              {formatCLP(totalCLP)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Meta Acumulada: <span className="text-indigo-500">{formatCLP(metaAcumuladaReal)}</span>
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <div className={`px-4 py-2 rounded-2xl font-black text-lg ${pctCumplimiento >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {pctCumplimiento.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-12 -mt-12" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proyección</p>
              <h4 className="text-sm font-black text-slate-700">Cierre de Mes</h4>
            </div>
          </div>
          <div className="relative">
            <p className="text-3xl font-black text-slate-800 tabular-nums tracking-tighter">
              {formatCLP(totalProyectado)}
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Objetivo: <span className="text-amber-600">{formatCLP(metaMesEquipoReal)}</span>
            </p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="text-sm font-black text-amber-600">{pctProyeccion.toFixed(0)}%</span>
            <div className="flex-1 ml-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${Math.min(100, pctProyeccion)}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -mr-12 -mt-12" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fuerza Laboral</p>
              <h4 className="text-sm font-black text-slate-700">Productividad</h4>
            </div>
          </div>
          <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">{numTecnicosActivos}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Técnicos con Producción</p>
          <div className="mt-6 flex items-center gap-2">
             <div className="flex-1 h-1 bg-violet-100 rounded-full" />
             <span className="text-[10px] font-black text-violet-600">Prom. {formatCLP(avgDiarioEquipo)}/día</span>
          </div>
        </div>
      </div>

      {/* ── GRÁFICOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl relative group">
          <h3 className="text-xl font-black text-white flex items-center gap-3 mb-10">
            <CalendarCheck size={24} className="text-indigo-400" />
            Tendencia de Ingresos Diarios
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={trendData}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis hide domain={[0, 'dataMax + 100000']} />
                <Tooltip content={<CustomTooltip title="Ingresos" />} />
                <Bar dataKey="clp" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={20} opacity={0.8} />
                <Line type="monotone" dataKey="clp" stroke="#818cf8" strokeWidth={4} dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#6366f1' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-10">
            <Star size={24} className="text-amber-500" />
            Top 10 Productividad Financiera
          </h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={top10Techs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} width={100} />
                <Tooltip content={<CustomTooltip title="Acumulado" />} />
                <Bar dataKey="clp" radius={[0, 10, 10, 0]} barSize={24}>
                  {top10Techs.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#fbbf24' : index < 3 ? '#818cf8' : '#e2e8f0'} />
                  ))}
                  <LabelList dataKey="clp" position="right" formatter={v => formatCLP(v).replace('$','')} style={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FinancialDashboard;
