import React, { useState, useEffect, useRef } from 'react';
import {
    ClipboardList, ShieldCheck, HardHat, CheckCircle2, X, AlertTriangle,
    Save, Loader2, User, MapPin, ChevronRight, Eye,
    PenTool, Trash2, Camera, XCircle
} from 'lucide-react';
import { inspeccionesApi } from '../prevencionApi';
import api from '../../../api/api';
import { formatRut } from '../../../utils/rutUtils';
import FirmaAvanzada from '../../../components/FirmaAvanzada';

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



const PrevInspecciones = ({ rutsPermitidos = [], mostrarSoloPermitidos = false }) => {
    const rutsPermitidosSet = new Set((rutsPermitidos || []).map(r => String(r || '').replace(/[^0-9kK]/g, '').toUpperCase()));
    const [view, setView] = useState('menu');       // 'menu', 'form-cumplimiento', 'form-epp', 'list'
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [inspecciones, setInspecciones] = useState([]);
    const [filterTipo, setFilterTipo] = useState('');
    const [alert, setAlert] = useState(null);
    const [fotos, setFotos] = useState([null, null, null, null]);
    const [firmaColaborador, setFirmaColaborador] = useState(null);

    // --- BÚSQUEDA DE TÉCNICO (Autocompletado) ---
    const [searchingTec, setSearchingTec] = useState(false);
    const [tecEncontrado, setTecEncontrado] = useState(false);
    const debounceRef = useRef(null);

    const handleSearchRut = async (rut, setForm) => {
        const cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
        if (cleanRut.length < 7) return;

        if (mostrarSoloPermitidos && rutsPermitidosSet.size > 0 && !rutsPermitidosSet.has(cleanRut)) {
            showAlert('El trabajador no está vinculado a este supervisor', 'error');
            return;
        }

        setTecEncontrado(false);
        setSearchingTec(true);
        try {
            const res = await api.get(`/api/tecnicos/rut/${cleanRut}`);
            if (res.data) {
                const tec = res.data;
                const nombreCompleto = tec.nombres && tec.apellidos
                    ? `${tec.nombres} ${tec.apellidos}`
                    : tec.nombre || '';
                setForm(p => ({
                    ...p,
                    rutTrabajador: formatRut(cleanRut),
                    nombreTrabajador: nombreCompleto,
                    cargoTrabajador: tec.cargo || p.cargoTrabajador,
                    empresa: tec.empresa || p.empresa,
                    emailTrabajador: tec.email || p.emailTrabajador,
                }));
                setTecEncontrado(true);
            }
        } catch (error) {
            // no encontrado — el usuario puede escribir manualmente
        } finally {
            setSearchingTec(false);
        }
    };

    const handleRutChange = (val, setForm) => {
        const formatted = formatRut(val);
        setForm(p => ({ ...p, rutTrabajador: formatted }));
        setTecEncontrado(false);
        clearTimeout(debounceRef.current);
        const cleanRut = val.replace(/[^0-9kK]/g, '');
        if (cleanRut.length >= 7) {
            debounceRef.current = setTimeout(() => handleSearchRut(val, setForm), 500);
        }
    };

    // --- FORMULARIO CUMPLIMIENTO ---
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

    // --- FORMULARIO EPP ---
    const [formEpp, setFormEpp] = useState({
        empresa: '', ot: '', nombreTrabajador: '', rutTrabajador: '', cargoTrabajador: '',
        lugarInspeccion: '', gps: '', emailTrabajador: '',
        itemsEpp: EPP_CATALOGO.map(nombre => ({ nombre, tiene: false, condicion: 'N/A' })),
        observaciones: '',
        inspector: { nombre: '', cargo: '', rut: '', email: '', firma: null, firmaId: null, timestamp: null }
    });

    const showAlert = (message, type = 'info', onConfirm = null) => {
        setAlert({ message, type, onConfirm });
        if (type !== 'confirm') setTimeout(() => setAlert(null), 4000);
    };

    useEffect(() => {
        if (view === 'list') fetchInspecciones();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, filterTipo, mostrarSoloPermitidos, rutsPermitidos.length]);

    const fetchInspecciones = async () => {
        setLoading(true);
        try {
            const params = filterTipo ? { tipo: filterTipo } : {};
            const res = await inspeccionesApi.getAll(params);
            let data = res.data || [];
            if (mostrarSoloPermitidos && rutsPermitidosSet.size > 0) {
                data = data.filter(insp => {
                    const r = String(insp.rutTrabajador || '').replace(/[^0-9kK]/g, '').toUpperCase();
                    return r && rutsPermitidosSet.has(r);
                });
            }
            setInspecciones(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleGetGps = async (formType) => {
        if (!navigator.geolocation) return showAlert('GPS NO DISPONIBLE', 'error');
        navigator.geolocation.getCurrentPosition(pos => {
            const val = `${pos.coords.latitude},${pos.coords.longitude}`;
            if (formType === 'cumplimiento') setFormCumplimiento(p => ({ ...p, gps: val }));
            else setFormEpp(p => ({ ...p, gps: val }));
            showAlert('GPS CAPTURADO', 'success');
        }, () => showAlert('ERROR GPS', 'error'));
    };

    const handlePhoto = (index, e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setFotos(prev => {
                const newFotos = [...prev];
                newFotos[index] = reader.result;
                return newFotos;
            });
        };
        reader.readAsDataURL(file);
    };


    const handleSubmitCumplimiento = async () => {
        if (!formCumplimiento.nombreTrabajador || !formCumplimiento.rutTrabajador || !formCumplimiento.empresa)
            return showAlert('COMPLETE LOS CAMPOS OBLIGATORIOS', 'error');
        if (!formCumplimiento.inspector?.firma)
            return showAlert('SE REQUIERE FIRMA DEL INSPECTOR HSE', 'error');
        if (!firmaColaborador?.firma)
            return showAlert('SE REQUIERE FIRMA DEL TRABAJADOR INSPECCIONADO', 'error');
        setSaving(true);
        try {
            await inspeccionesApi.create({
                ...formCumplimiento,
                tipo: 'cumplimiento-prevencion',
                fotoEvidencia: fotos.filter(f => f !== null),
                firmaColaborador: {
                    nombre: formCumplimiento.nombreTrabajador,
                    rut: formCumplimiento.rutTrabajador,
                    email: formCumplimiento.emailTrabajador,
                    firma: firmaColaborador?.imagenBase64 || null,
                    firmaId: firmaColaborador?.firmaId || null,
                    timestamp: firmaColaborador?.timestamp || null
                }
            });
            showAlert('INSPECCIÓN REGISTRADA — CORREO ENVIADO AL SUPERVISOR Y TRABAJADOR', 'success');
            setView('list');
        } catch (e) { showAlert('ERROR AL GUARDAR', 'error'); }
        finally { setSaving(false); }
    };

    const handleSubmitEpp = async () => {
        if (!formEpp.nombreTrabajador || !formEpp.rutTrabajador || !formEpp.empresa)
            return showAlert('COMPLETE LOS CAMPOS OBLIGATORIOS', 'error');
        if (!formEpp.inspector?.firma)
            return showAlert('SE REQUIERE FIRMA DEL INSPECTOR HSE', 'error');
        if (!firmaColaborador?.firma)
            return showAlert('SE REQUIERE FIRMA DEL TRABAJADOR INSPECCIONADO', 'error');
        setSaving(true);
        try {
            await inspeccionesApi.create({
                ...formEpp,
                tipo: 'epp',
                fotoEvidencia: fotos.filter(f => f !== null),
                firmaColaborador: {
                    nombre: formEpp.nombreTrabajador,
                    rut: formEpp.rutTrabajador,
                    email: formEpp.emailTrabajador,
                    firma: firmaColaborador?.imagenBase64 || null,
                    firmaId: firmaColaborador?.firmaId || null,
                    timestamp: firmaColaborador?.timestamp || null
                }
            });
            const itemsMalos = formEpp.itemsEpp.filter(i => !i.tiene || i.condicion === 'Malo');
            if (itemsMalos.length > 0) {
                showAlert(`ALERTA HSE GENERADA — ${itemsMalos.length} ÍTEMS DEFICIENTES. CORREO ENVIADO.`, 'success');
            } else {
                showAlert('INSPECCIÓN EPP CONFORME — CORREO ENVIADO AL SUPERVISOR Y TRABAJADOR', 'success');
            }
            setView('list');
        } catch (e) { showAlert('ERROR AL GUARDAR', 'error'); }
        finally { setSaving(false); }
    };

    const updateItemEpp = (index, field, value) => {
        setFormEpp(prev => {
            const items = [...prev.itemsEpp];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, itemsEpp: items };
        });
    };

    const IdentificacionSection = ({ form, setForm, formType }) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
                ['rutTrabajador', 'RUT Trabajador *', 'text'],
                ['nombreTrabajador', 'Nombre del Trabajador *', 'text'],
                ['cargoTrabajador', 'Cargo', 'text'],
                ['empresa', 'Empresa *', 'text'],
                ['ot', 'OT / Proyecto', 'text'],
                ['lugarInspeccion', 'Lugar de Inspección', 'text'],
            ].map(([key, label]) => (
                <div key={key} className="space-y-1.5 text-left relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        {label}
                        {key === 'rutTrabajador' && tecEncontrado && (
                            <span className="text-emerald-500 text-[8px] font-black uppercase">✓ Encontrado</span>
                        )}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            className={`w-full px-5 py-3.5 rounded-2xl font-bold text-[11px] uppercase outline-none transition-all
                                ${key !== 'rutTrabajador' && tecEncontrado && form[key]
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 focus:ring-4 focus:ring-emerald-500/10'
                                    : 'bg-white border border-slate-200 focus:ring-4 focus:ring-rose-500/10'
                                }`}
                            value={form[key] || ''}
                            onChange={e => {
                                if (key === 'rutTrabajador') {
                                    handleRutChange(e.target.value, setForm);
                                } else {
                                    setForm(p => ({ ...p, [key]: e.target.value }));
                                }
                            }}
                            onBlur={() => {
                                if (key === 'rutTrabajador' && form.rutTrabajador && !tecEncontrado) {
                                    handleSearchRut(form.rutTrabajador, setForm);
                                }
                            }}
                        />
                        {key === 'rutTrabajador' && searchingTec && (
                            <Loader2 className="absolute right-4 top-3.5 animate-spin text-rose-500" size={16} />
                        )}
                        {key === 'rutTrabajador' && tecEncontrado && !searchingTec && (
                            <CheckCircle2 className="absolute right-4 top-3.5 text-emerald-500" size={16} />
                        )}
                    </div>
                </div>
            ))}
            <div className="space-y-1.5 text-left">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">GPS (Coordenadas)</label>
                <button
                    type="button"
                    onClick={() => handleGetGps(formType)}
                    className={`w-full px-5 py-3.5 rounded-2xl border font-bold text-[11px] uppercase transition-all flex items-center gap-3
                        ${form.gps ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600'}`}
                >
                    <MapPin size={16} />
                    {form.gps || 'Capturar Posición GPS'}
                </button>
            </div>
        </div>
    );

    const FirmaSection = ({ form, setForm }) => (
        <div className="space-y-8">
            {/* Firma Inspector HSE */}
            <div className="space-y-4">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.3em]">1. Inspector / Supervisor HSE</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {[['nombre', 'Nombre Inspector *'], ['cargo', 'Cargo Inspector'], ['rut', 'RUT Inspector'], ['email', 'Email Inspector']].map(([key, label]) => (
                        <div key={key} className="space-y-1.5 text-left">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
                            <input
                                type={key === 'email' ? 'email' : 'text'}
                                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-[11px] uppercase outline-none focus:ring-4 focus:ring-rose-500/10"
                                value={form.inspector?.[key] || ''}
                                onChange={e => setForm(p => ({ ...p, inspector: { ...p.inspector, [key]: e.target.value } }))}
                            />
                        </div>
                    ))}
                </div>
                <FirmaAvanzada
                    label="Firma del Inspector HSE"
                    rutFirmante={form.inspector?.rut || ''}
                    nombreFirmante={form.inspector?.nombre || ''}
                    emailFirmante={form.inspector?.email || ''}
                    onSave={(payload) => setForm(p => ({ ...p, inspector: { ...p.inspector, firma: payload?.imagenBase64 || null, firmaId: payload?.firmaId || null, timestamp: payload?.timestamp || null } }))}
                    colorAccent="rose"
                />
                {form.inspector?.firma && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Inspector firmó</span>
                    </div>
                )}
            </div>

            {/* Firma Trabajador */}
            <div className="space-y-4 pt-6 border-t border-slate-100">
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.3em]">2. Trabajador Inspeccionado</p>
                <div className="space-y-1.5 text-left relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        Email del Trabajador (para envío de informe)
                        {tecEncontrado && form.emailTrabajador && (
                            <span className="text-emerald-500 text-[8px] font-black uppercase">✓ Auto-completado</span>
                        )}
                    </label>
                    <div className="relative">
                        <input
                            type="email"
                            className={`w-full px-5 py-3.5 rounded-2xl font-bold text-[11px] outline-none transition-all focus:ring-4
                                ${tecEncontrado && form.emailTrabajador
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 focus:ring-emerald-500/10'
                                    : 'bg-white border border-slate-200 focus:ring-indigo-500/10'
                                }`}
                            value={form.emailTrabajador || ''}
                            placeholder="correo@ejemplo.com"
                            onChange={e => setForm(p => ({ ...p, emailTrabajador: e.target.value }))}
                        />
                        {tecEncontrado && form.emailTrabajador && (
                            <CheckCircle2 className="absolute right-4 top-3.5 text-emerald-500" size={16} />
                        )}
                    </div>
                </div>
                <FirmaAvanzada
                    label="Firma del Trabajador"
                    rutFirmante={form.rutTrabajador || ''}
                    nombreFirmante={form.nombreTrabajador || ''}
                    emailFirmante={form.emailTrabajador || ''}
                    onSave={(payload) => setFirmaColaborador(payload)}
                    colorAccent="blue"
                />
                {firmaColaborador?.firma && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-2xl w-fit">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Trabajador firmó</span>
                    </div>
                )}
            </div>
        </div>
    );

    // ─── VISTA MENÚ ───────────────────────────────────────────────────────────
    if (view === 'menu') {
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 md:p-10">
                <div className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-6">
                        <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl border-4 border-white transform -rotate-3">
                            <ClipboardList size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 italic tracking-tighter uppercase leading-none">
                                Módulo <span className="text-rose-600">Inspecciones</span>
                            </h1>
                            <p className="text-slate-500 text-[11px] font-black mt-2 uppercase tracking-[0.4em]">Control en Terreno · Gen AI v8.0</p>
                        </div>
                    </div>
                    <button onClick={() => setView('list')} className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-rose-600 font-black text-[10px] uppercase shadow-sm transition-all">
                        <Eye size={18} /> Ver Historial
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* OPCIÓN 1: CUMPLIMIENTO */}
                    <button onClick={() => setView('form-cumplimiento')} className="group bg-white rounded-[3rem] p-12 border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-rose-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-rose-50 rounded-full transition-all group-hover:scale-150 group-hover:bg-rose-100" />
                        <div className="relative z-10">
                            <div className="bg-rose-600 text-white p-5 rounded-[2rem] w-fit shadow-xl shadow-rose-200 mb-8 group-hover:scale-110 transition-transform">
                                <ShieldCheck size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                                Inspección Cumplimiento<br />
                                <span className="text-rose-600">de Prevención</span>
                            </h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase mt-4 leading-relaxed">
                                Verifica en terreno que el trabajador cumple con todas las normas preventivas: AST vigente, PTS asignado, EPP completo e inducción realizada.
                            </p>
                            <div className="flex items-center gap-3 mt-8 text-rose-600 font-black text-[11px] uppercase tracking-widest">
                                Nueva Inspección <ChevronRight size={18} className="group-hover:translate-x-2 transition-transform" />
                            </div>
                        </div>
                    </button>

                    {/* OPCIÓN 2: EPP */}
                    <button onClick={() => setView('form-epp')} className="group bg-white rounded-[3rem] p-12 border border-slate-100 shadow-lg hover:shadow-2xl hover:shadow-orange-100 hover:-translate-y-2 transition-all text-left relative overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-40 h-40 bg-orange-50 rounded-full transition-all group-hover:scale-150 group-hover:bg-orange-100" />
                        <div className="relative z-10">
                            <div className="bg-orange-500 text-white p-5 rounded-[2rem] w-fit shadow-xl shadow-orange-200 mb-8 group-hover:scale-110 transition-transform">
                                <HardHat size={40} />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight">
                                Inspección de EPP<br />
                                <span className="text-orange-500">Protección Personal</span>
                            </h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase mt-4 leading-relaxed">
                                Revisa ítem por ítem si el trabajador posee el equipo y en qué condiciones se encuentra. Genera alerta automática en consola HSE ante deficiencias.
                            </p>
                            <div className="flex items-center gap-3 mt-8 text-orange-500 font-black text-[11px] uppercase tracking-widest">
                                Nueva Inspección <ChevronRight size={18} className="group-hover:translate-x-2 transition-transform" />
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    // ─── FORMULARIO CUMPLIMIENTO ──────────────────────────────────────────────
    if (view === 'form-cumplimiento') {
        const c = formCumplimiento.cumplimiento;
        const conformes = [c.tieneAst, c.tienePts, c.tieneEpp, c.inductionRealizada].filter(Boolean).length;
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-20">
                <div className="flex items-center gap-4 mb-10">
                    <button onClick={() => { setView('menu'); setFirmaColaborador(null); }} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:text-rose-600 transition-all"><X size={20} /></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Insp. Cumplimiento <span className="text-rose-600">de Prevención</span></h1>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">{conformes}/4 Ítems Conformes</p>
                    </div>
                </div>
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* Progreso visual */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-600 rounded-full transition-all duration-500" style={{ width: `${(conformes / 4) * 100}%` }} />
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase mt-3 tracking-widest">Cumplimiento: {Math.round((conformes / 4) * 100)}%</p>
                    </div>

                    {/* IDENTIFICACIÓN */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-8">
                        <SectionTitle icon={User} title="Identificación del Trabajador" />
                        <IdentificacionSection form={formCumplimiento} setForm={setFormCumplimiento} formType="cumplimiento" />
                    </div>

                    {/* CHECKLIST CUMPLIMIENTO */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-6">
                        <SectionTitle icon={ShieldCheck} title="Checklist de Cumplimiento Normativo" />
                        <div className="space-y-4">
                            {/* AST */}
                            <CheckItem
                                label="Posee AST Vigente (Análisis Seguro de Trabajo)"
                                checked={c.tieneAst}
                                onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tieneAst: v } }))}
                            >
                                {c.tieneAst && (
                                    <input type="text" placeholder="Nº OT / Folio AST" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase outline-none mt-2"
                                        value={c.astNumero} onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, astNumero: e.target.value } }))} />
                                )}
                            </CheckItem>
                            {/* PTS */}
                            <CheckItem
                                label="Posee PTS Asignado (Procedimiento de Trabajo Seguro)"
                                checked={c.tienePts}
                                onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tienePts: v } }))}
                            >
                                {c.tienePts && (
                                    <input type="text" placeholder="Código / Nombre del PTS" className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase outline-none mt-2"
                                        value={c.ptsNumero} onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, ptsNumero: e.target.value } }))} />
                                )}
                            </CheckItem>
                            {/* EPP */}
                            <CheckItem
                                label="Porta EPP Requerido por la Empresa"
                                checked={c.tieneEpp}
                                onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, tieneEpp: v } }))}
                            >
                                {c.tieneEpp && (
                                    <CheckItem
                                        small
                                        label="EPP en buen estado y completo"
                                        checked={c.eppCompleto}
                                        onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, eppCompleto: v } }))}
                                    />
                                )}
                            </CheckItem>
                            {/* INDUCCIÓN */}
                            <CheckItem
                                label="Inducción / Charla de Seguridad Realizada"
                                checked={c.inductionRealizada}
                                onToggle={v => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, inductionRealizada: v } }))}
                            />
                        </div>
                        <div className="space-y-1.5 text-left pt-4">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Observaciones del Cumplimiento</label>
                            <textarea
                                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold uppercase min-h-[80px] outline-none focus:ring-4 focus:ring-rose-500/10 resize-none"
                                placeholder="ANOTE CUALQUIER OBSERVACIÓN RELEVANTE..."
                                value={c.observacionesCumplimiento}
                                onChange={e => setFormCumplimiento(p => ({ ...p, cumplimiento: { ...p.cumplimiento, observacionesCumplimiento: e.target.value } }))}
                            />
                        </div>
                    </div>

                    {/* FOTO EVIDENCIA (4 FOTOS) */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-4">
                        <SectionTitle icon={Camera} title="Evidencia Fotográfica (4 Fotos)" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map(idx => (
                                <label key={idx} className="flex flex-col items-center gap-3 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-rose-50 hover:border-rose-200 transition-all group">
                                    <input type="file" accept="image/*" className="hidden" onChange={e => handlePhoto(idx, e)} />
                                    {fotos[idx] ? (
                                        <div className="relative w-full aspect-square">
                                            <img src={fotos[idx]} className="w-full h-full object-cover rounded-xl border-2 border-rose-200" alt={`evidencia-${idx}`} />
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setFotos(prev => {
                                                        const nf = [...prev];
                                                        nf[idx] = null;
                                                        return nf;
                                                    });
                                                }}
                                                className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-lg"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-rose-300 transition-all">
                                            <Camera size={24} className="text-slate-300 group-hover:text-rose-400 transition-colors" />
                                        </div>
                                    )}
                                    <p className="text-[8px] font-black uppercase text-slate-400">{fotos[idx] ? 'Capturada' : `Foto ${idx + 1}`}</p>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FIRMAS */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-6">
                        <SectionTitle icon={PenTool} title="Firmas — Inspector y Trabajador" />
                        <FirmaSection form={formCumplimiento} setForm={setFormCumplimiento} />
                    </div>

                    <button onClick={handleSubmitCumplimiento} disabled={saving} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-sm hover:bg-rose-600 transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50">
                        {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> Registrar Inspección</>}
                    </button>
                </div>
                <AlertModal alert={alert} setAlert={setAlert} />
            </div>
        );
    }

    // ─── FORMULARIO EPP ───────────────────────────────────────────────────────
    if (view === 'form-epp') {
        const deficientes = formEpp.itemsEpp.filter(i => !i.tiene || i.condicion === 'Malo').length;
        return (
            <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-20">
                <div className="flex items-center gap-4 mb-10">
                    <button onClick={() => { setView('menu'); setFirmaColaborador(null); }} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:text-orange-500 transition-all"><X size={20} /></button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Inspección EPP <span className="text-orange-500">Protección Personal</span></h1>
                        <p className={`text-[9px] font-black uppercase tracking-[0.3em] mt-1 ${deficientes > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {deficientes > 0 ? `⚠ ${deficientes} ÍTEMS DEFICIENTES — SE GENERARÁ ALERTA HSE` : '✓ Todos los ítems OK'}
                        </p>
                    </div>
                </div>
                <div className="max-w-5xl mx-auto space-y-8">
                    {/* IDENTIFICACIÓN */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-8">
                        <SectionTitle icon={User} title="Identificación del Trabajador" />
                        <IdentificacionSection form={formEpp} setForm={setFormEpp} formType="epp" />
                    </div>

                    {/* CHECKLIST EPP */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-4">
                        <SectionTitle icon={HardHat} title="Revisión ítem por ítem de EPP" accent="orange" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Marque si el trabajador TIENE el ítem y seleccione su condición.</p>
                        <div className="space-y-3 mt-2">
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

                    {/* OBSERVACIONES + FOTO */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-6">
                        <SectionTitle icon={Camera} title="Observaciones y Evidencia" />
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
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setFotos(prev => {
                                                        const nf = [...prev];
                                                        nf[idx] = null;
                                                        return nf;
                                                    });
                                                }}
                                                className="absolute -top-2 -right-2 bg-orange-600 text-white rounded-full p-1 shadow-lg"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center border border-slate-200 group-hover:border-orange-300 transition-all">
                                            <Camera size={24} className="text-slate-300 group-hover:text-orange-400 transition-colors" />
                                        </div>
                                    )}
                                    <p className="text-[8px] font-black uppercase text-slate-400">{fotos[idx] ? 'Capturada' : `Foto ${idx + 1}`}</p>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* FIRMAS */}
                    <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-md space-y-6">
                        <SectionTitle icon={PenTool} title="Firmas — Inspector y Trabajador" />
                        <FirmaSection form={formEpp} setForm={setFormEpp} />
                    </div>

                    {deficientes > 0 && (
                        <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-8 flex items-center gap-6">
                            <div className="bg-rose-600 text-white p-4 rounded-2xl flex-shrink-0"><AlertTriangle size={24} /></div>
                            <div>
                                <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide">Alerta HSE Automática</p>
                                <p className="text-[9px] font-bold text-rose-500 uppercase mt-1">{deficientes} ítems deficientes detectados. Al guardar, se generará una notificación automática en la Consola HSE Audit para revisión inmediata del prevencionista.</p>
                            </div>
                        </div>
                    )}

                    <button onClick={handleSubmitEpp} disabled={saving} className={`w-full py-6 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-sm transition-all shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 ${deficientes > 0 ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-orange-500'}`}>
                        {saving ? <Loader2 className="animate-spin" size={24} /> : <><Save size={24} /> {deficientes > 0 ? 'Registrar y Generar Alerta HSE' : 'Registrar Inspección EPP'}</>}
                    </button>
                </div>
                <AlertModal alert={alert} setAlert={setAlert} />
            </div>
        );
    }

    // ─── LISTA DE INSPECCIONES ────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-10 pb-20">
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('menu')} className="p-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:text-rose-600 transition-all"><X size={20} /></button>
                    <h1 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">Historial de <span className="text-rose-600">Inspecciones</span></h1>
                </div>
                <div className="flex gap-3">
                    {['', 'cumplimiento-prevencion', 'epp'].map((t, i) => (
                        <button key={i} onClick={() => setFilterTipo(t)} className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${filterTipo === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-100 text-slate-400 hover:text-slate-700'}`}>
                            {t === '' ? 'Todas' : t === 'cumplimiento-prevencion' ? 'Cumplimiento' : 'EPP'}
                        </button>
                    ))}
                </div>
            </div>
            <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl overflow-hidden">
                <div className="divide-y divide-slate-50">
                    {loading ? (
                        <div className="p-32 flex flex-col items-center gap-6">
                            <div className="w-14 h-14 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando inspecciones...</p>
                        </div>
                    ) : inspecciones.length > 0 ? inspecciones.map(insp => (
                        <div key={insp._id} className="p-8 flex items-center justify-between hover:bg-slate-50/80 transition-all group border-l-4 border-l-transparent hover:border-l-rose-600">
                            <div className="flex items-center gap-6">
                                <div className={`p-4 rounded-2xl text-white shadow-lg ${insp.tipo === 'epp' ? 'bg-orange-500' : 'bg-rose-600'}`}>
                                    {insp.tipo === 'epp' ? <HardHat size={20} /> : <ShieldCheck size={20} />}
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 uppercase tracking-tight">{insp.nombreTrabajador}</h4>
                                    <div className="flex items-center gap-4 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{insp.empresa}</span>
                                        {insp.ot && <span className="text-[10px] font-black text-rose-500 uppercase">OT: {insp.ot}</span>}
                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${insp.tipo === 'epp' ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {insp.tipo === 'epp' ? 'EPP' : 'Cumplimiento'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className={`text-[10px] font-black uppercase px-4 py-2 rounded-full ${insp.resultado === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : insp.resultado === 'No Conforme' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {insp.resultado}
                                </span>
                                {insp.alertaHse && (
                                    <span className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 uppercase bg-rose-50 px-3 py-2 rounded-full border border-rose-100">
                                        <AlertTriangle size={12} /> Alerta HSE
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-400">{new Date(insp.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="p-44 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Sin inspecciones registradas</div>
                    )}
                </div>
            </div>
            <AlertModal alert={alert} setAlert={setAlert} />
        </div>
    );
};

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────

const SectionTitle = ({ icon: Icon, title, accent = 'rose' }) => (
    <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${accent === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-rose-100 text-rose-600'}`}>
            <Icon size={20} />
        </div>
        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{title}</h4>
    </div>
);

const CheckItem = ({ label, checked, onToggle, children, small = false }) => (
    <div className="space-y-2">
        <div
            onClick={() => onToggle(!checked)}
            className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${checked ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-100 hover:border-rose-300'} ${small ? 'ml-4' : ''}`}
        >
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-300'}`}>
                {checked ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </div>
            <span className={`font-black uppercase text-[10px] tracking-tight flex-1 ${checked ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</span>
            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${checked ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                {checked ? 'Cumple' : 'No Cumple'}
            </span>
        </div>
        {children && <div>{children}</div>}
    </div>
);

const AlertModal = ({ alert, setAlert }) => {
    if (!alert) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
            <div className="bg-white rounded-[3.5rem] p-12 max-w-md w-full shadow-2xl text-center flex flex-col items-center gap-8 animate-in zoom-in-95">
                <div className={`p-6 rounded-[2rem] ${alert.type === 'error' ? 'bg-rose-100 text-rose-600' : alert.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {alert.type === 'error' ? <AlertTriangle size={48} /> : <CheckCircle2 size={48} />}
                </div>
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-relaxed">{alert.message}</h4>
                <div className="flex gap-4 w-full">
                    {alert.type === 'confirm' ? (
                        <>
                            <button onClick={() => setAlert(null)} className="flex-1 py-5 rounded-full border-2 border-slate-100 text-slate-400 font-black text-[10px] uppercase">No</button>
                            <button onClick={() => { alert.onConfirm?.(); setAlert(null); }} className="flex-1 py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase hover:bg-rose-600 transition-all">Sí</button>
                        </>
                    ) : (
                        <button onClick={() => setAlert(null)} className="w-full py-5 rounded-full bg-slate-900 text-white font-black text-[10px] uppercase">Cerrar</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrevInspecciones;
