import React, { useState, useEffect, useRef } from 'react';
import { 
    Settings, Warehouse, Tags, Box, Plus, Search,
    MoreHorizontal, MapPin, Truck, User, ArrowRight,
    Anchor, Repeat, ChevronRight, Archive, Upload,
    Download, ImagePlus, Package, Grid3X3, List, Pencil, Trash2, ShieldAlert,
    Lock, Unlock, Sparkles, Briefcase, ChevronDown, ChevronUp,
    Wrench, Shield, Cpu, Layers, Hammer, Gauge, CheckCircle2, AlertTriangle, GitFork, Boxes
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import * as XLSX from 'xlsx';
import SmartSelect from '../components/SmartSelect';
import axios from 'axios';
import API_URL from '../../../config';


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

const generateIntelligentDescription = (item) => {
    const nombre = item.nombre ? String(item.nombre).trim() : '';
    const categoria = item.categoria ? String(item.categoria).trim() : 'Logística';
    const marca = item.marca ? String(item.marca).trim() : '';
    const modelo = item.modelo ? String(item.modelo).trim() : '';
    const tipo = item.tipo ? String(item.tipo).trim() : 'Activo';
    const segmentacion = item.segmentacion ? String(item.segmentacion).trim() : 'Estándar';

    let desc = `${nombre}. `;
    desc += `Artículo de la categoría de ${categoria} (${tipo.toLowerCase()}). `;
    
    if (marca && modelo) {
        desc += `Fabricado por la marca líder ${marca} (Modelo: ${modelo}). `;
    } else if (marca) {
        desc += `Fabricado por la marca de alta calidad ${marca}. `;
    } else if (modelo) {
        desc += `Modelo técnico: ${modelo}. `;
    }
    
    if (segmentacion === 'Crítico') {
        desc += `Clasificado como insumo crítico, indispensable para asegurar la operatividad y evitar interrupciones de servicio. `;
    } else {
        desc += `Insumo estándar diseñado para cumplir de manera óptima con los requerimientos logísticos diarios. `;
    }
    
    desc += `Registrado en el Ecosistema 360 de Control de Existencias.`;
    return desc;
};

const stringSimilarity = (str1, str2) => {
    const s1 = String(str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = String(str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (s1 === s2) return 1.0;
    if (s1.length < 2 || s2.length < 2) return 0.0;

    const bigrams1 = new Map();
    for (let i = 0; i < s1.length - 1; i++) {
        const bigram = s1.substr(i, 2);
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.substr(i, 2);
        const count = bigrams1.get(bigram) || 0;
        if (count > 0) {
            intersection++;
            bigrams1.set(bigram, count - 1);
        }
    }

    return (2.0 * intersection) / (s1.length + s2.length - 2);
};

const getVisualIcon = (name, size = 20) => {
    const normalized = String(name || '').toLowerCase();
    if (normalized === 'tags') return <Tags size={size} />;
    if (normalized === 'package') return <Package size={size} />;
    if (normalized === 'warehouse') return <Warehouse size={size} />;
    return <Archive size={size} />;
};

const getInitials = (name) => {
    if (!name) return 'ST';
    const chunks = name.split(/\s+/).filter(Boolean);
    if (chunks.length === 0) return 'ST';
    if (chunks.length === 1) return chunks[0].substring(0, 2).toUpperCase();
    return (chunks[0][0] + chunks[chunks.length - 1][0]).toUpperCase();
};

const getAbbreviatedStatus = (estado) => {
    const s = String(estado || '').trim();
    if (['En Postulación', 'Postulando', 'POST'].includes(s)) return 'POST';
    if (['En Entrevista', 'En Evaluación', 'ENTR'].includes(s)) return 'ENTR';
    if (['Aprobado', 'Aprobado/No Operativo', 'APROB'].includes(s)) return 'APROB';
    if (['En Acreditación', 'Acreditación', 'En Documentación', 'ACRED'].includes(s)) return 'ACRED';
    if (['Contratado', 'Listo Terreno', 'CONT'].includes(s)) return 'CONT';
    if (['En Terreno', 'EN TERR', 'OPERATIVO', 'ACTIVO'].includes(s)) return 'ACTIVO';
    if (['Suspendido', 'Bloqueado', 'Ausente', 'Licencia Médica', 'Inactivo', 'INACTIVO'].includes(s)) return 'INACTIVO';
    if (['Rechazado', 'Retirado', 'Finiquitado', 'Bajas/Inactivos', 'De Baja', 'DE BAJA'].includes(s)) return 'DE BAJA';
    return 'ACTIVO';
};

const getEstadoTalentoBadge = (estado) => {
    const abb = getAbbreviatedStatus(estado);

    let colorClasses = 'bg-slate-50 text-slate-500 border-slate-200';
    if (abb === 'POST') colorClasses = 'bg-indigo-50 text-indigo-600 border-indigo-200';
    else if (abb === 'ENTR') colorClasses = 'bg-violet-50 text-violet-600 border-violet-200';
    else if (abb === 'APROB') colorClasses = 'bg-teal-50 text-teal-600 border-teal-200';
    else if (abb === 'ACRED') colorClasses = 'bg-orange-50 text-orange-600 border-orange-200';
    else if (abb === 'CONT') colorClasses = 'bg-cyan-50 text-cyan-600 border-cyan-200';
    else if (abb === 'ACTIVO') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (abb === 'INACTIVO') colorClasses = 'bg-amber-50 text-amber-600 border-amber-200';
    else if (abb === 'DE BAJA') colorClasses = 'bg-rose-50 text-rose-600 border-rose-200';

    return (
        <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${colorClasses}`}>
            {abb}
        </span>
    );
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
    const [searchPersonal, setSearchPersonal] = useState('');
    const [personalView, setPersonalView] = useState('grid');
    const [filterPersonalProyecto, setFilterPersonalProyecto] = useState('');
    const [filterPersonalCliente, setFilterPersonalCliente] = useState('');
    const [filterPersonalEstado, setFilterPersonalEstado] = useState('');
    const [filterPersonalToa, setFilterPersonalToa] = useState('all');
    const [productoView, setProductoView] = useState('grid');
    const [editingProductoId, setEditingProductoId] = useState(null);
    const [filterProdCategoria, setFilterProdCategoria] = useState('');
    const [filterProdTipo, setFilterProdTipo] = useState('');
    const [filterProdSegmentacion, setFilterProdSegmentacion] = useState('');
    const [filterProdPropiedad, setFilterProdPropiedad] = useState('');
    const [isMaster, setIsMaster] = useState(false);
    const catBulkInputRef = useRef(null);
    const prodBulkInputRef = useRef(null);
    const almBulkInputRef = useRef(null);
    const personalBulkInputRef = useRef(null);
    const cargosBulkInputRef = useRef(null);
    const seriadosBulkInputRef = useRef(null);
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiProgress, setAiProgress] = useState(false);
    const [inlineSimilarityWarning, setInlineSimilarityWarning] = useState(null);
    const [duplicateResolutionQueue, setDuplicateResolutionQueue] = useState([]);
    const [showResolutionModal, setShowResolutionModal] = useState(false);
    const [pendingUploadList, setPendingUploadList] = useState([]);
    const [selectedProdCategoryTab, setSelectedProdCategoryTab] = useState('TODOS');
    const [activeProdCategoryDetail, setActiveProdCategoryDetail] = useState(null);

    // Form states
    const [almForm, setAlmForm] = useState({ nombre: '', codigo: '', tipo: 'Central', parentAlmacen: '', tecnicoRef: '', ubicacion: { direccion: '' }, propiedad: 'Propio', clienteRef: '' });
    const [catForm, setCatForm] = useState({ nombre: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo', icono: 'Tags', imagenUrl: '' });
    const [prodForm, setProdForm] = useState({ nombre: '', sku: '', ean: '', categoria: '', marca: '', modelo: '', nroSerie: '', imei: '', trackSerial: false, unidadMedida: 'Unidad', descripcion: '', tipo: 'Activo', color: 'Genérico', segmentacion: 'Estándar', propiedad: 'Propio', clienteRef: '', valorUnitario: 0, icono: 'Archive', fotoUrl: '' });
    const [searchCargo, setSearchCargo] = useState('');
    const [filterCargoCategoria, setFilterCargoCategoria] = useState('');
    const [filterCargoEstado, setFilterCargoEstado] = useState('');
    const [filterCargoBase, setFilterCargoBase] = useState('');
    const [cargoForm, setCargoForm] = useState({ cargo: '', nombreTipoCargo: '', items: [] });
    const [editingCargoId, setEditingCargoId] = useState(null);
    const [expandedCargos, setExpandedCargos] = useState({});

    // States para Asignación Inteligente
    const [showAsignacionModal, setShowAsignacionModal] = useState(false);
    const [tecnicoAsignacion, setTecnicoAsignacion] = useState(null);
    const [almacenOrigenAsig, setAlmacenOrigenAsig] = useState('');
    const [asignacionSimulacion, setAsignacionSimulacion] = useState(null);
    const [isSimulatingAsignacion, setIsSimulatingAsignacion] = useState(false);
    const [isConfirmingAsignacion, setIsConfirmingAsignacion] = useState(false);

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

    useEffect(() => {
        const nombreVal = String(prodForm.nombre || '').trim();
        if (nombreVal.length < 3) {
            setInlineSimilarityWarning(null);
            return;
        }

        const match = (data.productos || []).find(p => {
            if (p._id === editingProductoId) return false;
            return stringSimilarity(p.nombre, nombreVal) >= 0.70;
        });

        if (match) {
            setInlineSimilarityWarning(match);
        } else {
            setInlineSimilarityWarning(null);
        }
    }, [prodForm.nombre, editingProductoId, data.productos]);

    // --- ASIGNACIÓN INTELIGENTE DE CARGO ---
    const handleOpenAsignacionModal = (tecnico) => {
        setTecnicoAsignacion(tecnico);
        setAlmacenOrigenAsig(''); // Podría autoseleccionarse la bodega central si la ubicamos
        setAsignacionSimulacion(null);
        setShowAsignacionModal(true);
    };

    const handleCloseAsignacionModal = () => {
        setShowAsignacionModal(false);
        setTecnicoAsignacion(null);
        setAlmacenOrigenAsig('');
        setAsignacionSimulacion(null);
    };

    const simularAsignacion = async () => {
        if (!tecnicoAsignacion) return;
        setIsSimulatingAsignacion(true);
        try {
            const res = await logisticaApi.post(`/tecnicos/${tecnicoAsignacion._id}/asignar-cargo`, {
                almacenOrigen: almacenOrigenAsig || null,
                dryRun: true
            });
            setAsignacionSimulacion(res.data.simulacion);
        } catch (err) {
            alert('Error al simular la asignación: ' + (err.response?.data?.message || err.message));
            setAsignacionSimulacion(null);
        } finally {
            setIsSimulatingAsignacion(false);
        }
    };

    const confirmarAsignacion = async () => {
        if (!tecnicoAsignacion) return;
        setIsConfirmingAsignacion(true);
        try {
            const res = await logisticaApi.post(`/tecnicos/${tecnicoAsignacion._id}/asignar-cargo`, {
                almacenOrigen: almacenOrigenAsig || null,
                dryRun: false
            });
            alert(res.data.message || 'Asignación realizada con éxito');
            handleCloseAsignacionModal();
            fetchMasterData();
        } catch (err) {
            alert('Error al procesar asignación: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsConfirmingAsignacion(false);
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAlmacenId(null);
        setEditingCategoriaId(null);
        setEditingProductoId(null);
        setEditingCargoId(null);
        setAlmForm({ nombre: '', codigo: '', tipo: 'Central', parentAlmacen: '', tecnicoRef: '', ubicacion: { direccion: '' }, propiedad: 'Propio', clienteRef: '' });
        setCatForm({ nombre: '', prioridadValor: 'Bajo Valor', tipoRotacion: 'Rotativo', icono: 'Tags', imagenUrl: '' });
        setProdForm({ nombre: '', sku: '', ean: '', categoria: '', marca: '', modelo: '', nroSerie: '', imei: '', estadoDetallado: 'Nuevo', unidadMedida: 'Unidad', descripcion: '', tipo: 'Activo', color: 'Genérico', segmentacion: 'Estándar', propiedad: 'Propio', clienteRef: '', valorUnitario: 0, icono: 'Archive', fotoUrl: '' });
        setCargoForm({ cargo: '', nombreTipoCargo: '', items: [] });
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
                : type === 'cargo'
                ? `/cargo-equipamiento/${item._id}`
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

    const handleEditCargo = (cargoEquip) => {
        setEditingCargoId(cargoEquip._id);
        setCargoForm({
            cargo: cargoEquip.cargo || '',
            nombreTipoCargo: cargoEquip.nombreTipoCargo || cargoEquip.cargo || '',
            items: (cargoEquip.items || []).map(it => ({
                productoRef: it.productoRef?._id || it.productoRef || '',
                cantidad: it.cantidad || 1,
                estadoProducto: it.estadoProducto || 'Nuevo'
            }))
        });
        setActiveTab('cargos');
        setShowModal(true);
    };

    const handleDeleteCargo = async (id) => {
        if (!window.confirm('¿Eliminar esta configuración de cargo?')) return;
        try {
            await logisticaApi.delete(`/cargo-equipamiento/${id}`);
            fetchMasterData();
        } catch (err) {
            alert('Error al eliminar configuración: ' + (err.response?.data?.message || err.message));
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
            nroSerie: prod.nroSerie || '',
            imei: prod.imei || '',
            trackSerial: prod.trackSerial || false,
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
        if (prod.nroSerie || prod.trackSerial) {
            setActiveTab('seriados');
        } else {
            setActiveTab('productos');
        }
        setShowModal(true);
    };

    const handleDerivarASeriado = (prod) => {
        setEditingProductoId(null);
        setProdForm({
            nombre: prod.nombre || '',
            sku: '',
            ean: '',
            categoria: prod.categoria?._id || prod.categoria || '',
            marca: prod.marca || '',
            modelo: prod.modelo || '',
            nroSerie: '',
            imei: '',
            estadoDetallado: 'Nuevo',
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
        setActiveTab('seriados');
        setShowModal(true);
    };

    const handleIrAPlantillaBase = (nombreProducto) => {
        setSearchProducto(nombreProducto);
        setActiveTab('productos');
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
        const templateData = [
            {
                nombre: 'Herramientas',
                descripcion: 'Herramientas de mano, peladoras y cortadoras',
                prioridadValor: 'Bajo Valor',
                tipoRotacion: 'Rotativo',
                icono: 'Tags',
                imagenUrl: ''
            },
            {
                nombre: 'Equipos Activos',
                descripcion: 'Equipos electrónicos de alto valor e instrumentación',
                prioridadValor: 'Alto Valor',
                tipoRotacion: 'Rotativo',
                icono: 'Tags',
                imagenUrl: ''
            }
        ];

        const instrucciones = [
            { 'Columna': 'nombre', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre de la categoría.' },
            { 'Columna': 'descripcion', 'Obligatorio': 'NO', 'Descripción': 'Descripción del uso de la categoría.' },
            { 'Columna': 'prioridadValor', 'Obligatorio': 'SÍ', 'Descripción': 'Bajo Valor o Alto Valor.' },
            { 'Columna': 'tipoRotacion', 'Obligatorio': 'SÍ', 'Descripción': 'Rotativo o Consumible.' },
            { 'Columna': 'icono', 'Obligatorio': 'NO', 'Descripción': 'Tags, Archive, Package, Warehouse.' },
            { 'Columna': 'imagenUrl', 'Obligatorio': 'NO', 'Descripción': 'URL opcional de la imagen de la categoría.' }
        ];

        const opcionValores = [
            { 'Prioridad de Valor': 'Bajo Valor' },
            { 'Prioridad de Valor': 'Alto Valor' }
        ];

        const opcionRotacion = [
            { 'Tipo de Rotación': 'Rotativo' },
            { 'Tipo de Rotación': 'Consumible' }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsValores = XLSX.utils.json_to_sheet(opcionValores);
        const wsRotacion = XLSX.utils.json_to_sheet(opcionRotacion);

        XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        XLSX.utils.book_append_sheet(wb, wsValores, 'Prioridad Valor');
        XLSX.utils.book_append_sheet(wb, wsRotacion, 'Tipo Rotación');

        XLSX.writeFile(wb, 'Plantilla_Categorias_Logistica.xlsx');
    };

    const downloadProductoTemplate = () => {
        const templateData = [
            {
                nombre: 'Balde de Lona',
                sku: 'PRD-00001',
                ean: '7801234567890',
                categoria: 'Herramientas',
                marca: 'Tolsen',
                modelo: 'Lona-20',
                color: 'Genérico',
                unidadMedida: 'Unidad',
                descripcion: 'Balde de lona reforzado para trabajos en altura',
                tipo: 'Suministro',
                segmentacion: 'Estándar',
                propiedad: 'Propio',
                valorUnitario: 12000,
                icono: 'Archive',
                imagenUrl: ''
            },
            {
                nombre: 'Cortadora 3 Pasos FO',
                sku: 'PRD-00003',
                ean: '7801234567892',
                categoria: 'Herramientas',
                marca: 'Miller',
                modelo: 'FO-3P',
                color: 'Genérico',
                unidadMedida: 'Unidad',
                descripcion: 'Cortadora pelacable de fibra óptica de 3 posiciones',
                tipo: 'Suministro',
                segmentacion: 'Crítico',
                propiedad: 'Propio',
                valorUnitario: 45000,
                icono: 'Archive',
                imagenUrl: ''
            }
        ];

        const instrucciones = [
            { 'Columna': 'nombre', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre descriptivo del artículo.' },
            { 'Columna': 'sku', 'Obligatorio': 'SÍ', 'Descripción': 'Código único de identificación.' },
            { 'Columna': 'ean', 'Obligatorio': 'NO', 'Descripción': 'Código de barras de 13 dígitos.' },
            { 'Columna': 'categoria', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre exacto de una categoría existente.' },
            { 'Columna': 'marca', 'Obligatorio': 'NO', 'Descripción': 'Marca del artículo.' },
            { 'Columna': 'modelo', 'Obligatorio': 'NO', 'Descripción': 'Modelo del artículo.' },
            { 'Columna': 'color', 'Obligatorio': 'NO', 'Descripción': 'Color del artículo (Ej: Genérico, Rojo, Azul).' },
            { 'Columna': 'unidadMedida', 'Obligatorio': 'SÍ', 'Descripción': 'Unidad, Metro, Litro, etc.' },
            { 'Columna': 'descripcion', 'Obligatorio': 'NO', 'Descripción': 'Detalle del artículo.' },
            { 'Columna': 'tipo', 'Obligatorio': 'SÍ', 'Descripción': 'Activo o Suministro.' },
            { 'Columna': 'segmentacion', 'Obligatorio': 'SÍ', 'Descripción': 'Estándar o Crítico.' },
            { 'Columna': 'propiedad', 'Obligatorio': 'SÍ', 'Descripción': 'Propio o Cliente.' },
            { 'Columna': 'valorUnitario', 'Obligatorio': 'SÍ', 'Descripción': 'Valor monetario en CLP.' },
            { 'Columna': 'icono', 'Obligatorio': 'NO', 'Descripción': 'Archive, Tags, Package, Warehouse.' },
            { 'Columna': 'imagenUrl', 'Obligatorio': 'NO', 'Descripción': 'URL opcional de la foto del artículo.' }
        ];

        const opcionCategorias = (data.categorias || []).map(c => ({
            'Categoría Existente': c.nombre || '',
            'Descripción': c.descripcion || ''
        }));

        const opcionColores = COLOR_OPTIONS.map(c => ({ 'Colores Aceptados': c }));
        const opcionTipos = [{ 'Tipos de Existencia': 'Activo' }, { 'Tipos de Existencia': 'Suministro' }];
        const opcionSegmento = [{ 'Segmentación': 'Estándar' }, { 'Segmentación': 'Crítico' }];
        const opcionPropiedad = [{ 'Propiedad': 'Propio' }, { 'Propiedad': 'Cliente' }];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsCategorias = XLSX.utils.json_to_sheet(opcionCategorias);
        const wsColores = XLSX.utils.json_to_sheet(opcionColores);
        const wsTipos = XLSX.utils.json_to_sheet(opcionTipos);
        const wsSegmento = XLSX.utils.json_to_sheet(opcionSegmento);
        const wsPropiedad = XLSX.utils.json_to_sheet(opcionPropiedad);

        XLSX.utils.book_append_sheet(wb, ws, 'Existencias');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        if (opcionCategorias.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsCategorias, 'Categorías Disponibles');
        }
        XLSX.utils.book_append_sheet(wb, wsColores, 'Colores Aceptados');
        XLSX.utils.book_append_sheet(wb, wsTipos, 'Tipos Existencia');
        XLSX.utils.book_append_sheet(wb, wsSegmento, 'Segmentaciones');
        XLSX.utils.book_append_sheet(wb, wsPropiedad, 'Propiedad');

        XLSX.writeFile(wb, 'Plantilla_Existencias_Logistica.xlsx');
    };

    const downloadAlmacenTemplate = () => {
        const templateData = [
            {
                nombre: 'Bodega Central Santiago',
                codigo: 'BOD-CENTRAL',
                tipo: 'Central',
                direccion: 'Av. Providencia 1234, Santiago',
                propiedad: 'Propio',
                tecnicoRut: '',
                clienteRef: ''
            },
            {
                nombre: 'Vehículo Móvil 05 - Juan Pérez',
                codigo: 'VEH-05',
                tipo: 'Vehículo',
                direccion: 'Móvil RM',
                propiedad: 'Propio',
                tecnicoRut: '12.345.678-9',
                clienteRef: ''
            }
        ];

        const instrucciones = [
            { 'Columna': 'nombre', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre de la bodega o vehículo.' },
            { 'Columna': 'codigo', 'Obligatorio': 'NO', 'Descripción': 'Código único identificador.' },
            { 'Columna': 'tipo', 'Obligatorio': 'SÍ', 'Descripción': 'Central, Bodega Técnica, Vehículo, Cliente.' },
            { 'Columna': 'direccion', 'Obligatorio': 'NO', 'Descripción': 'Dirección física o zona de operación.' },
            { 'Columna': 'propiedad', 'Obligatorio': 'SÍ', 'Descripción': 'Propio o Cliente.' },
            { 'Columna': 'tecnicoRut', 'Obligatorio': 'NO', 'Descripción': 'RUT del técnico asignado (ej: 12.345.678-9).' },
            { 'Columna': 'clienteRef', 'Obligatorio': 'NO', 'Descripción': 'Nombre o ID del cliente asociado.' }
        ];

        const opcionTecnicos = (data.tecnicos || []).map(t => ({
            'RUT Técnico': t.rut || '',
            'Nombre Completo': `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
            'Cargo': t.cargo || ''
        }));

        const opcionTipos = [
            { 'Tipos de Bodega': 'Central' },
            { 'Tipos de Bodega': 'Bodega Técnica' },
            { 'Tipos de Bodega': 'Vehículo' },
            { 'Tipos de Bodega': 'Cliente' }
        ];

        const opcionPropiedad = [
            { 'Propiedad': 'Propio' },
            { 'Propiedad': 'Cliente' }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsTecnicos = XLSX.utils.json_to_sheet(opcionTecnicos);
        const wsTipos = XLSX.utils.json_to_sheet(opcionTipos);
        const wsPropiedad = XLSX.utils.json_to_sheet(opcionPropiedad);

        XLSX.utils.book_append_sheet(wb, ws, 'Bodegas');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        XLSX.utils.book_append_sheet(wb, wsTipos, 'Tipos Bodega');
        XLSX.utils.book_append_sheet(wb, wsPropiedad, 'Propiedad');
        if (opcionTecnicos.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsTecnicos, 'Técnicos Disponibles');
        }

        XLSX.writeFile(wb, 'Plantilla_Bodegas_Logistica.xlsx');
    };

    const downloadPersonalTemplate = () => {
        const templateData = [
            {
                rut: '12.345.678-9',
                fullName: 'Juan Ignacio Pérez Silva',
                email: 'juan.perez@dominio.com',
                phone: '+56912345678',
                position: 'Técnico Telecomunicaciones',
                projectName: 'PLANTA EXTERNA SANTIAGO',
                clienteNombre: 'VTR',
                ceco: 'RM-SCL-01',
                area: 'Operaciones',
                departamento: 'Logística y Terreno',
                sede: 'Santiago Centro',
                idRecursoToa: 'TOA-10293',
                status: 'Contratado',
                contractType: 'PLAZO FIJO',
                contractStartDate: '01/05/2026',
                contractEndDate: '31/07/2026',
                previsionSalud: 'FONASA',
                isapreNombre: '',
                valorPlan: '',
                monedaPlan: 'UF',
                afp: 'PROVIDA',
                banco: 'BANCO ESTADO',
                tipoCuenta: 'Cuenta RUT',
                numeroCuenta: '12345678',
                sueldoBase: 650000,
                requiereLicencia: 'SI',
                fechaVencimientoLicencia: '15/12/2028',
                shirtSize: 'M',
                pantsSize: '42',
                jacketSize: 'L',
                shoeSize: '41'
            }
        ];

        const instrucciones = [
            { 'Columna': 'rut', 'Obligatorio': 'SÍ', 'Descripción': 'RUT del colaborador (con puntos y guion).' },
            { 'Columna': 'fullName', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre completo del colaborador.' },
            { 'Columna': 'email', 'Obligatorio': 'NO', 'Descripción': 'Correo electrónico institucional o personal.' },
            { 'Columna': 'phone', 'Obligatorio': 'NO', 'Descripción': 'Teléfono de contacto.' },
            { 'Columna': 'position', 'Obligatorio': 'SÍ', 'Descripción': 'Cargo exacto (ej: Técnico Telecomunicaciones).' },
            { 'Columna': 'projectName', 'Obligatorio': 'NO', 'Descripción': 'Nombre del proyecto asignado.' },
            { 'Columna': 'clienteNombre', 'Obligatorio': 'NO', 'Descripción': 'Nombre del mandante/cliente.' },
            { 'Columna': 'ceco', 'Obligatorio': 'NO', 'Descripción': 'Centro de Costos (CECO).' },
            { 'Columna': 'area', 'Obligatorio': 'NO', 'Descripción': 'Área funcional.' },
            { 'Columna': 'departamento', 'Obligatorio': 'NO', 'Descripción': 'Departamento interno.' },
            { 'Columna': 'sede', 'Obligatorio': 'NO', 'Descripción': 'Sede física asignada.' },
            { 'Columna': 'idRecursoToa', 'Obligatorio': 'NO', 'Descripción': 'Identificador de recurso en TOA.' },
            { 'Columna': 'status', 'Obligatorio': 'NO', 'Descripción': 'Contratado, Inactivo, Licencia Médica.' },
            { 'Columna': 'contractType', 'Obligatorio': 'NO', 'Descripción': 'PLAZO FIJO, INDEFINIDO, por obra.' },
            { 'Columna': 'contractStartDate', 'Obligatorio': 'NO', 'Descripción': 'Fecha de ingreso en formato DD/MM/AAAA.' },
            { 'Columna': 'contractEndDate', 'Obligatorio': 'NO', 'Descripción': 'Fecha de término (opcional, DD/MM/AAAA).' },
            { 'Columna': 'previsionSalud', 'Obligatorio': 'NO', 'Descripción': 'FONASA o ISAPRE.' },
            { 'Columna': 'isapreNombre', 'Obligatorio': 'NO', 'Descripción': 'Nombre de la ISAPRE (si corresponde).' },
            { 'Columna': 'valorPlan', 'Obligatorio': 'NO', 'Descripción': 'Valor del plan de salud.' },
            { 'Columna': 'monedaPlan', 'Obligatorio': 'NO', 'Descripción': 'UF o CLP.' },
            { 'Columna': 'afp', 'Obligatorio': 'NO', 'Descripción': 'Nombre de la AFP.' },
            { 'Columna': 'banco', 'Obligatorio': 'NO', 'Descripción': 'Nombre del banco.' },
            { 'Columna': 'tipoCuenta', 'Obligatorio': 'NO', 'Descripción': 'Tipo de cuenta (ej: Corriente, Vista).' },
            { 'Columna': 'numeroCuenta', 'Obligatorio': 'NO', 'Descripción': 'Número de cuenta bancaria.' },
            { 'Columna': 'sueldoBase', 'Obligatorio': 'NO', 'Descripción': 'Sueldo base bruto.' },
            { 'Columna': 'requiereLicencia', 'Obligatorio': 'NO', 'Descripción': 'SI o NO.' },
            { 'Columna': 'fechaVencimientoLicencia', 'Obligatorio': 'NO', 'Descripción': 'Vencimiento de licencia (DD/MM/AAAA).' },
            { 'Columna': 'shirtSize', 'Obligatorio': 'NO', 'Descripción': 'Talla de camisa (S, M, L, XL).' },
            { 'Columna': 'pantsSize', 'Obligatorio': 'NO', 'Descripción': 'Talla de pantalón.' },
            { 'Columna': 'jacketSize', 'Obligatorio': 'NO', 'Descripción': 'Talla de parka/chaqueta.' },
            { 'Columna': 'shoeSize', 'Obligatorio': 'NO', 'Descripción': 'Talla de calzado.' }
        ];

        const opcionCargosValidos = uniqueCargos.map(c => ({ 'Cargo Registrado': c }));
        const opcionPrevision = [{ 'Previsión': 'FONASA' }, { 'Previsión': 'ISAPRE' }];
        const opcionMoneda = [{ 'Moneda Plan': 'UF' }, { 'Moneda Plan': 'CLP' }];
        const opcionLicencia = [{ 'Requiere Licencia': 'SI' }, { 'Requiere Licencia': 'NO' }];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsPrevision = XLSX.utils.json_to_sheet(opcionPrevision);
        const wsMoneda = XLSX.utils.json_to_sheet(opcionMoneda);
        const wsLicencia = XLSX.utils.json_to_sheet(opcionLicencia);
        const wsCargosValidos = XLSX.utils.json_to_sheet(opcionCargosValidos);

        XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        XLSX.utils.book_append_sheet(wb, wsPrevision, 'Previsión de Salud');
        XLSX.utils.book_append_sheet(wb, wsMoneda, 'Moneda Plan');
        XLSX.utils.book_append_sheet(wb, wsLicencia, 'Uso de Licencia');
        if (opcionCargosValidos.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsCargosValidos, 'Cargos Registrados');
        }

        XLSX.writeFile(wb, 'Plantilla_Colaboradores_Logistica.xlsx');
    };

    const downloadSeriadosTemplate = () => {
        const templateData = [
            {
                nombre: 'Fusionadora de Fibra Óptica',
                sku: 'PRD-FUS01',
                nroSerie: 'FUS-991823A',
                imei: '',
                estadoDetallado: 'Nuevo',
                ean: '7809988223311',
                categoria: 'Equipos Activos',
                marca: 'Fujikura',
                modelo: '88S+',
                color: 'Gris',
                unidadMedida: 'Unidad',
                descripcion: 'Fusionadora de fibra óptica de alineación por núcleo premium',
                tipo: 'Activo',
                segmentacion: 'Crítico',
                propiedad: 'Propio',
                valorUnitario: 3500000,
                icono: 'Archive',
                imagenUrl: ''
            },
            {
                nombre: 'Equipo Móvil Operaciones',
                sku: 'PRD-TEL05',
                nroSerie: 'IMEI-88221923',
                imei: '862093849102938',
                estadoDetallado: 'Nuevo',
                ean: '7801234560099',
                categoria: 'Equipos Activos',
                marca: 'Samsung',
                modelo: 'Galaxy A34',
                color: 'Negro',
                unidadMedida: 'Unidad',
                descripcion: 'Teléfono celular asignado para operaciones en terreno',
                tipo: 'Activo',
                segmentacion: 'Estándar',
                propiedad: 'Propio',
                valorUnitario: 220000,
                icono: 'Archive',
                imagenUrl: ''
            }
        ];

        const instrucciones = [
            { 'Columna': 'nombre', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre del activo o herramienta.' },
            { 'Columna': 'sku', 'Obligatorio': 'SÍ', 'Descripción': 'Código único de producto (SKU).' },
            { 'Columna': 'nroSerie', 'Obligatorio': 'SÍ', 'Descripción': 'Número de serie físico único del activo.' },
            { 'Columna': 'imei', 'Obligatorio': 'NO', 'Descripción': 'Código IMEI de 15 dígitos (ej. teléfonos, routers).' },
            { 'Columna': 'estadoDetallado', 'Obligatorio': 'SÍ', 'Descripción': 'Nuevo, Usado Reacondicionado, Para Reparar, Baja.' },
            { 'Columna': 'ean', 'Obligatorio': 'NO', 'Descripción': 'Código de barras de 13 dígitos.' },
            { 'Columna': 'categoria', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre exacto de una categoría existente.' },
            { 'Columna': 'marca', 'Obligatorio': 'NO', 'Descripción': 'Marca del artículo.' },
            { 'Columna': 'modelo', 'Obligatorio': 'NO', 'Descripción': 'Modelo del artículo.' },
            { 'Columna': 'color', 'Obligatorio': 'NO', 'Descripción': 'Color del artículo (Ej: Genérico, Negro, Gris).' },
            { 'Columna': 'unidadMedida', 'Obligatorio': 'SÍ', 'Descripción': 'Unidad, Metro, etc.' },
            { 'Columna': 'descripcion', 'Obligatorio': 'NO', 'Descripción': 'Detalle descriptivo.' },
            { 'Columna': 'tipo', 'Obligatorio': 'SÍ', 'Descripción': 'Debe ser "Activo" para existencias seriadas.' },
            { 'Columna': 'segmentacion', 'Obligatorio': 'SÍ', 'Descripción': 'Estándar o Crítico.' },
            { 'Columna': 'propiedad', 'Obligatorio': 'SÍ', 'Descripción': 'Propio o Cliente.' },
            { 'Columna': 'valorUnitario', 'Obligatorio': 'SÍ', 'Descripción': 'Valor monetario en CLP.' },
            { 'Columna': 'icono', 'Obligatorio': 'NO', 'Descripción': 'Archive, Tags, Package.' },
            { 'Columna': 'imagenUrl', 'Obligatorio': 'NO', 'Descripción': 'URL opcional de la foto.' }
        ];

        const opcionCategorias = (data.categorias || []).map(c => ({
            'Categoría Existente': c.nombre || '',
            'Descripción': c.descripcion || ''
        }));

        const opcionEstadosDetallados = [
            { 'Estados Físicos': 'Nuevo' },
            { 'Estados Físicos': 'Usado Reacondicionado' },
            { 'Estados Físicos': 'Para Reparar' },
            { 'Estados Físicos': 'Baja' }
        ];

        const opcionColores = COLOR_OPTIONS.map(c => ({ 'Colores Aceptados': c }));
        const opcionSegmento = [{ 'Segmentación': 'Estándar' }, { 'Segmentación': 'Crítico' }];
        const opcionPropiedad = [{ 'Propiedad': 'Propio' }, { 'Propiedad': 'Cliente' }];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsCategorias = XLSX.utils.json_to_sheet(opcionCategorias);
        const wsEstados = XLSX.utils.json_to_sheet(opcionEstadosDetallados);
        const wsColores = XLSX.utils.json_to_sheet(opcionColores);
        const wsSegmento = XLSX.utils.json_to_sheet(opcionSegmento);
        const wsPropiedad = XLSX.utils.json_to_sheet(opcionPropiedad);

        XLSX.utils.book_append_sheet(wb, ws, 'Seriados');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        XLSX.utils.book_append_sheet(wb, wsEstados, 'Estados Físicos');
        if (opcionCategorias.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsCategorias, 'Categorías Disponibles');
        }
        XLSX.utils.book_append_sheet(wb, wsColores, 'Colores Aceptados');
        XLSX.utils.book_append_sheet(wb, wsSegmento, 'Segmentaciones');
        XLSX.utils.book_append_sheet(wb, wsPropiedad, 'Propiedad');

        XLSX.writeFile(wb, 'Plantilla_Activos_Seriados_Logistica.xlsx');
    };

    const downloadCargosTemplate = () => {
        const templateData = [
            {
                cargo: 'Técnico Fusor',
                nombreTipoCargo: 'Fusor Fibra Óptica Planta Externa',
                productoSku: 'PRD-00001',
                cantidad: 2,
                estadoProducto: 'Nuevo'
            },
            {
                cargo: 'Técnico Fusor',
                nombreTipoCargo: 'Fusor Fibra Óptica Planta Externa',
                productoSku: 'PRD-00003',
                cantidad: 1,
                estadoProducto: 'Nuevo'
            },
            {
                cargo: 'Supervisor Terreno',
                nombreTipoCargo: 'Supervisor de Planta e Infraestructura',
                productoSku: 'PRD-00001',
                cantidad: 1,
                estadoProducto: 'Usado Bueno'
            }
        ];

        const instrucciones = [
            { 'Columna': 'cargo', 'Obligatorio': 'SÍ', 'Descripción': 'Nombre del rol base de la dotación (ej: Técnico Fusor).' },
            { 'Columna': 'nombreTipoCargo', 'Obligatorio': 'NO', 'Descripción': 'Especialización o nombre descriptivo del cargo (ej: Fusor Planta Externa).' },
            { 'Columna': 'productoSku', 'Obligatorio': 'SÍ', 'Descripción': 'SKU exacto del producto pre-asignado.' },
            { 'Columna': 'cantidad', 'Obligatorio': 'SÍ', 'Descripción': 'Cantidad requerida de este insumo para el cargo.' },
            { 'Columna': 'estadoProducto', 'Obligatorio': 'SÍ', 'Descripción': 'Nuevo, Usado Bueno, Usado Malo, Merma.' }
        ];

        const opcionProductos = (data.productos || []).map(p => ({
            'SKU': p.sku || '',
            'Nombre': p.nombre || '',
            'Categoría': p.categoria?.nombre || p.categoria || ''
        }));

        const opcionEstados = [
            { 'Estados Recomendados': 'Nuevo' },
            { 'Estados Recomendados': 'Usado Bueno' },
            { 'Estados Recomendados': 'Usado Malo' },
            { 'Estados Recomendados': 'Merma' }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);
        const wsProductos = XLSX.utils.json_to_sheet(opcionProductos);
        const wsEstados = XLSX.utils.json_to_sheet(opcionEstados);

        XLSX.utils.book_append_sheet(wb, ws, 'Cargos');
        XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');
        XLSX.utils.book_append_sheet(wb, wsEstados, 'Estados Aceptados');
        if (opcionProductos.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos Disponibles');
        }

        XLSX.writeFile(wb, 'Plantilla_Perfiles_Cargos_Logistica.xlsx');
    };

    const importAlmacenes = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const almacenes = rows
                .map(r => ({
                    nombre: String(r.nombre || '').trim(),
                    codigo: String(r.codigo || '').trim(),
                    tipo: String(r.tipo || 'Central').trim(),
                    direccion: String(r.direccion || '').trim(),
                    propiedad: String(r.propiedad || 'Propio').trim(),
                    tecnicoRut: String(r.tecnicoRut || r.rutResponsable || r.rut || '').trim(),
                    clienteRef: String(r.clienteRef || '').trim()
                }))
                .filter(r => r.nombre);

            if (almacenes.length === 0) {
                alert('No hay filas válidas para importar en bodegas.');
                return;
            }

            const res = await logisticaApi.post('/almacenes/bulk', { almacenes });
            alert(res.data?.message || 'Carga masiva bodegas completada.');
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de bodegas: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (almBulkInputRef.current) almBulkInputRef.current.value = '';
        }
    };

    const importPersonal = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const candidatos = rows
                .map(r => ({
                    rut: String(r.rut || '').trim(),
                    fullName: String(r.fullName || r.nombreCompleto || '').trim(),
                    email: String(r.email || '').trim(),
                    phone: String(r.phone || r.telefono || '').trim(),
                    position: String(r.position || r.cargo || '').trim(),
                    projectName: String(r.projectName || r.proyecto || '').trim(),
                    clienteNombre: String(r.clienteNombre || r.cliente || '').trim(),
                    ceco: String(r.ceco || '').trim(),
                    area: String(r.area || '').trim(),
                    departamento: String(r.departamento || '').trim(),
                    sede: String(r.sede || '').trim(),
                    idRecursoToa: String(r.idRecursoToa || '').trim(),
                    status: String(r.status || 'Contratado').trim(),
                    contractType: String(r.contractType || 'PLAZO FIJO').trim(),
                    contractStartDate: String(r.contractStartDate || '').trim(),
                    contractEndDate: String(r.contractEndDate || '').trim(),
                    previsionSalud: String(r.previsionSalud || 'FONASA').trim(),
                    isapreNombre: String(r.isapreNombre || '').trim(),
                    valorPlan: String(r.valorPlan || '').trim(),
                    monedaPlan: String(r.monedaPlan || 'UF').trim(),
                    afp: String(r.afp || '').trim(),
                    banco: String(r.banco || '').trim(),
                    tipoCuenta: String(r.tipoCuenta || '').trim(),
                    numeroCuenta: String(r.numeroCuenta || '').trim(),
                    sueldoBase: Number(r.sueldoBase || 0),
                    requiereLicencia: String(r.requiereLicencia || 'NO').trim(),
                    fechaVencimientoLicencia: String(r.fechaVencimientoLicencia || '').trim(),
                    shirtSize: String(r.shirtSize || '').trim(),
                    pantsSize: String(r.pantsSize || '').trim(),
                    jacketSize: String(r.jacketSize || '').trim(),
                    shoeSize: String(r.shoeSize || '').trim()
                }))
                .filter(r => r.rut && r.fullName && r.position);

            if (candidatos.length === 0) {
                alert('No hay colaboradores válidos para importar. Asegúrate de incluir RUT, Nombre Completo y Cargo.');
                return;
            }

            const storedUser = localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user');
            let token = '';
            if (storedUser) {
                try {
                    token = JSON.parse(storedUser).token;
                } catch (err) {}
            }
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            const storedContext = sessionStorage.getItem('platform_audit_context');
            if (storedContext) {
                try {
                    const auditData = JSON.parse(storedContext);
                    if (auditData._id) {
                        headers['x-company-override'] = auditData._id;
                    }
                } catch (err) {}
            }

            const res = await axios.post(`${API_URL}/api/rrhh/candidatos/bulk`, { candidatos }, { headers });
            
            const stats = res.data?.stats || {};
            alert(`Carga masiva de personal completada.\nCreados: ${stats.creados || 0}\nActualizados: ${stats.actualizados || 0}\nErrores: ${stats.errores || 0}`);
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de personal: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (personalBulkInputRef.current) personalBulkInputRef.current.value = '';
        }
    };

    const importSeriados = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const productos = rows
                .map(r => {
                    const rowNombre = String(r.nombre || '').trim();
                    const rowCategoria = String(r.categoria || '').trim();
                    const rowMarca = String(r.marca || '').trim();
                    const rowModelo = String(r.modelo || '').trim();
                    const rowTipo = String(r.tipo || 'Activo').trim();
                    const rowSegmento = String(r.segmentacion || 'Estándar').trim();
                    const rowDesc = String(r.descripcion || '').trim();

                    const finalDesc = rowDesc || generateIntelligentDescription({
                        nombre: rowNombre,
                        categoria: rowCategoria,
                        marca: rowMarca,
                        modelo: rowModelo,
                        tipo: rowTipo,
                        segmentacion: rowSegmento
                    });

                    return {
                        nombre: rowNombre,
                        sku: String(r.sku || '').trim(),
                        ean: String(r.ean || '').trim(),
                        categoria: rowCategoria,
                        marca: rowMarca,
                        modelo: rowModelo,
                        nroSerie: String(r.nroSerie || r.numeroSerie || '').trim(),
                        imei: String(r.imei || '').trim(),
                        estadoDetallado: String(r.estadoDetallado || 'Nuevo').trim(),
                        color: String(r.color || 'Genérico').trim(),
                        unidadMedida: String(r.unidadMedida || 'Unidad').trim(),
                        descripcion: finalDesc,
                        tipo: 'Activo',
                        trackSerial: true,
                        segmentacion: rowSegmento,
                        propiedad: String(r.propiedad || 'Propio').trim(),
                        valorUnitario: Number(r.valorUnitario || 0),
                        icono: String(r.icono || 'Archive').trim(),
                        imagenUrl: String(r.imagenUrl || '').trim()
                    };
                })
                .filter(r => r.nombre && r.nroSerie);

            if (productos.length === 0) {
                alert('No hay filas válidas para importar en existencias seriadas. Asegúrate de incluir el Nombre y Número de Serie.');
                return;
            }

            const res = await logisticaApi.post('/productos/bulk', { productos });
            alert(res.data?.message || 'Carga masiva existencias seriadas completada.');
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de existencias seriadas: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (seriadosBulkInputRef.current) seriadosBulkInputRef.current.value = '';
        }
    };

    const importCargos = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setBulkLoading(true);
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            const cargos = rows
                .map(r => ({
                    cargo: String(r.cargo || '').trim(),
                    nombreTipoCargo: String(r.nombreTipoCargo || r.nombreEspecialidad || r.cargo || '').trim(),
                    productoSku: String(r.productoSku || r.sku || '').trim(),
                    cantidad: Number(r.cantidad || 1),
                    estadoProducto: String(r.estadoProducto || r.estado || 'Nuevo').trim()
                }))
                .filter(r => r.cargo && r.productoSku);

            if (cargos.length === 0) {
                alert('No hay perfiles de cargos válidos para importar. Asegúrate de incluir el Cargo y el SKU del Producto.');
                return;
            }

            const res = await logisticaApi.post('/cargo-equipamiento/bulk', { cargos });
            
            const errs = res.data?.errores || [];
            if (errs.length > 0) {
                const limit = errs.slice(0, 5).map(e => `Fila ${e.fila}: ${e.error}`).join('\n');
                alert(`Carga masiva de cargos completada con algunos errores:\nCreados: ${res.data.creados || 0}\nActualizados: ${res.data.actualizados || 0}\nErrores: ${errs.length}\n\nMuestra de errores:\n${limit}`);
            } else {
                alert(res.data?.message || 'Carga masiva de perfiles de cargos completada con éxito.');
            }
            fetchMasterData();
        } catch (err) {
            alert('Error en carga masiva de perfiles de cargos: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
            if (cargosBulkInputRef.current) cargosBulkInputRef.current.value = '';
        }
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
                .map(r => {
                    const rowNombre = String(r.nombre || '').trim();
                    const rowCategoria = String(r.categoria || '').trim();
                    const rowMarca = String(r.marca || '').trim();
                    const rowModelo = String(r.modelo || '').trim();
                    const rowTipo = String(r.tipo || 'Activo').trim();
                    const rowSegmento = String(r.segmentacion || 'Estándar').trim();
                    const rowDesc = String(r.descripcion || '').trim();

                    const finalDesc = rowDesc || generateIntelligentDescription({
                        nombre: rowNombre,
                        categoria: rowCategoria,
                        marca: rowMarca,
                        modelo: rowModelo,
                        tipo: rowTipo,
                        segmentacion: rowSegmento
                    });

                    return {
                        nombre: rowNombre,
                        sku: String(r.sku || '').trim(),
                        ean: String(r.ean || '').trim(),
                        categoria: rowCategoria,
                        marca: rowMarca,
                        modelo: rowModelo,
                        color: String(r.color || 'Genérico').trim(),
                        unidadMedida: String(r.unidadMedida || 'Unidad').trim(),
                        descripcion: finalDesc,
                        tipo: rowTipo,
                        segmentacion: rowSegmento,
                        propiedad: String(r.propiedad || 'Propio').trim(),
                        valorUnitario: Number(r.valorUnitario || 0),
                        icono: String(r.icono || 'Archive').trim(),
                        imagenUrl: String(r.imagenUrl || '').trim()
                    };
                })
                .filter(r => r.nombre);

            if (productos.length === 0) {
                alert('No hay filas válidas para importar en productos.');
                return;
            }

            const queue = [];
            productos.forEach((p, idx) => {
                // Si el SKU ya existe en el sistema, es una actualización directa (se omite del mitigador de similitudes de nombre)
                const hasExactSkuMatch = p.sku && (data.productos || []).some(existing => String(existing.sku || '').trim().toUpperCase() === String(p.sku).trim().toUpperCase());
                if (hasExactSkuMatch) {
                    return;
                }

                // Monitoreo de similitud de nombre
                const match = (data.productos || []).find(existing => stringSimilarity(existing.nombre, p.nombre) >= 0.70);
                if (match) {
                    queue.push({
                        index: idx,
                        uploadedItem: p,
                        similarTo: match,
                        resolution: null // 'unify', 'keep', 'discard'
                    });
                }
            });

            if (queue.length > 0) {
                setPendingUploadList(productos);
                setDuplicateResolutionQueue(queue);
                setShowResolutionModal(true);
                setBulkLoading(false);
                if (prodBulkInputRef.current) prodBulkInputRef.current.value = '';
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

    const handleAutocompleteDescriptions = async () => {
        const productsToUpdate = (data.productos || []).filter(p => !p.descripcion || p.descripcion.trim() === '');
        if (productsToUpdate.length === 0) {
            alert('¡Excelente! Todas las existencias registradas ya cuentan con descripciones inteligentes completadas.');
            return;
        }

        try {
            setAiProgress(true);
            
            await Promise.all(productsToUpdate.map(async (p) => {
                const generated = generateIntelligentDescription({
                    nombre: p.nombre,
                    categoria: p.categoria?.nombre || p.categoria || '',
                    marca: p.marca,
                    modelo: p.modelo,
                    tipo: p.tipo,
                    segmentacion: p.segmentacion
                });

                const payload = {
                    ...p,
                    categoria: p.categoria?._id || p.categoria,
                    descripcion: generated
                };

                return logisticaApi.put(`/productos/${p._id}`, payload);
            }));

            alert(`✨ ¡Éxito! Se generaron y completaron descripciones inteligentes para ${productsToUpdate.length} existencias de forma masiva.`);
            setShowAiModal(false);
            fetchMasterData();
        } catch (error) {
            alert('Error en autocompletado masivo: ' + (error.response?.data?.message || error.message));
        } finally {
            setAiProgress(false);
        }
    };

    const handleResolveDuplicatesSubmit = async () => {
        try {
            setBulkLoading(true);
            const unresolvedCount = duplicateResolutionQueue.filter(item => !item.resolution).length;
            if (unresolvedCount > 0) {
                alert(`Por favor resuelve todas las similitudes de productos antes de proceder (${unresolvedCount} pendientes).`);
                return;
            }

            const finalProductos = [];
            pendingUploadList.forEach((p, idx) => {
                const resolutionItem = duplicateResolutionQueue.find(item => item.index === idx);
                if (resolutionItem) {
                    if (resolutionItem.resolution === 'discard') {
                        return; // Omitido por completo
                    }
                    if (resolutionItem.resolution === 'unify') {
                        // Asignamos el SKU del producto existente similar para que el backend lo actualice automáticamente
                        p.sku = resolutionItem.similarTo.sku;
                        finalProductos.push(p);
                        return;
                    }
                }
                // Si es un producto limpio o fue marcado para 'Mantener' (se crea como nuevo registro)
                finalProductos.push(p);
            });

            if (finalProductos.length > 0) {
                const res = await logisticaApi.post('/productos/bulk', { productos: finalProductos });
                alert(res.data?.message || 'Carga masiva productos completada.');
            } else {
                alert('No se crearon ni actualizaron nuevos registros.');
            }

            setShowResolutionModal(false);
            setPendingUploadList([]);
            setDuplicateResolutionQueue([]);
            fetchMasterData();
        } catch (err) {
            alert('Error al aplicar resoluciones e importar: ' + (err.response?.data?.message || err.message));
        } finally {
            setBulkLoading(false);
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
                : activeTab === 'cargos'
                ? (editingCargoId ? `/cargo-equipamiento/${editingCargoId}` : '/cargo-equipamiento')
                : (editingProductoId ? `/productos/${editingProductoId}` : '/productos');
            const method = activeTab === 'bodegas' && editingAlmacenId
                ? 'put'
                : activeTab === 'categorias' && editingCategoriaId
                ? 'put'
                : activeTab === 'cargos' && editingCargoId
                ? 'put'
                : (activeTab === 'productos' || activeTab === 'seriados') && editingProductoId
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
                : activeTab === 'cargos'
                ? {
                    ...cargoForm
                }
                : {
                    ...prodForm,
                    trackSerial: activeTab === 'seriados' ? true : prodForm.trackSerial,
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
    const productosFiltrados = (data.productos || []).filter(p => {
        const textMatch = `${p.nombre || ''} ${p.sku || ''} ${p.marca || ''} ${p.modelo || ''} ${p.nroSerie || ''} ${p.imei || ''}`.toLowerCase().includes(searchProducto.toLowerCase());
        const catId = p.categoria?._id || p.categoria;
        const categoriaMatch = !filterProdCategoria || String(catId) === String(filterProdCategoria);
        const tipoMatch = !filterProdTipo || p.tipo === filterProdTipo;
        const segmentacionMatch = !filterProdSegmentacion || p.segmentacion === filterProdSegmentacion;
        const propiedadMatch = !filterProdPropiedad || p.propiedad === filterProdPropiedad;
        
        let tabMatch = true;
        if (selectedProdCategoryTab !== 'TODOS') {
            const catName = p.categoria?.nombre || p.categoria || 'Otros';
            tabMatch = catName === selectedProdCategoryTab;
        }
        
        const isSeriada = !!(p.nroSerie || p.trackSerial);
        const serialMatch = activeTab === 'seriados' ? isSeriada : !isSeriada;
        
        return textMatch && categoriaMatch && tipoMatch && segmentacionMatch && propiedadMatch && tabMatch && serialMatch;
    });
    const cargosFiltrados = (data.cargoEquipamientos || []).filter(c => {
        const textMatch = `${c.cargo || ''} ${c.nombreTipoCargo || ''}`.toLowerCase().includes(searchCargo.toLowerCase());
        const estadoMatch = !filterCargoEstado || (c.status || 'Activo') === filterCargoEstado;
        const cargoBaseMatch = !filterCargoBase || c.cargo === filterCargoBase;
        const categoriaMatch = !filterCargoCategoria || (c.items || []).some(item => {
            const prodId = typeof item.productoRef === 'object' ? item.productoRef?._id : item.productoRef;
            const prod = (data.productos || []).find(p => p._id === prodId) || (typeof item.productoRef === 'object' ? item.productoRef : {}) || {};
            const catId = prod.categoria?._id || prod.categoria;
            return String(catId) === String(filterCargoCategoria);
        });
        return textMatch && estadoMatch && cargoBaseMatch && categoriaMatch;
    });
    const uniqueCargos = Array.from(new Set((data.tecnicos || []).map(t => t.cargo).filter(Boolean)));
    const personalFiltrado = (data.tecnicos || []).filter(t => {
        const textMatch = `${t.nombreCompleto || ''} ${t.rut || ''} ${t.cargo || ''} ${t.proyecto || ''} ${t.cliente || ''} ${t.idRecursoToa || ''}`.toLowerCase().includes(searchPersonal.toLowerCase());
        const proyectoMatch = !filterPersonalProyecto || String(t.proyecto || '').toLowerCase() === filterPersonalProyecto.toLowerCase();
        const clienteMatch = !filterPersonalCliente || String(t.cliente || '').toLowerCase() === filterPersonalCliente.toLowerCase();
        const estadoMatch = !filterPersonalEstado || getAbbreviatedStatus(t.estadoActual).toLowerCase() === filterPersonalEstado.toLowerCase();
        let toaMatch = true;
        if (filterPersonalToa === 'with_toa') {
            toaMatch = !!t.idRecursoToa;
        } else if (filterPersonalToa === 'without_toa') {
            toaMatch = !t.idRecursoToa;
        }
        return textMatch && proyectoMatch && clienteMatch && estadoMatch && toaMatch;
    });

    const uniquePersonalProyectos = Array.from(new Set((data.tecnicos || []).map(t => t.proyecto).filter(Boolean))).sort();
    const uniquePersonalClientes = Array.from(new Set((data.tecnicos || []).map(t => t.cliente).filter(Boolean))).sort();
    const uniquePersonalEstados = Array.from(new Set((data.tecnicos || []).map(t => getAbbreviatedStatus(t.estadoActual)).filter(Boolean))).sort();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-900 text-white rounded-[2rem] shadow-2xl shadow-slate-200">
                        <Settings size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Centro de Configuración Logística</h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Ecosistema 360 / Bodegas, Personal, Categorías y Existencias</p>
                    </div>
                </div>
                {activeTab !== 'personal' && (
                    <button 
                        onClick={() => setShowModal(true)}
                        className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3"
                    >
                        <Plus size={18} /> Crear {activeTab === 'bodegas' ? 'Bodega' : activeTab === 'categorias' ? 'Categoría' : activeTab === 'cargos' ? 'Equipamiento' : activeTab === 'seriados' ? 'Existencia Seriada' : 'Existencia'}
                    </button>
                )}
            </header>

            {/* TABS */}
            <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[2rem] w-fit">
                {['bodegas', 'personal', 'categorias', 'productos', 'seriados', 'cargos'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {tab === 'bodegas' ? 'Bodegas y Almacenes' : tab === 'personal' ? 'Personal Trabajador' : tab === 'categorias' ? 'Categorías' : tab === 'productos' ? 'Existencia General' : tab === 'seriados' ? 'Existencias Seriadas' : 'Cargo Predeterminado'}
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
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={downloadAlmacenTemplate} 
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <Download size={14} /> Descargar Plantilla
                                </button>
                                <button 
                                    type="button" 
                                    disabled={bulkLoading} 
                                    onClick={() => almBulkInputRef.current?.click()} 
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                </button>
                                <input ref={almBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importAlmacenes} />
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
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button" 
                                    onClick={downloadCategoriaTemplate} 
                                    className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                >
                                    <Download size={14} /> Descargar Plantilla
                                </button>
                                <button 
                                    type="button" 
                                    disabled={bulkLoading} 
                                    onClick={() => catBulkInputRef.current?.click()} 
                                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                >
                                    <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                </button>
                                <input ref={catBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importCategorias} />
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
                        </div>
                    )}

                    {(activeTab === 'productos' || activeTab === 'seriados') && (
                        <div className="space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={searchProducto}
                                            onChange={e => setSearchProducto(e.target.value)}
                                            placeholder={activeTab === 'seriados' ? "Buscar existencia seriada..." : "Buscar existencia..."}
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
                                    {activeTab === 'productos' ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <>
                                            <button 
                                                type="button" 
                                                onClick={downloadSeriadosTemplate} 
                                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                            >
                                                <Download size={14} /> Descargar Plantilla
                                            </button>
                                            <button 
                                                type="button" 
                                                disabled={bulkLoading} 
                                                onClick={() => seriadosBulkInputRef.current?.click()} 
                                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                            >
                                                <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                            </button>
                                            <input ref={seriadosBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importSeriados} />
                                        </>
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAiModal(true)}
                                        className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-violet-100 hover:-translate-y-0.5 transition-all"
                                    >
                                        <Sparkles size={14} className="animate-pulse" /> Autocompletar IA
                                    </button>
                                </div>
                            </div>

                            {/* Categorías como Tarjetas / Pestañas en Existencia (Compacto y Premium) */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-2 mb-4">
                                <div 
                                    onClick={() => setActiveProdCategoryDetail({ _id: 'all', nombre: activeTab === 'seriados' ? 'Todas las Existencias Seriadas' : 'Todas las Existencias' })}
                                    className="p-3 bg-white hover:bg-indigo-50/20 border border-slate-100 hover:border-indigo-100 rounded-2xl shadow-sm transition-all cursor-pointer flex items-center gap-3 group"
                                >
                                    <div className="p-2 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <Package size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider truncate">Todas</h4>
                                        <p className="text-[8px] font-bold text-slate-400">
                                            {
                                                (data.productos || []).filter(p => {
                                                    const isSer = !!(p.nroSerie || p.trackSerial);
                                                    return activeTab === 'seriados' ? isSer : !isSer;
                                                }).length
                                            } Existencias
                                        </p>
                                    </div>
                                </div>

                                {(data.categorias || []).filter(cat => {
                                    if (activeTab !== 'seriados') return true;
                                    const count = (data.productos || []).filter(p => {
                                        const isSer = !!(p.nroSerie || p.trackSerial);
                                        const catId = p.categoria?._id || p.categoria;
                                        return isSer && String(catId) === String(cat._id);
                                    }).length;
                                    return count > 0;
                                }).map(cat => {
                                    const count = (data.productos || []).filter(p => {
                                        const isSer = !!(p.nroSerie || p.trackSerial);
                                        const tabMatch = activeTab === 'seriados' ? isSer : !isSer;
                                        const catId = p.categoria?._id || p.categoria;
                                        return tabMatch && String(catId) === String(cat._id);
                                    }).length;
                                    
                                    let IconComponent = Wrench;
                                    const lowerCat = (cat.nombre || '').toLowerCase();
                                    if (lowerCat.includes('epp') || lowerCat.includes('seguridad') || lowerCat.includes('protección') || lowerCat.includes('casco') || lowerCat.includes('chaleco')) IconComponent = Shield;
                                    else if (lowerCat.includes('equipo') || lowerCat.includes('tecnología') || lowerCat.includes('cámara') || lowerCat.includes('fusión') || lowerCat.includes('router') || lowerCat.includes('ont')) IconComponent = Cpu;
                                    else if (lowerCat.includes('cable') || lowerCat.includes('fibra') || lowerCat.includes('insumo') || lowerCat.includes('conector') || lowerCat.includes('ferretería')) IconComponent = Layers;
                                    else if (lowerCat.includes('herramienta') || lowerCat.includes('taladro') || lowerCat.includes('destornillador')) IconComponent = Hammer;
                                    else if (lowerCat.includes('instrumento') || lowerCat.includes('medidor') || lowerCat.includes('tester') || lowerCat.includes('otdr') || lowerCat.includes('power')) IconComponent = Gauge;

                                    return (
                                        <div 
                                            key={cat._id}
                                            onClick={() => setActiveProdCategoryDetail(cat)}
                                            className="p-3 bg-white hover:bg-indigo-50/20 border border-slate-100 hover:border-indigo-100 rounded-2xl shadow-sm transition-all cursor-pointer flex items-center gap-3 group"
                                        >
                                            <div className="p-2 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <IconComponent size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider truncate">{cat.nombre}</h4>
                                                <p className="text-[8px] font-bold text-slate-400">{count} Artículos</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Barra de Filtros Dinámicos de Existencias */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
                                {/* Filtro Categoría */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Categoría</label>
                                    <select
                                        value={filterProdCategoria}
                                        onChange={e => setFilterProdCategoria(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todas las Categorías</option>
                                        {(data.categorias || []).filter(cat => {
                                            if (activeTab !== 'seriados') return true;
                                            const count = (data.productos || []).filter(p => {
                                                const isSer = !!(p.nroSerie || p.trackSerial);
                                                const catId = p.categoria?._id || p.categoria;
                                                return isSer && String(catId) === String(cat._id);
                                            }).length;
                                            return count > 0;
                                        }).map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro Tipo */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Tipo</label>
                                    <select
                                        value={filterProdTipo}
                                        onChange={e => setFilterProdTipo(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todos los Tipos</option>
                                        <option value="Activo">Activo</option>
                                        <option value="Suministro">Suministro</option>
                                    </select>
                                </div>

                                {/* Filtro Segmentación */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Segmentación</label>
                                    <select
                                        value={filterProdSegmentacion}
                                        onChange={e => setFilterProdSegmentacion(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todas las Segmentaciones</option>
                                        <option value="Estándar">Estándar</option>
                                        <option value="Crítico">Crítico</option>
                                        <option value="Consumo">Consumo</option>
                                    </select>
                                </div>

                                {/* Filtro Propiedad */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Propiedad</label>
                                    <select
                                        value={filterProdPropiedad}
                                        onChange={e => setFilterProdPropiedad(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todas las Propiedades</option>
                                        <option value="Propio">Propio</option>
                                        <option value="Cliente">Cliente</option>
                                    </select>
                                </div>

                                {/* Limpiar Filtros */}
                                {(filterProdCategoria || filterProdTipo || filterProdSegmentacion || filterProdPropiedad || searchProducto) ? (
                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterProdCategoria('');
                                                setFilterProdTipo('');
                                                setFilterProdSegmentacion('');
                                                setFilterProdPropiedad('');
                                                setSearchProducto('');
                                            }}
                                            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-rose-100/30 flex items-center justify-center gap-1.5 shadow-sm"
                                        >
                                            Limpiar Filtros
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-end justify-center text-[10px] text-slate-400 font-extrabold uppercase tracking-widest px-3 py-2 bg-white rounded-xl border border-slate-200/50 shadow-sm">
                                        Filtrados: <span className="text-slate-800 font-extrabold ml-1">{productosFiltrados.length}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'personal' && (
                        <div className="space-y-4">
                            {/* Barra Superior con Búsqueda y Vistas */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={searchPersonal}
                                            onChange={e => setSearchPersonal(e.target.value)}
                                            placeholder="Buscar por RUT, nombre, cargo..."
                                            className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold w-64 shadow-sm focus:outline-none focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                        <button 
                                            type="button" 
                                            onClick={() => setPersonalView('grid')} 
                                            className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${personalView === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                            title="Vista Cuadrícula"
                                        >
                                            <Grid3X3 size={14} />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setPersonalView('list')} 
                                            className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${personalView === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                            title="Vista Lista"
                                        >
                                            <List size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button" 
                                        onClick={downloadPersonalTemplate} 
                                        className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                    >
                                        <Download size={14} /> Descargar Plantilla
                                    </button>
                                    <button 
                                        type="button" 
                                        disabled={bulkLoading} 
                                        onClick={() => personalBulkInputRef.current?.click()} 
                                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                    </button>
                                    <input ref={personalBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importPersonal} />

                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                                        Colaboradores Filtrados: <span className="text-slate-800 font-extrabold">{personalFiltrado.length}</span> / {data.tecnicos?.length || 0}
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Filtros Dinámicos */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                {/* Filtro Proyecto */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Proyecto</label>
                                    <select
                                        value={filterPersonalProyecto}
                                        onChange={e => setFilterPersonalProyecto(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todos los Proyectos</option>
                                        {uniquePersonalProyectos.map(p => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro Cliente */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Mandante / Cliente</label>
                                    <select
                                        value={filterPersonalCliente}
                                        onChange={e => setFilterPersonalCliente(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todos los Clientes</option>
                                        {uniquePersonalClientes.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro Estado */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Estado Talento</label>
                                    <select
                                        value={filterPersonalEstado}
                                        onChange={e => setFilterPersonalEstado(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Todos los Estados</option>
                                        {uniquePersonalEstados.map(est => (
                                            <option key={est} value={est}>{est}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Filtro TOA */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Integración TOA</label>
                                    <select
                                        value={filterPersonalToa}
                                        onChange={e => setFilterPersonalToa(e.target.value)}
                                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                    >
                                        <option value="all">Cualquiera</option>
                                        <option value="with_toa">Con ID TOA</option>
                                        <option value="without_toa">Sin ID TOA</option>
                                    </select>
                                </div>

                                {/* Limpiar Filtros */}
                                {(filterPersonalProyecto || filterPersonalCliente || filterPersonalEstado || filterPersonalToa !== 'all' || searchPersonal) && (
                                    <div className="flex items-end col-span-2 md:col-span-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilterPersonalProyecto('');
                                                setFilterPersonalCliente('');
                                                setFilterPersonalEstado('');
                                                setFilterPersonalToa('all');
                                                setSearchPersonal('');
                                            }}
                                            className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-rose-100/30 flex items-center justify-center gap-1.5"
                                        >
                                            Limpiar Filtros
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'bodegas' && almacenView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 w-16">Item</th>
                                        <th className="px-4 py-3 w-32">ID TOA</th>
                                        <th className="px-4 py-3">Bodega/Vehículo</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Responsable</th>
                                        <th className="px-4 py-3">Propiedad</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {almacenesFiltrados.map((alm, index) => (
                                        <tr key={alm._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-black text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {alm.tecnicoRef?.idRecursoToa ? (
                                                    <span className="text-violet-600 font-extrabold flex items-center gap-1 bg-violet-50/50 border border-violet-100/50 px-2 py-0.5 rounded-lg w-fit text-[9px] uppercase tracking-wider">
                                                        ⚡ {alm.tecnicoRef.idRecursoToa}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold italic text-[9px]">Sin TOA ID</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">
                                                <Warehouse size={14} className="text-slate-400" /> {alm.nombre}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{alm.codigo || 'S/C'}</td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{alm.tipo}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <div className="font-extrabold text-slate-700">
                                                    {alm.tecnicoRef ? `${alm.tecnicoRef.nombres} ${alm.tecnicoRef.apellidos}` : 'No Asignado'}
                                                </div>
                                                {alm.tecnicoRef && (
                                                    <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5 tracking-wider">
                                                        {alm.tecnicoRef.cargo || 'Colaborador'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                    alm.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                    {alm.propiedad === 'Propio' ? 'Empresa' : alm.clienteRef?.nombre || 'Cliente'}
                                                </span>
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
                                        <th className="px-4 py-3 w-16">Item</th>
                                        <th className="px-4 py-3 w-32">ID</th>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Rotación</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categoriasFiltradas.map((cat, index) => (
                                        <tr key={cat._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-black text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-3 text-[10px] font-mono text-slate-400 select-all">{cat._id}</td>
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
                                        <th className="px-4 py-3 w-16">Item</th>
                                        <th className="px-4 py-3">Existencia</th>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3">SKU</th>
                                        <th className="px-4 py-3">Marca</th>
                                        <th className="px-4 py-3">Modelo</th>
                                        <th className="px-4 py-3">Color</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Propiedad</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map((prod, index) => (
                                        <tr key={prod._id} className="border-t border-slate-50">
                                            <td className="px-4 py-3 text-xs font-black text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">{getVisualIcon(prod.icono || 'Archive', 14)} {prod.nombre}</td>
                                            <td className="px-4 py-3 text-xs">
                                                {prod.categoria ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-wide">
                                                        {getVisualIcon(prod.categoria.icono || 'Tags', 12)}
                                                        {prod.categoria.nombre}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold italic text-[10px]">Sin Categoría</span>
                                                )}
                                            </td>
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
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                    prod.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                    {prod.propiedad === 'Propio' ? 'Empresa' : prod.clienteRef?.nombre || 'Cliente'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">${Number(prod.valorUnitario || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${prod.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {prod.status || 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleDerivarASeriado(prod)} 
                                                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all font-bold flex items-center justify-center" 
                                                        title="Derivar a Existencia Seriada (Crear copia con serie)"
                                                    >
                                                        <Boxes size={14} />
                                                    </button>
                                                    <button type="button" onClick={() => handleToggleStatus('producto', prod)} className={`p-2 rounded-lg ${prod.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={prod.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
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

                    {activeTab === 'seriados' && productoView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                                    <tr>
                                        <th className="px-4 py-3 w-16">Item</th>
                                        <th className="px-4 py-3">Existencia Seriada</th>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3">Marca / Modelo</th>
                                        <th className="px-4 py-3">Nº de Serie</th>
                                        <th className="px-4 py-3">IMEI</th>
                                        <th className="px-4 py-3">Color</th>
                                        <th className="px-4 py-3">Estado Físico</th>
                                        <th className="px-4 py-3">Propiedad</th>
                                        <th className="px-4 py-3">Valor</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosFiltrados.map((prod, index) => (
                                        <tr key={prod._id} className="border-t border-slate-50 hover:bg-slate-50/40 transition-colors">
                                            <td className="px-4 py-3 text-xs font-black text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-3 text-xs flex flex-col gap-0.5 justify-center">
                                                <span className="font-bold text-slate-700 flex items-center gap-2">
                                                    {getVisualIcon(prod.icono || 'Archive', 14)} {prod.nombre}
                                                </span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleIrAPlantillaBase(prod.nombre)}
                                                    className="w-fit text-[9px] font-black text-indigo-500 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-wider transition-all"
                                                    title="Ir a la Existencia General Base"
                                                >
                                                    <GitFork size={10} /> Ver Base General
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {prod.categoria ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-wide">
                                                        {getVisualIcon(prod.categoria.icono || 'Tags', 12)}
                                                        {prod.categoria.nombre}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold italic text-[10px]">Sin Categoría</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 font-bold">
                                                {prod.marca || '-'} / <span className="text-slate-400 font-normal">{prod.modelo || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                                                    {prod.nroSerie || 'S/N'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {prod.imei ? (
                                                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold">
                                                        {prod.imei}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 font-bold text-[10px]">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorHex(prod.color), display: 'inline-block' }} />
                                                    <span className="font-bold text-slate-600">{prod.color || 'Genérico'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                    prod.estadoDetallado === 'Nuevo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    prod.estadoDetallado === 'Usado Reacondicionado' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                                    prod.estadoDetallado === 'Para Reparar' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                    'bg-rose-50 text-rose-600 border border-rose-100'
                                                }`}>
                                                    {prod.estadoDetallado || 'Nuevo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                                    prod.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                                }`}>
                                                    {prod.propiedad === 'Propio' ? 'Empresa' : prod.clienteRef?.nombre || 'Cliente'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-black text-slate-600">${Number(prod.valorUnitario || 0).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${prod.status === 'Inactivo' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                    {prod.status || 'Activo'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button type="button" onClick={() => handleToggleStatus('producto', prod)} className={`p-2 rounded-lg ${prod.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={prod.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
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

                    {activeTab === 'cargos' && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                            {/* Search and Filters Bar */}
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4 shadow-sm">
                                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                                    <div className="relative flex-1">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input 
                                            type="text" 
                                            value={searchCargo} 
                                            onChange={e => setSearchCargo(e.target.value)} 
                                            placeholder="Buscar por cargo predeterminado o especialización..." 
                                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-indigo-500/25 transition-all placeholder:text-slate-400"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={downloadCargosTemplate} 
                                            className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                                        >
                                            <Download size={14} /> Descargar Plantilla
                                        </button>
                                        <button 
                                            type="button" 
                                            disabled={bulkLoading} 
                                            onClick={() => cargosBulkInputRef.current?.click()} 
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                                        >
                                            <Upload size={14} /> {bulkLoading ? 'Cargando...' : 'Carga Masiva (Excel)'}
                                        </button>
                                        <input ref={cargosBulkInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importCargos} />

                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100/50 flex items-center justify-center">
                                            Total Cargos: <span className="text-indigo-600 font-extrabold ml-1.5">{cargosFiltrados.length}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-50">
                                    {/* Categoría Insumo */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Tiene Insumo de Categoría</label>
                                        <select
                                            value={filterCargoCategoria}
                                            onChange={e => setFilterCargoCategoria(e.target.value)}
                                            className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                        >
                                            <option value="">Cualquier Categoría</option>
                                            {(data.categorias || []).map(cat => (
                                                <option key={cat._id} value={cat._id}>{cat.nombre}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Cargo Base */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Rol Base Asignado</label>
                                        <select
                                            value={filterCargoBase}
                                            onChange={e => setFilterCargoBase(e.target.value)}
                                            className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                        >
                                            <option value="">Cualquier Rol Base</option>
                                            {uniqueCargos.map(cBase => (
                                                <option key={cBase} value={cBase}>{cBase}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Estado */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Estado de Ficha</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={filterCargoEstado}
                                                onChange={e => setFilterCargoEstado(e.target.value)}
                                                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                            >
                                                <option value="">Cualquier Estado</option>
                                                <option value="Activo">Activo</option>
                                                <option value="Inactivo">Inactivo</option>
                                            </select>

                                            {(filterCargoCategoria || filterCargoBase || filterCargoEstado || searchCargo) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFilterCargoCategoria('');
                                                        setFilterCargoBase('');
                                                        setFilterCargoEstado('');
                                                        setSearchCargo('');
                                                    }}
                                                    className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[10px] font-black uppercase border border-rose-100/30 transition-all"
                                                    title="Limpiar Filtros"
                                                >
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cargo Cards Stack */}
                            <div className="grid grid-cols-1 gap-4">
                                {cargosFiltrados.length === 0 ? (
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-16 text-center shadow-sm">
                                        <Briefcase className="mx-auto text-slate-300 mb-4 animate-pulse" size={40} />
                                        <h3 className="text-sm font-black text-slate-700 tracking-tight">Sin Fichas de Cargo</h3>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">No se encontraron predeterminados para la búsqueda o aún no has creado equipamiento para este cargo.</p>
                                    </div>
                                ) : (
                                    cargosFiltrados.map((cargoEquip, index) => {
                                        const isExpanded = !!expandedCargos[cargoEquip._id];
                                        const totalItems = cargoEquip.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0;
                                        const uniqueCount = cargoEquip.items?.length || 0;

                                        return (
                                            <div 
                                                key={cargoEquip._id}
                                                className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md ${
                                                    isExpanded ? 'border-indigo-100 ring-2 ring-indigo-50/50' : 'border-slate-100'
                                                }`}
                                            >
                                                {/* Card Header (Clickable to toggle expansion) */}
                                                <div 
                                                    onClick={() => setExpandedCargos({
                                                        ...expandedCargos,
                                                        [cargoEquip._id]: !isExpanded
                                                    })}
                                                    className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/30 transition-all"
                                                >
                                                    <div className="flex items-center gap-4 flex-1">
                                                        {/* Brand-Styled Icon Container */}
                                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                                                            isExpanded 
                                                                ? 'bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-indigo-100' 
                                                                : 'bg-slate-50 text-indigo-500 shadow-slate-100 border border-slate-100'
                                                        }`}>
                                                            <Briefcase size={22} className={isExpanded ? 'animate-bounce' : ''} />
                                                        </div>

                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="text-sm font-black text-slate-800 tracking-tight uppercase">
                                                                    {cargoEquip.nombreTipoCargo || cargoEquip.cargo}
                                                                </h3>
                                                                {cargoEquip.nombreTipoCargo && cargoEquip.nombreTipoCargo !== cargoEquip.cargo && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 text-[9px] font-black uppercase tracking-wider">
                                                                        Rol Base: {cargoEquip.cargo}
                                                                    </span>
                                                                )}
                                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${
                                                                    cargoEquip.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                                }`}>
                                                                    {cargoEquip.status || 'Activo'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                <span className="flex items-center gap-1.5">
                                                                    📦 {uniqueCount} {uniqueCount === 1 ? 'Tipo de Insumo' : 'Tipos de Insumos'}
                                                                </span>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                                <span className="flex items-center gap-1.5">
                                                                    🛠️ {totalItems} {totalItems === 1 ? 'Unidad Total' : 'Unidades Totales'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Side Actions & Chevron Toggle */}
                                                    <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 border-slate-50 pt-4 md:pt-0">
                                                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleToggleStatus('cargo', cargoEquip)} 
                                                                className={`p-2.5 rounded-xl transition-all ${
                                                                    cargoEquip.status === 'Inactivo' 
                                                                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100/50' 
                                                                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100'
                                                                }`} 
                                                                title={cargoEquip.status === 'Inactivo' ? 'Activar Ficha' : 'Desactivar Ficha'}
                                                            >
                                                                {cargoEquip.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleEditCargo(cargoEquip)} 
                                                                className="p-2.5 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100 transition-all" 
                                                                title="Editar Ficha"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleDeleteCargo(cargoEquip._id)} 
                                                                className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/30 transition-all" 
                                                                title="Eliminar Ficha"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>

                                                        <div className={`p-2 rounded-full transition-all duration-300 ${
                                                            isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'bg-slate-50 text-slate-400'
                                                        }`}>
                                                            <ChevronDown size={18} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card Expanded Content - Ficha Técnica con Tabla de Líneas */}
                                                {isExpanded && (
                                                    <div className="border-t border-slate-50 bg-slate-50/20 px-6 md:px-8 py-6 animate-in slide-in-from-top-4 duration-300">
                                                        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                                                            {/* Ficha Header Info */}
                                                            <div className="p-5 bg-gradient-to-r from-slate-50/55 to-white border-b border-slate-100 flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-1.5 h-3 rounded-full bg-indigo-500" />
                                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                                                                        Detalle de Equipamiento Asignado (Ficha de Cargo)
                                                                    </span>
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-400 select-all font-mono">
                                                                    ID: {cargoEquip._id}
                                                                </span>
                                                            </div>

                                                            {/* Table of Lines */}
                                                            <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                    <tr className="bg-slate-50/60 text-[9px] uppercase font-black text-slate-400 tracking-wider">
                                                                        <th className="px-6 py-4 w-16 text-center">N°</th>
                                                                        <th className="px-6 py-4">Insumo / Existencia</th>
                                                                        <th className="px-6 py-4">Categoría</th>
                                                                        <th className="px-6 py-4 text-center">Cant. Requerida</th>
                                                                        <th className="px-6 py-4">Estado Sugerido</th>
                                                                        <th className="px-6 py-4 text-right">Prioridad / Segmentación</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {cargoEquip.items && cargoEquip.items.length > 0 ? (
                                                                        cargoEquip.items.filter(it => {
                                                                            if (!filterCargoCategoria) return true;
                                                                            const prodId = typeof it.productoRef === 'object' ? it.productoRef?._id : it.productoRef;
                                                                            const matchingProd = (data.productos || []).find(prod => prod._id === prodId);
                                                                            const p = matchingProd || (typeof it.productoRef === 'object' ? it.productoRef : {}) || {};
                                                                            const catId = p.categoria?._id || p.categoria;
                                                                            return String(catId) === String(filterCargoCategoria);
                                                                        }).map((it, idx) => {
                                                                            const prodId = typeof it.productoRef === 'object' ? it.productoRef?._id : it.productoRef;
                                                                            const matchingProd = (data.productos || []).find(prod => prod._id === prodId);
                                                                            const p = matchingProd || (typeof it.productoRef === 'object' ? it.productoRef : {}) || {};
                                                                            const isCritical = p.segmentacion === 'Crítico' || p.segmentacion === 'Critico';
                                                                            return (
                                                                                <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-all duration-150">
                                                                                    <td className="px-6 py-4 text-center text-xs font-black text-slate-400">
                                                                                        {idx + 1}
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <div className="flex items-center gap-3">
                                                                                            {p.icono ? (
                                                                                                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100">
                                                                                                    {getVisualIcon(p.icono, 16)}
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100">
                                                                                                    <Package size={16} />
                                                                                                </div>
                                                                                            )}
                                                                                            <div>
                                                                                                <p className="text-xs font-extrabold text-slate-700 tracking-tight">
                                                                                                    {p.nombre || 'Producto Desconocido'}
                                                                                                </p>
                                                                                                <div className="flex items-center gap-2 mt-0.5 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                                                                                    <span>SKU: {p.sku || 'Auto'}</span>
                                                                                                    <span>•</span>
                                                                                                    <span>Marca: {p.marca || 'Genérica'}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        {p.categoria ? (
                                                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 text-[10px] font-extrabold uppercase tracking-wide">
                                                                                                {getVisualIcon(p.categoria.icono || 'Tags', 12)}
                                                                                                {p.categoria.nombre || p.categoria}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-slate-400 font-bold italic text-[10px]">Sin Categoría</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-center">
                                                                                        <span className="inline-flex items-center justify-center px-3 py-1 bg-indigo-50 border border-indigo-100/30 rounded-xl text-xs font-black text-indigo-600 shadow-sm min-w-[50px]">
                                                                                            {it.cantidad} {p.unidadMedida === 'Metro' ? 'Mtr(s)' : p.unidadMedida === 'Litro' ? 'Ltr(s)' : p.unidadMedida === 'Kilogramo' ? 'Kg(s)' : 'Uni'}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4">
                                                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase border tracking-wider ${
                                                                                            it.estadoProducto === 'Nuevo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                                                            it.estadoProducto === 'Usado Bueno' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                                                            it.estadoProducto === 'Usado Malo' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                                                                        }`}>
                                                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                                                it.estadoProducto === 'Nuevo' ? 'bg-emerald-500' :
                                                                                                it.estadoProducto === 'Usado Bueno' ? 'bg-indigo-500' :
                                                                                                it.estadoProducto === 'Usado Malo' ? 'bg-amber-500' : 'bg-rose-500'
                                                                                            }`} />
                                                                                            {it.estadoProducto}
                                                                                        </span>
                                                                                    </td>
                                                                                    <td className="px-6 py-4 text-right">
                                                                                        {isCritical ? (
                                                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-100 rounded-xl text-[9px] font-black text-rose-600 uppercase tracking-widest shadow-sm">
                                                                                                <ShieldAlert size={12} /> Crítico
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border border-slate-100/50 px-2 py-1 rounded-lg">
                                                                                                Estándar
                                                                                            </span>
                                                                                        )}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <tr>
                                                                            <td colSpan={6} className="py-8 text-center text-xs font-bold text-slate-400 italic">
                                                                                No hay ítems configurados en esta ficha.
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {((activeTab === 'bodegas' && almacenView === 'grid') || 
                      (activeTab === 'categorias' && categoriaView === 'grid') || 
                      (activeTab === 'productos' && productoView === 'grid') ||
                      (activeTab === 'seriados' && productoView === 'grid')) && (
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
                                        {alm.tecnicoRef && (
                                            <>
                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase">Cargo Responsable:</span>
                                                    <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 text-[8px] font-black uppercase tracking-wider">{alm.tecnicoRef.cargo || 'Colaborador'}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase">Estado Responsable:</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold border uppercase ${
                                                        ['INACTIVO', 'DE BAJA', 'FINIQUITADO'].includes(alm.tecnicoRef.estadoActual?.toUpperCase())
                                                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                                                            : alm.tecnicoRef.estadoActual?.toUpperCase() === 'LICENCIA MEDICA'
                                                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`}>
                                                        {alm.tecnicoRef.estadoActual || 'OPERATIVO'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
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
                                        <button 
                                            type="button" 
                                            onClick={() => handleDerivarASeriado(prod)} 
                                            className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all font-bold flex items-center justify-center" 
                                            title="Derivar a Existencia Seriada (Crear copia con serie)"
                                        >
                                            <Boxes size={14} />
                                        </button>
                                        <button type="button" onClick={() => handleToggleStatus('producto', prod)} className={`p-2 rounded-lg ${prod.status === 'Inactivo' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`} title={prod.status === 'Inactivo' ? 'Desbloquear / Activar' : 'Bloquear / Desactivar'}>
                                            {prod.status === 'Inactivo' ? <Unlock size={14} /> : <Lock size={14} />}
                                        </button>
                                        <button type="button" onClick={() => handleEditProducto(prod)} className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" title="Editar"><Pencil size={14} /></button>
                                        <button type="button" onClick={() => handleDeleteProducto(prod._id)} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100" title="Eliminar"><Trash2 size={14} /></button>
                                    </div>
                                </ConfigCard>
                            ))}

                            {activeTab === 'seriados' && productoView === 'grid' && productosFiltrados.map(prod => (
                                <ConfigCard key={prod._id} icon={getVisualIcon(prod.icono || 'Archive', 20)} title={prod.nombre} sub={`S/N: ${prod.nroSerie || 'S/N'}`} type={prod.estadoDetallado || 'Nuevo'} status={prod.status}>
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
                                                <p className="text-[8px] font-black text-slate-300 uppercase">IMEI</p>
                                                <span className="text-[10px] font-black text-slate-700 text-ellipsis overflow-hidden block w-24">{prod.imei || 'N/A'}</span>
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
                                        <button 
                                            type="button" 
                                            onClick={() => handleIrAPlantillaBase(prod.nombre)} 
                                            className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 transition-all font-bold flex items-center justify-center" 
                                            title="Ir a la Existencia General Base"
                                        >
                                            <GitFork size={14} />
                                        </button>
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

                    {activeTab === 'personal' && personalView === 'grid' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-200">
                            {personalFiltrado.map(colab => {
                                const initials = getInitials(colab.nombreCompleto);
                                return (
                                    <div 
                                        key={colab._id} 
                                        className="bg-white rounded-[2.5rem] border border-slate-100 p-6 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-100 transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                                    >
                                        <div>
                                            {/* HEADER CARD */}
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-indigo-100 uppercase">
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-xs font-black text-slate-800 tracking-tight line-clamp-1">{colab.nombreCompleto}</h3>
                                                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-sky-50 text-sky-600 text-[9px] font-black uppercase tracking-wider">
                                                            {colab.cargo || 'Cargo en Préstamo'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[7px] font-black text-slate-300 uppercase tracking-wider">Estado HR</span>
                                                    {getEstadoTalentoBadge(colab.estadoActual)}
                                                </div>
                                            </div>

                                            {/* DETALLES */}
                                            <div className="mt-6 space-y-3.5">
                                                <div className="p-3 bg-slate-50 rounded-2xl space-y-2">
                                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                                        <span className="text-slate-400 uppercase tracking-wider">Proyecto:</span>
                                                        <span className="text-slate-800 font-extrabold text-right line-clamp-1">{colab.proyecto || 'Sin Asignar'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[10px] font-bold">
                                                        <span className="text-slate-400 uppercase tracking-wider">Mandante / Cliente:</span>
                                                        <span className="text-slate-800 font-extrabold text-right line-clamp-1">{colab.cliente || 'Sin Asignar'}</span>
                                                    </div>
                                                </div>

                                                {/* IDENTIFICADORES */}
                                                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
                                                    <div className="flex-1 min-w-[120px] p-2 bg-slate-50 rounded-xl border border-slate-100/50 flex flex-col justify-center">
                                                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-wider">RUT Trabajador</span>
                                                        <span className="text-[10px] font-extrabold text-slate-600 mt-0.5">{colab.rut || 'No Registrado'}</span>
                                                    </div>
                                                    {colab.idRecursoToa ? (
                                                        <div className="flex-1 min-w-[120px] p-2 bg-violet-50/50 rounded-xl border border-violet-100/30 flex flex-col justify-center">
                                                            <span className="text-[7px] font-black text-violet-400 uppercase tracking-wider">TOA Resource ID</span>
                                                            <span className="text-[10px] font-black text-violet-600 mt-0.5 flex items-center gap-1">
                                                                ⚡ {colab.idRecursoToa}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 min-w-[120px] p-2 bg-slate-50 rounded-xl border border-slate-100/50 flex flex-col justify-center">
                                                            <span className="text-[7px] font-black text-slate-300 uppercase tracking-wider">TOA ID</span>
                                                            <span className="text-[10px] font-bold text-slate-400 mt-0.5 italic">Sin TOA ID</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {activeTab === 'personal' && personalView === 'list' && (
                        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm animate-in fade-in zoom-in-95 duration-200">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4 w-20">Item</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4">RUT</th>
                                        <th className="px-6 py-4">ID TOA</th>
                                        <th className="px-6 py-4">Cargo</th>
                                        <th className="px-6 py-4">Proyecto</th>
                                        <th className="px-6 py-4">Mandante</th>
                                        <th className="px-6 py-4">Estado Talento</th>
                                        <th className="px-6 py-4">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {personalFiltrado.map((colab, index) => {
                                        const initials = getInitials(colab.nombreCompleto);
                                        return (
                                            <tr key={colab._id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-all duration-150">
                                                <td className="px-6 py-4 text-xs font-black text-slate-400">{index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-black text-xs flex items-center justify-center uppercase shadow-sm">
                                                            {initials}
                                                        </div>
                                                        <span className="text-xs font-black text-slate-800 tracking-tight">{colab.nombreCompleto}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-extrabold text-slate-500">{colab.rut || 'No Registrado'}</td>
                                                <td className="px-6 py-4 text-xs font-black">
                                                    {colab.idRecursoToa ? (
                                                        <span className="text-violet-600 flex items-center gap-1">
                                                            ⚡ {colab.idRecursoToa}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 font-bold italic">Sin TOA ID</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-600 text-[9px] font-black uppercase tracking-wider">
                                                        {colab.cargo || 'Cargo en Préstamo'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs font-extrabold text-slate-600">{colab.proyecto || 'Sin Asignar'}</td>
                                                <td className="px-6 py-4 text-xs font-extrabold text-slate-600">{colab.cliente || 'Sin Asignar'}</td>
                                                <td className="px-6 py-4 text-xs">
                                                    {getEstadoTalentoBadge(colab.estadoActual)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => handleOpenAsignacionModal(colab)}
                                                        className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-600 font-bold text-[10px] hover:bg-violet-100 transition-colors whitespace-nowrap flex items-center gap-1"
                                                    >
                                                        <Package size={12} /> Asignar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {personalFiltrado.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-xs font-bold text-slate-400 italic">
                                                No se encontraron colaboradores que coincidan con la búsqueda o filtros aplicados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </>
                )}
            </main>

            {/* MODAL DE ASIGNACIÓN INTELIGENTE DE CARGO */}
            {showAsignacionModal && tecnicoAsignacion && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl overflow-hidden transition-all duration-300 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                    <Package className="text-violet-500" size={28} />
                                    Asignación Inteligente de Cargo
                                </h2>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">
                                    Técnico: {tecnicoAsignacion.nombres} {tecnicoAsignacion.apellidos} ({tecnicoAsignacion.rut})
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 rounded-xl bg-sky-50 text-sky-600 font-bold text-xs uppercase">
                                    {tecnicoAsignacion.cargo || 'Sin Cargo'}
                                </span>
                            </div>
                        </div>

                        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/30">
                            {/* Información de Tallas del Técnico */}
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 mb-6 shadow-sm">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tallas Registradas (Captura de Talento)</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100/50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Polera / Camisa</span>
                                        <span className="text-lg font-black text-slate-800 mt-1">{tecnicoAsignacion.shirtSize || '-'}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100/50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pantalón</span>
                                        <span className="text-lg font-black text-slate-800 mt-1">{tecnicoAsignacion.pantsSize || '-'}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100/50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parka / Casaca</span>
                                        <span className="text-lg font-black text-slate-800 mt-1">{tecnicoAsignacion.jacketSize || '-'}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-100/50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calzado</span>
                                        <span className="text-lg font-black text-slate-800 mt-1">{tecnicoAsignacion.shoeSize || tecnicoAsignacion.bootsSize || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Parámetros de Asignación</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectField 
                                        label="Bodega Origen (Desde donde se extrae el stock)" 
                                        value={almacenOrigenAsig} 
                                        onChange={setAlmacenOrigenAsig} 
                                        options={data?.almacenes?.map(a => ({label: a.nombre, value: a._id}))} 
                                        placeholder="Sin Origen (Ingreso Directo)"
                                        required={false}
                                    />
                                    <div className="flex items-end">
                                        <button 
                                            type="button" 
                                            onClick={simularAsignacion} 
                                            disabled={isSimulatingAsignacion}
                                            className="w-full py-4 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xs uppercase tracking-wider hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                        >
                                            {isSimulatingAsignacion ? 'Simulando...' : '1. Simular Matching Inteligente'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {asignacionSimulacion && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm shadow-emerald-50">
                                        <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <CheckCircle2 size={16} /> Resultados de Simulación
                                        </h3>
                                        
                                        {asignacionSimulacion.missingStock?.length > 0 && (
                                            <div className="mb-4 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold">
                                                <p className="flex items-center gap-2 mb-2"><AlertTriangle size={14} /> Faltante de Stock en Bodega Origen:</p>
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {asignacionSimulacion.missingStock.map((m, i) => (
                                                        <li key={i}>{m.producto} (Req: {m.requerido}, Disp: {m.disponible})</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {asignacionSimulacion.matches?.map((m, i) => (
                                                <div key={`m-${i}`} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-md mb-1 inline-block">MATCH TALLA {m.tallaDetectada}</span>
                                                        <p className="text-sm font-black text-slate-800">{m.productoAsignado}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 line-through decoration-rose-300">Original: {m.productoOriginal}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-slate-600">{m.cantidad}x {m.estadoProducto}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">SKU: {m.skuAsignado}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {asignacionSimulacion.fallbacks?.map((f, i) => (
                                                <div key={`f-${i}`} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-200 px-2 py-0.5 rounded-md mb-1 inline-block">ASIGNACIÓN ESTÁNDAR</span>
                                                        <p className="text-sm font-black text-slate-800">{f.productoAsignado}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-black text-slate-600">{f.cantidad}x {f.estadoProducto}</p>
                                                        <p className="text-[9px] font-bold text-slate-400 mt-0.5">SKU: {f.skuAsignado}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            {asignacionSimulacion.matches?.length === 0 && asignacionSimulacion.fallbacks?.length === 0 && (
                                                <p className="text-center text-xs font-bold text-slate-400 italic py-4">No hay ítems configurados en este cargo.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={handleCloseAsignacionModal} 
                                className="px-6 py-3 rounded-2xl text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                onClick={confirmarAsignacion}
                                disabled={!asignacionSimulacion || asignacionSimulacion.missingStock?.length > 0 || isConfirmingAsignacion}
                                className="px-8 py-3 rounded-2xl bg-violet-600 text-white font-black text-xs uppercase tracking-widest hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-200 transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center gap-2"
                            >
                                {isConfirmingAsignacion ? 'Procesando...' : '2. Confirmar Asignación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL UNIFICADO */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className={`bg-white rounded-[3rem] w-full ${activeTab === 'cargos' ? 'max-w-5xl' : 'max-w-lg'} shadow-2xl overflow-hidden transition-all duration-300 animate-in zoom-in-95`}>
                        <form onSubmit={handleAction}>
                            <div className="p-8 border-b border-slate-50">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                    {activeTab === 'bodegas' && editingAlmacenId
                                        ? 'Editar bodega/vehículo'
                                        : activeTab === 'categorias' && editingCategoriaId
                                        ? 'Editar categoría'
                                        : activeTab === 'productos' && editingProductoId
                                        ? 'Editar existencia'
                                        : activeTab === 'cargos' && editingCargoId
                                        ? 'Editar equipamiento de cargo'
                                        : activeTab === 'cargos'
                                        ? 'Crear equipamiento de cargo'
                                        : `Registro de ${activeTab === 'productos' ? 'existencias' : activeTab === 'bodegas' ? 'bodegas/vehículos' : 'categorías'}`}
                                </h2>
                                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">Configuración Maestra 360</p>
                            </div>

                            <div className={`p-8 space-y-6 ${activeTab === 'cargos' ? 'max-h-[70vh]' : 'max-h-[60vh]'} overflow-y-auto custom-scrollbar`}>
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
                                        <InputField label="Dirección / Ubicación" value={almForm.ubicacion.direccion} onChange={v => setAlmForm({...almForm, ubicacion: { direccion: v }})} required={false} />
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
                                        {inlineSimilarityWarning && (
                                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl animate-pulse flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-amber-800 text-xs font-black uppercase tracking-wider">
                                                    <span className="text-sm">⚠️</span> Posible Duplicado Detectado
                                                </div>
                                                <p className="text-[11px] text-amber-700 font-bold leading-relaxed">
                                                    El nombre es muy similar a la existencia existente: <strong className="text-amber-900">"{inlineSimilarityWarning.nombre}"</strong> ({inlineSimilarityWarning.sku}).
                                                </p>
                                                <div className="flex gap-2 mt-1">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setProdForm({
                                                                ...prodForm,
                                                                nombre: inlineSimilarityWarning.nombre,
                                                                sku: inlineSimilarityWarning.sku,
                                                                categoria: inlineSimilarityWarning.categoria?._id || inlineSimilarityWarning.categoria,
                                                                marca: inlineSimilarityWarning.marca || '',
                                                                modelo: inlineSimilarityWarning.modelo || '',
                                                                color: inlineSimilarityWarning.color || 'Genérico',
                                                                unidadMedida: inlineSimilarityWarning.unidadMedida || 'Unidad',
                                                                descripcion: inlineSimilarityWarning.descripcion || '',
                                                                tipo: inlineSimilarityWarning.tipo || 'Activo',
                                                                segmentacion: inlineSimilarityWarning.segmentacion || 'Estándar',
                                                                propiedad: inlineSimilarityWarning.propiedad || 'Propio',
                                                                valorUnitario: inlineSimilarityWarning.valorUnitario || 0
                                                            });
                                                            setEditingProductoId(inlineSimilarityWarning._id);
                                                            setInlineSimilarityWarning(null);
                                                        }} 
                                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all"
                                                    >
                                                        🔗 Unificar (Editar Existente)
                                                     </button>
                                                     <button 
                                                         type="button" 
                                                         onClick={() => setInlineSimilarityWarning(null)} 
                                                         className="px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm transition-all"
                                                     >
                                                         ✅ Mantener como Nueva Opción
                                                     </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField label="Código SKU (Vacío = Auto)" value={prodForm.sku} onChange={v => setProdForm({...prodForm, sku: v})} required={false} />
                                            <InputField label="Código EAN (Barras)" value={prodForm.ean} onChange={v => setProdForm({...prodForm, ean: v})} required={false} />
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
                                            <InputField label="Marca" value={prodForm.marca} onChange={v => setProdForm({...prodForm, marca: v})} required={false} />
                                            <InputField label="Modelo" value={prodForm.modelo} onChange={v => setProdForm({...prodForm, modelo: v})} required={false} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField label="Unidad de Medida" value={prodForm.unidadMedida} onChange={v => setProdForm({...prodForm, unidadMedida: v})} options={['Unidad', 'Metro', 'Litro', 'Kilogramo', 'Caja', 'Pack']} />
                                            <InputField label="Descripción" value={prodForm.descripcion} onChange={v => setProdForm({...prodForm, descripcion: v})} required={false} />
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
                                        </div>
                                    </>
                                )}

                                {activeTab === 'seriados' && (
                                    <>
                                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex flex-col gap-1.5">
                                            <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                                                Vincular con Existencia General Base
                                            </p>
                                            <p className="text-[10px] text-indigo-500 font-bold leading-relaxed">
                                                Selecciona un producto del catálogo general para heredar su nombre, categoría, unidad de medida y precio base de adquisición.
                                            </p>
                                            <div className="mt-2">
                                                <SelectField
                                                    label="Seleccionar Producto Base"
                                                    value={
                                                        (data.productos || []).find(p => !p.nroSerie && !p.trackSerial && p.nombre === prodForm.nombre)?._id || ''
                                                    }
                                                    onChange={selectedValue => {
                                                        const baseProd = (data.productos || []).find(p => p._id === selectedValue);
                                                        if (baseProd) {
                                                            setProdForm(prev => ({
                                                                ...prev,
                                                                nombre: baseProd.nombre,
                                                                categoria: baseProd.categoria?._id || baseProd.categoria,
                                                                icono: baseProd.icono || 'Archive',
                                                                tipo: baseProd.tipo || 'Activo',
                                                                unidadMedida: baseProd.unidadMedida || 'Unidad',
                                                                propiedad: baseProd.propiedad || 'Propio',
                                                                clienteRef: baseProd.clienteRef?._id || baseProd.clienteRef || '',
                                                                valorUnitario: baseProd.valorUnitario || 0,
                                                                segmentacion: baseProd.segmentacion || 'Estándar',
                                                                color: baseProd.color || 'Genérico',
                                                                marca: baseProd.marca || prev.marca,
                                                                modelo: baseProd.modelo || prev.modelo,
                                                                descripcion: baseProd.descripcion || prev.descripcion,
                                                            }));
                                                        }
                                                    }}
                                                    options={(data.productos || [])
                                                        .filter(p => !p.nroSerie && !p.trackSerial)
                                                        .map(p => ({ label: p.nombre, value: p._id }))}
                                                />
                                            </div>
                                        </div>

                                        {prodForm.nombre && (
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col gap-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                                    Propiedades Heredadas
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
                                                    <div>
                                                        <span className="text-slate-400">Categoría:</span>{' '}
                                                        {(data.categorias || []).find(c => c._id === (prodForm.categoria?._id || prodForm.categoria))?.nombre || 'Sin Categoría'}
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Tipo:</span> {prodForm.tipo}
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Medida:</span> {prodForm.unidadMedida}
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400">Valor Base:</span> ${Number(prodForm.valorUnitario || 0).toLocaleString()}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-slate-400">Propiedad:</span>{' '}
                                                        {prodForm.propiedad === 'Propio' ? 'Empresa' : 'Cliente'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <InputField
                                            label="Marca del Artículo"
                                            value={prodForm.marca}
                                            onChange={v => setProdForm({ ...prodForm, marca: v })}
                                        />
                                        <InputField
                                            label="Modelo del Artículo"
                                            value={prodForm.modelo}
                                            onChange={v => setProdForm({ ...prodForm, modelo: v })}
                                        />

                                        <div className="grid grid-cols-2 gap-4">
                                            <InputField
                                                label="Número de Serie (Requerido)"
                                                value={prodForm.nroSerie}
                                                onChange={v => setProdForm({ ...prodForm, nroSerie: v })}
                                            />
                                            <InputField
                                                label="IMEI (Opcional)"
                                                value={prodForm.imei}
                                                onChange={v => setProdForm({ ...prodForm, imei: v })}
                                                required={false}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectField
                                                label="Color"
                                                value={prodForm.color || 'Genérico'}
                                                onChange={v => setProdForm({ ...prodForm, color: v })}
                                                options={COLOR_OPTIONS}
                                            />
                                            <SelectField
                                                label="Estado Físico"
                                                value={prodForm.estadoDetallado || 'Nuevo'}
                                                onChange={v => setProdForm({ ...prodForm, estadoDetallado: v })}
                                                options={[
                                                    'Nuevo',
                                                    'Usado Reacondicionado',
                                                    'Para Reparar',
                                                    'Baja',
                                                ]}
                                            />
                                        </div>
                                    </>
                                )}

                                {activeTab === 'cargos' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                        {/* COLUMNA IZQUIERDA: INFORMACIÓN DE CARGO (Ficha Básica) */}
                                        <div className="lg:col-span-5 space-y-6">
                                            <div className="bg-slate-50/80 rounded-[2rem] border border-slate-100 p-6 space-y-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-3 bg-slate-900 text-white rounded-2xl">
                                                        <Briefcase size={18} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">Ficha de Cargo</h4>
                                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Definición y Sugerencias</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <InputField 
                                                        label="Cargo / Rol Base de Técnico" 
                                                        value={cargoForm.cargo} 
                                                        onChange={v => setCargoForm({ ...cargoForm, cargo: v, nombreTipoCargo: cargoForm.nombreTipoCargo && cargoForm.nombreTipoCargo !== cargoForm.cargo ? cargoForm.nombreTipoCargo : v })} 
                                                        required
                                                        placeholder="Ej: TECNICO TELECOMUNICACIONES"
                                                    />

                                                    <InputField 
                                                        label="Nombre Especialidad / Variante de Cargo" 
                                                        value={cargoForm.nombreTipoCargo} 
                                                        onChange={v => setCargoForm({ ...cargoForm, nombreTipoCargo: v })} 
                                                        required
                                                        placeholder="Ej: Técnico Telecomunicaciones - Fibra Óptica"
                                                    />

                                                    {uniqueCargos.length > 0 && (
                                                        <div className="space-y-2">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Sugerencias del Personal 360</label>
                                                            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                                                                {uniqueCargos.map(cargoVal => (
                                                                    <button
                                                                        key={cargoVal}
                                                                        type="button"
                                                                        onClick={() => setCargoForm({ 
                                                                            ...cargoForm, 
                                                                            cargo: cargoVal, 
                                                                            nombreTipoCargo: cargoForm.nombreTipoCargo && cargoForm.nombreTipoCargo !== cargoForm.cargo ? cargoForm.nombreTipoCargo : cargoVal 
                                                                        })}
                                                                        className={`px-3 py-2 border rounded-xl text-[10px] font-bold transition-all active:scale-95 ${cargoForm.cargo === cargoVal ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50'}`}
                                                                    >
                                                                        {cargoVal}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-gradient-to-br from-indigo-50/50 to-violet-50/30 rounded-[2rem] border border-indigo-100/50 p-6 space-y-3">
                                                <h5 className="text-[10px] font-black text-indigo-950 uppercase tracking-widest">¿Para qué sirve esta Ficha?</h5>
                                                <p className="text-[10px] text-indigo-700/80 leading-relaxed font-semibold">
                                                    Al predeterminar un cargo, el sistema asignará automáticamente este equipamiento base a los nuevos técnicos ingresados con este rol.
                                                </p>
                                                <div className="flex items-center gap-2 text-[9px] text-indigo-500 font-black uppercase tracking-wider pt-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Control Inteligente 360
                                                </div>
                                            </div>
                                        </div>

                                        {/* COLUMNA DERECHA: CONSTRUCTOR DE IMPLEMENTOS */}
                                        <div className="lg:col-span-7 space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <div>
                                                    <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Implementos Predeterminados</h4>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Asigna los insumos y herramientas requeridos</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setCargoForm({
                                                        ...cargoForm,
                                                        items: [...cargoForm.items, { productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]
                                                    })}
                                                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                                                >
                                                    <Plus size={12} /> Agregar Fila
                                                </button>
                                            </div>

                                            {cargoForm.items.length === 0 ? (
                                                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider space-y-2">
                                                    <div className="w-12 h-12 rounded-full bg-white border border-slate-100 flex items-center justify-center mx-auto text-slate-300">
                                                        <Plus size={18} />
                                                    </div>
                                                    <p>Sin equipamientos cargados aún.</p>
                                                    <p className="text-[9px] text-slate-400 font-bold lowercase">Haz clic en "Agregar Fila" para definir el equipamiento estándar.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
                                                    {cargoForm.items.map((item, index) => (
                                                        <div key={index} className="flex gap-2.5 items-end p-4 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-md transition-all duration-300 relative group animate-in slide-in-from-top-1">
                                                            <div className="flex-1 min-w-[140px]">
                                                                <SelectField
                                                                    label="Existencia / Catálogo"
                                                                    value={item.productoRef}
                                                                    onChange={v => {
                                                                        const newItems = [...cargoForm.items];
                                                                        newItems[index].productoRef = v;
                                                                        setCargoForm({ ...cargoForm, items: newItems });
                                                                    }}
                                                                    options={(data.productos || []).map(p => ({ label: `${p.nombre} (${p.sku})`, value: p._id }))}
                                                                />
                                                            </div>
                                                            <div className="w-20">
                                                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cant.</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    required
                                                                    value={item.cantidad}
                                                                    onChange={e => {
                                                                        const newItems = [...cargoForm.items];
                                                                        newItems[index].cantidad = Math.max(1, parseInt(e.target.value) || 1);
                                                                        setCargoForm({ ...cargoForm, items: newItems });
                                                                    }}
                                                                    className="w-full mt-2 p-4 bg-slate-50 border border-slate-200/50 rounded-2xl text-xs font-bold outline-none focus:border-slate-300 transition-all text-slate-700 shadow-inner"
                                                                />
                                                            </div>
                                                            <div className="w-28">
                                                                <SelectField
                                                                    label="Estado"
                                                                    value={item.estadoProducto}
                                                                    onChange={v => {
                                                                        const newItems = [...cargoForm.items];
                                                                        newItems[index].estadoProducto = v;
                                                                        setCargoForm({ ...cargoForm, items: newItems });
                                                                    }}
                                                                    options={['Nuevo', 'Usado Bueno', 'Usado Malo', 'Merma']}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newItems = cargoForm.items.filter((_, idx) => idx !== index);
                                                                    setCargoForm({ ...cargoForm, items: newItems });
                                                                }}
                                                                className="p-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all flex items-center justify-center active:scale-95 border border-rose-100/50 mb-0.5"
                                                                title="Eliminar fila"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
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
                                        : activeTab === 'cargos' && editingCargoId
                                        ? 'Actualizar Cargo'
                                        : 'Guardar Registro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAiModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="p-8 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-white/10 rounded-2xl">
                                    <Sparkles size={24} className="animate-spin duration-[3000ms]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-wider">Asistente de IA Logística</h2>
                                    <p className="text-violet-200 text-[10px] font-black uppercase tracking-widest mt-1">Sintetizador Masivo de Fichas Técnicas</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setShowAiModal(false)} className="text-white/60 hover:text-white font-bold text-xs uppercase tracking-wider">Cerrar</button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto flex-1">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center gap-4">
                                <div className="text-3xl">🤖</div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">¿Cómo funciona?</h4>
                                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                        Nuestra IA analizará la categoría, marca, modelo y segmentación de cada producto para redactar una ficha técnica detallada y profesional en segundos.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                    Existencias a Actualizar ({(data.productos || []).filter(p => !p.descripcion || p.descripcion.trim() === '').length})
                                </h3>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                    {(data.productos || []).filter(p => !p.descripcion || p.descripcion.trim() === '').map(p => {
                                        const previewDesc = generateIntelligentDescription({
                                            nombre: p.nombre,
                                            categoria: p.categoria?.nombre || p.categoria || '',
                                            marca: p.marca,
                                            modelo: p.modelo,
                                            tipo: p.tipo,
                                            segmentacion: p.segmentacion
                                        });
                                        return (
                                            <div key={p._id} className="p-4 bg-violet-50/50 rounded-2xl border border-violet-100/50 hover:bg-violet-50 transition-all flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">{p.nombre}</span>
                                                    <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[8px] font-black uppercase tracking-widest">{p.sku || 'Sin SKU'}</span>
                                                </div>
                                                <p className="text-[11px] text-violet-600 font-bold leading-relaxed">{previewDesc}</p>
                                            </div>
                                        );
                                    })}
                                    {(data.productos || []).filter(p => !p.descripcion || p.descripcion.trim() === '').length === 0 && (
                                        <div className="py-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                                            🎉 ¡Perfecto! Ningún producto requiere optimización de descripción.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button type="button" onClick={() => setShowAiModal(false)} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                            <button 
                                type="button" 
                                disabled={aiProgress || (data.productos || []).filter(p => !p.descripcion || p.descripcion.trim() === '').length === 0}
                                onClick={handleAutocompleteDescriptions} 
                                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center gap-2"
                            >
                                {aiProgress ? 'Generando y Actualizando...' : '✨ Generar e Inyectar descripciones'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResolutionModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="p-8 bg-gradient-to-r from-amber-500 to-orange-600 text-white flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3.5 bg-white/10 rounded-2xl">
                                    <ShieldAlert size={24} className="animate-bounce" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-wider">Mitigador de Duplicados</h2>
                                    <p className="text-amber-100 text-[10px] font-black uppercase tracking-widest mt-1">Monitoreo de Similitudes de Catálogo</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => {
                                setShowResolutionModal(false);
                                setPendingUploadList([]);
                                setDuplicateResolutionQueue([]);
                            }} className="text-white/60 hover:text-white font-bold text-xs uppercase tracking-wider">Cancelar Carga</button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto flex-1">
                            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-center gap-4">
                                <div className="text-3xl">⚠️</div>
                                <div>
                                    <h4 className="text-xs font-black text-amber-800 uppercase tracking-wide">Se detectaron posibles productos duplicados en tu archivo</h4>
                                    <p className="text-amber-700 text-xs mt-1 leading-relaxed font-medium">
                                        Para mantener el catálogo de existencias limpio y ordenado, valida cada caso. Puedes unificarlos con el producto existente (evita crear un duplicado), mantenerlos por ser una variante diferente, o descartarlos de la carga.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                        Casos Pendientes de Resolución ({duplicateResolutionQueue.filter(item => !item.resolution).length})
                                    </h3>
                                    <div className="flex gap-2">
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setDuplicateResolutionQueue(duplicateResolutionQueue.map(item => ({ ...item, resolution: 'unify' })));
                                            }}
                                            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                        >
                                            🔗 Unificar Todos
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setDuplicateResolutionQueue(duplicateResolutionQueue.map(item => ({ ...item, resolution: 'keep' })));
                                            }}
                                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                        >
                                            ✅ Mantener Todos
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {duplicateResolutionQueue.map((item, idx) => (
                                        <div key={idx} className={`p-5 rounded-3xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                            item.resolution === 'unify' 
                                                ? 'bg-amber-50 border-amber-200' 
                                                : item.resolution === 'keep' 
                                                ? 'bg-emerald-50 border-emerald-200' 
                                                : item.resolution === 'discard' 
                                                ? 'bg-rose-50 border-rose-200' 
                                                : 'bg-white border-slate-100 shadow-sm'
                                        }`}>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[8px] font-black uppercase tracking-widest">Fila Excel</span>
                                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">{item.uploadedItem.nombre}</span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-400">
                                                    Muy similar a: <span className="text-amber-800 font-extrabold">"{item.similarTo.nombre}"</span> ({item.similarTo.sku || 'Sin SKU'})
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nq = [...duplicateResolutionQueue];
                                                        nq[idx].resolution = 'unify';
                                                        setDuplicateResolutionQueue(nq);
                                                    }}
                                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                                        item.resolution === 'unify' 
                                                            ? 'bg-amber-600 text-white shadow-md' 
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    🔗 Unificar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nq = [...duplicateResolutionQueue];
                                                        nq[idx].resolution = 'keep';
                                                        setDuplicateResolutionQueue(nq);
                                                    }}
                                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                                        item.resolution === 'keep' 
                                                            ? 'bg-emerald-600 text-white shadow-md' 
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    ✅ Mantener
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nq = [...duplicateResolutionQueue];
                                                        nq[idx].resolution = 'discard';
                                                        setDuplicateResolutionQueue(nq);
                                                    }}
                                                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                                        item.resolution === 'discard' 
                                                            ? 'bg-rose-600 text-white shadow-md' 
                                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    ❌ Omitir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                            <button type="button" onClick={() => {
                                setShowResolutionModal(false);
                                setPendingUploadList([]);
                                setDuplicateResolutionQueue([]);
                            }} className="px-6 py-3 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar Todo</button>
                            <button 
                                type="button" 
                                onClick={handleResolveDuplicatesSubmit}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl flex items-center gap-2"
                            >
                                Importar y Aplicar Resoluciones
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeProdCategoryDetail && activeProdCategoryDetail._id !== 'all' && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[260] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-6xl shadow-2xl overflow-hidden transition-all duration-300 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* Cabecera Premium */}
                        <div className="p-8 bg-gradient-to-r from-slate-900 to-indigo-950 text-white shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                            {/* Decoración premium de fondo */}
                            <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute left-1/3 bottom-0 w-60 h-60 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
                            
                            <div className="flex items-center gap-5 z-10">
                                <div className="p-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 text-indigo-200 shadow-inner">
                                    {(() => {
                                        let IconComponent = Wrench;
                                        const lowerCat = (activeProdCategoryDetail.nombre || '').toLowerCase();
                                        if (lowerCat.includes('epp') || lowerCat.includes('seguridad') || lowerCat.includes('protección') || lowerCat.includes('casco') || lowerCat.includes('chaleco')) IconComponent = Shield;
                                        else if (lowerCat.includes('equipo') || lowerCat.includes('tecnología') || lowerCat.includes('cámara') || lowerCat.includes('fusión') || lowerCat.includes('router') || lowerCat.includes('ont')) IconComponent = Cpu;
                                        else if (lowerCat.includes('cable') || lowerCat.includes('fibra') || lowerCat.includes('insumo') || lowerCat.includes('conector') || lowerCat.includes('ferretería')) IconComponent = Layers;
                                        else if (lowerCat.includes('herramienta') || lowerCat.includes('taladro') || lowerCat.includes('destornillador')) IconComponent = Hammer;
                                        else if (lowerCat.includes('instrumento') || lowerCat.includes('medidor') || lowerCat.includes('tester') || lowerCat.includes('otdr') || lowerCat.includes('power')) IconComponent = Gauge;
                                        return <IconComponent size={32} className="animate-pulse" />;
                                    })()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[9px] font-black uppercase tracking-widest text-indigo-200">
                                            {activeProdCategoryDetail.prioridadValor}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400/30 text-[9px] font-black uppercase tracking-widest text-emerald-200">
                                            {activeProdCategoryDetail.tipoRotacion}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight mt-1">
                                        Explorador: {activeProdCategoryDetail.nombre}
                                    </h2>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                                        Código Maestro: {activeProdCategoryDetail.codigo || 'S/C'}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 z-10">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setEditingProductoId(null);
                                        setProdForm({
                                            nombre: '',
                                            sku: '',
                                            ean: '',
                                            categoria: activeProdCategoryDetail._id,
                                            marca: '',
                                            modelo: '',
                                            nroSerie: '',
                                            imei: '',
                                            trackSerial: false,
                                            unidadMedida: 'Unidad',
                                            descripcion: '',
                                            tipo: 'Activo',
                                            color: 'Genérico',
                                            segmentacion: 'Estándar',
                                            propiedad: 'Propio',
                                            clienteRef: '',
                                            valorUnitario: 0,
                                            icono: 'Archive',
                                            fotoUrl: ''
                                        });
                                        setShowModal(true);
                                    }}
                                    className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-900 font-black text-xs uppercase tracking-wider shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                >
                                    <Sparkles size={14} className="text-indigo-600" /> Nuevo Artículo
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setActiveProdCategoryDetail(null)}
                                    className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
                                >
                                    Volver Atrás
                                </button>
                            </div>
                        </div>

                        {/* Contenido / Vista Principal */}
                        <div className="p-8 overflow-y-auto custom-scrollbar flex-grow bg-slate-50/50">
                            {/* Métricas / KPIs de la Categoría */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Artículos</span>
                                        <h3 className="text-xl font-black text-slate-800 mt-1">
                                            {((data.productos || []).filter(p => {
                                                const catId = p.categoria?._id || p.categoria;
                                                return String(catId) === String(activeProdCategoryDetail._id);
                                            })).length}
                                        </h3>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                                        <Package size={20} />
                                    </div>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valorización Total</span>
                                        <h3 className="text-xl font-black text-slate-800 mt-1">
                                            ${((data.productos || []).filter(p => {
                                                const catId = p.categoria?._id || p.categoria;
                                                return String(catId) === String(activeProdCategoryDetail._id);
                                            })).reduce((acc, p) => acc + (Number(p.valorUnitario) || 0), 0).toLocaleString()}
                                        </h3>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                                        <Gauge size={20} />
                                    </div>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Segmentación Críticos</span>
                                        <h3 className="text-xl font-black text-slate-800 mt-1">
                                            {((data.productos || []).filter(p => {
                                                const catId = p.categoria?._id || p.categoria;
                                                return String(catId) === String(activeProdCategoryDetail._id) && (p.segmentacion === 'Crítico' || p.segmentacion === 'Critico');
                                            })).length}
                                        </h3>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-rose-50 text-rose-600">
                                        <Shield size={20} />
                                    </div>
                                </div>
                                <div className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center justify-between">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Artículos Activos</span>
                                        <h3 className="text-xl font-black text-slate-800 mt-1">
                                            {((data.productos || []).filter(p => {
                                                const catId = p.categoria?._id || p.categoria;
                                                return String(catId) === String(activeProdCategoryDetail._id) && p.status !== 'Inactivo';
                                            })).length}
                                        </h3>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                                        <Cpu size={20} />
                                    </div>
                                </div>
                            </div>

                            {/* Barra de Búsqueda local */}
                            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="relative w-full max-w-md">
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchProducto}
                                        onChange={e => setSearchProducto(e.target.value)}
                                        placeholder="Buscar artículo en esta categoría..."
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Mostrando {((data.productos || []).filter(p => {
                                        const catId = p.categoria?._id || p.categoria;
                                        const term = (searchProducto || '').toLowerCase();
                                        return String(catId) === String(activeProdCategoryDetail._id) && (
                                            !term ||
                                            p.nombre?.toLowerCase().includes(term) ||
                                            p.sku?.toLowerCase().includes(term) ||
                                            p.marca?.toLowerCase().includes(term) ||
                                            p.modelo?.toLowerCase().includes(term)
                                        );
                                    })).length} de {((data.productos || []).filter(p => {
                                        const catId = p.categoria?._id || p.categoria;
                                        return String(catId) === String(activeProdCategoryDetail._id);
                                    })).length} existencias
                                </div>
                            </div>

                            {/* Tabla de Artículos */}
                            {((data.productos || []).filter(p => {
                                const catId = p.categoria?._id || p.categoria;
                                const term = (searchProducto || '').toLowerCase();
                                return String(catId) === String(activeProdCategoryDetail._id) && (
                                    !term ||
                                    p.nombre?.toLowerCase().includes(term) ||
                                    p.sku?.toLowerCase().includes(term) ||
                                    p.marca?.toLowerCase().includes(term) ||
                                    p.modelo?.toLowerCase().includes(term)
                                );
                            })).length === 0 ? (
                                <div className="p-12 text-center bg-white border border-slate-100 rounded-[2.5rem]">
                                    <Archive size={40} className="mx-auto text-slate-300 mb-3" />
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">No se encontraron artículos</h4>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1">Prueba cambiando tu búsqueda o agrega un nuevo artículo.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[9px] uppercase font-black text-slate-400 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-4 w-12 text-center">Nº</th>
                                                    <th className="px-6 py-4">Artículo</th>
                                                    <th className="px-6 py-4">SKU / Código</th>
                                                    <th className="px-6 py-4">Especificaciones</th>
                                                    <th className="px-6 py-4">Valor Base</th>
                                                    <th className="px-6 py-4">Estado</th>
                                                    <th className="px-6 py-4 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {((data.productos || []).filter(p => {
                                                    const catId = p.categoria?._id || p.categoria;
                                                    const term = (searchProducto || '').toLowerCase();
                                                    return String(catId) === String(activeProdCategoryDetail._id) && (
                                                        !term ||
                                                        p.nombre?.toLowerCase().includes(term) ||
                                                        p.sku?.toLowerCase().includes(term) ||
                                                        p.marca?.toLowerCase().includes(term) ||
                                                        p.modelo?.toLowerCase().includes(term)
                                                    );
                                                })).map((prod, index) => (
                                                    <tr key={prod._id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-400 text-center">{index + 1}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                                                    {getVisualIcon(prod.icono || 'Archive', 14)}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-xs font-black text-slate-700">{prod.nombre}</h4>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{prod.tipo || 'Insumo'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-500">{prod.sku || 'S/SKU'}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {prod.marca && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-extrabold text-slate-600 uppercase">
                                                                        {prod.marca}
                                                                    </span>
                                                                )}
                                                                {prod.modelo && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-extrabold text-slate-600 uppercase">
                                                                        {prod.modelo}
                                                                    </span>
                                                                )}
                                                                {prod.color && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100 text-[9px] font-extrabold text-slate-600 uppercase">
                                                                        {prod.color}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-extrabold text-slate-700">
                                                            ${Number(prod.valorUnitario || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                                prod.status === 'Inactivo' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                            }`}>
                                                                {prod.status || 'Activo'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => {
                                                                        setActiveProdCategoryDetail(null);
                                                                        setActiveTab('seriados');
                                                                        setSearchProducto(prod.sku || prod.nombre);
                                                                    }} 
                                                                    className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                                                                    title="Derivar a Existencias Seriadas"
                                                                >
                                                                    <Boxes size={13} />
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleToggleStatus('producto', prod)} 
                                                                    className={`p-2 rounded-lg transition-colors ${
                                                                        prod.status === 'Inactivo' ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                                                    }`}
                                                                    title={prod.status === 'Inactivo' ? 'Activar' : 'Desactivar'}
                                                                >
                                                                    {prod.status === 'Inactivo' ? <Unlock size={13} /> : <Lock size={13} />}
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleEditProducto(prod)} 
                                                                    className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <Pencil size={13} />
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => handleDeleteProducto(prod._id)} 
                                                                    className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pie de modal */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">
                                Synoptik Inteligencia Operativa
                            </span>
                            <button 
                                type="button" 
                                onClick={() => setActiveProdCategoryDetail(null)}
                                className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider shadow-lg transition-all"
                            >
                                Volver al Panel General
                            </button>
                        </div>
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

const InputField = ({ label, value, onChange, required = true, placeholder = '' }) => (
    <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
        <input 
            required={required} type="text" value={value} 
            placeholder={placeholder}
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
