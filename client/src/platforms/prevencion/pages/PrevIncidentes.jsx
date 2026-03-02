import React, { useState, useEffect } from 'react';
import {
    AlertTriangle, Search, Plus, Filter, ShieldAlert, Eye,
    FileWarning, Loader2, User, ChevronRight,
    CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { incidentesApi } from '../prevencionApi';

const STATUS_COLORS = {
    'Abierto': 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    'En Proceso': 'bg-amber-500/10 text-amber-600 border-amber-200',
    'Cerrado': 'bg-slate-500/10 text-slate-600 border-slate-200'
};

const PRIORITY_COLORS = {
    'Baja': 'text-blue-500',
    'Media': 'text-amber-500',
    'Alta': 'text-rose-500',
    'Crítica': 'bg-rose-600 text-white px-2 py-0.5 rounded-lg animate-pulse'
};

const PrevIncidentes = () => {
    const [incidentes, setIncidentes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter] = useState({ estado: '', prioridad: '' });

    const fetchIncidentes = async () => {
        try {
            setLoading(true);
            const res = await incidentesApi.getAll();
            setIncidentes(res.data || []);
        } catch (err) {
            console.error('Error fetching incidentes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidentes();
    }, []);

    const filtered = incidentes.filter(inc => {
        if (filter.estado && inc.estado !== filter.estado) return false;
        if (filter.prioridad && inc.prioridad !== filter.prioridad) return false;
        return true;
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-rose-600 text-white p-3.5 rounded-2xl shadow-lg shadow-rose-200 transform hover:rotate-6 transition-transform">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Investigación de <span className="text-rose-600">Incidentes</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-1 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert size={12} className="text-rose-400" /> Control de Hallazgos y Desvíos Críticos
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-white border border-slate-200 hover:border-rose-400 text-slate-600 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-sm">
                        <Filter size={14} /> Filtros
                    </button>
                    <button className="flex items-center gap-2 bg-slate-900 border-2 border-slate-900 hover:bg-rose-600 hover:border-rose-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 group">
                        <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Reportar Incidente
                    </button>
                </div>
            </div>

            {/* STATS MINI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abiertos / Críticos</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{incidentes.filter(i => i.estado === 'Abierto').length} <span className="text-rose-500">/ {incidentes.filter(i => i.prioridad === 'Crítica').length}</span></p>
                    </div>
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                        <AlertCircle size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En Proceso</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{incidentes.filter(i => i.estado === 'En Proceso').length}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                        <Clock size={24} />
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cerrados (Mes)</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{incidentes.filter(i => i.estado === 'Cerrado').length}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={24} />
                    </div>
                </div>
            </div>

            {/* LIST */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                        <FileWarning size={16} className="text-rose-500" /> Registro Maestro de Incidentes
                    </h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por descripción..."
                            className="bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all w-64 font-bold"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="animate-spin text-rose-500" size={32} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando incidentes...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center px-6">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-dashed border-slate-200">
                            <ShieldAlert size={40} className="text-slate-300" />
                        </div>
                        <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">No se registran incidentes</h4>
                        <p className="text-slate-400 text-xs mt-2 max-w-xs font-medium">Todos los procesos están operando bajo los parámetros de seguridad establecidos.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                                    <th className="px-6 py-4">Fecha / ID</th>
                                    <th className="px-6 py-4">Descripción / Hallazgo</th>
                                    <th className="px-6 py-4">Prioridad</th>
                                    <th className="px-6 py-4">Responsable</th>
                                    <th className="px-6 py-4">Estado</th>
                                    <th className="px-6 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((inc) => (
                                    <tr key={inc._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-700">{new Date(inc.createdAt).toLocaleDateString('es-CL')}</span>
                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">#{inc._id.slice(-6).toUpperCase()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 max-w-xs">
                                            <p className="text-xs font-bold text-slate-600 line-clamp-2 leading-relaxed">{inc.descripcion}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className={`text-[10px] font-black uppercase tracking-widest ${PRIORITY_COLORS[inc.prioridad] || 'text-slate-500'}`}>
                                                {inc.prioridad}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                                                    <User size={14} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-600">{inc.responsable || 'No asignado'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_COLORS[inc.estado] || 'bg-slate-50 text-slate-400'}`}>
                                                {inc.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center gap-2">
                                                <button className="p-2 bg-white border border-slate-200 rounded-xl hover:border-rose-400 hover:text-rose-500 transition-all shadow-sm">
                                                    <Eye size={14} />
                                                </button>
                                                <button className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PrevIncidentes;
