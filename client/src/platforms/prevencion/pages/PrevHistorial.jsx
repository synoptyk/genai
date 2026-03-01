import React, { useState, useEffect } from 'react';
import {
    History, Search, Filter, AlertTriangle, CheckCircle2,
    Clock, ShieldCheck, GraduationCap, Loader2, User,
    ChevronRight, Calendar, MapPin
} from 'lucide-react';
import { astApi, charlasApi, incidentesApi } from '../prevencionApi';

const EVENT_CONFIG = {
    'AST': { icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    'Charla': { icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    'Incidente': { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' }
};

const PrevHistorial = () => {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [asts, charlas, incidentes] = await Promise.allSettled([
                astApi.getAll(),
                charlasApi.getAll(),
                incidentesApi.getAll()
            ]);

            const dataAST = asts.status === 'fulfilled' ? (asts.value.data || []) : [];
            const dataChar = charlas.status === 'fulfilled' ? (charlas.value.data || []) : [];
            const dataInc = incidentes.status === 'fulfilled' ? (incidentes.value.data || []) : [];

            const normalized = [
                ...dataAST.map(a => ({
                    id: a._id,
                    fecha: a.createdAt || a.fecha,
                    tipo: 'AST',
                    titulo: `AST: ${a.tipoTrabajo || 'General'}`,
                    responsable: a.supervisorHse || a.usuario?.name || 'Sistema',
                    proyecto: a.proyecto?.nombre || a.proyectoNombre || 'General',
                    estado: a.estado || 'Finalizado',
                    meta: a.empresa || 'Gen AI'
                })),
                ...dataChar.map(c => ({
                    id: c._id,
                    fecha: c.createdAt || c.fecha,
                    tipo: 'Charla',
                    titulo: `Charla: ${c.tema || c.tipo || 'Capacitación'}`,
                    responsable: c.relator || 'No asignado',
                    proyecto: c.proyecto || 'Varios',
                    estado: 'Realizado',
                    meta: `${c.asistentes?.length || 0} Asistentes`
                })),
                ...dataInc.map(i => ({
                    id: i._id,
                    fecha: i.createdAt || i.fecha,
                    tipo: 'Incidente',
                    titulo: i.descripcion || 'Incidente reportado',
                    responsable: i.responsable || 'En revisión',
                    proyecto: i.proyectoId || 'Análisis pendiente',
                    estado: i.estado || 'Abierto',
                    meta: i.prioridad || 'Media'
                }))
            ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            setEventos(normalized);
        } catch (err) {
            console.error('Error fetching historial:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filtered = eventos.filter(ev =>
        ev.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.responsable.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.proyecto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl shadow-slate-200">
                        <History size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Historial <span className="text-rose-600">Preventivo</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-1 uppercase tracking-widest flex items-center gap-2">
                            Trazabilidad Total de Acciones de Seguridad HSE
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-2 flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Eventos</p>
                            <p className="text-sm font-black text-slate-900">{eventos.length}</p>
                        </div>
                        <History size={16} className="text-slate-300" />
                    </div>
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white rounded-3xl border border-slate-200 p-3 mb-6 flex flex-col md:flex-row gap-3 shadow-sm shadow-slate-100">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Filtrar por evento, responsable o proyecto..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-rose-500/5 focus:border-rose-400 rounded-2xl text-xs font-bold outline-none transition-all"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-rose-300 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-600 transition-all">
                    <Filter size={14} /> Filtros Avanzados
                </button>
            </div>

            {/* TIMELINE TABLE */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                {loading ? (
                    <div className="py-32 flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center animate-pulse">
                            <Loader2 size={32} className="text-rose-500 animate-spin" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-bounce">Sincronizando línea de tiempo…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-dashed border-slate-200">
                            <History size={40} className="text-slate-300" />
                        </div>
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">No hay registros aún</h4>
                        <p className="text-slate-400 text-xs mt-2 max-w-xs font-medium">Inicia actividades preventivas para ver la trazabilidad del sistema aquí.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/30">
                                    <th className="px-8 py-5">Cronología</th>
                                    <th className="px-8 py-5">Evento / Tipo</th>
                                    <th className="px-8 py-5">Responsable</th>
                                    <th className="px-8 py-5">Proyecto / Info</th>
                                    <th className="px-8 py-5">Estado</th>
                                    <th className="px-8 py-5 text-center">Detalle</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((ev) => {
                                    const cfg = EVENT_CONFIG[ev.tipo] || EVENT_CONFIG['AST'];
                                    return (
                                        <tr key={`${ev.tipo}-${ev.id}`} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                                        <Calendar size={12} className="text-slate-400" />
                                                        {new Date(ev.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 mt-1 pl-4.5">
                                                        {new Date(ev.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} hrs
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center border ${cfg.border} shadow-sm group-hover:scale-110 transition-transform`}>
                                                        <cfg.icon size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-800 uppercase leading-none tracking-tight">{ev.titulo}</p>
                                                        <p className={`text-[9px] font-black mt-1.5 uppercase tracking-widest pb-0.5 border-b-2 inline-block ${cfg.color} border-current/20`}>{ev.tipo}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 overflow-hidden">
                                                        <User size={14} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600">{ev.responsable}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-black text-slate-500 flex items-center gap-1.5 uppercase">
                                                        <MapPin size={10} /> {ev.proyecto}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 italic">{ev.meta}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${ev.estado === 'Abierto' || ev.estado === 'Crítica' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        ev.estado === 'En Proceso' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`}>
                                                    {ev.estado}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group-hover:shadow-md">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrevHistorial;
