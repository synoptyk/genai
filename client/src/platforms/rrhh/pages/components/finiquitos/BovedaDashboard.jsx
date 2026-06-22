import React, { useState, useMemo } from 'react';
import { Users, FileText, AlertCircle, Building2, Search, Loader2, Bell, Landmark, Briefcase, MapPin } from 'lucide-react';
import SearchableSelect from '../../../../../components/SearchableSelect';
import { formatRut } from '../../../../../utils/rutUtils';

const BovedaDashboard = ({ bovedaEmployees = [], bovedaLoading = false, projects = [], onOpenFiniquito }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterProj, setFilterProj] = useState('');

    const cecos = useMemo(() => [...new Set(bovedaEmployees.map(e => e.ceco).filter(Boolean))], [bovedaEmployees]);

    const filtered = useMemo(() => bovedaEmployees.filter(e => {
        const term = searchTerm.toLowerCase();
        const cleanSearch = searchTerm.replace(/[^0-9kK]/gi, '');
        const cleanRut = e.rut ? e.rut.replace(/[^0-9kK]/gi, '') : '';
        const matchSearch = !searchTerm ||
            e.fullName?.toLowerCase().includes(term) ||
            (cleanSearch && cleanRut.includes(cleanSearch)) ||
            e.position?.toLowerCase().includes(term);
        const matchCeco = !filterCeco || e.ceco === filterCeco;
        const matchProj = !filterProj ||
            e.projectName === filterProj ||
            (e.projectId?.toString() === filterProj);
        return matchSearch && matchCeco && matchProj;
    }), [bovedaEmployees, searchTerm, filterCeco, filterProj]);

    const stats = [
        {
            label: 'Total Bajas', icon: Users,
            value: bovedaEmployees.length,
            color: 'from-violet-500 to-violet-700', sub: 'histórico'
        },
        {
            label: 'Finiquitados', icon: FileText,
            value: bovedaEmployees.filter(e => ['FINIQUITADO', 'DE BAJA'].includes(e.status?.toUpperCase())).length,
            color: 'from-slate-500 to-slate-700', sub: 'desvinculados'
        },
        {
            label: 'Rechazados', icon: AlertCircle,
            value: bovedaEmployees.filter(e => e.status?.toUpperCase() === 'RECHAZADO').length,
            color: 'from-rose-500 to-rose-700', sub: 'proceso fallido'
        },
        {
            label: 'Retirados', icon: Building2,
            value: bovedaEmployees.filter(e => e.status?.toUpperCase() === 'RETIRADO').length,
            color: 'from-amber-500 to-amber-600', sub: 'abandono'
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {stats.map((s, i) => (
                    <div key={i} className={`bg-gradient-to-br ${s.color} p-6 rounded-[2rem] text-white shadow-lg`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 bg-white/20 rounded-xl"><s.icon size={18} /></div>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">{s.label}</span>
                        </div>
                        <p className="text-4xl font-black tracking-tight">{s.value}</p>
                        <p className="text-[9px] mt-1 opacity-70 font-bold">{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="filter-bar bg-white border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-3 shadow-sm">
                <div className="relative flex-1 min-w-full sm:min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, RUT, cargo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                </div>
                <div className="flex-1 sm:flex-none w-full sm:w-[200px] z-50">
                    <SearchableSelect
                        value={filterCeco}
                        onChange={val => setFilterCeco(val)}
                        placeholder="CECOs"
                        options={[
                            { value: '', label: 'Todos los CECOs' },
                            ...cecos.map(c => ({ value: c, label: c }))
                        ]}
                    />
                </div>
                <div className="flex-1 sm:flex-none w-full sm:w-[200px] z-50">
                    <SearchableSelect
                        value={filterProj}
                        onChange={val => setFilterProj(val)}
                        placeholder="Proyectos"
                        options={[
                            { value: '', label: 'Todos los proyectos' },
                            ...projects.map(p => ({ value: p.id, label: p.name }))
                        ]}
                    />
                </div>
                <div className="flex items-center justify-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black text-slate-500">
                    <Users size={12} /> {filtered.length} mostrando
                </div>
            </div>

            {/* Employee Cards */}
            <div className="bg-white rounded-xl sm:rounded-[2rem] border border-slate-100 p-4 sm:p-6 shadow-sm">
                {bovedaLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="animate-spin text-violet-500 mb-3" size={32} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando bóveda...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Users size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-bold">No hay personal que coincida con los filtros</p>
                        <p className="text-xs text-slate-400 mt-2">Los candidatos dados de baja aparecerán aquí</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map(emp => (
                            <div
                                key={emp._id}
                                onClick={() => onOpenFiniquito && onOpenFiniquito(emp)}
                                className={`p-5 bg-white border-2 rounded-2xl transition-all group hover:shadow-md relative cursor-pointer ${
                                    emp.alerts === 2 ? 'border-red-200 hover:border-red-400' :
                                    emp.alerts === 1 ? 'border-amber-200 hover:border-amber-400' :
                                    'border-slate-100 hover:border-emerald-200'
                                }`}
                            >
                                {/* Avatar + Name */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 font-black text-lg shadow-inner overflow-hidden flex-shrink-0">
                                        {emp.profilePic
                                            ? <img src={emp.profilePic} alt="" className="w-full h-full object-cover" />
                                            : emp.fullName?.charAt(0)
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-[11px] font-black text-slate-800 tracking-tight block leading-tight truncate">{emp.fullName}</h4>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block font-mono">
                                            RUT: {emp.rut ? formatRut(emp.rut) : 'N/D'}
                                        </div>
                                    </div>
                                </div>

                                {/* Tags */}
                                {(emp.ceco || emp.projectName || emp.area || emp.depto || emp.sede) && (
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {emp.ceco && (
                                            <span className="flex items-center gap-1 text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                                                <Landmark size={8} /> {emp.ceco}
                                            </span>
                                        )}
                                        {emp.projectName && (
                                            <span className="flex items-center gap-1 text-[8px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-full border border-teal-100 max-w-full truncate">
                                                <Building2 size={8} /> {emp.projectName}
                                            </span>
                                        )}
                                        {emp.area && (
                                            <span className="flex items-center gap-1 text-[8px] font-black text-violet-600 bg-violet-50 px-2 py-1 rounded-full border border-violet-100">
                                                <Briefcase size={8} /> {emp.area}
                                            </span>
                                        )}
                                        {emp.depto && (
                                            <span className="flex items-center gap-1 text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                                                <Briefcase size={8} /> {emp.depto}
                                            </span>
                                        )}
                                        {emp.sede && (
                                            <span className="flex items-center gap-1 text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 max-w-full truncate">
                                                <MapPin size={8} /> {emp.sede}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Contract Info */}
                                <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Inicio</span>
                                        <span className="text-slate-700 font-bold">{emp.formattedStart}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Término</span>
                                        <span className={`font-bold ${emp.alerts === 2 ? 'text-red-600' : emp.alerts === 1 ? 'text-amber-600' : 'text-slate-700'}`}>
                                            {emp.formattedEnd}
                                            {emp.daysToExpire !== null && emp.daysToExpire <= 30 && emp.daysToExpire > 0 &&
                                                <span className="ml-1 text-[8px]">({emp.daysToExpire}d)</span>
                                            }
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Tipo</span>
                                        <span className="text-slate-700 font-bold">{emp.contractType || '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Cargo</span>
                                        <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">{emp.position || '—'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Estado Baja</span>
                                        <span className="text-rose-500 font-bold text-[9px] uppercase tracking-wider">{emp.status || '—'}</span>
                                    </div>
                                </div>

                                {/* Alert Banner */}
                                {emp.alerts === 2 && (
                                    <div className="mt-3 flex items-center gap-2 p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                                        <AlertCircle size={14} />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Contrato vencido</span>
                                    </div>
                                )}
                                {emp.alerts === 1 && (
                                    <div className="mt-3 flex items-center gap-2 p-2.5 bg-amber-50 text-amber-600 rounded-xl animate-pulse border border-amber-100">
                                        <Bell size={14} />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Vence en {emp.daysToExpire} días</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BovedaDashboard;
