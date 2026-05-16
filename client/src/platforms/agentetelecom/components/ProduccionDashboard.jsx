import React from 'react';
import { 
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, Line, Cell, LabelList 
} from 'recharts';
import { 
  CalendarCheck, TrendingUp, Star, TrendingDown, Trophy, Target, Users, BarChart3, Activity
} from 'lucide-react';

const CustomTooltip = ({ active, payload, title, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-950/95 backdrop-blur-2xl border border-white/10 p-8 rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.8)] min-w-[300px]">
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-white/10">
           <div className="w-3 h-10 bg-indigo-500 rounded-full" />
           <p className="text-[11px] font-black text-white uppercase tracking-[0.4em]">{title}</p>
        </div>
        <div className="space-y-6">
          <div className="bg-white/5 p-5 rounded-[1.5rem]">
             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Valor Obtenido</p>
             <p className="text-4xl font-black text-white">{payload[0].value.toLocaleString('es-CL')} <span className="text-sm text-slate-500">{unit}</span></p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const ProduccionDashboard = ({ dashboardData, metaConfig = {}, stats = {} }) => {
  if (!dashboardData) return null;

  const techStats = dashboardData.techStats || [];
  const projectionData = dashboardData.projectionData || [];
  const techRanking = dashboardData.techRanking || [];
  const elapsedDays = dashboardData.elapsedDays || 0;
  const calendarData = dashboardData.calendarData || {};
  const guaranteedMetaTechs = dashboardData.guaranteedMetaTechs || 0;
  // Técnicos que realmente están produciendo
  const techsWithProd = techRanking.filter(t => (t.pts || 0) > 0);
  const numTecnicosActivos = techsWithProd.length || 1;

  // Cálculos de Metas Inteligentes (Proporcionales a la realidad de cada técnico)
  const metaDiaria = metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5;
  const totalPts = stats.totalPts || techRanking.reduce((acc, t) => acc + (t.pts || 0), 0);
  const totalDaysInMonth = metaConfig.diasLaboralesMes || 22;
  const remainingWorkDays = Math.max(0, totalDaysInMonth - elapsedDays);

  // 1. Meta Acumulada: Suma de (días producidos por cada uno * meta diaria)
  const metaAcumuladaReal = techRanking.reduce((acc, t) => acc + ((t.activeDays || 0) * metaDiaria), 0);
  
  // 2. Objetivo Mensual: Suma de (días producidos + días por producir) * meta diaria
  const metaMesEquipoReal = techRanking.reduce((acc, t) => {
    const daysWillWork = (t.activeDays || 0) + remainingWorkDays;
    return acc + (daysWillWork * metaDiaria);
  }, 0);

  // Metas por periodo (KPIs Progresión)
  const metaSemanal = metaDiaria * (metaConfig.diasLaboralesSemana || 5);
  const avgDiarioEquipo = (elapsedDays > 0 && numTecnicosActivos > 0) ? (totalPts / numTecnicosActivos / elapsedDays) : 0;
  
  const pctDia = metaDiaria > 0 ? (avgDiarioEquipo / metaDiaria) * 100 : 0;
  const pctSem = metaSemanal > 0 ? ((avgDiarioEquipo * (metaConfig.diasLaboralesSemana || 5)) / metaSemanal) * 100 : 0;
  const pctMes = metaMesEquipoReal > 0 ? (totalPts / metaMesEquipoReal) * 100 : 0;

  const metaGeneralDiaria = metaDiaria * numTecnicosActivos;
  const pctCumplimiento = metaAcumuladaReal > 0 ? (totalPts / metaAcumuladaReal) * 100 : 0;
  
  const totalProyectado = techsWithProd.reduce((acc, t) => {
    if ((t.pts || 0) <= 0) return acc;
    
    if (t.status === 'Finiquitado' || t.status === 'Retirado' || t.status === 'Rechazado') {
      return acc + t.pts; // No se proyecta crecimiento
    }
    
    // Proyección lineal: (pts actuales / días producidos por el técnico) * días totales del mes
    const techActiveDays = t.activeDays || elapsedDays || 1;
    const projected = (t.pts / techActiveDays) * totalDaysInMonth;
    return acc + projected;
  }, 0);

  const proyeccionCierre = totalProyectado;
  const pctProyeccion = metaMesEquipoReal > 0 ? (proyeccionCierre / metaMesEquipoReal) * 100 : 0;

  // Formatear datos para tendencia diaria
  const trendData = Object.entries(calendarData || {})
    .map(([date, d]) => ({
      date: date.split('-').slice(2).join('/'),
      fullDate: date,
      pts: Math.round(d.pts || 0),
      meta: Math.round(metaGeneralDiaria)
    }))
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  // Función para acortar nombres (Primer Nombre + Primer Apellido)
  const shortenName = (name) => {
    if (!name) return '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length <= 1) return name;
    // Formato HR: Primer Nombre y Primer Apellido (Nombre1 [Nombre2] Apellido1 [Apellido2])
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    return `${parts[0]} ${parts[1]}`;
  };

  // Top 10 Técnicos
  const top10Techs = techRanking.slice(0, 10).map(t => ({ ...t, name: shortenName(t.name) }));
  
  // Bottom 10 Técnicos (Los más bajos)
  const bottom10Techs = [...techRanking]
    .filter(t => t.pts > 0) // Solo los que tienen algo de producción
    .sort((a, b) => a.pts - b.pts)
    .slice(0, 10)
    .map(t => ({ ...t, name: shortenName(t.name) }));

  // Nombre del mes actual
  const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date());

  // Análisis por Día de la Semana (Lunes - Domingo)
  const daysMap = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab' };
  const dowStatsRaw = { 'Lun': [], 'Mar': [], 'Mie': [], 'Jue': [], 'Vie': [], 'Sab': [], 'Dom': [] };
  
  Object.entries(calendarData || {}).forEach(([date, d]) => {
    const [y, m, dayNum] = date.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
    const label = daysMap[day];
    if (d.pts > 0) dowStatsRaw[label].push(d.pts);
  });

  const dowData = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(label => {
    const vals = dowStatsRaw[label];
    return {
      day: label,
      pts: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    };
  });

  const lpuActivities = stats.activities || [];

  return (
    <div className="space-y-10 animate-in fade-in zoom-in duration-1000 pb-20">
      
      {/* ── SECCIÓN 1: KPIS EJECUTIVOS ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Desempeño vs Metas */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rendimiento Equipo</p>
              <h4 className="text-sm font-black text-slate-700">Cumplimiento Metas</h4>
            </div>
          </div>
          
          <div className="space-y-5">
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Diario</span>
                <span className={`text-xs font-black ${pctDia >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pctDia.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctDia)}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Semanal</span>
                <span className={`text-xs font-black ${pctSem >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pctSem.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctSem)}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Mensual</span>
                <span className={`text-xs font-black ${pctMes >= 100 ? 'text-emerald-500' : 'text-indigo-500'}`}>{pctMes.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctMes)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Producción Real vs Meta Acumulada */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Target size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado Actual</p>
              <h4 className="text-sm font-black text-slate-700">Producción vs Meta</h4>
            </div>
          </div>
          
          <div className="relative">
            <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">
              {totalPts.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
              <span className="text-xs text-slate-400 ml-2 font-bold tracking-widest uppercase">PTS</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Meta esperada: <span className="text-indigo-500">{metaAcumuladaReal.toLocaleString('es-CL', { maximumFractionDigits: 0 })} pts</span>
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase">Días Prod.</span>
              <span className="text-lg font-black text-slate-700">{elapsedDays} <span className="text-[10px] opacity-40">DÍAS</span></span>
            </div>
            <div className={`px-4 py-2 rounded-2xl font-black text-lg ${pctCumplimiento >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {pctCumplimiento.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Pronóstico de Cierre */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Proyección</p>
              <h4 className="text-sm font-black text-slate-700">Cierre Estimado</h4>
            </div>
          </div>
          
          <div className="relative">
            <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">
              {proyeccionCierre.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
              <span className="text-xs text-slate-400 ml-2 font-bold tracking-widest uppercase">PTS</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Objetivo Mensual: <span className="text-amber-600">{metaMesEquipoReal.toLocaleString('es-CL', { maximumFractionDigits: 0 })} pts</span>
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${Math.min(100, pctProyeccion)}%` }} />
              </div>
            </div>
            <span className="text-sm font-black text-amber-600">{pctProyeccion.toFixed(0)}%</span>
          </div>
        </div>

        {/* Técnicos Elite */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fuerza Laboral</p>
              <h4 className="text-sm font-black text-slate-700">Zona de Éxito</h4>
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <div>
              <p className="text-5xl font-black text-slate-800 tabular-nums tracking-tighter">{guaranteedMetaTechs}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Técnicos > 85% meta</p>
            </div>
            <div className="flex -space-x-3 mb-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-violet-100 flex items-center justify-center">
                  <Star size={12} className="text-violet-500" fill="currentColor" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
             <div className="flex-1 h-1 bg-violet-100 rounded-full">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(guaranteedMetaTechs / Math.max(1, numTecnicosActivos)) * 100}%` }} />
             </div>
             <span className="text-[10px] font-black text-violet-600">
                {Math.round((guaranteedMetaTechs / Math.max(1, numTecnicosActivos)) * 100)}% flota
             </span>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: ANÁLISIS GRÁFICO AVANZADO ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Tendencia de Producción Diaria */}
        <div className="bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
             <TrendingUp size={120} className="text-indigo-400" />
          </div>
          
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <CalendarCheck size={24} className="text-indigo-400" />
                Tendencia de Producción
              </h3>
              <p className="text-indigo-300/40 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Evolución diaria de puntos vs meta teórica</p>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis hide domain={[0, 'dataMax + 10']} />
                <Tooltip content={<CustomTooltip title="Puntos" />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                
                <Bar 
                  dataKey="pts" 
                  fill="#6366f1" 
                  radius={[10, 10, 0, 0]} 
                  barSize={20}
                  opacity={0.8}
                />
                <Line 
                  type="monotone" 
                  dataKey="pts" 
                  stroke="#818cf8" 
                  strokeWidth={4} 
                  dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#6366f1' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
                <Line 
                  type="stepAfter" 
                  dataKey="meta" 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false}
                  opacity={0.3}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking Top 10 Técnicos */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Star size={24} className="text-amber-500" />
                Top 10 Rendimiento
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Líderes de producción acumulada</p>
            </div>
            <div className="px-4 py-2 bg-slate-50 rounded-2xl text-[10px] font-black text-slate-500 uppercase">
              Ranking {monthName}
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={top10Techs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip title="Acumulado" />} />
                <Bar dataKey="pts" radius={[0, 10, 10, 0]} barSize={24}>
                  {top10Techs.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#fbbf24' : index < 3 ? '#818cf8' : '#e2e8f0'} />
                  ))}
                  <LabelList dataKey="pts" position="right" style={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rendimiento por Día de la Semana */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <BarChart3 size={24} className="text-violet-500" />
                Patrón Semanal
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Promedio de puntos por día de la semana</p>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dowData}>
                <XAxis 
                  dataKey="day" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip title="Promedio" />} />
                <Bar dataKey="pts" radius={[15, 15, 15, 15]} barSize={40}>
                  {dowData.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={entry.pts >= metaGeneralDiaria ? '#6366f1' : entry.pts >= (metaGeneralDiaria * 0.7) ? '#818cf8' : '#e2e8f0'} 
                    />
                  ))}
                  <LabelList dataKey="pts" position="top" style={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking 10 Más Bajos */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <TrendingDown size={24} className="text-rose-500" />
                Oportunidades de Mejora
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">10 Rendimientos más bajos del periodo</p>
            </div>
            <div className="px-4 py-2 bg-rose-50 rounded-2xl text-[10px] font-black text-rose-600 uppercase">
              Alerta Crítica
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bottom10Techs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip title="Acumulado" />} />
                <Bar dataKey="pts" radius={[0, 10, 10, 0]} barSize={24}>
                  {bottom10Techs.map((entry, index) => (
                    <Cell key={index} fill="#fda4af" />
                  ))}
                  <LabelList dataKey="pts" position="right" style={{ fontSize: 10, fontWeight: 900, fill: '#f43f5e' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── SECCIÓN 3: DISTRIBUCIÓN POR ACTIVIDAD ──────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Activity size={24} className="text-indigo-500" />
              Mix de Actividades
            </h3>
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Desglose de tareas ejecutadas por el equipo</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {lpuActivities.slice(0, 12).map((act, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Activity size={14} />
                </div>
                <span className="text-[10px] font-black text-indigo-500">{totalPts > 0 ? Math.round((act.totalPts / totalPts) * 100) : 0}%</span>
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase truncate leading-none mb-1">{act.desc}</p>
              <p className="text-lg font-black text-slate-700 leading-none">{act.count}</p>
              <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{act.totalPts.toFixed(1)} pts total</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProduccionDashboard;
