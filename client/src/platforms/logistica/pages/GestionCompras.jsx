import React, { useState, useEffect } from 'react';
import { 
    ShoppingCart, 
    FileText, 
    CheckCircle, 
    Clock, 
    AlertTriangle,
    Plus,
    Trash2,
    Eye,
    TrendingUp,
    ShieldCheck,
    Truck,
    Building2,
    DollarSign,
    ClipboardCheck,
    Search,
    Settings
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import PurchaseDocumentView from '../components/PurchaseDocumentView';
import SignaturePad from '../components/SignaturePad';
import ConfiguracionCompras from './ConfiguracionCompras';

const GestionCompras = () => {
    const [solicitudes, setSolicitudes] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [view, setView] = useState('list'); // 'list' or 'config'
    
    // Formulario de Solicitud
    const [form, setForm] = useState({
        motivo: '',
        tipoCompraRef: '',
        prioridad: 'Normal',
        proveedorSugeridoRef: '',
        items: [{ productoRef: '', cantidadSolicitada: 1, modelo: '', serie: '' }],
        firmaSolicitante: null
    });

    const [tiposCompra, setTiposCompra] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [selectedSC, setSelectedSC] = useState(null);
    const [showOCModal, setShowOCModal] = useState(false);
    const [showViewer, setShowViewer] = useState(false);
    const [viewData, setViewData] = useState(null);
    const [viewType, setViewType] = useState('SC');

    const [quoteForm, setQuoteForm] = useState({
        proveedorRef: '',
        precioTotal: 0,
        observaciones: ''
    });

    const [ocForm, setOcForm] = useState({
        items: [] // Para precios unitarios finales
    });

    const fetchData = async () => {
        try {
            const [solRes, prodRes, provRes, configRes] = await Promise.all([
                logisticaApi.get('/solicitudes-compra'),
                logisticaApi.get('/productos'),
                logisticaApi.get('/proveedores'),
                logisticaApi.get('/configuracion-maestra')
            ]);
            setSolicitudes(solRes.data);
            setProductos(prodRes.data);
            setProveedores(provRes.data);
            if (configRes.data.tiposCompra) setTiposCompra(configRes.data.tiposCompra);
        } catch (e) {
            console.error("Error fetching purchase data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const addItem = () => setForm({...form, items: [...form.items, { productoRef: '', cantidadSolicitada: 1, modelo: '', serie: '' }]});
    const updateItem = (idx, field, val) => {
        const next = [...form.items];
        next[idx][field] = val;
        // Si cambia el producto, intentar traer el modelo por defecto
        if (field === 'productoRef') {
            const p = productos.find(x => x._id === val);
            if (p) next[idx].modelo = p.modelo || '';
        }
        setForm({...form, items: next});
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!form.firmaSolicitante) return alert("La firma del solicitante es obligatoria");
        setSaving(true);
        try {
            await logisticaApi.post('/solicitudes-compra', form);
            setShowModal(false);
            setForm({ 
                motivo: '', 
                tipoCompraRef: '', 
                prioridad: 'Normal', 
                proveedorSugeridoRef: '',
                items: [{ productoRef: '', cantidadSolicitada: 1 }],
                firmaSolicitante: null
            });
            fetchData();
        } catch (err) {
            alert("Error al enviar solicitud: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Pendiente': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Aprobada': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'Cotizando': return 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm shadow-indigo-50';
            case 'Finalizada': return 'bg-slate-50 text-slate-600 border-slate-100';
            case 'Rechazada': return 'bg-rose-50 text-rose-600 border-rose-100';
            case 'Ordenada': return 'bg-sky-50 text-sky-600 border-sky-100';
            default: return 'bg-slate-50 text-slate-400';
        }
    };

    const handleAddQuote = async () => {
        if (!quoteForm.proveedorRef || !quoteForm.precioTotal) return alert("Completa los datos de cotización");
        try {
            const updatedQuotes = [...(selectedSC.cotizaciones || []), { ...quoteForm, fecha: new Date() }];
            await logisticaApi.put(`/solicitudes-compra/${selectedSC._id}`, { 
                cotizaciones: updatedQuotes,
                status: 'Cotizando'
            });
            setShowQuoteModal(false);
            fetchData();
        } catch (e) {
            alert("Error al guardar cotización");
        }
    };

    const handlePrepareOC = (sc) => {
        setSelectedSC(sc);
        setOcForm({
            items: sc.items.map(it => ({
                productoRef: it.productoRef._id,
                cantidad: it.cantidadAutorizada || it.cantidadSolicitada,
                precioUnitario: 0,
                subtotal: 0
            })),
            proveedorRef: sc.proveedorSeleccionado?._id || ''
        });
        setShowOCModal(true);
    };

    const handleCreateOC = async () => {
        try {
            const total = ocForm.items.reduce((sum, it) => sum + it.subtotal, 0);
            await logisticaApi.post('/ordenes-compra', {
                ...ocForm,
                solicitudRef: selectedSC._id,
                total
            });
            setShowOCModal(false);
            fetchData();
        } catch (e) {
            alert("Error al generar Orden de Compra");
        }
    };

    const handleViewDocument = (data, type) => {
        setViewData(data);
        setViewType(type);
        setShowViewer(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Círculo de Compras 360</h1>
                    <p className="text-slate-500 text-sm font-medium">Gestión integral desde solicitud hasta orden de compra.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setView(view === 'list' ? 'config' : 'list')}
                        className={`p-3 rounded-2xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest ${view === 'config' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm'}`}
                    >
                        <Settings size={18} /> {view === 'config' ? 'Volver al Dashboard' : 'Configuración'}
                    </button>
                    {view === 'list' && (
                        <button 
                            onClick={() => setShowModal(true)}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-indigo-200"
                        >
                            <Plus size={18} />
                            Nueva Solicitud
                        </button>
                    )}
                </div>
            </div>

            {view === 'config' ? (
                <ConfiguracionCompras />
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Pendientes</p>
                        <p className="text-xl font-black text-slate-800">{solicitudes.filter(s => s.status === 'Pendiente').length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Aprobadas</p>
                        <p className="text-xl font-black text-slate-800">{solicitudes.filter(s => s.status === 'Aprobada').length}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-5">Solicitud / Fecha</th>
                                <th className="px-8 py-5 text-center">Tipo / Prioridad</th>
                                <th className="px-8 py-5">Items / Detalle</th>
                                <th className="px-8 py-5 text-center">Estado</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1,2].map(i => <tr key={i} className="animate-pulse"><td colSpan="5" className="h-20" /></tr>)
                            ) : solicitudes.map(s => (
                                <tr key={s._id} className="hover:bg-slate-50/40 transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black text-slate-700 tracking-tighter">{s.codigoSC || `Req #${s._id.slice(-6).toUpperCase()}`}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                                {new Date(s.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-900 text-white shadow-sm shadow-slate-200`}>
                                                {s.tipoCompraRef?.nombre || 'General'}
                                            </span>
                                            <span className={`text-[8px] font-bold uppercase ${s.prioridad === 'Urgente' ? 'text-rose-500 underline decoration-2 underline-offset-2' : 'text-slate-400'}`}>
                                                {s.prioridad}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="max-w-[300px]">
                                            <p className="text-xs font-bold text-slate-600 truncate mb-2">{s.motivo}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {s.items.map((item, idx) => (
                                                    <span key={idx} className="px-2 py-1 bg-white text-slate-500 text-[10px] font-black rounded-lg border border-slate-100 shadow-sm flex items-center gap-1.5">
                                                        <span className="text-indigo-600">{item.cantidadSolicitada}x</span> {item.productoRef?.nombre}
                                                        <span className="text-[8px] opacity-70 ml-1">[{item.productoRef?.sku}]</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${getStatusColor(s.status)}`}>
                                            {s.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {s.status === 'Aprobada' && (
                                                <button 
                                                    onClick={() => { setSelectedSC(s); setQuoteForm({ proveedorRef: '', precioTotal: 0, observaciones: '' }); setShowQuoteModal(true); }}
                                                    className="p-2.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                    title="Agregar Cotización"
                                                >
                                                    <DollarSign size={16} />
                                                </button>
                                            )}
                                            {s.status === 'Cotizando' && (
                                                <button 
                                                    onClick={() => handlePrepareOC(s)}
                                                    className="p-2.5 bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white rounded-xl transition-all shadow-sm"
                                                    title="Generar Orden de Compra"
                                                >
                                                    <Truck size={16} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleViewDocument(s, 'SC')}
                                                className="p-2.5 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-xl transition-all shadow-sm"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            </>
            )}

            {/* Modal Nueva Solicitud */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[94vh]">
                        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
                            <div className="p-8 border-b border-slate-50 bg-indigo-50/30">
                                <h2 className="text-2xl font-black text-indigo-900 tracking-tight flex items-center gap-3">
                                    <ShoppingCart /> Nueva Solicitud de Compra
                                </h2>
                                <p className="text-indigo-700/60 text-[10px] font-black uppercase tracking-widest mt-1">El material solicitado será comparado con el stock actual antes de la aprobación.</p>
                            </div>
                            
                            <div className="p-8 space-y-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Compra</label>
                                        <select 
                                            value={form.tipoCompraRef}
                                            onChange={e => setForm({...form, tipoCompraRef: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100 transition-all"
                                        >
                                            <option value="">Seleccionar Tipo...</option>
                                            {tiposCompra.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prioridad</label>
                                        <select 
                                            value={form.prioridad}
                                            onChange={e => setForm({...form, prioridad: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        >
                                            <option>Normal</option>
                                            <option>Urgente</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar Proveedor</label>
                                        <select 
                                            value={form.proveedorSugeridoRef}
                                            onChange={e => setForm({...form, proveedorSugeridoRef: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-indigo-100 transition-all"
                                        >
                                            <option value="">Seleccionar proveedor registrado...</option>
                                            {proveedores.map(p => <option key={p._id} value={p._id}>{p.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificación / Motivo</label>
                                    <textarea 
                                        required
                                        placeholder="Ej: Reposición de stock mínimo para proyecto X..."
                                        value={form.motivo}
                                        onChange={e => setForm({...form, motivo: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none h-24 resize-none"
                                    />
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items Solicitados</label>
                                        <button type="button" onClick={addItem} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline">
                                            <Plus size={14} /> Agregar Item
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        {form.items.map((item, idx) => (
                                            <div key={idx} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-3 items-end">
                                                    <div className="col-span-1 md:col-span-7 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-300 uppercase">Producto</label>
                                                        <select 
                                                            required
                                                            value={item.productoRef}
                                                            onChange={e => updateItem(idx, 'productoRef', e.target.value)}
                                                            className="w-full bg-white p-3 rounded-xl text-xs font-bold outline-none shadow-sm"
                                                        >
                                                            <option value="">Buscar Producto...</option>
                                                            {productos.map(p => (
                                                                <option key={p._id} value={p._id}>
                                                                    {p.sku} - {p.nombre} (Stock: {p.stockActual} / Min: {p.stockMinimo})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="col-span-1 md:col-span-2 space-y-2">
                                                        <label className="text-[9px] font-black text-slate-300 uppercase">Cant.</label>
                                                        <input 
                                                            type="number" min="1" required
                                                            value={item.cantidadSolicitada}
                                                            onChange={e => updateItem(idx, 'cantidadSolicitada', parseInt(e.target.value))}
                                                            className="w-full bg-white p-3 rounded-xl text-xs font-bold text-center outline-none shadow-sm"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 md:col-span-3 flex justify-end pb-1">
                                                        {form.items.length > 1 && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setForm({...form, items: form.items.filter((_, i) => i !== idx)})}
                                                                className="p-3 md:p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border md:border-none border-rose-100"
                                                            >
                                                                <Trash2 size={20} className="md:w-4 md:h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-300 uppercase">Modelo Sugerido</label>
                                                        <input 
                                                            placeholder="Ej: HP ProBook 450"
                                                            value={item.modelo}
                                                            onChange={e => updateItem(idx, 'modelo', e.target.value)}
                                                            className="w-full bg-white p-3 rounded-xl text-xs font-bold outline-none shadow-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[9px] font-black text-slate-300 uppercase">S/N Referencia (Opcional)</label>
                                                        <input 
                                                            placeholder="Para activos específicos"
                                                            value={item.serie}
                                                            onChange={e => updateItem(idx, 'serie', e.target.value)}
                                                            className="w-full bg-white p-3 rounded-xl text-xs font-bold outline-none shadow-sm"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Comparación de Stock Visual */}
                                                {item.productoRef && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <ShieldCheck size={14} className="text-emerald-500" />
                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">
                                                            Stock Actual: {productos.find(p => p._id === item.productoRef)?.stockActual} 
                                                            {' | '} 
                                                            Mínimo Requerido: {productos.find(p => p._id === item.productoRef)?.stockMinimo}
                                                        </span>
                                                        {productos.find(p => p._id === item.productoRef)?.stockActual > productos.find(p => p._id === item.productoRef)?.stockMinimo && (
                                                            <span className="text-[10px] font-black text-amber-500 uppercase ml-auto flex items-center gap-1">
                                                                <AlertTriangle size={12} /> Stock suficiente
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Firma Avanzada Section */}
                                <div className="space-y-4 pt-6 mt-6 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <ShieldCheck size={14} className="text-indigo-600" /> Firma Avanzada Solicitante
                                            </h3>
                                            <p className="text-[9px] font-bold text-slate-400 mt-0.5">La firma digital es obligatoria para validar la trazabilidad del requerimiento.</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-[2rem] p-4 border-2 border-dashed border-slate-200">
                                        <SignaturePad 
                                            onSave={(data) => setForm({...form, firmaSolicitante: data})}
                                            rutFirmante={""} // Se obtendrá del token en el back o se puede pasar si se tiene
                                            nombreFirmante={""}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving}
                                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {saving ? 'Enviando...' : 'Lanzar Solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Cotizaciones */}
            {showQuoteModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="p-8 bg-indigo-600 text-white">
                            <h2 className="text-xl font-black flex items-center gap-3">
                                <DollarSign /> Registro de Cotización <span className="text-white/40 tracking-tight font-mono ml-auto">#{selectedSC.codigoSC}</span>
                            </h2>
                            <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">Selecciona un proveedor registrado para continuar.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                    Proveedor Validado
                                    <a href="/logistica/proveedores" className="text-indigo-600 hover:underline">Nuevo Proveedor</a>
                                </label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    value={quoteForm.proveedorRef}
                                    onChange={e => setQuoteForm({...quoteForm, proveedorRef: e.target.value})}
                                >
                                    <option value="">Seleccionar Proveedor...</option>
                                    {proveedores.map(p => <option key={p._id} value={p._id}>{p.nombre} ({p.rut})</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio Total Ofertado (CLP)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input 
                                        type="number"
                                        placeholder="0"
                                        className="w-full pl-12 p-4 bg-slate-50 border-none rounded-2xl text-sm font-black outline-none"
                                        value={quoteForm.precioTotal}
                                        onChange={e => setQuoteForm({...quoteForm, precioTotal: parseInt(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condiciones / Observaciones</label>
                                <textarea 
                                    placeholder="Ej: Incluye despacho en 48hs..."
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none h-24 resize-none"
                                    value={quoteForm.observaciones}
                                    onChange={e => setQuoteForm({...quoteForm, observaciones: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                            <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                            <button 
                                onClick={handleAddQuote}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl"
                            >
                                Registrar Cotización
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Generación OC */}
            {showOCModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className="p-8 bg-slate-900 text-white">
                            <h2 className="text-xl font-black flex items-center gap-3"><Truck /> Generar Orden de Compra</h2>
                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Configura los precios unitarios finales para emitir el documento.</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-4">
                                {ocForm.items.map((it, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-2xl">
                                        <div className="col-span-6">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Producto</p>
                                            <p className="text-xs font-black text-slate-800">
                                                {selectedSC.items[idx].productoRef?.nombre}
                                            </p>
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">Cant.</p>
                                            <p className="text-xs font-bold">{it.cantidad}</p>
                                        </div>
                                        <div className="col-span-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase">P. Unitario</p>
                                            <input 
                                                type="number"
                                                className="w-full bg-white p-2 rounded-lg text-xs font-black outline-none border border-slate-200"
                                                value={it.precioUnitario}
                                                onChange={e => {
                                                    const next = [...ocForm.items];
                                                    next[idx].precioUnitario = parseInt(e.target.value) || 0;
                                                    next[idx].subtotal = next[idx].precioUnitario * it.cantidad;
                                                    setOcForm({...ocForm, items: next});
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-indigo-50 p-6 rounded-2xl flex items-center justify-between">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Total Orden de Compra</span>
                                <span className="text-xl font-black text-indigo-900">
                                    $ {ocForm.items.reduce((sum, it) => sum + it.subtotal, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                            <button onClick={() => setShowOCModal(false)} className="text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                            <button 
                                onClick={handleCreateOC}
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-xl flex items-center gap-2"
                            >
                                <ClipboardCheck size={18} /> Emitir Orden de Compra
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Viewer */}
            {showViewer && (
                <PurchaseDocumentView 
                    data={viewData}
                    type={viewType}
                    onClose={() => setShowViewer(false)}
                />
            )}
        </div>
    );
};

export default GestionCompras;
