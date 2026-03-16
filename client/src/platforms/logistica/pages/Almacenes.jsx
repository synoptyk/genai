import React, { useState, useEffect } from 'react';
import { 
    MapPin, 
    Plus, 
    User, 
    MoreHorizontal, 
    Home,
    Smartphone,
    Warehouse,
    Truck,
    BadgeCheck
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const Almacenes = () => {
    const [almacenes, setAlmacenes] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        nombre: '',
        codigo: '',
        tipo: 'Central',
        tecnicoRef: '',
        ubicacion: { direccion: '' }
    });

    const fetchData = async () => {
        try {
            const [almRes, tecRes] = await Promise.all([
                logisticaApi.get('/almacenes'),
                logisticaApi.get('/tecnicos') // Asumimos que existe este endpoint o lo crearemos
            ]);
            setAlmacenes(almRes.data);
            setTecnicos(tecRes.data);
        } catch (e) {
            console.error("Error loading data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/almacenes', form);
            setShowModal(false);
            setForm({ nombre: '', codigo: '', tipo: 'Central', tecnicoRef: '', ubicacion: { direccion: '' } });
            fetchData();
        } catch (err) {
            alert("Error al crear almacén: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const getIcon = (tipo) => {
        switch (tipo) {
            case 'Móvil': return <Truck size={24} />;
            case 'Técnico': return <User size={24} />;
            case 'Sucursal': return <Home size={24} />;
            default: return <Warehouse size={24} />;
        }
    };

    const getTipoColor = (tipo) => {
        switch (tipo) {
            case 'Central': return 'text-indigo-600 bg-indigo-50';
            case 'Móvil': return 'text-amber-600 bg-amber-50';
            case 'Técnico': return 'text-emerald-600 bg-emerald-50';
            default: return 'text-slate-600 bg-slate-50';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Centros de Abastecimiento</h1>
                    <p className="text-slate-500 text-sm">Control de Bodega Central, Sucursales y Furgones Móviles.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-sm flex items-center gap-2 shadow-xl shadow-slate-200"
                >
                    <Plus size={18} />
                    Crear Nueva Bodega
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-56 bg-white rounded-3xl animate-pulse" />)
                ) : almacenes.map((alm) => (
                    <div key={alm._id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                        {/* Status Chip */}
                        <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${getTipoColor(alm.tipo)}`}>
                            {alm.tipo}
                        </div>

                        <div className="flex items-start justify-between mb-6">
                            <div className={`p-4 rounded-2xl transition-all ${getTipoColor(alm.tipo)}`}>
                                {getIcon(alm.tipo)}
                            </div>
                            <button className="p-2 text-slate-300 hover:text-slate-600 transition-all">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {alm.nombre}
                            {alm.status === 'Activo' && <BadgeCheck size={16} className="text-emerald-500" />}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 font-mono font-black italic">
                            {alm.codigo || 'SIN-CODIGO'}
                        </p>

                        <div className="mt-6 space-y-4 pt-4 border-t border-slate-50">
                            {alm.tipo !== 'Móvil' && alm.tipo !== 'Técnico' && (
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <MapPin size={16} className="text-slate-400" />
                                    <span className="line-clamp-1">{alm.ubicacion?.direccion || 'Ubicación dinámica'}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <User size={16} className="text-slate-400" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 leading-none">
                                        {alm.encargado?.name || 'No asignado'}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Encargado</span>
                                </div>
                            </div>
                            
                            {(alm.tecnicoRef || alm.tipo === 'Móvil' || alm.tipo === 'Técnico') && (
                                <div className="p-3 bg-emerald-50/50 rounded-xl mt-2 border border-emerald-100/50">
                                    <p className="text-[9px] font-black text-emerald-700 uppercase mb-1">Técnico Titular (Dotación)</p>
                                    <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                        <Truck size={12} />
                                        {alm.tecnicoRef ? `${alm.tecnicoRef.nombres} ${alm.tecnicoRef.apellidos}` : 'No vinculado'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Crear Almacén */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleCreate}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Nueva Unidad Logística</h2>
                                <p className="text-slate-400 text-sm font-medium">Registra una bodega central o un furgón para técnicos.</p>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre / Identificador</label>
                                        <input 
                                            required placeholder="Ej: Bodega Norte"
                                            value={form.nombre}
                                            onChange={e => setForm({...form, nombre: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código SKU/Loc</label>
                                        <input 
                                            required placeholder="BOD-01"
                                            value={form.codigo}
                                            onChange={e => setForm({...form, codigo: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Unidad</label>
                                    <select 
                                        value={form.tipo}
                                        onChange={e => setForm({...form, tipo: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    >
                                        <option value="Central">Bodega Central</option>
                                        <option value="Móvil">Furgón Móvil (Flota)</option>
                                        <option value="Técnico">Asignación Personal (Mochila)</option>
                                        <option value="Sucursal">Sucursal / Punto Venta</option>
                                    </select>
                                </div>

                                {(form.tipo === 'Móvil' || form.tipo === 'Técnico') && (
                                    <div className="space-y-2 animate-in slide-in-from-top">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vincular a Técnico</label>
                                        <select 
                                            required
                                            value={form.tecnicoRef}
                                            onChange={e => setForm({...form, tecnicoRef: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-emerald-100"
                                        >
                                            <option value="">Seleccionar Técnico Responsable</option>
                                            {tecnicos.map(t => (
                                                <option key={t._id} value={t._id}>{t.nombres} {t.apellidos} ({t.rut})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {form.tipo !== 'Móvil' && form.tipo !== 'Técnico' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección Física</label>
                                        <input 
                                            placeholder="Dirección completa..."
                                            value={form.ubicacion.direccion}
                                            onChange={e => setForm({...form, ubicacion: { direccion: e.target.value }})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {saving ? 'Guardando...' : 'Crear Unidad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {!loading && almacenes.length === 0 && (
                <div className="bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-slate-400 text-center">
                    <Warehouse size={48} className="mb-4 opacity-20" />
                    <h3 className="font-bold text-slate-600">No hay centros de abastecimiento</h3>
                    <p className="text-sm">Empieza registrando tu bodega central o furgones móviles.</p>
                </div>
            )}
        </div>
    );
};

export default Almacenes;
