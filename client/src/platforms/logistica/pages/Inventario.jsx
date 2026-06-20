import React, { useState, useEffect, useMemo } from 'react';
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
    X as XIcon,
    Lock,
    Unlock,
    Eye,
    Calendar,
    DollarSign,
    ShieldAlert,
    TrendingDown,
    Building2,
    Settings,
    FileText,
    Percent,
    LayoutGrid,
    Table,
    List as ListIcon
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import SmartSelect from '../components/SmartSelect';
import * as XLSX from 'xlsx';

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


const toSafeNumber = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const safeText = (value) => String(value || '').toLowerCase();

const formatCurrency = (value) => {
    const num = Number(value || 0);
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(num);
};

const Inventario = () => {
    // Listas principales
    const [stockReport, setStockReport] = useState([]);
    const [productos, setProductos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Navegación interna y filtros
    const [activeTab, setActiveTab] = useState('maestro'); // 'maestro' o 'stock'
    const [viewType, setViewType] = useState('tabla'); // 'tabla' | 'cuadricula' | 'lista'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos'); // 'Todos', 'Activo', 'Inactivo'
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [selectedAssetForDepreciation, setSelectedAssetForDepreciation] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Modales de control
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showQuickActionModal, setShowQuickActionModal] = useState(false);
    const [showCargaMasiva, setShowCargaMasiva] = useState(false);

    // Formulario de creación de Activos
    const [assetForm, setAssetForm] = useState({
        nombre: '',
        sku: '',
        ean: '',
        categoria: '',
        marca: '',
        modelo: '',
        nroSerie: '',
        imei: '',
        imei2: '',
        imei3: '',
        numeroCelular: '',
        descripcion: '',
        unidadMedida: 'Unidad',
        tipo: 'Activo',
        color: 'Genérico',
        segmentacion: 'Estándar',
        movilidad: 'Rotativo',
        propiedad: 'Propio',
        clienteRef: '',
        valorUnitario: 0,
        valorResidual: 0,
        vidaUtilMeses: 60,
        fechaAdquisicion: new Date().toISOString().split('T')[0],
        fotoUrl: ''
    });

    // Formulario de edición
    const [editingProduct, setEditingProduct] = useState(null);

    // Formulario de ingreso de existencias (Stock)
    const [stockForm, setStockForm] = useState({
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

    // Carga Masiva
    const [cargaMasivaItems, setCargaMasivaItems] = useState([{ productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]);
    const [almacenCarga, setAlmacenCarga] = useState('');

    // Acciones rápidas (Traspasos, Asignaciones, Mermas)
    const [quickActionForm, setQuickActionForm] = useState({
        tipo: 'ASIGNACION',
        productoRef: '',
        almacenOrigen: '',
        almacenDestino: '',
        cantidad: 1,
        estadoProducto: 'Nuevo',
        motivo: '',
        fotoUrl: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Hacemos llamadas optimizadas y con includeInactive=true para tener el control total del maestro
            const [stockRes, configRes] = await Promise.all([
                logisticaApi.get('/stock/reporte'),
                logisticaApi.get('/configuracion-maestra')
            ]);
            setStockReport(stockRes.data);
            setProductos(configRes.data.productos || []);
            setAlmacenes(configRes.data.almacenes || []);
            setCategorias(configRes.data.categorias || []);
            setClientes(configRes.data.clientes || []);

            // Actualizar la referencia del activo seleccionado para depreciación si existe
            if (selectedAssetForDepreciation) {
                const updated = (configRes.data.productos || []).find(p => p._id === selectedAssetForDepreciation._id);
                if (updated) setSelectedAssetForDepreciation(updated);
            }
        } catch (e) {
            console.error("Error al cargar la información consolidada de activos", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Crear Activo (Producto de tipo Activo)
    const handleCreateAsset = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...assetForm,
                clienteRef: assetForm.propiedad === 'Cliente' ? (assetForm.clienteRef || null) : null,
                fotos: assetForm.fotoUrl ? [assetForm.fotoUrl] : []
            };
            await logisticaApi.post('/productos', payload);
            setShowCreateModal(false);
            // Reset form
            setAssetForm({
                nombre: '',
                sku: '',
                ean: '',
                categoria: '',
                marca: '',
                modelo: '',
                nroSerie: '',
                imei: '',
                imei2: '',
                imei3: '',
                numeroCelular: '',
                descripcion: '',
                unidadMedida: 'Unidad',
                tipo: 'Activo',
                color: 'Genérico',
                segmentacion: 'Estándar',
                movilidad: 'Rotativo',
                propiedad: 'Propio',
                clienteRef: '',
                valorUnitario: 0,
                valorResidual: 0,
                vidaUtilMeses: 60,
                fechaAdquisicion: new Date().toISOString().split('T')[0],
                fotoUrl: ''
            });
            await fetchData();
            alert("Activo registrado con éxito en el Maestro.");
        } catch (err) {
            alert("Error al registrar activo: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Editar Activo
    const handleEditProduct = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...editingProduct,
                clienteRef: editingProduct.propiedad === 'Cliente' ? (editingProduct.clienteRef || null) : null,
                fotos: editingProduct.fotoUrl ? [editingProduct.fotoUrl] : (editingProduct.fotos || [])
            };
            await logisticaApi.put(`/productos/${editingProduct._id}`, payload);
            setShowEditModal(false);
            await fetchData();
            alert("Activo actualizado con éxito.");
        } catch (err) {
            alert("Error al actualizar activo: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Cambiar Bloqueo/Desbloqueo (Status)
    const handleToggleBlock = async (producto) => {
        const nextStatus = producto.status === 'Inactivo' ? 'Activo' : 'Inactivo';
        const actionText = nextStatus === 'Inactivo' ? 'BLOQUEAR (Desactivar de operaciones)' : 'DESBLOQUEAR (Activar para operaciones)';
        
        if (!window.confirm(`¿Estás seguro de que deseas ${actionText} el activo "${producto.nombre}"?`)) return;
        
        setSaving(true);
        try {
            await logisticaApi.put(`/productos/${producto._id}`, {
                ...producto,
                status: nextStatus
            });
            await fetchData();
            alert(`El activo fue ${nextStatus === 'Inactivo' ? 'bloqueado' : 'desbloqueado'} exitosamente.`);
        } catch (err) {
            alert("Error al cambiar estado de bloqueo: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Eliminar Activo
    const handleDeleteProduct = async (producto) => {
        if (!producto?._id) return;
        if (!window.confirm(`¿Eliminar definitivamente el activo "${producto.nombre}"? Esta acción removerá el registro del catálogo maestro y no se puede deshacer.`)) return;

        setSaving(true);
        try {
            await logisticaApi.delete(`/productos/${producto._id}`);
            if (editingProduct?._id === producto._id) {
                setShowEditModal(false);
                setEditingProduct(null);
            }
            if (selectedAssetForDepreciation?._id === producto._id) {
                setSelectedAssetForDepreciation(null);
            }
            await fetchData();
            alert('Activo eliminado correctamente del Maestro.');
        } catch (err) {
            alert("Error al eliminar el activo: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Ingresar existencias de Stock manuales
    const handleIngresoStock = async (e) => {
        e.preventDefault();
        
        // Validar si el activo seleccionado está bloqueado
        const selectedAsset = productos.find(p => p._id === stockForm.productoRef);
        if (selectedAsset && selectedAsset.status === 'Inactivo') {
            alert(`El activo "${selectedAsset.nombre}" está bloqueado. Desbloquéalo en el Maestro de Activos para permitir ingresos de stock.`);
            return;
        }

        setSaving(true);
        try {
            await logisticaApi.post('/movimientos', {
                ...stockForm,
                tipo: 'ENTRADA'
            });
            setShowQuickActionModal(false); // en caso que se use el mismo handler
            setStockForm({ productoRef: '', almacenDestino: '', cantidad: 1, estadoProducto: 'Nuevo', motivo: 'Carga Inicial / Compra', documentoReferencia: '', modelo: '', serie: '', fotoUrl: '' });
            await fetchData();
            alert("Ingreso de existencias registrado exitosamente.");
        } catch (err) {
            alert("Error al registrar ingreso: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Procesar acción rápida (Asignación, Traspaso, Merma)
    const handleQuickAction = async (e) => {
        e.preventDefault();
        
        // Validar activo bloqueado
        const selectedAsset = productos.find(p => p._id === quickActionForm.productoRef);
        if (selectedAsset && selectedAsset.status === 'Inactivo') {
            alert(`El activo "${selectedAsset.nombre}" está bloqueado y no puede realizar movimientos de stock.`);
            return;
        }

        setSaving(true);
        try {
            await logisticaApi.post('/movimientos', quickActionForm);
            setShowQuickActionModal(false);
            await fetchData();
            alert("Movimiento de stock registrado y valorizado con éxito.");
        } catch (err) {
            alert("Error al procesar el movimiento: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // Carga Masiva Inicial
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
            await fetchData();
            alert("Carga inicial de patrimonio completada con éxito.");
        } catch (err) {
            alert("Error en la carga masiva: " + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    // EXPORTAR TODO A EXCEL (Multi-pestaña Premium)
    const exportToExcel = () => {
        try {
            // 1. Hoja 1: Maestro
            const dataMaestro = filteredAssets.map(p => {
                const isBlocked = p.status === 'Inactivo';
                const stockItems = stockReport.filter(s => s.productoRef?._id === p._id || s.productoRef === p._id);
                const totalStock = stockItems.reduce((acc, curr) => acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0), 0);
                const stockAsignado = stockItems.reduce((acc, curr) => {
                    const esAsignado = curr.almacenRef?.tipo === 'Móvil' || curr.almacenRef?.tipo === 'Técnico' || Boolean(curr.almacenRef?.tecnicoRef);
                    return esAsignado ? acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0) : acc;
                }, 0);
                const stockDisponible = totalStock - stockAsignado;

                // Depreciación
                const unitPrice = p.valorUnitario || 0;
                const lifeMonths = p.vidaUtilMeses || 60;
                const resVal = p.valorResidual || 0;
                let depAcum = 0;
                if (unitPrice > resVal && p.fechaAdquisicion) {
                    const hoy = new Date();
                    const fechaAdq = new Date(p.fechaAdquisicion);
                    const mesesTrans = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
                    if (mesesTrans > 0) {
                        if (mesesTrans >= lifeMonths) {
                            depAcum = unitPrice - resVal;
                        } else {
                            const depMensual = (unitPrice - resVal) / lifeMonths;
                            depAcum = Math.round(depMensual * mesesTrans);
                        }
                    }
                }
                const valLibro = unitPrice - depAcum;

                return {
                    'SKU': p.sku || '',
                    'EAN': p.ean || '',
                    'Categoría': p.categoria?.nombre || 'Sin Categoría',
                    'Nombre': p.nombre || '',
                    'Color': p.color || 'Genérico',
                    'Marca': p.marca || '',
                    'Modelo': p.modelo || '',
                    'Nro. Serie': p.nroSerie || '',
                    'IMEI': p.imei || '',
                    'IMEI 2': p.imei2 || '',
                    'IMEI 3': p.imei3 || '',
                    'Descripción': p.descripcion || '',
                    'Unidad de Medida': p.unidadMedida || 'Unidad',
                    'Stock Total': totalStock,
                    'Asignado': stockAsignado,
                    'Disponible': stockDisponible,
                    'Segmentación': p.segmentacion || 'Estándar',
                    'Movilidad': p.movilidad || 'Rotativo',
                    'Propiedad': p.propiedad || 'Propio',
                    'Cliente Dueño': p.clienteRef?.nombre || '',
                    'Valor Unitario (CLP)': unitPrice,
                    'Valor Residual (CLP)': resVal,
                    'Depreciación Acumulada (CLP)': depAcum,
                    'Valor en Libros (CLP)': valLibro,
                    'Fecha Adquisición': p.fechaAdquisicion ? p.fechaAdquisicion.split('T')[0] : '',
                    'Estado': isBlocked ? 'Bloqueado' : 'Activo'
                };
            });

            // 2. Hoja 2: Existencias en Bodegas
            const dataStock = filteredStock.map(s => {
                const totalCant = (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0) + (s.cantidadUsadoMalo || 0) + (s.cantidadMerma || 0);
                return {
                    'Bodega / Almacén': s.almacenRef?.nombre || 'Desconocido',
                    'Tipo Bodega': s.almacenRef?.tipo || '',
                    'SKU Activo': s.productoRef?.sku || '',
                    'Nombre Activo': s.productoRef?.nombre || '',
                    'Color Activo': s.productoRef?.color || 'Genérico',
                    'Categoría': s.productoRef?.categoria?.nombre || '',
                    'Marca': s.productoRef?.marca || '',
                    'Modelo': s.productoRef?.modelo || '',
                    'Unidades Nuevas': s.cantidadNuevo || 0,
                    'Unidades Usado Bueno': s.cantidadUsadoBueno || 0,
                    'Unidades Usado Malo': s.cantidadUsadoMalo || 0,
                    'Unidades Merma': s.cantidadMerma || 0,
                    'Cantidad Total': totalCant
                };
            });

            const wb = XLSX.utils.book_new();
            const wsMaestro = XLSX.utils.json_to_sheet(dataMaestro);
            const wsStock = XLSX.utils.json_to_sheet(dataStock);

            XLSX.utils.book_append_sheet(wb, wsMaestro, "Existencia General");
            XLSX.utils.book_append_sheet(wb, wsStock, "Existencias en Bodegas");

            XLSX.writeFile(wb, "Existencia_General_y_Patrimonio_360.xlsx");
        } catch (error) {
            console.error("Error al exportar a Excel:", error);
            alert("Ocurrió un error al exportar a Excel: " + error.message);
        }
    };

    // DESCARGAR PLANTILLA EXCEL
    const descargarPlantillaExcel = () => {
        try {
            const ejemploProductos = productos.slice(0, 2);
            const templateData = [
                {
                    'SKU_PRODUCTO': ejemploProductos[0]?.sku || 'SKU-EJEMPLO-1',
                    'NOMBRE_REFERENCIA': ejemploProductos[0]?.nombre || 'Artículo de Ejemplo 1',
                    'CANTIDAD': 10,
                    'ESTADO_FISICO': 'Nuevo'
                },
                {
                    'SKU_PRODUCTO': ejemploProductos[1]?.sku || 'SKU-EJEMPLO-2',
                    'NOMBRE_REFERENCIA': ejemploProductos[1]?.nombre || 'Artículo de Ejemplo 2',
                    'CANTIDAD': 5,
                    'ESTADO_FISICO': 'Usado Bueno'
                }
            ];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(templateData);
            
            const instrucciones = [
                { 'Instrucción / Regla': '1. La columna SKU_PRODUCTO es obligatoria y debe coincidir exactamente con el SKU del catálogo maestro.' },
                { 'Instrucción / Regla': '2. La columna CANTIDAD debe ser un número entero mayor a 0.' },
                { 'Instrucción / Regla': '3. La columna ESTADO_FISICO debe ser uno de los siguientes valores: Nuevo, Usado Bueno, Usado Malo, Merma.' },
                { 'Instrucción / Regla': '4. La columna NOMBRE_REFERENCIA es opcional y solo sirve como guía de lectura.' }
            ];
            const wsInstrucciones = XLSX.utils.json_to_sheet(instrucciones);

            const opcionProductos = (productos || []).map(p => ({
                'SKU Maestro': p.sku || '',
                'Nombre del Producto': p.nombre || '',
                'Categoría': typeof p.categoria === 'object' ? (p.categoria?.nombre || '') : String(p.categoria || '')
            }));
            const wsProductos = XLSX.utils.json_to_sheet(opcionProductos);

            const opcionEstados = [
                { 'Estados Físicos Aceptados': 'Nuevo' },
                { 'Estados Físicos Aceptados': 'Usado Bueno' },
                { 'Estados Físicos Aceptados': 'Usado Malo' },
                { 'Estados Físicos Aceptados': 'Merma' }
            ];
            const wsEstados = XLSX.utils.json_to_sheet(opcionEstados);

            XLSX.utils.book_append_sheet(wb, ws, "Plantilla de Carga");
            XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones de Uso");
            if (opcionProductos.length > 0) {
                XLSX.utils.book_append_sheet(wb, wsProductos, "Productos Disponibles");
            }
            XLSX.utils.book_append_sheet(wb, wsEstados, "Estados Aceptados");

            XLSX.writeFile(wb, "Plantilla_Carga_Inicial_Existencias.xlsx");
        } catch (error) {
            alert("Error al descargar la plantilla: " + error.message);
        }
    };

    // LEER E IMPORTAR EXCEL
    const handleExcelImport = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Leer la primera hoja
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert("El archivo Excel está vacío o no tiene el formato correcto.");
                    return;
                }

                const nuevosItems = [];
                let noEncontrados = 0;

                jsonData.forEach((row) => {
                    const sku = String(row.SKU_PRODUCTO || row.sku || row.Sku || row.SKU || '').trim();
                    const cantidad = Number(row.CANTIDAD || row.cantidad || row.Cantidad || 1);
                    let estado = String(row.ESTADO_FISICO || row.estado || row.Estado || 'Nuevo').trim();

                    // Normalizar estado
                    if (estado.toLowerCase() === 'nuevo') estado = 'Nuevo';
                    else if (estado.toLowerCase() === 'usado bueno' || estado.toLowerCase() === 'bueno' || estado.toLowerCase() === 'usado_bueno') estado = 'Usado Bueno';
                    else if (estado.toLowerCase() === 'usado malo' || estado.toLowerCase() === 'malo' || estado.toLowerCase() === 'usado_malo') estado = 'Usado Malo';
                    else estado = 'Nuevo';

                    if (!sku) return;

                    // Buscar el producto en la lista
                    const match = productos.find(p => String(p.sku || '').trim() === sku);
                    if (match) {
                        nuevosItems.push({
                            productoRef: match._id,
                            cantidad: Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 1,
                            estadoProducto: estado
                        });
                    } else {
                        noEncontrados++;
                    }
                });

                if (nuevosItems.length > 0) {
                    setCargaMasivaItems(nuevosItems);
                    let msg = `¡Plantilla Excel leída con éxito! Se cargaron ${nuevosItems.length} ítems.`;
                    if (noEncontrados > 0) {
                        msg += ` (${noEncontrados} productos no se agregaron porque su SKU no existe en el catálogo maestro).`;
                    }
                    alert(msg);
                } else {
                    alert("No se pudo cargar ningún ítem válido. Asegúrate de que los SKU coincidan con el catálogo maestro.");
                }
            } catch (err) {
                console.error(err);
                alert("Error al leer el archivo Excel: " + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        // Limpiar input para permitir subir el mismo archivo otra vez
        e.target.value = '';
    };

    const addCargaItem = () => setCargaMasivaItems([...cargaMasivaItems, { productoRef: '', cantidad: 1, estadoProducto: 'Nuevo' }]);
    const updateCargaItem = (idx, field, val) => {
        const next = [...cargaMasivaItems];
        next[idx][field] = val;
        setCargaMasivaItems(next);
    };

    const openQuickAction = (item, tipo) => {
        if (!item?.productoRef?._id || !item?.almacenRef?._id) {
            alert('No se puede ejecutar la acción: falta la referencia de activo o bodega.');
            return;
        }

        if (item.productoRef?.status === 'Inactivo') {
            alert(`El activo "${item.productoRef.nombre}" está bloqueado por administración. Desbloquéalo en el catálogo maestro para operar.`);
            return;
        }

        setQuickActionForm({
            tipo,
            productoRef: item.productoRef._id,
            almacenOrigen: item.almacenRef._id,
            almacenDestino: '',
            cantidad: 1,
            estadoProducto: 'Nuevo',
            motivo: tipo === 'MERMA' ? 'Equipo Dañado o Falla Operacional' : '',
            fotoUrl: ''
        });
        setShowQuickActionModal(true);
    };

    const openEditProduct = (prod) => {
        setEditingProduct({
            ...prod,
            nombre: prod.nombre || '',
            sku: prod.sku || '',
            ean: prod.ean || '',
            categoria: prod.categoria?._id || prod.categoria || '',
            marca: prod.marca || '',
            modelo: prod.modelo || '',
            nroSerie: prod.nroSerie || '',
            imei: prod.imei || '',
            imei2: prod.imei2 || '',
            imei3: prod.imei3 || '',
            numeroCelular: prod.numeroCelular || '',
            clienteRef: prod.clienteRef?._id || prod.clienteRef || '',
            fechaAdquisicion: prod.fechaAdquisicion ? new Date(prod.fechaAdquisicion).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            fotoUrl: prod.fotos?.[0] || ''
        });
        setShowEditModal(true);
    };

    // --- FILTRADOS ---
    // Filtrado de Activos (Maestro)
    const filteredAssets = useMemo(() => {
        return productos.filter(p => {
            const sLower = searchTerm.toLowerCase();
            const matchesSearch = safeText(p.nombre).includes(sLower) || 
                                  safeText(p.sku).includes(sLower) || 
                                  safeText(p.marca).includes(sLower) || 
                                  safeText(p.modelo).includes(sLower) ||
                                  safeText(p.color).includes(sLower);
            
            const matchesCategory = categoryFilter === 'Todos' || p.categoria?._id === categoryFilter || p.categoria === categoryFilter;
            const matchesStatus = statusFilter === 'Todos' || 
                                  (statusFilter === 'Activo' && p.status !== 'Inactivo') || 
                                  (statusFilter === 'Inactivo' && p.status === 'Inactivo');

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [productos, searchTerm, categoryFilter, statusFilter]);

    // Ordenamiento
    const sortedAssets = useMemo(() => {
        let sortableItems = [...filteredAssets];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];
                
                if (sortConfig.key.includes('.')) {
                    const keys = sortConfig.key.split('.');
                    valA = a[keys[0]] ? a[keys[0]][keys[1]] : '';
                    valB = b[keys[0]] ? b[keys[0]][keys[1]] : '';
                }

                valA = typeof valA === 'string' ? valA.toLowerCase() : valA;
                valB = typeof valB === 'string' ? valB.toLowerCase() : valB;

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredAssets, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // Filtrado de Existencias en Bodegas
    const filteredStock = useMemo(() => {
        return stockReport.filter(s => {
            const sLower = searchTerm.toLowerCase();
            const matchesSearch = safeText(s.productoRef?.nombre).includes(sLower) ||
                                  safeText(s.productoRef?.sku).includes(sLower) ||
                                  safeText(s.productoRef?.marca).includes(sLower) ||
                                  safeText(s.productoRef?.modelo).includes(sLower) ||
                                  safeText(s.productoRef?.color).includes(sLower) ||
                                  safeText(s.almacenRef?.nombre).includes(sLower) ||
                                  safeText(s.almacenRef?.codigo).includes(sLower);
            
            const matchesCategory = categoryFilter === 'Todos' || s.productoRef?.categoria?._id === categoryFilter || s.productoRef?.categoria === categoryFilter;
            // No aplica estatus inactivo a la bodega directa salvo que lo filtremos
            const matchesStatus = statusFilter === 'Todos' || 
                                  (statusFilter === 'Activo' && s.productoRef?.status !== 'Inactivo') || 
                                  (statusFilter === 'Inactivo' && s.productoRef?.status === 'Inactivo');

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [stockReport, searchTerm, categoryFilter, statusFilter]);

    // --- CÁLCULOS DE PATRIMONIO Y DEPRECIACIÓN EN TIEMPO REAL ---
    const metrics = useMemo(() => {
        let totalAdquisicionStock = 0;
        let totalLibroActualStock = 0;
        let totalDepreciacionAcumuladaStock = 0;
        let totalCriticos = 0;
        let totalBloqueados = 0;

        // Iterar en stock reporte
        stockReport.forEach(s => {
            const totalStock = (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0) + (s.cantidadUsadoMalo || 0) + (s.cantidadMerma || 0);
            if (totalStock <= 0) return;

            const unitPrice = s.productoRef?.valorUnitario || 0;
            const lifeMonths = s.productoRef?.vidaUtilMeses || 60;
            const resVal = s.productoRef?.valorResidual || 0;
            
            // Depreciación en línea recta virtual
            let depAcumUnidad = 0;
            if (s.productoRef?.tipo === 'Activo' && unitPrice > resVal && s.productoRef?.fechaAdquisicion) {
                const hoy = new Date();
                const fechaAdq = new Date(s.productoRef.fechaAdquisicion);
                const mesesTrans = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
                
                if (mesesTrans > 0) {
                    if (mesesTrans >= lifeMonths) {
                        depAcumUnidad = unitPrice - resVal;
                    } else {
                        const depMensual = (unitPrice - resVal) / lifeMonths;
                        depAcumUnidad = Math.round(depMensual * mesesTrans);
                    }
                }
            }

            const valLibroUnidad = unitPrice - depAcumUnidad;

            totalAdquisicionStock += totalStock * unitPrice;
            totalLibroActualStock += totalStock * valLibroUnidad;
            totalDepreciacionAcumuladaStock += totalStock * depAcumUnidad;

            if (s.productoRef?.segmentacion === 'Crítico') {
                totalCriticos += totalStock;
            }
        });

        // Contar productos bloqueados en el maestro
        productos.forEach(p => {
            if (p.status === 'Inactivo') totalBloqueados++;
        });

        return {
            totalAdquisicionStock,
            totalLibroActualStock,
            totalDepreciacionAcumuladaStock,
            totalCriticos,
            totalBloqueados
        };
    }, [stockReport, productos]);

    // Detalle de depreciación de un activo seleccionado
    const assetDepreciationDetails = useMemo(() => {
        if (!selectedAssetForDepreciation) return null;
        const p = selectedAssetForDepreciation;
        const valor = p.valorUnitario || 0;
        const residual = p.valorResidual || 0;
        const vidaUtil = p.vidaUtilMeses || 60;
        const baseDepreciable = valor - residual;
        
        let mesesTranscurridos = 0;
        if (p.fechaAdquisicion) {
            const hoy = new Date();
            const fechaAdq = new Date(p.fechaAdquisicion);
            mesesTranscurridos = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
            if (mesesTranscurridos < 0) mesesTranscurridos = 0;
        }

        const mesesRestantes = Math.max(0, vidaUtil - mesesTranscurridos);
        const mensualidad = vidaUtil > 0 ? baseDepreciable / vidaUtil : 0;
        
        let acumulada = 0;
        if (mesesTranscurridos > 0) {
            if (mesesTranscurridos >= vidaUtil) {
                acumulada = baseDepreciable;
            } else {
                acumulada = Math.round(mensualidad * mesesTranscurridos);
            }
        }

        const valorLibro = valor - acumulada;
        const porcentajeDepreciado = baseDepreciable > 0 ? Math.round((acumulada / baseDepreciable) * 100) : 0;

        return {
            valor,
            residual,
            baseDepreciable,
            vidaUtil,
            mesesTranscurridos,
            mesesRestantes,
            mensualidad,
            acumulada,
            valorLibro,
            porcentajeDepreciado,
            fechaAdq: p.fechaAdquisicion ? new Date(p.fechaAdquisicion).toLocaleDateString('es-CL') : 'No registrada'
        };
    }, [selectedAssetForDepreciation]);

    // Filtrar productos activos para los selects operacionales
    const activeProductsForSelect = useMemo(() => {
        return productos.filter(p => p.status !== 'Inactivo');
    }, [productos]);

    return (
        <div className="page-sm space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full overflow-x-hidden relative">
            
            {/* Cabecera Inteligente */}
            <div className="page-header flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
                <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-3">
                        <span className="bg-sky-500/20 text-sky-400 p-2 rounded-2xl border border-sky-500/30">
                            <Archive size={24} />
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">EXISTENCIA GENERAL</h1>
                    </div>
                    <p className="text-slate-400 text-sm max-w-xl">
                        Módulo de control de existencias, valorización en tiempo real, depreciación acumulada y restricciones operacionales avanzadas.
                    </p>
                </div>
                <div className="relative z-10 flex gap-2 flex-wrap sm:flex-nowrap">
                    <button 
                        onClick={exportToExcel}
                        className="px-5 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/20 border border-indigo-500/30 active:scale-95"
                    >
                        <FileSpreadsheet size={16} />
                        Exportar Excel
                    </button>
                    <button 
                        onClick={() => setShowCargaMasiva(true)}
                        className="px-5 py-3 bg-emerald-600/90 text-white rounded-2xl hover:bg-emerald-700 transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 border border-emerald-500/30 active:scale-95"
                    >
                        <Database size={16} />
                        Carga Inicial Patrimonio
                    </button>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="px-5 py-3 bg-white text-slate-900 rounded-2xl hover:bg-slate-100 transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl active:scale-95"
                    >
                        <Plus size={16} />
                        Registrar Existencia
                    </button>
                </div>
            </div>

            {/* Panel de Estadísticas y Valorización 360 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Patrimonio Total Adquirido */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Patrimonio Adquirido</span>
                        <span className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                            <DollarSign size={18} />
                        </span>
                    </div>
                    <div className="mt-4">
                        <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.totalAdquisicionStock)}</p>
                        <span className="text-[10px] font-bold text-slate-400">Total costo de adquisición en stock</span>
                    </div>
                </div>

                {/* Valor Neto en Libros */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Valor en Libros Actual</span>
                        <span className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                            <Percent size={18} />
                        </span>
                    </div>
                    <div className="mt-4">
                        <p className="text-2xl font-black text-emerald-600 tracking-tight">{formatCurrency(metrics.totalLibroActualStock)}</p>
                        <span className="text-[10px] font-bold text-slate-400">Valor patrimonial neto amortizado</span>
                    </div>
                </div>

                {/* Depreciación Acumulada */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Depreciación Acumulada</span>
                        <span className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 transition-colors group-hover:bg-rose-600 group-hover:text-white">
                            <TrendingDown size={18} />
                        </span>
                    </div>
                    <div className="mt-4">
                        <p className="text-2xl font-black text-rose-500 tracking-tight">-{formatCurrency(metrics.totalDepreciacionAcumuladaStock)}</p>
                        <span className="text-[10px] font-bold text-slate-400">Pérdida de valor acumulada total</span>
                    </div>
                </div>

                {/* Activos Bloqueados / Críticos */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 flex flex-col justify-between group">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Operación & Control</span>
                        <span className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 transition-colors group-hover:bg-amber-600 group-hover:text-white">
                            <Lock size={18} />
                        </span>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-slate-900 tracking-tight">{metrics.totalBloqueados}</p>
                            <span className="text-xs font-bold text-slate-400">Bloqueados</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">De un total de {productos.length} existencias generales</span>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros y Control de Pestañas */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                
                {/* Selector de Pestaña Principal (Doble Pestaña Avanzada) */}
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full lg:w-auto">
                    <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-full sm:w-auto">
                        <button 
                            onClick={() => { setActiveTab('maestro'); setSelectedAssetForDepreciation(null); }}
                            className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                                activeTab === 'maestro' ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Archive size={14} />
                            Maestro Existencia General ({filteredAssets.length})
                        </button>
                        <button 
                            onClick={() => { setActiveTab('stock'); setSelectedAssetForDepreciation(null); }}
                            className={`flex-1 lg:flex-none px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                                activeTab === 'stock' ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Package size={14} />
                            Existencias en Bodega ({filteredStock.length})
                        </button>
                    </div>

                    {activeTab === 'maestro' && (
                        <div className="flex bg-slate-150 p-1 rounded-2xl border border-slate-100 bg-slate-100/80">
                            <button
                                type="button"
                                onClick={() => setViewType('tabla')}
                                title="Vista Planilla Completa"
                                className={`p-2.5 rounded-xl transition-all duration-200 ${
                                    viewType === 'tabla' 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <Table size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewType('cuadricula')}
                                title="Vista Cuadrícula / Tarjetas"
                                className={`p-2.5 rounded-xl transition-all duration-200 ${
                                    viewType === 'cuadricula' 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <LayoutGrid size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewType('lista')}
                                title="Vista Lista Resumida"
                                className={`p-2.5 rounded-xl transition-all duration-200 ${
                                    viewType === 'lista' 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <ListIcon size={15} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Filtros de Tabla en Tiempo Real */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto flex-1 max-w-3xl">
                    
                    {/* Búsqueda */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar por SKU, Nombre, Marca..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 text-slate-700 placeholder-slate-400 border-none rounded-2xl focus:ring-2 focus:ring-slate-900/10 transition-all text-xs font-bold outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Categoría */}
                    <div>
                        <select 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all text-xs font-bold appearance-none outline-none border-none"
                        >
                            <option value="Todos">Todas las Categorías</option>
                            {categorias.map(c => (
                                <option key={c._id} value={c._id}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Estado de Operación (Bloqueado / Activo) */}
                    <div>
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition-all text-xs font-bold appearance-none outline-none border-none"
                        >
                            <option value="Todos">Todos los Estados</option>
                            <option value="Activo">Activos / Operativos</option>
                            <option value="Inactivo">Bloqueados</option>
                        </select>
                    </div>

                </div>
            </div>

            {/* Cuerpo del Módulo Principal con Panel de Depreciación Lateral si aplica */}
            <div className="flex flex-col xl:flex-row gap-6 items-start w-full">
                
                {activeTab === 'maestro' && viewType === 'cuadricula' ? (
                    /* ─── VISTA CUADRÍCULA / TARJETAS ─── */
                    <div className={`w-full transition-all duration-300 ${selectedAssetForDepreciation ? 'xl:w-2/3' : 'w-full'}`}>
                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className="bg-white rounded-3xl p-6 h-80 border border-slate-100 shadow-sm" />
                                ))}
                            </div>
                        ) : filteredAssets.length === 0 ? (
                            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-20 text-center text-slate-400 font-bold w-full">
                                <Archive size={48} className="mx-auto mb-4 opacity-25" />
                                Sin activos registrados en el catálogo maestro
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredAssets.map((p) => {
                                    const isBlocked = p.status === 'Inactivo';
                                    
                                    // Calcular stock consolidado
                                    const stockItems = stockReport.filter(s => s.productoRef?._id === p._id || s.productoRef === p._id);
                                    const totalStock = stockItems.reduce((acc, curr) => acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0), 0);
                                    const stockAsignado = stockItems.reduce((acc, curr) => {
                                        const esAsignado = curr.almacenRef?.tipo === 'Móvil' || curr.almacenRef?.tipo === 'Técnico' || Boolean(curr.almacenRef?.tecnicoRef);
                                        return esAsignado ? acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0) : acc;
                                    }, 0);
                                    const stockDisponible = totalStock - stockAsignado;

                                    // Calcular depreciación
                                    const unitPrice = p.valorUnitario || 0;
                                    const lifeMonths = p.vidaUtilMeses || 60;
                                    const resVal = p.valorResidual || 0;
                                    let depAcum = 0;
                                    if (unitPrice > resVal && p.fechaAdquisicion) {
                                        const hoy = new Date();
                                        const fechaAdq = new Date(p.fechaAdquisicion);
                                        const mesesTrans = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
                                        if (mesesTrans > 0) {
                                            if (mesesTrans >= lifeMonths) {
                                                depAcum = unitPrice - resVal;
                                            } else {
                                                depAcum = Math.round(((unitPrice - resVal) / lifeMonths) * mesesTrans);
                                            }
                                        }
                                    }
                                    const valLibro = unitPrice - depAcum;
                                    const pctDep = unitPrice > 0 ? Math.min(100, Math.round((depAcum / (unitPrice - resVal || 1)) * 100)) : 0;

                                    return (
                                        <div key={p._id} className={`group bg-white rounded-3xl border transition-all duration-300 hover:shadow-xl p-6 flex flex-col justify-between relative overflow-hidden ${
                                            isBlocked ? 'border-slate-100 bg-slate-50/20' : 
                                            selectedAssetForDepreciation?._id === p._id ? 'border-indigo-650 shadow-md shadow-indigo-100' : 'border-slate-105'
                                        }`}>
                                            <div>
                                                {/* Header de Tarjeta */}
                                                <div className="flex items-center justify-between gap-2 mb-4">
                                                    <span className="text-[9px] font-black text-sky-650 bg-sky-50 px-2.5 py-1 rounded-xl border border-sky-100 uppercase tracking-wider">
                                                        {p.categoria?.nombre || 'General'}
                                                    </span>
                                                    {isBlocked ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-black uppercase">
                                                            <Lock size={10} />
                                                            Bloqueado
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase">
                                                            <CheckCircle2 size={10} />
                                                            Operativo
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Imagen y Datos Principales */}
                                                <div className="flex gap-4 items-start mb-4">
                                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                                                        {p.fotos?.length > 0 ? (
                                                            <img src={p.fotos[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="IMG" />
                                                        ) : (
                                                            <Archive size={20} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="space-y-1 min-w-0">
                                                        <h3 className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors" title={p.nombre}>
                                                            {p.nombre}
                                                        </h3>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">
                                                            {p.marca || '—'} / {p.modelo || '—'}
                                                        </p>
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 tracking-wider">
                                                                {p.sku}
                                                            </span>
                                                            {p.ean && (
                                                                <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 tracking-wider">
                                                                    EAN: {p.ean}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Identificadores Especiales */}
                                                {(p.nroSerie || p.imei) && (
                                                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5 mb-4 text-[10px]">
                                                        {p.nroSerie && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-400 font-bold uppercase tracking-wider">Nro. Serie:</span>
                                                                <span className="font-mono font-black text-slate-700 uppercase bg-white border border-slate-100 px-1.5 py-0.5 rounded">{p.nroSerie}</span>
                                                            </div>
                                                        )}
                                                        {p.imei && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-400 font-bold uppercase tracking-wider">IMEI:</span>
                                                                <span className="font-mono font-black text-slate-700 uppercase bg-white border border-slate-100 px-1.5 py-0.5 rounded">{p.imei}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Indicadores de Existencias en Bodega */}
                                                <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/60 mb-4 text-center">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                                        <p className="text-xs font-black text-slate-800 mt-0.5">{totalStock}</p>
                                                    </div>
                                                    <div className="border-x border-slate-100">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Asig.</p>
                                                        <p className="text-xs font-black text-indigo-600 mt-0.5">{stockAsignado}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disp.</p>
                                                        <p className="text-xs font-black text-emerald-600 mt-0.5">{stockDisponible}</p>
                                                    </div>
                                                </div>

                                                {/* Contabilidad & Depreciación */}
                                                <div className="space-y-2 pt-1.5 border-t border-slate-100/60 mb-4">
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="text-slate-400 font-semibold">Valor Adq:</span>
                                                        <span className="text-slate-800 font-bold">{formatCurrency(p.valorUnitario)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[11px]">
                                                        <span className="text-slate-400 font-semibold">Valor Libro:</span>
                                                        <span className="text-indigo-650 font-black">{formatCurrency(valLibro)}</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                            <span>Depreciado</span>
                                                            <span>{pctDep}%</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                            <div 
                                                                className="bg-gradient-to-r from-emerald-500 to-indigo-600 h-full transition-all duration-500" 
                                                                style={{ width: `${pctDep}%` }} 
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Acciones de Tarjeta */}
                                            <div className="flex gap-1.5 pt-3 border-t border-slate-100/60 justify-end">
                                                <button 
                                                    type="button"
                                                    onClick={() => setSelectedAssetForDepreciation(p)}
                                                    className="flex-1 py-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-105 hover:text-slate-800 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Eye size={12} />
                                                    Dep.
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => openEditProduct(p)}
                                                    className="flex-1 py-2 rounded-xl bg-indigo-50 text-indigo-650 hover:bg-indigo-105 font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Edit3 size={12} />
                                                    Editar
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleToggleBlock(p)}
                                                    className={`px-3 py-2 rounded-xl transition-all ${
                                                        isBlocked ? 'bg-emerald-50 text-emerald-650 hover:bg-emerald-105' : 'bg-amber-50 text-amber-600 hover:bg-amber-105'
                                                    }`}
                                                >
                                                    {isBlocked ? <Unlock size={12} /> : <Lock size={12} />}
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeleteProduct(p)}
                                                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-105 transition-all"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* ─── VISTAS DE PLANILLA, LISTA COMPACTA O STOCK EN BODEGAS ─── */
                    <div className={`w-full bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden transition-all duration-300 ${
                        selectedAssetForDepreciation ? 'xl:w-2/3' : 'w-full'
                    }`}>
                        <div className="overflow-x-auto custom-scrollbar">
                            {activeTab === 'maestro' ? (
                                viewType === 'tabla' ? (
                                    <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/90 backdrop-blur-md sticky top-0 z-20 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 whitespace-nowrap shadow-sm">
                                    <tr>
                                        <th className="px-4 py-5 w-16">Item</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('sku')}>SKU {sortConfig.key === 'sku' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('ean')}>EAN {sortConfig.key === 'ean' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('categoria.nombre')}>Categoría {sortConfig.key === 'categoria.nombre' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 text-center">Imagen</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('nombre')}>Nombre {sortConfig.key === 'nombre' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('marca')}>Marca {sortConfig.key === 'marca' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('modelo')}>Modelo {sortConfig.key === 'modelo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('color')}>Color {sortConfig.key === 'color' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('nroSerie')}>Nro. Serie {sortConfig.key === 'nroSerie' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('imei')}>IMEI {sortConfig.key === 'imei' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('imei2')}>IMEI 2 {sortConfig.key === 'imei2' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('imei3')}>IMEI 3 {sortConfig.key === 'imei3' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('numeroCelular')}>Nro. Teléfono {sortConfig.key === 'numeroCelular' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5">Descripción</th>
                                        <th className="px-4 py-5 text-center cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('unidadMedida')}>Unidad {sortConfig.key === 'unidadMedida' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 text-center">Stock Total</th>
                                        <th className="px-4 py-5 text-center">Asignado</th>
                                        <th className="px-4 py-5 text-center">Disponible</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('segmentacion')}>Segmentación {sortConfig.key === 'segmentacion' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('movilidad')}>Movilidad {sortConfig.key === 'movilidad' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('propiedad')}>Propiedad {sortConfig.key === 'propiedad' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5">Cliente Dueño</th>
                                        <th className="px-4 py-5 text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('valorUnitario')}>Valor Unitario {sortConfig.key === 'valorUnitario' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 text-right">Valor Residual</th>
                                        <th className="px-4 py-5 text-center cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('fechaAdquisicion')}>Fecha Compra {sortConfig.key === 'fechaAdquisicion' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 text-center">Vida Útil (Meses)</th>
                                        <th className="px-4 py-5 text-right">Dep. Acumulada</th>
                                        <th className="px-4 py-5 text-right">Valor Libro</th>
                                        <th className="px-4 py-5 text-center cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('status')}>Estado {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                        <th className="px-4 py-5 text-right w-28">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1,2,3,4].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan="28" className="px-6 py-8" />
                                            </tr>
                                        ))
                                    ) : sortedAssets.length === 0 ? (
                                        <tr>
                                            <td colSpan="29" className="px-6 py-20 text-center text-slate-400 font-bold">
                                                <Archive size={48} className="mx-auto mb-4 opacity-25" />
                                                Sin activos registrados en el catálogo maestro
                                            </td>
                                        </tr>
                                    ) : sortedAssets.map((p, index) => {
                                        const isBlocked = p.status === 'Inactivo';
                                        
                                        // Calcular stock físico consolidado
                                        const stockItems = stockReport.filter(s => s.productoRef?._id === p._id || s.productoRef === p._id);
                                        const totalStock = stockItems.reduce((acc, curr) => acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0), 0);
 
                                        // Calcular stock asignado (bodegas tipo Móvil, Técnico o asignadas a técnico)
                                        const stockAsignado = stockItems.reduce((acc, curr) => {
                                            const esAsignado = curr.almacenRef?.tipo === 'Móvil' || curr.almacenRef?.tipo === 'Técnico' || Boolean(curr.almacenRef?.tecnicoRef);
                                            if (esAsignado) {
                                                return acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0);
                                            }
                                            return acc;
                                        }, 0);
 
                                        // Stock disponible: total menos asignados
                                        const stockDisponible = totalStock - stockAsignado;
 
                                        // Calcular depreciación virtual para el maestro
                                        const unitPrice = p.valorUnitario || 0;
                                        const lifeMonths = p.vidaUtilMeses || 60;
                                        const resVal = p.valorResidual || 0;
                                        
                                        let depAcum = 0;
                                        if (unitPrice > resVal && p.fechaAdquisicion) {
                                            const hoy = new Date();
                                            const fechaAdq = new Date(p.fechaAdquisicion);
                                            const mesesTrans = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
                                            
                                            if (mesesTrans > 0) {
                                                if (mesesTrans >= lifeMonths) {
                                                    depAcum = unitPrice - resVal;
                                                } else {
                                                    const depMensual = (unitPrice - resVal) / lifeMonths;
                                                    depAcum = Math.round(depMensual * mesesTrans);
                                                }
                                            }
                                        }
                                        const valLibro = unitPrice - depAcum;
 
                                        return (
                                            <tr key={p._id} className={`hover:bg-slate-50/50 transition-all group ${
                                                isBlocked ? 'bg-slate-50/30' : ''
                                            } ${selectedAssetForDepreciation?._id === p._id ? 'bg-indigo-50/20 border-l-4 border-l-indigo-600' : ''}`}>
                                                <td className="px-4 py-4 text-xs font-black text-slate-400">{index + 1}</td>
                                                {/* SKU */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tight bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                        {p.sku}
                                                    </span>
                                                </td>

                                                {/* EAN */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-[10px] font-mono font-semibold text-slate-400 tracking-tight bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                                                        {p.ean || '—'}
                                                    </span>
                                                </td>

                                                {/* Categoría */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-[9px] font-black text-sky-650 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100 uppercase">
                                                        {p.categoria?.nombre || 'General'}
                                                    </span>
                                                </td>

                                                {/* Imagen */}
                                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 mx-auto bg-slate-50 flex items-center justify-center shrink-0">
                                                        {p.fotos?.length > 0 ? (
                                                            <img src={p.fotos[0]} className="w-full h-full object-cover" alt="IMG" />
                                                        ) : (
                                                            <Archive size={16} className="text-slate-400" />
                                                        )}
                                                    </div>
                                                </td>



                                                 {/* Nombre */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-xs font-bold ${isBlocked ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                        {p.nombre}
                                                    </span>
                                                </td>

                                                {/* Marca */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-slate-650 uppercase">
                                                        {p.marca || '—'}
                                                    </span>
                                                </td>

                                                {/* Modelo */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-medium text-slate-650 uppercase">
                                                        {p.modelo || '—'}
                                                    </span>
                                                </td>

                                                 {/* Color */}
                                                 <td className="px-4 py-4 whitespace-nowrap">
                                                     <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 w-fit">
                                                         <span className="w-2.5 h-2.5 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: getColorHex(p.color), display: 'inline-block' }} />
                                                         <span className="text-xs font-black text-slate-700">{p.color || 'Genérico'}</span>
                                                     </div>
                                                 </td>

                                                 {/* Nro. Serie */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-mono font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg uppercase">
                                                        {p.nroSerie || '—'}
                                                    </span>
                                                </td>

                                                {/* IMEI */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-mono font-medium text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg uppercase">
                                                        {p.imei || '—'}
                                                    </span>
                                                </td>

                                                {/* IMEI 2 */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-lg uppercase ${p.imei2 ? 'text-slate-600 bg-slate-50 border border-slate-100' : 'text-slate-400 bg-transparent border-transparent'}`}>
                                                        {p.imei2 || '—'}
                                                    </span>
                                                </td>

                                                {/* IMEI 3 */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-lg uppercase ${p.imei3 ? 'text-slate-600 bg-slate-50 border border-slate-100' : 'text-slate-400 bg-transparent border-transparent'}`}>
                                                        {p.imei3 || '—'}
                                                    </span>
                                                </td>

                                                {/* Nro. Teléfono */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-lg uppercase ${
                                                        (p.categoria?.nombre?.toLowerCase().includes('chip') || p.categoria?.nombre?.toLowerCase().includes('celular') || p.numeroCelular)
                                                            ? 'text-slate-600 bg-slate-50 border border-slate-100'
                                                            : 'text-slate-400 bg-transparent border-transparent'
                                                    }`}>
                                                        {(p.categoria?.nombre?.toLowerCase().includes('chip') || p.categoria?.nombre?.toLowerCase().includes('celular') || p.numeroCelular) 
                                                            ? (p.numeroCelular || '—') 
                                                            : 'N/A'}
                                                    </span>
                                                </td>

                                                {/* Descripción */}
                                                <td className="px-4 py-4 max-w-[200px] truncate" title={p.descripcion || ''}>
                                                    <span className="text-xs font-medium text-slate-400 italic">
                                                        {p.descripcion || '—'}
                                                    </span>
                                                </td>

                                                {/* Unidad */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg uppercase">
                                                        {p.unidadMedida || 'Unidad'}
                                                    </span>
                                                </td>

                                                {/* Stock Total */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                                                        totalStock > 0 
                                                            ? 'bg-slate-900 text-white border-slate-950 shadow-sm font-black' 
                                                            : 'bg-slate-50 text-slate-400 border-slate-100 font-medium'
                                                    }`}>
                                                        {totalStock} {totalStock === 1 ? 'Ud' : 'Uds'}
                                                    </span>
                                                </td>

                                                {/* Asignado */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                                                        stockAsignado > 0 
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                                            : 'bg-slate-50 text-slate-400 border-slate-100 font-medium'
                                                    }`}>
                                                        {stockAsignado} {stockAsignado === 1 ? 'Ud' : 'Uds'}
                                                    </span>
                                                </td>

                                                {/* Disponible */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                                                        stockDisponible > 0 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-slate-50 text-slate-400 border-slate-100 font-medium'
                                                    }`}>
                                                        {stockDisponible} {stockDisponible === 1 ? 'Ud' : 'Uds'}
                                                    </span>
                                                </td>

                                                {/* Segmentación */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border ${
                                                        p.segmentacion === 'Crítico' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        p.segmentacion === 'Consumo' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                                        'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                    }`}>
                                                        {p.segmentacion || 'Estándar'}
                                                    </span>
                                                </td>

                                                {/* Movilidad */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-[9px] font-black uppercase bg-violet-50 text-violet-600 border border-violet-100 px-2.5 py-1 rounded-lg">
                                                        {p.movilidad || 'Rotativo'}
                                                    </span>
                                                </td>

                                                {/* Propiedad */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                                                        p.propiedad === 'Propio' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {p.propiedad || 'Propio'}
                                                    </span>
                                                </td>

                                                {/* Cliente Dueño */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-slate-650">
                                                        {p.propiedad === 'Propio' ? 'Empresa' : (p.clienteRef?.nombre || '—')}
                                                    </span>
                                                </td>

                                                {/* Valor Unitario */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-slate-800">
                                                    {formatCurrency(p.valorUnitario)}
                                                </td>

                                                {/* Valor Residual */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right text-slate-500 font-medium">
                                                    {formatCurrency(p.valorResidual)}
                                                </td>

                                                {/* Fecha Compra */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center text-slate-600 font-mono text-xs">
                                                    {p.fechaAdquisicion ? new Date(p.fechaAdquisicion).toLocaleDateString('es-CL') : '—'}
                                                </td>

                                                {/* Vida Útil (Meses) */}
                                                <td className="px-4 py-4 whitespace-nowrap text-center text-slate-600 font-bold text-xs">
                                                    {p.vidaUtilMeses || 60}
                                                </td>

                                                {/* Dep. Acumulada */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-rose-500">
                                                    -{formatCurrency(depAcum)}
                                                </td>

                                                {/* Valor Libro */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right font-black text-indigo-600">
                                                    {formatCurrency(valLibro)}
                                                </td>

                                                {/* Estado */}
                                                <td className="px-4 py-4 text-center whitespace-nowrap">
                                                    {isBlocked ? (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-black uppercase">
                                                            <Lock size={10} />
                                                            Bloqueado
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase">
                                                            <CheckCircle2 size={10} />
                                                            Operativo
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Acciones */}
                                                <td className="px-4 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setSelectedAssetForDepreciation(p)}
                                                            title="Ver Depreciación Real-time" 
                                                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-all"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => openEditProduct(p)}
                                                            title="Editar Datos" 
                                                            className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleToggleBlock(p)}
                                                            title={isBlocked ? "Desbloquear Activo" : "Bloquear Activo"} 
                                                            className={`p-1.5 rounded-lg transition-all ${
                                                                isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'
                                                            }`}
                                                        >
                                                            {isBlocked ? <Unlock size={14} /> : <Lock size={14} />}
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDeleteProduct(p)}
                                                            title="Eliminar Activo" 
                                                            className="p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>

                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            ) : (
                                /* ─── VISTA LISTA RESUMIDA ─── */
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100 whitespace-nowrap">
                                        <tr>
                                            <th className="px-6 py-5 w-20">Item</th>
                                            <th className="px-6 py-5">Activo / Categoría</th>
                                            <th className="px-4 py-5">SKU / EAN</th>
                                            <th className="px-4 py-5">Marca & Modelo</th>
                                            <th className="px-4 py-5">Identificadores</th>
                                            <th className="px-4 py-5 text-center">Stock (T / A / D)</th>
                                            <th className="px-4 py-5 text-right">Valor Libro</th>
                                            <th className="px-4 py-5 text-center">Estado</th>
                                            <th className="px-4 py-5 text-right w-28">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loading ? (
                                            [1,2,3,4].map(i => (
                                                <tr key={i} className="animate-pulse">
                                                    <td colSpan="9" className="px-6 py-8" />
                                                </tr>
                                            ))
                                        ) : filteredAssets.length === 0 ? (
                                            <tr>
                                                <td colSpan="9" className="px-6 py-20 text-center text-slate-400 font-bold">
                                                    <Archive size={48} className="mx-auto mb-4 opacity-25" />
                                                    Sin activos registrados en el catálogo maestro
                                                </td>
                                            </tr>
                                        ) : filteredAssets.map((p, index) => {
                                            const isBlocked = p.status === 'Inactivo';
                                            
                                            // Calcular stock consolidado
                                            const stockItems = stockReport.filter(s => s.productoRef?._id === p._id || s.productoRef === p._id);
                                            const totalStock = stockItems.reduce((acc, curr) => acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0), 0);
                                            const stockAsignado = stockItems.reduce((acc, curr) => {
                                                const esAsignado = curr.almacenRef?.tipo === 'Móvil' || curr.almacenRef?.tipo === 'Técnico' || Boolean(curr.almacenRef?.tecnicoRef);
                                                return esAsignado ? acc + (curr.cantidadNuevo || 0) + (curr.cantidadUsadoBueno || 0) + (curr.cantidadUsadoMalo || 0) + (curr.cantidadMerma || 0) : acc;
                                            }, 0);
                                            const stockDisponible = totalStock - stockAsignado;

                                            // Calcular depreciación
                                            const unitPrice = p.valorUnitario || 0;
                                            const lifeMonths = p.vidaUtilMeses || 60;
                                            const resVal = p.valorResidual || 0;
                                            let depAcum = 0;
                                            if (unitPrice > resVal && p.fechaAdquisicion) {
                                                const hoy = new Date();
                                                const fechaAdq = new Date(p.fechaAdquisicion);
                                                const mesesTrans = (hoy.getFullYear() - fechaAdq.getFullYear()) * 12 + (hoy.getMonth() - fechaAdq.getMonth());
                                                if (mesesTrans > 0) {
                                                    if (mesesTrans >= lifeMonths) {
                                                        depAcum = unitPrice - resVal;
                                                    } else {
                                                        depAcum = Math.round(((unitPrice - resVal) / lifeMonths) * mesesTrans);
                                                    }
                                                }
                                            }
                                            const valLibro = unitPrice - depAcum;

                                            return (
                                                <tr key={p._id} className={`hover:bg-slate-50/50 transition-all group ${
                                                    isBlocked ? 'bg-slate-50/30' : ''
                                                } ${selectedAssetForDepreciation?._id === p._id ? 'bg-indigo-50/20 border-l-4 border-l-indigo-600' : ''}`}>
                                                    <td className="px-6 py-4 text-xs font-black text-slate-400">{index + 1}</td>
                                                    {/* Activo / Categoría */}
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                                                                {p.fotos?.length > 0 ? (
                                                                    <img src={p.fotos[0]} className="w-full h-full object-cover" alt="IMG" />
                                                                ) : (
                                                                    <Archive size={14} className="text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div className="space-y-0.5">
                                                                <p className={`text-xs font-bold ${isBlocked ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                                    {p.nombre}
                                                                </p>
                                                                <span className="text-[9px] font-black text-sky-655 bg-sky-50 px-1.5 py-0.5 rounded uppercase">
                                                                    {p.categoria?.nombre || 'General'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* SKU / EAN */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tight bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 inline-block">
                                                                {p.sku}
                                                            </p>
                                                            {p.ean && (
                                                                <p className="text-[9px] font-mono font-bold text-slate-450 tracking-tight block">
                                                                    {p.ean}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Marca & Modelo */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="space-y-0.5">
                                                            <p className="text-xs font-bold text-slate-700 uppercase">{p.marca || '—'}</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className="text-[10px] font-medium text-slate-400 uppercase">{p.modelo || '—'}</p>
                                                                <span className="w-2 h-2 rounded-full border border-slate-200 shadow-sm shrink-0" style={{ backgroundColor: getColorHex(p.color), display: 'inline-block' }} title={`Color: ${p.color || 'Genérico'}`} />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Identificadores */}
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="space-y-0.5 text-[10px]">
                                                            {p.nroSerie && (
                                                                <p className="text-slate-500 font-medium">S/N: <span className="font-mono font-black text-slate-700 bg-slate-50 border border-slate-100 px-1 rounded">{p.nroSerie}</span></p>
                                                            )}
                                                            {p.imei && (
                                                                <p className="text-slate-500 font-medium">IMEI: <span className="font-mono font-black text-slate-700 bg-slate-50 border border-slate-100 px-1 rounded">{p.imei}</span></p>
                                                            )}
                                                            {!p.nroSerie && !p.imei && <span className="text-slate-300 italic">—</span>}
                                                        </div>
                                                    </td>

                                                    {/* Stock */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className="text-xs font-black text-slate-800" title="Stock Físico Consolidado">
                                                                {totalStock}
                                                            </span>
                                                            <span className="text-slate-300">/</span>
                                                            <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg" title="Stock Asignado">
                                                                {stockAsignado}A
                                                            </span>
                                                            <span className="text-slate-300">/</span>
                                                            <span className="text-[10px] font-black text-emerald-650 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg" title="Stock Disponible">
                                                                {stockDisponible}D
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Valor Libro */}
                                                    <td className="px-4 py-4 whitespace-nowrap text-right font-black text-indigo-650 text-xs">
                                                        {formatCurrency(valLibro)}
                                                    </td>

                                                    {/* Estado */}
                                                    <td className="px-4 py-4 text-center whitespace-nowrap">
                                                        {isBlocked ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-black uppercase">
                                                                Bloqueado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase">
                                                                Operativo
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Acciones */}
                                                    <td className="px-4 py-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                                            <button 
                                                                type="button"
                                                                onClick={() => setSelectedAssetForDepreciation(p)}
                                                                title="Ver Depreciación Real-time" 
                                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-all"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => openEditProduct(p)}
                                                                title="Editar Datos" 
                                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                                            >
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleBlock(p)}
                                                                title={isBlocked ? "Desbloquear Activo" : "Bloquear Activo"} 
                                                                className={`p-1.5 rounded-lg transition-all ${
                                                                    isBlocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'
                                                                }`}
                                                            >
                                                                {isBlocked ? <Unlock size={14} /> : <Lock size={14} />}
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleDeleteProduct(p)}
                                                                title="Eliminar Activo" 
                                                                className="p-1.5 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                                                >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        ) : (
                            
                            /* ─── TABLA EXISTENCIAS EN BODEGAS ─── */
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-5 w-20">Item</th>
                                        <th className="px-6 py-5">Activo / Bodega</th>
                                        <th className="px-6 py-5">Ubicación / Encargado</th>
                                        <th className="px-6 py-5 text-center">Estados Físicos Stock</th>
                                        <th className="px-6 py-5 text-right">Patrimonio Localizado</th>
                                        <th className="px-6 py-5 text-right w-24">Operaciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1,2,3,4].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan="6" className="px-6 py-8" />
                                            </tr>
                                        ))
                                    ) : filteredStock.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-bold">
                                                <Package size={48} className="mx-auto mb-4 opacity-25" />
                                                Sin existencias reportadas en bodegas o móviles
                                            </td>
                                        </tr>
                                    ) : filteredStock.map((s, index) => {
                                        const hasRefs = Boolean(s?.productoRef?._id && s?.almacenRef?._id);
                                        const isAssetBlocked = s.productoRef?.status === 'Inactivo';
                                        
                                        const totalStock = (s.cantidadNuevo || 0) + (s.cantidadUsadoBueno || 0) + (s.cantidadUsadoMalo || 0) + (s.cantidadMerma || 0);
                                        const unitPrice = s.productoRef?.valorUnitario || 0;
                                        const totalValue = totalStock * unitPrice;

                                        // Badge generator
                                        const getStockBadge = (cantidad, label) => {
                                            if (cantidad === 0) return null;
                                            let color = "bg-slate-50 text-slate-400";
                                            if (label === 'Nuevo') color = "bg-emerald-50 text-emerald-600 border border-emerald-100";
                                            if (label === 'Usado') color = "bg-amber-50 text-amber-600 border border-amber-100";
                                            if (label === 'Malo') color = "bg-rose-50 text-rose-600 border border-rose-100";
                                            if (label === 'Merma') color = "bg-slate-900 text-white";

                                            return (
                                                <div className={`px-2.5 py-1 rounded-xl flex flex-col items-center min-w-[65px] ${color}`}>
                                                    <span className="text-xs font-black leading-none">{cantidad}</span>
                                                    <span className="text-[8px] font-bold uppercase mt-0.5">{label}</span>
                                                </div>
                                            );
                                        };

                                        return (
                                            <tr key={s._id} className={`hover:bg-slate-50/50 transition-all group ${
                                                isAssetBlocked ? 'bg-slate-50/20' : ''
                                            }`}>
                                                <td className="px-6 py-4 text-xs font-black text-slate-400">{index + 1}</td>
                                                {/* Activo / SKU */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all overflow-hidden border border-slate-100 ${
                                                            isAssetBlocked ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-500 group-hover:bg-slate-900 group-hover:text-white'
                                                        }`}>
                                                            {s.productoRef?.fotos?.length > 0 ? (
                                                                <img src={s.productoRef.fotos[0]} className="w-full h-full object-cover" alt="PRD" />
                                                            ) : (
                                                                <Archive size={20} />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-bold ${isAssetBlocked ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{s.productoRef?.nombre}</span>
                                                                {isAssetBlocked && (
                                                                    <span className="text-[8px] font-black uppercase bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1">
                                                                        <Lock size={8} /> BLOQUEADO
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tighter">{s.productoRef?.sku}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Bodega Destino */}
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`w-2 h-2 rounded-full ${s.almacenRef?.tipo === 'Central' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                                                            <span className="text-xs font-bold text-slate-700">{s.almacenRef?.nombre}</span>
                                                        </div>
                                                        {s.almacenRef?.tecnicoRef ? (
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 ml-3.5">
                                                                Cargo: {s.almacenRef.tecnicoRef.nombres} {s.almacenRef.tecnicoRef.apellidos}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 ml-3.5">
                                                                Bodega Física Central ({s.almacenRef?.codigo || 'S/C'})
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Estados Stock */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {getStockBadge(s.cantidadNuevo, 'Nuevo')}
                                                        {getStockBadge(s.cantidadUsadoBueno, 'Usado')}
                                                        {getStockBadge(s.cantidadUsadoMalo, 'Malo')}
                                                        {getStockBadge(s.cantidadMerma, 'Merma')}
                                                    </div>
                                                </td>

                                                {/* Patrimonio Localizado */}
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-sm font-black text-emerald-600">{formatCurrency(totalValue)}</span>
                                                        <span className="text-[9px] font-bold text-slate-400">unitario: {formatCurrency(unitPrice)}</span>
                                                    </div>
                                                </td>

                                                {/* Operaciones */}
                                                <td className="px-6 py-4">
                                                    {isAssetBlocked ? (
                                                        <div className="text-right">
                                                            <span className="text-[9px] font-bold text-slate-400 italic">No Operable</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                                                            <button 
                                                                onClick={() => openQuickAction(s, 'ASIGNACION')}
                                                                disabled={!hasRefs}
                                                                title="Asignar a Técnico" 
                                                                className={`p-2 rounded-xl transition-all ${
                                                                    hasRefs ? 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600' : 'text-slate-200 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <UserPlus size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => openQuickAction(s, 'TRASPASO')}
                                                                disabled={!hasRefs}
                                                                title="Traspaso entre Bodegas" 
                                                                className={`p-2 rounded-xl transition-all ${
                                                                    hasRefs ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-900' : 'text-slate-200 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <ArrowRightLeft size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={() => openQuickAction(s, 'MERMA')}
                                                                disabled={!hasRefs}
                                                                title="Reportar Merma/Baja" 
                                                                className={`p-2 rounded-xl transition-all ${
                                                                    hasRefs ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600' : 'text-slate-200 cursor-not-allowed'
                                                                }`}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                        
                    </div>
                </div>
                )}

                {/* Panel de Depreciación y Amortización Real-Time (Lateral) */}
                {selectedAssetForDepreciation && assetDepreciationDetails && (
                    <div className="w-full xl:w-1/3 bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl space-y-6 animate-in slide-in-from-right duration-300 relative overflow-hidden">
                        
                        {/* Botón de Cierre */}
                        <button 
                            onClick={() => setSelectedAssetForDepreciation(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-full hover:bg-slate-50"
                        >
                            <XIcon size={18} />
                        </button>

                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Auditoría Financiera 360</span>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">{selectedAssetForDepreciation.nombre}</h3>
                            <p className="text-slate-400 text-xs font-mono">{selectedAssetForDepreciation.sku}</p>
                        </div>

                        {/* Ficha Rápida del Activo */}
                        <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Categoría</span>
                                <span className="text-xs font-bold text-slate-700">{selectedAssetForDepreciation.categoria?.nombre || 'General'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Adquisición</span>
                                <span className="text-xs font-bold text-slate-700">{assetDepreciationDetails.fechaAdq}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Movilidad</span>
                                <span className="text-xs font-bold text-slate-700">{selectedAssetForDepreciation.movilidad || 'Rotativo'}</span>
                            </div>
                            <div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Segmentación</span>
                                <span className="text-xs font-bold text-slate-700">{selectedAssetForDepreciation.segmentacion || 'Estándar'}</span>
                            </div>
                        </div>

                        {/* Barra de Progreso de Amortización */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span className="text-slate-400">Depreciación Consumida</span>
                                <span className="text-rose-500">{assetDepreciationDetails.porcentajeDepreciado}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
                                <div 
                                    className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${assetDepreciationDetails.porcentajeDepreciado}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                <span>Nuevo (0%)</span>
                                <span>Totalmente Depreciado (100%)</span>
                            </div>
                        </div>

                        {/* Desglose de Valores */}
                        <div className="space-y-3 pt-3 border-t border-slate-100">
                            
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">Costo de Adquisición:</span>
                                <span className="font-black text-slate-900">{formatCurrency(assetDepreciationDetails.valor)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">Valor de Recuperación (Residual):</span>
                                <span className="font-black text-slate-900">{formatCurrency(assetDepreciationDetails.residual)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-500">Base Depreciable Total:</span>
                                <span className="font-black text-slate-900">{formatCurrency(assetDepreciationDetails.baseDepreciable)}</span>
                            </div>

                            <div className="flex justify-between items-center text-xs p-2 bg-rose-50/50 rounded-xl text-rose-700">
                                <span className="font-bold">Depreciación Acumulada ({assetDepreciationDetails.mesesTranscurridos} meses):</span>
                                <span className="font-black">-{formatCurrency(assetDepreciationDetails.acumulada)}</span>
                            </div>

                            <div className="flex justify-between items-center text-sm p-3 bg-emerald-50 rounded-xl text-emerald-800">
                                <span className="font-black">Valor en Libros Actual:</span>
                                <span className="font-black text-base">{formatCurrency(assetDepreciationDetails.valorLibro)}</span>
                            </div>

                        </div>

                        {/* Datos Proyectados */}
                        <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-50 space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase">
                                <TrendingDown size={14} />
                                Proyección de Desgaste
                            </div>
                            <p className="text-slate-600 leading-relaxed text-[11px]">
                                Vida útil total establecida en <strong className="text-slate-800">{assetDepreciationDetails.vidaUtil} meses</strong>. 
                                Transcurridos <strong className="text-slate-800">{assetDepreciationDetails.mesesTranscurridos} meses</strong>. 
                                Ruedan <strong className="text-slate-800">{assetDepreciationDetails.mesesRestantes} meses</strong> de amortización restante. 
                                La amortización mensual es de <strong className="text-slate-800">{formatCurrency(assetDepreciationDetails.mensualidad)}</strong> por unidad.
                            </p>
                        </div>

                    </div>
                )}

            </div>

            {/* ─── MODAL REGISTRAR NUEVO ACTIVO ─── */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Registrar Existencia General</h2>
                                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Crea la ficha de la existencia para su catalogación y depreciación</p>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <XIcon size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateAsset} className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-8 space-y-6">
                                
                                {/* Datos Básicos */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">1. Ficha del Producto</h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Existencia</label>
                                            <input 
                                                type="text" required placeholder="Ej: Furgón Citroen Berlingo"
                                                value={assetForm.nombre}
                                                onChange={e => setAssetForm({...assetForm, nombre: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU (Vacío = Auto)</label>
                                            <input 
                                                type="text" placeholder="Código Automático"
                                                value={assetForm.sku}
                                                onChange={e => setAssetForm({...assetForm, sku: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código EAN (Barras)</label>
                                            <input 
                                                type="text" placeholder="Ej: 7801234567890"
                                                value={assetForm.ean || ''}
                                                onChange={e => setAssetForm({...assetForm, ean: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría de la Existencia</label>
                                            <select 
                                                required
                                                value={assetForm.categoria}
                                                onChange={e => setAssetForm({...assetForm, categoria: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option value="">Seleccionar Categoría</option>
                                                {categorias.map(c => (
                                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</label>
                                            <input 
                                                type="text" placeholder="Ej: Caterpillar, Toyota"
                                                value={assetForm.marca}
                                                onChange={e => setAssetForm({...assetForm, marca: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                                            <input 
                                                type="text" placeholder="Ej: Hilux 2024, CAT-320"
                                                value={assetForm.modelo}
                                                onChange={e => setAssetForm({...assetForm, modelo: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad de Medida</label>
                                            <select 
                                                value={assetForm.unidadMedida}
                                                onChange={e => setAssetForm({...assetForm, unidadMedida: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Unidad</option>
                                                <option>Metro</option>
                                                <option>Litro</option>
                                                <option>Kilogramo</option>
                                                <option>Caja</option>
                                                <option>Pack</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                            <input 
                                                type="text" placeholder="Detalle adicional de la existencia..."
                                                value={assetForm.descripcion}
                                                onChange={e => setAssetForm({...assetForm, descripcion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número de Serie (S/N)</label>
                                            <input 
                                                type="text" placeholder="Ej: SN-987654321A"
                                                value={assetForm.nroSerie || ''}
                                                onChange={e => setAssetForm({...assetForm, nroSerie: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI (Equipos Celulares / IoT)</label>
                                            <input 
                                                type="text" placeholder="Ej: 351234567890123"
                                                value={assetForm.imei || ''}
                                                onChange={e => setAssetForm({...assetForm, imei: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número Teléfono (Chips)</label>
                                            <input 
                                                type="text" placeholder="Ej: +56912345678"
                                                value={assetForm.numeroCelular || ''}
                                                onChange={e => setAssetForm({...assetForm, numeroCelular: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI 2 (Equipos Duales)</label>
                                            <input 
                                                type="text" placeholder="Ej: 351234567890124"
                                                value={assetForm.imei2 || ''}
                                                onChange={e => setAssetForm({...assetForm, imei2: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI 3 (Opcional)</label>
                                            <input 
                                                type="text" placeholder="Opcional"
                                                value={assetForm.imei3 || ''}
                                                onChange={e => setAssetForm({...assetForm, imei3: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Parámetros Financieros (Depreciación) */}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">2. Contabilidad & Depreciación Real-Time</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor de Adquisición (CLP)</label>
                                            <input 
                                                type="number" required min="0"
                                                value={assetForm.valorUnitario}
                                                onChange={e => setAssetForm({...assetForm, valorUnitario: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor de Recuperación (Residual)</label>
                                            <input 
                                                type="number" min="0"
                                                value={assetForm.valorResidual}
                                                onChange={e => setAssetForm({...assetForm, valorResidual: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vida Útil (En Meses)</label>
                                            <select 
                                                value={assetForm.vidaUtilMeses}
                                                onChange={e => setAssetForm({...assetForm, vidaUtilMeses: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option value={12}>12 meses (1 año)</option>
                                                <option value={24}>24 meses (2 años)</option>
                                                <option value={36}>36 meses (3 años)</option>
                                                <option value={48}>48 meses (4 años)</option>
                                                <option value={60}>60 meses (5 años)</option>
                                                <option value={120}>120 meses (10 años)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Compra / Adquisición</label>
                                            <input 
                                                type="date" required
                                                value={assetForm.fechaAdquisicion}
                                                onChange={e => setAssetForm({...assetForm, fechaAdquisicion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none text-slate-700 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Control Operativo */}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">3. Control Operativo & Propiedad</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color</label>
                                            <select 
                                                value={assetForm.color}
                                                onChange={e => setAssetForm({...assetForm, color: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                {COLOR_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segmentación</label>
                                            <select 
                                                value={assetForm.segmentacion}
                                                onChange={e => setAssetForm({...assetForm, segmentacion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Estándar</option>
                                                <option>Crítico</option>
                                                <option>Consumo</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movilidad</label>
                                            <select 
                                                value={assetForm.movilidad}
                                                onChange={e => setAssetForm({...assetForm, movilidad: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Rotativo</option>
                                                <option>Estático</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Propiedad</label>
                                            <select 
                                                value={assetForm.propiedad}
                                                onChange={e => setAssetForm({...assetForm, propiedad: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Propio</option>
                                                <option>Cliente</option>
                                            </select>
                                        </div>
                                    </div>

                                    {assetForm.propiedad === 'Cliente' && (
                                        <div className="space-y-2 text-indigo-600 animate-in fade-in duration-200">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente Dueño del Activo</label>
                                            <select 
                                                required
                                                value={assetForm.clienteRef}
                                                onChange={e => setAssetForm({...assetForm, clienteRef: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option value="">Seleccionar Cliente</option>
                                                {clientes.map(c => (
                                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Fotografía de evidencia */}
                                    <div className="space-y-4 pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">Fotografía Referencial o Ficha Técnica</label>
                                        <div className="flex items-center gap-4">
                                            {assetForm.fotoUrl ? (
                                                <div className="relative">
                                                    <img src={assetForm.fotoUrl} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-lg" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setAssetForm({...assetForm, fotoUrl: ''})}
                                                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:scale-105"
                                                    >
                                                        <XIcon size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 transition-all text-slate-400">
                                                    <Camera size={24} className="text-indigo-500" />
                                                    <span className="text-[8px] font-black uppercase">Subir Foto</span>
                                                    <input 
                                                        type="file" accept="image/*" className="hidden"
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (ev) => setAssetForm({...assetForm, fotoUrl: ev.target.result});
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            )}
                                            <p className="text-[10px] text-slate-400 italic leading-relaxed flex-1">
                                                Cargue una foto descriptiva del activo para facilitar su identificación en bodegas y cuadrillas operativas.
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            
                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button 
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Registrando...' : 'Confirmar Existencia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL EDITAR ACTIVO MAESTRO ─── */}
            {showEditModal && editingProduct && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Editar Ficha de Existencia</h2>
                                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-1">Edita los parámetros maestros y cálculos de depreciación</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <XIcon size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleEditProduct} className="flex-1 overflow-y-auto custom-scrollbar">
                            <div className="p-8 space-y-6">
                                
                                {/* Ficha Producto */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">1. Ficha del Producto</h4>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre de la Existencia</label>
                                            <input 
                                                type="text" required
                                                value={editingProduct.nombre}
                                                onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU (Vacío = Auto)</label>
                                            <input 
                                                type="text" 
                                                value={editingProduct.sku || ''}
                                                onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                                placeholder="Código Automático"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código EAN (Barras)</label>
                                            <input 
                                                type="text" 
                                                value={editingProduct.ean || ''}
                                                onChange={e => setEditingProduct({...editingProduct, ean: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                                placeholder="Ej: 7801234567890"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría de la Existencia</label>
                                            <select 
                                                required
                                                value={editingProduct.categoria}
                                                onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                {categorias.map(c => (
                                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marca</label>
                                            <input 
                                                type="text" 
                                                value={editingProduct.marca || ''}
                                                onChange={e => setEditingProduct({...editingProduct, marca: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                                            <input 
                                                type="text" 
                                                value={editingProduct.modelo || ''}
                                                onChange={e => setEditingProduct({...editingProduct, modelo: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número de Serie (S/N)</label>
                                            <input 
                                                type="text" placeholder="Ej: SN-987654321A"
                                                value={editingProduct.nroSerie || ''}
                                                onChange={e => setEditingProduct({...editingProduct, nroSerie: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI (Equipos Celulares / IoT)</label>
                                            <input 
                                                type="text" placeholder="Ej: 351234567890123"
                                                value={editingProduct.imei || ''}
                                                onChange={e => setEditingProduct({...editingProduct, imei: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número Teléfono (Chips)</label>
                                            <input 
                                                type="text" placeholder="Ej: +56912345678"
                                                value={editingProduct.numeroCelular || ''}
                                                onChange={e => setEditingProduct({...editingProduct, numeroCelular: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI 2 (Equipos Duales)</label>
                                            <input 
                                                type="text" placeholder="Ej: 351234567890124"
                                                value={editingProduct.imei2 || ''}
                                                onChange={e => setEditingProduct({...editingProduct, imei2: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IMEI 3 (Opcional)</label>
                                            <input 
                                                type="text" placeholder="Opcional"
                                                value={editingProduct.imei3 || ''}
                                                onChange={e => setEditingProduct({...editingProduct, imei3: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2 col-span-3 sm:col-span-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad de Medida</label>
                                            <select 
                                                value={editingProduct.unidadMedida || 'Unidad'}
                                                onChange={e => setEditingProduct({...editingProduct, unidadMedida: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Unidad</option>
                                                <option>Metro</option>
                                                <option>Litro</option>
                                                <option>Kilogramo</option>
                                                <option>Caja</option>
                                                <option>Pack</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2 col-span-3 sm:col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</label>
                                            <textarea 
                                                value={editingProduct.descripcion || ''}
                                                onChange={e => setEditingProduct({...editingProduct, descripcion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none resize-none h-20"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Contabilidad y Depreciación */}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">2. Contabilidad & Depreciación Real-Time</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor de Adquisición (CLP)</label>
                                            <input 
                                                type="number" required min="0"
                                                value={editingProduct.valorUnitario}
                                                onChange={e => setEditingProduct({...editingProduct, valorUnitario: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor de Recuperación (Residual)</label>
                                            <input 
                                                type="number" min="0"
                                                value={editingProduct.valorResidual || 0}
                                                onChange={e => setEditingProduct({...editingProduct, valorResidual: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vida Útil (En Meses)</label>
                                            <select 
                                                value={editingProduct.vidaUtilMeses || 60}
                                                onChange={e => setEditingProduct({...editingProduct, vidaUtilMeses: Number(e.target.value)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option value={12}>12 meses (1 año)</option>
                                                <option value={24}>24 meses (2 años)</option>
                                                <option value={36}>36 meses (3 años)</option>
                                                <option value={48}>48 meses (4 años)</option>
                                                <option value={60}>60 meses (5 años)</option>
                                                <option value={120}>120 meses (10 años)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Compra / Adquisición</label>
                                            <input 
                                                type="date" required
                                                value={editingProduct.fechaAdquisicion}
                                                onChange={e => setEditingProduct({...editingProduct, fechaAdquisicion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none text-slate-700 font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Control Operativo */}
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">3. Control Operativo & Propiedad</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color</label>
                                            <select 
                                                value={editingProduct.color || 'Genérico'}
                                                onChange={e => setEditingProduct({...editingProduct, color: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                {COLOR_OPTIONS.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segmentación</label>
                                            <select 
                                                value={editingProduct.segmentacion}
                                                onChange={e => setEditingProduct({...editingProduct, segmentacion: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Estándar</option>
                                                <option>Crítico</option>
                                                <option>Consumo</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movilidad</label>
                                            <select 
                                                value={editingProduct.movilidad || 'Rotativo'}
                                                onChange={e => setEditingProduct({...editingProduct, movilidad: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Rotativo</option>
                                                <option>Estático</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Propiedad</label>
                                            <select 
                                                value={editingProduct.propiedad || 'Propio'}
                                                onChange={e => setEditingProduct({...editingProduct, propiedad: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Propio</option>
                                                <option>Cliente</option>
                                            </select>
                                        </div>
                                    </div>

                                    {editingProduct.propiedad === 'Cliente' && (
                                        <div className="space-y-2 text-indigo-600 animate-in fade-in duration-200">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente Dueño del Activo</label>
                                            <select 
                                                required
                                                value={editingProduct.clienteRef}
                                                onChange={e => setEditingProduct({...editingProduct, clienteRef: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option value="">Seleccionar Cliente</option>
                                                {clientes.map(c => (
                                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Fotografía de evidencia */}
                                    <div className="space-y-4 pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">Fotografía Referencial o Ficha Técnica</label>
                                        <div className="flex items-center gap-4">
                                            {editingProduct.fotoUrl ? (
                                                <div className="relative">
                                                    <img src={editingProduct.fotoUrl} alt="Preview" className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-lg" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => setEditingProduct({...editingProduct, fotoUrl: ''})}
                                                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg hover:scale-105"
                                                    >
                                                        <XIcon size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 transition-all text-slate-400">
                                                    <Camera size={24} className="text-indigo-500" />
                                                    <span className="text-[8px] font-black uppercase">Subir Foto</span>
                                                    <input 
                                                        type="file" accept="image/*" className="hidden"
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (ev) => setEditingProduct({...editingProduct, fotoUrl: ev.target.result});
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            )}
                                            <p className="text-[10px] text-slate-400 italic leading-relaxed flex-1">
                                                Modifique la fotografía o cargue una nueva para actualizar la ficha de este activo.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3 rounded-b-[2.5rem]">
                                <button 
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving}
                                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL ACCIONES RÁPIDAS (OPERACIONES DE STOCK EN BODEGAS) ─── */}
            {showQuickActionModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <form onSubmit={handleQuickAction}>
                            <div className="p-8 border-b border-slate-50 bg-slate-50/50">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                    {quickActionForm.tipo === 'ASIGNACION' ? 'Asignar a Técnico/Móvil' : 
                                     quickActionForm.tipo === 'MERMA' ? 'Reportar Falla / Baja de Activo' : 'Traslado entre Bodegas'}
                                </h2>
                                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Operación y Sincronización de Stock</p>
                            </div>
                            
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    
                                    {/* Stock Disponible Info */}
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                                        <p className="text-[10px] font-black text-indigo-500 uppercase mb-1">Activo en Movimiento</p>
                                        <p className="text-xs font-black text-slate-700">
                                            {productos.find(p => p._id === quickActionForm.productoRef)?.nombre}
                                        </p>
                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-100/50 text-[10px] font-bold text-slate-500">
                                            <span>Bodega Origen:</span>
                                            <span className="font-black text-slate-700">
                                                {almacenes.find(a => a._id === quickActionForm.almacenOrigen)?.nombre || 'S/N'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Cantidad y Estado */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                                            <input 
                                                type="number" required min="1"
                                                value={quickActionForm.cantidad}
                                                onChange={e => setQuickActionForm({...quickActionForm, cantidad: toSafeNumber(e.target.value, 1)})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Físico</label>
                                            <select 
                                                value={quickActionForm.estadoProducto}
                                                onChange={e => setQuickActionForm({...quickActionForm, estadoProducto: e.target.value})}
                                                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
                                            >
                                                <option>Nuevo</option>
                                                <option>Usado Bueno</option>
                                                <option>Usado Malo</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Bodega Destino para Asignaciones y Traspasos */}
                                    {quickActionForm.tipo !== 'MERMA' && (
                                        <div className="space-y-2 text-indigo-600">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bodega/Furgón Destino</label>
                                            <SmartSelect
                                                required
                                                value={quickActionForm.almacenDestino}
                                                onChange={(v) => setQuickActionForm({ ...quickActionForm, almacenDestino: v })}
                                                placeholder="Seleccionar Destino"
                                                contextKey="inventario_quick_destino"
                                                options={almacenes
                                                    .filter(a => a._id !== quickActionForm.almacenOrigen)
                                                    .map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                                            />
                                        </div>
                                    )}

                                    {/* Comentarios de Motivo */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo / Justificación</label>
                                        <input 
                                            type="text" required placeholder="Ej: Entrega a cuadrilla en terreno, falla placa electrónica"
                                            value={quickActionForm.motivo}
                                            onChange={e => setQuickActionForm({...quickActionForm, motivo: e.target.value})}
                                            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-900/10"
                                        />
                                    </div>

                                    {/* Captura de Foto Evidencia */}
                                    <div className="space-y-4 pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-indigo-600">Foto de Evidencia (Requerido)</label>
                                        <div className="flex items-center gap-4">
                                            {quickActionForm.fotoUrl ? (
                                                <div className="relative">
                                                    <img src={quickActionForm.fotoUrl} alt="Evidencia" className="w-20 h-20 rounded-2xl object-cover border border-slate-100 shadow-md" />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setQuickActionForm({...quickActionForm, fotoUrl: ''})} 
                                                        className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg"
                                                    >
                                                        <XIcon size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 transition-all text-slate-400">
                                                    <Camera size={20} className="text-indigo-500" />
                                                    <span className="text-[8px] font-black uppercase">Capturar</span>
                                                    <input 
                                                        type="file" accept="image/*" className="hidden" 
                                                        onChange={e => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                const reader = new FileReader();
                                                                reader.onload = (ev) => setQuickActionForm({...quickActionForm, fotoUrl: ev.target.result});
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }} 
                                                    />
                                                </label>
                                            )}
                                            <p className="flex-1 text-[10px] font-bold text-slate-400 leading-tight italic">
                                                Cargue una foto del estado físico y del número de serie/patente para validar el movimiento.
                                            </p>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            <div className="p-8 bg-slate-50 flex items-center justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setShowQuickActionModal(false)}
                                    className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" disabled={saving || !quickActionForm.fotoUrl}
                                    className={`px-8 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all disabled:opacity-50 active:scale-95 ${
                                        quickActionForm.tipo === 'MERMA' ? 'bg-rose-600 shadow-rose-200 hover:bg-rose-700' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'
                                    }`}
                                >
                                    {saving ? 'Procesando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MODAL CARGA INICIAL DE EXISTENCIAS MASIVAS ─── */}
            {showCargaMasiva && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-50 bg-emerald-50/50 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-emerald-950 tracking-tight flex items-center gap-3">
                                    <Database className="text-emerald-600" /> Carga Inicial de Existencias
                                </h2>
                                <p className="text-emerald-700/60 text-[10px] font-black uppercase tracking-widest mt-1">Ingresa el inventario y patrimonio inicial en bodegas centrales o móviles</p>
                            </div>
                            <button onClick={() => setShowCargaMasiva(false)} className="text-slate-400 hover:text-rose-500 transition-colors">
                                <XIcon size={24} />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            
                            {/* Panel Premium de Importación desde Excel */}
                            <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-[2rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="space-y-1 text-center sm:text-left">
                                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-2">
                                        <FileSpreadsheet className="text-emerald-600 animate-pulse" size={16} />
                                        Carga Masiva Avanzada vía Excel
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold">
                                        Descarga la plantilla oficial, rellena los SKU y cantidades, y súbela aquí.
                                    </p>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={descargarPlantillaExcel}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-white text-emerald-700 hover:bg-emerald-50 transition-all font-bold text-[10px] uppercase tracking-wider rounded-xl border border-emerald-200 shadow-sm flex items-center justify-center gap-1.5"
                                    >
                                        <Download size={12} />
                                        Plantilla
                                    </button>
                                    <label className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-bold text-[10px] uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer text-center">
                                        <Plus size={12} />
                                        Subir Excel
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleExcelImport}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Bodega de Recepción</label>
                                    <SmartSelect
                                        required
                                        value={almacenCarga}
                                        onChange={setAlmacenCarga}
                                        placeholder="Seleccionar Almacén"
                                        contextKey="inventario_carga_almacen"
                                        options={almacenes.map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Existencias a Cargar</label>
                                    {cargaMasivaItems.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            
                                            {/* Selector de Existencia */}
                                            <div className="col-span-6">
                                                <SmartSelect
                                                    value={item.productoRef}
                                                    onChange={(v) => updateCargaItem(idx, 'productoRef', v)}
                                                    placeholder="Seleccionar Activo..."
                                                    contextKey="inventario_carga_producto"
                                                    options={activeProductsForSelect.map((p) => ({ value: p._id, label: `${p.nombre} (${p.sku})` }))}
                                                />
                                                {(() => {
                                                    const prod = productos.find(p => p._id === item.productoRef);
                                                    if (!prod) return null;
                                                    return (
                                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[8px] font-black uppercase text-slate-500 tracking-wider">
                                                            <span className="px-2 py-0.5 bg-slate-200/60 rounded-full border border-slate-300/30">
                                                                Cat: {prod.categoria?.nombre || 'Sin Categoría'}
                                                            </span>
                                                            {prod.marca && (
                                                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                                                                    Marca: {prod.marca}
                                                                </span>
                                                            )}
                                                            {prod.unidadMedida && (
                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                                    U.M.: {prod.unidadMedida}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            
                                            {/* Cantidad */}
                                            <div className="col-span-2">
                                                <input 
                                                    type="number" 
                                                    value={item.cantidad}
                                                    onChange={e => updateCargaItem(idx, 'cantidad', toSafeNumber(e.target.value, 1))}
                                                    className="w-full bg-white px-3 py-2 rounded-xl text-[11px] font-bold text-center outline-none border border-slate-200"
                                                />
                                            </div>
                                            
                                            {/* Estado Físico */}
                                            <div className="col-span-3">
                                                <select 
                                                    value={item.estadoProducto}
                                                    onChange={e => updateCargaItem(idx, 'estadoProducto', e.target.value)}
                                                    className="w-full bg-white px-3 py-2 rounded-xl text-[11px] font-bold outline-none border border-slate-200"
                                                >
                                                    <option>Nuevo</option>
                                                    <option>Usado Bueno</option>
                                                    <option>Usado Malo</option>
                                                </select>
                                            </div>
                                            
                                            {/* Eliminar Item */}
                                            <div className="col-span-1 text-right">
                                                <button 
                                                    onClick={() => setCargaMasivaItems(cargaMasivaItems.filter((_, i) => i !== idx))}
                                                    className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        type="button"
                                        onClick={addCargaItem}
                                        className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-all bg-slate-50/50"
                                    >
                                        + Agregar otra Existencia
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
                                className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 disabled:opacity-50 hover:bg-emerald-700 transition-all active:scale-95"
                            >
                                {saving ? 'Cargando...' : 'Procesar Carga Inicial'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Inventario;
