
import React from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { colorScaleProduccion, getFeriadosChile } from '../utils/produccionUtils';

const ProduccionDiaTable = ({ 
  tecnicos = [], 
  stats = {}, 
  metaConfig = {}, 
  dateFrom, 
  selectedMonths = [], 
  selectedWeeks = [], 
  searchTech, 
  setSearchTech, 
  setActiveDiagnostic 
}) => {
  const meta = metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5;
  
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

  const getSortedTechs = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    return [...tecnicos]
      .filter(t => {
        const techTotal = Object.values(t.dailyMap || {}).reduce((acc, d) => {
          if (typeof d !== 'object') return acc + d;
          if (isPts) return acc + (d.pts || 0);
          if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
          if (isHorasTotal) return acc + (d.minTotal || 0);
          if (isHorasAlta) return acc + (d.minAlta || 0);
          if (isHorasRep) return acc + (d.minReparacion || 0);
          return acc + (d.orders || d.count || 0);
        }, 0);
        return techTotal > 0 || Object.values(t.dailyMap || {}).some(d => d && d.asistencia);
      })
      .sort((a, b) => {
        const totalA = Object.values(a.dailyMap || {}).reduce((acc, d) => {
          if (typeof d !== 'object') return acc + d;
          if (isPts) return acc + (d.pts || 0);
          if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
          if (isHorasTotal) return acc + (d.minTotal || 0);
          if (isHorasAlta) return acc + (d.minAlta || 0);
          if (isHorasRep) return acc + (d.minReparacion || 0);
          return acc + (d.orders || d.count || 0);
        }, 0);
        const totalB = Object.values(b.dailyMap || {}).reduce((acc, d) => {
          if (typeof d !== 'object') return acc + d;
          if (isPts) return acc + (d.pts || 0);
          if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
          if (isHorasTotal) return acc + (d.minTotal || 0);
          if (isHorasAlta) return acc + (d.minAlta || 0);
          if (isHorasRep) return acc + (d.minReparacion || 0);
          return acc + (d.orders || d.count || 0);
        }, 0);
        return totalB - totalA;
      });
  };

  const shortenName = (name) => {
    if (!name) return '';
    return name;
  };

  const getDayName = (d) => {
    const date = new Date(Date.UTC(year, month, d));
    const days = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    return days[date.getUTCDay()];
  };

  const getWeekInfo = (d) => {
    const date = new Date(Date.UTC(year, month, d));
    const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
    const dayOfWeek = date.getUTCDay();
    return { weekNum, isNewWeek: dayOfWeek === 1, isWeekend: dayOfWeek === 0 || dayOfWeek === 6 };
  };

  const getWeekStyle = (d, isHeader = false) => {
    const { weekNum, isWeekend } = getWeekInfo(d);
    const isEven = weekNum % 2 === 0;
    if (isHeader) {
        return isEven 
            ? 'bg-indigo-500/20 text-indigo-300 border-b-2 border-indigo-500/50' 
            : 'bg-emerald-500/20 text-emerald-300 border-b-2 border-emerald-500/50';
    }
    if (isWeekend) return 'bg-slate-900/60';
    return isEven ? 'bg-indigo-500/5' : 'bg-emerald-500/5';
  };

  const colorScaleOrders = (val) => {
    if (val <= 0) return 'transparent';
    if (val === 1) return 'bg-cyan-900/40 text-cyan-200';
    if (val === 2) return 'bg-cyan-800/60 text-cyan-100';
    if (val === 3) return 'bg-cyan-700 text-white';
    if (val === 4) return 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]';
    return 'bg-cyan-500 text-white font-black shadow-[0_0_15px_rgba(6,182,212,0.6)]';
  };

  const handleDownloadExcel = (type) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;
    const dayNamesRow = [
      '', '', '', '', 
      ...days.map(d => getDayName(d)), 
      '', '', '', ''
    ];
    const dayNumbersRow = [
      'ESPECIALISTA', 'ID TOA', 'PROYECTO', 'ORD',
      ...days,
      'ESTADO', isPts ? 'TOTAL PTS' : isAsig ? 'TOTAL ASIGN' : isHorasAny ? 'TOTAL HORAS' : 'TOTAL ORD', 'PROM. DIARIO', 'PROY. CIERRE'
    ];

    const sortedTechs = getSortedTechs(type);
    const dataRows = sortedTechs.map(t => {
      const productiveDays = Object.values(t.dailyMap || {}).filter(d => {
        if (typeof d !== 'object') return d > 0;
        if (isPts) return (d.pts || 0) > 0;
        if (isAsig) return ((d.completadas || 0) + (d.noRealizadas || 0)) > 0;
        if (isHorasTotal) return (d.minTotal || 0) > 0;
        if (isHorasAlta) return (d.minAlta || 0) > 0;
        if (isHorasRep) return (d.minReparacion || 0) > 0;
        return (d.orders || d.count || 0) > 0;
      }).length;
      
      const currentTotal = Object.values(t.dailyMap || {}).reduce((acc, d) => {
        if (typeof d !== 'object') return acc + d;
        if (isPts) return acc + (d.pts || 0);
        if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
        return acc + (d.orders || d.count || 0);
      }, 0);
      
      const avgProd = productiveDays > 0 ? (currentTotal / productiveDays) : 0;
      const proyeccion = avgProd * (metaConfig?.diasLaboralesMes || 22);

      const dailyValues = days.map(d => {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayData = t.dailyMap?.[dateKey];
        if (isPts) return (dayData?.pts || 0);
        if (isAsig) return ((dayData?.completadas || 0) + (dayData?.noRealizadas || 0));
        if (isHorasTotal) return ((dayData?.minTotal || 0) / 60).toFixed(1);
        if (isHorasAlta) return ((dayData?.minAlta || 0) / 60).toFixed(1);
        if (isHorasRep) return ((dayData?.minReparacion || 0) / 60).toFixed(1);
        return (dayData?.orders || dayData?.count || 0);
      });

      return [
        t.fullName || t.name,
        t.idRecursoToa || '',
        t.proyecto || '',
        t.orders || 0,
        ...dailyValues,
        t.estado || t.status || '',
        isHorasAny ? (currentTotal / 60).toFixed(1) : currentTotal.toFixed(1),
        isHorasAny ? (avgProd / 60).toFixed(1) : avgProd.toFixed(1),
        isHorasAny ? (proyeccion / 60).toFixed(1) : proyeccion.toFixed(1)
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([dayNamesRow, dayNumbersRow, ...dataRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isPts ? 'Producción PTS' : isAsig ? 'Asignadas' : isHorasAny ? 'Horas Ejecutadas' : 'Volumen ORD');
    XLSX.writeFile(workbook, `Reporte_Produccion_${isPts ? 'PTS' : isAsig ? 'ASIG' : isHorasAny ? 'HRS' : 'ORD'}_${year}_${month + 1}.xlsx`);
  };

  const renderTable = (type, title) => {
    const isPts = type === 'pts';
    const isAsig = type === 'asignadas';
    const isHorasTotal = type === 'horasTotal';
    const isHorasAlta = type === 'horasAlta';
    const isHorasRep = type === 'horasReparacion';
    const isHorasAny = isHorasTotal || isHorasAlta || isHorasRep;
    const mainColor = isPts ? 'text-emerald-400' : isAsig ? 'text-fuchsia-400' : isHorasTotal ? 'text-emerald-400' : isHorasAlta ? 'text-blue-400' : isHorasRep ? 'text-orange-400' : 'text-cyan-400';
    const mainBg = isPts ? 'bg-emerald-500' : isAsig ? 'bg-fuchsia-500' : isHorasTotal ? 'bg-emerald-500' : isHorasAlta ? 'bg-blue-500' : isHorasRep ? 'bg-orange-500' : 'bg-cyan-500';
    const sortedTechs = getSortedTechs(type);

    return (
      <div className="w-full mb-10">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border border-slate-800 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-5 ${mainBg} rounded-full`} />
            <h3 className={`text-[11px] font-black uppercase tracking-widest ${mainColor}`}>{title}</h3>
          </div>
          <button 
            onClick={() => handleDownloadExcel(type)}
            className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase rounded-lg border border-slate-700 transition-all hover:scale-105"
          >
            <Download size={12} className={mainColor} />
            Excel
          </button>
        </div>
        
        <div className="overflow-x-auto bg-slate-950 border-x border-b border-slate-800 rounded-b-xl">
          <table className="w-full border-collapse p-0 m-0" style={{ borderSpacing: 0, borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-slate-900 h-6">
                <th className="sticky left-0 z-40 bg-slate-900 border-r-4 border-r-white px-1 text-[7px] font-black text-slate-500" colSpan={4}>ESTRUCTURA FIJA</th>
                {Array.from({length: Math.ceil((days.length + new Date(Date.UTC(year, month, 1)).getUTCDay() - 1) / 7) + 1}).map((_, idx) => {
                  const firstDayInTable = days.find(d => {
                    const { weekNum } = getWeekInfo(d);
                    const firstWeekNum = getWeekInfo(days[0]).weekNum;
                    return weekNum === (firstWeekNum + idx);
                  });
                  if (!firstDayInTable) return null;
                  const daysInThisWeekArray = days.filter(d => {
                    const { weekNum } = getWeekInfo(d);
                    const firstWeekNum = getWeekInfo(days[0]).weekNum;
                    return weekNum === (firstWeekNum + idx);
                  });
                  const daysInThisWeek = daysInThisWeekArray.length;
                  const weekTotal = sortedTechs.reduce((acc, t) => {
                    return acc + daysInThisWeekArray.reduce((daySum, d) => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const dayData = t.dailyMap?.[dateKey];
                      if (isPts) return daySum + (dayData?.pts || 0);
                      if (isAsig) return daySum + ((dayData?.completadas || 0) + (dayData?.noRealizadas || 0));
                      return daySum + (dayData?.orders || dayData?.count || 0);
                    }, 0);
                  }, 0);
                  const productiveDaysInWeek = daysInThisWeekArray.filter(d => {
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    return sortedTechs.some(t => {
                      const dd = t.dailyMap?.[dateKey];
                      if (isPts) return (dd?.pts || 0) > 0;
                      if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                      return (dd?.orders || 0) > 0;
                    });
                  }).length;
                  const weekAvg = productiveDaysInWeek > 0 ? (weekTotal / productiveDaysInWeek) : 0;
                  const isEven = (getWeekInfo(firstDayInTable).weekNum) % 2 === 0;
                  const themeColor = isEven ? 'border-indigo-500/50 text-indigo-400' : 'border-emerald-500/50 text-emerald-400';
                  return (
                    <th key={idx} colSpan={daysInThisWeek} className={`border-r-2 border-white/20 text-[9px] font-black uppercase tracking-tight ${themeColor} bg-slate-900/90 h-7`}>
                      <div className="leading-tight mb-0.5">SEMANA {idx + 1}</div>
                      <div className="text-[8px] flex justify-center gap-2 font-black">
                        <span className="text-white">T: {Math.round(weekTotal)}</span>
                        <span className="text-amber-400">P: {weekAvg.toFixed(1)}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="sticky right-0 z-40 bg-slate-900 border-l-4 border-l-white px-1 text-[7px] font-black text-slate-500" colSpan={isAsig ? 5 : isHorasAny ? 2 : 4}>MÉTRICAS FINAL</th>
              </tr>
              <tr className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 h-6">
                <th className="sticky left-0 z-30 bg-slate-900 border-r border-slate-800 w-[110px] min-w-[110px] text-[7px] font-black text-slate-400 uppercase p-0">Especialista</th>
                <th className="sticky left-[110px] z-30 bg-slate-900 border-r border-slate-800 w-[40px] min-w-[40px] text-[7px] font-black text-slate-400 uppercase p-0">ID</th>
                <th className="sticky left-[150px] z-30 bg-slate-900 border-r border-slate-800 w-[70px] min-w-[70px] text-[7px] font-black text-slate-400 uppercase p-0">Proyecto</th>
                <th className="sticky left-[220px] z-20 bg-slate-900 border-r-4 border-r-white w-[30px] min-w-[30px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">Ord</th>
                {days.map(d => {
                  const { isNewWeek, isWeekend } = getWeekInfo(d);
                  return (
                    <th key={d} className={`w-6 min-w-[24px] border-r border-slate-800 p-0 text-center ${isNewWeek ? 'border-l-2 border-l-white/30' : ''} ${getWeekStyle(d)}`}>
                      <div className={`text-[7px] font-black leading-none mb-0.5 ${isWeekend ? 'text-amber-500' : 'text-slate-400'}`}>{getDayName(d)}</div>
                      <div className={`text-[9px] font-black leading-none ${isWeekend ? 'text-amber-400' : 'text-white'}`}>{d}</div>
                    </th>
                  );
                })}
                                {isAsig ? (
                  <>
                    <th className="sticky right-[140px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-[105px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-fuchsia-400 uppercase p-0 text-center">ASIG</th>
                    <th className="sticky right-[70px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-emerald-400 uppercase p-0 text-center">COMP</th>
                    <th className="sticky right-[35px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-rose-400 uppercase p-0 text-center">N.R.</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-cyan-400 uppercase p-0 text-center">EFECT</th>
                  </>
                ) : isHorasAny ? (
                  <>
                    <th className="sticky right-[45px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[45px] min-w-[45px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">TOTAL HRS</th>
                  </>
                ) : (
                  <>
                    <th className="sticky right-[125px] z-30 bg-slate-900 border-l-4 border-l-white w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">EST</th>
                    <th className="sticky right-[90px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">{isPts ? 'PTS' : 'ORD'}</th>
                    <th className="sticky right-[55px] z-30 bg-slate-900 border-l border-slate-800 w-[35px] min-w-[35px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROM</th>
                    <th className="sticky right-0 z-30 bg-slate-900 border-l border-slate-800 w-[55px] min-w-[55px] text-[7px] font-black text-slate-400 uppercase p-0 text-center">PROY. CIERRE</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="p-0 m-0">
              {sortedTechs.map((t) => {
                 const currentTotal = Object.values(t.dailyMap || {}).reduce((acc, d) => {
                   if (typeof d !== 'object') return acc + d;
                   if (isPts) return acc + (d.pts || 0);
                   if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
                   return acc + (d.orders || d.count || 0);
                 }, 0);
                 const productiveDays = Object.values(t.dailyMap || {}).filter(d => {
                   if (typeof d !== 'object') return d > 0;
                   if (isPts) return (d.pts || 0) > 0;
                   if (isAsig) return ((d.completadas || 0) + (d.noRealizadas || 0)) > 0;
                   return (d.orders || d.count || 0) > 0;
                 }).length;
                 const avgProd = productiveDays > 0 ? (currentTotal / productiveDays) : 0;
                 const proyeccion = avgProd * (metaConfig?.diasLaboralesMes || 22);
                 return (
                   <tr key={t.idUnique || t._id} className="h-6 border-b border-white/5 hover:bg-white/5 p-0 m-0">
                     <td className="sticky left-0 z-20 bg-slate-900 border-r border-slate-800 uppercase px-1 p-0 m-0 overflow-hidden">
                       <div className="flex flex-col leading-none justify-center h-full gap-0.5">
                         <span className="text-[7px] font-black text-slate-200 truncate" title={t.fullName || t.name}>{shortenName(t.fullName || t.name)}</span>
                         <span className="text-[7px] font-black text-slate-400 font-mono truncate uppercase tracking-tight" title={t.rut}>{t.rut || 'SIN RUT'}</span>
                       </div>
                     </td>
                     <td className="sticky left-[110px] z-20 bg-slate-900 border-r border-slate-800 text-indigo-400 font-mono text-[8px] font-black px-1 p-0 m-0">{t.idRecursoToa || '—'}</td>
                     <td className="sticky left-[150px] z-20 bg-slate-900 border-r border-slate-800 text-slate-500 uppercase text-[7px] font-black px-1 truncate p-0 m-0">{t.proyecto || '—'}</td>
                     <td className="sticky left-[220px] z-20 bg-slate-900 border-r-4 border-r-white text-center text-indigo-300 text-[8px] font-black p-0 m-0">{t.orders || 0}</td>
                     {days.map(d => {
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const dayData = t.dailyMap?.[dateKey];
                        let val = 0, comp = 0, noReal = 0;
                        if (isPts) {
                          val = dayData?.pts || 0;
                        } else if (isAsig) {
                          comp = dayData?.completadas || 0;
                          noReal = dayData?.noRealizadas || 0;
                          val = comp + noReal;
                        } else {
                          val = dayData?.orders || dayData?.count || 0;
                        }
                        const isSunday = new Date(Date.UTC(year, month, d)).getUTCDay() === 0;
                        const isHoliday = holidays.includes(dateKey);
                        let content = null, style = "";
                        
                        const ast = dayData?.asistencia;
                        const anomaly = dayData?.anomaly;

                        if (val > 0) {
                          if (isAsig) {
                            content = (
                              <div className="w-full h-full flex flex-col items-center justify-center relative p-0 m-0 leading-none">
                                <div className={`font-black text-[9px] ${comp > 0 ? 'text-fuchsia-400' : 'text-slate-300'}`}>{val}</div>
                                <div className="flex gap-px text-[5px] mt-[1px] opacity-80">
                                  {comp > 0 && <span className="text-emerald-400 bg-emerald-950/40 px-0.5 rounded-sm">C{comp}</span>}
                                  {noReal > 0 && <span className="text-rose-400 bg-rose-950/40 px-0.5 rounded-sm">NR{noReal}</span>}
                                </div>
                              </div>
                            );
                          } else {
                            content = <div className={`w-full h-full flex items-center justify-center font-black text-[8px] ${isPts ? colorScaleProduccion(val, meta) : colorScaleOrders(val)}`}>{isPts ? val.toFixed(1) : val}</div>;
                          }
                        } else if (ast === 'Ausente') {
                          content = <span className="text-[7px] font-black text-rose-500">AUS</span>;
                          style = "bg-rose-950/40";
                        } else if (ast === 'Licencia') {
                          content = <span className="text-[7px] font-black text-blue-400">LIC</span>;
                          style = "bg-blue-950/40";
                        } else if (ast === 'Vacaciones') {
                          content = <span className="text-[7px] font-black text-emerald-400">VAC</span>;
                          style = "bg-emerald-950/40";
                        } else if (ast === 'Permiso') {
                          content = <span className="text-[7px] font-black text-amber-400">PER</span>;
                          style = "bg-amber-950/40";
                        } else if (ast === 'Presente' || ast === 'Tardanza') {
                          content = <span className="text-[7px] font-black text-amber-400/80">PRES</span>;
                          style = "bg-amber-950/20";
                        } else if (isSunday) {
                          content = <span className="text-[7px] font-black text-indigo-400/50">LIB</span>;
                          style = "bg-indigo-950/20";
                        } else if (isHoliday) {
                          content = <span className="text-[7px] font-black text-amber-500/50">FER</span>;
                          style = "bg-amber-950/20";
                        } else {
                          content = <span className="text-[6px] font-black text-rose-500/20">SP</span>;
                        }

                        let cellContent = content;
                        let anomalyClass = "";
                        if (anomaly) {
                          const borderCol = anomaly === 'Producción sin Asistencia' ? 'border-rose-500/80 bg-rose-500/10' : 'border-amber-500/80 bg-amber-500/10';
                          anomalyClass = `border ${borderCol}`;
                          cellContent = (
                            <div className="relative group flex items-center justify-center w-full h-full">
                              {content}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-950 text-white text-[8px] font-black uppercase tracking-tight rounded-lg px-2 py-1 z-[60] whitespace-nowrap shadow-2xl border border-slate-700">
                                ⚠️ {anomaly}
                              </div>
                            </div>
                          );
                        }

                        const { isNewWeek } = getWeekInfo(d);
                        return (
                          <td key={d} className={`p-0 m-0 text-center border-r border-white/5 ${style || getWeekStyle(d)} ${anomalyClass} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''} h-6`}>{cellContent}</td>
                        );
                     })}
                                           {isAsig ? (
                       <>
                         <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           <div className="flex items-center justify-center h-full px-1">
                          {(() => {
                            const rawStatus = (t.estado || t.status || 'Activo');
                            const status = rawStatus.toUpperCase();
                            let displayLabel = status.substring(0, 4);
                            if (status.includes('TERR')) displayLabel = 'ACTV';
                            if (status.includes('CONT')) displayLabel = 'CONT';
                            if (status.includes('APROB')) displayLabel = 'APRB';
                            if (status.includes('ENTR')) displayLabel = 'ENTR';
                            if (status.includes('POST')) displayLabel = 'POST';
                            const isContratado = status.includes('CONT') || status.includes('ACTI') || status.includes('TERR');
                            const isBaja = status.includes('BAJA') || status.includes('FINI') || status.includes('INAC');
                            return (
                              <div className={`
                                text-[6px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter transition-all whitespace-nowrap
                                ${isContratado 
                                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                  : isBaja 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                                }
                              `}>
                                {displayLabel}
                              </div>
                            );
                          })()}
                        </div>
                         </td>
                         <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-fuchsia-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0)}
                         </td>
                         <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-emerald-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0)}
                         </td>
                         <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-rose-400 p-0 m-0">
                           {Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0)}
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-cyan-400 p-0 m-0">
                           {(() => {
                             const comp = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0);
                             const noReal = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0);
                             const asig = comp + noReal;
                             return asig > 0 ? `${((comp / asig) * 100).toFixed(1)}%` : '0.0%';
                           })()}
                         </td>
                       </>
                     ) : isHorasAny ? (
                       <>
                         <td className="sticky right-[45px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                          <div className="flex items-center justify-center h-full px-1">
                            {(() => {
                              const rawStatus = (t.estado || t.status || 'Activo');
                              const status = rawStatus.toUpperCase();
                              let displayLabel = status.substring(0, 4);
                              if (status.includes('TERR')) displayLabel = 'ACTV';
                              if (status.includes('CONT')) displayLabel = 'CONT';
                              if (status.includes('APROB')) displayLabel = 'APRB';
                              if (status.includes('ENTR')) displayLabel = 'ENTR';
                              if (status.includes('POST')) displayLabel = 'POST';
                              const isContratado = status.includes('CONT') || status.includes('ACTI') || status.includes('TERR');
                              const isBaja = status.includes('BAJA') || status.includes('FINI') || status.includes('INAC');
                              return (
                                <div className={`
                                  text-[6px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter transition-all whitespace-nowrap
                                  ${isContratado 
                                    ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                    : isBaja 
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                      : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                                  }
                                `}>
                                  {displayLabel}
                                </div>
                              );
                            })()}
                          </div>
                         </td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">
                           {(() => {
                             const minTot = Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (isHorasTotal ? (dd?.minTotal||0) : isHorasAlta ? (dd?.minAlta||0) : (dd?.minReparacion||0)), 0);
                             return minTot > 0 ? `${Math.floor(minTot/60).toString().padStart(2, '0')}:${(minTot%60).toString().padStart(2, '0')}` : '—';
                           })()}
                         </td>
                       </>
                     ) : (
                       <>
                         <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white text-center p-0 m-0">
                           <div className="flex items-center justify-center h-full px-1">
                          {(() => {
                            const rawStatus = (t.estado || t.status || 'Activo');
                            const status = rawStatus.toUpperCase();
                            let displayLabel = status.substring(0, 4);
                            if (status.includes('TERR')) displayLabel = 'ACTV';
                            if (status.includes('CONT')) displayLabel = 'CONT';
                            if (status.includes('APROB')) displayLabel = 'APRB';
                            if (status.includes('ENTR')) displayLabel = 'ENTR';
                            if (status.includes('POST')) displayLabel = 'POST';
                            const isContratado = status.includes('CONT') || status.includes('ACTI') || status.includes('TERR');
                            const isBaja = status.includes('BAJA') || status.includes('FINI') || status.includes('INAC');
                            return (
                              <div className={`
                                text-[6px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter transition-all whitespace-nowrap
                                ${isContratado 
                                  ? 'bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' 
                                  : isBaja 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
                                }
                              `}>
                                {displayLabel}
                              </div>
                            );
                          })()}
                        </div>
                         </td>
                         <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-white p-0 m-0">{currentTotal.toFixed(1)}</td>
                         <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black text-slate-400 p-0 m-0">{avgProd.toFixed(1)}</td>
                         <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[8px] font-black p-0 m-0 text-indigo-400">{proyeccion.toFixed(1)}</td>
                       </>
                     )}
                   </tr>
                 );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-40 bg-slate-900 shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
{isAsig ? (
                 <>
                   {/* Row 1: TOTAL ASIGNACIÓN */}
                   <tr className="h-6 border-t border-white/20">
                     <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-fuchsia-400 p-0" colSpan={4}>TOTAL ASIGNACIÓN</td>
                     {days.map(d => {
                       const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                       const total = sortedTechs.reduce((s, t) => {
                         const dd = t.dailyMap?.[dateKey];
                         return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                       }, 0);
                       const { isNewWeek } = getWeekInfo(d);
                       return <td key={d} className={`p-0 text-center text-[8px] font-black text-fuchsia-400 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{total > 0 ? total : '—'}</td>;
                     })}
                     <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                     <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-fuchsia-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0), 0)}
                     </td>
                     <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-emerald-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-rose-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                       {(() => {
                         const totalComp = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0);
                         const totalNoReal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0);
                         const totalAsig = totalComp + totalNoReal;
                         return totalAsig > 0 ? `${((totalComp / totalAsig) * 100).toFixed(1)}%` : '0.0%';
                       })()}
                     </td>
                   </tr>
                   {/* Row 2: TOTAL COMPLETADO */}
                   <tr className="h-6 border-t border-slate-800">
                     <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-emerald-400 p-0" colSpan={4}>TOTAL COMPLETADO</td>
                     {days.map(d => {
                       const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                       const total = sortedTechs.reduce((s, t) => {
                         const dd = t.dailyMap?.[dateKey];
                         return s + (dd?.completadas || 0);
                       }, 0);
                       const { isNewWeek } = getWeekInfo(d);
                       return <td key={d} className={`p-0 text-center text-[8px] font-black text-emerald-400 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{total > 0 ? total : '—'}</td>;
                     })}
                     <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                     <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-fuchsia-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0), 0)}
                     </td>
                     <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-emerald-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-rose-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                       {(() => {
                         const totalComp = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0);
                         const totalNoReal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0);
                         const totalAsig = totalComp + totalNoReal;
                         return totalAsig > 0 ? `${((totalComp / totalAsig) * 100).toFixed(1)}%` : '0.0%';
                       })()}
                     </td>
                   </tr>
                   {/* Row 3: TOTAL NO REALIZADO */}
                   <tr className="h-6 border-t border-slate-800">
                     <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-rose-400 p-0" colSpan={4}>TOTAL NO REALIZADO</td>
                     {days.map(d => {
                       const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                       const total = sortedTechs.reduce((s, t) => {
                         const dd = t.dailyMap?.[dateKey];
                         return s + (dd?.noRealizadas || 0);
                       }, 0);
                       const { isNewWeek } = getWeekInfo(d);
                       return <td key={d} className={`p-0 text-center text-[8px] font-black text-rose-400 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{total > 0 ? total : '—'}</td>;
                     })}
                     <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                     <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-fuchsia-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0), 0)}
                     </td>
                     <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-emerald-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-rose-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                       {(() => {
                         const totalComp = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0);
                         const totalNoReal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0);
                         const totalAsig = totalComp + totalNoReal;
                         return totalAsig > 0 ? `${((totalComp / totalAsig) * 100).toFixed(1)}%` : '0.0%';
                       })()}
                     </td>
                   </tr>
                   {/* Row 4: EFECTIVIDAD */}
                   <tr className="h-6 border-t border-slate-800">
                     <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-cyan-400 p-0" colSpan={4}>EFECTIVIDAD</td>
                     {days.map(d => {
                       const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                       const comp = sortedTechs.reduce((s, t) => s + (t.dailyMap?.[dateKey]?.completadas || 0), 0);
                       const noReal = sortedTechs.reduce((s, t) => s + (t.dailyMap?.[dateKey]?.noRealizadas || 0), 0);
                       const asig = comp + noReal;
                       const efectividad = asig > 0 ? (comp / asig) * 100 : 0;
                       const { isNewWeek } = getWeekInfo(d);
                       return <td key={d} className={`p-0 text-center text-[8px] font-black text-cyan-400 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{asig > 0 ? `${efectividad.toFixed(1)}%` : '—'}</td>;
                     })}
                     <td className="sticky right-[140px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                     <td className="sticky right-[105px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-fuchsia-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + ((dd?.completadas || 0) + (dd?.noRealizadas || 0)), 0), 0)}
                     </td>
                     <td className="sticky right-[70px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-emerald-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-[35px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-rose-400 p-0">
                       {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0)}
                     </td>
                     <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                       {(() => {
                         const totalComp = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.completadas || 0), 0), 0);
                         const totalNoReal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, dd) => acc + (dd?.noRealizadas || 0), 0), 0);
                         const totalAsig = totalComp + totalNoReal;
                         return totalAsig > 0 ? `${((totalComp / totalAsig) * 100).toFixed(1)}%` : '0.0%';
                       })()}
                     </td>
                   </tr>
                 </>
              ) : (
                 <>

               <tr className="h-6 border-t border-white/20">
                 <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-slate-400 p-0" colSpan={4}>TOTAL</td>
                 {days.map(d => {
                   const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                   const total = sortedTechs.reduce((s, t) => {
                     const dd = t.dailyMap?.[dateKey];
                     if (isPts) return s + (dd?.pts || 0);
                     if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                     return s + (dd?.orders || dd?.count || 0);
                   }, 0);
                   const { isNewWeek } = getWeekInfo(d);
                   return <td key={d} className={`p-0 text-center text-[8px] font-black ${mainColor} border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{total > 0 ? total.toFixed(1) : '—'}</td>;
                 })}
                 <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                 <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-white p-0">
                    {sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, d) => {
                      if (typeof d !== 'object') return acc + d;
                      if (isPts) return acc + (d.pts || 0);
                      if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
                      return acc + (d.orders || d.count || 0);
                    }, 0), 0).toFixed(1)}
                 </td>
                 <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 p-0"></td>
                 <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-indigo-400 p-0">
                    {(() => {
                      const totalVal = sortedTechs.reduce((s, t) => s + Object.values(t.dailyMap || {}).reduce((acc, d) => {
                        if (typeof d !== 'object') return acc + d;
                        if (isPts) return acc + (d.pts || 0);
                        if (isAsig) return acc + ((d.completadas || 0) + (d.noRealizadas || 0));
                        return acc + (d.orders || d.count || 0);
                      }, 0), 0);
                      const activeDaysInMonth = days.filter(d => {
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        return sortedTechs.some(t => {
                          const dd = t.dailyMap?.[dateKey];
                          if (isPts) return (dd?.pts || 0) > 0;
                          if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                          return (dd?.orders || 0) > 0;
                        });
                      }).length;
                      const avgDay = activeDaysInMonth > 0 ? (totalVal / activeDaysInMonth) : 0;
                      return (avgDay * (metaConfig?.diasLaboralesMes || 22)).toFixed(1);
                    })()}
                 </td>
               </tr>
               <tr className="h-6 border-t border-slate-800">
                 <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-slate-500 p-0" colSpan={4}>TÉCNICOS ACTIVOS</td>
                 {days.map(d => {
                   const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                   const count = sortedTechs.filter(t => {
                     const dd = t.dailyMap?.[dateKey];
                     if (isPts) return (dd?.pts || 0) > 0;
                     if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                     return (dd?.orders || dd?.count || 0) > 0;
                   }).length;
                   const { isNewWeek } = getWeekInfo(d);
                   return <td key={d} className={`p-0 text-center text-[8px] font-black text-indigo-400 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{count > 0 ? count : '—'}</td>;
                 })}
                 <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                 <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-indigo-300 p-0">
                    {(() => {
                      const dailyCounts = days.map(d => {
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        return sortedTechs.filter(t => {
                          const dd = t.dailyMap?.[dateKey];
                          if (isPts) return (dd?.pts || 0) > 0;
                          if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                          return (dd?.orders || dd?.count || 0) > 0;
                        }).length;
                      }).filter(c => c > 0);
                      const avgActive = dailyCounts.length > 0 ? (dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) : 0;
                      return avgActive.toFixed(1);
                    })()}
                 </td>
                 <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 p-0"></td>
                 <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-indigo-400 p-0">
                    {(() => {
                      const dailyCounts = days.map(d => {
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        return sortedTechs.filter(t => {
                          const dd = t.dailyMap?.[dateKey];
                          if (isPts) return (dd?.pts || 0) > 0;
                          if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                          return (dd?.orders || dd?.count || 0) > 0;
                        }).length;
                      }).filter(c => c > 0);
                      const avgActive = dailyCounts.length > 0 ? (dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length) : 0;
                      return avgActive.toFixed(1);
                    })()}
                 </td>
               </tr>
               <tr className="h-6 border-t border-slate-800">
                 <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-slate-500 p-0" colSpan={4}>PROMEDIO DIARIO</td>
                 {days.map(d => {
                   const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                   const activeInDay = sortedTechs.filter(t => {
                     const dd = t.dailyMap?.[dateKey];
                     if (isPts) return (dd?.pts || 0) > 0;
                     if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                     return (dd?.orders || dd?.count || 0) > 0;
                   });
                   const totalVal = activeInDay.reduce((s, t) => {
                     const dd = t.dailyMap?.[dateKey];
                     if (isPts) return s + (dd?.pts || 0);
                     if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                     return s + (dd?.orders || dd?.count || 0);
                   }, 0);
                   const avg = activeInDay.length > 0 ? totalVal / activeInDay.length : 0;
                   const { isNewWeek } = getWeekInfo(d);
                   return <td key={d} className={`p-0 text-center text-[8px] font-black text-amber-500 border-r border-white/5 ${getWeekStyle(d)} ${isNewWeek ? 'border-l-2 border-l-white/20' : ''}`}>{avg > 0 ? avg.toFixed(1) : '—'}</td>;
                 })}
                 <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                 <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-amber-400 p-0">
                  {(() => {
                    const dailyAvgs = days.map(d => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const activeInDay = sortedTechs.filter(t => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return (dd?.pts || 0) > 0;
                        if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                        return (dd?.orders || 0) > 0;
                      });
                      const totalVal = activeInDay.reduce((s, t) => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return s + (dd?.pts || 0);
                        if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                        return s + (dd?.orders || 0);
                      }, 0);
                      return activeInDay.length > 0 ? (totalVal / activeInDay.length) : 0;
                    }).filter(v => v > 0);
                    return dailyAvgs.length > 0 ? (dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length).toFixed(1) : '0.0';
                  })()}
                 </td>
                 <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 p-0"></td>
                 <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-indigo-400 p-0">
                    {(() => {
                      const dailyAvgs = days.map(d => {
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const activeInDay = sortedTechs.filter(t => {
                          const dd = t.dailyMap?.[dateKey];
                          if (isPts) return (dd?.pts || 0) > 0;
                          if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                          return (dd?.orders || 0) > 0;
                        });
                        const totalVal = activeInDay.reduce((s, t) => {
                          const dd = t.dailyMap?.[dateKey];
                          if (isPts) return s + (dd?.pts || 0);
                          if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                          return s + (dd?.orders || 0);
                        }, 0);
                        return activeInDay.length > 0 ? (totalVal / activeInDay.length) : 0;
                      }).filter(v => v > 0);
                      return dailyAvgs.length > 0 ? (dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length).toFixed(1) : '0.0';
                    })()}
                 </td>
               </tr>
               <tr className="h-6 border-t border-slate-800">
                <td className="sticky left-0 z-20 bg-slate-900 border-r-4 border-r-white text-[7px] font-black uppercase text-slate-400 p-0" colSpan={4}>PROM. ÓRDENES/MES</td>
                {days.map(d => {
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const totalOrdersDay = sortedTechs.reduce((s, t) => {
                    const dd = t.dailyMap?.[dateKey];
                    if (isPts) return s + (dd?.pts || 0);
                    if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                    return s + (dd?.orders || dd?.count || 0);
                  }, 0);
                  const activeTechs = sortedTechs.filter(t => {
                    const dd = t.dailyMap?.[dateKey];
                    if (isPts) return (dd?.pts || 0) > 0;
                    if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                    return (dd?.orders || dd?.count || 0) > 0;
                  }).length;
                  const avg = activeTechs > 0 ? (totalOrdersDay / activeTechs) : 0;
                  return <td key={d} className={`p-0 text-center text-[8px] font-black text-cyan-400 border-r border-white/5 ${getWeekStyle(d)}`}>{avg > 0 ? avg.toFixed(1) : '—'}</td>;
                })}
                <td className="sticky right-[125px] z-20 bg-slate-900 border-l-4 border-l-white p-0"></td>
                <td className="sticky right-[90px] z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-300 p-0">
                  {(() => {
                    const dailyAvgs = days.map(d => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const totalOrdersDay = sortedTechs.reduce((s, t) => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return s + (dd?.pts || 0);
                        if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                        return s + (dd?.orders || dd?.count || 0);
                      }, 0);
                      const activeTechs = sortedTechs.filter(t => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return (dd?.pts || 0) > 0;
                        if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                        return (dd?.orders || dd?.count || 0) > 0;
                      }).length;
                      return activeTechs > 0 ? (totalOrdersDay / activeTechs) : 0;
                    }).filter(v => v > 0);
                    return dailyAvgs.length > 0 ? (dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length).toFixed(1) : '0.0';
                  })()}
                </td>
                <td className="sticky right-[55px] z-20 bg-slate-900 border-l border-slate-800 p-0"></td>
                <td className="sticky right-0 z-20 bg-slate-900 border-l border-slate-800 text-center text-[9px] font-black text-cyan-400 p-0">
                  {(() => {
                    const dailyAvgs = days.map(d => {
                      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const totalOrdersDay = sortedTechs.reduce((s, t) => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return s + (dd?.pts || 0);
                        if (isAsig) return s + ((dd?.completadas || 0) + (dd?.noRealizadas || 0));
                        return s + (dd?.orders || dd?.count || 0);
                      }, 0);
                      const activeTechs = sortedTechs.filter(t => {
                        const dd = t.dailyMap?.[dateKey];
                        if (isPts) return (dd?.pts || 0) > 0;
                        if (isAsig) return ((dd?.completadas || 0) + (dd?.noRealizadas || 0)) > 0;
                        return (dd?.orders || dd?.count || 0) > 0;
                      }).length;
                      return activeTechs > 0 ? (totalOrdersDay / activeTechs) : 0;
                    }).filter(v => v > 0);
                    return dailyAvgs.length > 0 ? (dailyAvgs.reduce((a, b) => a + b, 0) / dailyAvgs.length).toFixed(1) : '0.0';
                  })()}
                </td>
              </tr>
                             </>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {renderTable('pts', 'TABLA 01: RENDIMIENTO (PUNTOS)')}
      {renderTable('orders', 'TABLA 02: VOLUMEN (ÓRDENES)')}
      {renderTable('asignadas', 'TABLA 03: ÓRDENES ASIGNADAS (COMPLETADAS + NO REALIZADAS)')}
      {renderTable('horasTotal', 'TABLA 04: HORAS TOTALES EJECUTADAS')}
      {renderTable('horasAlta', 'TABLA 05: HORAS ALTAS/INSTALACIONES')}
      {renderTable('horasReparacion', 'TABLA 06: HORAS REPARACIONES')}
    </div>
  );
};

export default ProduccionDiaTable;
