import React, { useState, useMemo } from 'react';
import { Trophy, Zap, ShieldAlert, Clock, Target, Search, Users, Sparkles, TrendingUp } from 'lucide-react';

export default function ProduccionRanking({ tecnicos = [], metaConfig = {}, productiveDaysCount = 22 }) {
  const [rankingMetric, setRankingMetric] = useState('puntos'); // 'puntos', 'altas', 'reparaciones', 'velocidad', 'proyeccion'
  const [searchTerm, setSearchTerm] = useState('');

  // Process and compute stats for all technicians
  const processedData = useMemo(() => {
    return tecnicos.map(t => {
      let totalAltas = 0;
      let totalReparaciones = 0;
      let totalMinutosAlta = 0;
      let totalMinutosReparacion = 0;
      let totalMinutos = 0;
      let totalCompletadas = 0;

      Object.values(t.dailyMap || {}).forEach(dd => {
        totalAltas += (dd.ordersAlta || 0);
        totalReparaciones += (dd.ordersReparacion || 0);
        totalMinutosAlta += (dd.minAlta || 0);
        totalMinutosReparacion += (dd.minReparacion || 0);
        totalMinutos += (dd.minTotal || 0);
        totalCompletadas += (dd.completadas || 0);
      });

      // Velocidad: promedio de minutos por actividad
      const velocidadAlta = totalAltas > 0 ? Math.round(totalMinutosAlta / totalAltas) : 0;
      const velocidadReparacion = totalReparaciones > 0 ? Math.round(totalMinutosReparacion / totalReparaciones) : 0;
      const velocidadPromedio = totalCompletadas > 0 ? Math.round(totalMinutos / totalCompletadas) : 0;

      // Promedio diario
      const productiveDays = Object.values(t.dailyMap || {}).filter(dd => (dd.pts || 0) > 0).length;
      const avgProd = productiveDays > 0 ? (t.ptsTotal / productiveDays) : 0;
      const diasLaborales = metaConfig?.diasLaboralesMes || metaConfig?.diasLaborales || 22;
      
      // Proyeccion Cierre
      const proyeccionCierre = avgProd * diasLaborales;
      const metaMes = (metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5) * diasLaborales;
      const logroProyeccionPct = metaMes > 0 ? (proyeccionCierre / metaMes) * 100 : 0;

      return {
        name: t.name || t.fullName || 'Sin Nombre',
        idRecursoToa: t.idRecursoToa || '—',
        proyecto: t.proyecto || '—',
        ptsTotal: t.ptsTotal || 0,
        totalAltas,
        totalReparaciones,
        velocidadPromedio,       // en minutos
        velocidadAlta,           // en minutos
        velocidadReparacion,     // en minutos
        proyeccionCierre,
        logroProyeccionPct,
        metaMes,
        avgProd,
        totalCompletadas
      };
    });
  }, [tecnicos, metaConfig]);

  // Metric configuration
  const metricConfig = useMemo(() => {
    const configs = {
      puntos: {
        title: 'Producción en Puntos Baremos',
        description: 'Ranking basado en el total de puntos baremos acumulados en el período.',
        icon: Trophy,
        primaryColor: 'from-indigo-600 to-violet-600',
        textColor: 'text-indigo-400',
        badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        sortFn: (a, b) => b.ptsTotal - a.ptsTotal,
        valFn: (t) => t.ptsTotal.toFixed(1),
        unit: 'Pts',
        subValFn: (t) => `Promedio: ${t.avgProd.toFixed(1)}/día`,
        benchmark: 'Meta: ' + ((metaConfig.metaProduccionDia || 7.5) * productiveDaysCount).toFixed(1) + ' Pts',
        progressVal: (t, max) => max > 0 ? (t.ptsTotal / max) * 100 : 0
      },
      altas: {
        title: 'Ranking de Altas & Instalaciones',
        description: 'Ranking basado en la cantidad total de órdenes de Altas completadas.',
        icon: Zap,
        primaryColor: 'from-blue-600 to-sky-600',
        textColor: 'text-blue-400',
        badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        sortFn: (a, b) => b.totalAltas - a.totalAltas,
        valFn: (t) => t.totalAltas,
        unit: 'Altas',
        subValFn: (t) => t.velocidadAlta > 0 ? `Velocidad: ${t.velocidadAlta} min/alta` : '—',
        benchmark: 'Mayor Volumen',
        progressVal: (t, max) => max > 0 ? (t.totalAltas / max) * 100 : 0
      },
      reparaciones: {
        title: 'Ranking de Reparaciones',
        description: 'Ranking basado en la cantidad total de órdenes de Reparación completadas.',
        icon: ShieldAlert,
        primaryColor: 'from-orange-600 to-amber-600',
        textColor: 'text-orange-400',
        badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        sortFn: (a, b) => b.totalReparaciones - a.totalReparaciones,
        valFn: (t) => t.totalReparaciones,
        unit: 'Reps',
        subValFn: (t) => t.velocidadReparacion > 0 ? `Velocidad: ${t.velocidadReparacion} min/rep` : '—',
        benchmark: 'Mayor Volumen',
        progressVal: (t, max) => max > 0 ? (t.totalReparaciones / max) * 100 : 0
      },
      velocidad: {
        title: 'Velocidad Promedio por Actividad',
        description: 'Ranking basado en el menor promedio de minutos por actividad (más rápido es mejor).',
        icon: Clock,
        primaryColor: 'from-emerald-600 to-teal-600',
        textColor: 'text-emerald-400',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        // Filtrar técnicos con 0 completadas y luego ordenar de menor a mayor (más rápido arriba)
        filterFn: (t) => t.totalCompletadas > 0 && t.velocidadPromedio > 0,
        sortFn: (a, b) => a.velocidadPromedio - b.velocidadPromedio,
        valFn: (t) => `${t.velocidadPromedio}`,
        unit: 'Min/Act',
        subValFn: (t) => `${t.totalCompletadas} act. completadas`,
        benchmark: 'SLA: 45 min/act',
        // Progreso inverso: el menor tiempo obtiene barra más larga (100% para el más rápido)
        progressVal: (t, _, minVal) => t.velocidadPromedio > 0 ? (minVal / t.velocidadPromedio) * 100 : 0
      },
      proyeccion: {
        title: 'Proyección de Cierre Mensual',
        description: 'Ranking de proyecciones estimadas de cierre de mes frente a la meta esperada.',
        icon: Target,
        primaryColor: 'from-fuchsia-600 to-pink-600',
        textColor: 'text-fuchsia-400',
        badgeBg: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
        sortFn: (a, b) => b.proyeccionCierre - a.proyeccionCierre,
        valFn: (t) => t.proyeccionCierre.toFixed(1),
        unit: 'Pts (Est.)',
        subValFn: (t) => `Logro: ${t.logroProyeccionPct.toFixed(0)}% de Meta`,
        benchmark: 'Meta Mes: ' + ((metaConfig.metaProduccionDia || 7.5) * (metaConfig.diasLaboralesMes || 22)).toFixed(1) + ' Pts',
        progressVal: (t) => Math.min(100, t.logroProyeccionPct)
      }
    };
    return configs[rankingMetric];
  }, [rankingMetric, metaConfig, productiveDaysCount]);

  // Filter and sort the list of technicians based on the selected metric and search term
  const sortedAndFilteredList = useMemo(() => {
    let list = [...processedData];
    
    // Apply optional filter function
    if (metricConfig.filterFn) {
      list = list.filter(metricConfig.filterFn);
    } else {
      // Por defecto omitir los que tienen producción vacía para métricas operativas
      list = list.filter(t => t.ptsTotal > 0 || t.totalCompletadas > 0);
    }

    // Apply search filter
    if (searchTerm) {
      list = list.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.idRecursoToa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.proyecto.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort according to metric sort rule
    return list.sort(metricConfig.sortFn);
  }, [processedData, metricConfig, searchTerm]);

  // Calculate maximum score or minimum score for progress bar baseline
  const { maxVal, minVal } = useMemo(() => {
    if (sortedAndFilteredList.length === 0) return { maxVal: 0, minVal: 0 };
    
    const values = sortedAndFilteredList.map(t => {
      if (rankingMetric === 'puntos') return t.ptsTotal;
      if (rankingMetric === 'altas') return t.totalAltas;
      if (rankingMetric === 'reparaciones') return t.totalReparaciones;
      if (rankingMetric === 'velocidad') return t.velocidadPromedio;
      if (rankingMetric === 'proyeccion') return t.proyeccionCierre;
      return 0;
    }).filter(v => v > 0);

    return {
      maxVal: values.length > 0 ? Math.max(...values) : 0,
      minVal: values.length > 0 ? Math.min(...values) : 0
    };
  }, [sortedAndFilteredList, rankingMetric]);

  // Summary statistics for cards
  const summaryStats = useMemo(() => {
    if (sortedAndFilteredList.length === 0) return { leader: null, average: 0 };
    
    const leader = sortedAndFilteredList[0];
    let total = 0;
    sortedAndFilteredList.forEach(t => {
      if (rankingMetric === 'puntos') total += t.ptsTotal;
      if (rankingMetric === 'altas') total += t.totalAltas;
      if (rankingMetric === 'reparaciones') total += t.totalReparaciones;
      if (rankingMetric === 'velocidad') total += t.velocidadPromedio;
      if (rankingMetric === 'proyeccion') total += t.proyeccionCierre;
    });

    return {
      leader,
      average: total / sortedAndFilteredList.length
    };
  }, [sortedAndFilteredList, rankingMetric]);

  const IconComponent = metricConfig.icon;

  const shortenName = (name) => {
    if (!name) return '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length <= 1) return name;
    if (parts.length >= 4) return `${parts[0]} ${parts[2]}`;
    return `${parts[0]} ${parts[1]}`;
  };

  return (
    <div className="space-y-6">
      
      {/* ── MENÚ DE RANKINGS INTERACTIVOS ────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-wrap gap-1 shadow-lg">
        {[
          { id: 'puntos', label: 'Puntos Baremos', desc: 'Producción total', icon: Trophy },
          { id: 'altas', label: 'Altas / Inst.', desc: 'Volumen instalaciones', icon: Zap },
          { id: 'reparaciones', label: 'Reparaciones', desc: 'Volumen soporte', icon: ShieldAlert },
          { id: 'velocidad', label: 'Velocidad', desc: 'Minutos por actividad', icon: Clock },
          { id: 'proyeccion', label: 'Proyección Cierre', desc: 'Estimado fin de mes', icon: Target },
        ].map(item => {
          const ItemIcon = item.icon;
          const isActive = rankingMetric === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setRankingMetric(item.id)}
              className={`flex-1 min-w-[150px] flex items-center gap-3 p-3 rounded-xl transition-all border ${
                isActive 
                  ? 'bg-slate-800/80 border-slate-700 text-white shadow-xl shadow-black/20' 
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <div className={`p-2 rounded-lg ${isActive ? 'bg-gradient-to-br ' + metricConfig.primaryColor + ' text-white' : 'bg-slate-800 text-slate-500'}`}>
                <ItemIcon size={16} />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-wider">{item.label}</p>
                <p className="text-[8px] text-slate-500 font-bold tracking-tight">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── TARJETAS EXECUTIVAS DE RESUMEN DEL RANKING ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Líder del Ranking */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-amber-500/20" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <Sparkles size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Líder del Ranking</h3>
          </div>
          {summaryStats.leader ? (
            <div>
              <p className="text-xl font-black text-white truncate">{shortenName(summaryStats.leader.name)}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                ID TOA: {summaryStats.leader.idRecursoToa} • {summaryStats.leader.proyecto}
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{metricConfig.valFn(summaryStats.leader)}</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metricConfig.unit}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm font-bold text-slate-500 py-4">No hay datos</p>
          )}
        </div>

        {/* Promedio General */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/20" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <Users size={16} />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio General</h3>
          </div>
          <div>
            <p className="text-xl font-black text-white">Rendimiento Equipo</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
              Promedio de todos los especialistas
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-400">{summaryStats.average.toFixed(1)}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metricConfig.unit}</span>
            </div>
          </div>
        </div>

        {/* Meta / Benchmark */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-fuchsia-500/20" />
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-fuchsia-500/20 rounded-lg text-fuchsia-400">
              <TrendingUp size={16} />
            </div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta de Referencia</h3>
          </div>
          <div>
            <p className="text-xl font-black text-white">Objetivo Esperado</p>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
              Estándar de calidad y producción
            </p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-fuchsia-400">{metricConfig.benchmark.split(':')[1]?.trim() || metricConfig.benchmark}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL: LISTADO DE RANKING ───────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        
        {/* Barra superior de filtrado e info */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <IconComponent size={20} className={metricConfig.textColor} />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">{metricConfig.title}</h2>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">{metricConfig.description}</p>
            </div>
          </div>
          
          {/* Buscador dentro del ranking */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-[10px] text-slate-300 w-full max-w-[280px] focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all">
            <Search size={12} className="text-slate-500" />
            <input
              type="text"
              placeholder="Buscar en el ranking..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-white font-bold placeholder:text-slate-500 w-full"
            />
          </div>
        </div>

        {/* Tabla / Listado */}
        {sortedAndFilteredList.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-bold tracking-widest uppercase border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
            No se encontraron especialistas para el criterio seleccionado
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {sortedAndFilteredList.map((t, i) => {
              const val = metricConfig.valFn(t);
              const progressPct = metricConfig.progressVal(t, maxVal, minVal);
              
              // Estilo de podio
              const isFirst = i === 0;
              const isSecond = i === 1;
              const isThird = i === 2;
              
              let badgeColor = "bg-slate-950 text-slate-500 border-slate-800";
              let shadowStyle = "";
              if (isFirst) {
                badgeColor = "bg-amber-500 text-white font-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]";
                shadowStyle = "border-amber-500/20 bg-amber-500/[0.01]";
              } else if (isSecond) {
                badgeColor = "bg-slate-300 text-slate-800 font-black border-slate-200 shadow-[0_0_12px_rgba(203,213,225,0.4)]";
              } else if (isThird) {
                badgeColor = "bg-orange-500 text-white font-black border-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.4)]";
              }

              return (
                <div 
                  key={t.name || i} 
                  className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50 hover:bg-slate-950/70 hover:border-slate-700/80 transition-all ${shadowStyle}`}
                >
                  {/* Posición del Ranking */}
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeColor}`}>
                      {i + 1}
                    </span>
                    <div>
                      <span className="text-sm font-black text-white block leading-tight">{shortenName(t.name)}</span>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 block">
                        ID TOA: {t.idRecursoToa}
                      </span>
                    </div>
                  </div>

                  {/* Sede / Proyecto */}
                  <div className="sm:ml-auto flex items-center gap-6 min-w-[200px] justify-between sm:justify-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                      {t.proyecto}
                    </span>

                    {/* Barra de progreso visual */}
                    <div className="hidden md:flex flex-col gap-1 w-28">
                      <div className="h-2 bg-slate-950 border border-slate-800 rounded-full w-full overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${metricConfig.primaryColor} rounded-full transition-all duration-1000`} 
                          style={{ width: `${progressPct}%` }} 
                        />
                      </div>
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-right">
                        {metricConfig.subValFn(t)}
                      </span>
                    </div>

                    {/* Insignia con el valor principal */}
                    <div className={`px-4 py-2 rounded-xl text-center min-w-[80px] border font-black flex flex-col items-center justify-center ${metricConfig.badgeBg}`}>
                      <span className="text-xs font-black leading-none">{val}</span>
                      <span className="text-[8px] font-bold uppercase tracking-wider mt-1">{metricConfig.unit}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
