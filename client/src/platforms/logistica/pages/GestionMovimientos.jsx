import React, { useState, useEffect } from 'react';
import { 
    ArrowRightLeft, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Trash2, 
    User, 
    Package,
    AlertCircle,
    CheckCircle2,
    Truck,
    Camera,
    X
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import SmartSelect from '../components/SmartSelect';

const toSafeNumber = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const GestionMovimientos = () => {
    const [productos, setProductos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: '', message: '' });

    const [form, setForm] = useState({
        tipo: 'ASIGNACION',
        productoRef: '',
        cantidad: 1,
        estadoProducto: 'Nuevo',
        almacenOrigen: '',
        almacenDestino: '',
        motivo: '',
        documentoReferencia: '',
        serie: '',
        fotoUrl: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [p, a] = await Promise.all([
                    logisticaApi.get('/productos'),
                    logisticaApi.get('/almacenes')
                ]);
                setProductos(p.data);
                setAlmacenes(a.data);
            } catch (e) {
                console.error("Error loading data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });
        try {
            await logisticaApi.post('/movimientos', form);
            setStatus({ type: 'success', message: 'Movimiento registrado con éxito.' });
            setForm({ ...form, cantidad: 1, motivo: '', documentoReferencia: '', serie: '' });
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.message || 'Error al registrar movimiento' });
        } finally {
            setLoading(false);
        }
    };

    const movTypes = [
        { id: 'ASIGNACION', label: 'Asignar a Técnico', icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { id: 'REVERSA', label: 'Reversa (Retorno)', icon: ArrowDownCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        { id: 'MERMA', label: 'Reportar Merma', icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50' },
        { id: 'RECEPCION', label: 'Recepción Bodega', icon: ArrowUpCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom border-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Movimientos</h1>
                <p className="text-slate-500 font-medium tracking-tight">Control inteligente de asignaciones, reversas y mermas del personal técnico.</p>
            </div>

            {status.message && (
                <div className={`p-4 rounded-3xl flex items-center gap-3 border ${
                    status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                }`}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="font-bold text-sm tracking-tight">{status.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {movTypes.map(type => (
                    <button
                        key={type.id}
                        onClick={() => setForm({ ...form, tipo: type.id })}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 group ${
                            form.tipo === type.id 
                            ? `border-slate-900 ${type.bg} shadow-xl shadow-slate-200 scale-105 z-10` 
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                    >
                        <div className={`p-3 rounded-2xl transition-all ${form.tipo === type.id ? 'bg-slate-900 text-white' : `${type.bg} ${type.color}`}`}>
                            <type.icon size={24} />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${form.tipo === type.id ? 'text-slate-900' : 'text-slate-400'}`}>
                            {type.label}
                        </span>
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="p-10 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Selector de Producto */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Package size={14} /> Producto / Activo
                            </label>
                            <SmartSelect
                                required
                                value={form.productoRef}
                                onChange={(v) => setForm({ ...form, productoRef: v })}
                                placeholder="Seleccionar Producto"
                                contextKey="movimientos_producto"
                                options={productos.map((p) => ({ value: p._id, label: `${p.nombre} (${p.sku})` }))}
                            />
                        </div>

                        {/* Cantidad y Estado */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                                <input 
                                    type="number" required min="1"
                                    value={form.cantidad}
                                    onChange={e => setForm({...form, cantidad: toSafeNumber(e.target.value, 1)})}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-bold outline-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                                <select 
                                    value={form.estadoProducto}
                                    onChange={e => setForm({...form, estadoProducto: e.target.value})}
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-bold outline-none font-italic"
                                >
                                    <option>Nuevo</option>
                                    <option>Usado Bueno</option>
                                    <option>Usado Malo</option>
                                    <option>Merma</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Origen */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bodega Origen</label>
                            <SmartSelect
                                value={form.almacenOrigen}
                                onChange={(v) => setForm({ ...form, almacenOrigen: v })}
                                placeholder="-- No aplica / Salida --"
                                contextKey="movimientos_origen"
                                options={almacenes.map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                            />
                        </div>

                        {/* Destino */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bodega Destino</label>
                            <SmartSelect
                                value={form.almacenDestino}
                                onChange={(v) => setForm({ ...form, almacenDestino: v })}
                                placeholder="-- No aplica / Entrada --"
                                contextKey="movimientos_destino"
                                options={almacenes.map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                            />
                        </div>
                    </div>

                    {/* Motivo y Referencia */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº de Serie (Para activos)</label>
                            <input 
                                type="text"
                                value={form.serie}
                                onChange={e => setForm({...form, serie: e.target.value})}
                                placeholder="Scan S/N si aplica..."
                                className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doc. Referencia</label>
                            <input 
                                type="text"
                                value={form.documentoReferencia}
                                onChange={e => setForm({...form, documentoReferencia: e.target.value})}
                                placeholder="FAC-123, GD-99, etc..."
                                className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-bold outline-none font-italic"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones / Motivo</label>
                        <textarea 
                            value={form.motivo}
                            onChange={e => setForm({...form, motivo: e.target.value})}
                            rows="3"
                            placeholder="Describa el motivo del movimiento..."
                            className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-slate-900/5 transition-all text-sm font-bold outline-none resize-none"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Camera size={14} /> Evidencia Visual de Entrega/Recepción
                        </label>
                        <div className="flex items-center gap-6">
                             {form.fotoUrl ? (
                                <div className="relative group">
                                    <img src={form.fotoUrl} alt="Preview" className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl shadow-slate-200" />
                                    <button 
                                        type="button"
                                        onClick={() => setForm({...form, fotoUrl: ''})}
                                        className="absolute -top-3 -right-3 bg-rose-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                             ) : (
                                <label className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-400 group">
                                    <Camera size={32} className="group-hover:scale-110 transition-transform text-indigo-500" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Capturar Foto</span>
                                    <input 
                                        type="file" accept="image/*" capture="environment" className="hidden"
                                        onChange={e => {
                                            const file = e.target.files[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setForm({...form, fotoUrl: ev.target.result});
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                             )}
                             <p className="flex-1 text-xs font-bold text-slate-400 uppercase leading-relaxed tracking-widest italic">
                                "La captura de evidencia visual asegura el blindaje administrativo de la operación."
                             </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-400">Campos requeridos verificados.</span>
                    <button 
                        type="submit" disabled={loading}
                        className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Procesando...' : 'Confirmar Movimiento'}
                        <ArrowRightLeft size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GestionMovimientos;
