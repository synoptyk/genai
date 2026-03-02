import React, { useState, useEffect } from 'react';

import axios from 'axios';
import {
    Calendar, DollarSign, ChevronLeft, ChevronRight,
    List, TrendingUp
} from 'lucide-react';

const ProduccionVenta = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [stats, setStats] = useState({ total: 0, count: 0, diario: {}, mensual: 0 });
    const [, setLoading] = useState(true);
    const [ordenes, setOrdenes] = useState([]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const res = await axios.get(`http://localhost:5001/api/produccion/mensual?year=${year}&month=${month}`);

            setStats(res.data.stats || { total: 0, count: 0, diario: {}, mensual: 0 });
            setOrdenes(res.data.ordenes || []);
        } catch (e) {
            console.error("Error fetching sales data:", e);
        } finally {
            setLoading(false);
        }
    };

    const money = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val || 0);

    // [MODIFIED] Enhanced Heatmap
    const CalendarHeatMap = () => {
        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

        const generateWeeks = () => {
            const weeks = [];
            let currentWeek = [];
            for (let i = 0; i < startDay; i++) currentWeek.push(null);
            for (let i = 1; i <= totalDays; i++) {
                currentWeek.push(i);
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }
            return weeks;
        };

        const getColorStyles = (stat) => {
            if (!stat || stat.totalVenta === 0) return "bg-slate-50 border-slate-200 hover:shadow-md";
            const v = stat.totalVenta;
            if (v >= 300000) return "bg-white border-emerald-400 shadow-lg shadow-emerald-500/20";
            if (v >= 150000) return "bg-white border-emerald-300";
            return "bg-white border-slate-200";
        };

        const getWeekStats = (week) => {
            let s = { total: 0, zener: 0, comfica: 0 };
            week.forEach(day => {
                if (day) {
                    const key = `${year}-${month}-${day}`;
                    const stat = stats.diario[key];
                    if (stat) {
                        s.total += stat.totalVenta;
                        s.zener += stat.ventaZener || 0;
                        s.comfica += stat.ventaComfica || 0;
                    }
                }
            });
            return s;
        };

        const weeks = generateWeeks();

        return (
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-2xl flex flex-col w-full overflow-hidden mb-8 transition-all hover:shadow-3xl">
                <div className="flex justify-between items-center p-6 border-b border-white/40 bg-gradient-to-r from-white via-slate-50/50 to-white">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-white rounded-2xl shadow-xl shadow-slate-200/50 text-emerald-600">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h3 className="text-slate-800 font-black text-xl tracking-tight">Mapa de Producción Diario</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Desglose Zener vs Comfica</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-2xl p-1 shadow-inner border border-slate-100">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-emerald-600"><ChevronLeft size={18} /></button>
                        <span className="text-xs font-black text-slate-700 w-32 text-center uppercase tracking-widest">{monthNames[month]} {year}</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-emerald-600"><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-b from-transparent to-slate-50/30 overflow-x-auto">
                    <div className="grid grid-cols-8 gap-3 mb-3 min-w-[1000px]">
                        {dayNames.map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{d}</div>)}
                        <div className="text-center text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">TOTAL SEMANA</div>
                    </div>
                    <div className="space-y-4 min-w-[1000px]">
                        {weeks.map((week, wIdx) => {
                            const wTotal = getWeekStats(week);
                            return (
                                <div key={wIdx} className="grid grid-cols-8 gap-4">
                                    {week.map((day, dIdx) => {
                                        const key = `${year}-${month}-${day}`;
                                        const stat = stats.diario[key];
                                        const hasData = stat && stat.totalVenta > 0;
                                        const vZ = stat?.ventaZener || 0;
                                        const pZ = stat?.puntosZener || 0;
                                        const vC = stat?.ventaComfica || 0;
                                        const pC = stat?.puntosComfica || 0;

                                        const totalDaily = vZ + vC;
                                        const pctZ = totalDaily > 0 ? ((vZ / totalDaily) * 100).toFixed(0) : 0;
                                        const pctC = totalDaily > 0 ? ((vC / totalDaily) * 100).toFixed(0) : 0;

                                        return (
                                            <div
                                                key={dIdx}
                                                className={`relative min-h-[110px] p-2 flex flex-col justify-between rounded-2xl border transition-all duration-300 cursor-default group ${day ? getColorStyles(stat) : 'invisible'}`}
                                            >
                                                {day && (
                                                    <>
                                                        <div className="flex justify-between items-start">
                                                            <span className={`text-[10px] font-black opacity-40`}>{day}</span>
                                                            {hasData && (
                                                                <div className="text-right">
                                                                    <span className="text-[9px] font-bold text-slate-300 block">{stat.count} ord</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {hasData ? (
                                                            <div className="space-y-1 mt-1">
                                                                {(vZ > 0 || pZ > 0) && (
                                                                    <div className="bg-purple-50 rounded-lg px-2 py-1 mb-1 border border-purple-100 relative overflow-hidden">
                                                                        <div className="relative z-10 flex justify-between items-center mb-0.5">
                                                                            <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1">
                                                                                ZEN {pctZ}%
                                                                            </span>
                                                                            <span className="text-[9px] font-black text-purple-700">{money(vZ)}</span>
                                                                        </div>
                                                                        <div className="absolute bottom-0 left-0 h-0.5 bg-purple-200" style={{ width: `${pctZ}%` }}></div>
                                                                        {pZ > 0 && (
                                                                            <div className="relative z-10 flex justify-end border-t border-purple-200/50 pt-0.5">
                                                                                <span className="text-[8px] font-bold text-purple-500">{pZ.toFixed(1)} pts</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {(vC > 0 || pC > 0) && (
                                                                    <div className="bg-orange-50 rounded-lg px-2 py-1 border border-orange-100 relative overflow-hidden">
                                                                        <div className="relative z-10 flex justify-between items-center mb-0.5">
                                                                            <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1">
                                                                                COM {pctC}%
                                                                            </span>
                                                                            <span className="text-[9px] font-black text-orange-700">{money(vC)}</span>
                                                                        </div>
                                                                        <div className="absolute bottom-0 left-0 h-0.5 bg-orange-200" style={{ width: `${pctC}%` }}></div>
                                                                        {pC > 0 && (
                                                                            <div className="relative z-10 flex justify-end border-t border-orange-200/50 pt-0.5">
                                                                                <span className="text-[8px] font-bold text-orange-500">{pC.toFixed(1)} pts</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 flex items-center justify-center"><span className="text-slate-100 text-2xl font-black opacity-20">-</span></div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <div className="flex flex-col justify-between bg-white/50 rounded-2xl border border-white/50 shadow-sm p-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase text-center mb-1">Semana {wIdx + 1}</span>
                                        <div className="space-y-1">
                                            {wTotal.zener > 0 && (
                                                <div className="flex justify-between items-center px-1.5 py-0.5 bg-purple-100/50 rounded block">
                                                    <span className="text-[8px] font-black text-purple-400">ZEN</span>
                                                    <span className="text-[9px] font-bold text-purple-700">{money(wTotal.zener)}</span>
                                                </div>
                                            )}
                                            {wTotal.comfica > 0 && (
                                                <div className="flex justify-between items-center px-1.5 py-0.5 bg-orange-100/50 rounded block">
                                                    <span className="text-[8px] font-black text-orange-400">COM</span>
                                                    <span className="text-[9px] font-bold text-orange-700">{money(wTotal.comfica)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-slate-200/50 pt-1 mt-1 text-center">
                                                <span className="block text-xs font-black text-emerald-600 appearance-none">{money(wTotal.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-700">
            {/* 1. Header & Summary Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="p-3 bg-emerald-600 text-white rounded-[24px] shadow-2xl shadow-emerald-200">
                            <TrendingUp size={32} />
                        </div>
                        Producción & Venta
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs mt-3 ml-1 flex items-center gap-2">
                        <DollarSign size={14} className="text-emerald-500" /> Control Financiero Mensual
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white/80 backdrop-blur-md border border-white p-6 rounded-[32px] shadow-xl flex items-center gap-5 transition-transform hover:scale-105 duration-300">
                        <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><DollarSign size={24} /></div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Venta Total Mes</span>
                            <span className="text-2xl font-black text-slate-800">{money(stats.mensual)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Heatmap Display */}
            <CalendarHeatMap />

            {/* 3. Sabana de Ordenes (Detalle) */}
            <div className="bg-white border border-slate-200 rounded-[32px] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                        <List className="text-slate-400" /> Sábana de Órdenes (Cierre Diario)
                    </h3>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Orden</th>
                                <th className="px-6 py-4">Recurso</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4 text-center">Puntos</th>
                                <th className="px-6 py-4 text-right">Ingreso ($)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {ordenes.map(ord => (
                                <tr key={ord._id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-slate-400">{new Date(ord.fecha).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-black text-slate-700">{ord.ordenId}</td>
                                    <td className="px-6 py-4 font-bold text-slate-600">{ord.Recurso}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-lg font-black text-[10px] ${ord.clienteAsociado?.includes('ZENER') ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {ord.clienteAsociado || 'S/I'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold">{ord.puntos}</td>
                                    <td className="px-6 py-4 text-right font-black text-emerald-600">{money(ord.ingreso)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProduccionVenta;
