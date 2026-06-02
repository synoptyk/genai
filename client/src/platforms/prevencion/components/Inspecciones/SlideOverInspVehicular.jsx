import React, { useState, useEffect, useRef } from 'react';
import { X, Truck, Camera, PenTool, Save, Loader2, CheckCircle2, XCircle, FileText, Settings, Droplet, AlertTriangle, User } from 'lucide-react';
import { IdentificacionSection, FirmaSection, SectionTitle, AlertModal } from './SharedComponents';
import { inspeccionesApi } from '../../prevencionApi';
import api from '../../../../api/api';
import { formatRut } from '../../../../utils/rutUtils';

const VEHICULAR_CATEGORIAS = [
    {
        categoria: 'Documentación y Seguridad',
        icon: FileText,
        items: [
            'Revisión Técnica al día',
            'Permiso de Circulación',
            'Seguro SOAP',
            'Extintor Vigente',
            'Botiquín Primeros Auxilios',
            'Triángulos y Chaleco Reflectante',
        ]
    },
    {
        categoria: 'Estado Exterior e Interior',
        icon: Truck,
        items: [
            'Carrocería sin daños mayores',
            'Parabrisas sin trizaduras',
            'Espejos retrovisores sanos',
            'Neumáticos (huella > 2mm)',
            'Neumático de repuesto y gata',
            'Limpieza interior y exterior',
        ]
    },
    {
        categoria: 'Mecánica y Sistema Eléctrico',
        icon: Settings,
        items: [
            'Luces altas, bajas y posición',
            'Luces de freno y retroceso',
            'Intermitentes y Gato',
            'Bocina operativa',
            'Freno de mano',
            'Cinturones de seguridad operativos',
        ]
    },
    {
        categoria: 'Fluidos e Instrumentos',
        icon: Droplet,
        items: [
            'Nivel de Aceite Motor',
            'Líquido Refrigerante',
            'Líquido de Frenos / Hidráulico',
            'Tablero sin luces de alerta',
        ]
    }
];

