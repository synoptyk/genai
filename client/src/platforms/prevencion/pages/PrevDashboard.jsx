import React, { useState, useEffect } from 'react';
import {
    ShieldAlert, CheckCircle2,
    Users, Activity, Bell, Calendar, MapPin, ArrowUpRight, ArrowDownRight,
    Trophy, Zap, LayoutDashboard
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';

const PrevDashboard = () => {
    // Mock Data para el Dashboard v5.0
    const weeklyData = [
        { name: 'Lunes', ast: 45, charlas: 12, incidentes: 0 },
        { name: 'Martes', ast: 52, charlas: 15, incidentes: 1 },
        { name: 'Miércoles', ast: 38, charlas: 10, incidentes: 0 },
        { name: 'Jueves', ast: 65, charlas: 18, incidentes: 0 },
        { name: 'Viernes', ast: 48, charlas: 14, incidentes: 2 },
        { name: 'Sábado', ast: 20, charlas: 5, incidentes: 0 },
        { name: 'Domingo', ast: 15, charlas: 4, incidentes: 0 },
    ];

    const riskDistribution = [
        { name: 'Eléctrico', value: 35, color: '#f43f5e' },
        { name: 'Altura', value: 25, color: '#fb923c' },
        { name: 'Mecánico', value: 20, color: '#facc15' },
        { name: 'Ergonómico', value: 20, color: '#2dd4bf' },
    ];



    const [scrolled, setScrolled] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-full bg-slate-50/30 p-4 md:p-8 pb-32">
            {/* TOP HEADER - STICKY LOOK */}
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 transition-all ${scrolled ? 'bg-white/80 backdrop-blur-xl p-4 -mx-4 rounded-b-3xl sticky top-0 z-50 shadow-sm' : ''}`}>
                <div className="flex items-center gap-4 text-left">
                    <div className="bg-slate-900 text-white p-4 rounded-[1.5rem] shadow-2xl shadow-slate-200 rotate-3 group-hover:rotate-0 transition-transform">
                        <LayoutDashboard size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Command <span className="text-rose-600">Center HSE</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.3em]">Inteligencia Operativa y Control de Riesgos v5.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                        <Calendar size={18} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-600 uppercase">Feb 2026 - Hoy</span>
                    </div>
                    <button className="bg-rose-600 text-white p-4 rounded-2xl shadow-lg shadow-rose-100 hover:scale-105 transition-all">
                        <Bell size={20} />
                    </button>
                </div>
            </div>

            {/* KEY METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 text-left">
                {[
                    { label: 'Cumplimiento AST', val: '94.2%', change: '+2.4%', up: true, icon: CheckCircle2, color: 'rose' },
                    { label: 'Indice de Frecuencia', val: '1.02', change: '-12%', up: false, icon: Activity, color: 'emerald' },
                    { label: 'Hallazgos Críticos', val: '04', change: 'Pendientes', up: null, icon: ShieldAlert, color: 'amber' },
                    { label: 'Cobertura Charlas', val: '88%', change: '+5.1%', up: true, icon: Users, color: 'blue' },
                ].map((m, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${m.color}-50 rounded-bl-[5rem] -mr-8 -mt-8 opacity-40 group-hover:scale-110 transition-transform`} />
                        <div className="relative z-10">
                            <div className={`bg-slate-900 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:bg-rose-600 transition-colors`}>
                                <m.icon size={24} />
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">{m.val}</h3>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
                                {m.up !== null && (
                                    <span className={`flex items-center gap-1 text-[9px] font-bold ${m.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {m.up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {m.change}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 text-left">
                {/* BIG TREND CHART */}
                <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] italic">Curva de Productividad Segura</h3>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Comparativa Semanal: AST vs Charlas de 5 Min</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                <span className="text-[8px] font-black uppercase text-slate-400">AST</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-900"></div>
                                <span className="text-[8px] font-black uppercase text-slate-400">Charlas</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        {isMounted && (
                            <ResponsiveContainer width="100%" height={320}>
                                <AreaChart data={weeklyData}>
                                    <defs>
                                        <linearGradient id="colorAst" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8' }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                                        itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                                    />
                                    <Area type="monotone" dataKey="ast" stroke="#f43f5e" strokeWidth={4} fillOpacity={1} fill="url(#colorAst)" />
                                    <Area type="monotone" dataKey="charlas" stroke="#0f172a" strokeWidth={4} fillOpacity={0} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* RISK DISTRIBUTION PIE */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col items-center">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] italic mb-10 w-full">Mapa de Criticidad</h3>
                    <div className="h-64 w-full relative">
                        {isMounted && (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={riskDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {riskDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <ShieldAlert className="text-rose-600 mb-1" size={24} />
                            <span className="text-[10px] font-black text-slate-900 leading-none">ALTA</span>
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Riesgos</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full mt-8">
                        {riskDistribution.map((r, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }}></div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase text-slate-400">{r.name}</span>
                                    <span className="text-[10px] font-black text-slate-900">{r.value}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* LOWER SECTION: HALLAZGOS & FEED */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
                {/* RECENT ACTIONS FEED */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-4 mb-2">
                        <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Actividad Reciente en Terreno</h3>
                        <button className="text-[9px] font-black text-rose-600 uppercase tracking-widest hover:underline">Ver Todo</button>
                    </div>
                    {[
                        { type: 'AST', user: 'MARCO POLO', location: 'CERRO NAVIA', time: 'hace 5 min', status: 'Validado' },
                        { type: 'CHARLA', user: 'ELENA RIVAS', location: 'SANTIAGO CENTRO', time: 'hace 12 min', status: 'Firmado' },
                        { type: 'PTS', user: 'PEDRO SOTO', location: 'LAS CONDES', time: 'hace 24 min', status: 'En Trámite' },
                        { type: 'AST', user: 'JULIA CANO', location: 'VALPARAISO', time: 'hace 45 min', status: 'Validado' },
                    ].map((item, i) => (
                        <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors shadow-sm group">
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[10px] ${item.type === 'AST' ? 'bg-rose-50 text-rose-600' : 'bg-slate-900 text-white'}`}>
                                    {item.type}
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-black text-slate-900 uppercase">{item.user}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <MapPin size={10} className="text-slate-400" />
                                        <span className="text-[8px] font-black text-slate-400 uppercase">{item.location} • {item.time}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-2 rounded-full text-[8px] font-black uppercase ${item.status === 'Validado' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100 italic'}`}>
                                    {item.status}
                                </span>
                                <button className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-all">
                                    <ArrowUpRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CRITICAL ACTIONS CARDS */}
                <div className="space-y-6">
                    <div className="bg-slate-900 p-8 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
                        <Zap className="text-rose-500 mb-6" size={32} />
                        <h4 className="text-xl font-black uppercase italic tracking-tighter mb-2">Reto de <span className="text-rose-500">Seguridad</span></h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Meta Mensual de Incidentes Cero</p>

                        <div className="relative h-2 bg-slate-800 rounded-full mb-3 overflow-hidden">
                            <div className="absolute top-0 left-0 h-full bg-rose-500 w-[75%] rounded-full shadow-lg shadow-rose-500/50" />
                        </div>
                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                            <span>Día 22 de 28</span>
                            <span className="text-white">75% Completado</span>
                        </div>
                    </div>

                    <div className="bg-emerald-600 p-8 rounded-[3rem] text-white relative overflow-hidden group shadow-2xl">
                        <Trophy className="text-emerald-300 mb-6 group-hover:scale-125 transition-transform" size={32} />
                        <h4 className="text-lg font-black uppercase tracking-tighter mb-1 leading-none">HSE Leaderboard</h4>
                        <p className="text-[8px] font-black text-emerald-100 uppercase tracking-widest mb-6">Top Prevencionista del Mes</p>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black text-[12px]">MS</div>
                            <div>
                                <p className="text-[10px] font-black uppercase">Mauricio Soto</p>
                                <p className="text-[8px] font-bold text-emerald-200 uppercase">99.8% Compliance</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrevDashboard;
