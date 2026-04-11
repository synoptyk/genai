import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, 
    Search, 
    Filter, 
    Truck, 
    MapPin, 
    Clock, 
    CheckCircle2, 
    AlertTriangle,
    Navigation,
    Calendar,
    Upload,
    Download
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import * as XLSX from 'xlsx';
import SmartSelect from '../components/SmartSelect';

const toSafeNumber = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const Despachos = () => {
    const [despachos, setDespachos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const bulkInputRef = useRef(null);
    const [form, setForm] = useState({
        items: [{ productoRef: '', cantidad: 1 }],
        direccionEntrega: '',
        clienteTag: '',
        vehiculoRef: '',
        choferRef: '',
        almacenOrigen: '',
        fechaPrometida: '',
        observaciones: ''
    });

    const fetchData = async () => {
        try {
            const [despRes, prodRes, vehRes, tecRes, almRes] = await Promise.all([
                logisticaApi.get('/despachos'),
                logisticaApi.get('/productos'),
                logisticaApi.get('/vehiculos'),
                logisticaApi.get('/tecnicos'),
                logisticaApi.get('/almacenes')
            ]);
            setDespachos(despRes.data);
            setProductos(prodRes.data);
            setVehiculos(vehRes.data);
            setTecnicos(tecRes.data);
            setAlmacenes(almRes.data);
        } catch (e) {
            console.error("Error loading dispatch data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const downloadTemplate = () => {
        const headers = [[
            'direccion_entrega',
            'cliente_tag',
            'almacen_origen',
            'vehiculo_patente',
            'chofer_rut',
            'fecha_prometida',
            'items'
        ]];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Despachos');
        XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_Despachos.xlsx');
    };

    const parseItems = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return [];
        return text
            .split('|')
            .map(chunk => chunk.trim())
            .filter(Boolean)
            .map(pair => {
                const [sku, qty] = pair.split(':').map(v => String(v || '').trim());
                const producto = productos.find(p => String(p.sku || '').toUpperCase() === sku.toUpperCase());
                const cantidad = parseInt(qty, 10);
                if (!producto || Number.isNaN(cantidad) || cantidad <= 0) return null;
                return { productoRef: producto._id, cantidad };
            })
            .filter(Boolean);
    };

    const handleBulkImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                setBulkLoading(true);
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                const payload = rows
                    .map(r => {
                        const almacen = almacenes.find(a =>
                            String(a.codigo || '').toUpperCase() === String(r.almacen_origen || '').toUpperCase() ||
                            String(a.nombre || '').toUpperCase() === String(r.almacen_origen || '').toUpperCase()
                        );
                        const vehiculo = vehiculos.find(v =>
                            String(v.patente || '').toUpperCase() === String(r.vehiculo_patente || '').toUpperCase()
                        );
                        const chofer = tecnicos.find(t =>
                            String(t.rut || '').toUpperCase() === String(r.chofer_rut || '').replace(/[^0-9kK]/g, '').toUpperCase() && t.platformUserId
                        );

                        return {
                            direccionEntrega: String(r.direccion_entrega || '').trim(),
                            clienteTag: String(r.cliente_tag || '').trim(),
                            almacenOrigen: almacen?._id || '',
                            vehiculoRef: vehiculo?._id || '',
                            choferRef: chofer?.platformUserId || '',
                            fechaPrometida: r.fecha_prometida ? new Date(r.fecha_prometida).toISOString() : '',
                            items: parseItems(r.items)
                        };
                    })
                    .filter(d => d.direccionEntrega && d.almacenOrigen && d.items.length > 0);

                if (payload.length === 0) {
                    alert('No se detectaron filas válidas. Verifica bodega, SKU, chofer y formato de items (SKU:CANT|SKU:CANT).');
                    return;
                }

                const res = await logisticaApi.post('/despachos/bulk', { despachos: payload });
                alert(res.data?.message || 'Carga masiva completada');
                fetchData();
            } catch (err) {
                alert('Error en carga masiva: ' + (err.response?.data?.message || err.message));
            } finally {
                setBulkLoading(false);
                if (bulkInputRef.current) bulkInputRef.current.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await logisticaApi.post('/despachos', form);
            setShowModal(false);
            setForm({
                items: [{ productoRef: '', cantidad: 1 }],
                direccionEntrega: '',
                clienteTag: '',
                vehiculoRef: '',
                choferRef: '',
                almacenOrigen: '',
                fechaPrometida: '',
                observaciones: ''
            });
            fetchData();
        } catch (err) {
            alert("Error al crear despacho: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const addItem = () => setForm({ ...form, items: [...form.items, { productoRef: '', cantidad: 1 }] });
    const removeItem = (index) => {
        const newItems = form.items.filter((_, i) => i !== index);
        setForm({ ...form, items: newItems });
    };
    const updateItem = (index, field, value) => {
        const newItems = [...form.items];
        newItems[index][field] = value;
        setForm({ ...form, items: newItems });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'ENTREGADO': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'EN_RUTA': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'INCIDENCIA': return 'bg-rose-50 text-rose-600 border-rose-100';
            default: return 'bg-slate-50 text-slate-400 border-slate-100';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Centro de Despachos</h1>
                    <p className="text-slate-500 text-sm">Monitoreo de última milla y asignación de flota.</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-5 py-2.5 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-200 active:scale-95"
                >
                    <Navigation size={18} />
                    Planificar Ruta
                </button>
                <div className="flex items-center gap-2">
                    <button
                        onClick={downloadTemplate}
                        className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-2xl hover:bg-slate-50 transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2"
                    >
                        <Download size={14} /> Plantilla
                    </button>
                    <button
                        onClick={() => bulkInputRef.current?.click()}
                        disabled={bulkLoading}
                        className="px-4 py-2.5 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                    >
                        <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva'}
                    </button>
                    <input
                        ref={bulkInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleBulkImport}
                    />
                </div>
            </div>

            {/* Quick Summary Bar ... rest of the list ... */}

            {/* Modal Planificar Ruta (Despacho) */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
                        <form onSubmit={handleCreate}>
                            <div className="p-8 border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-10 flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Planificación de Ruta</h2>
                                    <p className="text-slate-400 text-sm font-medium">Asigna productos, transporte y destino.</p>
                                </div>
                                <button type="button" onClick={() => setShowModal(false)} className="text-slate-300 hover:text-slate-600 transition-all">
                                    <Plus className="rotate-45" size={32} />
                                </button>
                            </div>
                            
                            <div className="p-8 space-y-8">
                                {/* Sección Items */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items del Despacho</label>
                                        <button type="button" onClick={addItem} className="text-[10px] font-black text-rose-600 uppercase flex items-center gap-1 hover:underline">
                                            <Plus size={12} /> Agregar Item
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {form.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-3 bg-slate-50 p-4 rounded-2xl items-end animate-in slide-in-from-left duration-200" style={{ animationDelay: `${idx * 50}ms` }}>
                                                <div className="flex-1 space-y-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Producto</label>
                                                    <SmartSelect
                                                        required
                                                        value={item.productoRef}
                                                        onChange={(v) => updateItem(idx, 'productoRef', v)}
                                                        placeholder="Seleccionar..."
                                                        contextKey="despachos_item_producto"
                                                        options={productos.map((p) => ({ value: p._id, label: `${p.nombre} (${p.sku})` }))}
                                                    />
                                                </div>
                                                <div className="w-24 space-y-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Cantidad</label>
                                                    <input 
                                                        type="number" required min="1"
                                                        value={item.cantidad}
                                                        onChange={e => updateItem(idx, 'cantidad', toSafeNumber(e.target.value, 1))}
                                                        className="w-full bg-white border-none rounded-xl text-xs font-bold p-2.5 outline-none"
                                                    />
                                                </div>
                                                {form.items.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(idx)} className="p-2.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all">
                                                        <Plus className="rotate-45" size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Origen */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <MapPin size={12} /> Despachar desde
                                        </label>
                                        <SmartSelect
                                            required
                                            value={form.almacenOrigen}
                                            onChange={(v) => setForm({ ...form, almacenOrigen: v })}
                                            placeholder="Seleccionar Bodega Origen"
                                            contextKey="despachos_origen"
                                            options={almacenes.map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                                        />
                                    </div>

                                    {/* Destino */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección de Entrega</label>
                                        <input 
                                            required placeholder="Ej: Av. Las Condes 1234, Of 501"
                                            value={form.direccionEntrega}
                                            onChange={e => setForm({...form, direccionEntrega: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Vehículo */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Truck size={12} /> Vehículo Asignado
                                        </label>
                                        <SmartSelect
                                            value={form.vehiculoRef}
                                            onChange={(v) => setForm({ ...form, vehiculoRef: v })}
                                            placeholder="Seleccionar Vehículo"
                                            contextKey="despachos_vehiculo"
                                            options={vehiculos.map((v) => ({ value: v._id, label: `${v.patente} - ${v.marca} ${v.modelo}` }))}
                                        />
                                    </div>

                                    {/* Chofer */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-italic">Chofer Responsable</label>
                                        <SmartSelect
                                            value={form.choferRef}
                                            onChange={(v) => setForm({ ...form, choferRef: v })}
                                            placeholder="Seleccionar Chofer"
                                            contextKey="despachos_chofer"
                                            options={tecnicos
                                                .filter(t => t.platformUserId)
                                                .map((t) => ({ value: t.platformUserId, label: `${t.nombres} ${t.apellidos} (${t.cargo || t.role || 'Personal'})` }))}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Estimada</label>
                                        <input 
                                            type="date"
                                            value={form.fechaPrometida}
                                            onChange={e => setForm({...form, fechaPrometida: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia Cliente / OT</label>
                                        <input 
                                            placeholder="Ej: Cliente Centraliza-T / OT-99"
                                            value={form.clienteTag}
                                            onChange={e => setForm({...form, clienteTag: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 bg-slate-900 flex items-center justify-between rounded-b-[2.5rem]">
                                <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Verifica los items antes de confirmar</span>
                                <div className="flex gap-4">
                                    <button 
                                        type="button" onClick={() => setShowModal(false)}
                                        className="px-6 py-3 text-white/60 font-black text-[10px] uppercase tracking-widest hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" disabled={saving}
                                        className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-rose-900/40 disabled:opacity-50 active:scale-95 transition-all"
                                    >
                                        {saving ? 'Procesando...' : 'Confirmar Ruta'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* List of Dispatches */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-3xl animate-pulse border border-slate-100" />)
                ) : despachos.map((desp) => (
                    <div key={desp._id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black tracking-tighter text-slate-400 uppercase">Orden #{desp.codigoDespacho}</span>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(desp.status)}`}>
                                    {desp.status}
                                </span>
                            </div>
                            
                            <div className="flex items-start gap-4 mb-6">
                                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-600 transition-colors">
                                    <Truck size={24} />
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-base font-bold text-slate-800 line-clamp-1">{desp.direccionEntrega}</h3>
                                    <span className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                                        <MapPin size={12} /> {desp.clienteTag || 'Dirección de Entrega'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-50">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                                        <Calendar size={14} /> Fecha Est.
                                    </div>
                                    <span className="font-bold text-slate-700">{desp.fechaPrometida ? new Date(desp.fechaPrometida).toLocaleDateString() : 'Por definir'}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                                        <Navigation size={14} /> Vehículo
                                    </div>
                                    <span className="font-bold text-slate-700">{desp.vehiculoRef?.patente || 'No Asignado'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button className="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
                                Detalles del Viaje
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {!loading && despachos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Navigation size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">Cielo Despejado</p>
                    <p className="text-sm">No hay despachos registrados para hoy.</p>
                </div>
            )}
        </div>
    );
};

export default Despachos;
