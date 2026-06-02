import React, { useState, useEffect, useRef } from 'react';
import { X, HardHat, Camera, PenTool, Save, Loader2, User, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { IdentificacionSection, FirmaSection, SectionTitle, AlertModal } from './SharedComponents';
import { inspeccionesApi } from '../../prevencionApi';
import api from '../../../../api/api';
import { formatRut } from '../../../../utils/rutUtils';

const EPP_CATALOGO = [
    'Casco Dieléctrico con Chinstrap',
    'Lentes de Seguridad',
    'Guantes de Cabritilla',
    'Chaleco Reflectante',
    'Zapatos Dieléctricos',
    'Arnés de 4 Argollas',
    'Cuerda de Vida / Estrobos',
    'Línea de Vida Vertical',
    'Guantes Dieléctricos (Clase 0/2)',
    'Ropa Ignífuga (Arc Flash)',
    'Protector Solar',
    'Protector Auditivo'
];

const SlideOverInspEpp = ({ isOpen, onClose, rutsPermitidos = [], mostrarSoloPermitidos = false, onSuccess }) => {
    const normalizeRut = (value = '') => String(value).replace(/[^0-9kK]/g, '').toUpperCase();
    const rutsPermitidosSet = new Set((rutsPermitidos || []).map(r => normalizeRut(r)));

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [fotos, setFotos] = useState([null, null, null, null]);
    const [firmaColaborador, setFirmaColaborador] = useState(null);

    // --- BÚSQUEDA DE TÉCNICO ---
    const [searchingTec, setSearchingTec] = useState(false);
    const [tecEncontrado, setTecEncontrado] = useState(false);
    const debounceRef = useRef(null);

    const [formEpp, setFormEpp] = useState({
        empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
        lugarInspeccion: '', gps: '', emailTrabajador: '',
        itemsEpp: EPP_CATALOGO.map(nombre => ({ nombre, tiene: false, condicion: 'N/A' })),
        observaciones: '',
        inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
    });

    useEffect(() => {
        if (!isOpen) {
            setFormEpp({
                empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
                lugarInspeccion: '', gps: '', emailTrabajador: '',
                itemsEpp: EPP_CATALOGO.map(nombre => ({ nombre, tiene: false, condicion: 'N/A' })),
                observaciones: '',
                inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
            });
            setFotos([null, null, null, null]);
            setFirmaColaborador(null);
            setTecEncontrado(false);
            setAlert(null);
        }
    }, [isOpen]);

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };

    const applyTrabajadorData = (persona, cleanRut) => {
        const nombreCompleto = (persona?.nombres && persona?.apellidos)
            ? `${persona.nombres} ${persona.apellidos}`
            : (persona?.fullName || persona?.nombre || '');
        const cargo = persona?.cargo || persona?.position || persona?.hiring?.position || '';
        const empresa = persona?.empresa || persona?.empresaOrigen || persona?.empresaRef?.nombre || persona?.projectId?.nombreProyecto || persona?.projectName || '';
        const email = persona?.email || '';

        setFormEpp(p => ({
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

        if (mostrarSoloPermitidos && rutsPermitidosSet.size > 0 && !rutsPermitidosSet.has(cleanRut)) {
            showAlert('El trabajador no está vinculado a este supervisor', 'error');
            return;
        }

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
        setFormEpp(p => ({ ...p, rutTrabajador: formatted }));
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
            setFormEpp(p => ({ ...p, gps: val }));
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

    const updateItemEpp = (index, field, value) => {
        setFormEpp(prev => {
            const items = [...prev.itemsEpp];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, itemsEpp: items };
        });
    };

    const handleSubmit = async () => {
        if (!formEpp.nombreTrabajador || !formEpp.rutTrabajador || !formEpp.empresa)
            return showAlert('COMPLETE LOS CAMPOS OBLIGATORIOS', 'error');
        if (!formEpp.inspector?.firma)
            return showAlert('SE REQUIERE FIRMA DEL INSPECTOR HSE', 'error');

        const faltaFirmaTecnico = !firmaColaborador?.imagenBase64;
        const observacionFirmaPendiente = faltaFirmaTecnico ? 'OBSERVACION AUTOMATICA: TECNICO SIN FIRMA. INSPECCION ENVIADA A REVISION PARA REGULARIZAR Y FIRMAR.' : '';

        setSaving(true);
        try {
            await inspeccionesApi.create({
                ...formEpp,
                tipo: 'epp',
                estado: 'En Revisión',
                fotoEvidencia: fotos.filter(f => f !== null),
                observaciones: [formEpp.observaciones, observacionFirmaPendiente].filter(Boolean).join(' | '),
                firmaColaborador: {
                    nombre: formEpp.nombreTrabajador,
                    rut: formEpp.rutTrabajador,
                    email: formEpp.emailTrabajador,
                    firma: firmaColaborador?.imagenBase64 || null,
                    firmaId: firmaColaborador?.firmaId || null,
                    timestamp: firmaColaborador?.timestamp || null
                }
            });

            const deficientes = formEpp.itemsEpp.filter(i => !i.tiene || i.condicion === 'Malo').length;
            
            let successMessage = 'INSPECCIÓN EPP CONFORME';
            if (faltaFirmaTecnico) {
                successMessage = 'INSPECCIÓN GUARDADA SIN FIRMA DEL TÉCNICO';
            } else if (deficientes > 0) {
                successMessage = `ALERTA HSE GENERADA — ${deficientes} ÍTEMS DEFICIENTES`;
            }

            if (onSuccess) onSuccess(successMessage);
            onClose();
        } catch (e) {
            console.error('Error guardando inspección EPP:', e);
            showAlert('ERROR AL GUARDAR: ' + (e.response?.data?.error || e.message), 'error');
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const deficientes = formEpp.itemsEpp.filter(i => !i.tiene || i.condicion === 'Malo').length;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-4xl bg-slate-50 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* HEADER TIPO WIZARD */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 sticky top-0 z-20 flex items-center justify-between shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Inspección EPP <span className="text-orange-500">Protección Personal</span></h2>
                        <p className={`text-[9px] font-black uppercase tracking-[0.3em] mt-2 ${deficientes > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {deficientes > 0 ? `⚠ ${deficientes} ÍTEMS DEFICIENTES DETECTADOS` : '✓ Todos los ítems OK'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-orange-50 hover:text-orange-500 rounded-full transition-all text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 pb-32">
                    {/* IDENTIFICACIÓN */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <SectionTitle icon={User} title="Identificación del Trabajador" accent="orange" />
                        <IdentificacionSection
                            form={formEpp}
                            setForm={setFormEpp}
                            formType="epp"
                            tecEncontrado={tecEncontrado}
                            searchingTec={searchingTec}
                            handleRutChange={handleRutChange}
                            handleSearchRut={handleSearchRut}
                            handleGetGps={handleGetGps}
                        />
                    </div>

                    {/* CHECKLIST EPP */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-4">
                        <SectionTitle icon={HardHat} title="Revisión ítem por ítem de EPP" accent="orange" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Marque si el trabajador TIENE el ítem y seleccione su condición.</p>
                        <div className="space-y-3 mt-4">
                            {formEpp.itemsEpp.map((item, i) => (
                                <div key={i} className={`flex items-center gap-4 p-5 rounded-2xl border transition-all ${!item.tiene ? 'bg-rose-50 border-rose-100' : item.condicion === 'Malo' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <button
                                        type="button"
                                        onClick={() => updateItemEpp(i, 'tiene', !item.tiene)}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all border-2 flex-shrink-0 ${item.tiene ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-300'}`}
                                    >
                                        {item.tiene ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                    </button>
                                    <span className={`flex-1 text-[11px] font-black uppercase tracking-tight ${!item.tiene ? 'text-rose-700' : item.condicion === 'Malo' ? 'text-amber-700' : 'text-emerald-700'}`}>{item.nombre}</span>
                                    {item.tiene && (
                                        <div className="flex gap-2">
                                            {['Bueno', 'Malo'].map(cond => (
                                                <button
                                                    key={cond}
                                                    type="button"
                                                    onClick={() => updateItemEpp(i, 'condicion', cond)}
                                                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${item.condicion === cond
                                                        ? cond === 'Bueno' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                                        : 'bg-white border border-slate-200 text-slate-400'}`}
                                                >
                                                    {cond}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {!item.tiene && <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">AUSENTE</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* FOTOS Y OBSERVACIONES */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={Camera} title="Observaciones y Evidencia" accent="orange" />
                        <textarea
                            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase min-h-[80px] outline-none focus:ring-4 focus:ring-orange-500/10 resize-none"
                            placeholder="OBSERVACIONES ADICIONALES..."
                            value={formEpp.observaciones}
                            onChange={e => setFormEpp(p => ({ ...p, observaciones: e.target.value }))}
                        />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            {[0, 1, 2, 3].map(idx => (
                                <label key={idx} className="flex flex-col items-center gap-3 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition-all group">
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(idx, e)} />
                                    {fotos[idx] ? (
                                        <div className="relative w-full aspect-square">
                                            <img src={fotos[idx]} className="w-full h-full object-cover rounded-xl border-2 border-orange-200" alt={`evidencia-${idx}`} />
                                            <button onClick={(e) => { e.preventDefault(); setFotos(prev => { const nf = [...prev]; nf[idx] = null; return nf; }); }} className="absolute -top-2 -right-2 bg-orange-600 text-white rounded-full p-1 shadow-lg"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-orange-300 transition-all"><Camera size={24} className="text-slate-300 group-hover:text-orange-400 transition-colors" /></div>
                                    )}
                                    <p className="text-[8px] font-black uppercase text-slate-400">{fotos[idx] ? 'Capturada' : `Foto ${idx + 1}`}</p>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FIRMAS */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={PenTool} title="Firmas — Inspector y Trabajador" accent="orange" />
                        <FirmaSection form={formEpp} setForm={setFormEpp} tecEncontrado={tecEncontrado} firmaColaborador={firmaColaborador} setFirmaColaborador={setFirmaColaborador} />
                    </div>

                    {deficientes > 0 && (
                        <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-8 flex items-center gap-6 animate-in zoom-in-95">
                            <div className="bg-rose-600 text-white p-4 rounded-2xl flex-shrink-0"><AlertTriangle size={24} /></div>
                            <div>
                                <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide">Alerta HSE Automática</p>
                                <p className="text-[9px] font-bold text-rose-500 uppercase mt-1">{deficientes} ítems deficientes detectados. Al guardar, se generará una notificación automática en la Consola HSE Audit para revisión inmediata.</p>
                            </div>
                        </div>
                    )}

                </div>

                {/* BOTTOM FIXED BAR */}
                <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white border-t border-slate-100 p-6 flex justify-end gap-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <button onClick={onClose} className="px-8 py-4 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} className={`px-10 py-4 text-white rounded-full font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl flex items-center gap-3 disabled:opacity-50 ${deficientes > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-orange-500'}`}>
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {deficientes > 0 ? 'Registrar y Alertar' : 'Registrar Inspección'}
                    </button>
                </div>
            </div>
            <AlertModal alert={alert} setAlert={setAlert} />
        </div>
    );
};

export default SlideOverInspEpp;
