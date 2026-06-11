import React from 'react';
import { 
  ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip as RechartsTooltip, Bar, Line, Cell, LabelList 
} from 'recharts';
import { 
  CalendarCheck, TrendingUp, Star, TrendingDown, Trophy, Target, Users, BarChart3, Activity, Briefcase, MapPin, Clock, Zap, Timer
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

const ProduccionDashboard = ({ dashboardData, metaConfig = {}, stats = {}, tecnicos = [], clientProjects = [], cities = {}, dateFrom, lpuActivities = [] }) => {
  if (!dashboardData) return null;

  const techRanking = dashboardData.techRanking || [];
  const elapsedDays = dashboardData.elapsedDays || 0;
  const calendarData = dashboardData.calendarData || {};
  const guaranteedMetaTechs = dashboardData.guaranteedMetaTechs || 0;
  const techsWithProd = techRanking.filter(t => (t.pts || 0) > 0);
  const numTecnicosActivos = techsWithProd.length || 1;

  // --- CÁLCULOS KPI GLOBALES ---
  const metaDiaria = metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5;
  const totalPts = stats.totalPts || techRanking.reduce((acc, t) => acc + (t.pts || 0), 0);
  const totalDaysInMonth = metaConfig.diasLaboralesMes || 22;
  const remainingWorkDays = Math.max(0, totalDaysInMonth - elapsedDays);

  const metaAcumuladaReal = techRanking.reduce((acc, t) => acc + ((t.activeDays || 0) * metaDiaria), 0);
  const metaMesEquipoReal = techRanking.reduce((acc, t) => acc + (((t.activeDays || 0) + remainingWorkDays) * metaDiaria), 0);
  
  const metaSemanal = metaDiaria * (metaConfig.diasLaboralesSemana || 5);
  const avgDiarioEquipo = (elapsedDays > 0 && numTecnicosActivos > 0) ? (totalPts / numTecnicosActivos / elapsedDays) : 0;
  
  const pctDia = metaDiaria > 0 ? (avgDiarioEquipo / metaDiaria) * 100 : 0;
  const pctSem = metaSemanal > 0 ? ((avgDiarioEquipo * (metaConfig.diasLaboralesSemana || 5)) / metaSemanal) * 100 : 0;
  const pctMes = metaMesEquipoReal > 0 ? (totalPts / metaMesEquipoReal) * 100 : 0;

  const metaGeneralDiaria = metaDiaria * numTecnicosActivos;
  const pctCumplimiento = metaAcumuladaReal > 0 ? (totalPts / metaAcumuladaReal) * 100 : 0;
  
  // Proyección global más estable que la suma de proyecciones individuales
  const proyeccionCierre = elapsedDays > 0 ? (totalPts / elapsedDays) * totalDaysInMonth : 0;
  const pctProyeccion = metaMesEquipoReal > 0 ? (proyeccionCierre / metaMesEquipoReal) * 100 : 0;

  // --- RESUMEN DE TECNICOS (LA MATRIX) ---
  const summary = {
    asignadas: 0, completadas: 0, noRealizadas: 0,
    horasEjecutadas: 0, horasAlta: 0, horasReparacion: 0, horasRutina: 0,
    ordersAlta: 0, ordersReparacion: 0, ordersRutina: 0
  };

  tecnicos.forEach(t => {
    Object.values(t.dailyMap || {}).forEach(dd => {
      const comp = dd?.completadas || 0;
      const noRe = dd?.noRealizadas || 0;
      summary.completadas += comp;
      summary.noRealizadas += noRe;
      summary.asignadas += comp + noRe;

      // Las horas vienen en minutos en el dailyMap
      summary.horasEjecutadas += (dd?.minTotal || 0) / 60;
      summary.horasAlta += (dd?.minAlta || 0) / 60;
      summary.horasReparacion += (dd?.minReparacion || 0) / 60;
      summary.horasRutina += (dd?.minRutina || 0) / 60;
      
      summary.ordersAlta += (dd?.ordersAlta || 0);
      summary.ordersReparacion += (dd?.ordersReparacion || 0);
      summary.ordersRutina += (dd?.ordersRutina || 0);
    });
  });
  summary.noRealizadas = Math.max(0, summary.asignadas - summary.completadas);
  const pctEfectividad = summary.asignadas > 0 ? (summary.completadas / summary.asignadas) * 100 : 0;
  const pctAltas = summary.horasEjecutadas > 0 ? (summary.horasAlta / summary.horasEjecutadas) * 100 : 0;
  const pctReps = summary.horasEjecutadas > 0 ? (summary.horasReparacion / summary.horasEjecutadas) * 100 : 0;
  const pctRutinas = summary.horasEjecutadas > 0 ? (summary.horasRutina / summary.horasEjecutadas) * 100 : 0;

  // --- CÁLCULOS EXTRAS ---
  const totalActiveTechDays = techRanking.reduce((sum, t) => sum + (t.activeDays || 0), 0);
  const avgTecnicosDiario = elapsedDays > 0 ? (totalActiveTechDays / elapsedDays) : 0;
  const trueAvgPtsTechDia = totalActiveTechDays > 0 ? (totalPts / totalActiveTechDays) : 0;
  const pctRealVsMeta = metaDiaria > 0 ? (trueAvgPtsTechDia / metaDiaria) * 100 : 0;
  
  const dynamicMetaMes = avgTecnicosDiario * metaDiaria * totalDaysInMonth;
  const brechaMes = Math.max(0, dynamicMetaMes - proyeccionCierre);
  const diasRestantes = totalDaysInMonth - elapsedDays;
  const ritmoNecesario = diasRestantes > 0 ? brechaMes / diasRestantes : 0;
  const pctProyeccionReal = dynamicMetaMes > 0 ? (proyeccionCierre / dynamicMetaMes) * 100 : 0;

  const avgHorasFlotaDia = elapsedDays > 0 ? (summary.horasEjecutadas / elapsedDays) : 0;
  const avgHorasTechDia = avgTecnicosDiario > 0 ? (avgHorasFlotaDia / avgTecnicosDiario) : 0;
  
  const totalOrders = summary.ordersAlta + summary.ordersReparacion + summary.ordersRutina;
  const avgMinsPorOrden = totalOrders > 0 ? (summary.horasEjecutadas * 60) / totalOrders : 0;
  const avgMinsAlta = summary.ordersAlta > 0 ? (summary.horasAlta * 60) / summary.ordersAlta : 0;
  const avgMinsRutina = summary.ordersRutina > 0 ? (summary.horasRutina * 60) / summary.ordersRutina : 0;
  const avgMinsRep = summary.ordersReparacion > 0 ? (summary.horasReparacion * 60) / summary.ordersReparacion : 0;

  const avgOrdersTechDia = avgTecnicosDiario > 0 ? (summary.completadas / elapsedDays / avgTecnicosDiario) : 0;
  const avgPtsTechDia = avgTecnicosDiario > 0 ? (totalPts / elapsedDays / avgTecnicosDiario) : 0;

  let ptsAlta = 0, ptsRutina = 0, ptsReparacion = 0;
  lpuActivities.forEach(act => {
    const grupo = (act.grupo || '').toUpperCase();
    const categoriaDoc = (act.categoria || '').toUpperCase();

    let isAlta = /INSTALACION|BANDA ANCHA|TELEVISION|VOZ|RED/i.test(grupo);
    let isRutina = /RUTINA|PREVENTIVO/i.test(grupo) || /MANTENIMIENTO/i.test(categoriaDoc);
    let isReparacion = /AVERIA|RESOLUCION|REPARACION/i.test(grupo) || /AVER[IÍ]A/i.test(categoriaDoc);

    // Fallback if no LPU category is matched
    if (!isAlta && !isRutina && !isReparacion) {
      isAlta = /ALTA|INSTALACI[OÓ]N|MIGRACI[OÓ]N|TRASLADO/i.test(act.desc);
      isRutina = /RUTINA|RP\s/i.test(act.desc);
      isReparacion = /AVER[IÍ]A|RECLAMO|MANTENIMIENTO|REPOSICI[OÓ]N|REPARACI[OÓ]N/i.test(act.desc);
    }
    
    if (isAlta) ptsAlta += act.totalPts || 0;
    else if (isRutina) ptsRutina += act.totalPts || 0;
    else if (isReparacion) ptsReparacion += act.totalPts || 0;
  });
  const totalCategoryPts = ptsAlta + ptsRutina + ptsReparacion;
  const pctPtsAlta = totalCategoryPts > 0 ? (ptsAlta / totalCategoryPts) * 100 : 0;
  const pctPtsRutina = totalCategoryPts > 0 ? (ptsRutina / totalCategoryPts) * 100 : 0;
  const pctPtsRep = totalCategoryPts > 0 ? (ptsReparacion / totalCategoryPts) * 100 : 0;

  // --- GRÁFICOS Y DATOS ---
  const trendData = Object.entries(calendarData || {}).map(([date, d]) => ({
    date: date.split('-').slice(2).join('/'), fullDate: date, pts: Math.round(d.pts || 0), meta: Math.round(metaGeneralDiaria)
  })).sort((a, b) => a.fullDate.localeCompare(b.fullDate));

  const shortenName = (name) => {
    if (!name) return '';
    return name;
  };

  const top10Techs = techRanking.slice(0, 10).map(t => ({ ...t, name: shortenName(t.name) }));
  const bottom10Techs = [...techRanking].filter(t => t.pts > 0).sort((a, b) => a.pts - b.pts).slice(0, 10).map(t => ({ ...t, name: shortenName(t.name) }));
  const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date());

  const daysMap = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mie', 4: 'Jue', 5: 'Vie', 6: 'Sab' };
  const dowStatsRaw = { 'Lun': [], 'Mar': [], 'Mie': [], 'Jue': [], 'Vie': [], 'Sab': [], 'Dom': [] };
  Object.entries(calendarData || {}).forEach(([date, d]) => {
    const [y, m, dayNum] = date.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, dayNum)).getUTCDay();
    if (d.pts > 0) dowStatsRaw[daysMap[day]].push(d.pts);
  });
  const dowData = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(label => {
    const vals = dowStatsRaw[label];
    return { day: label, pts: vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
  });


  
  // Procesar Top Proyectos
  const topProjects = [...clientProjects].sort((a, b) => b.pts - a.pts).slice(0, 4);
  
  // Procesar Top Zonas
  const topCities = Object.entries(cities)
    .map(([name, data]) => ({ name: name || 'Otras', pts: Math.round(data?.pts || 0), orders: data.orders }))
    .sort((a, b) => b.pts - a.pts).slice(0, 4);

  return (
    <div className="space-y-10 animate-in fade-in zoom-in duration-1000 pb-20">
      
      {/* ── NIVEL 1: KPIs GLOBALES (MATRIX COMMAND) ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1 (NUEVA): Promedios Reales / Día */}
        <div className="bg-gradient-to-br from-violet-600 to-indigo-900 border border-violet-500/30 rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(139,92,246,0.4)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-white/10 text-white rounded-2xl backdrop-blur-md">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-violet-200 uppercase tracking-[0.2em]">Fuerza Laboral</p>
              <h4 className="text-sm font-black text-white">Promedios Reales / Día</h4>
            </div>
          </div>
          
          <div className="relative mb-6 z-10">
            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
              {trueAvgPtsTechDia.toFixed(1)}
              <span className="text-xs text-violet-200 ml-2 font-bold tracking-widest uppercase">PTS</span>
            </p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold text-violet-200">
                Promedio real por especialista al día
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5 backdrop-blur-md">
               <div>
                  <p className="text-[9px] font-black text-violet-300 uppercase tracking-widest">Especialistas</p>
                  <p className="text-sm font-black text-white">{avgTecnicosDiario.toFixed(1)} / Día</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-violet-300 uppercase tracking-widest">Puntos Red</p>
                  <p className="text-sm font-black text-white">{elapsedDays > 0 ? (totalPts / elapsedDays).toFixed(0) : 0} / Día</p>
               </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
               <div>
                  <p className="text-[9px] font-black text-violet-200 uppercase tracking-widest">Meta Teórica</p>
                  <p className="text-xs font-black text-white">Para {avgTecnicosDiario.toFixed(1)} techs</p>
               </div>
               <div className="text-right flex flex-col items-end">
                  <p className="text-[9px] font-black text-violet-200 uppercase tracking-widest flex items-center gap-2">
                    Deberían llevar 
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${pctRealVsMeta >= 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {pctRealVsMeta.toFixed(1)}%
                    </span>
                  </p>
                  <p className="text-sm font-black text-white">{(avgTecnicosDiario * metaDiaria).toFixed(1)} pts/día</p>
               </div>
            </div>
          </div>
        </div>

        {/* Card 2: Puntos Reales (PRODUCCIÓN) */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 border border-amber-400/30 rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(245,158,11,0.4)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-white/20 text-white rounded-2xl backdrop-blur-md">
              <Target size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-100 uppercase tracking-[0.2em]">Producción</p>
              <h4 className="text-sm font-black text-white">Puntos Reales</h4>
            </div>
          </div>
          
          <div className="relative mb-6 z-10">
            <p className="text-4xl font-black text-white tabular-nums tracking-tighter">
              {totalPts.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
              <span className="text-xs text-amber-100 ml-2 font-bold tracking-widest uppercase">PTS</span>
            </p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold text-amber-100">
                Total acumulado en el mes
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative z-10">
            <div className="flex items-center justify-between p-3 bg-black/10 rounded-2xl border border-white/5 backdrop-blur-md">
               <div>
                  <p className="text-[9px] font-black text-amber-200 uppercase tracking-widest">Proyección Mes</p>
                  <div className="flex items-baseline gap-1">
                     <p className="text-sm font-black text-white">{Math.round(proyeccionCierre).toLocaleString('es-CL')} pts</p>
                     <p className="text-[8px] font-bold text-amber-200/70 uppercase">({avgTecnicosDiario.toFixed(1)} techs)</p>
                  </div>
               </div>
               <div className="text-right flex flex-col items-end">
                  <p className="text-[9px] font-black text-amber-200 uppercase tracking-widest flex items-center gap-2">
                    Meta Promedio
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${pctProyeccionReal >= 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      {pctProyeccionReal.toFixed(0)}%
                    </span>
                  </p>
                  <p className="text-sm font-black text-white">{Math.round(dynamicMetaMes).toLocaleString('es-CL')} pts</p>
               </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-white/10 rounded-2xl border border-white/10 backdrop-blur-md">
               <div>
                  <p className="text-[9px] font-black text-amber-100 uppercase tracking-widest">Brecha al Cierre</p>
                  <p className="text-xs font-black text-white">Faltan {Math.round(brechaMes).toLocaleString('es-CL')} pts</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-amber-100 uppercase tracking-widest">Ritmo Necesario</p>
                  <p className="text-sm font-black text-white">{Math.round(ritmoNecesario).toLocaleString('es-CL')} pts/día</p>
               </div>
            </div>
          </div>
        </div>

        {/* Card 3: Rendimiento y Metas */}
        <div className="bg-slate-900 border border-indigo-500/20 rounded-[2.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(99,102,241,0.3)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400/70 uppercase tracking-[0.2em]">Matrix Status</p>
              <h4 className="text-sm font-black text-white">Cumplimiento Metas</h4>
            </div>
          </div>
          
          <div className="space-y-5 relative z-10">
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Diario</span>
                <span className={`text-xs font-black ${pctDia >= 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>{pctDia.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctDia)}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Semanal</span>
                <span className={`text-xs font-black ${pctSem >= 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>{pctSem.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctSem)}%` }} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase">Mensual</span>
                <span className={`text-xs font-black ${pctMes >= 100 ? 'text-emerald-400' : 'text-indigo-400'}`}>{pctMes.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" style={{ width: `${Math.min(100, pctMes)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Órdenes Globales */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Zap size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Eficiencia</p>
              <h4 className="text-sm font-black text-slate-700">Flujo de Órdenes</h4>
            </div>
          </div>
          
          <div className="relative mb-6 z-10">
            <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">
              {summary.completadas.toLocaleString('es-CL')}
              <span className="text-xs text-slate-400 ml-2 font-bold tracking-widest uppercase">COM</span>
            </p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] font-bold text-slate-400">
                Asignadas en total: <span className="text-emerald-600">{summary.asignadas.toLocaleString('es-CL')}</span>
              </p>
              <p className="text-[10px] font-bold text-slate-400">
                Prom/Día Tech: <span className="text-emerald-600">{avgOrdersTechDia.toFixed(1)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative z-10">
             <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Efectividad</p>
                   <p className="text-sm font-black text-emerald-600">{pctEfectividad.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">No Realizadas</p>
                   <p className="text-sm font-black text-rose-600">{summary.noRealizadas.toLocaleString('es-CL')}</p>
                </div>
             </div>
             
             <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100/50 mt-1">
                <div className="flex-1 text-center border-r border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Altas/Inst</p>
                   <p className="text-xs font-black text-slate-700">{summary.ordersAlta.toLocaleString('es-CL')}</p>
                   <p className="text-[9px] font-bold text-emerald-500 mt-0.5">{pctPtsAlta.toFixed(0)}% prod</p>
                </div>
                <div className="flex-1 text-center border-r border-slate-100">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rutinas</p>
                   <p className="text-xs font-black text-slate-700">{summary.ordersRutina.toLocaleString('es-CL')}</p>
                   <p className="text-[9px] font-bold text-violet-500 mt-0.5">{pctPtsRutina.toFixed(0)}% prod</p>
                </div>
                <div className="flex-1 text-center">
                   <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reparac.</p>
                   <p className="text-xs font-black text-slate-700">{summary.ordersReparacion.toLocaleString('es-CL')}</p>
                   <p className="text-[9px] font-bold text-orange-500 mt-0.5">{pctPtsRep.toFixed(0)}% prod</p>
                </div>
             </div>
          </div>
        </div>

        {/* Card 5: Horas Globales */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tiempos</p>
              <h4 className="text-sm font-black text-slate-700">Horas Ejecutadas</h4>
            </div>
          </div>
          
          <div className="relative mb-6 z-10">
            <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">
              {avgHorasTechDia.toFixed(1)}
              <span className="text-xs text-slate-400 ml-2 font-bold tracking-widest uppercase">HRS / DÍA</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Promedio por especialista al día
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 relative z-10">
             <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Acumulado</p>
                <p className="text-sm font-black text-sky-600">{Math.round(summary.horasEjecutadas).toLocaleString('es-CL')} hrs</p>
             </div>
             <div className="text-right">
                <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest">Flota / Día</p>
                <p className="text-sm font-black text-sky-600">{avgHorasFlotaDia.toFixed(1)} hrs</p>
             </div>
          </div>
        </div>

        {/* Card 5: Velocidad (Tiempo Promedio) */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <Timer size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rendimiento</p>
              <h4 className="text-sm font-black text-slate-700">Tiempo / Actividad</h4>
            </div>
          </div>
          
          <div className="relative mb-6 z-10">
            <p className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">
              {avgMinsPorOrden.toFixed(0)}
              <span className="text-xs text-slate-400 ml-2 font-bold tracking-widest uppercase">MINS</span>
            </p>
            <p className="text-[10px] font-bold text-slate-400 mt-1">
              Promedio general por orden
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 relative z-10 gap-2">
             <div className="flex-1 text-center border-r border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Altas ({pctAltas.toFixed(0)}%)</p>
                <p className="text-xs font-black text-rose-600">{Math.round(summary.horasAlta).toLocaleString('es-CL')}h</p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{avgMinsAlta.toFixed(0)} min/ord</p>
             </div>
             <div className="flex-1 text-center border-r border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rutinas ({pctRutinas.toFixed(0)}%)</p>
                <p className="text-xs font-black text-violet-500">{Math.round(summary.horasRutina).toLocaleString('es-CL')}h</p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{avgMinsRutina.toFixed(0)} min/ord</p>
             </div>
             <div className="flex-1 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reps ({pctReps.toFixed(0)}%)</p>
                <p className="text-xs font-black text-orange-500">{Math.round(summary.horasReparacion).toLocaleString('es-CL')}h</p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{avgMinsRep.toFixed(0)} min/ord</p>
             </div>
          </div>
        </div>
      </div>

      {/* ── NIVEL 2: FUERZA LABORAL Y RANKINGS ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Zona de Éxito */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-1000" />
          <div className="flex items-center gap-4 mb-10 relative z-10">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fuerza Laboral</p>
              <h4 className="text-lg font-black text-slate-700">Zona de Éxito</h4>
            </div>
          </div>
          
          <div className="flex flex-col h-[300px] justify-between relative z-10">
             <div className="flex items-end gap-4">
                <p className="text-8xl font-black text-violet-600 tabular-nums tracking-tighter">{guaranteedMetaTechs}</p>
                <div className="mb-4">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Técnicos</p>
                   <p className="text-sm font-black text-slate-700 mt-1">Superan el 85% meta</p>
                </div>
             </div>

             <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                   <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Activos Total</span>
                   <span className="text-lg font-black text-slate-800">{numTecnicosActivos}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                   <span className="text-xs font-black text-slate-500 uppercase tracking-widest">% Efectividad Flota</span>
                   <span className="text-lg font-black text-violet-600">{Math.round((guaranteedMetaTechs / Math.max(1, numTecnicosActivos)) * 100)}%</span>
                </div>
             </div>
          </div>
        </div>

        {/* Ranking Top 10 */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                <Star size={20} className="text-amber-500" />
                Top 10 Rendimiento
              </h3>
            </div>
            <div className="px-3 py-1 bg-slate-50 rounded-xl text-[9px] font-black text-slate-500 uppercase">
              {monthName}
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={top10Techs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} width={90} />
                <RechartsTooltip content={<CustomTooltip title="Puntos Acumulados" />} />
                <Bar dataKey="pts" radius={[0, 10, 10, 0]} barSize={20}>
                  {top10Techs.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#fbbf24' : index < 3 ? '#818cf8' : '#e2e8f0'} />
                  ))}
                  <LabelList dataKey="pts" position="right" style={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Oportunidades de Mejora */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                <TrendingDown size={20} className="text-rose-500" />
                Críticos
              </h3>
            </div>
            <div className="px-3 py-1 bg-rose-50 rounded-xl text-[9px] font-black text-rose-600 uppercase">
              Alerta
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bottom10Techs} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} width={90} />
                <RechartsTooltip content={<CustomTooltip title="Puntos Acumulados" />} />
                <Bar dataKey="pts" radius={[0, 10, 10, 0]} barSize={20}>
                  {bottom10Techs.map((entry, index) => (
                    <Cell key={index} fill="#fda4af" />
                  ))}
                  <LabelList dataKey="pts" position="right" style={{ fontSize: 9, fontWeight: 900, fill: '#f43f5e' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── NIVEL 3: NEGOCIO Y GEOGRAFÍA ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Proyectos */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl">
           <div className="flex items-center gap-3 mb-6">
              <Briefcase size={20} className="text-indigo-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top Proyectos</h3>
           </div>
           <div className="space-y-4">
              {topProjects.length > 0 ? topProjects.map((p, i) => (
                 <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-200 transition-colors">
                    <div>
                       <p className="text-xs font-black text-slate-700 uppercase line-clamp-1">{p.proyecto || p.cliente}</p>
                       <p className="text-[10px] font-bold text-slate-400">{p.techs} Especialistas</p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-indigo-600">{Math.round(p.pts).toLocaleString('es-CL')}</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase">Pts</p>
                    </div>
                 </div>
              )) : (
                 <p className="text-xs text-slate-400 italic text-center py-10">Sin datos de proyectos</p>
              )}
           </div>
        </div>

        {/* Top Zonas */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl">
           <div className="flex items-center gap-3 mb-6">
              <MapPin size={20} className="text-blue-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Top Zonas Activas</h3>
           </div>
           <div className="space-y-4">
              {topCities.length > 0 ? topCities.map((c, i) => (
                 <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-blue-200 transition-colors">
                    <div>
                       <p className="text-xs font-black text-slate-700 uppercase line-clamp-1">{c.name}</p>
                       <p className="text-[10px] font-bold text-slate-400">{c.orders} Órdenes</p>
                    </div>
                    <div className="text-right">
                       <p className="text-sm font-black text-blue-600">{c.pts.toLocaleString('es-CL')}</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase">Pts</p>
                    </div>
                 </div>
              )) : (
                 <p className="text-xs text-slate-400 italic text-center py-10">Sin datos de zonas</p>
              )}
           </div>
        </div>

        {/* Top Actividades */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl">
           <div className="flex items-center gap-3 mb-6">
              <Activity size={20} className="text-violet-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Mix Actividades</h3>
           </div>
           <div className="space-y-4 max-h-[340px] overflow-y-auto pr-2">
              {lpuActivities.length > 0 ? lpuActivities.map((act, i) => {
                 const avgTechPts = avgTecnicosDiario > 0 ? (act.totalPts / avgTecnicosDiario) : 0;
                 return (
                 <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center relative overflow-hidden group hover:border-violet-200 transition-colors">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-400 rounded-l-2xl" />
                    <div className="ml-2 w-1/2">
                       <p className="text-[10px] font-black text-slate-700 uppercase leading-tight line-clamp-2" title={act.desc}>{act.desc}</p>
                       <p className="text-[9px] font-bold text-slate-400 mt-1">{act.count} Veces</p>
                    </div>
                    <div className="text-right w-1/2 flex flex-col items-end gap-1">
                       <div>
                          <p className="text-sm font-black text-violet-600">{Math.round(act.totalPts || act.pts || 0).toLocaleString('es-CL')}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase">Pts</p>
                       </div>
                       <div className="bg-violet-100/50 px-2 py-1 rounded-md text-right">
                          <p className="text-[10px] font-black text-violet-700">{avgTechPts.toFixed(1)}</p>
                          <p className="text-[7px] font-black text-violet-400 uppercase">Prom/Tech</p>
                       </div>
                    </div>
                 </div>
              )}) : (
                 <p className="text-xs text-slate-400 italic text-center py-10">Sin datos de actividades</p>
              )}
           </div>
        </div>

      </div>

      {/* ── NIVEL 4: ANÁLISIS TEMPORAL ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tendencia de Producción Diaria */}
        <div className="lg:col-span-2 bg-[#0f172a] rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
             <TrendingUp size={120} className="text-indigo-400" />
          </div>
          
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <CalendarCheck size={24} className="text-indigo-400" />
                Tendencia de Producción Diaria
              </h3>
              <p className="text-indigo-300/40 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Evolución puntos vs meta teórica</p>
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis hide domain={[0, 'dataMax + 10']} />
                <RechartsTooltip content={<CustomTooltip title="Puntos" />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                
                <Bar dataKey="pts" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={20} opacity={0.8} />
                <Line type="monotone" dataKey="pts" stroke="#818cf8" strokeWidth={4} dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: '#6366f1' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                <Line type="stepAfter" dataKey="meta" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rendimiento por Día de la Semana */}
        <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-xl relative group">
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div>
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <BarChart3 size={24} className="text-violet-500" />
                Patrón Semanal
              </h3>
              <p className="text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Promedio por día</p>
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dowData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} />
                <YAxis hide />
                <RechartsTooltip content={<CustomTooltip title="Promedio" />} />
                <Bar dataKey="pts" radius={[10, 10, 10, 10]} barSize={30}>
                  {dowData.map((entry, index) => (
                    <Cell key={index} fill={entry.pts >= metaGeneralDiaria ? '#6366f1' : entry.pts >= (metaGeneralDiaria * 0.7) ? '#818cf8' : '#e2e8f0'} />
                  ))}
                  <LabelList dataKey="pts" position="top" style={{ fontSize: 11, fontWeight: 900, fill: '#64748b' }} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProduccionDashboard;
