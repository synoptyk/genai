import React, { useState, useEffect, useCallback } from 'react'; // Verified build v1.0.1
import {
    FolderKanban, Plus, Edit3, Trash2, X, Save, Loader2,
    ChevronDown, ChevronUp, Users, Building2,
    TrendingUp, AlertTriangle, CheckCircle2,
    BarChart3, Search, UserPlus, Clock, UserCheck, UserX,
    RefreshCw, Target, Briefcase, FileText, Waypoints, Activity
} from 'lucide-react';
import { proyectosApi, configApi } from '../rrhhApi';
import SearchableSelect from '../../../components/SearchableSelect';
import MultiSearchableSelect from '../../../components/MultiSearchableSelect';

const STATUS_STYLES = {
    'Activo': { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'Pausado': { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-400' },
    'Cerrado': { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
    'En Licitación': { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-400' },
};

const EMPTY_FORM = {
    centroCosto: '',
    nombreProyecto: '',
    cliente: '',
    area: '',
    sede: '',
    sedesVinculadas: [],
    status: 'Activo',
    fechaInicio: '',
    fechaFin: '',
    notes: '',
    dotacion: []
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const pct = (cubiertos, total) => total > 0 ? Math.round((cubiertos / total) * 100) : 0;
const totalRequerido = (dotacion) => dotacion.reduce((a, d) => a + (d.cantidad || 0), 0);
const totalCubierto = (dotacion) => dotacion.reduce((a, d) => a + (d.cubiertos || 0), 0);

// ── COMPONENT ──────────────────────────────────────────────────────────────────
const Proyectos = () => {
    const [proyectos, setProyectos] = useState([]);
    const [config, setConfig] = useState({ cargos: [], areas: [], cecos: [], departamentos: [], sedes: [] });
    const [globalAnalytics, setGlobalAnalytics] = useState(null);
    const [projectAnalytics, setProjectAnalytics] = useState({});  // keyed by _id
    const [loadingAnalytics, setLoadingAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [selected, setSelected] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [expandedId, setExpandedId] = useState(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await proyectosApi.getAll();
            setProyectos(res.data);
        } catch { showToast('Error al cargar proyectos', 'error'); }
        finally { setLoading(false); }
    }, []);

    const fetchConfig = useCallback(async () => {
        try {
            const res = await configApi.get();
            if (res.data) setConfig(res.data);
        } catch { }
    }, []);

    const fetchGlobalAnalytics = useCallback(async () => {
        try {
            const res = await proyectosApi.getAnalyticsGlobal();
            setGlobalAnalytics(res.data);
        } catch { }
    }, []);

    const fetchProjectAnalytics = useCallback(async (id) => {
        if (projectAnalytics[id]) return;
        setLoadingAnalytics(p => ({ ...p, [id]: true }));
        try {
            const res = await proyectosApi.getAnalytics(id);
            setProjectAnalytics(p => ({ ...p, [id]: res.data }));
        } catch { }
        finally { setLoadingAnalytics(p => ({ ...p, [id]: false })); }
    }, [projectAnalytics]);

    useEffect(() => {
        fetchAll();
        fetchConfig();
        fetchGlobalAnalytics();
    }, [fetchAll, fetchConfig, fetchGlobalAnalytics]);

    const handleExpand = (id) => {
        const newId = expandedId === id ? null : id;
        setExpandedId(newId);
        if (newId) fetchProjectAnalytics(newId);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    // ── CRUD ────────────────────────────────────────────────────────────────
    const openCreate = () => {
        setForm(EMPTY_FORM);
        setModal('create');
    };

    const openEdit = (p) => {
        setSelected(p);
        setForm({
            centroCosto: p.centroCosto || '',
            nombreProyecto: p.nombreProyecto || p.projectName || '',
            cliente: p.cliente || '',
            area: p.area || '',
            sede: p.sede || '',
            sedesVinculadas: p.sedesVinculadas || (p.sede ? [p.sede] : []),
            status: p.status || 'Activo',
            fechaInicio: p.fechaInicio ? p.fechaInicio.substring(0, 10) : '',
            fechaFin: p.fechaFin ? p.fechaFin.substring(0, 10) : '',
            notes: p.notes || '',
            dotacion: p.dotacion ? [...p.dotacion] : []
        });
        setModal('edit');
    };

    const handleSave = async () => {
        if (!form.centroCosto || !form.nombreProyecto) {
            showToast('Centro de costo y nombre son obligatorios', 'error');
            return;
        }
        setSaving(true);
        try {
            // --- SYNC ORGANIZATIONAL STRUCTURE (Global Dictionary) ---
            const currentCargos = (config.cargos || []).map(c => (typeof c === 'string' ? c : c.nombre).toUpperCase());
            const currentAreas = (config.areas || []).map(a => (typeof a === 'string' ? a : a.nombre).toUpperCase());
            const currentDepts = (config.departamentos || []).map(d => (typeof d === 'string' ? d : d.nombre).toUpperCase());
            const currentCecos = (config.cecos || []).map(c => (typeof c === 'string' ? c : c.nombre).toUpperCase());

            const newCargos = (form.dotacion || [])
                .map(d => d.cargo?.toUpperCase())
                .filter(c => c && !currentCargos.includes(c));
            
            const newAreas = (form.dotacion || [])
                .map(d => d.area?.trim().toUpperCase())
                .filter(a => a && !currentAreas.includes(a));

            const newDepts = (form.dotacion || [])
                .map(d => d.departamento?.trim().toUpperCase())
                .filter(dep => dep && !currentDepts.includes(dep));

            const newCecos = [(form.centroCosto || '').trim().toUpperCase(), ...(form.dotacion || []).map(d => d.ceco?.trim().toUpperCase())]
                .filter((c, i, self) => c && self.indexOf(c) === i && !currentCecos.includes(c));

            if (newCargos.length > 0 || newAreas.length > 0 || newDepts.length > 0 || newCecos.length > 0) {
                const updatedConfig = {
                    ...config,
                    cargos: [...(config.cargos || []), ...newCargos.map(n => ({ nombre: n, categoria: 'Operativo' }))],
                    areas: [...(config.areas || []), ...newAreas.map(n => ({ nombre: n }))],
                    departamentos: [...(config.departamentos || []), ...newDepts.map(n => ({ nombre: n }))],
                    cecos: [...(config.cecos || []), ...newCecos.map(n => ({ nombre: n }))]
                };
                await configApi.update(updatedConfig);
                fetchConfig(); 
            }
            // --- END SYNC ---

            const payload = {
                ...form,
                projectName: form.nombreProyecto  // alias legacy
            };
            if (modal === 'create') {
                await proyectosApi.create(payload);
                showToast('Proyecto creado y estructura sincronizada');
            } else {
                await proyectosApi.update(selected._id, payload);
                showToast('Proyecto actualizado y estructura sincronizada');
            }
            setModal(null);
            fetchAll();
        } catch (e) {
            showToast(e.response?.data?.message || 'Error al guardar', 'error');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await proyectosApi.remove(selected._id);
            showToast('Proyecto eliminado');
            setModal(null);
            fetchAll();
        } catch { showToast('Error al eliminar', 'error'); }
        finally { setSaving(false); }
    };

    // ── DOTACION HANDLERS ──────────────────────────────────────────────────
    const addDotacion = () => {
        setForm(f => ({ 
            ...f, 
            dotacion: [...f.dotacion, { cargo: '', cantidad: 1, cubiertos: 0, sede: '', ceco: '', area: '', departamento: '', sueldoBaseLiquido: 0, bonos: [] }] 
        }));
    };

    const updateDotacion = (idx, field, value) => {
        setForm(f => ({
            ...f,
            dotacion: f.dotacion.map((d, i) => i === idx ? {
                ...d,
                [field]: field === 'cantidad' || field === 'cubiertos' || field === 'sueldoBaseLiquido' ? Number(value) : value
            } : d)
        }));
    };

    const addDotacionBonus = (idx) => {
        setForm(f => ({
            ...f,
            dotacion: f.dotacion.map((d, i) => i === idx ? ({
                ...d,
                bonos: [...(d.bonos || []), { type: '', modality: 'Fijo', amount: 0, description: '' }]
            }) : d)
        }));
    };

    const updateDotacionBonus = (idx, bidx, field, value) => {
        setForm(f => ({
            ...f,
            dotacion: f.dotacion.map((d, i) => i === idx ? ({
                ...d,
                bonos: (d.bonos || []).map((b, bi) => bi === bidx ? ({
                    ...b,
                    [field]: field === 'amount' ? Number(value) : value
                }) : b)
            }) : d)
        }));
    };

    const removeDotacionBonus = (idx, bidx) => {
        setForm(f => ({
            ...f,
            dotacion: f.dotacion.map((d, i) => i === idx ? ({
                ...d,
                bonos: (d.bonos || []).filter((_, bi) => bi !== bidx)
            }) : d)
        }));
    };

    const removeDotacion = (idx) => {
        setForm(f => ({ ...f, dotacion: f.dotacion.filter((_, i) => i !== idx) }));
    };

    // ── FILTER ─────────────────────────────────────────────────────────────
    const filtered = proyectos.filter(p => {
        const s = searchTerm.toLowerCase();
        const matchSearch = !s || (p.nombreProyecto || p.projectName || '').toLowerCase().includes(s) ||
            (p.cliente || '').toLowerCase().includes(s) || (p.centroCosto || '').toLowerCase().includes(s);
        const matchStatus = !filterStatus || p.status === filterStatus;
        const matchCeco = !filterCeco || p.centroCosto === filterCeco;
        return matchSearch && matchStatus && matchCeco;
    });

    const totalReq = proyectos.reduce((a, p) => a + totalRequerido(p.dotacion || []), 0);
    const totalCub = proyectos.reduce((a, p) => a + totalCubierto(p.dotacion || []), 0);
    const uniqueCecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    // ── Global analytics KPIs (from backend, crosses with candidatos)
    const ga = globalAnalytics?.totales || null;

    // ── RENDER ─────────────────────────────────────────────────────────────
    return (
        <div className="min-h-full font-sans">

            {/* TOAST */}
            {toast && (
                <div className={`fixed bottom - 8 right - 8 z - [200] px - 8 py - 4 rounded - 2xl font - black text - [11px] uppercase tracking - wide shadow - xl flex items - center gap - 3 transition - all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white'} `}>
                    {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* ── PAGE HEADER ──────────────────────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <FolderKanban size={20} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Gestión de Proyectos</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Centro de Costo (CECO) · Dotación Requerida · Control de Cobertura</p>
                    </div>
                </div>
                <div className="h-1 w-14 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-3 ml-13" />
            </div>

            {/* ── KPI CARDS ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {[
                    { label: 'Total Proyectos', value: proyectos.length, icon: FolderKanban, color: 'indigo', sub: `${proyectos.filter(p => p.status === 'Activo').length} activos` },
                    { label: 'Centros de Costo', value: uniqueCecos.length, icon: Building2, color: 'violet', sub: 'CECOs únicos' },
                    { label: 'Dotación Requerida', value: ga?.globalReq ?? totalReq, icon: Users, color: 'amber', sub: 'puestos totales' },
                    { label: 'Cobertura Real', value: `${ga?.coberturaGlobal ?? (totalReq > 0 ? Math.round((totalCub / totalReq) * 100) : 0)}% `, icon: TrendingUp, color: 'emerald', sub: ga ? `${ga.globalAct} /${ga.globalReq} activos` : `${totalCub}/${totalReq} ` },
                ].map((card, i) => {
                    const colorStyles = {
                        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'bg-indigo-600', border: 'border-indigo-100' },
                        violet: { bg: 'bg-violet-50', text: 'text-violet-700', icon: 'bg-violet-600', border: 'border-violet-100' },
                        amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'bg-amber-500', border: 'border-amber-100' },
                        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'bg-emerald-600', border: 'border-emerald-100' },
                    }[card.color];
                    return (
                        <div key={i} className={`bg - white border ${colorStyles.border} rounded - [2rem] p - 6 shadow - sm`}>
                            <div className={`w - 11 h - 11 ${colorStyles.icon} rounded - 2xl flex items - center justify - center text - white mb - 4 shadow - md`}>
                                <card.icon size={20} />
                            </div>
                            <p className="text-2xl font-black text-slate-900 mb-0.5">{card.value}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{card.label}</p>
                            <p className={`text - [10px] font - bold mt - 1 ${colorStyles.text} `}>{card.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── FILTERS BAR ──────────────────────────────────────────── */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-5 mb-6 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px] relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Buscar por proyecto, cliente o CECO..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                    />
                </div>
                <div className="w-64">
                    <SearchableSelect
                        options={uniqueCecos}
                        value={filterCeco}
                        onChange={setFilterCeco}
                        placeholder="— TODOS LOS CECOS —"
                        className="!h-[46px] !py-0"
                    />
                </div>
                <div className="w-64">
                    <SearchableSelect
                        options={Object.keys(STATUS_STYLES)}
                        value={filterStatus}
                        onChange={setFilterStatus}
                        placeholder="— TODOS LOS ESTADOS —"
                        className="!h-[46px] !py-0"
                    />
                </div>
                <button onClick={openCreate}
                    className="ml-auto flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-7 py-3.5 rounded-2xl font-black text-[11px] uppercase hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                    <Plus size={16} /> Nuevo Proyecto
                </button>
            </div>

            {/* ── PROJECT LIST ─────────────────────────────────────────── */}
            {loading ? (
                <div className="flex justify-center items-center py-32">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-[2rem] p-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5">
                        <FolderKanban size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Sin proyectos registrados</p>
                    <button onClick={openCreate} className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-2xl font-black text-[11px] uppercase hover:bg-indigo-100 transition-all border border-indigo-100">
                        <Plus size={14} /> Crear primer proyecto
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(p => {
                        // Cruce con analítica real (Captura de Talento)
                        const projectAn = globalAnalytics?.proyectos?.find(pa => pa._id === p._id);
                        
                        const req = projectAn ? projectAn.requerido : totalRequerido(p.dotacion || []);
                        const cub = projectAn ? projectAn.activos : totalCubierto(p.dotacion || []);
                        const pctVal = projectAn ? projectAn.cobertura : pct(cub, req);
                        
                        const st = STATUS_STYLES[p.status] || STATUS_STYLES['Activo'];
                        const isExpanded = expandedId === p._id;

                        return (
                            <div key={p._id} className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm hover:border-indigo-200 transition-all">
                                {/* Card header */}
                                <div className="flex items-center gap-5 p-7">
                                    {/* CECO badge */}
                                    <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex flex-col items-center justify-center text-white shadow-lg shadow-indigo-200">
                                        <span className="text-[8px] font-black uppercase tracking-wider opacity-80">CECO</span>
                                        <span className="text-[10px] font-black leading-tight text-center px-1 truncate max-w-full">{p.centroCosto?.substring(0, 6)}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1.5 ${st.bg} ${st.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {p.status}
                                            </span>
                                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{p.centroCosto}</span>
                                            {p.sedesVinculadas?.length > 0 ? (
                                                p.sedesVinculadas.map((s, i) => (
                                                    <span key={i} className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{s.split(' - ')[0]}</span>
                                                ))
                                            ) : p.sede && (
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{p.sede}</span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 truncate">{p.nombreProyecto || p.projectName}</h3>
                                        {p.cliente && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{p.cliente}</p>}
                                    </div>

                                    {/* Progress */}
                                    <div className="flex-shrink-0 hidden md:flex flex-col items-center gap-2 min-w-[120px]">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-900">{pctVal}%</span>
                                            <span className="text-[10px] font-bold text-slate-400">cobertura</span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h - full rounded - full transition - all duration - 700 ${pctVal >= 100 ? 'bg-emerald-500' : pctVal >= 60 ? 'bg-indigo-500' : 'bg-amber-500'} `}
                                                style={{ width: `${Math.min(pctVal, 100)}% ` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400">{cub}/{req} puestos</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <button onClick={() => handleExpand(p._id)}
                                            className="p-2.5 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all">
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                        <button onClick={() => openEdit(p)} className="p-2.5 bg-indigo-50 hover:bg-indigo-600 rounded-xl text-indigo-600 hover:text-white transition-all">
                                            <Edit3 size={16} />
                                        </button>
                                        <button onClick={() => { setSelected(p); setModal('delete'); }} className="p-2.5 bg-red-50 hover:bg-red-600 rounded-xl text-red-500 hover:text-white transition-all">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded: Real-time analytics from CapturaTalento */}
                                {isExpanded && (() => {
                                    const an = projectAnalytics[p._id];
                                    const isLoadingAn = loadingAnalytics[p._id];
                                    return (
                                        <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/50 to-white px-7 py-6">

                                            {/* Analytics header */}
                                            <div className="flex items-center justify-between mb-5">
                                                <div className="flex items-center gap-2">
                                                    <BarChart3 size={14} className="text-indigo-500" />
                                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Análisis de Reclutamiento en Tiempo Real</p>
                                                    <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Vinculado a Captura de Talento</span>
                                                </div>
                                                <button onClick={() => {
                                                    setProjectAnalytics(pa => { const copy = { ...pa }; delete copy[p._id]; return copy; });
                                                    fetchProjectAnalytics(p._id);
                                                }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                                                    <RefreshCw size={13} />
                                                </button>
                                            </div>

                                            {isLoadingAn ? (
                                                <div className="flex justify-center py-10">
                                                    <div className="w-8 h-8 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                                </div>
                                            ) : an ? (
                                                <>
                                                    {/* Resumen global del proyecto */}
                                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
                                                        {[
                                                            { label: 'Requerido', value: an.resumen.totalRequerido, color: 'slate', icon: Users },
                                                            { label: 'Activos', value: an.resumen.totalCubierto, color: 'emerald', icon: UserCheck },
                                                            { label: 'En Permiso', value: an.resumen.totalEnPermiso, color: 'amber', icon: Clock },
                                                            { label: 'Postulando', value: an.resumen.totalPostulando, color: 'indigo', icon: UserPlus },
                                                            { label: 'Finiquitados', value: an.resumen.totalFiniquitados, color: 'rose', icon: UserX },
                                                            { label: 'Pendientes', value: an.resumen.totalPendientes, color: 'red', icon: AlertTriangle },
                                                        ].map((s, si) => {
                                                            const cs = {
                                                                slate: { bg: 'bg-slate-100', text: 'text-slate-600', num: 'text-slate-800' },
                                                                emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', num: 'text-emerald-700' },
                                                                amber: { bg: 'bg-amber-100', text: 'text-amber-600', num: 'text-amber-700' },
                                                                indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', num: 'text-indigo-700' },
                                                                rose: { bg: 'bg-rose-100', text: 'text-rose-600', num: 'text-rose-700' },
                                                                red: { bg: 'bg-red-100', text: 'text-red-600', num: 'text-red-700' },
                                                            }[s.color];
                                                            return (
                                                                <div key={si} className={`${cs.bg} rounded - 2xl p - 4 text - center`}>
                                                                    <s.icon size={16} className={`mx - auto mb - 1.5 ${cs.text} `} />
                                                                    <p className={`text - xl font - black ${cs.num} `}>{s.value}</p>
                                                                    <p className={`text - [8px] font - black uppercase tracking - wider ${cs.text} `}>{s.label}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Cobertura real */}
                                                    <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cobertura Real Activos</span>
                                                            <span className={`text - 2xl font - black ${an.resumen.coberturaGlobal >= 100 ? 'text-emerald-600' : an.resumen.coberturaGlobal >= 60 ? 'text-indigo-600' : 'text-amber-600'} `}>{an.resumen.coberturaGlobal}%</span>
                                                        </div>
                                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h - full rounded - full transition - all duration - 700 ${an.resumen.coberturaGlobal >= 100 ? 'bg-emerald-500' : an.resumen.coberturaGlobal >= 60 ? 'bg-indigo-500' : 'bg-amber-400'} `}
                                                                style={{ width: `${Math.min(an.resumen.coberturaGlobal, 100)}% ` }}
                                                            />
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 font-bold mt-2">{an.resumen.totalCubierto} activos de {an.resumen.totalRequerido} requeridos — {an.resumen.totalPendientes} puestos pendientes de cubrir</p>
                                                    </div>

                                                    {/* Por cargo y sede */}
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Detalle por Cargo y Ubicación</p>
                                                    <div className="space-y-3">
                                                        {p.dotacion?.map((d, di) => {
                                                            const cargoAn = an?.dotacion?.find(ad => ad.cargo?.toLowerCase() === d.cargo?.toLowerCase());
                                                            const cub = cargoAn ? cargoAn.cubiertos : (d.cubiertos || 0);
                                                            const req = d.cantidad || 0;
                                                            const pctVal = pct(cub, req);

                                                            return (
                                                                <div key={di} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-200 transition-all">
                                                                    <div className="flex items-center justify-between mb-4">
                                                                        <div className="flex items-center gap-3 flex-1">
                                                                            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center filter grayscale opacity-80"><Users size={14} className="text-indigo-600" /></div>
                                                                            <div className="flex-1">
                                                                                <span className="font-black text-slate-900 text-sm block leading-none mb-1.5">{d.cargo}</span>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-widest" title="Sede">{d.sede || 'Sin Sede'}</span>
                                                                                    {d.ceco && <span className="text-[7px] font-black bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-widest" title="CECO">{d.ceco}</span>}
                                                                                    {d.area && <span className="text-[7px] font-black bg-violet-50 text-violet-500 px-2 py-0.5 rounded-full border border-violet-100 uppercase tracking-widest" title="Área">{d.area}</span>}
                                                                                    {d.departamento && <span className="text-[7px] font-black bg-emerald-50 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-widest" title="Depto">{d.departamento}</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-xs font-black text-indigo-600">{pctVal}%</span>
                                                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Cobertura</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] text-slate-600">
                                                                        <span className="font-bold">Sueldo Base: </span>
                                                                        <span className="col-span-2">{d.sueldoBaseLiquido ? `$ ${Number(d.sueldoBaseLiquido).toLocaleString('es-CL')}` : 'No definido'}</span>
                                                                        <span className="font-bold">Bonos:</span>
                                                                        <span className="col-span-2">{(d.bonos || []).length > 0 ? (d.bonos || []).map(b => `${b.type || '-'} (${b.modality || '-'}) ${b.amount ? `$${Number(b.amount).toLocaleString('es-CL')}` : ''}`).join(', ') : 'No definidos'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                            <div className={`h-full rounded-full transition-all ${pctVal >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(pctVal, 100)}%` }} />
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-slate-700 tabular-nums">{cub}/{req}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {(!p.dotacion || p.dotacion.length === 0) && (
                                                            <p className="text-slate-400 text-sm font-semibold italic text-center py-4">Sin cargos definidos en este proyecto.</p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-slate-400">
                                                    <BarChart3 size={24} className="mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm font-semibold">Sin datos de reclutamiento disponibles</p>
                                                </div>
                                            )}

                                            {p.notes && (
                                                <div className="mt-5 p-4 bg-white border border-slate-100 rounded-2xl">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observaciones</p>
                                                    <p className="text-sm text-slate-600 font-medium">{p.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MODAL: CREATE / EDIT
            ══════════════════════════════════════════════════════════════ */}
            {(modal === 'create' || modal === 'edit') && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{modal === 'create' ? 'Nuevo Proyecto' : 'Editar Proyecto'}</h3>
                                <div className="h-1 w-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-2" />
                            </div>
                            <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* ── Identificación ── */}
                            <div>
                                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-4">Identificación del Proyecto</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Centro de Costo (CECO) */}
                                    <div className="group/field">
                                        <SearchableSelect
                                            label="Centro de Costo (CECO)"
                                            icon={Building2}
                                            options={config.cecos.map(c => typeof c === 'string' ? c : c.nombre)}
                                            value={form.centroCosto}
                                            onChange={val => setForm({ ...form, centroCosto: val })}
                                            placeholder="— SELECCIONAR O ESCRIBIR CECO —"
                                            allowCustom={true}
                                        />
                                    </div>
                                    {/* Nombre Proyecto */}
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nombre del Proyecto *</label>
                                        <input type="text" value={form.nombreProyecto}
                                            onChange={e => setForm(f => ({ ...f, nombreProyecto: e.target.value }))}
                                            placeholder="Ej: Zener Movistar, Comfica Movistar…"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                        />
                                    </div>
                                    {/* Cliente */}
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Cliente</label>
                                        <input type="text" value={form.cliente}
                                            onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                                            placeholder="Ej: Movistar, Entel, Claro…"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Sedes Vinculadas */}
                                    <div className="group/field lg:col-span-2">
                                        <MultiSearchableSelect
                                            label="Sedes / Lugares Vinculados"
                                            icon={Waypoints}
                                            options={config.sedes.map(s => typeof s === 'string' ? s : `${s.nombre} - ${s.region}, ${s.comuna}`)}
                                            value={form.sedesVinculadas}
                                            onChange={vals => {
                                                const firstSede = vals.length > 0 ? vals[0].split(' - ')[0] : '';
                                                setForm({ 
                                                    ...form, 
                                                    sedesVinculadas: vals,
                                                    sede: firstSede // Mantener legacy sync
                                                });
                                            }}
                                            placeholder="— VINCULAR SEDES AL PROYECTO —"
                                        />
                                    </div>
                                    <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                                        {/* Estado */}
                                        <div className="group/field">
                                            <SearchableSelect
                                                label="Estado"
                                                icon={Activity}
                                                options={Object.keys(STATUS_STYLES)}
                                                value={form.status}
                                                onChange={val => setForm({ ...form, status: val })}
                                                placeholder="— SELECCIONAR ESTADO —"
                                            />
                                        </div>
                                        {/* Fechas */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Inicio</label>
                                                <input type="date" value={form.fechaInicio} onChange={e => setForm(f => ({ ...f, fechaInicio: e.target.value }))}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Fin</label>
                                                <input type="date" value={form.fechaFin} onChange={e => setForm(f => ({ ...f, fechaFin: e.target.value }))}
                                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Dotación ── */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Dotación Requerida</p>
                                    <button onClick={addDotacion}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all">
                                        <UserPlus size={14} /> Agregar Cargo
                                    </button>
                                </div>

                                {form.dotacion.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                        <Users size={28} className="mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-400 text-sm font-semibold">Haz clic en "Agregar Cargo" para definir la dotación requerida.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Header */}
                                        <div className="grid grid-cols-12 gap-3 px-2">
                                            <span className="col-span-12 text-[9px] font-black text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-100 mb-2">Configuración de Cargos por Ubicación y Estructura</span>
                                        </div>
                                        {form.dotacion.map((d, idx) => (
                                            <div key={idx} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4 relative group/item">
                                                <button onClick={() => removeDotacion(idx)} 
                                                    className="absolute top-2 right-2 p-1.5 bg-white border border-red-100 text-red-400 hover:text-red-600 rounded-xl shadow-sm opacity-0 group-hover/item:opacity-100 transition-all">
                                                    <X size={14} />
                                                </button>
                                                
                                                {/* Primera fila: Cargo, Sede y Cantidad */}
                                                <div className="grid grid-cols-12 gap-3">
                                                    <div className="col-span-6">
                                                        <SearchableSelect
                                                            label="Cargo"
                                                            options={config.cargos.map(c => typeof c === 'string' ? c : c.nombre)}
                                                            value={d.cargo}
                                                            onChange={val => updateDotacion(idx, 'cargo', val)}
                                                            placeholder="— SELECCIONAR CARGO —"
                                                            allowCustom={true}
                                                            className="!h-10 !py-0"
                                                        />
                                                    </div>
                                                    <div className="col-span-4">
                                                        <SearchableSelect
                                                            label="Sede Asignada"
                                                            options={form.sedesVinculadas}
                                                            value={d.sede}
                                                            onChange={val => updateDotacion(idx, 'sede', val)}
                                                            placeholder="— SEDE —"
                                                            className="!h-10 !py-0"
                                                            disabled={form.sedesVinculadas.length === 0}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Cant.</label>
                                                        <input type="number" value={d.cantidad} min={1}
                                                            onChange={e => updateDotacion(idx, 'cantidad', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold text-center focus:outline-none focus:border-indigo-400 transition-all"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Segunda fila: CECO, Area, Depto */}
                                                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100/50">
                                                    <SearchableSelect
                                                        label="Centro Costo"
                                                        options={config.cecos.map(c => typeof c === 'string' ? c : c.nombre)}
                                                        value={d.ceco}
                                                        onChange={val => updateDotacion(idx, 'ceco', val)}
                                                        placeholder="— CECO —"
                                                        className="!h-9 !py-0 !text-[10px]"
                                                    />
                                                    <SearchableSelect
                                                        label="Área Operativa"
                                                        options={config.areas.map(a => typeof a === 'string' ? a : a.nombre)}
                                                        value={d.area}
                                                        onChange={val => updateDotacion(idx, 'area', val)}
                                                        placeholder="— ÁREA —"
                                                        className="!h-9 !py-0 !text-[10px]"
                                                    />
                                                    <SearchableSelect
                                                        label="Departamento"
                                                        options={config.departamentos?.map(dep => typeof dep === 'string' ? dep : dep.nombre) || []}
                                                        value={d.departamento}
                                                        onChange={val => updateDotacion(idx, 'departamento', val)}
                                                        placeholder="— DEPTO —"
                                                        className="!h-9 !py-0 !text-[10px]"
                                                    />
                                                </div>

                                                {/* Tercera fila: Sueldo + Bonos */}
                                                <div className="grid grid-cols-12 gap-3 pt-3 border-t border-slate-100/50">
                                                    <div className="col-span-4">
                                                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Sueldo Base Líquido</label>
                                                        <input type="number" value={d.sueldoBaseLiquido || 0} min={0}
                                                            onChange={e => updateDotacion(idx, 'sueldoBaseLiquido', e.target.value)}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-400 transition-all"
                                                        />
                                                    </div>
                                                    <div className="col-span-8 flex items-end justify-end">
                                                        <button onClick={() => addDotacionBonus(idx)}
                                                            className="px-3 py-2 bg-green-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-black uppercase hover:bg-emerald-100 transition-all">
                                                            <Plus size={12} /> Agregar Bono
                                                        </button>
                                                    </div>
                                                </div>

                                                {(d.bonos || []).length > 0 && (
                                                    <div className="space-y-2 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                                        {(d.bonos || []).map((b, bidx) => (
                                                            <div key={bidx} className="grid grid-cols-12 gap-2 items-end">
                                                                <div className="col-span-3">
                                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Bono</label>
                                                                    <input type="text" value={b.type}
                                                                        onChange={e => updateDotacionBonus(idx, bidx, 'type', e.target.value)}
                                                                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400"
                                                                        placeholder="Nombre bono" />
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Modalidad</label>
                                                                    <select value={b.modality} onChange={e => updateDotacionBonus(idx, bidx, 'modality', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400">
                                                                        <option value="Fijo">Fijo</option>
                                                                        <option value="Variable">Variable</option>
                                                                    </select>
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Monto</label>
                                                                    <input type="number" min={0} value={b.amount}
                                                                        onChange={e => updateDotacionBonus(idx, bidx, 'amount', e.target.value)}
                                                                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400" />
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">Comentario</label>
                                                                    <input type="text" value={b.description}
                                                                        onChange={e => updateDotacionBonus(idx, bidx, 'description', e.target.value)}
                                                                        className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400" placeholder="opcional" />
                                                                </div>
                                                                <div className="col-span-1 text-right">
                                                                    <button onClick={() => removeDotacionBonus(idx, bidx)} className="text-red-500 hover:text-red-700 text-xs font-black">Eliminar</button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {/* Summary */}
                                        <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl mt-2">
                                            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Total dotación requerida:</span>
                                            <span className="text-lg font-black text-indigo-800">{form.dotacion.reduce((a, d) => a + (Number(d.cantidad) || 0), 0)} puestos</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notas */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Observaciones</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={3} placeholder="Información adicional del proyecto…"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all resize-none"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-[11px] uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-lg shadow-indigo-200">
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {modal === 'create' ? 'Crear Proyecto' : 'Guardar Cambios'}</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                MODAL: DELETE
            ══════════════════════════════════════════════════════════════ */}
            {modal === 'delete' && selected && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl text-center">
                        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] w-fit mx-auto mb-8">
                            <AlertTriangle size={40} className="text-red-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 mb-3">¿Eliminar Proyecto?</h4>
                        <p className="text-slate-500 mb-2 text-sm">
                            <strong className="text-slate-800">{selected.nombreProyecto || selected.projectName}</strong>
                        </p>
                        <p className="text-slate-400 text-xs mb-8">Esta acción eliminará también la dotación asociada.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                            <button onClick={handleDelete} disabled={saving} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[11px] uppercase hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200 disabled:opacity-60">
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={16} /> Eliminar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Proyectos;
