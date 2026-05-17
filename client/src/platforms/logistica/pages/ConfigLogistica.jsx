import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Warehouse, Tags, Box, Plus, Search,
    MoreHorizontal, MapPin, Truck, User, ArrowRight,
    Anchor, Repeat, ChevronRight, Archive, Upload,
    Download, ImagePlus, Package, Grid3X3, List, Pencil, Trash2, ShieldAlert,
    Lock, Unlock
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import * as XLSX from 'xlsx';
import SmartSelect from '../components/SmartSelect';

const ICON_OPTIONS = ['Tags', 'Archive', 'Package', 'Warehouse'];

const COLOR_OPTIONS = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Blanco', 'Negro', 'Gris', 'Celeste', 'Rosado', 'Marrón', 'Púrpura', 'Dorado', 'Plateado', 'Genérico'];

const getColorHex = (colorName) => {
    const name = String(colorName || '').toLowerCase().trim();
    if (name === 'rojo') return '#EF4444';
    if (name === 'azul') return '#3B82F6';
    if (name === 'verde') return '#10B981';
    if (name === 'amarillo') return '#F59E0B';
    if (name === 'naranja') return '#F97316';
    if (name === 'blanco') return '#FFFFFF';
    if (name === 'negro') return '#1E293B';
    if (name === 'gris') return '#64748B';
    if (name === 'celeste') return '#06B6D4';
    if (name === 'rosado') return '#EC4899';
    if (name === 'marrón' || name === 'marron') return '#78350F';
    if (name === 'púrpura' || name === 'purpura') return '#8B5CF6';
    if (name === 'dorado') return '#EAB308';
    if (name === 'plateado') return '#CBD5E1';
    return '#94A3B8';
};

const getVisualIcon = (name, size = 20) => {
    const normalized = String(name || '').toLowerCase();
    if (normalized === 'tags') return <Tags size={size} />;
    if (normalized === 'package') return <Package size={size} />;
    if (normalized === 'warehouse') return <Warehouse size={size} />;
    return <Archive size={size} />;
};

