import React, { useState, useEffect } from 'react';
import { Tags, Plus, Search, Trash2, AlertCircle, Box, Repeat, Anchor, ArrowRight } from 'lucide-react';
import logisticaApi from '../logisticaApi';

const GestionCategorias = () => {
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        nombre: '',
        descripcion: '',
        prioridadValor: 'Bajo Valor',
        tipoRotacion: 'Rotativo'
    });

    useEffect(() => {
        fetchCategorias();
    }, []);

    const fetchCategorias = async () => {
        try {
            const res = await logisticaApi.get('/categorias');
            setCategorias(res.data);
        } catch (error) {
            console.error("Error fetching categories", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/categorias', form);
            setShowModal(false);
            setForm({ nombre: '', descripcion: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo' });
            fetchCategorias();
        } catch (error) {
            alert("Error al crear categoría: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Tags className="text-sky-600" /> Categorías de Logística
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Clasificación de Activos y Suministros</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 transition-all active:scale-95"
                >
                    <Plus size={16} /> Crear Categoría
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-bold uppercase tracking-widest">Cargando Categorías...</div>
                ) : categorias.length === 0 ? (
                    <div className="col-span-full bg-white p-20 rounded-[3rem] text-center border-2 border-dashed border-slate-200">
                        <Tags className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-bold uppercase tracking-widest">No hay categorías definidas</p>
                    </div>
                ) : categorias.map(cat => (
                    <div key={cat._id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${cat.prioridadValor === 'Alto Valor' ? 'bg-rose-50 text-rose-600' : 'bg-sky-50 text-sky-600'}`}>
                                {cat.prioridadValor}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${cat.tipoRotacion === 'Estático' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {cat.tipoRotacion}
                            </div>
                        </div>
                        <h3 className="font-black text-slate-800 uppercase text-sm mb-1">{cat.nombre}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed line-clamp-2">
                            {cat.descripcion || 'Sin descripción adicional'}
                        </p>
                        
                        <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {cat.tipoRotacion === 'Estático' ? <Anchor size={14} className="text-slate-300" /> : <Repeat size={14} className="text-emerald-400" />}
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {cat.tipoRotacion}
                                </span>
                            </div>
                            <button className="text-slate-300 hover:text-red-500 transition-all p-2">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL CREAR */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleSubmit}>
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nueva Categoría</h2>
                                <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Configuración de Clasificación</p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de Categoría</label>
                                    <input 
                                        required
                                        type="text"
                                        placeholder="Ej: Equipos de Red, EPP, Herramientas..."
                                        value={form.nombre}
                                        onChange={e => setForm({...form, nombre: e.target.value})}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prioridad de Valor</label>
                                        <select 
                                            value={form.prioridadValor}
                                            onChange={e => setForm({...form, prioridadValor: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold outline-none cursor-pointer"
                                        >
                                            <option value="Bajo Valor">Bajo Valor</option>
                                            <option value="Alto Valor">Alto Valor</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Rotación</label>
                                        <select 
                                            value={form.tipoRotacion}
                                            onChange={e => setForm({...form, tipoRotacion: e.target.value})}
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-xs font-bold outline-none cursor-pointer"
                                        >
                                            <option value="Rotativo">Rotativo</option>
                                            <option value="Estático">Estático</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Breve Descripción</label>
                                    <textarea 
                                        value={form.descripcion}
                                        onChange={e => setForm({...form, descripcion: e.target.value})}
                                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold h-24 resize-none outline-none"
                                        placeholder="Uso de la categoría..."
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="bg-sky-600 hover:bg-sky-700 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-sky-600/20 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Categoría'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestionCategorias;
