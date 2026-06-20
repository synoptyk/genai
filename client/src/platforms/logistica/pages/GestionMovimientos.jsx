import React, { useState, useEffect, useMemo } from 'react';
import { 
    ArrowRightLeft, 
    ArrowUpCircle, 
    ArrowDownCircle, 
    Trash2, 
    User, 
    Package,
    AlertCircle,
    CheckCircle2,
    Zap,
    Truck,
    Camera,
    X,
    Plus,
    Search,
    Filter,
    Users,
    CheckSquare,
    Info,
    ListPlus,
    ClipboardList,
    Layers,
    UserCheck,
    Briefcase,
    MapPin,
    AlertTriangle
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import SmartSelect from '../components/SmartSelect';

const toSafeNumber = (value, fallback = 1) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getAbbreviatedStatus = (status) => {
    if (!status) return 'DESCONOCIDO';
    if (status === 'ACTIVO') return 'ACTIVO';
    if (status === 'PRE-INCORPORACION') return 'PRE-INC.';
    if (status === 'POSTULANTE') return 'POSTULANTE';
    if (status === 'FINIQUITADO') return 'FINIQUITADO';
    return status;
};

const getEstadoTalentoBadge = (status) => {
    const abbv = getAbbreviatedStatus(status);
    if (abbv === 'ACTIVO') return <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">Activo</span>;
    if (abbv === 'PRE-INC.') return <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">Pre-Inc</span>;
    if (abbv === 'POSTULANTE') return <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">Postulante</span>;
    if (abbv === 'FINIQUITADO') return <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">Finiquitado</span>;
    return <span className="inline-flex items-center text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">{abbv}</span>;
};

const GestionMovimientos = () => {
    const [productos, setProductos] = useState([]);
    const [almacenes, setAlmacenes] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    // Tipo de movimiento actual
    const [tipoMov, setTipoMov] = useState('ASIGNACION');

    // Datos generales de la transacción
    const [formGeneral, setFormGeneral] = useState({
        almacenOrigen: '',
        almacenDestino: '',
        motivo: '',
        documentoReferencia: '(AUTO-GENERADO)',
        fotoUrl: ''
    });

    const [autoCodificacion, setAutoCodificacion] = useState(true);

    // Mapeo de asignación a técnicos
    const [assignmentMode, setAssignmentMode] = useState('individual'); // 'individual' | 'masiva'
    const [selectedTecnicos, setSelectedTecnicos] = useState([]); // Array de ids de técnicos

    // Filtros para la asignación masiva de técnicos
    const [tecSearch, setTecSearch] = useState('');
    const [filterProyecto, setFilterProyecto] = useState('');
    const [filterSede, setFilterSede] = useState('');
    const [filterCargo, setFilterCargo] = useState('');
    const [filterEstadoHR, setFilterEstadoHR] = useState('');

    // Multi-Item Builder: Lista de ítems a mover
    const [items, setItems] = useState([
        { id: Date.now(), productoRef: '', cantidad: 1, estadoProducto: 'Nuevo', serie: '' }
    ]);
    const [cargoEquipamientos, setCargoEquipamientos] = useState([]);

    // Carga de datos iniciales
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [p, a, t, c] = await Promise.all([
                    logisticaApi.get('/productos'),
                    logisticaApi.get('/almacenes'),
                    logisticaApi.get('/tecnicos').catch(() => ({ data: [] })),
                    logisticaApi.get('/configuracion-maestra').catch(() => ({ data: {} }))
                ]);
                setProductos(p.data || []);
                setAlmacenes(a.data || []);
                setTecnicos(t.data || []);
                if (c.data && c.data.cargoEquipamientos) {
                    setCargoEquipamientos(c.data.cargoEquipamientos);
                }
            } catch (e) {
                console.error("Error loading movements dependencies", e);
                setStatus({ type: 'error', message: 'Error al cargar dependencias del sistema.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Proyectos y sedes únicos para filtros de asignación masiva
    const uniqueProyectos = useMemo(() => {
        const projs = tecnicos.map(t => t.proyecto).filter(Boolean);
        return [...new Set(projs)].sort();
    }, [tecnicos]);

    const uniqueSedes = useMemo(() => {
        const sedes = tecnicos.map(t => t.sede || t.ciudad || '').filter(Boolean);
        return [...new Set(sedes)].sort();
    }, [tecnicos]);

    const uniqueCargos = useMemo(() => {
        const cargos = tecnicos.map(t => t.cargo).filter(Boolean);
        return [...new Set(cargos)].sort();
    }, [tecnicos]);

    const uniqueEstadosHR = useMemo(() => {
        const estados = tecnicos.map(t => t.estadoActual).filter(Boolean);
        return [...new Set(estados)].sort();
    }, [tecnicos]);

    // Filtrado de técnicos para asignación masiva
    const filteredTecnicos = useMemo(() => {
        return tecnicos.filter(t => {
            const matchesSearch = 
                `${t.nombres} ${t.apellidos}`.toLowerCase().includes(tecSearch.toLowerCase()) ||
                (t.rut || '').toLowerCase().includes(tecSearch.toLowerCase());
            const matchesProyecto = filterProyecto ? t.proyecto === filterProyecto : true;
            const matchesSede = filterSede ? (t.sede === filterSede || t.ciudad === filterSede) : true;
            const matchesCargo = filterCargo ? t.cargo === filterCargo : true;
            const matchesEstadoHR = filterEstadoHR ? t.estadoActual === filterEstadoHR : true;
            const isFiniquitado = filterEstadoHR !== 'FINIQUITADO' && t.estadoActual === 'FINIQUITADO';

            return matchesSearch && matchesProyecto && matchesSede && matchesCargo && matchesEstadoHR && !isFiniquitado;
        });
    }, [tecnicos, tecSearch, filterProyecto, filterSede, filterCargo, filterEstadoHR]);

    // Tipos de movimiento estructurados
    const movTypes = [
        { id: 'ASIGNACION', label: 'ASIGNACIÓN', icon: UserCheck, color: 'text-sky-600', bg: 'bg-sky-50', desc: 'Asignar stock del inventario central a uno o múltiples técnicos en terreno.' },
        { id: 'REVERSA', label: 'Reversa (Retorno)', icon: ArrowDownCircle, color: 'text-amber-600', bg: 'bg-amber-50', desc: 'Devolver herramientas o materiales de técnicos hacia bodegas centrales.' },
        { id: 'MERMA', label: 'Reportar Merma', icon: Trash2, color: 'text-rose-600', bg: 'bg-rose-50', desc: 'Registrar pérdidas, daños catastróficos o mermas operativas.' },
        { id: 'RECEPCION', label: 'Recepción Bodega', icon: ArrowUpCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', desc: 'Ingresar nuevas existencias compradas o transferidas a la bodega.' }
    ];

    // Funciones del Multi-Item Builder
    const handleLoadCargoItems = (cargoId) => {
        if (!cargoId) return;
        const cargo = cargoEquipamientos.find(c => c._id === cargoId);
        if (!cargo || !cargo.items || cargo.items.length === 0) {
            setStatus({ type: 'error', message: 'La plantilla seleccionada no tiene ítems configurados.' });
            return;
        }

        const newItems = cargo.items.map((it, idx) => {
            const prodId = typeof it.productoRef === 'object' ? it.productoRef?._id : it.productoRef;
            return {
                id: Date.now() + Math.random() + idx,
                productoRef: prodId,
                cantidad: it.cantidad || 1,
                estadoProducto: it.estadoProducto || 'Nuevo',
                serie: ''
            };
        });

        if (items.length === 1 && !items[0].productoRef) {
            setItems(newItems);
        } else {
            setItems([...items, ...newItems]);
        }
        setStatus({ type: 'success', message: `¡Se cargaron ${newItems.length} ítems desde la plantilla predeterminada!` });
    };

    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now() + Math.random(), productoRef: '', cantidad: 1, estadoProducto: 'Nuevo', serie: '' }
        ]);
    };

    const handleRemoveItem = (id) => {
        if (items.length === 1) {
            setStatus({ type: 'error', message: 'Debes mantener al menos un ítem en el movimiento.' });
            return;
        }
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id, field, value) => {
        setItems(items.map(item => {
            if (item.id === id) {
                if (field === 'cantidad') {
                    return { ...item, [field]: toSafeNumber(value, 1) };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    // Envío del Formulario (Registro masivo e individual integrado)
    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });

        // 1. Validaciones básicas
        const invalidItems = items.filter(it => !it.productoRef);
        if (invalidItems.length > 0) {
            setStatus({ type: 'error', message: 'Por favor, selecciona un producto para cada línea agregada.' });
            return;
        }

        // 2. Resolver destinatarios / bodegas involucradas
        let movimientosPayload = [];

        if (tipoMov === 'ASIGNACION') {
            if (!formGeneral.almacenOrigen) {
                setStatus({ type: 'error', message: 'La Bodega Origen es obligatoria para realizar una Asignación.' });
                return;
            }
            if (selectedTecnicos.length === 0) {
                setStatus({ type: 'error', message: 'Debes seleccionar al menos un técnico para realizar la asignación.' });
                return;
            }

            // Validar bodegas de técnicos seleccionados
            const missingWhs = [];
            selectedTecnicos.forEach(tecId => {
                const tecObj = tecnicos.find(t => t._id === tecId);
                const hasWh = almacenes.find(a => a.tecnicoRef?._id === tecId || a.tecnicoRef === tecId);
                if (!hasWh) {
                    missingWhs.push(tecObj ? `${tecObj.nombres} ${tecObj.apellidos}` : tecId);
                }
            });

            if (missingWhs.length > 0) {
                setStatus({
                    type: 'error',
                    message: `Los siguientes técnicos no tienen una bodega asignada: ${missingWhs.join(', ')}. Créalas primero en Configuración Maestra.`
                });
                return;
            }

            // Construir payload combinatorio para cada técnico y cada item
            selectedTecnicos.forEach(tecId => {
                const tecWh = almacenes.find(a => a.tecnicoRef?._id === tecId || a.tecnicoRef === tecId);
                const tecObj = tecnicos.find(t => t._id === tecId);
                
                items.forEach(it => {
                    movimientosPayload.push({
                        tipo: 'ASIGNACION',
                        productoRef: it.productoRef,
                        cantidad: it.cantidad,
                        estadoProducto: it.estadoProducto,
                        almacenOrigen: formGeneral.almacenOrigen,
                        almacenDestino: tecWh._id,
                        motivo: formGeneral.motivo || `Asignación masiva a técnico: ${tecObj?.nombreCompleto || ''}`,
                        documentoReferencia: formGeneral.documentoReferencia,
                        fotoUrl: formGeneral.fotoUrl,
                        serie: it.serie
                    });
                });
            });

        } else if (tipoMov === 'REVERSA') {
            if (!formGeneral.almacenDestino) {
                setStatus({ type: 'error', message: 'La Bodega Destino es obligatoria para realizar una Reversa.' });
                return;
            }
            if (selectedTecnicos.length === 0) {
                setStatus({ type: 'error', message: 'Debes seleccionar el técnico de origen para el retorno de materiales.' });
                return;
            }

            const tecId = selectedTecnicos[0]; // Solo 1 en retorno individual
            const tecWh = almacenes.find(a => a.tecnicoRef?._id === tecId || a.tecnicoRef === tecId);
            const tecObj = tecnicos.find(t => t._id === tecId);

            if (!tecWh) {
                setStatus({
                    type: 'error',
                    message: `El técnico ${tecObj?.nombreCompleto || 'seleccionado'} no posee bodega propia asignada para revertir.`
                });
                return;
            }

            items.forEach(it => {
                movimientosPayload.push({
                    tipo: 'REVERSA',
                    productoRef: it.productoRef,
                    cantidad: it.cantidad,
                    estadoProducto: it.estadoProducto,
                    almacenOrigen: tecWh._id,
                    almacenDestino: formGeneral.almacenDestino,
                    motivo: formGeneral.motivo || `Retorno / Reversa desde técnico: ${tecObj?.nombreCompleto || ''}`,
                    documentoReferencia: formGeneral.documentoReferencia,
                    fotoUrl: formGeneral.fotoUrl,
                    serie: it.serie
                });
            });

        } else {
            // MERMA y RECEPCION
            if (tipoMov === 'MERMA' && !formGeneral.almacenOrigen) {
                setStatus({ type: 'error', message: 'La Bodega de Origen es obligatoria para reportar Merma.' });
                return;
            }
            if (tipoMov === 'RECEPCION' && !formGeneral.almacenDestino) {
                setStatus({ type: 'error', message: 'La Bodega de Destino es obligatoria para realizar la Recepción.' });
                return;
            }

            items.forEach(it => {
                movimientosPayload.push({
                    tipo: tipoMov,
                    productoRef: it.productoRef,
                    cantidad: it.cantidad,
                    estadoProducto: it.estadoProducto,
                    almacenOrigen: formGeneral.almacenOrigen || null,
                    almacenDestino: formGeneral.almacenDestino || null,
                    motivo: formGeneral.motivo,
                    documentoReferencia: formGeneral.documentoReferencia,
                    fotoUrl: formGeneral.fotoUrl,
                    serie: it.serie
                });
            });
        }

        setSubmitting(true);
        try {
            await logisticaApi.post('/movimientos/bulk', { movimientos: movimientosPayload });
            setStatus({ 
                type: 'success', 
                message: `¡Movimientos registrados con éxito! Se procesaron ${movimientosPayload.length} transacciones de inventario.` 
            });
            // Reset parcial
            setItems([{ id: Date.now(), productoRef: '', cantidad: 1, estadoProducto: 'Nuevo', serie: '' }]);
            setSelectedTecnicos([]);
            setFormGeneral({
                ...formGeneral,
                motivo: '',
                documentoReferencia: autoCodificacion ? '(AUTO-GENERADO)' : '',
                fotoUrl: ''
            });
        } catch (err) {
            console.error(err);
            setStatus({ type: 'error', message: err.response?.data?.message || 'Error al procesar la asignación masiva de inventario.' });
        } finally {
            setSubmitting(false);
        }
    };

    // Contadores rápidos de ítems
    const totalCantidadPiezas = items.reduce((acc, curr) => acc + curr.cantidad, 0);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-300 w-full overflow-x-hidden relative">
            {/* Header del Módulo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-indigo-950 p-8 rounded-[2.5rem] shadow-xl text-white">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-2xl border border-sky-400/20">
                            <ArrowRightLeft size={24} />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">Gestión de Movimientos</h1>
                    </div>
                    <p className="text-slate-300 font-medium text-sm tracking-wide">
                        Arquitectura inteligente para el control, asignación masiva y movimientos de activos de Logística 360.
                    </p>
                </div>
                <div className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-3xl px-6 py-4 backdrop-blur-sm self-start md:self-auto">
                    <div className="text-center">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Líneas</span>
                        <span className="text-2xl font-black text-sky-400">{items.length}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-center">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidades</span>
                        <span className="text-2xl font-black text-emerald-400">{totalCantidadPiezas}</span>
                    </div>
                </div>
            </div>

            {/* Alertas de Status */}
            {status.message && (
                <div className={`p-5 rounded-3xl flex items-start gap-3.5 border animate-in fade-in duration-200 ${
                    status.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                        : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                    {status.type === 'success' ? (
                        <CheckCircle2 className="text-emerald-500 mt-0.5 flex-shrink-0" size={22} />
                    ) : (
                        <AlertCircle className="text-rose-500 mt-0.5 flex-shrink-0" size={22} />
                    )}
                    <div className="space-y-1">
                        <p className="font-bold text-sm leading-tight uppercase tracking-wider">
                            {status.type === 'success' ? 'Operación Exitosa' : 'Atención Requerida'}
                        </p>
                        <p className="font-medium text-xs opacity-90 leading-relaxed">{status.message}</p>
                    </div>
                </div>
            )}

            {/* Selector de Tipo de Movimiento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {movTypes.map(type => {
                    const isSelected = tipoMov === type.id;
                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => {
                                setTipoMov(type.id);
                                setStatus({ type: '', message: '' });
                                setSelectedTecnicos([]); // Limpiar selección al cambiar tipo
                            }}
                            className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col items-start gap-4 text-left group hover:scale-[1.02] active:scale-95 ${
                                isSelected 
                                    ? `border-slate-900 ${type.bg} shadow-xl shadow-slate-200` 
                                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                            }`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className={`p-3.5 rounded-2xl transition-all ${
                                    isSelected ? 'bg-slate-900 text-white' : `${type.bg} ${type.color}`
                                }`}>
                                    <type.icon size={22} />
                                </div>
                                {isSelected && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-900 animate-pulse" />
                                )}
                            </div>
                            <div>
                                <span className={`block text-xs font-black uppercase tracking-wider mb-1 ${
                                    isSelected ? 'text-slate-900' : 'text-slate-400'
                                }`}>
                                    {type.label}
                                </span>
                                <span className="block text-[11px] font-bold text-slate-500 leading-relaxed tracking-tight">
                                    {type.desc}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Formulario Principal de Acciones */}
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* PANEL DE CONFIGURACIÓN GENERAL (IZQUIERDA - Col 5) */}
                <div className="lg:col-span-5 space-y-8">
                    
                    {/* Tarjeta 1: Parámetros del Movimiento */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 space-y-6">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
                            <Layers size={16} className="text-indigo-500" />
                            Parámetros del Movimiento
                        </h2>

                        <div className="space-y-5">
                            {/* Origen (ASIGNACION, REVERSA, TRASPASO, MERMA) */}
                            {['ASIGNACION', 'MERMA'].includes(tipoMov) && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        Bodega de Origen <span className="text-rose-500 font-bold">*</span>
                                    </label>
                                    <SmartSelect
                                        required
                                        value={formGeneral.almacenOrigen}
                                        onChange={(v) => setFormGeneral({ ...formGeneral, almacenOrigen: v })}
                                        placeholder="Seleccionar Bodega de Salida"
                                        contextKey="mov_origen"
                                        options={almacenes
                                            .filter(a => a.tipo !== 'Tecnico') // Solo bodegas físicas reales como origen
                                            .map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))
                                        }
                                    />
                                </div>
                            )}

                            {/* Destino (REVERSA, RECEPCION, TRASPASO) */}
                            {['REVERSA', 'RECEPCION'].includes(tipoMov) && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        Bodega de Destino <span className="text-rose-500 font-bold">*</span>
                                    </label>
                                    <SmartSelect
                                        required
                                        value={formGeneral.almacenDestino}
                                        onChange={(v) => setFormGeneral({ ...formGeneral, almacenDestino: v })}
                                        placeholder="Seleccionar Bodega de Entrada"
                                        contextKey="mov_destino"
                                        options={almacenes
                                            .filter(a => a.tipo !== 'Tecnico') // Solo bodegas físicas reales como destino directo
                                            .map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))
                                        }
                                    />
                                </div>
                            )}

                            {/* Referencia y Motivo */}
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                            Documento de Referencia
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAutoCodificacion(!autoCodificacion);
                                                setFormGeneral({
                                                    ...formGeneral,
                                                    documentoReferencia: !autoCodificacion ? '(AUTO-GENERADO)' : ''
                                                });
                                            }}
                                            className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 hover:scale-105 active:scale-95 ${
                                                autoCodificacion 
                                                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                            }`}
                                        >
                                            <Zap size={10} /> {autoCodificacion ? 'Automático' : 'Manual'}
                                        </button>
                                    </div>
                                    
                                    {autoCodificacion ? (
                                        <div className="w-full p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl flex items-center gap-3 text-xs font-bold text-indigo-700 animate-in fade-in duration-250 select-none">
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                                <Zap size={14} className="animate-pulse" />
                                            </div>
                                            <div>
                                                <span className="block font-black uppercase text-[10px] tracking-wider text-indigo-800">
                                                    Codificación Automática Activa
                                                </span>
                                                <span className="block text-[10px] opacity-80 font-semibold mt-0.5 normal-case">
                                                    Se generará un número correlativo {tipoMov === 'ASIGNACION' || tipoMov === 'REVERSA' ? 'GD-YYYY-XXXX' : (tipoMov === 'RECEPCION' ? 'REC-YYYY-XXXX' : 'MOV-YYYY-XXXX')} al confirmar.
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <input 
                                            type="text"
                                            value={formGeneral.documentoReferencia}
                                            onChange={e => setFormGeneral({...formGeneral, documentoReferencia: e.target.value})}
                                            placeholder="Ej: GD-4521, FAC-1002, ACTA-9"
                                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all text-xs font-bold outline-none uppercase tracking-wider placeholder:text-slate-400 animate-in slide-in-from-top duration-250"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones / Descripción</label>
                                <textarea 
                                    value={formGeneral.motivo}
                                    onChange={e => setFormGeneral({...formGeneral, motivo: e.target.value})}
                                    rows="3"
                                    placeholder="Detalle la justificación administrativa de este movimiento..."
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-slate-900/5 focus:bg-white transition-all text-xs font-bold outline-none resize-none placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tarjeta 2: Asignación a Técnicos (Solo si es ASIGNACION o REVERSA) */}
                    {['ASIGNACION', 'REVERSA'].includes(tipoMov) && (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={16} className="text-sky-500" />
                                    Destinatarios / Técnicos
                                </h2>
                                
                                {tipoMov === 'ASIGNACION' && (
                                    <div className="flex bg-slate-100 p-0.5 rounded-xl text-[9px] font-black uppercase tracking-wider">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignmentMode('individual');
                                                setSelectedTecnicos([]);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                                assignmentMode === 'individual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                                            }`}
                                        >
                                            Individual
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAssignmentMode('masiva');
                                                setSelectedTecnicos([]);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                                assignmentMode === 'masiva' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                                            }`}
                                        >
                                            Masiva
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* MODO ASIGNACION INDIVIDUAL (O MODO REVERSA SIEMPRE INDIVIDUAL) */}
                            {(assignmentMode === 'individual' || tipoMov === 'REVERSA') ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Seleccionar Colaborador <span className="text-rose-500 font-bold">*</span>
                                        </label>
                                        <SmartSelect
                                            value={selectedTecnicos[0] || ''}
                                            onChange={(v) => setSelectedTecnicos(v ? [v] : [])}
                                            placeholder="Buscar técnico por nombre o RUT..."
                                            contextKey="tecnico_single"
                                            options={tecnicos
                                                .filter(t => t.estadoActual !== 'FINIQUITADO')
                                                .map(t => ({
                                                    value: t._id,
                                                    label: `${t.nombreCompleto} (${t.rut}) - ${t.proyecto || 'Sin Proyecto'}`
                                                }))
                                            }
                                        />
                                    </div>

                                    {/* Previsualización del Técnico Seleccionado */}
                                    {selectedTecnicos[0] && (() => {
                                        const tec = tecnicos.find(t => t._id === selectedTecnicos[0]);
                                        const wh = almacenes.find(a => a.tecnicoRef?._id === selectedTecnicos[0] || a.tecnicoRef === selectedTecnicos[0]);
                                        
                                        return (
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2.5 text-xs animate-in fade-in duration-200">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-sky-500/10 text-sky-600 rounded-xl flex items-center justify-center font-black">
                                                        {tec?.nombres?.charAt(0) || 'T'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800">{tec?.nombreCompleto}</p>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{tec?.rut}</p>
                                                    </div>
                                                </div>
                                                <div className="h-px bg-slate-100" />
                                                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <div>
                                                        <span className="block text-[8px] font-black text-slate-400">Proyecto</span>
                                                        <span className="text-slate-700 truncate block">{tec?.proyecto || 'Sin Proyecto'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[8px] font-black text-slate-400">Sede</span>
                                                        <span className="text-slate-700 truncate block">{tec?.sede || 'Sin Sede'}</span>
                                                    </div>
                                                </div>
                                                <div className="h-px bg-slate-100" />
                                                <div className="flex items-center justify-between text-[10px] font-bold">
                                                    <span className="text-slate-400 uppercase tracking-widest">Bodega Asignada:</span>
                                                    {wh ? (
                                                        <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                                                            {wh.nombre}
                                                        </span>
                                                    ) : (
                                                        <span className="text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                            <AlertTriangle size={10} /> Sin Bodega
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                /* MODO ASIGNACION MASIVA */
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Filtros de Búsqueda y Segmentación
                                        </span>
                                        
                                        {/* Barra de Búsqueda */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                value={tecSearch}
                                                onChange={e => setTecSearch(e.target.value)}
                                                placeholder="Buscar por nombre o RUT..."
                                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200/80 rounded-xl text-xs font-bold outline-none"
                                            />
                                        </div>

                                        {/* Filtros Dropdown */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Proyecto</span>
                                                <select
                                                    value={filterProyecto}
                                                    onChange={e => setFilterProyecto(e.target.value)}
                                                    className="w-full p-2 bg-white border border-slate-200/85 rounded-xl text-[10px] font-bold outline-none"
                                                >
                                                    <option value="">Todos</option>
                                                    {uniqueProyectos.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Sede</span>
                                                <select
                                                    value={filterSede}
                                                    onChange={e => setFilterSede(e.target.value)}
                                                    className="w-full p-2 bg-white border border-slate-200/85 rounded-xl text-[10px] font-bold outline-none"
                                                >
                                                    <option value="">Todas</option>
                                                    {uniqueSedes.map(s => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Botones de Selección Rápida (Pills) */}
                                        <div className="space-y-2 pt-1 border-t border-slate-100">
                                            <div className="space-y-1.5">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Filtrar por Cargo</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button type="button" onClick={() => setFilterCargo('')} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${filterCargo === '' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Todos</button>
                                                    {uniqueCargos.map(c => (
                                                        <button key={c} type="button" onClick={() => setFilterCargo(c)} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${filterCargo === c ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{c}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Estado en RRHH</span>
                                                <div className="flex flex-wrap gap-1.5">
                                                    <button type="button" onClick={() => setFilterEstadoHR('')} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${filterEstadoHR === '' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Todos</button>
                                                    {uniqueEstadosHR.map(e => (
                                                        <button key={e} type="button" onClick={() => setFilterEstadoHR(e)} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${filterEstadoHR === e ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{e}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Controles de Selección Masiva */}
                                        <div className="flex gap-2 justify-between pt-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allIds = filteredTecnicos.map(t => t._id);
                                                    setSelectedTecnicos(allIds);
                                                }}
                                                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider"
                                            >
                                                Seleccionar Filtrados ({filteredTecnicos.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedTecnicos([])}
                                                className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-slate-300"
                                            >
                                                Desmarcar Todo
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de Técnicos */}
                                    <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50 pr-1">
                                        {filteredTecnicos.length === 0 ? (
                                            <div className="p-6 text-center text-slate-400 text-xs font-bold uppercase tracking-wider leading-relaxed">
                                                No se hallaron técnicos que coincidan con la búsqueda.
                                            </div>
                                        ) : (
                                            filteredTecnicos.map(tec => {
                                                const isChecked = selectedTecnicos.includes(tec._id);
                                                const tecWh = almacenes.find(a => a.tecnicoRef?._id === tec._id || a.tecnicoRef === tec._id);
                                                
                                                return (
                                                    <button
                                                        key={tec._id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isChecked) {
                                                                setSelectedTecnicos(selectedTecnicos.filter(id => id !== tec._id));
                                                            } else {
                                                                setSelectedTecnicos([...selectedTecnicos, tec._id]);
                                                            }
                                                        }}
                                                        className={`w-full p-3.5 flex items-center justify-between text-left transition-colors ${
                                                            isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                                                                isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                                                            }`}>
                                                                {isChecked && <CheckSquare size={12} />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="text-xs font-bold text-slate-800">{tec.nombreCompleto}</p>
                                                                    {getEstadoTalentoBadge(tec.estadoActual)}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tec.rut}</p>
                                                                    <span className="text-[9px] text-slate-300">•</span>
                                                                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">{tec.cargo || 'Sin Cargo'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-[9px] font-black text-slate-500 uppercase truncate max-w-[120px]">{tec.proyecto || 'Sin Proyecto'}</span>
                                                            {!tecWh && (
                                                                <span className="inline-flex items-center gap-0.5 text-[7px] font-black text-rose-500 bg-rose-50 px-1 py-0.5 rounded uppercase tracking-wider mt-0.5">
                                                                    <AlertTriangle size={8} /> Sin Bodega
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1 px-1">
                                        <span>Total Filtrados: {filteredTecnicos.length}</span>
                                        <span className="text-indigo-600">Seleccionados: {selectedTecnicos.length}</span>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* Tarjeta 3: Evidencia Fotográfica */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl p-8 space-y-4">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
                            <Camera size={16} className="text-rose-500" />
                            Evidencia Visual
                        </h2>
                        
                        <div className="flex items-center gap-6">
                            {formGeneral.fotoUrl ? (
                                <div className="relative group">
                                    <img src={formGeneral.fotoUrl} alt="Evidencia" className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-xl shadow-slate-200" />
                                    <button 
                                        type="button"
                                        onClick={() => setFormGeneral({...formGeneral, fotoUrl: ''})}
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
                                                reader.onload = (ev) => setFormGeneral({...formGeneral, fotoUrl: ev.target.result});
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                            )}
                            <p className="flex-1 text-[10px] font-bold text-slate-400 uppercase leading-relaxed tracking-widest italic">
                                "La captura de evidencia visual asegura el blindaje administrativo de la entrega de equipos."
                            </p>
                        </div>
                    </div>
                </div>

                {/* CONSTRUCTOR DE ITEMS (DERECHA - Col 7) */}
                <div className="lg:col-span-7 space-y-8">
                    
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden flex flex-col min-h-[600px]">
                        
                        {/* Header de la Tarjeta */}
                        <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <div className="space-y-1">
                                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <ListPlus size={18} className="text-indigo-600" />
                                    Líneas de Movimiento (Multi-Item)
                                </h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Agregue uno o más productos a esta transacción del sistema.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {cargoEquipamientos.length > 0 && (
                                    <select 
                                        onChange={(e) => {
                                            handleLoadCargoItems(e.target.value);
                                            e.target.value = ''; // reset after load
                                        }}
                                        className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase tracking-wider outline-none max-w-[180px] hover:bg-indigo-100 transition-colors"
                                    >
                                        <option value="">Cargar Plantilla...</option>
                                        {cargoEquipamientos.map(c => (
                                            <option key={c._id} value={c._id}>{c.cargo}</option>
                                        ))}
                                    </select>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
                                >
                                    <Plus size={14} /> Agregar Fila
                                </button>
                            </div>
                        </div>

                        {/* Listado de Items Agregados */}
                        <div className="p-8 flex-1 space-y-6 max-h-[550px] overflow-y-auto">
                            {items.map((item, index) => (
                                <div 
                                    key={item.id}
                                    className="p-6 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100 relative group transition-all duration-200 animate-in slide-in-from-right duration-300"
                                >
                                    {/* Botón de Borrado de Línea */}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="absolute -top-2.5 -right-2.5 bg-white border border-slate-150 hover:border-rose-100 text-slate-400 hover:text-rose-600 p-2 rounded-xl shadow-md hover:scale-105 transition-all opacity-100"
                                        title="Eliminar Línea"
                                    >
                                        <Trash2 size={14} />
                                    </button>

                                    {/* Indicador de Línea */}
                                    <span className="absolute left-4 top-4 text-[9px] font-black text-indigo-400 bg-indigo-50 border border-indigo-100 w-5 h-5 rounded-full flex items-center justify-center">
                                        {index + 1}
                                    </span>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pl-6">
                                        
                                        {/* Producto (Col 6) */}
                                        <div className="md:col-span-6 space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <Package size={10} /> Producto / Activo <span className="text-rose-500 font-bold">*</span>
                                            </label>
                                            <SmartSelect
                                                required
                                                value={item.productoRef}
                                                onChange={(v) => handleItemChange(item.id, 'productoRef', v)}
                                                placeholder="Seleccionar Producto"
                                                contextKey={`mov_prod_${item.id}`}
                                                options={productos.map((p) => ({ value: p._id, label: `${p.nombre} (${p.sku})` }))}
                                            />
                                        </div>

                                        {/* Cantidad (Col 3) */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                                            <input 
                                                type="number" required min="1"
                                                value={item.cantidad}
                                                onChange={e => handleItemChange(item.id, 'cantidad', e.target.value)}
                                                className="w-full p-3.5 bg-white border border-slate-200/80 rounded-xl focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold outline-none"
                                            />
                                        </div>

                                        {/* Estado del Producto (Col 3) */}
                                        <div className="md:col-span-3 space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado</label>
                                            <select 
                                                value={item.estadoProducto}
                                                onChange={e => handleItemChange(item.id, 'estadoProducto', e.target.value)}
                                                className="w-full p-3.5 bg-white border border-slate-200/80 rounded-xl focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold outline-none"
                                            >
                                                <option>Nuevo</option>
                                                <option>Usado Bueno</option>
                                                <option>Usado Malo</option>
                                                <option>Merma</option>
                                            </select>
                                        </div>

                                        {/* Nº de Serie / Datos Extra (Col 12) */}
                                        <div className="md:col-span-12 space-y-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nº de Serie / Identificador (Opcional)</label>
                                            <input 
                                                type="text"
                                                value={item.serie}
                                                onChange={e => handleItemChange(item.id, 'serie', e.target.value)}
                                                placeholder="Ej: S/N F8C28D01, IMEI 3582109..."
                                                className="w-full p-3.5 bg-white border border-slate-200/80 rounded-xl focus:ring-4 focus:ring-slate-900/5 transition-all text-xs font-bold outline-none"
                                            />
                                        </div>

                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer de Submit */}
                        <div className="p-6 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen General</span>
                                <span className="text-xs font-bold text-slate-600">
                                    {tipoMov === 'ASIGNACION' 
                                        ? `${selectedTecnicos.length} Técnicos x ${items.length} Productos = ${selectedTecnicos.length * items.length} Movimientos` 
                                        : `${items.length} ítems en lote`}
                                </span>
                            </div>
                            
                            <button 
                                type="submit" 
                                disabled={loading || submitting}
                                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50 shadow-md shadow-slate-200"
                            >
                                {submitting ? 'Procesando transacciones...' : 'Confirmar Movimiento'}
                                <ArrowRightLeft size={16} />
                            </button>
                        </div>

                    </div>

                </div>

            </form>
        </div>
    );
};

export default GestionMovimientos;
