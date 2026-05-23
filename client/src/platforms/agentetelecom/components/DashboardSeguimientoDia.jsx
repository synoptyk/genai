import React, { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ComposedChart, Line, LabelList
} from 'recharts';
import { Activity, Target, Zap, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DashboardSeguimientoDia({ tecnicos = [], dateFrom, selectedMonths = [], metaConfig = {} }) {
  // Determine year and month from filters
  const { year, month } = useMemo(() => {
    if (selectedMonths.length > 0) {
      const [y, m] = selectedMonths[0].split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const d = new Date(dateFrom || Date.now());
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  }, [dateFrom, selectedMonths]);

  // Generate daily data
  const data = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return days.map(d => {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      let completadas = 0;
      let noRealizadas = 0;
      let ptsAsignados = 0;
      let pts = 0;
      let minTotal = 0;
      let minAlta = 0;
      let minReparacion = 0;
      let tecnicosActivos = 0;

      const metaDiariaPB = metaConfig.metaProduccionDia || metaConfig.metaDiaria || 7.5;

      tecnicos.forEach(t => {
        const dd = t.dailyMap?.[dateKey];
        if (dd) {
          completadas += (dd.completadas || 0);
          noRealizadas += (dd.noRealizadas || 0);
          ptsAsignados += (dd.pts || 0);
          pts += (dd.ptsCompletados !== undefined ? dd.ptsCompletados : (dd.pts || 0));
          minTotal += (dd.minTotal || 0);
          minAlta += (dd.minAlta || 0);
          minReparacion += (dd.minReparacion || 0);
          if (dd.completadas > 0 || dd.noRealizadas > 0 || dd.pts > 0 || dd.orders > 0 || dd.minTotal > 0) {
            tecnicosActivos += 1;
          }
        }
      });

      const asignadas = completadas + noRealizadas;
      const metaOrdenes = tecnicosActivos * 5;
      const metaPuntos = Number((tecnicosActivos * metaDiariaPB).toFixed(1));
      const metaHoras = tecnicosActivos * 6;
      const metaOrdenesLine = tecnicosActivos > 0 ? metaOrdenes : null;
      const metaPuntosLine = tecnicosActivos > 0 ? metaPuntos : null;
      const metaHorasLine = tecnicosActivos > 0 ? metaHoras : null;

      return {
        metaOrdenesLine,
        metaPuntosLine,
        metaHorasLine,
        tecnicosActivos,
        metaOrdenes,
        metaPuntos,
        metaHoras,
        dia: String(d).padStart(2, '0'),
        dateKey,
        asignadas,
        completadas,
        noRealizadas,
        ptsAsignados: Number(ptsAsignados.toFixed(1)),
        pts: Number(pts.toFixed(1)),
        horasTotal: Number((minTotal / 60).toFixed(1)),
        horasAlta: Number((minAlta / 60).toFixed(1)),
        horasReparacion: Number((minReparacion / 60).toFixed(1)),
        completadasPct: asignadas > 0 ? ((completadas / asignadas) * 100).toFixed(0) + '%' : '',
        noRealizadasPct: asignadas > 0 && noRealizadas > 0 ? ((noRealizadas / asignadas) * 100).toFixed(0) + '%' : ''
      };
    });
  }, [tecnicos, year, month]);

  // Calculate some summaries for cards
  const summary = useMemo(() => {
    return data.reduce((acc, curr) => {
      acc.asignadas += curr.asignadas;
      acc.completadas += curr.completadas;
      acc.noRealizadas += curr.noRealizadas;
      acc.pts += curr.pts;
      acc.ptsAsignados += (curr.ptsAsignados || 0);
      acc.horasTotal += curr.horasTotal;
      acc.horasAlta += (curr.horasAlta || 0);
      acc.horasReparacion += (curr.horasReparacion || 0);
      acc.metaOrdenes += (curr.metaOrdenes || 0);
      acc.metaPuntos += curr.metaPuntos;
      acc.metaHoras += curr.metaHoras;
      return acc;
    }, { asignadas: 0, completadas: 0, noRealizadas: 0, pts: 0, ptsAsignados: 0, horasTotal: 0, horasAlta: 0, horasReparacion: 0, metaOrdenes: 0, metaPuntos: 0, metaHoras: 0 });
  }, [data]);

  const efectividad = summary.asignadas > 0 ? ((summary.completadas / summary.asignadas) * 100).toFixed(1) : '0.0';

  // Custom Label for Charts
  const CustomLabel = (props) => {
    const { x, y, value, width, height, position, bgColor, textColor, offset = 10 } = props;
    if (!value && value !== 0) return null;
    
    const textStr = String(value);
    const rectWidth = textStr.length * 6 + 8;
    const rectHeight = 16;
    
    let finalX = x;
    let finalY = y - offset;
    
    if (position === 'inside') {
      finalX = x + (width || 0) / 2;
      finalY = y + (height || 0) / 2;
    } else if (position === 'insideBottom') {
      finalX = x; 
      finalY = y + offset;
    } else if (position === 'bottom') {
      if (width !== undefined) finalX = x + width / 2;
      finalY = y + offset;
    } else if (position === 'top') {
      if (width !== undefined) finalX = x + width / 2;
      finalY = y - offset;
    }

    return (
      <g>
        <rect x={finalX - rectWidth / 2} y={finalY - rectHeight / 2} width={rectWidth} height={rectHeight} fill={bgColor} rx={4} ry={4} stroke={textColor} strokeWidth={0.5} strokeOpacity={0.5} />
        <text x={finalX} y={finalY} fill={textColor} fontSize={8} fontWeight="bold" textAnchor="middle" dominantBaseline="central">
          {value}
        </text>
      </g>
    );
  };

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const isHoras = payload.some(p => p.dataKey === 'horasAlta' || p.dataKey === 'horasReparacion');
      const dataPoint = payload[0]?.payload || {};
      
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl">
          <p className="text-white font-black mb-2 border-b border-slate-700 pb-1">Día {label} <span className="text-slate-400 font-normal text-[10px] ml-2">({dataPoint.tecnicosActivos} Técnicos)</span></p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest my-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="text-white ml-auto">{entry.value}</span>
            </div>
          ))}
          {isHoras && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest my-1 mt-2 pt-1 border-t border-slate-700">
              <div className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-blue-400">TOTAL HORAS:</span>
              <span className="text-blue-400 ml-auto">{dataPoint.horasTotal}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-2 space-y-6">
      
      {/* Sección 1: Seguimiento de Órdenes */}
      <div className="space-y-4">
        {/* Tarjetas de Órdenes */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-fuchsia-500/20" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-fuchsia-500/20 rounded-lg text-fuchsia-400">
                  <Activity size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Órdenes</h3>
              </div>
            </div>
            <p className="text-3xl font-black text-fuchsia-400">{summary.metaOrdenes}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-pink-500/20" />
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-pink-500/20 rounded-lg text-pink-400">
                <Target size={16} />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asignadas</h3>
            </div>
            <p className="text-3xl font-black text-white">{summary.asignadas}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completadas</h3>
              </div>
              <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">
                {efectividad}% EFECT.
              </span>
            </div>
            <p className="text-3xl font-black text-emerald-400">{summary.completadas}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-rose-500/20" />
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
                  <AlertTriangle size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Realizadas</h3>
              </div>
              <span className="text-xs font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">
                {summary.asignadas > 0 ? ((summary.noRealizadas / summary.asignadas) * 100).toFixed(1) : '0.0'}%
              </span>
            </div>
            <p className="text-3xl font-black text-rose-400">{summary.noRealizadas}</p>
          </div>
        </div>

      {/* Gráfico 1: Seguimiento de Órdenes */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-fuchsia-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-widest">Volumen Diario de Órdenes</h2>
              <p className="text-[10px] text-slate-400 font-bold tracking-widest">Tendencia de Completadas vs No Realizadas contra la Asignación</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
             <div className="text-slate-400">Meta (5xTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaOrdenes}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Asignación: <span className="text-pink-400 text-xs ml-1">{summary.asignadas}</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">Comp: <span className="text-emerald-400 text-xs ml-1">{summary.completadas} ({efectividad}%)</span></div>
             <div className="text-slate-400 border-l border-slate-700 pl-3">No Real: <span className="text-rose-400 text-xs ml-1">{summary.noRealizadas} ({(summary.asignadas > 0 ? 100 - parseFloat(efectividad) : 0).toFixed(1)}%)</span></div>
          </div>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorComp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorNR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="dia" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
              <Area type="monotone" dataKey="completadas" name="Completadas" stroke="#10b981" strokeWidth={3} fill="url(#colorComp)">
                <LabelList dataKey="completadasPct" content={<CustomLabel bgColor="#064e3b" textColor="#34d399" offset={20} position="top" />} />
              </Area>
              <Area type="monotone" dataKey="noRealizadas" name="No Realizadas" stroke="#f43f5e" strokeWidth={3} fill="url(#colorNR)">
                <LabelList dataKey="noRealizadasPct" content={<CustomLabel bgColor="#881337" textColor="#fb7185" offset={25} position="insideBottom" />} />
              </Area>
              <Line type="monotone" dataKey="asignadas" name="Asignadas" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: '#ec4899', strokeWidth: 0 }}>
                <LabelList dataKey="asignadas" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={20} position="bottom" />} />
              </Line>
              <Line type="monotone" dataKey="metaOrdenesLine" name="Meta (Órdenes)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                <LabelList dataKey="metaOrdenesLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="top" />} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
          <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
            <thead className="text-slate-500 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2 font-bold">DÍA</th>
                <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                <th className="py-2 px-2 font-bold text-right">ÓRD. ASIGNADAS</th>
                <th className="py-2 px-2 font-bold text-right text-emerald-400">ÓRD. COMPL.</th>
                <th className="py-2 px-2 font-bold text-right text-rose-400">ÓRD. NO REALIZ.</th>
                <th className="py-2 px-2 font-bold text-right text-slate-300">META ÓRD.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              
              <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                <td className="py-2 px-2">TOTAL ACUMULADO</td>
                <td className="py-2 px-2 text-center text-slate-400">-</td>
                <td className="py-2 px-2 text-right">{summary.asignadas}</td>
                <td className="py-2 px-2 text-right text-emerald-400">{summary.completadas}</td>
                <td className="py-2 px-2 text-right text-rose-400">{summary.noRealizadas}</td>
                <td className="py-2 px-2 text-right text-slate-300">{summary.metaOrdenes}</td>
              </tr>
              <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                <td className="py-2 px-2 text-slate-400">RENDIMIENTO (%)</td>
                <td className="py-2 px-2 text-center text-slate-500">-</td>
                <td className="py-2 px-2 text-right text-slate-400">100%</td>
                <td className="py-2 px-2 text-right text-emerald-400">{summary.asignadas > 0 ? ((summary.completadas / summary.asignadas) * 100).toFixed(1) : '0.0'}%</td>
                <td className="py-2 px-2 text-right text-rose-400">{summary.asignadas > 0 ? ((summary.noRealizadas / summary.asignadas) * 100).toFixed(1) : '0.0'}%</td>
                <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaOrdenes > 0 ? ((summary.asignadas / summary.metaOrdenes) * 100).toFixed(1) : '0.0'}% s/Meta</td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid Inferior: Puntos y Horas */}
      <div className="grid grid-cols-1 gap-6">
        
        {/* Sección 2: Puntos y Meta */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-fuchsia-500/20" />
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-fuchsia-500/20 rounded-lg text-fuchsia-400">
                  <Activity size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Puntos</h3>
              </div>
              <p className="text-3xl font-black text-fuchsia-400">{summary.metaPuntos.toFixed(1)}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-pink-500/20" />
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-pink-500/20 rounded-lg text-pink-400">
                  <Target size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntos Asignados</h3>
              </div>
              <p className="text-3xl font-black text-white">{summary.ptsAsignados.toFixed(1)}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/20" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <Zap size={16} />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Puntos Generados</h3>
                </div>
                <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg">
                  {summary.ptsAsignados > 0 ? ((summary.pts / summary.ptsAsignados) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <p className="text-3xl font-black text-indigo-400">{summary.pts.toFixed(1)}</p>
            </div>
          </div>

          {/* Gráfico 2: Puntos y Meta */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-indigo-400" />
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Pendiente Puntos Diarios</h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest">Puntos Totales vs Asignación</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta (7.5xTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaPuntos.toFixed(1)}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Puntos: <span className="text-indigo-400 text-xs ml-1">{summary.pts.toFixed(1)}</span></div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="dia" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#818cf8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#e879f9" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar yAxisId="left" dataKey="ptsAsignados" name="Puntos Asignados" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="ptsAsignados" content={<CustomLabel bgColor="#831843" textColor="#fbcfe8" offset={30} position="top" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="pts" name="Puntos Generados" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12}>
                  <LabelList dataKey="pts" content={<CustomLabel bgColor="#312e81" textColor="#818cf8" offset={10} position="top" />} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="metaPuntosLine" name="Meta (Puntos)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaPuntosLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
            <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2 font-bold">DÍA</th>
                  <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                  <th className="py-2 px-2 font-bold text-right">PTS ASIGNADOS</th>
                  <th className="py-2 px-2 font-bold text-right text-indigo-400">PTS GENERADOS</th>
                  <th className="py-2 px-2 font-bold text-right text-slate-300">META PUNTOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                
                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right">{summary.ptsAsignados.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.pts.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-slate-300">{summary.metaPuntos.toFixed(1)}</td>
                </tr>
                <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                  <td className="py-2 px-2 text-slate-400">RENDIMIENTO (%)</td>
                  <td className="py-2 px-2 text-center text-slate-500">-</td>
                  <td className="py-2 px-2 text-right text-slate-400">100%</td>
                  <td className="py-2 px-2 text-right text-indigo-400">{summary.ptsAsignados > 0 ? ((summary.pts / summary.ptsAsignados) * 100).toFixed(1) : '0.0'}%</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaPuntos > 0 ? ((summary.ptsAsignados / summary.metaPuntos) * 100).toFixed(1) : '0.0'}% s/Meta</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Sección 3: Horas y Meta */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-fuchsia-500/20" />
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-fuchsia-500/20 rounded-lg text-fuchsia-400">
                  <Activity size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Horas</h3>
              </div>
              <p className="text-3xl font-black text-fuchsia-400">{summary.metaHoras.toFixed(1)}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/20" />
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                  <Clock size={16} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Ejecutadas</h3>
              </div>
              <p className="text-3xl font-black text-blue-400">{summary.horasTotal.toFixed(1)}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-sky-500/20" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/20 rounded-lg text-sky-400">
                    <Clock size={16} />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Altas</h3>
                </div>
                <span className="text-xs font-black text-sky-400 bg-sky-500/10 px-2 py-1 rounded-lg">
                  {summary.horasTotal > 0 ? ((summary.horasAlta / summary.horasTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <p className="text-3xl font-black text-sky-400">{summary.horasAlta.toFixed(1)}</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/20" />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                    <Clock size={16} />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horas Rep.</h3>
                </div>
                <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-2 py-1 rounded-lg">
                  {summary.horasTotal > 0 ? ((summary.horasReparacion / summary.horasTotal) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
              <p className="text-3xl font-black text-orange-400">{summary.horasReparacion.toFixed(1)}</p>
            </div>
          </div>

        {/* Gráfico 3: Horas y Meta */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-blue-400" />
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Ejecución Horaria Diaria</h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest">Horas Altas vs Reparaciones vs Asignación</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-black tracking-widest uppercase bg-slate-900/80 p-2 px-3 rounded-xl border border-slate-800 shadow-lg">
               <div className="text-slate-400">Meta (6hxTech): <span className="text-fuchsia-400 text-xs ml-1">{summary.metaHoras.toFixed(1)}</span></div>
               <div className="text-slate-400 border-l border-slate-700 pl-3">Total Hrs: <span className="text-blue-400 text-xs ml-1">{summary.horasTotal.toFixed(1)}</span></div>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="dia" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#60a5fa" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#e879f9" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                <Bar yAxisId="left" dataKey="horasAlta" stackId="horas" name="Horas Altas/Inst." fill="#3b82f6">
                  <LabelList dataKey="horasAlta" content={<CustomLabel bgColor="#1e3a8a" textColor="#93c5fd" position="inside" />} />
                </Bar>
                <Bar yAxisId="left" dataKey="horasReparacion" stackId="horas" name="Horas Reparaciones" fill="#f97316" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="horasReparacion" content={<CustomLabel bgColor="#7c2d12" textColor="#fdba74" offset={10} position="top" />} />
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="metaHorasLine" name="Meta (Horas)" stroke="#e879f9" strokeWidth={3} strokeDasharray="5 5" connectNulls={true} dot={{ r: 3, fill: '#e879f9', strokeWidth: 0 }}>
                  <LabelList dataKey="metaHorasLine" content={<CustomLabel bgColor="#4a044e" textColor="#f0abfc" offset={20} position="bottom" />} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 overflow-x-auto border-t border-slate-800 pt-4">
            <table className="w-full text-left text-xs text-slate-400 whitespace-nowrap">
              <thead className="text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2 font-bold">DÍA</th>
                  <th className="py-2 px-2 font-bold text-center">TÉCNICOS</th>
                  <th className="py-2 px-2 font-bold text-right text-blue-400">HRS ALTAS</th>
                  <th className="py-2 px-2 font-bold text-right text-orange-400">HRS REPAR.</th>
                  <th className="py-2 px-2 font-bold text-right text-blue-400">HRS TOTAL</th>
                  <th className="py-2 px-2 font-bold text-right text-fuchsia-400">META HRS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                
                <tr className="bg-slate-800/40 font-bold text-white border-t-2 border-slate-700">
                  <td className="py-2 px-2">TOTAL ACUMULADO</td>
                  <td className="py-2 px-2 text-center text-slate-400">-</td>
                  <td className="py-2 px-2 text-right text-blue-400">
                    {data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-orange-400">
                    {data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0).toFixed(1)}
                  </td>
                  <td className="py-2 px-2 text-right text-blue-400">{summary.horasTotal.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right text-fuchsia-400">{summary.metaHoras}</td>
                </tr>
                {(() => {
                  const totalHrsAltas = data.reduce((acc, curr) => acc + (curr.horasAlta || 0), 0);
                  const totalHrsRep = data.reduce((acc, curr) => acc + (curr.horasReparacion || 0), 0);
                  const totalHrs = summary.horasTotal;
                  const metaHrs = summary.metaHoras;
                  return (
                    <tr className="bg-slate-800/20 font-bold text-[11px] uppercase tracking-wider">
                      <td className="py-2 px-2 text-slate-400">DISTRIBUCIÓN / LOGRO</td>
                      <td className="py-2 px-2 text-center text-slate-500">-</td>
                      <td className="py-2 px-2 text-right text-blue-400">{totalHrs > 0 ? ((totalHrsAltas / totalHrs) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="py-2 px-2 text-right text-orange-400">{totalHrs > 0 ? ((totalHrsRep / totalHrs) * 100).toFixed(1) : '0.0'}%</td>
                      <td className="py-2 px-2 text-right text-slate-400">100%</td>
                      <td className="py-2 px-2 text-right text-fuchsia-400">{metaHrs > 0 ? ((totalHrs / metaHrs) * 100).toFixed(1) : '0.0'}% s/Meta</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </div>

      

    </div>
  );
}