const SlideOverInspVehicular = ({ isOpen, onClose, onSuccess }) => {
    const normalizeRut = (value = '') => String(value).replace(/[^0-9kK]/g, '').toUpperCase();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [fotos, setFotos] = useState([null, null, null, null]);
    const [firmaColaborador, setFirmaColaborador] = useState(null);

    // --- BÚSQUEDA DE TÉCNICO (Conductor) ---
    const [searchingTec, setSearchingTec] = useState(false);
    const [tecEncontrado, setTecEncontrado] = useState(false);
    const debounceRef = useRef(null);

    // --- BÚSQUEDA DE VEHÍCULO (Flota) ---
    const [searchingVehiculo, setSearchingVehiculo] = useState(false);
    const [vehiculoEncontrado, setVehiculoEncontrado] = useState(false);
    const vehiculoDebounceRef = useRef(null);

    const [formVehicular, setFormVehicular] = useState({
        empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
        lugarInspeccion: '', gps: '', emailTrabajador: '',
        vehicular: {
            patente: '',
            kilometraje: '',
            nivelCombustible: '1/2',
            checklist: VEHICULAR_CATEGORIAS.flatMap(cat => cat.items.map(item => ({ item, categoria: cat.categoria, estado: 'Bueno', observacion: '' })))
        },
        observaciones: '',
        inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
    });

    useEffect(() => {
        if (!isOpen) {
            setFormVehicular({
                empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
                lugarInspeccion: '', gps: '', emailTrabajador: '',
                vehicular: {
                    patente: '', kilometraje: '', nivelCombustible: '1/2',
                    checklist: VEHICULAR_CATEGORIAS.flatMap(cat => cat.items.map(item => ({ item, categoria: cat.categoria, estado: 'Bueno', observacion: '' })))
                },
                observaciones: '',
                inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
            });
            setFotos([null, null, null, null]);
            setFirmaColaborador(null);
            setTecEncontrado(false);
            setVehiculoEncontrado(false);
            setAlert(null);
        }
    }, [isOpen]);

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };

    const handleSearchVehiculo = async (patente) => {
        const cleanPatente = patente.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleanPatente.length < 5) return;

        setVehiculoEncontrado(false);
        setSearchingVehiculo(true);
        try {
            // Reutiliza la API de telecom que busca vehículos de flota
            const res = await api.get(`/api/telecom/vehiculos/search?q=${cleanPatente}`);
            const data = res.data;
            // Si data es array, tomar el primero si coincide exacto
            let vehiculo = null;
            if (Array.isArray(data) && data.length > 0) {
                vehiculo = data.find(v => v.patente.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === cleanPatente);
            }

            if (vehiculo) {
                setFormVehicular(p => ({
                    ...p,
                    vehicular: {
                        ...p.vehicular,
                        patente: vehiculo.patente.toUpperCase()
                    }
                }));
                setVehiculoEncontrado(true);
            }
        } catch (error) {
            // Ignorar y dejar patente escrita a mano (vehículo externo)
        } finally {
            setSearchingVehiculo(false);
        }
    };

    const handlePatenteChange = (val) => {
        const formatted = val.toUpperCase().replace(/[^A-Z0-9-]/g, '').substring(0, 8);
        setFormVehicular(p => ({ ...p, vehicular: { ...p.vehicular, patente: formatted } }));
        setVehiculoEncontrado(false);
        clearTimeout(vehiculoDebounceRef.current);
        if (formatted.replace(/[^A-Z0-9]/g, '').length >= 5) {
            vehiculoDebounceRef.current = setTimeout(() => handleSearchVehiculo(formatted), 600);
        }
    };

    const applyTrabajadorData = (persona, cleanRut) => {
        const nombreCompleto = (persona?.nombres && persona?.apellidos)
            ? `${persona.nombres} ${persona.apellidos}`
            : (persona?.fullName || persona?.nombre || '');
        const cargo = persona?.cargo || persona?.position || persona?.hiring?.position || '';
        const empresa = persona?.empresa || persona?.empresaOrigen || persona?.empresaRef?.nombre || persona?.projectId?.nombreProyecto || persona?.projectName || '';
        const email = persona?.email || '';

        setFormVehicular(p => ({
            ...p,
            rutTrabajador: formatRut(cleanRut),
            nombreTrabajador: nombreCompleto || p.nombreTrabajador,
            cargoTrabajador: cargo || p.cargoTrabajador,
            empresa: empresa || p.empresa,
            emailTrabajador: email || p.emailTrabajador,
        }));
    };

    const handleSearchRut = async (rut) => {
        const cleanRut = normalizeRut(rut);
        if (cleanRut.length < 7) return;

        setTecEncontrado(false);
        setSearchingTec(true);
        try {
            let persona = null;
            try {
                const tecRes = await api.get(`/api/tecnicos/rut/${cleanRut}`);
                persona = tecRes?.data || null;
            } catch (tecnicoError) {
                if (tecnicoError?.response?.status !== 404) throw tecnicoError;
            }

            if (!persona) {
                const candidatoRes = await api.get(`/api/rrhh/candidatos/rut/${cleanRut}`);
                persona = candidatoRes?.data || null;
            }

            if (persona) {
                applyTrabajadorData(persona, cleanRut);
                setTecEncontrado(true);
            }
        } catch (error) {} finally {
            setSearchingTec(false);
        }
    };

    const handleRutChange = (val) => {
        const formatted = formatRut(val);
        setFormVehicular(p => ({ ...p, rutTrabajador: formatted }));
        setTecEncontrado(false);
        clearTimeout(debounceRef.current);
        const cleanRut = normalizeRut(val);
        if (cleanRut.length >= 7) {
            debounceRef.current = setTimeout(() => handleSearchRut(val), 500);
        }
    };

    const handleGetGps = () => {
        if (!navigator.geolocation) return showAlert('GPS NO DISPONIBLE', 'error');
        navigator.geolocation.getCurrentPosition(pos => {
            const val = `${pos.coords.latitude},${pos.coords.longitude}`;
            setFormVehicular(p => ({ ...p, gps: val }));
            showAlert('GPS CAPTURADO', 'success');
        }, () => showAlert('ERROR GPS', 'error'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    };

    const resizeImage = (base64Str, maxWidth = 1200, maxHeight = 1200) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
                } else {
                    if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        });
    };

    const handlePhoto = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) return showAlert('LA IMAGEN ES DEMASIADO GRANDE', 'error');

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const optimized = await resizeImage(reader.result);
                setFotos(prev => {
                    const newFotos = [...prev];
                    newFotos[index] = optimized;
                    return newFotos;
                });
            } catch (err) {
                showAlert('ERROR AL PROCESAR LA IMAGEN', 'error');
            }
        };
        reader.readAsDataURL(file);
    };

    const updateChecklist = (index, field, value) => {
        setFormVehicular(prev => {
            const checklist = [...prev.vehicular.checklist];
            checklist[index] = { ...checklist[index], [field]: value };
            return { ...prev, vehicular: { ...prev.vehicular, checklist } };
        });
    };

    const handleSubmit = async () => {
        if (!formVehicular.nombreTrabajador || !formVehicular.rutTrabajador || !formVehicular.empresa)
            return showAlert('COMPLETE LOS CAMPOS DEL CONDUCTOR (RUT, NOMBRE Y EMPRESA)', 'error');
        if (!formVehicular.vehicular.patente || !formVehicular.vehicular.kilometraje)
            return showAlert('INGRESE PATENTE Y KILOMETRAJE', 'error');
        if (!formVehicular.inspector?.firma)
            return showAlert('SE REQUIERE FIRMA DEL INSPECTOR HSE', 'error');

        const faltaFirmaConductor = !firmaColaborador?.imagenBase64;
        const observacionFirmaPendiente = faltaFirmaConductor ? 'OBSERVACION AUTOMATICA: CONDUCTOR SIN FIRMA. INSPECCION ENVIADA A REVISION PARA REGULARIZAR Y FIRMAR.' : '';

        setSaving(true);
        try {
            await inspeccionesApi.create({
                ...formVehicular,
                tipo: 'vehicular',
                estado: 'En Revisión',
                fotoEvidencia: fotos.filter(f => f !== null),
                observaciones: [formVehicular.observaciones, observacionFirmaPendiente].filter(Boolean).join(' | '),
                firmaColaborador: {
                    nombre: formVehicular.nombreTrabajador,
                    rut: formVehicular.rutTrabajador,
                    email: formVehicular.emailTrabajador,
                    firma: firmaColaborador?.imagenBase64 || null,
                    firmaId: firmaColaborador?.firmaId || null,
                    timestamp: firmaColaborador?.timestamp || null
                }
            });

            const deficientes = formVehicular.vehicular.checklist.filter(i => i.estado === 'Malo').length;
            
            let successMessage = 'INSPECCIÓN VEHICULAR CONFORME';
            if (faltaFirmaConductor) {
                successMessage = 'INSPECCIÓN GUARDADA SIN FIRMA DEL CONDUCTOR';
            } else if (deficientes > 0) {
                successMessage = `ALERTA HSE GENERADA — ${deficientes} DEFICIENCIAS VEHICULARES`;
            }

            if (onSuccess) onSuccess(successMessage);
            onClose();
        } catch (e) {
            console.error('Error guardando inspección vehicular:', e);
            showAlert('ERROR AL GUARDAR: ' + (e.response?.data?.error || e.message), 'error');
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const deficientes = formVehicular.vehicular.checklist.filter(i => i.estado === 'Malo').length;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-4xl bg-slate-50 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* HEADER */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 sticky top-0 z-20 flex items-center justify-between shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Inspección <span className="text-blue-600">Vehicular</span></h2>
                        <p className={`text-[9px] font-black uppercase tracking-[0.3em] mt-2 ${deficientes > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {deficientes > 0 ? `⚠ ${deficientes} DEFICIENCIAS GRAVES DETECTADAS` : '✓ Vehículo en condiciones óptimas'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-full transition-all text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 pb-32">
                    
                    {/* DATOS DEL VEHÍCULO */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={Truck} title="Datos del Vehículo" accent="blue" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-1.5 text-left relative">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                                    Patente *
                                    {vehiculoEncontrado && <span className="text-emerald-500 text-[8px] font-black uppercase">✓ Flota</span>}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="AA-BB-11"
                                        className={`w-full px-5 py-3.5 rounded-2xl font-black text-[14px] uppercase outline-none transition-all ${vehiculoEncontrado && formVehicular.vehicular.patente ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 focus:ring-4 focus:ring-emerald-500/10' : 'bg-white border border-slate-200 focus:ring-4 focus:ring-blue-500/10'}`}
                                        value={formVehicular.vehicular.patente || ''}
                                        onChange={e => handlePatenteChange(e.target.value)}
                                    />
                                    {searchingVehiculo && <Loader2 className="absolute right-4 top-3.5 animate-spin text-blue-500" size={16} />}
                                </div>
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Kilometraje Actual *</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 120500"
                                    className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-[11px] uppercase outline-none focus:ring-4 focus:ring-blue-500/10"
                                    value={formVehicular.vehicular.kilometraje || ''}
                                    onChange={e => setFormVehicular(p => ({ ...p, vehicular: { ...p.vehicular, kilometraje: e.target.value } }))}
                                />
                            </div>
                            <div className="space-y-1.5 text-left">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Combustible</label>
                                <select
                                    className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-[11px] uppercase outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none"
                                    value={formVehicular.vehicular.nivelCombustible}
                                    onChange={e => setFormVehicular(p => ({ ...p, vehicular: { ...p.vehicular, nivelCombustible: e.target.value } }))}
                                >
                                    {['Reserva', '1/4', '1/2', '3/4', 'Lleno'].map(val => (
                                        <option key={val} value={val}>{val}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* IDENTIFICACIÓN CONDUCTOR */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <SectionTitle icon={User} title="Identificación del Conductor" accent="blue" />
                        <IdentificacionSection
                            form={formVehicular}
                            setForm={setFormVehicular}
                            formType="vehicular"
                            tecEncontrado={tecEncontrado}
                            searchingTec={searchingTec}
                            handleRutChange={handleRutChange}
                            handleSearchRut={handleSearchRut}
                            handleGetGps={handleGetGps}
                            esVehicular={true}
                        />
                    </div>

                    {/* CHECKLIST VEHICULAR */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <SectionTitle icon={FileText} title="Checklist Vehicular" accent="blue" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revise el estado de cada ítem.</p>
                        
                        <div className="space-y-8">
                            {VEHICULAR_CATEGORIAS.map((cat, catIdx) => {
                                const Icon = cat.icon;
                                return (
                                    <div key={cat.categoria} className="space-y-4">
                                        <h3 className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">
                                            <Icon size={14} className="text-blue-500" /> {cat.categoria}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {cat.items.map((itemName) => {
                                                const globalIndex = formVehicular.vehicular.checklist.findIndex(i => i.item === itemName);
                                                const item = formVehicular.vehicular.checklist[globalIndex];
                                                if (!item) return null;
                                                return (
                                                    <div key={itemName} className={`p-4 rounded-2xl border transition-all ${item.estado === 'Malo' ? 'bg-rose-50 border-rose-200' : item.estado === 'Regular' ? 'bg-amber-50 border-amber-200' : item.estado === 'N/A' ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-blue-200'}`}>
                                                        <span className="block text-[10px] font-black text-slate-700 uppercase tracking-tight mb-3">{item.item}</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {['Bueno', 'Regular', 'Malo', 'N/A'].map(est => (
                                                                <button
                                                                    key={est}
                                                                    onClick={() => updateChecklist(globalIndex, 'estado', est)}
                                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex-1 text-center ${item.estado === est
                                                                        ? est === 'Bueno' ? 'bg-emerald-500 text-white shadow-md'
                                                                        : est === 'Malo' ? 'bg-rose-600 text-white shadow-md'
                                                                        : est === 'Regular' ? 'bg-amber-500 text-white shadow-md'
                                                                        : 'bg-slate-700 text-white shadow-md'
                                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                >
                                                                    {est}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* FOTOS Y OBSERVACIONES */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={Camera} title="Observaciones y Evidencia" accent="blue" />
                        <textarea
                            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase min-h-[80px] outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"
                            placeholder="DESCRIPCIÓN DE DAÑOS U OBSERVACIONES ADICIONALES..."
                            value={formVehicular.observaciones}
                            onChange={e => setFormVehicular(p => ({ ...p, observaciones: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            {[0, 1, 2, 3].map(idx => (
                                <label key={idx} className="flex flex-col items-center gap-3 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group">
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(idx, e)} />
                                    {fotos[idx] ? (
                                        <div className="relative w-full aspect-square">
                                            <img src={fotos[idx]} className="w-full h-full object-cover rounded-xl border-2 border-blue-200" alt={`evidencia-${idx}`} />
                                            <button onClick={(e) => { e.preventDefault(); setFotos(prev => { const nf = [...prev]; nf[idx] = null; return nf; }); }} className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-blue-300 transition-all"><Camera size={24} className="text-slate-300 group-hover:text-blue-400 transition-colors" /></div>
                                    )}
                                    <p className="text-[8px] font-black uppercase text-slate-400">{fotos[idx] ? 'Capturada' : `Foto ${idx + 1}`}</p>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FIRMAS */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={PenTool} title="Firmas — Inspector y Conductor" accent="blue" />
                        <FirmaSection form={formVehicular} setForm={setFormVehicular} tecEncontrado={tecEncontrado} firmaColaborador={firmaColaborador} setFirmaColaborador={setFirmaColaborador} esVehicular={true} />
                    </div>

                    {deficientes > 0 && (
                        <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-8 flex items-center gap-6 animate-in zoom-in-95">
                            <div className="bg-rose-600 text-white p-4 rounded-2xl flex-shrink-0"><AlertTriangle size={24} /></div>
                            <div>
                                <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide">Alerta de Seguridad Vial</p>
                                <p className="text-[9px] font-bold text-rose-500 uppercase mt-1">{deficientes} deficiencias graves detectadas. Se registrará una alerta automática para el departamento de Flota.</p>
                            </div>
                        </div>
                    )}

                </div>

                {/* BOTTOM FIXED BAR */}
                <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white border-t border-slate-100 p-6 flex justify-end gap-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <button onClick={onClose} className="px-8 py-4 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} className={`px-10 py-4 text-white rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl flex items-center gap-3 disabled:opacity-50 ${deficientes > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-blue-600'}`}>
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {deficientes > 0 ? 'Registrar y Alertar' : 'Registrar Inspección'}
                    </button>
                </div>
            </div>
            <AlertModal alert={alert} setAlert={setAlert} />
        </div>
    );
};

export default SlideOverInspVehicular;
