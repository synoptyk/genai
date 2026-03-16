import React, { useState, useEffect } from 'react';
import { 
    Settings, 
    Plus, 
    Edit2, 
    Trash2, 
    Tag, 
    CheckCircle2, 
    XCircle,
    ArrowLeft,
    Layers
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const ConfiguracionCompras = () => {
    const [tipos, setTipos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ nombre: '', descripcion: '', status: 'Activo' });

    useEffect(() => {
        fetchTipos();
    }, []);

    const fetchTipos = async () => {
        try {
            const res = await logisticaApi.get('/tipos-compra');
            setTipos(res.data);
        } catch (e) {
            console.error("Error fetching tipos", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.nombre) return alert("Nombre es obligatorio");
        try {
            if (editing) {
                await logisticaApi.put(`/tipos-compra/${editing._id}`, form);
            } else {
                await logisticaApi.post('/tipos-compra', form);
            }
            setShowModal(false);
            setEditing(null);
            setForm({ nombre: '', descripcion: '', status: 'Activo' });
            fetchTipos();
        } catch (e) {
            alert("Error al guardar tipo de compra");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar este tipo de compra?")) return;
        try {
            await logisticaApi.delete(`/tipos-compra/${id}`);
            fetchTipos();
        } catch (e) {
            alert("No se pudo eliminar el tipo de compra");
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-100">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Configuración de Compras</h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Maestros / Tipos de Requerimiento</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setEditing(null); setForm({ nombre: '', descripcion: '', status: 'Activo' }); setShowModal(true); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all active:scale-95 flex items-center gap-3"
                >
                    <Plus size={18} /> Nuevo Tipo
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center text-slate-400 font-black animate-pulse uppercase tracking-widest text-xs">Cargando Configuración...</div>
                ) : tipos.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                        <Tag className="mx-auto text-slate-200 mb-4" size={48} />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No hay tipos de compra configurados.</p>
                    </div>
                ) : tipos.map(t => (
                    <div key={t._id} className="group bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button onClick={() => { setEditing(t); setForm(t); setShowModal(true); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(t._id)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white"><Trash2 size={14} /></button>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                <Layers size={20} />
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${t.status === 'Activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                {t.status}
                            </span>
                        </div>

                        <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{t.nombre}</h3>
                        <p className="text-xs font-bold text-slate-400 mt-2 line-clamp-2 leading-relaxed">{t.descripcion || 'Sin descripción adicional.'}</p>
                    </div>
                ))}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-8 bg-indigo-600 text-white">
                            <h2 className="text-xl font-black tracking-tight">{editing ? 'Editar Tipo' : 'Nuevo Tipo de Compra'}</h2>
                            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">Define una categoría para los requerimientos internos.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Tipo</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-black outline-none focus:ring-2 ring-indigo-100 transition-all"
                                    placeholder="Ej: Insumos de Oficina, Ferretería..."
                                    value={form.nombre}
                                    onChange={e => setForm({...form, nombre: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                <textarea 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 ring-indigo-100 transition-all h-24 resize-none"
                                    placeholder="Breve descripción para orientar al solicitante..."
                                    value={form.descripcion}
                                    onChange={e => setForm({...form, descripcion: e.target.value})}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado:</label>
                                <div className="flex gap-2">
                                    {['Activo', 'Inactivo'].map(st => (
                                        <button 
                                            key={st}
                                            onClick={() => setForm({...form, status: st})}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${form.status === st ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                            <button onClick={() => setShowModal(false)} className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] px-4 py-2">Cancelar</button>
                            <button 
                                onClick={handleSubmit}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
                            >
                                {editing ? 'Actualizar' : 'Crear Tipo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConfiguracionCompras;
