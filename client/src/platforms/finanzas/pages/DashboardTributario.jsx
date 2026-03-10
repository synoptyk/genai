import React, { useState, useEffect } from 'react';
import API_URL from '../../../config';
import {
    Calculator, TrendingUp, TrendingDown, Calendar, ArrowRight,
    FileText, ArrowDownToLine, ArrowUpFromLine, RefreshCcw, Landmark,
    AlertCircle, FileBarChart2, Coins, ChevronDown, CheckCircle2,
    Users, PieChart as PieChartIcon, Award
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#F43F5E', '#8B5CF6'];

const DashboardTributario = () => {
    const { user } = useAuth();
    const now = new Date();
    const [periodo, setPeriodo] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [chartData, setChartData] = useState([]);
    const [documentosData, setDocumentosData] = useState([]);
    const [resumenPeriodo, setResumenPeriodo] = useState({
        ventasNetas: 0, comprasNetas: 0, ivaDebito: 0,
        ivaCredito: 0, ivaAPagar: 0, ppm: 0, totalPagarF29: 0
    });
    const [topProveedores, setTopProveedores] = useState([]);
    const [distribucionGastos, setDistribucionGastos] = useState([]);
    const [isRealData, setIsRealData] = useState(false);
    const [rpaError, setRpaError] = useState(null);
    const [lastSyncText, setLastSyncText] = useState(`Hoy, ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs`);

    const fetchDatosRCV = async () => {
        setIsRefreshing(true);
        try {
            if (!user || !user.token) return;
            const res = await fetch(`${API_URL}/api/admin/sii/rcv`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setChartData(data.chartData || []);
                setResumenPeriodo(data.resumen || { ventasNetas: 0, comprasNetas: 0, ivaDebito: 0, ivaCredito: 0, ivaAPagar: 0, ppm: 0, totalPagarF29: 0 });
                setDocumentosData(data.documentos || []);
                setTopProveedores(data.topProveedores || []);
                setDistribucionGastos(data.distribucionGastos || []);
                setIsRealData(data.isRealData || false);
                setRpaError(data.rpaError || null);
                setLastSyncText(`Hoy, ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs`);
            }
        } catch (e) {
            console.error("Error al obtener datos reales RCV", e);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDatosRCV();
    }, []);

    const handleRefresh = () => {
        fetchDatosRCV();
    };

    const formatCLP = (value) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-md p-4 bg-white border border-slate-200 shadow-xl rounded-2xl">
                    <p className="text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-6 mb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: entry.color }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                {entry.name}
                            </span>
                            <span className="text-xs font-black tabular-nums text-slate-800">{formatCLP(entry.value)}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full max-w-7xl mx-auto pb-24">

            {/* ── ENCABEZADO Y CONTROLES ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-2">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shadow-inner">
                            <Landmark size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Análisis Tributario</h1>
                    </div>
                    <p className="text-slate-500 font-semibold text-sm max-w-xl">
                        Datos sincronizados automáticamente desde tu Registro de Compras y Ventas (RCV) del SII. Las cifras mostradas son valores NETOS reales facturados.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white p-2 border border-slate-200 rounded-2xl shadow-sm">
                    <div className="relative">
                        <select
                            value={periodo}
                            onChange={(e) => setPeriodo(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100 text-sm font-black text-slate-700 rounded-xl border-none outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition-colors"
                        >
                            <option value="2026-06">Junio 2026</option>
                            <option value="2026-05">Mayo 2026</option>
                            <option value="2026-04">Abril 2026</option>
                            <option value="2026-03">Marzo 2026</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">{isRefreshing ? 'Consultando SII...' : 'Forzar Sinc.'}</span>
                    </button>
                </div>
            </div>

            {/* ── ESTADO ÚLTIMA SINCRONIZACIÓN ── */}
            {rpaError && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 flex items-start gap-4 animate-in slide-in-from-top-4 duration-500">
                    <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Error de Sincronización SII</p>
                        <p className="text-sm font-semibold text-rose-700/80">{rpaError}</p>
                        <p className="text-[10px] font-bold text-rose-500 mt-2">
                            Asegúrate de que el RUT y Clave seleccionados en "Configuración &gt; Integraciones" sean correctos y tengan permisos de administrador en el SII.
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-8">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                        <span>{isRealData ? "Robot SII Conectado" : "Datos de Simulación (Modo Demo)"}</span>
                        <span className="text-emerald-500/50">|</span>
                        <span className={isRealData ? "text-emerald-700/80" : "text-amber-600/80"}>Última lectura: {lastSyncText}</span>
                    </p>
                </div>
                <div className={`hidden md:flex items-center gap-2 text-[10px] font-black px-3 py-1.5 rounded-lg border ${isRealData ? 'text-emerald-600 bg-emerald-100/50 border-emerald-200/50' : 'text-amber-600 bg-amber-100/50 border-amber-200/50'}`}>
                    <CheckCircle2 size={14} /> {isRealData ? "EXTRACTOR RCV ACTIVO" : "MODO DEMOSTRACIÓN"}
                </div>
            </div>

            {/* ── TARJETAS DE RESUMEN TRIBUTARIO (KPIs) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {/* Ventas Netas */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-150 transition-transform duration-500 -z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                                <ArrowUpFromLine size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                                <TrendingUp size={12} /> +12.5%
                            </span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Ventas (Neto)</p>
                        <h3 className="text-2xl font-black text-slate-800 tabular-nums">{formatCLP(resumenPeriodo.ventasNetas)}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                            <FileText size={12} /> 1,451 Documentos Emitidos
                        </p>
                    </div>
                </div>

                {/* Compras Netas */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-150 transition-transform duration-500 -z-0"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                                <ArrowDownToLine size={20} />
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                                <TrendingDown size={12} /> -5.2%
                            </span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Compras (Neto)</p>
                        <h3 className="text-2xl font-black text-slate-800 tabular-nums">{formatCLP(resumenPeriodo.comprasNetas)}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-3">
                            <FileText size={12} /> 157 Documentos Recibidos
                        </p>
                    </div>
                </div>

                {/* IVA a Pagar Calculado */}
                <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden lg:col-span-2">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center text-indigo-400 backdrop-blur-sm">
                                    <Calculator size={20} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-0.5">Proyección Formulario 29</p>
                                    <h3 className="text-3xl font-black tabular-nums">{formatCLP(resumenPeriodo.totalPagarF29)}</h3>
                                </div>
                            </div>
                            <span className="text-[9px] font-black text-slate-900 bg-emerald-400 px-3 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                                IVA a Pagar
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/10">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">IVA Débito (Ventas)</p>
                                <p className="text-sm font-bold text-emerald-400 tabular-nums">+{formatCLP(resumenPeriodo.ivaDebito)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">IVA Crédito (Compras)</p>
                                <p className="text-sm font-bold text-rose-400 tabular-nums">-{formatCLP(resumenPeriodo.ivaCredito)}</p>
                            </div>
                            <div className="pl-4 border-l border-white/10">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">PPM Obligatorio</p>
                                <p className="text-sm font-bold text-indigo-300 tabular-nums">+{formatCLP(resumenPeriodo.ppm)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── GRAFICO EVOLUTIVO RCV ── */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Evolución Histórica RCV
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Comparativa Ventas vs Compras Netas (Últimos 6 Meses)</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-200 shadow-sm"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Ventas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-rose-500 border-2 border-rose-200 shadow-sm"></div>
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">Compras</span>
                        </div>
                    </div>
                </div>

                <div className="h-[320px] w-full ml-[-20px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={320}>
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCompras" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
                                tickFormatter={(value) => `$${value / 1000000}M`}
                                dx={-10}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                            <Area type="monotone" dataKey="compras" name="Compras" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorCompras)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── ANALÍTICA AVANZADA ERP ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                {/* 1. Distribución de Gastos (Pie Chart) */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm lg:col-span-1">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1">
                        <PieChartIcon size={22} className="text-indigo-500" /> Distribución
                    </h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Categorización de Egresos</p>

                    <div className="h-[220px] w-full relative">
                        {isRealData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distribucionGastos}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {distribucionGastos.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatCLP(value)}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full w-full bg-slate-50 rounded-2xl border border-dashed border-slate-200 overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-slate-100/50"></div>
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest z-10 flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    Sin Datos RPA
                                </p>
                            </div>
                        )}
                        {/* Center text overlay */}
                        {isRealData && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
                                <span className="text-sm font-black text-slate-800">{formatCLP(resumenPeriodo.comprasNetas)}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 space-y-3">
                        {distribucionGastos.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}></div>
                                    <span className="font-bold text-slate-600">{item.name}</span>
                                </div>
                                <span className="font-black text-slate-800 tabular-nums">{formatCLP(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. Top Proveedores */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm lg:col-span-2 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1">
                                <Award size={22} className="text-emerald-500" /> Mayores Proveedores
                            </h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ranking de Compras Netas (Top 5)</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Users size={24} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Rk</th>
                                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">RUT / Razón Social</th>
                                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Vol. Compras</th>
                                    <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right w-28">Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {topProveedores.map((prov, i) => (
                                    <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="py-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shadow-sm ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                                                {i + 1}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <p className="text-sm font-black text-slate-800">{prov.nombre}</p>
                                            <p className="text-[11px] font-bold text-slate-400">{prov.rut}</p>
                                        </td>
                                        <td className="py-4 text-right">
                                            <p className="text-sm font-black text-emerald-600 tabular-nums">{formatCLP(prov.compras)}</p>
                                        </td>
                                        <td className="py-4 pl-4 pr-2">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${prov.porcentaje}%` }}></div>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-600 w-8 text-right block">{prov.porcentaje}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {topProveedores.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="py-10 text-center text-sm font-bold text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 mt-4">
                                            <div className="flex flex-col items-center justify-center">
                                                <AlertCircle size={24} className="text-slate-300 mb-2" />
                                                <p>No hay proveedores registrados. Conecte su ERP.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── DETALLE POR TIPO DE DOCUMENTO ── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <FileBarChart2 size={22} className="text-indigo-500" /> Detalle de Documentos
                        </h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Desglose según tipos de Documentos Tributarios Electrónicos (DTE) del mes.
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Tipo de Documento</th>
                                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-emerald-50/50" colSpan="2">Emitidos (Ventas)</th>
                                <th className="py-5 px-8 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-rose-50/50" colSpan="2">Recibidos (Compras)</th>
                            </tr>
                            <tr className="bg-slate-50/50 border-b border-slate-200/60 shadow-sm shadow-slate-200/20">
                                <th className="py-3 px-8 text-[9px] font-bold text-slate-400 uppercase border-r border-slate-200">Código SII</th>
                                <th className="py-3 px-8 text-[9px] font-bold text-slate-400 uppercase bg-emerald-50/30">Cantidad</th>
                                <th className="py-3 px-8 text-[9px] font-bold text-slate-400 uppercase bg-emerald-50/30 text-right">Monto Neto</th>
                                <th className="py-3 px-8 text-[9px] font-bold text-slate-400 uppercase border-l border-slate-200 bg-rose-50/30">Cantidad</th>
                                <th className="py-3 px-8 text-[9px] font-bold text-slate-400 uppercase bg-rose-50/30 text-right">Monto Neto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {documentosData.map((doc, i) => (
                                <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                    <td className="py-4 px-8 border-r border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                                <FileText size={14} />
                                            </div>
                                            <span className="text-sm font-black text-slate-700">{doc.tipo}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-8 text-sm font-bold text-slate-600 tabular-nums">
                                        {doc.emitidas > 0 ? doc.emitidas : '-'}
                                    </td>
                                    <td className="py-4 px-8 text-sm font-black text-emerald-600 tabular-nums text-right">
                                        {doc.montoEmitido !== 0 ? formatCLP(doc.montoEmitido) : '-'}
                                    </td>
                                    <td className="py-4 px-8 text-sm font-bold text-slate-600 tabular-nums border-l border-slate-100">
                                        {doc.recibidas > 0 ? doc.recibidas : '-'}
                                    </td>
                                    <td className="py-4 px-8 text-sm font-black text-rose-600 tabular-nums text-right">
                                        {doc.montoRecibido !== 0 ? formatCLP(doc.montoRecibido) : '-'}
                                    </td>
                                </tr>
                            ))}
                            {/* Fila Total */}
                            <tr className="bg-slate-50 border-t-2 border-slate-200">
                                <td className="py-5 px-8 border-r border-slate-200">
                                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Totales Período</span>
                                </td>
                                <td className="py-5 px-8 text-lg font-black text-slate-800 tabular-nums bg-emerald-50/30">
                                    1,451
                                </td>
                                <td className="py-5 px-8 text-lg font-black text-emerald-600 tabular-nums bg-emerald-50/30 text-right">
                                    {formatCLP(resumenPeriodo.ventasNetas)}
                                </td>
                                <td className="py-5 px-8 text-lg font-black text-slate-800 tabular-nums border-l border-slate-200 bg-rose-50/30">
                                    157
                                </td>
                                <td className="py-5 px-8 text-lg font-black text-rose-600 tabular-nums bg-rose-50/30 text-right">
                                    {formatCLP(resumenPeriodo.comprasNetas)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default DashboardTributario;
