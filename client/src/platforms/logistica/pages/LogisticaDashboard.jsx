import React, { useState, useEffect } from 'react';
import { 
    Package, 
    Truck, 
    Navigation, 
    AlertTriangle, 
    TrendingUp, 
    ArrowRight,
    MapPin,
    Clock,
    CheckCircle2,
    Archive,
    Trash2,
    RefreshCcw
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const LogisticaDashboard = () => {
    const [stats, setStats] = useState({
        totalStock: 0,
        productosBajoStock: 0,
        mermasHoy: 0,
        activosFijos: 0,
        despachosActivos: 0,
        flotaEnRuta: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [prodRes, despRes, stockRes] = await Promise.all([
                    logisticaApi.get('/productos'),
                    logisticaApi.get('/despachos'),
                    logisticaApi.get('/stock/reporte')
                ]);
                
                const totalS = stockRes.data.reduce((acc, s) => acc + s.cantidadNuevo + s.cantidadUsadoBueno, 0);
                const mermas = stockRes.data.reduce((acc, s) => acc + s.cantidadMerma, 0);
                const activos = prodRes.data.filter(p => p.tipo === 'Activo').length;
                
                // Conteos Inteligentes Reales
                const bodegasMoviles = stockRes.data.reduce((acc, s) => {
                    if (s.almacenRef?.tipo === 'Móvil' || s.almacenRef?.tipo === 'Técnico') {
                        acc.add(s.almacenRef._id);
                    }
                    return acc;
                }, new Set()).size;

                setStats({
                    totalStock: totalS,
                    productosBajoStock: prodRes.data.filter(p => p.stockActual <= p.stockMinimo).length,
                    mermasHoy: mermas,
                    activosFijos: activos,
                    despachosActivos: despRes.data.filter(d => ['PENDIENTE', 'RECOGIDO', 'EN_RUTA'].includes(d.status)).length,
                    flotaEnRuta: despRes.data.filter(d => d.status === 'EN_RUTA').length,
                    bodegasMoviles,
                    reversasPendientes: stockRes.data.reduce((acc, s) => acc + s.cantidadUsadoMalo, 0) // Simboliza equipos por recuperar
                });
            } catch (e) {
                console.error("Error loading logistics stats", e);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const cards = [
        { title: 'Inventario Valorizable', value: stats.totalStock, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50', detail: 'Items nuevos y buenos' },
        { title: 'Activos Fijos', value: stats.activosFijos, icon: Archive, color: 'text-emerald-600', bg: 'bg-emerald-50', detail: 'Equipos y herramientas' },
        { title: 'Mermas & Daños', value: stats.mermasHoy, icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50', detail: 'Pérdidas registradas' },
        { title: 'Alarmas Stock', value: stats.productosBajoStock, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', detail: 'Quiebres inminentes' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Logística Inteligente 360</h1>
                    <p className="text-slate-500 mt-1">Visión total de activos, furgones y bodegas centrales.</p>
                </div>
                <div className="flex gap-2">
                    {/* Botones antiguos eliminados por solicitud del usuario */}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                        <div className="flex items-start justify-between">
                            <div className={`${card.bg} ${card.color} p-3 rounded-2xl`}>
                                <card.icon size={24} />
                            </div>
                            <div className="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${card.color.replace('text', 'bg')} w-2/3 animate-pulse`} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h3 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tighter tabular-nums">
                                {loading ? '...' : card.value}
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                                {card.title}
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                                <span>{card.detail}</span>
                                <TrendingUp size={14} className="text-emerald-500" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Dispatches Area (Simplified for context) */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Truck size={20} className="text-indigo-600" />
                            Distribución en Movimiento
                        </h2>
                        <button className="text-xs font-bold text-indigo-600 hover:underline">Ver mapa flota</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Bodegas Móviles (Furgones)</p>
                            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{loading ? '...' : stats.bodegasMoviles}</h4>
                            <p className="text-xs text-slate-500 mt-1 font-bold">Unidades con inventario</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Equipos x Recuperar</p>
                            <h4 className="text-2xl font-black text-rose-600 tracking-tight">{loading ? '...' : stats.reversasPendientes}</h4>
                            <p className="text-xs text-slate-500 mt-1 font-bold">Items en estado Usado Malo</p>
                        </div>
                    </div>
                </div>

                {/* Intelligent Insights Area */}
<div className="bg-slate-900 rounded-3xl p-5 sm:p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 text-indigo-400">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-2xl font-bold mb-2 tracking-tight">Logística Predictiva</h3>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            Se detecta un incremento en <span className="text-white font-bold italic">Mermas</span> en la Bodega Norte. Se recomienda auditoría de procesos de recepción.
                        </p>
                        
                        <div className="space-y-4">
                             <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                                <div className="flex items-center gap-3 mb-2">
                                    <CheckCircle2 size={16} className="text-emerald-400" />
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Optimización</span>
                                </div>
                                <p className="text-sm">Traspasar 50u de Router a Furgón-04 (Técnico González)</p>
                             </div>
                        </div>
                    </div>

                    <button className="w-full mt-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all relative z-10 active:scale-95 shadow-xl shadow-black/20">
                        Sugerir Movimientos
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogisticaDashboard;
