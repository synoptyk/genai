import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, Activity, Search, Upload, Eye, Loader2, CheckCircle2,
    Shirt, HardHat, AlertCircle, RefreshCcw
} from 'lucide-react';
import { candidatosApi } from '../rrhhApi';

const ITEM_LIST = ['Casco', 'Lentes de Seguridad', 'Guantes de Cabritilla', 'Zapatos de Seguridad', 'Chaleco Reflectante', 'Protector Auditivo'];

const SeguridadPPE = () => {
    const [candidatos, setCandidatos] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [updating, setUpdating] = useState(false);

    const fetchCandidatos = useCallback(async () => {
        setLoading(true);
        try {
            const res = await candidatosApi.getAll();
            const relevant = res.data.filter(c =>
                ['En Acreditación', 'En Documentación', 'Contratado'].includes(c.status)
            );
            setCandidatos(relevant);
            if (selected) {
                const updated = res.data.find(c => c._id === selected._id);
                setSelected(updated);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [selected]);

    useEffect(() => {
        fetchCandidatos();
    }, [fetchCandidatos]);

    const handleUpdateAcred = async (id, data) => {
        setUpdating(true);
        try {
            await candidatosApi.updateAccreditation(id, data);
            await fetchCandidatos();
            // No alert for silence/flow
        } catch (e) {
            console.error('Error al actualizar acreditación:', e);
        } finally {
            setUpdating(false);
        }
    };


    const toggleEPP = async (item) => {
        if (!selected) return;
        const currentPPE = selected.accreditation?.ppe || [];
        const index = currentPPE.findIndex(p => p.item === item);

        let newPPE = [...currentPPE];
        if (index > -1) {
            newPPE[index] = { ...newPPE[index], delivered: !newPPE[index].delivered, deliveredAt: new Date() };
        } else {
            newPPE.push({ item, delivered: true, deliveredAt: new Date() });
        }

        await handleUpdateAcred(selected._id, { ppe: newPPE });
    };

    const filtered = candidatos.filter(c =>
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.rut.includes(searchTerm)
    );

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl shadow-slate-200">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none uppercase">Seguridad <span className="text-rose-600">& PPE</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.2em] flex items-center gap-2">
                            Gestión de Acreditación y Dotación de Seguridad
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchCandidatos} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm">
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-250px)] min-h-[600px]">
                {/* SIDEBAR LIST */}
                <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Buscar colaborador..."
                                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-wider focus:ring-4 focus:ring-rose-500/5 focus:border-rose-400 outline-none transition-all shadow-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
                        {loading && !candidatos.length ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-3">
                                <Loader2 className="animate-spin text-rose-500" size={24} />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando nómina...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-10 text-center">
                                <Search size={32} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">No se encontraron resultados para "{searchTerm}"</p>
                            </div>
                        ) : filtered.map(c => (
                            <button
                                key={c._id}
                                onClick={() => setSelected(c)}
                                className={`w-full p-5 text-left transition-all hover:bg-slate-50 flex items-center gap-4 ${selected?._id === c._id ? 'bg-rose-50 border-r-4 border-rose-600' : ''}`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${selected?._id === c._id ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}>
                                    {c.fullName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-slate-800 uppercase text-[11px] truncate">{c.fullName}</p>
                                    <p className="text-[9px] text-slate-400 font-bold mt-0.5 tracking-tight">{c.rut} · {c.position}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${c.status === 'Contratado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                            }`}>
                                            {c.status}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="lg:col-span-3 h-full">
                    {selected ? (
                        <div className="space-y-6 h-full flex flex-col">
                            {/* Profile Bar */}
                            <div className="bg-white p-7 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-600 font-black text-3xl shadow-inner group relative">
                                        {selected.profilePic ? (
                                            <img src={selected.profilePic} className="w-full h-full object-cover rounded-3xl" alt="profile" />
                                        ) : selected.fullName.charAt(0)}
                                        {updating && (
                                            <div className="absolute inset-0 bg-white/60 rounded-3xl flex items-center justify-center">
                                                <Loader2 size={24} className="animate-spin text-rose-600" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selected.fullName}</h3>
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{selected.rut}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                                            <AlertCircle size={12} className="text-rose-400" /> {selected.position} · {selected.projectName || 'GENERAL'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        Certificación HSE <div className={`w-2 h-2 rounded-full ${selected.accreditation?.status === 'Completado' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    </p>
                                    <select
                                        className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 outline-none transition-all shadow-sm ${selected.accreditation?.status === 'Completado' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-amber-500 bg-amber-50 text-amber-900'}`}
                                        value={selected.accreditation?.status || 'Pendiente'}
                                        onChange={e => handleUpdateAcred(selected._id, { status: e.target.value })}
                                        disabled={updating}
                                    >
                                        <option value="Pendiente">Pendiente</option>
                                        <option value="En Proceso">En Proceso</option>
                                        <option value="Completado">Acreditado</option>
                                        <option value="Vencido">Vencido</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* SIZES / TALLAS */}
                                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                                    <Shirt size={20} />
                                                </div>
                                                <h4 className="font-black text-slate-800 uppercase tracking-tight">Tallas de Dotación</h4>
                                            </div>
                                            <button className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline px-3 py-1 bg-indigo-50 rounded-lg">Editar Todo</button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { label: 'Camisa/Polera', val: selected.shirtSize || 'S', key: 'shirtSize' },
                                                { label: 'Pantalón', val: selected.pantsSize || '42', key: 'pantsSize' },
                                                { label: 'Parka/Casaca', val: selected.jacketSize || 'M', key: 'jacketSize' },
                                                { label: 'Calzado', val: selected.shoeSize || '40', key: 'shoeSize' }
                                            ].map(item => (
                                                <div key={item.key} className="bg-slate-50 p-4 rounded-2xl border border-slate-50 group hover:bg-slate-100 transition-colors">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-black text-slate-700">{item.val}</span>
                                                        <button className="opacity-0 group-hover:opacity-100 p-1.5 bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                                                            <RefreshCcw size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* PPE DELIVERY */}
                                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                                                <HardHat size={20} />
                                            </div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">Entrega de EPP</h4>
                                        </div>
                                        <div className="space-y-3">
                                            {ITEM_LIST.map(item => {
                                                const isDelivered = selected.accreditation?.ppe?.find(p => p.item === item)?.delivered;
                                                return (
                                                    <button
                                                        key={item}
                                                        onClick={() => toggleEPP(item)}
                                                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isDelivered
                                                            ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                                                            : 'bg-white border-slate-100 text-slate-500 hover:border-rose-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-1.5 rounded-lg ${isDelivered ? 'bg-white text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                                                                <CheckCircle2 size={14} />
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-tight">{item}</span>
                                                        </div>
                                                        {isDelivered ? (
                                                            <span className="text-[9px] font-black uppercase text-emerald-600/60">Recibido</span>
                                                        ) : (
                                                            <span className="text-[9px] font-black uppercase opacity-40">Pendiente</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* EXAMS & DOCUMENTS */}
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                                <Activity size={20} />
                                            </div>
                                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-lg">Exámenes Ocupacionales</h4>
                                        </div>
                                        <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg active:scale-95">
                                            <Upload size={14} /> Subir Comprobante
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { title: 'Pre-ocupacional', status: 'OK', date: '12 Feb 2026' },
                                            { title: 'Altura Física', status: 'OK', date: '15 Feb 2026' },
                                            { title: 'Psicométrico', status: 'Pendiente', date: '--' },
                                        ].map(exam => (
                                            <div key={exam.title} className="p-6 bg-slate-50/50 rounded-3xl border border-slate-50 relative overflow-hidden group hover:border-amber-200 transition-all">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{exam.title}</p>
                                                <p className="text-xs font-black text-slate-800 mt-2 mb-4 uppercase">{exam.status}</p>
                                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                                    <span className="text-[9px] font-medium text-slate-400">{exam.date}</span>
                                                    <div className="flex gap-1.5">
                                                        <button className="p-2 bg-white rounded-lg text-slate-400 hover:text-rose-600 shadow-sm transition-all"><Eye size={12} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full bg-white rounded-[3rem] border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none">
                                <ShieldCheck size={800} className="absolute -top-40 -left-60" />
                            </div>
                            <HardHat size={64} className="mb-6 opacity-10 animate-bounce" />
                            <h4 className="text-lg font-black text-slate-400 uppercase tracking-[0.3em]">Consola de Seguridad</h4>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4 max-w-xs text-center leading-loose">
                                Seleccione un colaborador de la lista lateral para gestionar su acreditación, tallas y elementos de protección personal.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SeguridadPPE;
