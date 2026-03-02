import React, { useState, useEffect } from 'react';

import axios from 'axios';
import {
  Flame, ChevronLeft, ChevronRight, Loader2,
  TrendingUp, TrendingDown, AlertTriangle, Award
} from 'lucide-react';

const MapaCalor = () => {
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [heatmapData, setHeatmapData] = useState({});

  // Stats avanzados para el Dashboard
  const [stats, setStats] = useState({
    totalAnual: 0,
    mejorDia: { fecha: null, puntos: 0 },
    peorDia: { fecha: null, puntos: 9999 },
    diasSinProd: 0,
    mejorSemana: { numero: 0, puntos: 0 }
  });

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // --- OBTENER Y PROCESAR DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const inicio = `${year}-01-01`;
        const fin = `${year}-12-31`;

        // Conexión al endpoint de Historial que ya creamos en server.js
        const res = await axios.get(`http://localhost:5001/api/historial?fechaInicio=${inicio}&fechaFin=${fin}`);

        const mapa = {};
        let total = 0;
        let diasConData = 0;
        let bestDay = { fecha: null, puntos: 0 };
        let worstDay = { fecha: null, puntos: Infinity };
        const semanas = {};

        res.data.forEach(item => {
          const fecha = item.fecha.split('T')[0]; // Aseguramos formato YYYY-MM-DD
          const valor = item.puntos || 0;

          if (!mapa[fecha]) mapa[fecha] = 0;
          mapa[fecha] += valor;
          total += valor;

          // Agrupación Semanal para KPI
          const weekNum = getWeekNumber(new Date(fecha));
          if (!semanas[weekNum]) semanas[weekNum] = 0;
          semanas[weekNum] += valor;
        });

        // Análisis post-procesamiento de KPIs
        Object.keys(mapa).forEach(f => {
          const val = mapa[f];
          if (val > 0) diasConData++;
          if (val > bestDay.puntos) bestDay = { fecha: f, puntos: val };
          if (val > 0 && val < worstDay.puntos) worstDay = { fecha: f, puntos: val };
        });

        // Calcular Mejor Semana
        let bestWeek = { numero: 0, puntos: 0 };
        Object.keys(semanas).forEach(w => {
          if (semanas[w] > bestWeek.puntos) bestWeek = { numero: w, puntos: semanas[w] };
        });

        const diasTotales = isLeapYear(year) ? 366 : 365;

        setHeatmapData(mapa);
        setStats({
          totalAnual: total,
          mejorDia: bestDay,
          peorDia: worstDay.puntos === Infinity ? { fecha: null, puntos: 0 } : worstDay,
          diasSinProd: diasTotales - diasConData,
          mejorSemana: bestWeek
        });

      } catch (error) {
        console.error("Error cargando mapa:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [year]);

  // --- HELPERS ---
  const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);

  const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getColor = (puntos) => {
    if (!puntos) return 'bg-slate-50 border-slate-100';
    if (puntos < 20) return 'bg-blue-100 border-blue-200';
    if (puntos < 50) return 'bg-blue-300 border-blue-400';
    if (puntos < 100) return 'bg-blue-500 border-blue-600';
    return 'bg-indigo-600 border-indigo-700 shadow-md shadow-indigo-200';
  };

  // --- RENDERIZADO DEL MES ---
  const renderMonth = (monthIndex) => {
    const date = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    let startDay = date.getDay();
    if (startDay === 0) startDay = 7;
    const startDayAdjusted = startDay - 1;

    const days = [];

    // Rellenar días vacíos al inicio del mes
    for (let i = 0; i < startDayAdjusted; i++) {
      days.push(<div key={`empty-${i}`} className="w-full aspect-square"></div>);
    }

    // Días reales
    for (let i = 1; i <= daysInMonth; i++) {
      const dayStr = i.toString().padStart(2, '0');
      const monthStr = (monthIndex + 1).toString().padStart(2, '0');
      const fullDate = `${year}-${monthStr}-${dayStr}`;
      const puntos = heatmapData[fullDate] || 0;

      days.push(
        <div
          key={fullDate}
          className={`w-full aspect-square rounded-sm transition-all duration-300 group relative border ${getColor(puntos)} hover:scale-125 hover:z-20 hover:shadow-lg`}
        >
          {/* TOOLTIP FLOTANTE MEJORADO */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 min-w-[140px] pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl text-center border border-slate-700 backdrop-blur-md">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                {new Date(fullDate + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
              <div className="flex items-center justify-center gap-1">
                {puntos > 100 && <Flame size={12} className="text-orange-500 animate-pulse" />}
                <p className="text-xl font-black text-white leading-none">
                  {puntos.toFixed(0)} <span className="text-[9px] text-blue-400">PTS</span>
                </p>
              </div>
            </div>
            {/* Triángulo del tooltip */}
            <div className="w-2 h-2 bg-slate-900 transform rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-slate-700"></div>
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="animate-in fade-in duration-500 w-full pb-10">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-3">
            <Flame className="text-orange-500" size={32} />
            Mapa de <span className="text-blue-600">Calor</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-widest mt-2">
            INTENSIDAD PRODUCTIVA & ANÁLISIS CRONOLÓGICO
          </p>
        </div>

        {/* Control de Año */}
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="font-black text-xl text-slate-700 min-w-[80px] text-center font-mono tracking-tighter">{year}</span>
          <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* KPI CARDS (RESUMEN INTELIGENTE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

        {/* Mejor Semana */}
        <div className="bg-white border border-slate-200 p-5 rounded-[1.5rem] relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><Award size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded">Top Week</span>
          </div>
          <h4 className="text-3xl font-black text-slate-800">Semana {stats.mejorSemana.numero}</h4>
          <p className="text-xs text-slate-500 mt-1 font-bold">Récord: <span className="text-indigo-600">{stats.mejorSemana.puntos.toFixed(0)} Pts</span></p>
        </div>

        {/* Mejor Día */}
        <div className="bg-white border border-slate-200 p-5 rounded-[1.5rem] relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><TrendingUp size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded">Día de Oro</span>
          </div>
          <h4 className="text-xl font-black text-slate-800 truncate">
            {stats.mejorDia.fecha ? new Date(stats.mejorDia.fecha + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '--'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 font-bold">Máximo: <span className="text-emerald-600">{stats.mejorDia.puntos.toFixed(0)} Pts</span></p>
        </div>

        {/* Peor Día */}
        <div className="bg-white border border-slate-200 p-5 rounded-[1.5rem] relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors"><TrendingDown size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded">Bajo Rendimiento</span>
          </div>
          <h4 className="text-xl font-black text-slate-800 truncate">
            {stats.peorDia.fecha ? new Date(stats.peorDia.fecha + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }) : '--'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 font-bold">Mínimo: <span className="text-amber-600">{stats.peorDia.puntos.toFixed(0)} Pts</span></p>
        </div>

        {/* Días Sin Producción */}
        <div className="bg-white border border-slate-200 p-5 rounded-[1.5rem] relative overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-red-50 rounded-lg text-red-600 group-hover:bg-red-500 group-hover:text-white transition-colors"><AlertTriangle size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-1 rounded">Días Off</span>
          </div>
          <h4 className="text-3xl font-black text-slate-800">{stats.diasSinProd}</h4>
          <p className="text-xs text-slate-500 mt-1 font-bold">Días sin actividad</p>
        </div>

      </div>

      {/* LEYENDA */}
      <div className="flex justify-end gap-3 mb-6 bg-white p-2 rounded-xl border border-slate-200 w-fit ml-auto shadow-sm">
        {[
          { label: '0', color: 'bg-slate-50 border-slate-200' },
          { label: '< 20', color: 'bg-blue-100 border-blue-200' },
          { label: '< 50', color: 'bg-blue-300 border-blue-400' },
          { label: '< 100', color: 'bg-blue-500 border-blue-600' },
          { label: '100+', color: 'bg-indigo-600 border-indigo-700' },
        ].map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${l.color} border`}></div>
            <span className="text-[9px] font-bold text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* GRID CALENDARIO */}
      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white/50 rounded-3xl border border-slate-100 border-dashed">
          <Loader2 className="animate-spin text-blue-500" size={40} />
          <p className="text-xs font-bold uppercase tracking-widest">Calculando Métricas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {MONTHS.map((mes, index) => (
            <div key={mes} className="bg-white border border-slate-200 p-5 rounded-3xl hover:border-blue-300 hover:shadow-lg transition-all group/month">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest group-hover/month:text-blue-600 transition-colors">{mes}</h3>
                <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded">{index + 1}</span>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2 text-center border-b border-slate-100 pb-2">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                  <span key={d} className="text-[8px] font-black text-slate-300">{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {renderMonth(index)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MapaCalor;