import React, { useState, useEffect, useRef } from 'react';
import { 
    X, 
    Search, 
    User, 
    ShieldCheck, 
    Camera, 
    FileSignature, 
    CheckCircle2, 
    AlertCircle,
    Package,
    Truck,
    Tool,
    Check,
    MessageSquare,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import SignaturePad from './SignaturePad';
import { formatRut, validateRut } from '../../../utils/rutUtils';

const DynamicAuditModal = ({ isOpen, onClose, tecnicoPreload = null, tecnicosPermitidos = [] }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    
    // Step 1: Trabajador & Categoría
    const [rut, setRut] = useState('');
    const [tecnico, setTecnico] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [categorias, setCategorias] = useState([]);
    
    // Step 2: Firma Aceptación
    const sigPadAceptacion = useRef(null);
    const [firmaAceptacion, setFirmaAceptacion] = useState(null);

    // Step 3: Inventario
    const [inventario, setInventario] = useState([]);
    const [auditItems, setAuditItems] = useState({}); // { [stockId]: { conteo, foto, comentario } }

    // Step 4: Firma Finalización
    const sigPadFinalizacion = useRef(null);
    const [firmaFinalizacion, setFirmaFinalizacion] = useState(null);
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        setStep(1);
        setLoading(false);
        setSelectedCategory('Todas');
        setFirmaAceptacion(null);
        setFirmaFinalizacion(null);
        setObservaciones('');
        setInventario([]);
        setAuditItems({});

        const preloadRut = String(tecnicoPreload?.rut || '').trim();
        setRut(preloadRut);
        setTecnico(tecnicoPreload || null);

        fetchCategorias();
        if (tecnicoPreload?._id) {
            buscarInventario(tecnicoPreload._id);
        }
    }, [isOpen, tecnicoPreload]);

    const handleSelectTecnico = async (tec) => {
        if (!tec?._id) return;
        setTecnico(tec);
        setRut(formatRut(tec.rut || ''));
        await buscarInventario(tec._id);
        setStep(2);
    };

    const fetchCategorias = async () => {
        try {
            const res = await logisticaApi.get('/categorias');
            setCategorias(['Todas', ...res.data.map(c => c.nombre)]);
        } catch (e) {
            console.error(e);
        }
    };

    const buscarTecnico = async () => {
        if (!rut) return;
        setLoading(true);
        try {
            const res = await logisticaApi.get(`/buscar-tecnico?rut=${rut}`);
            setTecnico(res.data);
            buscarInventario(res.data._id);
            setStep(2);
        } catch (e) {
            alert("Trabajador no encontrado");
        } finally {
            setLoading(false);
        }
    };

    const buscarInventario = async (tecnicoId) => {
        try {
            const res = await logisticaApi.get(`/stock-tecnico?tecnicoId=${tecnicoId}`);
            setInventario(res.data);
            // Inicializar auditItems
            const initial = {};
            res.data.forEach(item => {
                initial[item._id] = {
                    conteo: item.cantidadNuevo + item.cantidadUsadoBueno,
                    foto: null,
                    comentario: '',
                    producto: item.productoRef,
                    stockSistema: item.cantidadNuevo + item.cantidadUsadoBueno
                };
            });
            setAuditItems(initial);
        } catch (e) {
            console.error(e);
        }
    };

    const handleNextStep = () => {
        if (step === 2 && !firmaAceptacion) {
            alert("La firma de aceptación es obligatoria");
            return;
        }
        if (step === 3) {
            // Validar fotos obligatorias
            const missingPhotos = Object.values(auditItems).some(item => !item.foto);
            if (missingPhotos) {
                alert("Debes capturar fotos para todos los ítems auditados");
                return;
            }
        }
        setStep(step + 1);
    };

    const handleCameraClick = (id) => {
        // Simulación de cámara para esta demo (en prod usaría entrada de archivo camara)
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                setAuditItems(prev => ({
                    ...prev,
                    [id]: { ...prev[id], foto: event.target.result }
                }));
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const handleSubmit = async () => {
        if (!firmaFinalizacion) {
            alert("La firma de finalización es obligatoria");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                almacenId: inventario[0]?.almacenRef?._id, // Usamos el primer almacén encontrado
                auditadoId: tecnico._id,
                datosAuditado: {
                    rut: tecnico.rut,
                    nombre: `${tecnico.nombres} ${tecnico.apellidos}`,
                    cargo: tecnico.cargo,
                    area: tecnico.area,
                    ceco: tecnico.ceco,
                    proyecto: tecnico.proyecto
                },
                firmaAceptacion: firmaAceptacion?.imagenBase64 || firmaAceptacion,
                firmaFinalizacion: firmaFinalizacion?.imagenBase64 || firmaFinalizacion,
                detalles: Object.entries(auditItems).map(([id, data]) => ({
                    producto: data.producto._id,
                    stockSistema: data.stockSistema,
                    conteoFisico: data.conteo,
                    fotoUrl: data.foto, // En prod esto debería subirse a Cloudinary primero
                    comentario: data.comentario
                })),
                observaciones
            };

            await logisticaApi.post('/auditorias', payload);
            alert("Auditoría sellada y notificada con éxito");
            onClose();
            setStep(5); // Éxito
        } catch (e) {
            alert(e.response?.data?.message || "Error al guardar auditoría");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredInventario = selectedCategory === 'Todas' 
        ? inventario 
        : inventario.filter(item => item.productoRef?.categoria?.nombre === selectedCategory);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-bottom bg-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">Auditoría Dinámica 360</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Protocolo de Verificación Proactiva</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X size={24} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-10 py-4 bg-white border-b border-slate-100 flex justify-between">
                    {[1, 2, 3, 4].map(num => (
                        <div key={num} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                step >= num ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                                {step > num ? <Check size={16} /> : num}
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                step >= num ? 'text-indigo-600' : 'text-slate-300'
                            }`}>
                                {num === 1 && "ID"}
                                {num === 2 && "Inicio"}
                                {num === 3 && "Conteo"}
                                {num === 4 && "Cierre"}
                            </span>
                            {num < 4 && <div className="w-8 h-px bg-slate-100" />}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-10">
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4">
                            <div className="text-center">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <User size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800">Identificación del Trabajador</h3>
                                <p className="text-slate-500">Ingresa el RUT para cargar el inventario asignado.</p>
                            </div>
                            
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="12.345.678-9" 
                                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 border-2 ${rut && !validateRut(rut) ? 'border-rose-400 focus:border-rose-500 bg-rose-50 text-rose-600' : 'border-transparent focus:border-indigo-600'} rounded-2xl outline-none font-bold text-lg transition-all`}
                                        value={rut}
                                        onChange={(e) => setRut(formatRut(e.target.value))}
                                        readOnly={!!tecnicoPreload && !!String(tecnicoPreload?.rut || '').trim()}
                                    />
                                </div>

                                {tecnicosPermitidos.length > 0 && !tecnicoPreload && (
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Personal Vinculado</label>
                                        <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-100 p-2 bg-white space-y-2">
                                            {tecnicosPermitidos.map((tec) => (
                                                <button
                                                    key={tec._id}
                                                    type="button"
                                                    onClick={() => handleSelectTecnico(tec)}
                                                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all"
                                                >
                                                    <p className="text-[11px] font-black text-slate-700 uppercase truncate">{tec.nombre || `${tec.nombres || ''} ${tec.apellidos || ''}`.trim()}</p>
                                                    <p className="text-[10px] font-mono text-slate-400">{formatRut(tec.rut || '') || 'Sin RUT'}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Categoría de Auditoría</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {categorias.map(cat => (
                                            <button 
                                                key={cat}
                                                onClick={() => setSelectedCategory(cat)}
                                                className={`py-3 px-4 rounded-xl border-2 font-black text-[10px] uppercase tracking-wider transition-all ${
                                                    selectedCategory === cat 
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                                    : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={tecnicoPreload ? () => setStep(2) : buscarTecnico}
                                    disabled={loading || (!rut && !tecnicoPreload)}
                                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {loading ? 'Buscando...' : 'Iniciar Auditoría'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4">
                             <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 text-amber-800">
                                <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                                    <ShieldCheck size={24} />
                                    Aceptación de Auditoría
                                </h3>
                                <p className="text-sm font-medium leading-relaxed">
                                    Yo, <strong>{tecnico?.nombres} {tecnico?.apellidos}</strong>, acepto el proceso de inventario y autorizo el registro fotográfico y digital de mis activos asignados.
                                </p>
                            </div>

                            <div className="bg-white border-4 border-slate-50 rounded-3xl overflow-hidden shadow-inner">
                                <SignaturePad 
                                    ref={sigPadAceptacion}
                                    rutFirmante={tecnico?.rut}
                                    nombreFirmante={`${tecnico?.nombres || ''} ${tecnico?.apellidos || ''}`.trim()}
                                    onSave={setFirmaAceptacion}
                                />
                            </div>
                            <div className="flex justify-between items-center">
                                <button onClick={() => sigPadAceptacion.current.clear()} className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Borrar Firma</button>
                                <button 
                                    onClick={handleNextStep}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                                >
                                    Continuar al Conteo
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Conteo de {selectedCategory}</h3>
                                <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase">{filteredInventario.length} Ítems</span>
                            </div>

                            <div className="grid gap-4">
                                {filteredInventario.map(item => (
                                    <div key={item._id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 overflow-hidden">
                                                    {auditItems[item._id]?.foto ? (
                                                        <img src={auditItems[item._id].foto} className="w-full h-full object-cover" />
                                                    ) : <Package size={32} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-800">{item.productoRef?.nombre}</h4>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.productoRef?.sku} · {item.almacenRef?.nombre}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 max-w-xl items-center">
                                                <div>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Stock Sistema</label>
                                                    <span className="text-lg font-black text-slate-800">{item.cantidadNuevo + item.cantidadUsadoBueno}</span>
                                                </div>
                                                <div className="relative">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">Conteo Físico</label>
                                                    <input 
                                                        type="number"
                                                        className="w-20 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-xl font-black text-lg text-center"
                                                        value={auditItems[item._id]?.conteo}
                                                        onChange={(e) => setAuditItems(prev => ({
                                                            ...prev,
                                                            [item._id]: { ...prev[item._id], conteo: parseInt(e.target.value) || 0 }
                                                        }))}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => handleCameraClick(item._id)}
                                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                                                            auditItems[item._id]?.foto ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 border-2 border-dashed border-slate-200'
                                                        }`}
                                                    >
                                                        <Camera size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare size={14} className="text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    placeholder="Añadir comentario (Ej: Dañado, Faltante, requiere cambio...)"
                                                    className="flex-1 bg-transparent text-xs font-bold text-slate-600 outline-none"
                                                    value={auditItems[item._id]?.comentario}
                                                    onChange={(e) => setAuditItems(prev => ({
                                                        ...prev,
                                                        [item._id]: { ...prev[item._id], comentario: e.target.value }
                                                    }))}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={handleNextStep}
                                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                Finalizar Conteo <ChevronRight size={20} />
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4">
                            <div className="text-center">
                                <h3 className="text-2xl font-black text-slate-800">Cierre de Auditoría</h3>
                                <p className="text-slate-500">Resume y firma para finalizar el proceso.</p>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-3xl">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Observaciones Generales</label>
                                <textarea 
                                    className="w-full p-4 bg-white border border-slate-100 rounded-2xl min-h-[100px] outline-none font-medium text-sm"
                                    placeholder="Detalles adicionales sobre el estado general de los activos..."
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                />
                            </div>

                            <div className="bg-indigo-900 p-8 rounded-[40px] text-white">
                                <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <FileSignature size={24} />
                                    Firma de Finalización
                                </h4>
                                 <div className="bg-white rounded-3xl overflow-hidden">
                                     <SignaturePad 
                                        ref={sigPadFinalizacion}
                                        rutFirmante={tecnico?.rut}
                                        nombreFirmante={`${tecnico?.nombres || ''} ${tecnico?.apellidos || ''}`.trim()}
                                        onSave={setFirmaFinalizacion}
                                    />
                                </div>
                                <button onClick={() => sigPadFinalizacion.current.clear()} className="mt-4 text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Re-intentar Firma</button>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                                {loading ? 'Serrando Auditoría...' : 'Sellar y Notificar Auditoría'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DynamicAuditModal;
