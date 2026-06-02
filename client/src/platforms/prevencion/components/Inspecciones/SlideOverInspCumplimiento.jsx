import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Camera, PenTool, Save, Loader2, User } from 'lucide-react';
import { IdentificacionSection, FirmaSection, SectionTitle, CheckItem, AlertModal } from './SharedComponents';
import { inspeccionesApi } from '../../prevencionApi';
import api from '../../../../api/api';
import { formatRut } from '../../../../utils/rutUtils';

const SlideOverInspCumplimiento = ({ isOpen, onClose, rutsPermitidos = [], mostrarSoloPermitidos = false, onSuccess }) => {
    const normalizeRut = (value = '') => String(value).replace(/[^0-9kK]/g, '').toUpperCase();
    const rutsPermitidosSet = new Set((rutsPermitidos || []).map(r => normalizeRut(r)));

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [fotos, setFotos] = useState([null, null, null, null]);
    const [firmaColaborador, setFirmaColaborador] = useState(null);

    // --- BÚSQUEDA DE TÉCNICO (Autocompletado) ---
    const [searchingTec, setSearchingTec] = useState(false);
    const [tecEncontrado, setTecEncontrado] = useState(false);
    const debounceRef = useRef(null);

    const [formCumplimiento, setFormCumplimiento] = useState({
        empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
        lugarInspeccion: '', gps: '', emailTrabajador: '',
        cumplimiento: {
            tieneAst: false, astNumero: '',
            tienePts: false, ptsNumero: '',
            tieneEpp: false, eppCompleto: false,
            inductionRealizada: false,
            observacionesCumplimiento: ''
        },
        observaciones: '',
        inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
    });

    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setFormCumplimiento({
                empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
                lugarInspeccion: '', gps: '', emailTrabajador: '',
                cumplimiento: { tieneAst: false, astNumero: '', tienePts: false, ptsNumero: '', tieneEpp: false, eppCompleto: false, inductionRealizada: false, observacionesCumplimiento: '' },
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

        setFormCumplimiento(p => ({
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
        } catch (error) {
            // no encontrado
        } finally {
            setSearchingTec(false);
        }
    };

    const handleRutChange = (val) => {
        const formatted = formatRut(val);
        setFormCumplimiento(p => ({ ...p, rutTrabajador: formatted }));
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
            setFormCumplimiento(p => ({ ...p, gps: val }));
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

    const handleSubmit = async () => {
        if (!formCumplimiento.nombreTrabajador || !formCumplimiento.rutTrabajador || !formCumplimiento.empresa)
            return showAlert('COMPLETE LOS CAMPOS OBLIGATORIOS', 'error');
        if (!formCumplimiento.inspector?.firma)
            return showAlert('SE REQUIERE FIRMA DEL INSPECTOR HSE', 'error');

        const faltaFirmaTecnico = !firmaColaborador?.imagenBase64;
        const observacionFirmaPendiente = faltaFirmaTecnico ? 'OBSERVACION AUTOMATICA: TECNICO SIN FIRMA. INSPECCION ENVIADA A REVISION PARA REGULARIZAR Y FIRMAR.' : '';

        setSaving(true);
        try {
            await inspeccionesApi.create({
                ...formCumplimiento,
                tipo: 'cumplimiento-prevencion',
                estado: 'En Revisión',
                fotoEvidencia: fotos.filter(f => f !== null),
                observaciones: [formCumplimiento.observaciones, observacionFirmaPendiente].filter(Boolean).join(' | '),
                firmaColaborador: {
                    nombre: formCumplimiento.nombreTrabajador,
                    rut: formCumplimiento.rutTrabajador,
                    email: formCumplimiento.emailTrabajador,
                    firma: firmaColaborador?.imagenBase64 || null,
                    firmaId: firmaColaborador?.firmaId || null,
                    timestamp: firmaColaborador?.timestamp || null
                }
            });
            if (onSuccess) onSuccess(faltaFirmaTecnico ? 'INSPECCIÓN GUARDADA SIN FIRMA DEL TÉCNICO' : 'INSPECCIÓN REGISTRADA');
            onClose();
        } catch (e) {
            console.error('Error guardando inspección cumplimiento:', e);
            showAlert('ERROR AL GUARDAR: ' + (e.response?.data?.error || e.message), 'error');
        } finally { setSaving(false); }
    };

    if (!isOpen) return null;

    const c = formCumplimiento.cumplimiento;
    const conformes = [c.tieneAst, c.tienePts, c.tieneEpp, c.inductionRealizada].filter(Boolean).length;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-4xl bg-slate-50 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* HEADER TIPO WIZARD */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 sticky top-0 z-20 flex items-center justify-between shadow-sm">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Insp. Cumplimiento <span className="text-rose-600">de Prevención</span></h2>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-600 rounded-full transition-all duration-500" style={{ width: `${(conformes / 4) * 100}%` }} />
                            </div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{conformes}/4 Conformes</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-all text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 pb-32">
                    {/* IDENTIFICACIÓN */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8">
                        <SectionTitle icon={User} title="Identificación del Trabajador" />
                        <IdentificacionSection
                            form={formCumplimiento}
                            setForm={setFormCumplimiento}
                            formType="cumplimiento"
                            tecEncontrado={tecEncontrado}
                            searchingTec={searchingTec}
                            handleRutChange={handleRutChange}
                            handleSearchRut={handleSearchRut}
                            handleGetGps={handleGetGps}
                        />
                    </div>

                    {/* CHECKLIST */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={ShieldCheck} title="Checklist de Cumplimiento Normativo" />
                        <div className="space-y-4">
                            <CheckItem label="Posee AST Vigente (Análisis Seguro de Trabajo)" checked={c.tieneAst} onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tieneAst: v } }))}>
                                {c.tieneAst && <input type="text" placeholder="Nº OT / Folio AST" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase outline-none mt-2" value={c.astNumero} onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, astNumero: e.target.value } }))} />}
                            </CheckItem>
                            <CheckItem label="Posee PTS Asignado (Procedimiento de Trabajo Seguro)" checked={c.tienePts} onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tienePts: v } }))}>
                                {c.tienePts && <input type="text" placeholder="Código / Nombre del PTS" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase outline-none mt-2" value={c.ptsNumero} onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, ptsNumero: e.target.value } }))} />}
                            </CheckItem>
                            <CheckItem label="Porta EPP Requerido por la Empresa" checked={c.tieneEpp} onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tieneEpp: v } }))}>
                                {c.tieneEpp && <CheckItem small label="EPP en buen estado y completo" checked={c.eppCompleto} onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, eppCompleto: v } }))} />}
                            </CheckItem>
                            <CheckItem label="Inducción / Charla de Seguridad Realizada" checked={c.inductionRealizada} onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, inductionRealizada: v } }))} />
                        </div>
                        <div className="space-y-1.5 pt-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Observaciones del Cumplimiento</label>
                            <textarea className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase min-h-[80px] outline-none focus:ring-4 focus:ring-rose-500/10 resize-none" placeholder="ANOTE CUALQUIER OBSERVACIÓN RELEVANTE..." value={c.observacionesCumplimiento} onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, observacionesCumplimiento: e.target.value } }))} />
                        </div>
                    </div>

                    {/* FOTO EVIDENCIA */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-4">
                        <SectionTitle icon={Camera} title="Evidencia Fotográfica (4 Fotos)" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map(idx => (
                                <label key={idx} className="flex flex-col items-center gap-3 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all group">
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(idx, e)} />
                                    {fotos[idx] ? (
                                        <div className="relative w-full aspect-square">
                                            <img src={fotos[idx]} className="w-full h-full object-cover rounded-xl border-2 border-rose-200" alt={`evidencia-${idx}`} />
                                            <button onClick={(e) => { e.preventDefault(); setFotos(prev => { const nf = [...prev]; nf[idx] = null; return nf; }); }} className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-lg"><X size={12} /></button>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-rose-300 transition-all"><Camera size={24} className="text-slate-300 group-hover:text-rose-400 transition-colors" /></div>
                                    )}
                                    <p className="text-[8px] font-black uppercase text-slate-400">{fotos[idx] ? 'Capturada' : `Foto ${idx + 1}`}</p>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FIRMAS */}
                    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
                        <SectionTitle icon={PenTool} title="Firmas — Inspector y Trabajador" />
                        <FirmaSection form={formCumplimiento} setForm={setFormCumplimiento} tecEncontrado={tecEncontrado} firmaColaborador={firmaColaborador} setFirmaColaborador={setFirmaColaborador} />
                    </div>

                </div>

                {/* BOTTOM FIXED BAR */}
                <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white border-t border-slate-100 p-6 flex justify-end gap-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <button onClick={onClose} className="px-8 py-4 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} className="px-10 py-4 bg-slate-900 text-white rounded-full font-black uppercase tracking-[0.2em] text-xs hover:bg-rose-600 transition-all shadow-xl flex items-center gap-3 disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Registrar Inspección
                    </button>
                </div>
            </div>
            <AlertModal alert={alert} setAlert={setAlert} />
        </div>
    );
};

export default SlideOverInspCumplimiento;
