import React from 'react';
import { Clock, BarChart2 } from 'lucide-react';
import { getFeriadosChile } from '../utils/produccionUtils';

const ProduccionAgenda = ({ 
  tecnicos = [], 
  dateFrom, 
  selectedMonths = []
}) => {
  let year, month;
  if (selectedMonths.length > 0) {
      const [y, m] = selectedMonths[0].split('-').map(Number);
      year = y;
      month = m - 1;
  } else {
      const d = new Date(dateFrom);
      year = d.getUTCFullYear();
      month = d.getUTCMonth();
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const holidays = getFeriadosChile(year);

  const getSortedTechs = () => {
    return [...tecnicos]
      .filter(t => {
        const totalOrders = Object.values(t.dailyMap || {}).reduce((acc, d) => acc + (typeof d === 'object' ? (d.orders || 0) : d), 0);
        return totalOrders > 0;
      })
      .sort((a, b) => {
        const aTotal = Object.values(a.dailyMap || {}).reduce((acc, d) => acc + (typeof d === 'object' ? (d.orders || 0) : d), 0);
        const bTotal = Object.values(b.dailyMap || {}).reduce((acc, d) => acc + (typeof d === 'object' ? (d.orders || 0) : d), 0);
        return bTotal - aTotal;
      });
  };

  const shortenName = (name) => {
    if (!name) return '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length <= 1) return name;
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    return `${parts[0]} ${parts[1]}`;
  };

  const getDayName = (d) => {
    const date = new Date(Date.UTC(year, month, d));
    const daysArr = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return daysArr[date.getUTCDay()];
  };

  const formatMinToTime = (min) => {
    if (min === null || min === undefined || isNaN(min)) return '—';
    let h = Math.floor(min / 60);
    let m = Math.floor(min % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const sortedTechs = getSortedTechs();

  const GOAL_START = 540; // 09:00 AM
  const GOAL_END = 1050;  // 17:30 PM

  // Resumenes Generales
  let totalSumStart = 0, totalCountStart = 0;
  let totalSumEnd = 0, totalCountEnd = 0;
  const projectStats = {};
  const techAvgs = [];

  sortedTechs.forEach(t => {
    let tSumStart = 0, tCountStart = 0;
    let tSumEnd = 0, tCountEnd = 0;

    days.forEach(d => {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = t.dailyMap?.[dateKey];
      if (dayData && dayData.firstStartTime !== null) { 
        totalSumStart += dayData.firstStartTime; totalCountStart++; 
        tSumStart += dayData.firstStartTime; tCountStart++;
      }
      if (dayData && dayData.lastEndTime !== null) { 
        totalSumEnd += dayData.lastEndTime; totalCountEnd++; 
        tSumEnd += dayData.lastEndTime; tCountEnd++;
      }
    });

    const tAvgStart = tCountStart > 0 ? tSumStart / tCountStart : null;
    const tAvgEnd = tCountEnd > 0 ? tSumEnd / tCountEnd : null;

    if (tAvgStart !== null || tAvgEnd !== null) {
      techAvgs.push({
        name: shortenName(t.fullName || t.name),
        avgStart: tAvgStart,
        avgEnd: tAvgEnd
      });

      const p = t.proyecto || 'Sin Proyecto';
      if (!projectStats[p]) projectStats[p] = { sumStart: 0, countStart: 0, sumEnd: 0, countEnd: 0 };
      if (tAvgStart !== null) { projectStats[p].sumStart += tAvgStart; projectStats[p].countStart++; }
      if (tAvgEnd !== null) { projectStats[p].sumEnd += tAvgEnd; projectStats[p].countEnd++; }
    }
  });

  const generalAvgStart = totalCountStart > 0 ? totalSumStart / totalCountStart : null;
  const generalAvgEnd = totalCountEnd > 0 ? totalSumEnd / totalCountEnd : null;

  const rankedByEarlyStart = [...techAvgs].filter(x => x.avgStart !== null).sort((a, b) => a.avgStart - b.avgStart);
  const rankedByLateStart = [...techAvgs].filter(x => x.avgStart !== null).sort((a, b) => b.avgStart - a.avgStart);
  const rankedByEarlyEnd = [...techAvgs].filter(x => x.avgEnd !== null).sort((a, b) => a.avgEnd - b.avgEnd);
  const rankedByLateEnd = [...techAvgs].filter(x => x.avgEnd !== null).sort((a, b) => b.avgEnd - a.avgEnd);

  // Tendencia Semanal
  const weeklyTrend = { 1: {s:0,cs:0,e:0,ce:0}, 2: {s:0,cs:0,e:0,ce:0}, 3: {s:0,cs:0,e:0,ce:0}, 4: {s:0,cs:0,e:0,ce:0}, 5: {s:0,cs:0,e:0,ce:0}, 6: {s:0,cs:0,e:0,ce:0}, 0: {s:0,cs:0,e:0,ce:0} };
  const allIntervals = []; // Para el mapa de calor de tiempos muertos

  sortedTechs.forEach(t => {
    days.forEach(d => {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = t.dailyMap?.[dateKey];
      const dow = new Date(Date.UTC(year, month, d)).getUTCDay();
      if (dayData && dayData.firstStartTime !== null) { 
        weeklyTrend[dow].s += dayData.firstStartTime;
        weeklyTrend[dow].cs++;
      }
      if (dayData && dayData.lastEndTime !== null) { 
        weeklyTrend[dow].e += dayData.lastEndTime;
        weeklyTrend[dow].ce++;
      }
      if (dayData && dayData.intervals) {
        allIntervals.push(...dayData.intervals);
      }
    });
  });

  const dowNames = { 1:'Lun', 2:'Mar', 3:'Mié', 4:'Jue', 5:'Vie', 6:'Sáb', 0:'Dom' };
  const trendData = [1,2,3,4,5,6,0].map(dow => ({
    dow: dowNames[dow],
    avgStart: weeklyTrend[dow].cs > 0 ? weeklyTrend[dow].s / weeklyTrend[dow].cs : null,
    avgEnd: weeklyTrend[dow].ce > 0 ? weeklyTrend[dow].e / weeklyTrend[dow].ce : null
  })).filter(t => t.avgStart !== null || t.avgEnd !== null);

  const getDeltaBadge = (min, goal, type) => {
    if (min === null) return null;
    const diff = min - goal;
    if (diff === 0) return <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-800 text-slate-400 border border-slate-700">META EXACTA</span>;
    const absDiff = Math.abs(diff);
    const hrs = Math.floor(absDiff / 60);
    const mns = Math.floor(absDiff % 60);
    const str = hrs > 0 ? `${hrs}h ${mns}m` : `${mns}m`;
    
    if (type === 'start') {
      if (diff < 0) return <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">-{str} TEMP</span>;
      return <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-400/10 text-rose-400 border border-rose-400/20">+{str} TARDE</span>;
    } else {
      if (diff >= 0) return <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">+{str} EXTRA</span>;
      return <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-400/10 text-rose-400 border border-rose-400/20">-{str} TEMP</span>;
    }
  };

  return (
    <div className="w-full mb-10">
      
      {/* Fila 1: Promedios Generales y Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        
        {/* Tarjeta 1: Promedios Generales */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-amber-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full group-hover:bg-amber-500/10 transition-colors"></div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-lg"><Clock size={18} className="text-amber-400" /></div>
            <div className="text-[12px] font-black uppercase tracking-widest text-amber-400">Promedios Generales</div>
          </div>
          <div className="flex justify-between items-center relative z-10 bg-slate-950/50 p-3 rounded-xl border border-white/5">
            <div className="flex flex-col gap-1">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Primera Orden</div>
              <div className="flex items-center gap-2">
                <div className={`text-2xl leading-none font-black ${generalAvgStart !== null && generalAvgStart <= GOAL_START ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`}>
                  {formatMinToTime(generalAvgStart)}
                </div>
              </div>
              <div className="mt-1">{getDeltaBadge(generalAvgStart, GOAL_START, 'start')}</div>
            </div>
            <div className="h-10 w-px bg-slate-800 mx-2"></div>
            <div className="flex flex-col gap-1 items-end text-right">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Última Orden</div>
              <div className="flex items-center gap-2 justify-end">
                <div className={`text-2xl leading-none font-black ${generalAvgEnd !== null && generalAvgEnd >= GOAL_END ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`}>
                  {formatMinToTime(generalAvgEnd)}
                </div>
              </div>
              <div className="mt-1">{getDeltaBadge(generalAvgEnd, GOAL_END, 'end')}</div>
            </div>
          </div>
        </div>
        {/* Tarjeta Ranking (Técnicos) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-fuchsia-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-fuchsia-500/5 rounded-bl-full group-hover:bg-fuchsia-500/10 transition-colors"></div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400 font-black text-xs">TOP</div>
            <div className="text-[12px] font-black uppercase tracking-widest text-fuchsia-400">Ranking Promedios</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 relative z-10 bg-slate-950/50 p-3 rounded-xl border border-white/5">
            <div className="flex flex-col">
              <div className="text-[8px] text-slate-500 uppercase font-black mb-1">Mejor Inicio</div>
              <div className="text-[11px] font-black text-slate-200 truncate">{rankedByEarlyStart[0]?.name || '—'}</div>
              <div className="text-[10px] font-black text-emerald-400">{formatMinToTime(rankedByEarlyStart[0]?.avgStart)}</div>
            </div>
            <div className="flex flex-col">
              <div className="text-[8px] text-slate-500 uppercase font-black mb-1">Peor Inicio</div>
              <div className="text-[11px] font-black text-slate-200 truncate">{rankedByLateStart[0]?.name || '—'}</div>
              <div className="text-[10px] font-black text-rose-400">{formatMinToTime(rankedByLateStart[0]?.avgStart)}</div>
            </div>
            <div className="flex flex-col">
              <div className="text-[8px] text-slate-500 uppercase font-black mb-1">Peor Fin (Temprano)</div>
              <div className="text-[11px] font-black text-slate-200 truncate">{rankedByEarlyEnd[0]?.name || '—'}</div>
              <div className="text-[10px] font-black text-rose-400">{formatMinToTime(rankedByEarlyEnd[0]?.avgEnd)}</div>
            </div>
            <div className="flex flex-col">
              <div className="text-[8px] text-slate-500 uppercase font-black mb-1">Mejor Fin (Tarde)</div>
              <div className="text-[11px] font-black text-slate-200 truncate">{rankedByLateEnd[0]?.name || '—'}</div>
              <div className="text-[10px] font-black text-emerald-400">{formatMinToTime(rankedByLateEnd[0]?.avgEnd)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fila 2: Tarjetas de Proyectos en una sola fila */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Object.entries(projectStats).slice(0, 4).map(([p, stats], idx) => {
          const pAvgStart = stats.countStart > 0 ? stats.sumStart / stats.countStart : null;
          const pAvgEnd = stats.countEnd > 0 ? stats.sumEnd / stats.countEnd : null;
          return (
            <div key={idx} className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-cyan-500/30 transition-colors">
              <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-bl-full group-hover:bg-cyan-500/10 transition-colors"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="p-1.5 bg-cyan-500/10 rounded-lg"><div className="w-3 h-3 bg-cyan-400 rounded-sm"></div></div>
                <div className="text-[10px] font-black uppercase tracking-widest text-cyan-400 truncate" title={p}>{p}</div>
              </div>
              <div className="flex justify-between items-center relative z-10 bg-slate-950/50 p-2.5 rounded-xl border border-white/5">
                <div className="flex flex-col gap-0.5">
                  <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Inicio</div>
                  <div className={`text-lg leading-none font-black ${pAvgStart !== null && pAvgStart <= GOAL_START ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`}>
                    {formatMinToTime(pAvgStart)}
                  </div>
                  <div className="mt-0.5">{getDeltaBadge(pAvgStart, GOAL_START, 'start')}</div>
                </div>
                <div className="h-8 w-px bg-slate-800 mx-1"></div>
                <div className="flex flex-col gap-0.5 items-end text-right">
                  <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Fin</div>
                  <div className={`text-lg leading-none font-black ${pAvgEnd !== null && pAvgEnd >= GOAL_END ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]'}`}>
                    {formatMinToTime(pAvgEnd)}
                  </div>
                  <div className="mt-0.5">{getDeltaBadge(pAvgEnd, GOAL_END, 'end')}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fila 3: Gráficos de Tendencia y Calor */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Tarjeta Tendencia Semanal (Mini Gráfico Gantt) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full group-hover:bg-indigo-500/10 transition-colors"></div>
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-2 bg-indigo-500/10 rounded-lg"><BarChart2 size={18} className="text-indigo-400" /></div>
            <div className="text-[12px] font-black uppercase tracking-widest text-indigo-400">Tendencia Semanal (Promedio)</div>
          </div>
          
          <div className="flex flex-col gap-3 relative z-10 bg-slate-950/50 p-3 pt-6 rounded-xl border border-white/5 h-full justify-center">
            
            {/* Regla de horas (header) */}
            <div className="flex justify-between w-full px-8 text-[9px] font-black text-slate-500 font-mono tracking-tighter absolute top-2 left-0 right-0 z-20">
              {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => {
                const isMeta = h === 9;
                const pos = (((h * 60) - 480) / 660) * 100;
                return (
                  <div key={h} className="absolute" style={{ left: `calc(24px + 12px + ${pos}% * calc(100% - 36px) / 100)`, transform: 'translateX(-50%)' }}>
                    <span className={isMeta ? 'text-emerald-500' : 'text-slate-600'}>{String(h).padStart(2, '0')}:00</span>
                  </div>
                );
              })}
              <div className="absolute" style={{ left: 'calc(24px + 12px + ((1050 - 480) / 660) * calc(100% - 36px))', transform: 'translateX(-50%)' }}>
                <span className="text-emerald-500">17:30</span>
              </div>
            </div>

            {trendData.map((td, i) => {
              const fStart = td.avgStart;
              const lEnd = td.avgEnd;
              if (fStart === null || lEnd === null) return null;
              
              const refStart = 480; // 08:00 AM
              const refEnd = 1140;  // 19:00 PM
              const totalRef = refEnd - refStart;
              
              const goalStartPos = ((540 - refStart) / totalRef) * 100;
              const goalEndPos = ((1050 - refStart) / totalRef) * 100;

              let barLeft = Math.max(0, ((fStart - refStart) / totalRef) * 100);
              let barRight = Math.max(0, ((refEnd - lEnd) / totalRef) * 100);
              if (barLeft > 100) barLeft = 100;
              if (barRight > 100) barRight = 100;
              if (barLeft + barRight >= 100) barRight = 100 - barLeft;

              const startColor = fStart <= GOAL_START ? 'text-emerald-400' : 'text-rose-400';
              const endColor = lEnd >= GOAL_END ? 'text-emerald-400' : 'text-rose-400';

              return (
                <div key={i} className="flex items-center gap-3 w-full group relative mt-3">
                  <div className="w-6 min-w-[24px] text-[11px] font-black text-slate-300 text-right">{td.dow}</div>
                  
                  <div className="flex-1 h-5 bg-slate-800/80 rounded-md overflow-hidden flex relative shadow-inner border border-slate-700/50">
                    {/* Grid lines for each hour */}
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => (
                      <div key={h} className="absolute top-0 bottom-0 w-px bg-slate-700/30 z-10" style={{ left: `${(((h * 60) - 480) / 660) * 100}%` }}></div>
                    ))}

                    {/* Goal markers */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500/80 z-20" style={{ left: `${goalStartPos}%` }}></div>
                    <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-500/80 z-20" style={{ left: `${goalEndPos}%` }}></div>

                    {/* Left padding */}
                    <div style={{ width: `${barLeft}%` }} className="h-full bg-transparent"></div>
                    
                    {/* The bar */}
                    <div style={{ width: `${100 - barLeft - barRight}%` }} className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)] rounded-md relative z-30">
                      {/* Floating Text Left */}
                      <span className={`absolute top-1/2 -translate-y-1/2 left-1 text-[10px] font-black bg-slate-900/90 px-1.5 py-0.5 rounded shadow-sm ${startColor}`}>
                        {formatMinToTime(fStart)}
                      </span>
                      {/* Floating Text Right */}
                      <span className={`absolute top-1/2 -translate-y-1/2 right-1 text-[10px] font-black bg-slate-900/90 px-1.5 py-0.5 rounded shadow-sm ${endColor}`}>
                        {formatMinToTime(lEnd)}
                      </span>
                    </div>
                    
                    {/* Right padding */}
                    <div style={{ width: `${barRight}%` }} className="h-full bg-transparent"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tarjeta Mapa de Calor de Tiempos Muertos (Global) */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full group-hover:bg-blue-500/10 transition-colors"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg"><Clock size={18} className="text-blue-400" /></div>
              <div className="text-[12px] font-black uppercase tracking-widest text-blue-400">Mapa de Calor: Órdenes y Tiempos Muertos</div>
            </div>
            <div className="text-[10px] text-slate-500 font-bold uppercase">Distribución global de todas las órdenes del mes</div>
          </div>
          
          <div className="flex flex-col relative z-10 bg-slate-950/50 p-4 rounded-xl border border-white/5 h-full justify-center">
            <div className="flex justify-between text-[10px] font-black text-slate-400 mb-2 font-mono">
              <span>09:00</span>
              <span>11:00</span>
              <span>13:00</span>
              <span>15:00</span>
              <span>17:30</span>
            </div>
            <div className="w-full h-8 bg-slate-900 rounded-lg overflow-hidden relative shadow-inner border border-slate-800">
              {/* Densidad de intervalos (Heatmap) */}
              {allIntervals.map((intv, idx) => {
                const refStart = 540; // 09:00 AM
                const refEnd = 1050;  // 17:30 PM
                const totalRef = refEnd - refStart;
                let left = Math.max(0, ((intv.start - refStart) / totalRef) * 100);
                let right = Math.max(0, ((refEnd - intv.end) / totalRef) * 100);
                if (left > 100) left = 100;
                if (right > 100) right = 100;
                if (left + right >= 100) right = 100 - left;
                return (
                  <div key={idx} className="absolute top-0 bottom-0 bg-blue-500/5" style={{ left: `${left}%`, right: `${right}%`, mixBlendMode: 'screen' }}></div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 mt-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-900 border border-slate-700"></div> Tiempo Muerto</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-400"></div> Alta Actividad</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border border-slate-800 rounded-t-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-5 bg-amber-500 rounded-full" />
          <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <Clock size={14} /> Agenda de Horarios (Inicio - Fin)
          </h3>
        </div>
      </div>
      
      <div className="overflow-x-auto bg-slate-950 border-x border-b border-slate-800 rounded-b-xl shadow-2xl">
        <table className="w-full border-collapse p-0 m-0" style={{ borderSpacing: 0, borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-900 h-6 border-b border-slate-800">
              <th className="sticky left-0 z-30 bg-slate-900 border-r border-slate-800 w-[110px] min-w-[110px] text-[7px] font-black text-slate-400 uppercase p-0">Especialista</th>
              <th className="sticky left-[110px] z-30 bg-slate-900 border-r border-slate-800 w-[40px] min-w-[40px] text-[7px] font-black text-slate-400 uppercase p-0">ID</th>
              <th className="sticky left-[150px] z-20 bg-slate-900 border-r-4 border-r-white w-[70px] min-w-[70px] text-[7px] font-black text-slate-400 uppercase p-0">Proyecto</th>
              {days.map(d => {
                const isWeekend = new Date(Date.UTC(year, month, d)).getUTCDay() === 0 || new Date(Date.UTC(year, month, d)).getUTCDay() === 6;
                return (
                  <th key={d} className={`w-24 min-w-[96px] border-r border-slate-800 p-0 text-center ${isWeekend ? 'bg-slate-900/60' : 'bg-slate-900'}`}>
                    <div className={`text-[8px] font-black leading-none mb-0.5 mt-1 ${isWeekend ? 'text-amber-500' : 'text-slate-400'}`}>{getDayName(d)}</div>
                    <div className={`text-[10px] font-black leading-none mb-1 ${isWeekend ? 'text-amber-400' : 'text-white'}`}>{d}</div>
                  </th>
                );
              })}
              <th className="sticky right-[70px] z-20 bg-slate-900 border-l-4 border-l-white w-[70px] min-w-[70px] text-[7px] font-black text-slate-400 uppercase p-0">PROM INICIO</th>
              <th className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 w-[70px] min-w-[70px] text-[7px] font-black text-slate-400 uppercase p-0">PROM FIN</th>
            </tr>
          </thead>
          <tbody className="p-0 m-0">
            {sortedTechs.map((t) => (
              <tr key={t.idUnique || t._id} className="h-10 border-b border-white/5 hover:bg-white/5 p-0 m-0 transition-colors">
                <td className="sticky left-0 z-20 bg-slate-900 border-r border-slate-800 text-[8px] font-black text-slate-200 uppercase px-1 truncate p-0 m-0 group-hover:bg-slate-800">{shortenName(t.fullName || t.name)}</td>
                <td className="sticky left-[110px] z-20 bg-slate-900 border-r border-slate-800 text-amber-400 font-mono text-[8px] font-black px-1 p-0 m-0 text-center group-hover:bg-slate-800">{t.idRecursoToa || '—'}</td>
                <td className="sticky left-[150px] z-20 bg-slate-900 border-r-4 border-r-white text-slate-500 uppercase text-[7px] font-black px-1 truncate p-0 m-0 text-center group-hover:bg-slate-800">{t.proyecto || '—'}</td>
                {days.map(d => {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const dayData = t.dailyMap?.[dateKey];
                  const isSunday = new Date(Date.UTC(year, month, d)).getUTCDay() === 0;
                  const isSaturday = new Date(Date.UTC(year, month, d)).getUTCDay() === 6;
                  const isHoliday = holidays.includes(dateKey);
                  const isWeekend = isSunday || isSaturday;
                  
                  let content = null;
                  let style = isWeekend ? "bg-slate-900/40" : "bg-transparent";

                  if (dayData && dayData.orders > 0 && dayData.firstStartTime !== null && dayData.lastEndTime !== null) {
                    const fStart = dayData.firstStartTime;
                    const lEnd = dayData.lastEndTime;
                    
                    // Ref: 09:00 AM (540) to 17:30 PM (1050)
                    const refStart = 540;
                    const refEnd = 1050;
                    const totalRef = refEnd - refStart;

                    let barLeft = Math.max(0, ((fStart - refStart) / totalRef) * 100);
                    let barRight = Math.max(0, ((refEnd - lEnd) / totalRef) * 100);
                    if (barLeft > 100) barLeft = 100;
                    if (barRight > 100) barRight = 100;
                    if (barLeft + barRight >= 100) barRight = 100 - barLeft;

                    const startColor = fStart <= GOAL_START ? 'text-emerald-400' : 'text-rose-400';
                    const endColor = lEnd >= GOAL_END ? 'text-emerald-400' : 'text-rose-400';

                    content = (
                      <div className="w-full h-full flex flex-col justify-center px-1.5 relative group">
                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 px-0 font-mono tracking-tighter">
                          <span>09:00</span>
                          <span>17:30</span>
                        </div>
                        <div className="w-full h-3 bg-slate-800/80 rounded overflow-hidden relative shadow-inner border border-slate-700">
                          {/* Render individual intervals to show dead time visually */}
                          {dayData.intervals && dayData.intervals.length > 0 ? (
                            dayData.intervals.map((intv, idx) => {
                              let left = Math.max(0, ((intv.start - refStart) / totalRef) * 100);
                              let right = Math.max(0, ((refEnd - intv.end) / totalRef) * 100);
                              if (left > 100) left = 100;
                              if (right > 100) right = 100;
                              if (left + right >= 100) right = 100 - left;
                              return (
                                <div key={idx} className={`absolute top-0 bottom-0 ${isWeekend ? 'bg-amber-500/90' : 'bg-cyan-500/90'} shadow-[0_0_4px_rgba(6,182,212,0.5)] border-x border-slate-950`} style={{ left: `${left}%`, right: `${right}%` }}></div>
                              );
                            })
                          ) : (
                            <div className={`absolute top-0 bottom-0 ${isWeekend ? 'bg-amber-500/40' : 'bg-cyan-500/40'}`} style={{ left: `${barLeft}%`, right: `${barRight}%` }}></div>
                          )}
                          {/* Marker for explicit start/end goals crossing */}
                          <div className={`absolute top-0 bottom-0 w-[2px] z-20 ${fStart <= GOAL_START ? 'bg-emerald-400' : 'bg-rose-400'} shadow-lg`} style={{ left: `${barLeft}%` }}></div>
                          <div className={`absolute top-0 bottom-0 w-[2px] z-20 ${lEnd >= GOAL_END ? 'bg-emerald-400' : 'bg-rose-400'} shadow-lg`} style={{ right: `${barRight}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[8px] font-black mt-0.5 px-0">
                          <span className={startColor}>{formatMinToTime(fStart)}</span>
                          <span className={endColor}>{formatMinToTime(lEnd)}</span>
                        </div>
                      </div>
                    );
                  } else if (isSunday) {
                    content = <div className="h-full w-full flex items-center justify-center"><span className="text-[7px] font-black text-amber-500/30">LIB</span></div>;
                  } else if (isHoliday) {
                    content = <div className="h-full w-full flex items-center justify-center"><span className="text-[7px] font-black text-amber-500/50">FER</span></div>;
                  } else {
                    content = <div className="h-full w-full flex items-center justify-center"><span className="text-[6px] font-black text-slate-700/50">S/A</span></div>;
                  }
                  return (
                    <td key={d} className={`p-0 m-0 border-r border-white/5 h-10 align-middle ${style}`}>
                      {content}
                    </td>
                  );
                })}
                {(() => {
                  let sumStart = 0, countStart = 0;
                  let sumEnd = 0, countEnd = 0;
                  days.forEach(d => {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const dayData = t.dailyMap?.[dateKey];
                    if (dayData && dayData.firstStartTime !== null) { sumStart += dayData.firstStartTime; countStart++; }
                    if (dayData && dayData.lastEndTime !== null) { sumEnd += dayData.lastEndTime; countEnd++; }
                  });
                  const avgStart = countStart > 0 ? sumStart / countStart : null;
                  const avgEnd = countEnd > 0 ? sumEnd / countEnd : null;
                  
                  const avgStartColor = avgStart !== null && avgStart <= GOAL_START ? 'text-emerald-400' : 'text-rose-400';
                  const avgEndColor = avgEnd !== null && avgEnd >= GOAL_END ? 'text-emerald-400' : 'text-rose-400';

                  return (
                    <>
                      <td className="sticky right-[70px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                        <span className={`text-[10px] font-black ${avgStartColor}`}>{avgStart !== null ? formatMinToTime(avgStart) : '—'}</span>
                      </td>
                      <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center p-0 m-0">
                        <span className={`text-[10px] font-black ${avgEndColor}`}>{avgEnd !== null ? formatMinToTime(avgEnd) : '—'}</span>
                      </td>
                    </>
                  );
                })()}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-40 bg-slate-900 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
            <tr className="h-8 border-t border-white/20">
              <td className="sticky left-0 z-30 bg-slate-900 border-r-4 border-r-white text-[8px] font-black uppercase text-slate-300 p-0 px-2" colSpan={3}>PROMEDIO DEL DÍA</td>
              {days.map(d => {
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                let sumStart = 0, countStart = 0;
                let sumEnd = 0, countEnd = 0;
                sortedTechs.forEach(t => {
                  const dayData = t.dailyMap?.[dateKey];
                  if (dayData && dayData.firstStartTime !== null) { sumStart += dayData.firstStartTime; countStart++; }
                  if (dayData && dayData.lastEndTime !== null) { sumEnd += dayData.lastEndTime; countEnd++; }
                });
                const avgStart = countStart > 0 ? sumStart / countStart : null;
                const avgEnd = countEnd > 0 ? sumEnd / countEnd : null;

                const startColor = avgStart !== null && avgStart <= GOAL_START ? 'text-emerald-400' : 'text-rose-400';
                const endColor = avgEnd !== null && avgEnd >= GOAL_END ? 'text-emerald-400' : 'text-rose-400';

                return (
                  <td key={d} className="p-0 border-r border-white/5 bg-slate-900 h-10 align-middle">
                    {countStart > 0 || countEnd > 0 ? (
                      <div className="w-full h-full flex flex-col justify-center px-1.5 relative group">
                        <div className="flex justify-between text-[7px] text-slate-500 mb-0.5 px-0 font-mono tracking-tighter">
                          <span>09:00</span>
                          <span>17:30</span>
                        </div>
                        <div className="w-full h-3 bg-slate-800/80 rounded overflow-hidden relative shadow-inner border border-slate-700">
                          {(() => {
                            const refStart = 540;
                            const refEnd = 1050;
                            const totalRef = refEnd - refStart;
                            let barLeft = Math.max(0, ((avgStart - refStart) / totalRef) * 100);
                            let barRight = Math.max(0, ((refEnd - avgEnd) / totalRef) * 100);
                            if (barLeft > 100) barLeft = 100;
                            if (barRight > 100) barRight = 100;
                            if (barLeft + barRight >= 100) barRight = 100 - barLeft;
                            
                            return (
                              <>
                                <div className={`absolute top-0 bottom-0 bg-cyan-500/60 shadow-[0_0_4px_rgba(6,182,212,0.5)] border-x border-slate-950`} style={{ left: `${barLeft}%`, right: `${barRight}%` }}></div>
                                <div className={`absolute top-0 bottom-0 w-[2px] z-20 ${avgStart <= 540 ? 'bg-emerald-400' : 'bg-rose-400'} shadow-lg`} style={{ left: `${barLeft}%` }}></div>
                                <div className={`absolute top-0 bottom-0 w-[2px] z-20 ${avgEnd >= 1050 ? 'bg-emerald-400' : 'bg-rose-400'} shadow-lg`} style={{ right: `${barRight}%` }}></div>
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex justify-between text-[8px] font-black mt-0.5 px-0">
                          <span className={startColor}>{avgStart !== null ? formatMinToTime(avgStart) : '—'}</span>
                          <span className={endColor}>{avgEnd !== null ? formatMinToTime(avgEnd) : '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="text-[7px] font-black text-slate-700/50">—</span>
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="sticky right-[70px] z-30 bg-slate-900 border-l-4 border-l-white text-center p-0 h-8">
                {(() => {
                  let totalSumStart = 0, totalCountStart = 0;
                  sortedTechs.forEach(t => {
                    days.forEach(d => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const dayData = t.dailyMap?.[dateKey];
                      if (dayData && dayData.firstStartTime !== null) { totalSumStart += dayData.firstStartTime; totalCountStart++; }
                    });
                  });
                  const avg = totalCountStart > 0 ? totalSumStart / totalCountStart : null;
                  const cColor = avg !== null && avg <= GOAL_START ? 'text-emerald-400' : 'text-rose-400';
                  return <span className={`text-[11px] font-black ${cColor}`}>{avg !== null ? formatMinToTime(avg) : '—'}</span>;
                })()}
              </td>
              <td className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 text-center p-0 h-8">
                {(() => {
                  let totalSumEnd = 0, totalCountEnd = 0;
                  sortedTechs.forEach(t => {
                    days.forEach(d => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const dayData = t.dailyMap?.[dateKey];
                      if (dayData && dayData.lastEndTime !== null) { totalSumEnd += dayData.lastEndTime; totalCountEnd++; }
                    });
                  });
                  const avg = totalCountEnd > 0 ? totalSumEnd / totalCountEnd : null;
                  const cColor = avg !== null && avg >= GOAL_END ? 'text-emerald-400' : 'text-rose-400';
                  return <span className={`text-[11px] font-black ${cColor}`}>{avg !== null ? formatMinToTime(avg) : '—'}</span>;
                })()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default ProduccionAgenda;
