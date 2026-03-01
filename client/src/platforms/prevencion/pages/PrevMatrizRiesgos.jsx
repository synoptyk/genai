import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Edit3, CheckCircle2, Info, ChevronRight,
    Activity, ShieldAlert, Save, X, Settings2, Loader2
} from 'lucide-react';
import { matrizRiesgosApi } from '../prevencionApi';

const PrevMatrizRiesgos = () => {
    const [riesgos, setRiesgos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showEdit, setShowEdit] = useState(false);
    const [currentRiesgo, setCurrentRiesgo] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchRiesgos();
    }, []);

    const fetchRiesgos = async () => {
        setLoading(true);
        try {
            const res = await matrizRiesgosApi.getAll();
            setRiesgos(res.data || []);
        } catch (e) {
            console.error('Error fetching matriz:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (currentRiesgo._id) {
                await matrizRiesgosApi.update(currentRiesgo._id, currentRiesgo);
            } else {
                await matrizRiesgosApi.create(currentRiesgo);
            }
            setShowEdit(false);
            fetchRiesgos();
        } catch (e) {
            console.error('Error saving riesgo:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este riesgo de la matriz normativa?')) return;
        try {
            await matrizRiesgosApi.remove(id);
            fetchRiesgos();
        } catch (e) {
            console.error('Error deleting:', e);
        }
    };

    const calcValoracion = (p, s) => (p || 1) * (s || 1);
    const getClasificacion = (val) => {
        if (val <= 5) return { label: 'BAJO', color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
        if (val <= 10) return { label: 'MEDIO', color: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
        if (val <= 16) return { label: 'ALTO', color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' };
        return { label: 'CRÍTICO', color: 'bg-rose-500', text: 'text-rose-700', bg: 'bg-rose-50' };
    };

    const filtered = riesgos.filter(r => {
        const t = searchTerm.toLowerCase();
        return !searchTerm ||
            r.peligro?.toLowerCase().includes(t) ||
            r.riesgo?.toLowerCase().includes(t) ||
            r.proyecto?.toLowerCase().includes(t);
    });

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-32">
            {/* HEADER */}
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-6">
                    <div className="bg-slate-900 text-white p-4 rounded-[1.5rem] shadow-xl shadow-slate-200 -rotate-3">
                        <SlidersHorizontal size={28} />
                    </div>
                    <div className="text-left">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Matriz <span className="text-rose-600">IPER Dinámica</span></h1>
                        <p className="text-slate-400 text-[10px] font-black mt-2 uppercase tracking-[0.3em]">Identificación de Peligros y Evaluación de Riesgos v5.0</p>
                    </div>
                </div>
                <button
                    onClick={() => { setCurrentRiesgo({ peligro: '', riesgo: '', consecuencia: '', p: 1, s: 1, medidas: [] }); setShowEdit(true); }}
                    className="flex items-center gap-3 bg-rose-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-rose-100"
                >
                    <Plus size={18} /> Nuevo Riesgo Normativo
                </button>
            </div>

            {/* FILTERS & SEARCH */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 mb-8 shadow-sm flex items-center gap-6">
                <div className="flex-1 relative text-left">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                    <input type="text" placeholder="BUSCAR POR PELIGRO, RIESGO O PROYECTO..."
                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-16 pr-8 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-rose-500/5 text-xs font-bold uppercase tracking-wider" />
                </div>
                {loading && <Loader2 size={24} className="animate-spin text-rose-500" />}
            </div>

            {/* LISTA DE RIESGOS */}
            <div className="grid grid-cols-1 gap-6 text-left">
                {filtered.length === 0 && !loading && (
                    <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                        <ShieldAlert size={48} className="text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No se encontraron riesgos en la matriz</p>
                    </div>
                )}
                {filtered.map(r => {
                    const val = calcValoracion(r.probabilidad, r.severidad);
                    const config = getClasificacion(val);
                    return (
                        <div key={r._id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:shadow-slate-100 transition-all flex flex-col md:flex-row items-center gap-8 group relative overflow-hidden">
                            <div className={`absolute top-0 left-0 w-2 h-full ${config.color}`} />
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black bg-slate-100 px-4 py-2 rounded-xl text-slate-500 uppercase">PELIGRO: {r.peligro}</span>
                                    {r.proyecto && <span className="text-[10px] font-black bg-indigo-50 px-4 py-2 rounded-xl text-indigo-500 uppercase">Proyecto: {r.proyecto}</span>}
                                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase ${config.bg} ${config.text}`}>Nivel: {config.label} ({val})</div>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">{r.riesgo}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} className="text-rose-500" /> Consecuencia: {r.consecuencia}
                                </p>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {r.medidasControl?.map((m, idx) => (
                                        <div key={idx} className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8px] font-black px-3 py-1.5 rounded-lg uppercase flex items-center gap-1.5">
                                            <ShieldCheck size={12} /> {m}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-[2rem] border border-slate-100 min-w-[140px] gap-2">
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Matriz PxS</div>
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg font-black text-slate-900">{r.probabilidad}</span>
                                        <span className="text-[7px] font-black text-slate-400">P</span>
                                    </div>
                                    <X size={12} className="text-slate-300" />
                                    <div className="flex flex-col items-center">
                                        <span className="text-lg font-black text-slate-900">{r.severidad}</span>
                                        <span className="text-[7px] font-black text-slate-400">S</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button onClick={() => { setCurrentRiesgo(r); setShowEdit(true); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all"><Edit3 size={18} /></button>
                                <button onClick={() => handleDelete(r._id)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-rose-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* INFO PANEL */}
            <div className="mt-12 p-8 bg-slate-900 rounded-[3rem] text-white flex items-center justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute right-0 top-0 opacity-10 group-hover:rotate-12 transition-transform">
                    <ShieldCheck size={160} />
                </div>
                <div className="flex items-center gap-6 relative z-10 text-left">
                    <div className="bg-rose-600 p-6 rounded-3xl shadow-lg">
                        <Zap size={32} />
                    </div>
                    <div>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter italic">Sincronización en <span className="text-rose-500">Tiempo Real</span></h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 max-w-lg leading-relaxed">Cualquier cambio en la matriz IPER se verá reflejado instantáneamente en los formularios AST de terreno, asegurando el cumplimiento normativo global.</p>
                    </div>
                </div>
                <button className="px-10 py-5 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all relative z-10 shadow-xl">Auditar Matriz</button>
            </div>

            {/* MODAL EDICION */}
            {showEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
                    <form onSubmit={handleSave} className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-left">
                        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <Settings2 className="text-rose-500" size={24} />
                                <h3 className="text-xl font-black uppercase italic tracking-tighter">{currentRiesgo._id ? 'Editar' : 'Nuevo'} Riesgo <span className="text-rose-500">IPER</span></h3>
                            </div>
                            <button type="button" onClick={() => setShowEdit(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-10 space-y-6 overflow-y-auto max-h-[70vh]">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Peligro / Fuente</label>
                                    <input type="text" required className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs"
                                        value={currentRiesgo.peligro} onChange={e => setCurrentRiesgo({ ...currentRiesgo, peligro: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Riesgo / Evento</label>
                                    <input type="text" required className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs"
                                        value={currentRiesgo.riesgo} onChange={e => setCurrentRiesgo({ ...currentRiesgo, riesgo: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Consecuencia Prevista</label>
                                <textarea required className="w-full p-6 rounded-2xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs"
                                    value={currentRiesgo.consecuencia} onChange={e => setCurrentRiesgo({ ...currentRiesgo, consecuencia: e.target.value })} rows="2" />
                            </div>
                            <div className="grid grid-cols-2 gap-10 bg-slate-50 p-6 rounded-2xl">
                                <div className="space-y-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Probabilidad (P): {currentRiesgo.probabilidad}</label>
                                    <input type="range" min="1" max="5" className="w-full accent-rose-600"
                                        value={currentRiesgo.probabilidad || 1} onChange={e => setCurrentRiesgo({ ...currentRiesgo, probabilidad: parseInt(e.target.value) })} />
                                    <div className="flex justify-between text-[8px] font-black text-slate-400"><span>1 - Remoto</span><span>5 - Frecuente</span></div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Severidad (S): {currentRiesgo.severidad}</label>
                                    <input type="range" min="1" max="5" className="w-full accent-rose-600"
                                        value={currentRiesgo.severidad || 1} onChange={e => setCurrentRiesgo({ ...currentRiesgo, severidad: parseInt(e.target.value) })} />
                                    <div className="flex justify-between text-[8px] font-black text-slate-400"><span>1 - Leve</span><span>5 - Fatal</span></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Medidas de Control (Separadas por coma)</label>
                                <input type="text" className="w-full px-6 py-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-rose-500 outline-none font-bold uppercase text-xs"
                                    value={currentRiesgo.medidasControl?.join(', ')}
                                    onChange={e => setCurrentRiesgo({ ...currentRiesgo, medidasControl: e.target.value.split(',').map(s => s.trim()).filter(s => s) })} />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                            <button type="button" onClick={() => setShowEdit(false)} className="px-8 py-4 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-white bg-transparent transition-all">Cancelar</button>
                            <button type="submit" disabled={saving} className="px-10 py-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-rose-600 transition-all disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                {currentRiesgo._id ? 'Actualizar Matriz' : 'Guardar en Matriz'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default PrevMatrizRiesgos;
