import React, { useState, useEffect, useRef } from 'react';
import { 
    Shield, Search, Plus, MapPin, CheckCircle2, 
    AlertCircle, Calendar, Users, Eye, ArrowRight, 
    Camera, X, PenTool, FileText, Send, UserCheck, 
    AlertTriangle, QrCode
} from 'lucide-react';
import logisticaApi from '../logisticaApi';
import SignaturePad from '../components/SignaturePad';
import SmartSelect from '../components/SmartSelect';


const Auditorias = () => {
    const [auditorias, setAuditorias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Workflow de 5 Pasos
    const [step, setStep] = useState(1); 
    // 1: Búsqueda RUT, 2: Firma Inicio, 3: Inventario, 4: Firma Final, 5: Resumen

    const [rutBusqueda, setRutBusqueda] = useState('');
    const [auditado, setAuditado] = useState(null);
    const [buscando, setBuscando] = useState(false);
    
    const [firmaAceptacion, setFirmaAceptacion] = useState(null);
    const [firmaFinalizacion, setFirmaFinalizacion] = useState(null);
    
    const [almacenes, setAlmacenes] = useState([]);
    const [selectedAlmacen, setSelectedAlmacen] = useState(null);
    const [stockParaAuditar, setStockParaAuditar] = useState([]);
    const [observaciones, setObservaciones] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [resAud, resAlm] = await Promise.all([
                logisticaApi.get('/auditorias'),
                logisticaApi.get('/almacenes')
            ]);
            setAuditorias(resAud.data);
            setAlmacenes(resAlm.data);
        } catch (error) {
            console.error("Error fetching auditorias", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBuscarTecnico = async () => {
        if (!rutBusqueda) return;
        setBuscando(true);
        try {
            const res = await logisticaApi.get(`/buscar-tecnico?rut=${rutBusqueda}`);
            setAuditado(res.data);
            // Si el técnico tiene un almacén (furgón) asociado, seleccionarlo por defecto
            const hisAlmacen = almacenes.find(a => a.nombre.toLowerCase().includes(res.data.rut.toLowerCase()) || (res.data.patente && a.nombre.includes(res.data.patente)));
            if (hisAlmacen) setSelectedAlmacen(hisAlmacen);
        } catch (e) {
            alert("Trabajador no encontrado en la base de datos 360.");
        } finally {
            setBuscando(false);
        }
    };

    const nextToFirma = () => {
        if (!auditado || !selectedAlmacen) return alert("Selecciona trabajador y unidad a auditar");
        setStep(2);
    };

    const nextToInventory = async () => {
        if (!firmaAceptacion) return alert("Se requiere firma de aceptación del trabajador para iniciar.");
        
        try {
            setLoading(true);
            const res = await logisticaApi.get('/stock/reporte');
            const filtrado = res.data.filter(s => s.almacenRef?._id === selectedAlmacen._id);
            
            setStockParaAuditar(filtrado.map(s => ({
                producto: s.productoRef?._id,
                sku: s.productoRef?.sku,
                nombre: s.productoRef?.nombre,
                estado: s.estado || 'Nuevo',
                stockSistema: s.cantidadNuevo + s.cantidadUsadoBueno + s.cantidadUsadoMalo + s.cantidadMerma,
                conteoFisico: s.cantidadNuevo + s.cantidadUsadoBueno + s.cantidadUsadoMalo + s.cantidadMerma,
                diferencia: 0,
                fotoUrl: '',
                comentario: '',
                serie: '', // Nuevo campo
                modelo: s.productoRef?.modelo || '' // Sugerir modelo del maestro
            })));
            setStep(3);
        } catch (error) {
            console.error("Error loading stock", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCountChange = (index, val) => {
        const newItems = [...stockParaAuditar];
        const num = parseInt(val) || 0;
        newItems[index].conteoFisico = num;
        newItems[index].diferencia = num - newItems[index].stockSistema;
        setStockParaAuditar(newItems);
    };

    const handlePhotoUpload = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const newItems = [...stockParaAuditar];
            newItems[index].fotoUrl = event.target.result;
            setStockParaAuditar(newItems);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        if (!firmaFinalizacion) return alert("Se requiere firma final de auditoría finalizada.");
        setSaving(true);
        try {
            const tieneDiscrepancia = stockParaAuditar.some(i => i.diferencia !== 0);
            
            await logisticaApi.post('/auditorias', {
                almacenId: selectedAlmacen._id,
                auditadoId: auditado._id,
                datosAuditado: {
                    rut: auditado.rut,
                    nombre: auditado.nombre,
                    cargo: auditado.cargo,
                    area: auditado.area,
                    proyecto: auditado.projectId?.nombre
                },
                firmaAceptacion: firmaAceptacion?.imagenBase64 || firmaAceptacion,
                firmaFinalizacion: firmaFinalizacion?.imagenBase64 || firmaFinalizacion,
                detalles: stockParaAuditar,
                observaciones
            });
            
            setStep(5); // Paso de éxito espectacular
            fetchData();
        } catch (error) {
            alert("Error al guardar auditoría: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    const resetModal = () => {
        setShowModal(false);
        setStep(1);
        setAuditado(null);
        setRutBusqueda('');
        setFirmaAceptacion(null);
        setFirmaFinalizacion(null);
        setStockParaAuditar([]);
        setSelectedAlmacen(null);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Shield className="text-indigo-600" /> Auditorías de Blindaje
                    </h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Control Forense con Firma Digital & Snapshot 360</p>
                </div>
                <button 
                    onClick={() => setShowModal(true)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center gap-3 transition-all active:scale-95"
                >
                    <Plus size={18} /> Nueva Auditoría Semanal
                </button>
            </header>

            {/* LISTA DE AUDITORÍAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-black uppercase tracking-widest">Sincronizando Archivos...</div>
                ) : auditorias.map(aud => (
                    <div key={aud._id} className="bg-white p-7 rounded-[3rem] shadow-sm border border-slate-100 hover:shadow-2xl transition-all group">
                        <div className="flex items-center justify-between mb-5">
                            <div className={`p-4 rounded-[1.5rem] ${aud.tieneDiscrepancia ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {aud.tieneDiscrepancia ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                            </div>
                            <div className="text-right">
                                <span className="block text-[10px] font-black text-slate-300 uppercase tracking-widest">{new Date(aud.createdAt).toLocaleDateString()}</span>
                                <span className="block text-[11px] font-bold text-slate-500 uppercase">{aud.almacen?.nombre}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                                    <UserCheck size={14} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{aud.datosAuditado?.nombre}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{aud.datosAuditado?.cargo}</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">Resultado</span>
                                <span className={`text-[10px] font-black uppercase ${aud.tieneDiscrepancia ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {aud.tieneDiscrepancia ? 'DISCREPANCIA DETECTADA' : 'CONCILIADO OK'}
                                </span>
                            </div>
                            <button className="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-2xl transition-all flex items-center justify-center">
                                <Eye size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL WORKFLOW */}
            {showModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={resetModal} />
                    <div className="relative w-full max-w-5xl bg-white rounded-[3.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Stepper Header */}
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                            <div className="flex items-center gap-8">
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <div key={s} className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black transition-all ${step >= s ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                                            {step > s ? <CheckCircle2 size={16} /> : s}
                                        </div>
                                        <div className={`hidden lg:block text-[9px] font-black uppercase tracking-widest ${step === s ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {s === 1 && 'Búsqueda'}
                                            {s === 2 && 'Aceptación'}
                                            {s === 3 && 'Inventario'}
                                            {s === 4 && 'Cierre'}
                                            {s === 5 && 'Finalizado'}
                                        </div>
                                        {s < 5 && <div className={`w-4 h-[2px] rounded-full hidden lg:block ${step > s ? 'bg-slate-900' : 'bg-slate-100'}`} />}
                                    </div>
                                ))}
                            </div>
                            <button onClick={resetModal} className="w-10 h-10 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
                            {/* PASO 1: BÚSQUEDA */}
                            {step === 1 && (
                                <div className="max-w-2xl mx-auto space-y-10 py-10">
                                    <div className="text-center space-y-3">
                                        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto">
                                            <Search size={32} />
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter italic lg:not-italic">Identificación del Auditado</h3>
                                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Ingrese el RUT para vincular la auditoría al trabajador</p>
                                    </div>

                                    <div className="flex gap-4">
                                        <div className="relative flex-1 group">
                                            <input 
                                                type="text" 
                                                placeholder="Ej: 12.345.678-9"
                                                value={rutBusqueda}
                                                onChange={(e) => setRutBusqueda(e.target.value)}
                                                className="w-full px-10 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] text-xl font-black tracking-tight focus:bg-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                                            />
                                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500">
                                                <QrCode size={24} />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleBuscarTecnico}
                                            disabled={buscando}
                                            className="px-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest rounded-[2.5rem] shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {buscando ? 'Buscando...' : 'Verificar'}
                                        </button>
                                    </div>

                                    {auditado && (
                                        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[3rem] animate-in slide-in-from-bottom-5 duration-500">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                                                    <UserCheck size={28} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{auditado.nombre}</h4>
                                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{auditado.cargo} · {auditado.area}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-8">
                                                <div className="space-y-4">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Unidad a Auditar</label>
                                                    <SmartSelect
                                                        value={selectedAlmacen?._id || ''}
                                                        onChange={(v) => setSelectedAlmacen(almacenes.find(a => a._id === v) || null)}
                                                        placeholder="Seleccionar Bodega/Furgón"
                                                        options={almacenes.map((a) => ({ value: a._id, label: `${a.nombre} (${a.tipo})` }))}
                                                    />
                                                </div>
                                                <div className="flex items-end flex-col justify-end">
                                                    <button 
                                                        onClick={nextToFirma}
                                                        className="w-full py-4 bg-slate-900 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
                                                    >
                                                        Proceder a Firma <ArrowRight size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* PASO 2: FIRMA INICIO */}
                            {step === 2 && (
                                <div className="max-w-2xl mx-auto space-y-10 py-10">
                                    <div className="text-center space-y-3">
                                        <h3 className="text-3xl font-black text-slate-800 tracking-tighter">Aceptación de Auditoría</h3>
                                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest max-w-md mx-auto line-relaxed">
                                            El trabajador acepta el inicio del proceso de inventario y la validación de sus items asignados.
                                        </p>
                                    </div>

                                    <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
                                        <SignaturePad 
                                            label="Firma del Auditado (Inicio)" 
                                            onSave={setFirmaAceptacion} 
                                            rutFirmante={auditado?.rut}
                                            nombreFirmante={auditado?.nombre}
                                        />
                                    </div>

                                    <button 
                                        onClick={nextToInventory}
                                        disabled={!firmaAceptacion}
                                        className="w-full py-6 bg-slate-900 text-white font-black uppercase text-xs tracking-[0.3em] rounded-[2.5rem] shadow-2xl shadow-slate-200 disabled:opacity-50"
                                    >
                                        Iniciar Conteo Físico
                                    </button>
                                </div>
                            )}

                            {/* PASO 3: INVENTARIO */}
                            {step === 3 && (
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{selectedAlmacen?.nombre}</h3>
                                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Protocolo de Conteo Forense Activo</p>
                                        </div>
                                        <div className="px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                                            <Camera size={20} className="text-indigo-600" />
                                            <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Foto Obligatoria x Item</span>
                                        </div>
                                    </div>

                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <th className="pb-6 px-4">Producto / Activo</th>
                                                <th className="pb-6 px-4 text-center">Snapshot Sistema</th>
                                                <th className="pb-6 px-4 text-center w-40">Conteo Físico</th>
                                                <th className="pb-6 px-4 text-center">Evidencia Visual</th>
                                                <th className="pb-6 px-4 text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                        {stockParaAuditar.map((item, idx) => (
                                            <React.Fragment key={idx}>
                                                <tr className="group hover:bg-slate-50/50 transition-all">
                                                    <td className="py-6 px-4">
                                                        <div className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{item.nombre}</div>
                                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.sku} · {item.estado}</div>
                                                        {(item.modelo || item.serie) && (
                                                            <div className="mt-1 flex gap-2">
                                                                {item.modelo && <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[8px] font-black text-slate-500 uppercase">{item.modelo}</span>}
                                                                {item.serie && <span className="bg-amber-100 px-2 py-0.5 rounded-lg text-[8px] font-black text-amber-700 uppercase">S/N: {item.serie}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-6 px-4 text-center font-bold text-slate-500 text-lg">{item.stockSistema}</td>
                                                    <td className="py-6 px-4">
                                                        <input 
                                                            type="number"
                                                            value={item.conteoFisico}
                                                            onChange={(e) => handleCountChange(idx, e.target.value)}
                                                            className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 text-center text-xl font-black focus:border-indigo-500 outline-none shadow-sm transition-all"
                                                        />
                                                    </td>
                                                    <td className="py-6 px-4">
                                                        <div className="flex justify-center">
                                                            {item.fotoUrl ? (
                                                                <div className="relative group/foto">
                                                                    <img src={item.fotoUrl} alt="Audit" className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-lg shadow-black/10" />
                                                                    <button 
                                                                        onClick={() => {
                                                                            const next = [...stockParaAuditar];
                                                                            next[idx].fotoUrl = '';
                                                                            setStockParaAuditar(next);
                                                                        }}
                                                                        className="absolute -top-3 -right-3 bg-rose-500 text-white p-2 rounded-full shadow-lg"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <label className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl cursor-pointer hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center shadow-inner border border-indigo-100/50 group/btn">
                                                                    <Camera size={24} className="group-hover/btn:scale-110 transition-transform" />
                                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*" 
                                                                        capture="environment"
                                                                        className="hidden" 
                                                                        onChange={(e) => handlePhotoUpload(idx, e)}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`py-6 px-4 text-right font-black text-lg ${item.diferencia === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                                    </td>
                                                </tr>
                                                <tr className="bg-slate-50/20 group hover:bg-slate-50/50 transition-all border-b border-slate-50">
                                                    <td colSpan={5} className="px-10 py-3">
                                                        <div className="flex items-center gap-6">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <PenTool size={14} className="text-slate-300" />
                                                                <input 
                                                                    type="text"
                                                                    placeholder="Notas específicas..."
                                                                    className="flex-1 bg-transparent text-[10px] font-bold text-slate-500 outline-none border-none py-1"
                                                                    value={item.comentario}
                                                                    onChange={(e) => {
                                                                        const next = [...stockParaAuditar];
                                                                        next[idx].comentario = e.target.value;
                                                                        setStockParaAuditar(next);
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">S/N Detectado:</span>
                                                                <input 
                                                                    type="text"
                                                                    placeholder="Escanear o digitar serie..."
                                                                    className="w-40 bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                                                    value={item.serie}
                                                                    onChange={(e) => {
                                                                        const next = [...stockParaAuditar];
                                                                        next[idx].serie = e.target.value;
                                                                        setStockParaAuditar(next);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                    </table>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                                        <div className="md:col-span-2 space-y-4">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones Críticas & Hallazgos</label>
                                            <textarea 
                                                value={observaciones}
                                                onChange={(e) => setObservaciones(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-6 text-sm font-bold text-slate-600 focus:border-indigo-500 outline-none min-h-[120px] shadow-inner"
                                                placeholder="Describa daños, faltantes o justificaciones..."
                                            />
                                        </div>
                                        <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col justify-between shadow-2xl">
                                            <div>
                                                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-4">Resumen de Balance</h4>
                                                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                                                    <span className="text-xs font-bold text-slate-400">Total Diferencias:</span>
                                                    <span className={`text-xl font-black ${stockParaAuditar.some(i => i.diferencia !== 0) ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                        {stockParaAuditar.reduce((acc, i) => acc + Math.abs(i.diferencia), 0)}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                                    Al proceder, se generarán notificaciones automáticas a Gerencia si existen diferencias.
                                                </p>
                                            </div>
                                            <button 
                                                onClick={() => setStep(4)}
                                                disabled={stockParaAuditar.some(i => !i.fotoUrl)}
                                                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                                            >
                                                Finalizar Conteo <ArrowRight size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PASO 4: FIRMA FINAL */}
                            {step === 4 && (
                                <div className="max-w-4xl mx-auto space-y-12 py-10">
                                    <div className="text-center space-y-3">
                                        <h3 className="text-4xl font-black text-slate-800 tracking-tighter italic lg:not-italic underline decoration-indigo-500 decoration-8 underline-offset-8">Certificación de Auditoría</h3>
                                        <p className="text-slate-400 font-bold uppercase text-[11px] tracking-widest pt-4">Declaración final de conformidad y validación de inventario</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-100 flex flex-col justify-between min-h-[400px]">
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
                                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 shadow-sm">
                                                        <FileText size={24} />
                                                    </div>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Protocolo de Cierre</h4>
                                                </div>
                                                <p className="text-[13px] font-bold text-slate-600 leading-relaxed italic">
                                                    "Yo, <span className="text-slate-900 font-extrabold">{auditado?.nombre}</span>, RUT <span className="text-slate-900 font-extrabold">{auditado?.rut}</span>, declaro que el conteo realizado en presencia del supervisor es fidedigno. Acepto que cualquier diferencia <span className="text-rose-500 font-black">({stockParaAuditar.reduce((acc, i) => acc + Math.abs(i.diferencia), 0)} u)</span> será procesada administrativamente según política de la empresa."
                                                </p>
                                            </div>
                                            <SignaturePad 
                                                label="Firma de Conformidad (Trabajador)" 
                                                onSave={setFirmaFinalizacion} 
                                                rutFirmante={auditado?.rut}
                                                nombreFirmante={auditado?.nombre}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-6">
                                            <div className="bg-indigo-600 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-200 flex-1 flex flex-col justify-center items-center text-center space-y-6">
                                                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border border-white/20 animate-pulse">
                                                    <Send size={40} className="text-white" />
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-2xl font-black uppercase tracking-tight">Procesar Notificaciones</h4>
                                                    <p className="text-indigo-100 text-xs font-bold leading-relaxed opacity-80">
                                                        Se enviarán copias digitales al auditado, supervisor, logística y gerencia operativa.
                                                    </p>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={handleSubmit}
                                                disabled={saving || !firmaFinalizacion}
                                                className="w-full py-8 bg-slate-900 text-white rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                                            >
                                                {saving ? 'Validando Firmas...' : 'Sellar Auditoría Digital'} <Shield size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* PASO 5: ÉXITO ESPECTACULAR */}
                            {step === 5 && (
                                <div className="max-w-2xl mx-auto py-20 text-center space-y-10 group">
                                    <div className="relative mx-auto w-32 h-32">
                                        <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-all duration-1000 scale-150" />
                                        <div className="relative bg-emerald-500 text-white rounded-full w-32 h-32 flex items-center justify-center shadow-2xl shadow-emerald-200">
                                            <CheckCircle2 size={64} className="animate-in zoom-in-50 duration-500" />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-4xl font-black text-slate-800 tracking-tighter italic lg:not-italic">Auditoría Sellada con Éxito</h3>
                                        <p className="text-slate-400 font-bold uppercase text-[11px] tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                                            El protocolo ha sido cerrado digitalmente. Los correos de notificación y órdenes de descuento (si aplican) han sido disparados.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
                                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditado</span>
                                            <p className="text-sm font-black text-slate-800 truncate">{auditado?.nombre}</p>
                                        </div>
                                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Stock</span>
                                            <p className={`text-sm font-black ${stockParaAuditar.some(i => i.diferencia !== 0) ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {stockParaAuditar.some(i => i.diferencia !== 0) ? 'Descuento Pendiente' : 'Todo en Orden'}
                                            </p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={resetModal}
                                        className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95"
                                    >
                                        Volver al Panel Principal
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Auditorias;
