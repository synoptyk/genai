import React, { useState, useEffect } from 'react';
import {
    Users, AlertCircle, Bell, FileText, Loader2,
    Briefcase, Landmark, RefreshCw, Search, Building2, MapPin
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import { formatRut } from '../../../utils/rutUtils';

const PersonalActivo = () => {
    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterProj, setFilterProj] = useState('');

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [empRes, projRes] = await Promise.all([
                candidatosApi.getAll({ status: 'Contratado' }),
                proyectosApi.getAll(),
            ]);
            const today = new Date();
            const processed = (empRes.data || []).map(emp => {
                // Dates stored at root level AND in hiring sub-doc — check both
                const startRaw = emp.contractStartDate || emp.hiring?.contractStartDate;
                const endRaw = emp.contractEndDate || emp.hiring?.contractEndDate;
                const type = emp.contractType || emp.hiring?.contractType;

                const expiryDate = endRaw ? new Date(endRaw) : null;
                let daysToExpire = null, alerts = 0;
                if (expiryDate) {
                    daysToExpire = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    if (daysToExpire <= 30 && daysToExpire > 0) alerts = 1;
                    if (daysToExpire <= 0) alerts = 2; // expired!
                }

                // Find project info
                const proj = projRes.data?.find(p =>
                    p._id === emp.projectId?.toString() ||
                    p._id === emp.projectId
                );
                const projectName = proj?.nombreProyecto || proj?.projectName || emp.projectName || null;
                const ceco = proj?.centroCosto || emp.ceco || null;
                const area = proj?.area || emp.area || null;
                const depto = emp.departamento || null;
                const sede = emp.sede || null;

                return {
                    ...emp,
                    formattedStart: startRaw ? new Date(startRaw + 'T12:00:00').toLocaleDateString('es-CL') : 'S/F',
                    formattedEnd: endRaw ? new Date(endRaw + 'T12:00:00').toLocaleDateString('es-CL') : 'Indefinido',
                    contractType: type,
                    projectName, ceco, area, depto, sede,
                    daysToExpire, alerts,
                };
            });
            setEmployees(processed);
            setProyectos(projRes.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const cecos = [...new Set(employees.map(e => e.ceco).filter(Boolean))];

    const filtered = employees.filter(e => {
        // REGLA DE NEGOCIO: Exigencia global de ID TOA en personal activo
        if (!e.idRecursoToa || e.idRecursoToa.trim() === '') return false;

        const term = searchTerm.toLowerCase();
        const search = !searchTerm ||
            e.fullName?.toLowerCase().includes(term) ||
            e.rut?.includes(term) ||
            e.position?.toLowerCase().includes(term);
        const matchCeco = !filterCeco || e.ceco === filterCeco;
        const matchProj = !filterProj || e.projectName === filterProj || (e.projectId?.toString() === filterProj);
        return search && matchCeco && matchProj;
    });

    const activeAlerts = employees.filter(e => e.alerts > 0).length;
    const expired = employees.filter(e => e.alerts === 2).length;

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-200">
                        <Users size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">Personal <span className="text-emerald-600">Activo</span></h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Colaboradores con contrato vigente · {employees.length} registros
                        </p>
                    </div>
                </div>
                <button onClick={fetchAll} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-wider hover:border-slate-400 transition-all shadow-sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Activos', value: employees.length, icon: Users, color: 'from-emerald-500 to-emerald-700', sub: 'con contrato' },
                    { label: 'Alertas Vencimiento', value: activeAlerts, icon: Bell, color: 'from-rose-500 to-rose-700', sub: 'próximos 30 días' },
                    { label: 'Contratos Vencidos', value: expired, icon: AlertCircle, color: 'from-red-600 to-red-800', sub: 'requieren acción' },
                    { label: 'Sin Tipo Contrato', value: employees.filter(e => !e.contractType).length, icon: FileText, color: 'from-amber-500 to-amber-600', sub: 'por actualizar' },
                ].map((s, i) => (
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
            <div className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 flex flex-wrap gap-3 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                    <input type="text" placeholder="Nombre, RUT o cargo..." value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <select value={filterCeco} onChange={e => setFilterCeco(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="">Todos los CECOs</option>
                    {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filterProj} onChange={e => setFilterProj(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="">Todos los proyectos</option>
                    {proyectos.map(p => <option key={p._id} value={p._id}>{p.nombreProyecto || p.projectName}</option>)}
                </select>
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black text-slate-500">
                    <Users size={12} /> {filtered.length} mostrando
                </div>
            </div>

            {/* Employee Cards */}
            <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="animate-spin text-emerald-500 mb-3" size={32} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando personal...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Users size={48} className="mx-auto text-slate-300 mb-4" />
                        <p className="text-slate-500 font-bold">No hay personal que coincida con los filtros</p>
                        <p className="text-xs text-slate-400 mt-2">Los candidatos con estado "Contratado" aparecen aquí</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map(emp => (
                            <div key={emp._id} className={`p-5 bg-white border-2 rounded-2xl transition-all group hover:shadow-md relative ${emp.alerts === 2 ? 'border-red-200 hover:border-red-400' :
                                emp.alerts === 1 ? 'border-amber-200 hover:border-amber-400' :
                                    'border-slate-100 hover:border-emerald-200'
                                }`}>
                                {/* Avatar + Name */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-black text-lg shadow-inner overflow-hidden flex-shrink-0">
                                        {emp.profilePic
                                            ? <img src={emp.profilePic} alt="" className="w-full h-full object-cover" />
                                            : emp.fullName?.charAt(0)
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm truncate">{emp.fullName}</h4>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{emp.position}</p>
                                    </div>
                                </div>

                                {/* CECO + Proyecto */}
                                {(emp.ceco || emp.projectName) && (
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
                                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">RUT</span>
                                        <span className="text-slate-500 font-mono text-[9px]">{formatRut(emp.rut)}</span>
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

export default PersonalActivo;
