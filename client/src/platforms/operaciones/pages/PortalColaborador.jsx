import React, { useState, useEffect } from 'react';
import api from '../../../api/api';
import { useAuth } from '../../auth/AuthContext';
import {
    User, Truck, ClipboardCheck, Calendar,
    BarChart3, ShieldCheck, FileText, BadgeCheck,
    PhoneCall, Megaphone, Info, ArrowRight,
    Loader2, AlertCircle, HardHat, PenTool,
    Wallet, Award, LifeBuoy, MapPin, ChevronLeft,
    Plus, Clock, CheckCircle2, XCircle, Search,
    Zap, Mail, Phone, Briefcase, Building2,
    CalendarClock, Fingerprint, ShieldAlert,
    Package, Key, Fuel, Navigation, GraduationCap,
    Activity
} from 'lucide-react';

const PortalColaborador = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeView, setActiveView] = useState('main'); // main, perfil, equipamiento, solicitudes, produccion, cumplimiento

    // Solicitudes State (Moved from conditional view to comply with hooks rules)
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        tipo: 'Vacaciones',
        fechaInicio: '',
        fechaFin: '',
        diasHabiles: 0,
        observaciones: ''
    });

    // Data states
    const [perfil, setPerfil] = useState(null);
    const [tecnico, setTecnico] = useState(null);
    const [asts, setAsts] = useState([]);
    const [produccion, setProduccion] = useState([]);
    const [vehiculo, setVehiculo] = useState(null);
    const [flota, setFlota] = useState([]); // Added for the new vehicle logic
    const [lastFuelRequest, setLastFuelRequest] = useState(null);
    const [lastKm, setLastKm] = useState(0);
    const [fuelForm, setFuelForm] = useState({
        patente: '',
        kmActual: '',
        fotoTacometro: ''
    });

    const fetchData = async () => {
        const isAdmin = ['ceo_genai', 'ceo', 'admin'].includes(user?.role);

        if (!isAdmin && (!user?.rut || user.rut === 'Rut No Definido')) {
            setError("Tu perfil de usuario no tiene un RUT asociado. Por favor, cierra sesión y vuelve a ingresar para refrescar tu perfil, o contacta a soporte si el problema persiste.");
            setLoading(false);
            return;
        }

        const rawRut = user?.rut && user.rut !== 'Rut No Definido' ? user.rut : (isAdmin ? 'CEO-ROOT' : '');
        const rut = rawRut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

        try {
            const [resCandidato, resTecnico, resAst, resProd] = await Promise.all([
                api.get(`/api/rrhh/candidatos/rut/${rut}`).catch(() => ({ data: null })),
                api.get(`/api/tecnicos/rut/${rut}`).catch(() => ({ data: null })),
                api.get(`/api/prevencion/ast`).catch(() => ({ data: [] })),
                api.get(`/api/produccion`).catch(() => ({ data: [] }))
            ]);

            setPerfil(resCandidato.data);
            setTecnico(resTecnico.data);

            let resVeh = null;

            // Si hay técnico, cargar su vehículo asignado
            if (resTecnico.data && resTecnico.data.vehiculoAsignado) {
                resVeh = await api.get(`/api/vehiculos/${resTecnico.data.vehiculoAsignado}`).catch(() => null);
                if (resVeh && resVeh.data) {
                    setVehiculo(resVeh.data);
                    if (!fuelForm.patente) setFuelForm(prev => ({ ...prev, patente: resVeh.data.patente }));
                }
            } else {
                const resVehAll = await api.get(`/api/vehiculos`).catch(() => ({ data: [] }));
                setFlota(resVehAll.data || []);
            }

            // Filtrar datos personales
            setAsts((resAst.data || []).filter(a => (a.rutTrabajador || '').replace(/\./g, '').replace(/-/g, '').toUpperCase() === rut));

            // Corregir filtrado de producción: técnicos a veces usan tecnicoRut o rut
            setProduccion((resProd.data || []).filter(p => {
                const pRut = (p.tecnicoRut || p.rut || '').toString().replace(/\./g, '').replace(/-/g, '').toUpperCase();
                return pRut === rut;
            }));

            // 5. Cargar última solicitud de combustible
            const resFuel = await api.get(`/api/operaciones/combustible/rut/${rut}/reciente`).catch(() => ({ data: null }));
            setLastFuelRequest(resFuel.data);
            if (resFuel.data && !fuelForm.patente) {
                setFuelForm(prev => ({ ...prev, patente: resFuel.data.patente }));
            }

            // Cargar último KM conocido para la patente actual
            const patenteAct = fuelForm.patente || (resFuel.data?.patente) || (resVeh?.data?.patente);
            if (patenteAct) {
                const resKm = await api.get(`/api/operaciones/combustible/patente/${patenteAct}/last-km`).catch(() => ({ data: { lastKm: 0 } }));
                setLastKm(resKm.data.lastKm);
            }

        } catch (err) {
            console.error("Error cargando datos del colaborador:", err);
            // Si es Admin/CEO, no bloqueamos con error fatal, solo informamos en consola
            if (!isAdmin) {
                setError("Error al conectar con los servicios de datos.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const renderHeader = (title, Icon) => (
        <div className="flex items-center gap-4 mb-8">
            <button
                onClick={() => setActiveView('main')}
                className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all active:scale-95 shadow-sm"
            >
                <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                    <Icon size={20} />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight italic leading-none">{title}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Portal Colaborador(a)</p>
                </div>
            </div>
        </div>
    );

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MAIN (MENÚ DE TARJETAS)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'main') {
        if (loading) {
            return (
                <div className="flex h-[80vh] items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Cargando tu Portal...</p>
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex h-[80vh] items-center justify-center p-6 text-center">
                    <div className="max-w-md space-y-4">
                        <AlertCircle className="w-16 h-16 text-rose-500 mx-auto" />
                        <h2 className="text-2xl font-black text-slate-800 uppercase italic">Oops! Algo salió mal</h2>
                        <p className="text-sm font-bold text-slate-500 uppercase leading-relaxed">{error}</p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <button onClick={fetchData} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 active:scale-95 transition-all">Reintentar</button>
                            {(!user?.rut || user.rut === 'Rut No Definido') && (
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('genai_user');
                                        sessionStorage.removeItem('genai_user');
                                        window.location.href = '/login';
                                    }}
                                    className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 active:scale-95 transition-all"
                                >
                                    Cerrar Sesión & Refrescar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        const Card = ({ icon: Icon, title, subtitle, color, onClick, badge, next, isPlaceholder }) => (
            <button
                disabled={isPlaceholder}
                onClick={onClick}
                className={`group relative bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm transition-all overflow-hidden h-64 flex flex-col justify-between text-left
                    ${isPlaceholder ? 'opacity-60 grayscale' : 'hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-1 active:scale-95'}`}
            >
                <div className={`absolute top-0 right-0 p-12 opacity-5 transition-opacity translate-x-4 -translate-y-4`}>
                    <Icon size={180} />
                </div>
                <div className={`p-4 rounded-2xl ${color} text-white w-fit shadow-lg shadow-${color.split('-')[1]}-200`}>
                    <Icon size={24} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">{title}</h3>
                        {badge && (
                            <div className="absolute top-8 right-8 w-6 h-6 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-rose-200">
                                {badge}
                            </div>
                        )}
                        {isPlaceholder && <span className="bg-slate-200 text-slate-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Próximamente</span>}
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 mt-2 uppercase italic leading-tight">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-600 group-hover:translate-x-2 transition-all">
                    {next || 'Ver Detalles'} <ArrowRight size={12} />
                </div>
            </button>
        );

        return (
            <div className="max-w-[1400px] mx-auto pb-20 px-4 pt-4 animate-in fade-in duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            <div className="relative w-24 h-24 bg-white border-4 border-white rounded-[2.5rem] overflow-hidden shadow-2xl">
                                {perfil?.profilePic ? (
                                    <img src={perfil.profilePic} alt="Perfil" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                        <User size={40} className="text-slate-300" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                                Hola, <span className="text-indigo-600 italic block mt-2">{user?.name?.split(' ')[0]}</span>
                            </h1>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-4 py-1.5 rounded-full border border-indigo-100 uppercase tracking-wider uppercase">
                                    {tecnico?.cargo || user?.cargo || 'Colaborador'}
                                </span>
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-4 py-1.5 rounded-full border border-emerald-100 uppercase tracking-wider">
                                    Activo
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                        <div className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm text-center min-w-[130px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">OTs del Mes</p>
                            <p className="text-3xl font-black text-slate-800 leading-none">{produccion.length}</p>
                        </div>
                        <div className="bg-white p-5 rounded-[2.2rem] border border-slate-100 shadow-sm text-center min-w-[130px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">AST Hoy</p>
                            <div className="flex justify-center mt-1">
                                {asts.some(a => (a.createdAt || a.fecha)?.startsWith(new Date().toISOString().split('T')[0]))
                                    ? <div className="bg-emerald-100 p-2 rounded-xl"><BadgeCheck className="text-emerald-600" size={20} /></div>
                                    : <div className="bg-rose-100 p-2 rounded-xl animate-pulse"><AlertCircle className="text-rose-600" size={20} /></div>
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card icon={User} title="Mi Perfil" subtitle="Tus datos y ficha de RRHH" color="bg-indigo-600" onClick={() => setActiveView('perfil')} />
                    <Card icon={Truck} title="Mis Activos" subtitle={`Vehículo: ${vehiculo?.patente || tecnico?.patente || 'No asignado'}`} color="bg-sky-500" onClick={() => setActiveView('equipamiento')} />
                    <Card icon={PenTool} title="AST Nueva" subtitle="Registra tu inicio de faena" color="bg-amber-500" next="Reportar Ahora" onClick={() => window.location.href = '/prevencion/ast'} />
                    <Card icon={Calendar} title="Solicitudes" subtitle="Vacaciones, Permisos y Licencias" color="bg-rose-500" onClick={() => setActiveView('solicitudes')} badge={perfil?.vacaciones?.filter(v => v.estado === 'Pendiente')?.length} />
                    <Card icon={BarChart3} title="Rendimiento" subtitle="Tu avance productivo y metas" color="bg-emerald-600" onClick={() => setActiveView('produccion')} />
                    <Card icon={ShieldCheck} title="HSE & Seguridad" subtitle="Certificaciones y Licencias" color="bg-violet-600" onClick={() => setActiveView('cumplimiento')} />
                    <Card icon={Fuel} title="Solicitud Combustible" subtitle={lastFuelRequest?.estado === 'Pendiente' ? 'Estado: Pendiente de Aprobación' : 'Registra tu carga del día'} color="bg-orange-600" onClick={() => setActiveView('combustible')} />
                    <Card icon={Wallet} title="Liquidaciones" subtitle="Historial de remuneraciones" color="bg-slate-400" isPlaceholder />
                    <Card icon={Award} title="Certificados" subtitle="Documentación laboral 24/7" color="bg-slate-400" isPlaceholder />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 h-72 relative overflow-hidden group shadow-2xl shadow-slate-200">
                        <LifeBuoy size={240} className="absolute -right-12 -bottom-12 opacity-5 group-hover:rotate-45 transition-transform duration-1000" />
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-4 bg-rose-600 rounded-2xl shadow-xl shadow-rose-900/40 animate-pulse"><PhoneCall size={28} /></div>
                                <h3 className="text-3xl font-black uppercase tracking-tight italic">S.O.S Emergencia</h3>
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed max-w-sm italic">Contacto inmediato con centro de apoyo operativo y seguridad.</p>
                        </div>
                        <div className="flex gap-4 relative z-10 w-full md:w-auto">
                            <button className="flex-1 md:flex-none px-8 py-5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95">Supervisor</button>
                            <button className="flex-1 md:flex-none px-8 py-5 bg-rose-600 hover:bg-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-900/40 transition-all active:scale-95">Alerta HSE</button>
                        </div>
                    </div>
                    <div className="bg-white rounded-[3rem] border border-slate-100 p-10 flex flex-col md:flex-row items-center justify-between gap-8 h-72 shadow-sm hover:shadow-xl transition-all">
                        <div className="space-y-4 order-2 md:order-1 text-center md:text-left">
                            <div className="flex items-center gap-3 justify-center md:justify-start">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><Megaphone size={28} /></div>
                                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tight italic">Comunicados</h3>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase leading-relaxed max-w-sm italic mb-4">Entérate de los nuevos convenios, beneficios y noticias de la compañía.</p>
                            <button className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-2 hover:translate-x-2 transition-all mx-auto md:mx-0">Explorar Novedades <ArrowRight size={16} /></button>
                        </div>
                        <div className="w-36 h-36 bg-slate-50 rounded-[2.5rem] flex items-center justify-center order-1 md:order-2 shrink-0"><Info size={56} className="text-slate-200" /></div>
                    </div>
                </div>

                <footer className="mt-20 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 opacity-30 grayscale active:grayscale-0 transition-all">
                    <div className="flex items-center gap-4"><Zap size={22} className="text-indigo-600" /><p className="text-[11px] font-black uppercase tracking-[0.4em]">Gen AI OS v4.2 • Secure Session</p></div>
                    <div className="flex gap-8 text-[11px] font-black uppercase tracking-[0.4em]"><span>Encryption AES-256</span><span>Support Hub</span></div>
                </footer>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MI PERFIL (RRHH)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'perfil') {
        const InfoItem = ({ icon: Icon, label, value }) => (
            <div className="flex items-center gap-4 p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm"><Icon size={16} /></div>
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-sm font-bold text-slate-800 uppercase">{value || 'No registrado'}</p>
                </div>
            </div>
        );

        return (
            <div className="max-w-[1000px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Mi Perfil RRHH", User)}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Tarjeta Lateral Foto */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 text-center shadow-sm">
                            <div className="relative inline-block mx-auto mb-6">
                                <div className="absolute -inset-1 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-[2rem] blur opacity-25"></div>
                                <div className="relative w-32 h-32 bg-white border-4 border-white rounded-[2rem] overflow-hidden shadow-xl">
                                    {perfil?.profilePic ? <img src={perfil.profilePic} alt="Me" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300"><User size={48} /></div>}
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase italic leading-none truncate">{user?.name}</h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest italic">{tecnico?.cargo || 'Colaborador'}</p>
                        </div>

                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2rem] p-6 text-white text-center shadow-xl shadow-indigo-100">
                            <Fingerprint className="mx-auto mb-3 opacity-50" size={32} />
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">RUT Identificador</p>
                            <p className="text-lg font-black mt-1 italic leading-none">{user?.rut}</p>
                        </div>
                    </div>

                    {/* Datos Personales & Contractuales */}
                    <div className="md:col-span-2 space-y-8">
                        <section>
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 px-2">
                                <Mail size={12} /> Contacto & Domicilio
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoItem icon={Mail} label="Email Corporativo" value={tecnico?.email || perfil?.email} />
                                <InfoItem icon={Phone} label="Teléfono de Contacto" value={tecnico?.telefono || perfil?.phone} />
                                <InfoItem icon={MapPin} label="Dirección / Comuna" value={tecnico?.comuna} />
                                <InfoItem icon={Navigation} label="Región" value={tecnico?.region} />
                            </div>
                        </section>

                        <section>
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 px-2">
                                <Building2 size={12} /> Datos de Empresa
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoItem icon={Briefcase} label="Cargo / Especialidad" value={tecnico?.cargo} />
                                <InfoItem icon={CalendarClock} label="Fecha de Ingreso" value={tecnico?.fechaIngreso ? new Date(tecnico.fechaIngreso).toLocaleDateString() : null} />
                                <InfoItem icon={Building2} label="Proyecto / Mandante" value={tecnico?.mandantePrincipal} />
                                <InfoItem icon={HardHat} label="Estado Actual" value={tecnico?.estadoActual} />
                            </div>
                        </section>

                        <section>
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4 px-2">
                                <Wallet size={12} /> Previsión & Pago
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InfoItem icon={Building2} label="Banco / Cuenta" value={tecnico?.banco ? `${tecnico.banco} (${tecnico.tipoCuenta})` : null} />
                                <InfoItem icon={ShieldAlert} label="Previsión (AFP)" value={tecnico?.afp} />
                                <InfoItem icon={ShieldCheck} label="Salud (Isapre/Fonsa)" value={tecnico?.isapreNombre} />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MI EQUIPAMIENTO (ACTIVOS)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'equipamiento') {
        return (
            <div className="max-w-[1000px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Mi Equipamiento", Truck)}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* SECCIÓN VEHÍCULO */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Vehículo Asignado</h4>

                        <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                            <div className="h-48 bg-slate-900 relative flex items-center justify-center p-12">
                                <Truck size={80} className="text-white opacity-20 absolute" />
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl w-full text-center">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Patente</p>
                                    <p className="text-4xl font-black text-white italic">{vehiculo?.patente || tecnico?.patente || 'ST-XXXX'}</p>
                                </div>
                            </div>
                            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Marca / Modelo</p>
                                    <p className="font-bold text-slate-800 uppercase italic">{vehiculo?.marca || tecnico?.marcaVehiculo || 'N/A'} {vehiculo?.modelo || tecnico?.modeloVehiculo || ''}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Año / Versión</p>
                                    <p className="font-bold text-slate-800">{vehiculo?.anio || tecnico?.anioVehiculo || '--'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Combustible</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Fuel size={14} className="text-indigo-600" />
                                        <p className="font-bold text-slate-800 uppercase text-xs">Diesel / 95</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado Logístico</p>
                                    <p className="font-bold text-emerald-600 uppercase text-xs italic">{vehiculo?.estadoLogistico || 'En Operación'}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex items-start gap-4">
                            <Info className="text-indigo-600 shrink-0 mt-1" size={20} />
                            <p className="text-xs font-bold text-indigo-700 leading-relaxed uppercase italic">
                                Recuerda registrar tu Checklist diario antes de iniciar ruta. En caso de falla técnica, informa a tu supervisor mediante la tarjeta de Emergencia.
                            </p>
                        </div>
                    </div>

                    {/* SECCIÓN HERRAMIENTAS */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2 flex justify-between">
                            Manual de Herramientas <span>{(tecnico?.herramientas || []).length} Items</span>
                        </h4>

                        <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm">
                            {(tecnico?.herramientas || []).length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 rounded-[2.5rem]">
                                    <Package size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No hay herramientas registradas</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {(tecnico?.herramientas || []).map((h, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-white text-indigo-600 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
                                                    <Key size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase italic leading-none">{h.nombre}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">S/N: {h.codigo || 'S-00000'}</p>
                                                </div>
                                            </div>
                                            <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-tighter">
                                                {h.estado || 'OK'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button className="w-full mt-6 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                <Plus size={16} /> Agregar Herramienta a Mi Cargo
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: SOLICITUDES (VACACIONES / PERMISOS)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'solicitudes') {

        const handleNewRequest = async (e) => {
            e.preventDefault();
            if (!perfil?._id) return alert("Ficha RRHH no encontrada");
            setSubmitting(true);
            try {
                const requestData = {
                    ...form,
                    estado: 'Pendiente',
                    creadoEn: new Date().toISOString()
                };
                await api.post(`/api/rrhh/candidatos/${perfil._id}/vacaciones`, requestData);
                alert("Solicitud enviada correctamente.");
                setShowModal(false);
                fetchData();
            } catch (err) {
                alert("Error al enviar solicitud: " + (err.response?.data?.message || err.message));
            } finally {
                setSubmitting(false);
            }
        };

        const StatusBadge = ({ status }) => {
            const config = {
                'Pendiente': { color: 'bg-amber-100 text-amber-600', icon: Clock },
                'Aprobado': { color: 'bg-emerald-100 text-emerald-600', icon: CheckCircle2 },
                'Rechazado': { color: 'bg-rose-100 text-rose-600', icon: XCircle }
            };
            const { color, icon: Icon } = config[status] || config['Pendiente'];
            return (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${color}`}>
                    <Icon size={12} /> {status}
                </div>
            );
        };

        return (
            <div className="max-w-[1000px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    {renderHeader("Mis Solicitudes", Calendar)}
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full md:w-auto px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Nueva Solicitud
                    </button>
                </div>

                <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm">
                    {(perfil?.vacaciones || []).length === 0 ? (
                        <div className="text-center py-24 bg-slate-50 rounded-[2.5rem]">
                            <Calendar size={60} className="mx-auto text-slate-200 mb-6" />
                            <h3 className="text-lg font-black text-slate-400 uppercase italic">Sin solicitudes previas</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto">Tus solicitudes de vacaciones y permisos aparecerán aquí una vez que las registres.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(perfil?.vacaciones || []).map((v, i) => (
                                <div key={i} className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-slate-50 border border-slate-100 hover:border-rose-200 rounded-[2rem] transition-all group">
                                    <div className="flex gap-4">
                                        <div className="p-4 bg-white text-rose-600 rounded-2xl shadow-sm group-hover:scale-110 transition-all font-black flex flex-col items-center justify-center min-w-[64px]">
                                            <span className="text-xs leading-none mb-1">DÍAS</span>
                                            <span className="text-xl italic leading-none">{v.diasHabiles || '?'}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-slate-900 uppercase italic leading-none">{v.tipo}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                <Calendar size={12} className="text-slate-400" />
                                                {new Date(v.fechaInicio).toLocaleDateString()} al {new Date(v.fechaFin).toLocaleDateString()}
                                            </p>
                                            {v.observaciones && <p className="text-[9px] font-bold text-slate-400 uppercase italic mt-2 line-clamp-1 max-w-sm">"{v.observaciones}"</p>}
                                        </div>
                                    </div>
                                    <div className="mt-4 md:mt-0 flex items-center gap-4 w-full md:w-auto justify-between border-t md:border-t-0 pt-4 md:pt-0 border-slate-200/50">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">Fecha Registro</p>
                                            <p className="text-[10px] font-bold text-slate-500">{v.creadoEn ? new Date(v.creadoEn).toLocaleDateString() : '--'}</p>
                                        </div>
                                        <StatusBadge status={v.estado} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MODAL NUEVA SOLICITUD */}
                {showModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-10 bg-gradient-to-r from-rose-500 to-rose-700 flex items-center justify-between text-white">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 rounded-2xl"><Plus size={24} /></div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tight italic">Nueva Solicitud</h2>
                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Complete los detalles para aprobación</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-4 bg-black/10 hover:bg-black/20 rounded-2xl transition-all"><XCircle size={24} /></button>
                            </div>
                            <form onSubmit={handleNewRequest} className="p-10 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Tipo de Permiso</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all appearance-none uppercase"
                                            value={form.tipo}
                                            onChange={e => setForm({ ...form, tipo: e.target.value })}
                                        >
                                            <option>Vacaciones</option>
                                            <option>Licencia Médica</option>
                                            <option>Permiso Con Goce</option>
                                            <option>Permiso Sin Goce</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Días Solicitados</label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all"
                                            value={form.diasHabiles}
                                            onChange={e => setForm({ ...form, diasHabiles: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Fecha Inicio</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all"
                                            value={form.fechaInicio}
                                            onChange={e => setForm({ ...form, fechaInicio: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Fecha Fin</label>
                                        <input
                                            type="date"
                                            required
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all"
                                            value={form.fechaFin}
                                            onChange={e => setForm({ ...form, fechaFin: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Observaciones / Motivo</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all h-24 resize-none"
                                        placeholder="Escribe brevemente el motivo..."
                                        value={form.observaciones}
                                        onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 py-5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Solicitud'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: PRODUCCIÓN (HISTORIAL OT)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'produccion') {
        const totalPuntos = produccion.reduce((acc, p) => acc + (p.puntos || 0), 0);
        const metaDiaria = 50; // Mock meta
        const cumplimiento = Math.min(Math.round((totalPuntos / metaDiaria) * 100), 100);

        return (
            <div className="max-w-[1000px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Mi Producción", BarChart3)}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total OTs del Mes</p>
                        <p className="text-5xl font-black text-slate-900 italic leading-none">{produccion.length}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Puntos Acumulados</p>
                        <p className="text-5xl font-black text-indigo-600 italic leading-none">{totalPuntos}</p>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cumplimiento Meta</p>
                        <div className="relative w-20 h-20">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                                <circle cx="40" cy="40" r="35" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={220} strokeDashoffset={220 - (220 * cumplimiento) / 100} className="text-emerald-500 transition-all duration-1000" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800">{cumplimiento}%</div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-4 mb-6">Detalle de Actividades Recientes</h4>

                    {produccion.length === 0 ? (
                        <div className="text-center py-20">
                            <Activity className="mx-auto text-slate-200 mb-4" size={48} />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Aún no hay reportes este mes</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {produccion.slice(0, 10).map((p, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-[2rem] hover:border-emerald-200 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white text-emerald-600 rounded-2xl shadow-sm italic font-black text-lg">
                                            {p.puntos || 0}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900 uppercase italic leading-none truncate max-w-[200px] sm:max-w-md">{p.actividad || p.tipo || 'Operación Técnica'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                                                <Clock size={10} /> {new Date(p.fecha).toLocaleDateString()} · ID: {p.ordenId || p._id?.slice(-6).toUpperCase()}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-300 uppercase italic">{p.clienteAsociado || 'Mandante'}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: CUMPLIMIENTO HSE
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'cumplimiento') {
        const items = [
            { label: 'Examen Ocupacional', status: 'Vigente', date: 'Vence 12/2026', icon: User },
            { label: 'Licencia de Conducir', status: 'Vigente', date: 'Vence 08/2025', icon: Truck },
            { label: 'Certificación Altura Física', status: 'Vigente', date: 'Vence 05/2026', icon: HardHat },
            { label: 'Certificación Riesgo Eléctrico', status: 'Vigente', date: 'Vence 03/2026', icon: Zap },
            { label: 'Entrega de EPP (Última)', status: 'OK', date: 'Recibido 01/2026', icon: ShieldCheck },
        ];

        return (
            <div className="max-w-[1000px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Panel de Cumplimiento", ShieldCheck)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Estatus Documental HSE</h4>
                        <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm space-y-4">
                            {items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white text-indigo-600 rounded-2xl shadow-sm"><item.icon size={18} /></div>
                                        <div>
                                            <p className="text-sm font-black text-slate-800 uppercase italic leading-none">{item.label}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{item.date}</p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase">{item.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Charlas & Capacitaciones</h4>
                        <div className="bg-gradient-to-br from-violet-600 to-violet-950 rounded-[3rem] p-10 text-white relative overflow-hidden group">
                            <GraduationCap size={200} className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-110 transition-transform duration-1000" />
                            <div className="relative z-10">
                                <h3 className="text-3xl font-black uppercase italic leading-tight mb-4">Academia<br />de Seguridad</h3>
                                <p className="text-xs font-bold text-violet-300 uppercase tracking-widest leading-relaxed mb-8 italic">Tienes 2 capacitaciones pendientes por realizar este mes.</p>
                                <button className="px-8 py-4 bg-white text-violet-600 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-violet-900/40 hover:scale-105 transition-all">Ver Mis Cursos</button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[3rem] border border-slate-100 p-8 shadow-sm flex items-center justify-between gap-6">
                            <div className="space-y-2">
                                <h4 className="text-xl font-black text-slate-800 uppercase italic">Mi Compromiso</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Difusión de procedimientos leída y firmada el 15/02.</p>
                            </div>
                            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[2rem]"><BadgeCheck size={40} /></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: SOLICITUD DE COMBUSTIBLE
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'combustible') {
        const handleFuelSubmit = async (e) => {
            e.preventDefault();
            if (!fuelForm.fotoTacometro) return alert("Debes capturar la foto del tacómetro");
            setSubmitting(true);
            try {
                if (parseInt(fuelForm.kmActual) <= lastKm) {
                    if (!window.confirm(`El kilometraje ingresado (${fuelForm.kmActual}) no es mayor al último registro (${lastKm}). ¿Deseas continuar de todas formas?`)) {
                        setSubmitting(false);
                        return;
                    }
                }

                const data = {
                    ...fuelForm,
                    rut: user.rut,
                    nombre: user.name
                };
                await api.post('/api/operaciones/combustible', data);
                alert("Solicitud de combustible enviada correctamente");
                setActiveView('main');
                fetchData();
            } catch (err) {
                alert("Error al enviar solicitud: " + (err.response?.data?.error || err.message));
            } finally {
                setSubmitting(false);
            }
        };

        const handleCapture = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFuelForm(prev => ({ ...prev, fotoTacometro: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        };

        return (
            <div className="max-w-[800px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Solicitud de Combustible", Fuel)}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Tarjeta de Estatus Actual */}
                    <div className="md:col-span-2">
                        {lastFuelRequest && lastFuelRequest.estado === 'Carga Realizada' && (
                            <div className="p-8 rounded-[2rem] bg-gradient-to-r from-blue-600 to-indigo-700 text-white mb-6 shadow-xl shadow-blue-200 relative overflow-hidden group">
                                <div className="absolute -right-6 -bottom-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                    <Fuel size={120} />
                                </div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl">
                                        <CheckCircle2 size={32} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black uppercase italic tracking-tight">Carga Realizada</h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100 mt-1">El proceso de combustible ha finalizado con éxito.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {lastFuelRequest && lastFuelRequest.estado !== 'Carga Realizada' && (
                            <div className={`p-6 rounded-[2rem] border mb-6 flex items-center justify-between shadow-sm animate-pulse
                                ${lastFuelRequest.estado === 'Pendiente' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                    lastFuelRequest.estado === 'Aprobado' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                        'bg-rose-50 border-rose-100 text-rose-700'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl bg-white shadow-sm`}>
                                        {lastFuelRequest.estado === 'Pendiente' ? <Clock size={20} /> :
                                            lastFuelRequest.estado === 'Aprobado' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Estatus de Solicitud</p>
                                        <p className="text-sm font-black uppercase italic">Tu solicitud está: {lastFuelRequest.estado}</p>
                                        {lastFuelRequest.comentarioSupervisor && (
                                            <p className="text-[10px] font-bold mt-1 opacity-80">Nota: {lastFuelRequest.comentarioSupervisor}</p>
                                        )}
                                    </div>
                                </div>
                                {lastFuelRequest.estado === 'Aprobado' && (
                                    <span className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">¡Pasa a Cargar!</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleFuelSubmit} className="md:col-span-1 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Patente Vehículo</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="AB-CD-12"
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 transition-all uppercase"
                                    value={fuelForm.patente}
                                    onChange={e => setFuelForm({ ...fuelForm, patente: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Kilometraje Actual (Tacómetro)</label>
                                <div className="relative">
                                    <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input
                                        type="number"
                                        required
                                        placeholder="000000"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 transition-all"
                                        value={fuelForm.kmActual}
                                        onChange={e => setFuelForm({ ...fuelForm, kmActual: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={submitting || (lastFuelRequest?.estado === 'Pendiente')}
                                    className="w-full py-5 bg-orange-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-orange-100 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <><Fuel size={20} /> Enviar Solicitud</>}
                                </button>
                            </div>
                        </div>
                    </form>

                    {/* Captura de Cámara */}
                    <div className="md:col-span-1">
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm h-full flex flex-col">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic mb-4">Foto de Tacómetro (Solo Cámara)</p>

                            <div className="flex-1 border-2 border-dashed border-slate-100 rounded-[2rem] overflow-hidden relative group bg-slate-50 flex flex-col items-center justify-center">
                                {fuelForm.fotoTacometro ? (
                                    <>
                                        <img src={fuelForm.fotoTacometro} alt="Preview" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setFuelForm({ ...fuelForm, fotoTacometro: '' })}
                                            className="absolute top-4 right-4 p-3 bg-rose-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <XCircle size={20} />
                                        </button>
                                    </>
                                ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-4 hover:scale-105 transition-all">
                                        <div className="p-6 bg-white rounded-3xl shadow-xl text-orange-500">
                                            <User size={40} />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toque para capturar</p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="camera"
                                            className="hidden"
                                            onChange={handleCapture}
                                        />
                                    </label>
                                )}
                            </div>

                            <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase leading-relaxed text-center italic">
                                La foto debe ser nítida y mostrar claramente el kilometraje actual para ser aprobada por su supervisor.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null; // Fallback
};

export default PortalColaborador;
