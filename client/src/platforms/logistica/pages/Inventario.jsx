import React, { useState, useEffect } from 'react';
import { 
    Plus, 
    Search, 
    Filter, 
    Download, 
    MoreHorizontal, 
    AlertCircle,
    Package,
    ArrowRightLeft,
    Truck,
    History,
    Archive,
    Trash2,
    UserPlus,
    Database,
    FileSpreadsheet,
    Edit3,
    CheckCircle2,
    Camera,
    X as XIcon
} from 'lucide-react';
import logisticaApi from '../logisticaApi';

const Inventario = () => {
    const [stockReport, setStockReport] = useState([]);
    const [productos, setProductos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState({
        productoRef: '',
        almacenDestino: '',
        cantidad: 1,
        estadoProducto: 'Nuevo',
        motivo: 'Carga Inicial / Compra',
        documentoReferencia: '',
        modelo: '',
        serie: '',
        fotoUrl: ''
    });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [showCargaMasiva, setShowCargaMasiva] = useState(false);
    const [cargaMasivaItems, setCargaMasivaItems] = useState([{ productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]);
    const [almacenCarga, setAlmacenCarga] = useState('');

    const fetchData = async () => {
        try {
            const [stockRes, prodRes, almRes, catRes] = await Promise.all([
                logisticaApi.get('/stock/reporte'),
                logisticaApi.get('/productos'),
                logisticaApi.get('/almacenes'),
                logisticaApi.get('/categorias')
            ]);
            setStockReport(stockRes.data);
            setProductos(prodRes.data);
            setAlmacenes(almRes.data);
            setCategorias(catRes.data);
        } catch (e) {
            console.error("Error loading inventory data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleIngreso = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/movimientos', {
                ...form,
                tipo: 'ENTRADA'
            });
            setShowModal(false);
            setForm({ productoRef: '', almacenDestino: '', cantidad: 1, estadoProducto: 'Nuevo', motivo: 'Carga Inicial / Compra', documentoReferencia: '', modelo: '', serie: '' });
            fetchData();
        } catch (err) {
            alert("Error al registrar ingreso: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const handleEditProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.put(`/productos/${editingProduct._id}`, editingProduct);
            setShowEditModal(false);
            fetchData();
        } catch (err) {
            alert("Error al actualizar producto: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };
    const handleCargaMasiva = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/carga-inicial', {
                almacenId: almacenCarga,
                productos: cargaMasivaItems
            });
            setShowCargaMasiva(false);
            setCargaMasivaItems([{ productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]);
            setAlmacenCarga('');
            fetchData();
        } catch (err) {
            alert("Error en carga masiva: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const addCargaItem = () => setCargaMasivaItems([...cargaMasivaItems, { productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]);
    const updateCargaItem = (idx, field, val) => {
        const next = [...cargaMasivaItems];
        next[idx][field] = val;
        setCargaMasivaItems(next);
    };

    const [showQuickActionModal, setShowQuickActionModal] = useState(false);
    const [quickActionForm, setQuickActionForm] = useState({
        tipo: 'ASIGNACION',
        productoRef: '',
        almacenOrigen: '',
        almacenDestino: '',
        cantidad: 1,
        estadoProducto: 'Nuevo',
        motivo: ''
    });

    const handleQuickAction = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/movimientos', quickActionForm);
            setShowQuickActionModal(false);
            fetchData();
        } catch (err) {
            alert("Error al procesar acción: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const openQuickAction = (item, tipo) => {
        setQuickActionForm({
            tipo,
            productoRef: item.productoRef._id,
            almacenOrigen: item.almacenRef._id,
            almacenDestino: '',
            cantidad: 1,
            estadoProducto: 'Nuevo',
            motivo: tipo === 'MERMA' ? 'Equipo Dañado/Mermado' : ''
        });
        setShowQuickActionModal(true);
    };

    const openEditProduct = (prod) => {
        setEditingProduct({...prod});
        setShowEditModal(true);
    };

    const filtered = stockReport.filter(s => {
        const sLower = searchTerm.toLowerCase();
        return (
            s.productoRef?.nombre?.toLowerCase().includes(sLower) ||
            s.productoRef?.sku?.toLowerCase().includes(sLower) ||
            s.productoRef?.marca?.toLowerCase().includes(sLower) ||
            s.productoRef?.modelo?.toLowerCase().includes(sLower) ||
            s.almacenRef?.nombre?.toLowerCase().includes(sLower) ||
            s.almacenRef?.codigo?.toLowerCase().includes(sLower)
        );
    });

    const getStockBadge = (cantidad, label) => {
        if (cantidad === 0) return null;
        let color = "bg-slate-50 text-slate-400";
        if (label === 'Nuevo') color = "bg-emerald-50 text-emerald-600";
        if (label === 'Usado') color = "bg-amber-50 text-amber-600";
        if (label === 'Malo') color = "bg-rose-50 text-rose-600";
        if (label === 'Merma') color = "bg-slate-900 text-white";

        return (
            <div className={`px-2 py-1 rounded-lg flex flex-col items-center min-w-[60px] ${color}`}>
                <span className="text-[10px] font-black leading-none">{cantidad}</span>
                <span className="text-[8px] font-bold uppercase mt-0.5">{label}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Inventario 360</h1>
                    <p className="text-slate-500 text-sm">Control total de activos y suministros en bodegas centrales y móviles.</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all font-bold text-sm flex items-center gap-2">
                        <History size={18} />
                        Historial
                    </button>
                    <button 
                        onClick={() => setShowCargaMasiva(true)}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                        <Database size={18} />
                        Carga Inicial
                    </button>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="px-5 py-2.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold text-sm flex items-center gap-2 shadow-xl shadow-slate-200"
                    >
                        <Plus size={18} />
                        Ingreso de Stock
                    </button>
                </div>
            </div>

            {/* Action Bar ... (rest unchanged) */}

            {/* Modal Ingreso de Stock */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleIngreso}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Ingreso de Existencias</h2>
                                <p className="text-slate-400 text-sm font-medium">Registra entradas de productos a tus bodegas.</p>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Producto / Activo</label>
                                    <select 
                                        required
                                        value={form.productoRef}
                                        onChange={e => setForm({...form, productoRef: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    >
                                        <option value="">Seleccionar Producto</option>
                                        {productos.map(p => (
                                            <option key={p._id} value={p._id}>{p.nombre} ({p.sku})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bodega Destino</label>
                                    <select 
                                        required
                                        value={form.almacenDestino}
                                        onChange={e => setForm({...form, almacenDestino: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    >
                                        <option value="">Seleccionar Bodega</option>
                                        {almacenes.map(a => (
                                            <option key={a._id} value={a._id}>{a.nombre} ({a.tipo})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                                        <input 
                                            type="number" required min="1"
                                            value={form.cantidad}
                                            onChange={e => setForm({...form, cantidad: parseInt(e.target.value)})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                                        <select 
                                            value={form.estadoProducto}
                                            onChange={e => setForm({...form, estadoProducto: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        >
                                            <option>Nuevo</option>
                                            <option>Usado Bueno</option>
                                            <option>Usado Malo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Doc. Referencia (Factura/Guía)</label>
                                    <input 
                                        placeholder="Ej: FAC-12345"
                                        value={form.documentoReferencia}
                                        onChange={e => setForm({...form, documentoReferencia: e.target.value})}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo (Opcional)</label>
                                        <input 
                                            placeholder="Especificar modelo"
                                            value={form.modelo}
                                            onChange={e => setForm({...form, modelo: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº de Serie</label>
                                        <input 
                                            placeholder="S/N"
                                            value={form.serie}
                                            onChange={e => setForm({...form, serie: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">Evidencia Fotográfica (Obligatorio)</label>
                                    <div className="flex items-center gap-4">
                                        {form.fotoUrl ? (
                                            <div className="relative group">
                                                <img src={form.fotoUrl} alt="Preview" className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl shadow-slate-200" />
                                                <button 
                                                    type="button"
                                                    onClick={() => setForm({...form, fotoUrl: ''})}
                                                    className="absolute -top-3 -right-3 bg-rose-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                                                >
                                                    <XIcon size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all text-slate-400 group">
                                                <Camera size={32} className="group-hover:scale-110 transition-transform text-indigo-500" />
                                                <span className="text-[10px] font-black uppercase">Capturar</span>
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
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-slate-500 italic leading-relaxed">
                                                "Capture una fotografía clara del producto y su etiqueta para asegurar la integridad del ingreso 360."
                                            </p>
                                        </div>
                                    </div>
                                </div>
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
                                    type="submit" disabled={saving || !form.fotoUrl}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95 transition-all"
                                >
                                    {saving ? 'Registrando...' : 'Confirmar Ingreso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Action Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <div className="lg:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por producto, SKU o bodega..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900/10 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <select className="flex-1 px-4 py-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all text-sm font-bold appearance-none outline-none">
                        <option>Todas las Bodegas</option>
                        <option>Central</option>
                        <option>Móvil (Furgones)</option>
                    </select>
                    <button className="px-4 py-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all text-sm font-bold flex items-center justify-center gap-2">
                        <Download size={16} />
                    </button>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-5">Producto / SKU</th>
                                <th className="px-6 py-5 text-center">Categoría / Valor</th>
                                <th className="px-6 py-5">Ubicación / Bodega</th>
                                <th className="px-6 py-4 text-center">Estados Stock</th>
                                <th className="px-6 py-4 text-right">Valorización 360</th>
                                <th className="px-6 py-4 text-right w-20">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1,2,3,4].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-8" />
                                    </tr>
                                ))
                            ) : filtered.map((s) => (
                                <tr key={s._id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-all overflow-hidden">
                                                {s.productoRef?.fotos?.length > 0 ? (
                                                    <img src={s.productoRef.fotos[0]} className="w-full h-full object-cover" alt="PRD" />
                                                ) : (
                                                    s.productoRef?.tipo === 'Activo' ? <Archive size={18} /> : <Package size={18} />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-700">{s.productoRef?.nombre}</span>
                                                    <button onClick={() => openEditProduct(s.productoRef)} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors">
                                                        <Edit3 size={12} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter">{s.productoRef?.sku}</span>
                                                    {(s.productoRef?.marca || s.productoRef?.modelo) && (
                                                        <span className="text-[9px] font-bold text-indigo-400 uppercase">
                                                            {s.productoRef.marca} {s.productoRef.modelo}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-sky-600 uppercase bg-sky-50 px-2 py-0.5 rounded-lg mb-1">
                                                {s.productoRef?.categoria?.nombre || 'General'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[9px] font-bold uppercase ${s.productoRef?.categoria?.prioridadValor === 'Alto Valor' ? 'text-rose-500' : 'text-slate-400'}`}>
                                                    {s.productoRef?.categoria?.prioridadValor || 'Bajo Valor'}
                                                </span>
                                                <span className="text-[8px] text-slate-300">|</span>
                                                <span className={`text-[9px] font-bold uppercase ${s.productoRef?.propiedad === 'Propio' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {s.productoRef?.propiedad === 'Propio' ? 'EMP' : s.productoRef?.clienteRef?.nombre?.slice(0,3).toUpperCase() || 'CLI'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${s.almacenRef?.tipo === 'Central' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                                                <span className="text-xs font-bold text-slate-600">{s.almacenRef?.nombre}</span>
                                            </div>
                                            {s.almacenRef?.tecnicoRef && (
                                                <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5 ml-3">
                                                    Técnico: {s.almacenRef.tecnicoRef.nombres} {s.almacenRef.tecnicoRef.apellidos}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            {getStockBadge(s.cantidadNuevo, 'Nuevo')}
                                            {getStockBadge(s.cantidadUsadoBueno, 'Usado')}
                                            {getStockBadge(s.cantidadUsadoMalo, 'Malo')}
                                            {getStockBadge(s.cantidadMerma, 'Merma')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            {/* Cálculo de Valor Total: Suma de todos los estados * Valor Unitario */}
                                            {(() => {
                                                const totalStock = (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0) + (s.cantidadUsadoMalo || 0) + (s.cantidadMerma || 0);
                                                const unitPrice = s.productoRef?.valorUnitario || 0;
                                                const totalValue = totalStock * unitPrice;
                                                
                                                return (
                                                    <>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Patrimonio:</span>
                                                            <span className="text-sm font-black text-emerald-600">${totalValue?.toLocaleString()}</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Precio Unit: ${unitPrice?.toLocaleString()}</span>
                                                        
                                                        {s.productoRef?.tipo === 'Activo' && (
                                                            <div className="mt-1 pt-1 border-t border-slate-50 flex flex-col items-end">
                                                                <span className="text-[9px] font-black text-indigo-500 uppercase">Val. Libro: ${s.productoRef.valorLibroActual?.toLocaleString() || 0}</span>
                                                                <span className="text-[8px] font-bold text-slate-300 uppercase">Dep: -${s.productoRef.depreciacionAcumulada?.toLocaleString() || 0}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button 
                                                onClick={() => openQuickAction(s, 'ASIGNACION')}
                                                title="Asignar a Técnico" className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
                                            >
                                                <UserPlus size={16} />
                                            </button>
                                            <button 
                                                onClick={() => openQuickAction(s, 'TRASPASO')}
                                                title="Traspaso entre Bodegas" className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
                                            >
                                                <ArrowRightLeft size={16} />
                                            </button>
                                            <button 
                                                onClick={() => openQuickAction(s, 'MERMA')}
                                                title="Registrar Merma" className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Package size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">Sin existencias registradas</p>
                        <p className="text-sm text-center">Los productos aparecerán aquí una vez que registres <br/> un ingreso o movimiento de stock.</p>
                    </div>
                )}
            </div>
            {/* Modal Acciones Rápidas */}
            {showQuickActionModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleQuickAction}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                    {quickActionForm.tipo === 'ASIGNACION' ? 'Asignar a Técnico/Furgón' : 
                                     quickActionForm.tipo === 'MERMA' ? 'Reportar Merma/Falla' : 'Traslado entre Bodegas'}
                                </h2>
                                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Registrando Movimiento de Stock</p>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Stock Disponible en Origen</p>
                                        <p className="text-sm font-bold text-slate-700">
                                            {stockReport.find(s => s.almacenRef?._id === quickActionForm.almacenOrigen && s.productoRef?._id === quickActionForm.productoRef)?.cantidadNuevo || 0} unidades
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                                            <input 
                                                type="number" required min="1"
                                                value={quickActionForm.cantidad}
                                                onChange={e => setQuickActionForm({...quickActionForm, cantidad: parseInt(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                                            <select 
                                                value={quickActionForm.estadoProducto}
                                                onChange={e => setQuickActionForm({...quickActionForm, estadoProducto: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            >
                                                <option>Nuevo</option>
                                                <option>Usado Bueno</option>
                                                <option>Usado Malo</option>
                                            </select>
                                        </div>
                                    </div>

                                    {quickActionForm.tipo !== 'MERMA' && (
                                        <div className="space-y-2 text-indigo-600">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bodega/Furgón Destino</label>
                                            <select 
                                                required
                                                value={quickActionForm.almacenDestino}
                                                onChange={e => setQuickActionForm({...quickActionForm, almacenDestino: e.target.value})}
                                                className="w-full p-4 bg-indigo-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-indigo-100"
                                            >
                                                <option value="">Seleccionar Destino</option>
                                                {almacenes.filter(a => a._id !== quickActionForm.almacenOrigen).map(a => (
                                                    <option key={a._id} value={a._id}>{a.nombre} ({a.tipo})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="space-y-4 pt-4 border-t border-slate-50">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                             <Camera size={14} className="text-indigo-600" /> Evidencia (Obligatorio)
                                        </label>
                                        <div className="flex items-center gap-4">
                                             {quickActionForm.fotoUrl ? (
                                                <div className="relative">
                                                    <img src={quickActionForm.fotoUrl} alt="Evidencia" className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-lg" />
                                                    <button type="button" onClick={() => setQuickActionForm({...quickActionForm, fotoUrl: ''})} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg">
                                                        <XIcon size={12} />
                                                    </button>
                                                </div>
                                             ) : (
                                                <label className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 transition-all text-slate-400">
                                                    <Camera size={20} />
                                                    <span className="text-[8px] font-black uppercase">Capturar</span>
                                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => setQuickActionForm({...quickActionForm, fotoUrl: ev.target.result});
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }} />
                                                </label>
                                             )}
                                             <p className="flex-1 text-[9px] font-bold text-slate-400 leading-tight italic">Respaldar movimiento con foto.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button 
                                    type="button"
                                    onClick={() => setShowQuickActionModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving || !quickActionForm.fotoUrl}
                                    className={`px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                                        quickActionForm.tipo === 'MERMA' ? 'bg-rose-600 shadow-rose-200' : 'bg-indigo-600 shadow-indigo-200'
                                    }`}
                                >
                                    {saving ? 'Procesando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Carga Masiva Inicial */}
            {showCargaMasiva && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-50 bg-emerald-50/50">
                            <h2 className="text-2xl font-black text-emerald-900 tracking-tight flex items-center gap-3">
                                <Database /> Carga Inicial de Existencias
                            </h2>
                            <p className="text-emerald-700/60 text-[10px] font-black uppercase tracking-widest mt-1">Cargar patrimonio actual sin requerir documentos de compra</p>
                        </div>
                        
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Destino (Bodega o Furgón)</label>
                                    <select 
                                        required
                                        value={almacenCarga}
                                        onChange={e => setAlmacenCarga(e.target.value)}
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-emerald-100"
                                    >
                                        <option value="">Seleccionar Almacén</option>
                                        {almacenes.map(a => (
                                            <option key={a._id} value={a._id}>{a.nombre} ({a.tipo})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Productos a Cargar</label>
                                    {cargaMasivaItems.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-4 rounded-2xl">
                                            <div className="col-span-6">
                                                <select 
                                                    value={item.productoRef}
                                                    onChange={e => updateCargaItem(idx, 'productoRef', e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl text-[11px] font-bold outline-none"
                                                >
                                                    <option value="">Producto...</option>
                                                    {productos.map(p => <option key={p._id} value={p._id}>{p.nombre} ({p.sku})</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-2">
                                                <input 
                                                    type="number" 
                                                    value={item.cantidad}
                                                    onChange={e => updateCargaItem(idx, 'cantidad', parseInt(e.target.value))}
                                                    className="w-full bg-white px-3 py-2 rounded-xl text-[11px] font-bold text-center outline-none"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <select 
                                                    value={item.estadoProducto}
                                                    onChange={e => updateCargaItem(idx, 'estadoProducto', e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl text-[11px] font-bold outline-none"
                                                >
                                                    <option>Nuevo</option>
                                                    <option>Usado Bueno</option>
                                                    <option>Usado Malo</option>
                                                </select>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <button 
                                                    onClick={() => setCargaMasivaItems(cargaMasivaItems.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-600 p-1"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button 
                                        type="button"
                                        onClick={addCargaItem}
                                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all"
                                    >
                                        + Agregar otro producto
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => setShowCargaMasiva(false)}
                                className="px-6 py-3 text-slate-400 font-bold text-xs uppercase hover:text-slate-600"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleCargaMasiva}
                                disabled={saving || !almacenCarga || cargaMasivaItems.some(i => !i.productoRef)}
                                className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 disabled:opacity-50 transition-all"
                            >
                                {saving ? 'Cargando...' : 'Procesar Carga Inicial'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL EDITAR PRODUCTO */}
            {showEditModal && editingProduct && (
                <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowEditModal(false)} />
                    <div className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Editar Maestro de Producto</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-rose-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleEditProduct}>
                            <div className="p-8 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Producto</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        value={editingProduct.nombre}
                                        onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU / Código</label>
                                        <input 
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            value={editingProduct.sku}
                                            onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</label>
                                        <input 
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                            value={editingProduct.marca || ''}
                                            onChange={e => setEditingProduct({...editingProduct, marca: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                                    <input 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        value={editingProduct.modelo || ''}
                                        onChange={e => setEditingProduct({...editingProduct, modelo: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                    <textarea 
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none resize-none h-24"
                                        value={editingProduct.descripcion || ''}
                                        onChange={e => setEditingProduct({...editingProduct, descripcion: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 text-slate-400 font-bold text-xs uppercase">Cancelar</button>
                                <button 
                                    type="submit" 
                                    disabled={saving}
                                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200"
                                >
                                    {saving ? 'Guardando...' : 'Actualizar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventario;