const ConfigLogistica = () => {
    const [activeTab, setActiveTab] = useState('bodegas');
    const [data, setData] = useState({ almacenes: [], categorias: [], productos: [], tecnicos: [], clientes: [] });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [searchAlmacen, setSearchAlmacen] = useState('');
    const [almacenView, setAlmacenView] = useState('grid');
    const [editingAlmacenId, setEditingAlmacenId] = useState(null);
    const [searchCategoria, setSearchCategoria] = useState('');
    const [categoriaView, setCategoriaView] = useState('grid');
    const [editingCategoriaId, setEditingCategoriaId] = useState(null);
    const [searchProducto, setSearchProducto] = useState('');
    const [productoView, setProductoView] = useState('grid');
    const [editingProductoId, setEditingProductoId] = useState(null);
    const [isMaster, setIsMaster] = useState(false);
    const catBulkInputRef = useRef(null);
    const prodBulkInputRef = useRef(null);

    // Form states
    const [almForm, setAlmForm] = useState({ nombre: '', codigo: '', tipo: 'Central', parentAlmacen: '', tecnicoRef: '', ubicacion: { direccion: '' }, propiedad: 'Propio', clienteRef: '' });
    const [catForm, setCatForm] = useState({ nombre: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo', icono: 'Tags', imagenUrl: '' });
    const [prodForm, setProdForm] = useState({ nombre: '', sku: '', ean: '', categoria: '', marca: '', modelo: '', unidadMedida: 'Unidad', descripcion: '', tipo: 'Activo', color: 'Genérico', segmentacion: 'Estándar', propiedad: 'Propio', clienteRef: '', valorUnitario: 0, icono: 'Archive', fotoUrl: '' });

    useEffect(() => {
        fetchMasterData();
        try {
            const stored = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            const user = stored ? JSON.parse(stored) : null;
            setIsMaster(['system_admin', 'ceo', 'ceo_genai'].includes(String(user?.role || '').toLowerCase()));
        } catch (e) {
            setIsMaster(false);
        }
    }, []);

    const closeModal = () => {
        setShowModal(false);
        setEditingAlmacenId(null);
        setEditingCategoriaId(null);
        setEditingProductoId(null);
        setAlmForm({ nombre: '', codigo: '', tipo: 'Central', parentAlmacen: '', tecnicoRef: '', ubicacion: { direccion: '' }, propiedad: 'Propio', clienteRef: '' });
        setCatForm({ nombre: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo', icono: 'Tags', imagenUrl: '' });
        setProdForm({ nombre: '', sku: '', ean: '', categoria: '', marca: '', modelo: '', unidadMedida: 'Unidad', descripcion: '', tipo: 'Activo', color: 'Genérico', segmentacion: 'Estándar', propiedad: 'Propio', clienteRef: '', valorUnitario: 0, icono: 'Archive', fotoUrl: '' });
    };

    const handleEditAlmacen = (alm) => {
        setEditingAlmacenId(alm._id);
        setAlmForm({
            nombre: alm.nombre || '',
            codigo: alm.codigo || '',
            tipo: alm.tipo || 'Central',
            parentAlmacen: alm.parentAlmacen?._id || alm.parentAlmacen || '',
            tecnicoRef: alm.tecnicoRef?._id || alm.tecnicoRef || '',
            ubicacion: { direccion: alm.ubicacion?.direccion || '' },
            propiedad: alm.propiedad || 'Propio',
            clienteRef: alm.clienteRef?._id || alm.clienteRef || ''
        });
        setActiveTab('bodegas');
        setShowModal(true);
    };

    const handleDeleteAlmacen = async (id) => {
        if (!window.confirm('¿Eliminar esta bodega/vehículo?')) return;
        try {
            await logisticaApi.delete(`/almacenes/${id}`);
            fetchMasterData();
        } catch (err) {
            alert('Error al eliminar bodega: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleToggleStatus = async (type, item) => {
        const newStatus = item.status === 'Inactivo' ? 'Activo' : 'Inactivo';
        const actionText = newStatus === 'Inactivo' ? 'bloquear/desactivar' : 'desbloquear/activar';
        if (!window.confirm(`¿Deseas ${actionText} este registro?`)) return;
        try {
            const endpoint = type === 'bodega' 
                ? `/almacenes/${item._id}` 
                : type === 'categoria' 
                ? `/categorias/${item._id}` 
                : `/productos/${item._id}`;
            await logisticaApi.put(endpoint, { status: newStatus });
            fetchMasterData();
        } catch (err) {
            alert('Error al cambiar estado: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEditCategoria = (cat) => {
        setEditingCategoriaId(cat._id);
        setCatForm({
            nombre: cat.nombre || '',
            prioridadValor: cat.prioridadValor || 'Bajo Valor',
            tipoRotacion: cat.tipoRotacion || 'Rotativo',
            icono: cat.icono || 'Tags',
            imagenUrl: cat.imagenUrl || ''
        });
        setActiveTab('categorias');
        setShowModal(true);
    };

    const handleDeleteCategoria = async (id) => {
        if (!window.confirm('¿Eliminar esta categoría?')) return;
        try {
            await logisticaApi.delete(`/categorias/${id}`);
            fetchMasterData();
        } catch (err) {
            alert('Error al eliminar categoría: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDeleteAllCategorias = async () => {
        if (!window.confirm('Esta acción eliminará TODAS las categorías. ¿Deseas continuar?')) return;
        try {
            const res = await logisticaApi.delete('/categorias/all');
            alert(res.data?.message || 'Categorías eliminadas.');
            fetchMasterData();
        } catch (err) {
            alert('Error al eliminar todas las categorías: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEditProducto = (prod) => {
        setEditingProductoId(prod._id);
        setProdForm({
            nombre: prod.nombre || '',
            sku: prod.sku || '',
            ean: prod.ean || '',
            categoria: prod.categoria?._id || prod.categoria || '',
            marca: prod.marca || '',
            modelo: prod.modelo || '',
            unidadMedida: prod.unidadMedida || 'Unidad',
            descripcion: prod.descripcion || '',
            tipo: prod.tipo || 'Activo',
            color: prod.color || 'Genérico',
            segmentacion: prod.segmentacion || 'Estándar',
            propiedad: prod.propiedad || 'Propio',
            clienteRef: prod.clienteRef?._id || prod.clienteRef || '',
            valorUnitario: prod.valorUnitario || 0,
            icono: prod.icono || 'Archive',
            fotoUrl: prod.fotos?.[0] || ''
        });
        setActiveTab('productos');
        setShowModal(true);
    };

    const handleDeleteProducto = async (id) => {
        if (!window.confirm('¿Eliminar este producto?')) return;
        try {
            await logisticaApi.delete(`/productos/${id}`);
            fetchMasterData();
        } catch (err) {
            alert('Error al eliminar producto: ' + (err.response?.data?.message || err.message));
        }
    };

    const fetchMasterData = async () => {
        try {
            const res = await logisticaApi.get('/configuracion-maestra');
            setData(res.data);
        } catch (e) {
            console.error("Error fetching master config", e);
        } finally {
            setLoading(false);
        }
    };

    const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const downloadCategoriaTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([['nombre', 'descripcion', 'prioridadValor', 'tipoRotacion', 'icono', 'imagenUrl']]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const buf = new ArrayBuffer(wbout.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < wbout.length; i++) {
            view[i] = wbout.charCodeAt(i) & 0xff;
        }
        
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Categorias_Logistica.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const downloadProductoTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([[
            'nombre', 'sku', 'ean', 'categoria', 'marca', 'modelo', 'color', 'unidadMedida', 'descripcion', 'tipo', 'segmentacion', 'propiedad', 'valorUnitario', 'icono', 'imagenUrl'
        ]]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Existencias');
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        const buf = new ArrayBuffer(wbout.length);
        const view = new Uint8Array(buf);
        for (let i = 0; i < wbout.length; i++) {
            view[i] = wbout.charCodeAt(i) & 0xff;
        }
        
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Plantilla_Existencias_Logistica.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const importCategorias = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const categorias = rows
                .map(r => ({
                    nombre: String(r.nombre || '').trim(),
                    descripcion: String(r.descripcion || '').trim(),
                    prioridadValor: String(r.prioridadValor || 'Bajo Valor').trim(),
                    tipoRotacion: String(r.tipoRotacion || 'Rotativo').trim(),
                    icono: String(r.icono || 'Tags').trim(),
                    imagenUrl: String(r.imagenUrl || '').trim()
                }))
                .filter(r => r.nombre);

            if (categorias.length === 0) {
                alert('No hay filas válidas para importar en categorías.');
                return;
            }

            const res = await logisticaApi.post('/categorias/bulk', { categorias });
            alert(res.data?.message || 'Carga masiva categorías completada.');
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de categorías: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (catBulkInputRef.current) catBulkInputRef.current.value = '';
        }
    };

    const importProductos = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const productos = rows
                .map(r => ({
                    nombre: String(r.nombre || '').trim(),
                    sku: String(r.sku || '').trim(),
                    ean: String(r.ean || '').trim(),
                    categoria: String(r.categoria || '').trim(),
                    marca: String(r.marca || '').trim(),
                    modelo: String(r.modelo || '').trim(),
                    color: String(r.color || 'Genérico').trim(),
                    unidadMedida: String(r.unidadMedida || 'Unidad').trim(),
                    descripcion: String(r.descripcion || '').trim(),
                    tipo: String(r.tipo || 'Activo').trim(),
                    segmentacion: String(r.segmentacion || 'Estándar').trim(),
                    propiedad: String(r.propiedad || 'Propio').trim(),
                    valorUnitario: Number(r.valorUnitario || 0),
                    icono: String(r.icono || 'Archive').trim(),
                    imagenUrl: String(r.imagenUrl || '').trim()
                }))
                .filter(r => r.nombre);

            if (productos.length === 0) {
                alert('No hay filas válidas para importar en productos.');
                return;
            }

            const res = await logisticaApi.post('/productos/bulk', { productos });
            alert(res.data?.message || 'Carga masiva productos completada.');
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de productos: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (prodBulkInputRef.current) prodBulkInputRef.current.value = '';
        }
    };

    const handleAction = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const endpoint = activeTab === 'bodegas'
                ? (editingAlmacenId ? `/almacenes/${editingAlmacenId}` : '/almacenes')
                : activeTab === 'categorias'
                ? (editingCategoriaId ? `/categorias/${editingCategoriaId}` : '/categorias')
                : (editingProductoId ? `/productos/${editingProductoId}` : '/productos');
            const method = activeTab === 'bodegas' && editingAlmacenId
                ? 'put'
                : activeTab === 'categorias' && editingCategoriaId
                ? 'put'
                : activeTab === 'productos' && editingProductoId
                ? 'put'
                : 'post';
            const payload = activeTab === 'bodegas'
                ? {
                    ...almForm,
                    parentAlmacen: almForm.parentAlmacen || null,
                    clienteRef: almForm.propiedad === 'Cliente' ? (almForm.clienteRef || null) : null,
                    tecnicoRef: almForm.tecnicoRef || null
                }
                : activeTab === 'categorias'
                ? {
                    ...catForm,
                    imagenUrl: catForm.imagenUrl || ''
                }
                : {
                    ...prodForm,
                    clienteRef: prodForm.propiedad === 'Cliente' ? (prodForm.clienteRef || null) : null,
                    fotoUrl: prodForm.fotoUrl || ''
                };
            await logisticaApi[method](endpoint, payload);
            closeModal();
            fetchMasterData();
        } catch (err) {
            alert("Error: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const almacenesFiltrados = (data.almacenes || []).filter(a =>
        `${a.nombre || ''} ${a.codigo || ''} ${a.tipo || ''}`.toLowerCase().includes(searchAlmacen.toLowerCase())
    );
    const categoriasFiltradas = (data.categorias || []).filter(c =>
        `${c.nombre || ''} ${c.codigo || ''}`.toLowerCase().includes(searchCategoria.toLowerCase())
    );
    const productosFiltrados = (data.productos || []).filter(p =>
        `${p.nombre || ''} ${p.sku || ''} ${p.marca || ''} ${p.modelo || ''}`.toLowerCase().includes(searchProducto.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-900 text-white rounded-[2rem] shadow-2xl shadow-slate-200">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Configuración Logística</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Ecosistema 360 / Bodegas, Categorías y Existencia General</p>
                    </div>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                >
                    <Plus size={18} /> Crear {activeTab === 'bodegas' ? 'Bodega' : activeTab === 'categorias' ? 'Categoría' : 'Existencia'}
                </button>
            </header>

            {/* TABS */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
                {['bodegas', 'categorias', 'productos'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab === 'bodegas' ? 'Bodegas' : tab === 'categorias' ? 'Categorías' : 'Existencia General'}
                    </button>
                ))}
            </div>

            <main className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="py-20 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest">Sincronizando Ecosistema...</div>
                ) : (
                    <>
                    {activeTab === 'bodegas' && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchAlmacen}
                                        onChange={e => setSearchAlmacen(e.target.value)}
                                        placeholder="Buscar bodega/vehículo..."
                                        className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                <button type="button" onClick={() => setAlmacenView('grid')} className={`px-3 py-2 rounded-xl text-xs font-black ${almacenView === 'grid' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <Grid3X3 size={14} />
                                </button>
                                <button type="button" onClick={() => setAlmacenView('list')} className={`px-3 py-2 rounded-xl text-xs font-black ${almacenView === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <List size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'categorias' && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchCategoria}
                                        onChange={e => setSearchCategoria(e.target.value)}
                                        placeholder="Buscar categoría..."
                                        className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                <button type="button" onClick={() => setCategoriaView('grid')} className={`px-3 py-2 rounded-xl text-xs font-black ${categoriaView === 'grid' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <Grid3X3 size={14} />
                                </button>
                                <button type="button" onClick={() => setCategoriaView('list')} className={`px-3 py-2 rounded-xl text-xs font-black ${categoriaView === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <List size={14} />
                                </button>
                            </div>
                            {isMaster && (
                                <button
                                    type="button"
                                    onClick={handleDeleteAllCategorias}
                                    className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2"
                                >
                                    <ShieldAlert size={14} /> Eliminar Todas (Maestro)
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'productos' && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchProducto}
                                        onChange={e => setSearchProducto(e.target.value)}
                                        placeholder="Buscar existencia..."
                                        className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                                    />
                                </div>
                                <button type="button" onClick={() => setProductoView('grid')} className={`px-3 py-2 rounded-xl text-xs font-black ${productoView === 'grid' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <Grid3X3 size={14} />
                                </button>
                                <button type="button" onClick={() => setProductoView('list')} className={`px-3 py-2 rounded-xl text-xs font-black ${productoView === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <List size={14} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={downloadProductoTemplate} 
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <Download size={14} /> Descargar Plantilla
                                </button>
                                <button 
                                    type="button" 
                                    disabled={bulkLoading} 
                                    onClick={() => prodBulkInputRef.current?.click()} 
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                </button>
                                <input ref={prodBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importProductos} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'bodegas' && almacenView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Bodega/Vehículo</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Responsable</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {almacenesFiltrados.map(alm => (
                                        <tr key={alm._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                <Warehouse size={14} className="text-slate-400" /> {alm.nombre}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{alm.codigo || 'S/C'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{alm.tipo}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                {alm.tecnicoRef ? `${alm.tecnicoRef.nombres} ${alm.tecnicoRef.apellidos}` : 'No Asignado'}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${alm.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {alm.status || 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button type="button" onClick={() => handleToggleStatus('bodega', alm)} className={`p-2 rounded-lg ${alm.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={alm.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                                        {alm.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                                    </button>
                                                    <button type="button" onClick={() => handleEditAlmacen(alm)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                                    <button type="button" onClick={() => handleDeleteAlmacen(alm._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'categorias' && categoriaView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Rotación</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoriasFiltradas.map(cat => (
                                        <tr key={cat._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">{getVisualIcon(cat.icono || 'Tags', 14)} {cat.nombre}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{cat.codigo || 'S/C'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{cat.prioridadValor}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{cat.tipoRotacion}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${cat.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {cat.status || 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button type="button" onClick={() => handleToggleStatus('categoria', cat)} className={`p-2 rounded-lg ${cat.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={cat.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                                        {cat.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                                    </button>
                                                    <button type="button" onClick={() => handleEditCategoria(cat)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                                    <button type="button" onClick={() => handleDeleteCategoria(cat._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'productos' && productoView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3">Existencia</th>
                                        <th className="px-4 py-3">SKU</th>
                                        <th className="px-4 py-3">Marca</th>
                                        <th className="px-4 py-3">Modelo</th>
                                        <th className="px-4 py-3">Color</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map(prod => (
                                        <tr key={prod._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">{getVisualIcon(prod.icono || 'Archive', 14)} {prod.nombre}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{prod.sku || 'S/SKU'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{prod.marca || '-'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{prod.modelo || '-'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorHex(prod.color), display: 'inline-block' }} />
                                                    <span className="font-bold text-slate-600">{prod.color || 'Genérico'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{prod.tipo || '-'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">${Number(prod.valorUnitario || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${prod.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {prod.status || 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button type="button" onClick={() => handleToggleStatus('producto', prod)} className={`p-2 rounded-lg ${prod.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600'}`} title={prod.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                                        {prod.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                                    </button>
                                                    <button type="button" onClick={() => handleEditProducto(prod)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                                    <button type="button" onClick={() => handleDeleteProducto(prod._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {((activeTab === 'bodegas' && almacenView === 'grid') || 
                      (activeTab === 'categorias' && categoriaView === 'grid') || 
                      (activeTab === 'productos' && productoView === 'grid')) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeTab === 'bodegas' && almacenesFiltrados.map(alm => (
                                <ConfigCard key={alm._id} icon={<Warehouse size={20}/>} title={alm.nombre} sub={alm.codigo} type={alm.tipo} status={alm.status}>
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-slate-400 uppercase">Jerarquía:</span>
                                            <span className="text-slate-800">{alm.parentAlmacen?.nombre || 'Bodega Raíz'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-slate-400 uppercase">Responsable:</span>
                                            <span className="text-slate-800">{alm.tecnicoRef ? `${alm.tecnicoRef.nombres} ${alm.tecnicoRef.apellidos}` : 'No Asignado'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-slate-400 uppercase">Propiedad:</span>
                                            <span className={`px-2 py-0.5 rounded-lg ${alm.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {alm.propiedad === 'Propio' ? 'Empresa' : alm.clienteRef?.nombre || 'Cliente'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-4">
                                        <button type="button" onClick={() => handleToggleStatus('bodega', alm)} className={`p-2 rounded-lg ${alm.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={alm.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                            {alm.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                        </button>
                                        <button type="button" onClick={() => handleEditAlmacen(alm)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                        <button type="button" onClick={() => handleDeleteAlmacen(alm._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </ConfigCard>
                            ))}

                            {activeTab === 'categorias' && categoriasFiltradas.map(cat => (
                                <ConfigCard key={cat._id} icon={getVisualIcon(cat.icono || 'Tags', 20)} title={cat.nombre} sub={cat.codigo || 'S/C'} type={cat.prioridadValor} status={cat.status}>
                                    {cat.imagenUrl && (
                                        <img src={cat.imagenUrl} alt={cat.nombre} className="w-full h-24 object-cover rounded-2xl mt-3" />
                                    )}
                                    <p className="mt-4 text-[10px] text-slate-400 font-medium leading-relaxed">{cat.descripcion || 'Configuración base de stock'}</p>
                                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-4">
                                        <button type="button" onClick={() => handleToggleStatus('categoria', cat)} className={`p-2 rounded-lg ${cat.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={cat.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                            {cat.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                        </button>
                                        <button type="button" onClick={() => handleEditCategoria(cat)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                        <button type="button" onClick={() => handleDeleteCategoria(cat._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </ConfigCard>
                            ))}

                            {activeTab === 'productos' && productoView === 'grid' && productosFiltrados.map(prod => (
                                <ConfigCard key={prod._id} icon={getVisualIcon(prod.icono || 'Archive', 20)} title={prod.nombre} sub={prod.sku} type={prod.tipo} status={prod.status}>
                                    {prod.fotos?.[0] && (
                                        <img src={prod.fotos[0]} alt={prod.nombre} className="w-full h-24 object-cover rounded-2xl mt-3" />
                                    )}
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <p className="text-[8px] font-black text-slate-300 uppercase">Marca</p>
                                            <p className="text-[10px] font-black text-slate-700">{prod.marca || 'N/A'}</p>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <p className="text-[8px] font-black text-slate-300 uppercase">Modelo</p>
                                            <p className="text-[10px] font-black text-slate-700">{prod.modelo || 'N/A'}</p>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl flex items-center justify-between col-span-2">
                                            <div>
                                                <p className="text-[8px] font-black text-slate-300 uppercase">Color</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="w-2.5 h-2.5 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorHex(prod.color), display: 'inline-block' }} />
                                                    <span className="text-[10px] font-black text-slate-700">{prod.color || 'Genérico'}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-slate-300 uppercase">Tipo</p>
                                                <span className="text-[10px] font-black text-slate-700">{prod.tipo || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl col-span-2 flex items-center justify-between">
                                            <div>
                                                <p className="text-[8px] font-black text-slate-300 uppercase">Propiedad</p>
                                                <p className="text-[10px] font-black text-slate-700">{prod.propiedad === 'Propio' ? 'Empresa' : prod.clienteRef?.nombre || 'Cliente'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-emerald-300 uppercase">Precio Adq.</p>
                                                <p className="text-[10px] font-black text-emerald-600">${prod.valorUnitario?.toLocaleString() || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-4">
                                        <button type="button" onClick={() => handleToggleStatus('producto', prod)} className={`p-2 rounded-lg ${prod.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={prod.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                            {prod.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                        </button>
                                        <button type="button" onClick={() => handleEditProducto(prod)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                        <button type="button" onClick={() => handleDeleteProducto(prod._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </ConfigCard>
                            ))}
                        </div>
                    )}
                    </>
                )}
            </main>

            {/* MODAL UNIFICADO */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
                        <form onSubmit={handleAction}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                    {activeTab === 'bodegas' && editingAlmacenId
                                        ? 'Editar bodega/vehículo'
                                        : activeTab === 'categorias' && editingCategoriaId
                                        ? 'Editar categoría'
                                        : activeTab === 'productos' && editingProductoId
                                        ? 'Editar existencia'
                                        : `Registro de ${activeTab === 'productos' ? 'existencias' : activeTab === 'bodegas' ? 'bodegas/vehículos' : 'categorías'}`}
                                </h2>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Configuración Maestra 360</p>
                            </div>

                            <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {activeTab === 'bodegas' && (
                                    <>
                                        <InputField label="Nombre de Bodega/Vehículo" value={almForm.nombre} onChange={v => setAlmForm({...almForm, nombre: v})} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Tipo Unidad" value={almForm.tipo} onChange={v => setAlmForm({...almForm, tipo: v})} options={['Central', 'Sucursal', 'Móvil', 'Técnico', 'Sub-Bodega']} />
                                            <SelectField label="Propiedad" value={almForm.propiedad} onChange={v => setAlmForm({...almForm, propiedad: v})} options={['Propio', 'Cliente']} />
                                        </div>
                                        {almForm.propiedad === 'Cliente' && (
                                            <SelectField label="Cliente Dueño" value={almForm.clienteRef} onChange={v => setAlmForm({...almForm, clienteRef: v})} options={data?.clientes?.map(c => ({label: c.nombre, value: c._id}))} />
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Bodega Padre (Jerarquía)" value={almForm.parentAlmacen} onChange={v => setAlmForm({...almForm, parentAlmacen: v})} options={data?.almacenes?.map(a => ({label: a.nombre, value: a._id}))} required={false} placeholder="Sin bodega padre (Raíz)" />
                                            <SelectField label="Responsable (Personal 360)" value={almForm.tecnicoRef} onChange={v => setAlmForm({...almForm, tecnicoRef: v})} options={data?.tecnicos?.map(t => ({label: `${t.nombres} ${t.apellidos} (${t.rut}) - ${t.cargo || t.role || 'Colaborador'}`, value: t._id}))} />
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 -mt-2">
                                            Para crear una bodega padre, guarda primero una bodega con jerarquía raíz y luego podrás seleccionarla en las siguientes.
                                        </p>
                                        <InputField label="Dirección / Ubicación" value={almForm.ubicacion.direccion} onChange={v => setAlmForm({...almForm, ubicacion: { direccion: v }})} />
                                    </>
                                )}

                                {activeTab === 'categorias' && (
                                    <>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Carga masiva categorías</p>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={downloadCategoriaTemplate} className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <Download size={14} /> Plantilla
                                                </button>
                                                <button type="button" disabled={bulkLoading} onClick={() => catBulkInputRef.current?.click()} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
                                                    <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Importar'}
                                                </button>
                                            </div>
                                            <input ref={catBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importCategorias} />
                                        </div>
                                        <InputField label="Nombre Categoría" value={catForm.nombre} onChange={v => setCatForm({...catForm, nombre: v})} />
                                        <SelectField label="Icono" value={catForm.icono} onChange={v => setCatForm({...catForm, icono: v})} options={ICON_OPTIONS} />
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagen Categoría</label>
                                            <label className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none cursor-pointer flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-100 transition-all">
                                                <ImagePlus size={16} /> Subir imagen
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const img = await toBase64(file);
                                                        setCatForm({ ...catForm, imagenUrl: img });
                                                    }}
                                                />
                                            </label>
                                            {catForm.imagenUrl && <img src={catForm.imagenUrl} alt="Categoria" className="w-full h-28 object-cover rounded-2xl" />}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Valoración" value={catForm.prioridadValor} onChange={v => setCatForm({...catForm, prioridadValor: v})} options={['Bajo Valor', 'Alto Valor']} />
                                            <SelectField label="Movilidad" value={catForm.tipoRotacion} onChange={v => setCatForm({...catForm, tipoRotacion: v})} options={['Rotativo', 'Estático']} />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'productos' && (
                                    <>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Carga masiva de existencias</p>
                                            <div className="flex gap-2">
                                                <button type="button" onClick={downloadProductoTemplate} className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <Download size={14} /> Plantilla
                                                </button>
                                                <button type="button" disabled={bulkLoading} onClick={() => prodBulkInputRef.current?.click()} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50">
                                                    <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Importar'}
                                                </button>
                                            </div>
                                            <input ref={prodBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importProductos} />
                                        </div>
                                        <InputField label="Nombre de la Existencia" value={prodForm.nombre} onChange={v => setProdForm({...prodForm, nombre: v})} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Código SKU (Vacío = Auto)" value={prodForm.sku} onChange={v => setProdForm({...prodForm, sku: v})} />
                                            <InputField label="Código EAN (Barras)" value={prodForm.ean} onChange={v => setProdForm({...prodForm, ean: v})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Categoría" value={prodForm.categoria} onChange={v => setProdForm({...prodForm, categoria: v})} options={data?.categorias?.map(c => ({label: c.nombre, value: c._id}))} />
                                            <SelectField label="Tipo" value={prodForm.tipo} onChange={v => setProdForm({...prodForm, tipo: v})} options={['Activo', 'Suministro']} />
                                        </div>
                                        <SelectField label="Icono" value={prodForm.icono} onChange={v => setProdForm({...prodForm, icono: v})} options={ICON_OPTIONS} />
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagen de la Existencia</label>
                                            <label className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none cursor-pointer flex items-center justify-center gap-2 text-slate-500 hover:bg-slate-100 transition-all">
                                                <ImagePlus size={16} /> Subir imagen
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async e => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const img = await toBase64(file);
                                                        setProdForm({ ...prodForm, fotoUrl: img });
                                                    }}
                                                />
                                            </label>
                                            {prodForm.fotoUrl && <img src={prodForm.fotoUrl} alt="Existencia" className="w-full h-28 object-cover rounded-2xl" />}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Marca" value={prodForm.marca} onChange={v => setProdForm({...prodForm, marca: v})} />
                                            <InputField label="Modelo" value={prodForm.modelo} onChange={v => setProdForm({...prodForm, modelo: v})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Unidad de Medida" value={prodForm.unidadMedida} onChange={v => setProdForm({...prodForm, unidadMedida: v})} options={['Unidad', 'Metro', 'Litro', 'Kilogramo', 'Caja', 'Pack']} />
                                            <InputField label="Descripción" value={prodForm.descripcion} onChange={v => setProdForm({...prodForm, descripcion: v})} />
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-3xl border border-emerald-100">
                                            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Precio Unitario de Adquisición ($)</label>
                                            <input 
                                                type="number" required
                                                value={prodForm.valorUnitario}
                                                onChange={e => setProdForm({...prodForm, valorUnitario: parseFloat(e.target.value)})}
                                                className="w-full mt-2 p-4 bg-white border-none rounded-2xl text-sm font-bold outline-none shadow-sm"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Color" value={prodForm.color || 'Genérico'} onChange={v => setProdForm({...prodForm, color: v})} options={COLOR_OPTIONS} />
                                            <SelectField label="Segmentación" value={prodForm.segmentacion} onChange={v => setProdForm({...prodForm, segmentacion: v})} options={['Crítico', 'Estándar', 'Consumo']} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Propiedad" value={prodForm.propiedad} onChange={v => setProdForm({...prodForm, propiedad: v})} options={['Propio', 'Cliente']} />
                                            {prodForm.propiedad === 'Cliente' && (
                                                <SelectField label="Cliente Dueño" value={prodForm.clienteRef} onChange={v => setProdForm({...prodForm, clienteRef: v})} options={data?.clientes?.map(c => ({label: c.nombre, value: c._id}))} />
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400">Cancelar</button>
                                <button type="submit" disabled={saving} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-50">
                                    {saving
                                        ? 'Guardando...'
                                        : activeTab === 'bodegas' && editingAlmacenId
                                        ? 'Actualizar Bodega'
                                        : activeTab === 'categorias' && editingCategoriaId
                                        ? 'Actualizar Categoría'
                                        : activeTab === 'productos' && editingProductoId
                                        ? 'Actualizar Producto'
                                        : 'Guardar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const ConfigCard = ({ icon, title, sub, type, status, children }) => {
    const isInactive = status === 'Inactivo';
    return (
        <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group relative overflow-hidden ${isInactive ? 'opacity-70 bg-slate-50/50' : ''}`}>
            {isInactive && (
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-[8px] font-black uppercase tracking-widest text-rose-600 shadow-sm">
                    <Lock size={8} /> Bloqueado
                </div>
            )}
            <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-all animate-in fade-in duration-300">
                    {icon}
                </div>
                {!isInactive && type && (
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-[8px] font-black uppercase tracking-widest text-slate-500">
                        {type}
                    </div>
                )}
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{sub}</p>
            {children}
        </div>
    );
};

const InputField = ({ label, value, onChange }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <input 
            required type="text" value={value} 
            onChange={e => onChange(e.target.value)}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none ring-2 ring-transparent focus:ring-slate-100 transition-all"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options, required = true, placeholder = 'Seleccionar...' }) => (
    <div className="space-y-2">
        <SmartSelect
            label={label}
            required={required}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            options={options}
        />
    </div>
);

export default ConfigLogistica;
