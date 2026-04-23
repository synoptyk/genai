import React, { useState, useEffect } from 'react';
import { 
    Users, ShieldCheck, ClipboardList, BarChart3, 
    ArrowLeft, Loader2, Search, TrendingUp, AlertTriangle,
    CheckCircle2, Mail, User, Shield
} from 'lucide-react';
import api from '../../../api/api';

const SupervisorHseProgress = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchProgress();
    }, []);

    const fetchProgress = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/prevencion/dashboard/supervisors-progress');
            setData(res.data || []);
        } catch (error) {
            console.error("Error loading supervisors progress:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(sup => 
        sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sup.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalInspecciones = data.reduce((acc, curr) => acc + curr.stats.totalInspecciones, 0);
    const totalAsts = data.reduce((acc, curr) => acc + curr.stats.astsHoy, 0);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Cargando avance de supervisión...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto p-6 md:p-10 space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                        Avance <span className="text-rose-600">Supervisores</span>
                    </h1>
                    <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px] mt-2 italic">
                        Módulo de Control Gerencial HSE & Operaciones
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Inspecciones</p>
                        <p className="text-2xl font-black text-slate-900">{totalInspecciones}</p>
                    </div>
                    <div className="bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ASTs Firmados Hoy</p>
                        <p className="text-2xl font-black text-rose-600">{totalAsts}</p>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-slate-300" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o email del supervisor..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-rose-500/10 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={fetchProgress} className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-rose-600 transition-all">
                    <TrendingUp size={20} />
                </button>
            </div>

            {/* Table / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.map((sup) => (
                    <div key={sup.id} className="group bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-rose-100 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-rose-50 transition-colors" />
                        
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-xl group-hover:bg-rose-600 transition-colors">
                                    {sup.name.charAt(0)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-lg font-black text-slate-900 uppercase truncate tracking-tight">{sup.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest border border-slate-200">
                                            {sup.role?.replace('_', ' ')}
                                        </span>
                                        <p className="text-[10px] font-bold text-slate-400 truncate">{sup.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-rose-100 transition-colors">
                                    <div className="flex items-center gap-2 text-rose-500 mb-1">
                                        <ShieldCheck size={14} />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Inspecciones</p>
                                    </div>
                                    <p className="text-xl font-black text-slate-800">{sup.stats.totalInspecciones}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                        {sup.stats.inspeccionesEPP} EPP / {sup.stats.inspeccionesCumplimiento} Cump.
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 group-hover:border-rose-100 transition-colors">
                                    <div className="flex items-center gap-2 text-indigo-500 mb-1">
                                        <Shield size={14} />
                                        <p className="text-[9px] font-black uppercase tracking-widest">ASTs Equipo</p>
                                    </div>
                                    <p className="text-xl font-black text-slate-800">{sup.stats.astsHoy}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                                        Firmados hoy de {sup.tecnicosCount} técnicos
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${sup.stats.astsHoy >= sup.tecnicosCount && sup.tecnicosCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado de cumplimiento</p>
                                </div>
                                <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${sup.stats.astsHoy >= sup.tecnicosCount ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                                        style={{ width: `${sup.tecnicosCount > 0 ? (sup.stats.astsHoy / sup.tecnicosCount) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredData.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-white border border-slate-100 rounded-[3rem] shadow-sm">
                        <User className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs italic">No se encontraron supervisores con esos criterios</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupervisorHseProgress;
