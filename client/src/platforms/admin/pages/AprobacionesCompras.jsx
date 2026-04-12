import React, { useState, useEffect } from 'react';
import { 
    ShieldCheck, XCircle, CheckCircle2, AlertCircle, ArrowRight,
    Edit3, History, FileText, Search, Clock, MessageSquare, ChevronDown
} from 'lucide-react';
import logisticaApi from '../../logistica/logisticaApi';
import { useAuth } from '../../auth/AuthContext';

const STATUS_BADGE = {
    'Pendiente':        { cls: 'bg-amber-50 text-amber-600 border-amber-200',      label: 'Pendiente' },
    'Revision Gerencia':{ cls: 'bg-purple-50 text-purple-700 border-purple-200',   label: '⚠️ Revisión Gerencia' },
    'Aprobada':         { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: '✓ Aprobada' },
    'Rechazada':        { cls: 'bg-rose-50 text-rose-700 border-rose-200',          label: '✗ Rechazada' },
    'Ordenada':         { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',    label: 'OC Emitida' },
};

const AprobacionesCompras = () => {
    const { user } = useAuth();
    const [solicitudes, setSolicitudes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDetail, setShowDetail] = useState(false);
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [comentario, setComentario] = useState('');
    const [observacion, setObservacion] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const isGerencia = ['ceo_genai', 'ceo', 'gerencia'].includes(user?.role);

    const fetchSolicitudes = async () => {
        try {
            const res = await logisticaApi.get('/solicitudes-compra');
            setSolicitudes(res.data);
        } catch (e) {
            console.error("Error fetching approvals", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSolicitudes(); }, []);

    const detectQuantityChange = () => {
        if (!selected) return false;
        return selected.items.some((item, idx) => {
            const original = selected._original?.items?.[idx];
            return original && parseInt(item.cantidadAutorizada) !== parseInt(original.cantidadSolicitada);
        });
    };

    const handleApproval = async (status) => {
        if (!selected) return;
        const cantidadAlterada = detectQuantityChange();
        if (cantidadAlterada && !observacion.trim()) {
            alert('Debes ingresar una justificación cuando modificas las cantidades solicitadas.');
            return;
        }
        setSaving(true);
        try {
            await logisticaApi.put(`/solicitudes-compra/${selected._id}`, {
                status,
                items: selected.items,
                comentarioAprobador: comentario,
                observacionModificacion: observacion || undefined
            });
            setShowDetail(false);
            setSelected(null);
            setComentario('');
            setObservacion('');
            fetchSolicitudes();
        } catch (err) {
            alert("Error: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const updateQuantity = (idx, val) => {
        const nextItems = [...selected.items];
        nextItems[idx].cantidadAutorizada = parseInt(val);
        setSelected({...selected, items: nextItems});
    };

    const openDetail = (s) => {
        setSelected({ ...s, _original: JSON.parse(JSON.stringify(s)) });
        setComentario('');
        setObservacion('');
        setShowDetail(true);
    };

    const pendingReview = solicitudes.filter(s => s.status === 'Revision Gerencia').length;
    const pendingCount = solicitudes.filter(s => s.status === 'Pendiente').length;

    const filtered = solicitudes.filter(s => {
        const matchSearch = s.motivo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.solicitante?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === 'all' || s.status === filterStatus;
        return matchSearch && matchStatus;
    });

    return (
        <div className="page-sm space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <ShieldCheck className="text-indigo-600" size={32} /> Central de Aprobaciones: Compras
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">Revisión y autorización de requerimientos. Trazabilidad completa.</p>
                </div>
                <div className="flex items-center gap-3">
                    {pendingReview > 0 && (
                        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-4 py-2 rounded-2xl">
                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                            <span className="text-xs font-black text-purple-700 uppercase tracking-widest">{pendingReview} Rev. Gerencia</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                        <span className="text-xs font-black text-amber-700 uppercase tracking-widest">{pendingCount} Pendientes</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" placeholder="Filtrar por motivo o solicitante..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-3xl text-sm font-medium shadow-sm outline-none focus:ring-4 focus:ring-indigo-900/5 transition-all"
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="px-6 py-3 bg-white border border-slate-100 rounded-3xl text-sm font-bold text-slate-600 shadow-sm outline-none"
                >
                    <option value="all">Todos los estados</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Revision Gerencia">Revisión Gerencia</option>
                    <option value="Aprobada">Aprobada</option>
                    <option value="Rechazada">Rechazada</option>
                    <option value="Ordenada">Ordenada</option>
                </select>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    [1,2].map(i => <div key={i} className="h-24 bg-slate-50 rounded-3xl animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <CheckCircle2 size={64} className="mb-4 opacity-10" />
                        <p className="font-black uppercase tracking-widest">Sin resultados</p>
                    </div>
                ) : filtered.map(s => {
                    const badge = STATUS_BADGE[s.status] || STATUS_BADGE['Pendiente'];
                    return (
                        <div 
                            key={s._id} onClick={() => openDetail(s)}
                            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-200/20 transition-all cursor-pointer group flex items-center justify-between"
                        >
                            <div className="flex items-center gap-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner ${s.status === 'Revision Gerencia' ? 'bg-purple-100 text-purple-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                                    {s.status === 'Revision Gerencia' ? <AlertCircle size={24} /> : <FileText size={24} />}
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{s.motivo}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span className="text-indigo-500">{s.solicitante?.name || 'Sistema'}</span>
                                        <span>•</span>
                                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                                        <span>•</span>
                                        <span className={`px-2 py-0.5 rounded-lg border ${s.prioridad === 'Urgente' ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-100 bg-slate-50'}`}>{s.prioridad}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider ${badge.cls}`}>{badge.label}</span>
                                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                                    <ArrowRight size={20} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal Detalle */}
            {showDetail && selected && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[150] flex items-center justify-end">
                    <div className="h-full w-full max-w-2xl bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-hidden flex flex-col">
                        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div>
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Gestión de Requerimiento</span>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tighter mt-1">Revisión de Solicitud</h2>
                                <span className={`inline-block mt-2 px-3 py-1 rounded-xl border text-[10px] font-black uppercase ${STATUS_BADGE[selected.status]?.cls}`}>
                                    {STATUS_BADGE[selected.status]?.label}
                                </span>
                            </div>
                            <button onClick={() => setShowDetail(false)} className="p-3 bg-white text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm transition-all active:scale-95">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-8">
                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Solicitante</p>
                                    <p className="text-sm font-black text-slate-800">{selected.solicitante?.name}</p>
                                    <p className="text-xs font-medium text-slate-500 mt-1">{selected.solicitante?.email}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tipo / Prioridad</p>
                                    <p className="text-sm font-black text-slate-800">{selected.tipoCompra}</p>
                                    <p className={`text-xs font-black mt-1 uppercase ${selected.prioridad === 'Urgente' ? 'text-rose-500' : 'text-slate-400'}`}>{selected.prioridad}</p>
                                </div>
                            </div>

                            {/* Observación de Modificación Previa */}
                            {selected.observacionModificacion && (
                                <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl">
                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <MessageSquare size={12} /> Justificación de Modificación Anterior
                                    </p>
                                    <p className="text-sm text-amber-900 font-medium italic">"{selected.observacionModificacion}"</p>
                                </div>
                            )}

                            {/* Items con ajuste de cantidades */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-2 flex items-center gap-2">
                                    <Edit3 size={14} /> Cantidades — Original vs Autorizado
                                </h4>
                                {selected.items.map((item, idx) => {
                                    const original = selected._original?.items?.[idx];
                                    const changed = original && parseInt(item.cantidadAutorizada || item.cantidadSolicitada) !== parseInt(original.cantidadSolicitada);
                                    return (
                                        <div key={idx} className={`bg-white p-6 rounded-3xl border transition-all shadow-sm flex items-center justify-between gap-6 ${changed ? 'border-amber-300 shadow-amber-50' : 'border-slate-100'}`}>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.productoRef?.nombre}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">SKU: {item.productoRef?.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl">
                                                <div className="text-center px-4 border-r border-slate-200">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Solicitado</p>
                                                    <p className="text-sm font-black text-slate-800">{item.cantidadSolicitada}</p>
                                                </div>
                                                <div className="px-4">
                                                    <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">Autorizar</p>
                                                    <input 
                                                        type="number" min="0"
                                                        defaultValue={item.cantidadAutorizada || item.cantidadSolicitada}
                                                        onChange={(e) => updateQuantity(idx, e.target.value)}
                                                        className="w-16 bg-white p-2 rounded-xl text-xs font-black text-center shadow-inner outline-none ring-2 ring-transparent focus:ring-indigo-200"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Justificación de Modificación (obligatoria si cambian cantidades) */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <AlertCircle size={12} /> Justificación de Modificación (Obligatoria si altera cantidades)
                                </label>
                                <textarea 
                                    placeholder="Explica el motivo de la alteración de cantidades..."
                                    className="w-full p-6 bg-amber-50 border border-amber-100 rounded-3xl text-sm font-bold h-24 resize-none outline-none focus:ring-4 focus:ring-amber-100 transition-all"
                                    value={observacion}
                                    onChange={(e) => setObservacion(e.target.value)}
                                />
                            </div>

                            {/* Comentario Gerencia */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comentario / Instrucciones para Adquisiciones</label>
                                <textarea 
                                    placeholder="Instrucciones o notas adicionales..."
                                    className="w-full p-6 bg-slate-50 border-none rounded-3xl text-sm font-bold h-24 resize-none outline-none focus:ring-4 focus:ring-indigo-900/5 transition-all"
                                    value={comentario}
                                    onChange={(e) => setComentario(e.target.value)}
                                />
                            </div>

                            {/* Historial de Solicitud */}
                            {selected.historial && selected.historial.length > 0 && (
                                <div className="space-y-3 border-t border-slate-50 pt-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <History size={14} /> Historial de Eventos
                                    </h4>
                                    <div className="space-y-3">
                                        {[...selected.historial].reverse().map((h, i) => (
                                            <div key={i} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                                                    {i < selected.historial.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                                                </div>
                                                <div className="pb-4 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-black text-slate-800 uppercase">{h.accion}</span>
                                                        <span className="text-[9px] text-slate-400">· {h.usuario}</span>
                                                        <span className="text-[9px] text-slate-300">· {new Date(h.fecha).toLocaleDateString('es-CL')}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{h.detalle}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        {['Pendiente', 'Revision Gerencia'].includes(selected.status) && (
                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
                                <button 
                                    onClick={() => handleApproval('Rechazada')} disabled={saving}
                                    className="flex-1 px-8 py-5 bg-white text-rose-500 border-2 border-rose-50 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-xl disabled:opacity-40"
                                >
                                    Rechazar
                                </button>
                                {!isGerencia && (
                                    <button 
                                        onClick={() => handleApproval('Revision Gerencia')} disabled={saving}
                                        className="flex-1 px-8 py-5 bg-purple-100 text-purple-700 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-all shadow-xl disabled:opacity-40"
                                    >
                                        Escalar a Gerencia
                                    </button>
                                )}
                                {isGerencia && (
                                    <button 
                                        onClick={() => handleApproval('Aprobada')} disabled={saving}
                                        className="flex-[2] px-10 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-40"
                                    >
                                        <CheckCircle2 size={20} />
                                        {saving ? 'Procesando...' : 'Aprobar Compra'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AprobacionesCompras;
