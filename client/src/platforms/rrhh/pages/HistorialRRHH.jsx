import React, { useState, useEffect, useMemo } from 'react';
import {
    History, Search, Loader2, Users, ArrowUpRight, CheckCircle2,
    XCircle, Clock, X, UserCheck, UserX, UserPlus, FolderKanban,
    BarChart3, RefreshCw, ChevronDown,
    FileText, MessageSquare, Landmark, Activity, TrendingUp
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import { formatRut } from '../../../utils/rutUtils';

/* ── status config ── */
const STATUS_CFG = {
    'En Postulación': { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', icon: UserPlus, group: 'proceso' },
    'Postulando': { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', icon: UserPlus, group: 'proceso' },
    'En Entrevista': { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100', icon: Clock, group: 'proceso' },
    'En Evaluación': { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-100', icon: Clock, group: 'proceso' },
    'En Acreditación': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100', icon: FileText, group: 'proceso' },
    'En Documentación': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: FileText, group: 'proceso' },
    'Aprobado': { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100', icon: CheckCircle2, group: 'proceso' },
    'Contratado': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: UserCheck, group: 'contratado' },
    'Rechazado': { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', icon: XCircle, group: 'cerrado' },
    'Retirado': { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', icon: UserX, group: 'cerrado' },
    'Finiquitado': { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: UserX, group: 'finiquitado' },
};

const FILTERS = ['Todos', 'En Proceso', 'Contratados', 'Finiquitados', 'Rechazados'];

const HistorialRRHH = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('Todos');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterProj, setFilterProj] = useState('');
    const [selected, setSelected] = useState(null);
    const [newNote, setNewNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name' | 'status'
    const [showStats, setShowStats] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [candRes, projRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
            ]);
            setCandidatos(candRes.data || []);
            setProyectos(projRes.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !selected) return;
        setAddingNote(true);
        try {
            const res = await candidatosApi.addNote(selected._id, { note: newNote, author: 'Sistema' });
            setCandidatos(prev => prev.map(c => c._id === selected._id ? res.data : c));
            setSelected(res.data);
            setNewNote('');
        } catch { alert('Error al agregar nota'); }
        finally { setAddingNote(false); }
    };

    /* ── stats ── */
    const stats = useMemo(() => {
        const total = candidatos.length;
        const enProceso = candidatos.filter(c => !['Contratado', 'Rechazado', 'Retirado', 'Finiquitado'].includes(c.status)).length;
        const contratados = candidatos.filter(c => c.status === 'Contratado').length;
        const finiquitados = candidatos.filter(c => ['Finiquitado', 'Retirado'].includes(c.status)).length;
        const rechazados = candidatos.filter(c => c.status === 'Rechazado').length;
        const projs = proyectos.length;
        const cecos = [...new Set(candidatos.map(c => c.ceco).filter(Boolean))].length;
        const tasaContrat = total > 0 ? Math.round((contratados / total) * 100) : 0;
        return { total, enProceso, contratados, finiquitados, rechazados, projs, cecos, tasaContrat };
    }, [candidatos, proyectos]);

    /* ── filter & sort ── */
    const filtered = useMemo(() => {
        let list = candidatos.filter(c => {
            const term = searchTerm.toLowerCase();
            const search = c.fullName?.toLowerCase().includes(term) || c.rut?.includes(term) || c.position?.toLowerCase().includes(term);
            let grp = true;
            if (filter === 'En Proceso') grp = !['Contratado', 'Rechazado', 'Retirado', 'Finiquitado'].includes(c.status);
            if (filter === 'Contratados') grp = c.status === 'Contratado';
            if (filter === 'Finiquitados') grp = ['Finiquitado', 'Retirado'].includes(c.status);
            if (filter === 'Rechazados') grp = c.status === 'Rechazado';

            const matchCeco = !filterCeco || c.ceco === filterCeco;
            const matchProj = !filterProj || (
                c.projectId?.toString() === filterProj ||
                c.projectName === proyectos.find(p => p._id === filterProj)?.nombreProyecto
            );
            return search && grp && matchCeco && matchProj;
        });

        if (sortBy === 'name') list = [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
        if (sortBy === 'status') list = [...list].sort((a, b) => a.status.localeCompare(b.status));
        if (sortBy === 'recent') list = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        return list;
    }, [candidatos, proyectos, searchTerm, filter, filterCeco, filterProj, sortBy]);

    const StatusBadge = ({ status }) => {
        const cfg = STATUS_CFG[status] || { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-100', icon: Clock };
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1.5 text-[9px] font-black px-2.5 py-1.5 rounded-xl uppercase tracking-wider border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                <Icon size={10} /> {status}
            </span>
        );
    };

    const getProjectInfo = (c) => {
        const proj = proyectos.find(p => p._id === c.projectId?.toString() || p._id === c.projectId);
        return {
            nombre: proj?.nombreProyecto || proj?.projectName || c.projectName || null,
            ceco: proj?.centroCosto || c.ceco || null,
            area: proj?.area || c.area || null,
        };
    };

    const cecos = [...new Set(candidatos.map(c => c.ceco).filter(Boolean))];

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">

            {/* ── HEADER ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 text-white p-3 rounded-2xl shadow-lg shadow-slate-200">
                        <History size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            Historial <span className="text-slate-600">Operativo</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Auditoría completa · Reclutamiento · Proyectos · Timeline de Personas
                        </p>
                    </div>
                </div>
                <button onClick={fetchAll} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-wider hover:border-slate-400 transition-all shadow-sm">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
            </div>

            {/* ── STATS PANEL ── */}
            <div className="bg-white border border-slate-100 rounded-[2rem] mb-6 overflow-hidden shadow-sm">
                <button onClick={() => setShowStats(v => !v)}
                    className="w-full flex items-center justify-between px-7 py-4 hover:bg-slate-50/70 transition-all">
                    <div className="flex items-center gap-3">
                        <BarChart3 size={14} className="text-slate-500" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Resumen Operacional Global</span>
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${showStats ? 'rotate-180' : ''}`} />
                </button>
                {showStats && (
                    <div className="px-7 pb-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                            {[
                                { label: 'Total Historial', value: stats.total, icon: Users, color: 'slate', sub: 'registros' },
                                { label: 'En Proceso', value: stats.enProceso, icon: Clock, color: 'indigo', sub: 'selección activa' },
                                { label: 'Contratados', value: stats.contratados, icon: UserCheck, color: 'emerald', sub: 'personal activo' },
                                { label: 'Finiquitados', value: stats.finiquitados, icon: UserX, color: 'rose', sub: 'bajas registradas' },
                                { label: 'Rechazados', value: stats.rechazados, icon: XCircle, color: 'red', sub: 'no continuaron' },
                                { label: 'Proyectos', value: stats.projs, icon: FolderKanban, color: 'teal', sub: 'proyectos activos' },
                                { label: 'CECOs', value: stats.cecos, icon: Landmark, color: 'amber', sub: 'centros de costo' },
                                { label: 'Tasa Contrat.', value: `${stats.tasaContrat}%`, icon: TrendingUp, color: 'sky', sub: 'sobre total' },
                            ].map((s, i) => {
                                const c = {
                                    slate: 'bg-slate-500', indigo: 'bg-indigo-500',
                                    emerald: 'bg-emerald-500', rose: 'bg-rose-500',
                                    red: 'bg-red-500', teal: 'bg-teal-500',
                                    amber: 'bg-amber-500', sky: 'bg-sky-500',
                                }[s.color];
                                return (
                                    <div key={i} className="bg-slate-50 rounded-2xl p-4 group hover:bg-white hover:shadow-sm transition-all">
                                        <div className={`w-8 h-8 ${c} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-sm`}>
                                            <s.icon size={14} className="text-white" />
                                        </div>
                                        <div className="text-xl font-black text-slate-800 tracking-tighter">{s.value}</div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</div>
                                        <div className="text-[8px] font-bold text-slate-300 mt-0.5">{s.sub}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Funnel visual */}
                        <div className="mt-5 bg-slate-50 rounded-2xl p-5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Embudo de Reclutamiento</p>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Postulantes', value: stats.total, color: 'bg-indigo-400', total: stats.total },
                                    { label: 'En Proceso', value: stats.enProceso, color: 'bg-violet-400', total: stats.total },
                                    { label: 'Contratados', value: stats.contratados, color: 'bg-emerald-500', total: stats.total },
                                    { label: 'Finiquitados', value: stats.finiquitados, color: 'bg-rose-400', total: stats.total },
                                ].map((row, i) => {
                                    const w = row.total > 0 ? Math.max(3, Math.round((row.value / row.total) * 100)) : 0;
                                    return (
                                        <div key={i} className="flex items-center gap-4">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider w-24">{row.label}</span>
                                            <div className="flex-1 h-5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className={`${row.color} h-full rounded-full flex items-center justify-end px-2 transition-all duration-700`} style={{ width: `${w}%` }}>
                                                    <span className="text-[8px] text-white font-black">{row.value}</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-black text-slate-400 w-8 text-right">{w}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MAIN TABLE ── */}
            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-wrap gap-3 items-center">
                    {/* Tab filters */}
                    <div className="flex gap-1 bg-slate-200/50 p-1 rounded-2xl flex-wrap">
                        {FILTERS.map(f => (
                            <button key={f} onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {f}
                                <span className={`ml-1.5 text-[8px] px-1.5 py-0.5 rounded-full ${filter === f ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-400'}`}>
                                    {f === 'Todos' ? candidatos.length
                                        : f === 'En Proceso' ? stats.enProceso
                                            : f === 'Contratados' ? stats.contratados
                                                : f === 'Finiquitados' ? stats.finiquitados
                                                    : stats.rechazados}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 ml-auto flex-wrap">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input type="text" placeholder="Nombre, RUT, cargo..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 w-48" />
                        </div>
                        {/* CECO filter */}
                        <select value={filterCeco} onChange={e => setFilterCeco(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                            <option value="">Todos los CECOs</option>
                            {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        {/* Proyecto filter */}
                        <select value={filterProj} onChange={e => setFilterProj(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                            <option value="">Todos los proyectos</option>
                            {proyectos.map(p => <option key={p._id} value={p._id}>{p.nombreProyecto || p.projectName} ({p.centroCosto})</option>)}
                        </select>
                        {/* Sort */}
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                            <option value="recent">Más reciente</option>
                            <option value="name">Nombre A-Z</option>
                            <option value="status">Por estado</option>
                        </select>
                        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            <Activity size={12} /> {filtered.length} registros
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 text-[9px] uppercase tracking-widest text-slate-400 font-black">
                                <th className="px-6 py-4">Persona</th>
                                <th className="px-6 py-4">Cargo / Área</th>
                                <th className="px-6 py-4">Proyecto / CECO</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Última Actividad</th>
                                <th className="px-6 py-4">Timeline</th>
                                <th className="px-6 py-4 text-right">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan="7" className="py-20 text-center">
                                    <Loader2 size={28} className="animate-spin text-slate-300 mx-auto" />
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">Cargando historial...</p>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan="7" className="py-20 text-center text-slate-400">
                                    <History size={40} className="mx-auto opacity-20 mb-3" />
                                    <p className="text-sm font-bold">Sin registros para los filtros seleccionados</p>
                                </td></tr>
                            ) : filtered.map(c => {
                                const proj = getProjectInfo(c);
                                const histCount = (c.history || []).length;
                                const noteCount = (c.notes || []).length;
                                return (
                                    <tr key={c._id} className="hover:bg-slate-50/60 transition-colors group">
                                        {/* Persona */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xs font-black shadow-sm overflow-hidden flex-shrink-0">
                                                    {c.profilePic
                                                        ? <img src={c.profilePic} className="w-full h-full object-cover" alt="" />
                                                        : c.fullName?.charAt(0)
                                                    }
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-xs uppercase tracking-tight">{c.fullName}</div>
                                                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">{formatRut(c.rut)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Cargo */}
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-black text-slate-700 uppercase">{c.position || '—'}</div>
                                            <div className="text-[9px] text-indigo-500 font-bold mt-0.5">{proj.area || c.area || '—'}</div>
                                        </td>
                                        {/* Proyecto / CECO */}
                                        <td className="px-6 py-4">
                                            {proj.nombre ? (
                                                <div>
                                                    <div className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{proj.nombre}</div>
                                                    {proj.ceco && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block border border-indigo-100">{proj.ceco}</span>}
                                                </div>
                                            ) : proj.ceco ? (
                                                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">{proj.ceco}</span>
                                            ) : (
                                                <span className="text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                        {/* Estado */}
                                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                                        {/* Última actividad */}
                                        <td className="px-6 py-4">
                                            <div className="text-xs font-bold text-slate-600">{new Date(c.updatedAt).toLocaleDateString('es-CL')}</div>
                                            <div className="text-[9px] text-slate-400">{new Date(c.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        {/* Timeline count */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                                    <Activity size={10} /> {histCount}
                                                </div>
                                                {noteCount > 0 && (
                                                    <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                                                        <MessageSquare size={10} /> {noteCount}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {/* Acción */}
                                        <td className="px-6 py-4 text-right">
                                            <button onClick={() => setSelected(c)}
                                                className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-all shadow-sm active:scale-95 group-hover:shadow-indigo-200">
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── DETAIL MODAL ── */}
            {selected && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">

                        {/* Modal header */}
                        <div className="p-7 bg-slate-900 text-white flex justify-between items-start flex-shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-2xl font-black shadow-xl overflow-hidden">
                                    {selected.profilePic ? <img src={selected.profilePic} className="w-full h-full object-cover" alt="" /> : selected.fullName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">{selected.fullName}</h3>
                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <span className="text-slate-400 text-[10px] font-mono">{formatRut(selected.rut)}</span>
                                        <span className="w-1 h-1 bg-slate-600 rounded-full" />
                                        <span className="text-indigo-400 text-[10px] font-black uppercase">{selected.position}</span>
                                        {selected.ceco && <><span className="w-1 h-1 bg-slate-600 rounded-full" /><span className="text-amber-400 text-[10px] font-black">{selected.ceco}</span></>}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={selected.status} />
                                <button onClick={() => setSelected(null)}
                                    className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal body */}
                        <div className="flex-1 overflow-y-auto p-7 space-y-7 custom-scrollbar">

                            {/* Datos clave */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Cargo', value: selected.position || '—' },
                                    { label: 'Área', value: selected.area || '—' },
                                    { label: 'CECO', value: selected.ceco || '—' },
                                    { label: 'Proyecto', value: selected.projectName || getProjectInfo(selected).nombre || '—' },
                                    { label: 'Ingreso', value: selected.contractStartDate ? new Date(selected.contractStartDate + 'T12:00:00').toLocaleDateString('es-CL') : '—' },
                                    { label: 'Contrato', value: selected.contractType || '—' },
                                ].map((d, i) => (
                                    <div key={i} className="bg-slate-50 rounded-2xl p-4">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{d.label}</p>
                                        <p className="text-xs font-black text-slate-800 uppercase truncate">{d.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Timeline */}
                            <div>
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Activity size={12} /> Timeline de Operaciones ({(selected.history || []).length} eventos)
                                </h4>
                                {(selected.history || []).length === 0 ? (
                                    <p className="text-xs text-slate-400 italic text-center py-4">Sin eventos registrados.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {[...(selected.history || [])].reverse().map((h, i) => (
                                            <div key={i} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                                    {i < (selected.history || []).length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                                                </div>
                                                <div className="pb-3">
                                                    <div className="text-xs font-black text-slate-700 uppercase">{h.action}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{h.description}</div>
                                                    <div className="text-[9px] text-slate-400 mt-1 font-mono">{new Date(h.timestamp).toLocaleString('es-CL')}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <MessageSquare size={12} /> Notas de Auditoría ({(selected.notes || []).length})
                                </h4>
                                <div className="space-y-2 mb-4">
                                    {(selected.notes || []).map((n, i) => (
                                        <div key={i} className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                            <p className="text-xs font-bold text-slate-700">{n.text}</p>
                                            <p className="text-[9px] text-slate-400 mt-1">{n.author} · {new Date(n.createdAt).toLocaleString('es-CL')}</p>
                                        </div>
                                    ))}
                                </div>
                                <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                                    placeholder="Registrar observación o novedad..."
                                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none resize-none h-24 focus:ring-2 focus:ring-indigo-200" />
                                <button onClick={handleAddNote} disabled={addingNote || !newNote.trim()}
                                    className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all disabled:opacity-30">
                                    {addingNote ? 'Guardando...' : '+ Publicar Nota'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HistorialRRHH;
