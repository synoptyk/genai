import React, { useState, useEffect } from 'react';
import { calcularBonoImponible } from '../utils/bonoImponible';
import { DollarSign } from 'lucide-react';
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
    Activity,
    ClipboardList,
    TrendingUp, Star, Trophy, Settings
} from 'lucide-react';
import logisticaApi from '../../logistica/logisticaApi';

const PortalColaborador = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeView, setActiveView] = useState('main'); // main, perfil, equipamiento, solicitudes, produccion, cumplimiento, configuracion-bonificacion

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
    const [produccion, setProduccion] = useState(null); // null = no cargado, objeto = cargado
    const [vehiculo, setVehiculo] = useState(null);
    const [loadingProduccion, setLoadingProduccion] = useState(false);
    const [fuelForm, setFuelForm] = useState({
        patente: '',
        kmActual: '',
        fotoTacometro: ''
    });

    const [miInventario, setMiInventario] = useState([]);
    const [misAuditorias, setMisAuditorias] = useState([]);
    const [flota, setFlota] = useState([]);
    const [lastFuelRequest, setLastFuelRequest] = useState(null);
    const [lastKm, setLastKm] = useState(0);
    const MIN_VISIBLE_MONTH = 2; // Marzo
    const [selectedMonth, setSelectedMonth] = useState(() => Math.max(new Date().getMonth(), MIN_VISIBLE_MONTH));
    const [selectedOT, setSelectedOT] = useState(null);
    const [isAppealing, setIsAppealing] = useState(false);
    const [appealForm, setAppealForm] = useState({ decos: 0, repetidores: 0, observacion: '' });
    const [submittingAppeal, setSubmittingAppeal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('Todos'); // Todos, Altas, Averías, etc
    const activeYear = new Date().getFullYear();

    // --- Estado para configuración dinámica de bonificaciones ---
    const [tramosBaremo, setTramosBaremo] = useState([]);
    const [tramosRRState, setTramosRRState] = useState([]);
    const [tramosAIState, setTramosAIState] = useState([]);
    const [puntosNoCalculables, setPuntosNoCalculables] = useState(0);
    const [loadingBonos, setLoadingBonos] = useState(true);
    const [tarifasLPU, setTarifasLPU] = useState([]);
    const [loadingTarifas, setLoadingTarifas] = useState(false);

    useEffect(() => {
        const fetchBonos = async () => {
            setLoadingBonos(true);
            try {
                const res = await api.get('/api/admin/bonos');
                const modelo = (res.data || []).find(b => b.tipo === 'BAREMO_PUNTOS' && b.activo);
                if (modelo) {
                    setTramosBaremo((modelo.tramosBaremos || []).map(tr => ({
                        ...tr,
                        hasta: tr.hasta === 'Más' ? null : tr.hasta
                    })));
                    setPuntosNoCalculables(modelo.puntosExcluidos || 0);
                    setTramosRRState(modelo.tramosRR || []);
                    setTramosAIState(modelo.tramosAI || []);
                }
            } catch (e) {
                setTramosBaremo([]);
                setPuntosNoCalculables(0);
                setTramosRRState([]);
                setTramosAIState([]);
            } finally {
                setLoadingBonos(false);
            }
        };
        fetchBonos();

        const fetchTarifasLPU = async () => {
            setLoadingTarifas(true);
            try {
                const res = await api.get('/api/tarifa-lpu/catalogo');
                setTarifasLPU(res.data || []);
            } catch (e) {
                setTarifasLPU([]);
            } finally {
                setLoadingTarifas(false);
            }
        };
        fetchTarifasLPU();
    }, []);

    const normalizeVehiculoId = (vehiculoAsignado) => {
        if (!vehiculoAsignado) return '';
        if (typeof vehiculoAsignado === 'string') return vehiculoAsignado;
        if (typeof vehiculoAsignado === 'object') {
            return String(vehiculoAsignado._id || vehiculoAsignado.id || '').trim();
        }
        return '';
    };

    const currentMonth = new Date().getMonth();
    const availableMonths = [];
    for (let m = MIN_VISIBLE_MONTH; m <= currentMonth; m++) {
        availableMonths.push({
            id: m,
            name: new Date(activeYear, m, 1).toLocaleString('es-CL', { month: 'long' }),
            year: activeYear
        });
    }

    const loadProduccion = async (monthId, tecnicoId) => {
        if (!tecnicoId) return;
        setLoadingProduccion(true);
        try {
            const year = activeYear;
            const lastDay = new Date(year, monthId + 1, 0).getDate();
            const desde = `${year}-${String(monthId + 1).padStart(2, '0')}-01`;
            const hasta = `${year}-${String(monthId + 1).padStart(2, '0')}-${lastDay}`;
            
            const r = await api.get(`/api/tecnicos/${tecnicoId}/produccion?desde=${desde}&hasta=${hasta}`);
            setProduccion(r.data);
        } catch (err) {
            console.error("Error loading production history:", err);
            setProduccion({ recientes: [], resumen: { totalPuntos: 0 } });
        } finally {
            setLoadingProduccion(false);
        }
    };

    const formatDateLabel = (dateValue) => {
        if (!dateValue) return 'Sin registro';
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return 'Sin registro';
        return `Vence ${d.toLocaleDateString('es-CL')}`;
    };

    const statusByExpiry = (dateValue) => {
        if (!dateValue) return 'Pendiente';
        const d = new Date(dateValue);
        if (Number.isNaN(d.getTime())) return 'Pendiente';
        return d >= new Date() ? 'Vigente' : 'Vencido';
    };

    const handleContactSupervisor = () => {
        const supervisorEmail = tecnico?.supervisorId?.email;
        if (supervisorEmail) {
            window.location.href = `mailto:${supervisorEmail}?subject=Alerta%20Operativa%20Urgente&body=Necesito%20apoyo%20inmediato%20en%20terreno.`;
            return;
        }
        alert('No hay correo de supervisor configurado para contacto rápido.');
    };

    const handleHseAlert = () => {
        const supervisorEmail = tecnico?.supervisorId?.email;
        if (supervisorEmail) {
            window.location.href = `mailto:${supervisorEmail}?subject=ALERTA%20HSE%20URGENTE&body=Reporto%20situacion%20de%20riesgo%20en%20terreno.%20Solicito%20contacto%20inmediato.`;
            return;
        }
        alert('No hay contacto HSE/supervisor configurado para esta alerta.');
    };

    const handleHerramientaRequest = () => {
        const supervisorEmail = tecnico?.supervisorId?.email || '';
        if (supervisorEmail) {
            window.location.href = `mailto:${supervisorEmail}?subject=Solicitud%20de%20Herramienta&body=Solicito%20apoyo%20para%20agregar%20herramienta%20a%20mi%20cargo.`;
            return;
        }
        alert('No se encontró correo de supervisor para enviar la solicitud.');
    };

    const handleExportProduccionCsv = () => {
        const rows = (produccion?.recientes || []).filter(act => {
            const matchSearch = (act.ordenId || act.ID_Orden || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (act.actividadVisible || act.Actividad || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchType = filterType === 'Todos' || (act.Subtipo_de_Actividad || act.Actividad || '').toUpperCase().includes(filterType);
            return matchSearch && matchType;
        });

        const header = ['Fecha', 'OT', 'Actividad', 'Subtipo', 'Estado', 'Puntos'];
        const body = rows.map(act => [
            act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '',
            act.ordenId || act.ID_Orden || '',
            act.actividadVisible || act.Actividad || '',
            act.Subtipo_de_Actividad || '',
            act.Estado || '',
            act.PTS_TOTAL_BAREMO || act.ptsVisible || 0
        ]);

        const csv = [header, ...body].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `produccion_${activeYear}_${String(selectedMonth + 1).padStart(2, '0')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const fetchData = async () => {
        const isAdmin = ['ceo_genai', 'ceo', 'admin'].includes(user?.role);

        const rawRut = user?.rut && user.rut !== 'Rut No Definido' ? user.rut : (isAdmin ? 'CEO-ROOT' : 'T-PENDIENTE');
        const rut = rawRut.replace(/\./g, '').replace(/-/g, '').toUpperCase().trim();

        try {
            let resCandidato = { data: null };
            let resTecnico = { data: null };
            let resAst = { data: [] };
            let resProd = { data: [] };

            // Evitar llamadas para RUTs de sistema (Admins/CEO sin ficha)
            const isSystemUser = rut === 'CEOROOT';

            if (!isSystemUser) {
                const results = await Promise.all([
                    api.get(`/api/rrhh/candidatos/rut/${rut}`).catch(() => ({ data: null })),
                    api.get(`/api/tecnicos/rut/${rut}`).catch(() => ({ data: null })),
                    api.get(`/api/prevencion/ast?rut=${rut}`).catch(() => ({ data: [] }))
                ]);
                resCandidato = results[0];
                resTecnico = results[1];
                resAst = results[2];
            } else {
                const results = await Promise.all([
                    api.get(`/api/prevencion/ast?rut=${rut}`).catch(() => ({ data: [] }))
                ]);
                resAst = results[0];
            }

            setPerfil(resCandidato.data);
            setTecnico(resTecnico.data);

            if (!isAdmin && !resTecnico.data) {
                setError(`No se encontró una ficha vinculada a tu cuenta (${user?.email}). Por favor, contacta a tu supervisor u Operaciones para que activen tu perfil técnico.`);
                setLoading(false);
                return;
            }

            let resVeh = null;

            // Si hay técnico, cargar su vehículo asignado
            if (resTecnico.data && resTecnico.data.vehiculoAsignado) {
                const vehiculoId = normalizeVehiculoId(resTecnico.data.vehiculoAsignado);
                if (vehiculoId) {
                    resVeh = await api.get(`/api/vehiculos/${vehiculoId}`).catch(() => null);
                }
                if (resVeh && resVeh.data) {
                    setVehiculo(resVeh.data);
                    if (!fuelForm.patente) setFuelForm(prev => ({ ...prev, patente: resVeh.data.patente }));
                }
            } else if (!isSystemUser) {
                const resVehAll = await api.get(`/api/vehiculos`).catch(() => ({ data: [] }));
                setFlota(resVehAll.data || []);
            }

            setAsts(resAst.data || []);


            // 5. Cargar última solicitud de combustible (solo si no es sistema)
            if (!isSystemUser) {
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
            }

            // 6. Cargar Inventario y Auditorías Logísticas (solo si hay ID de técnico)
            if (resTecnico.data?._id) {
                const [resInv, resAud] = await Promise.all([
                    logisticaApi.get(`/stock-tecnico?tecnicoId=${resTecnico.data._id}`).catch(() => ({ data: [] })),
                    logisticaApi.get(`/auditorias-tecnico?tecnicoId=${resTecnico.data._id}`).catch(() => ({ data: [] }))
                ]);
                setMiInventario(resInv.data);
                setMisAuditorias(resAud.data);

                // 7. Cargar producción TOA si el técnico tiene idRecursoToa
                if (resTecnico.data.idRecursoToa) {
                    loadProduccion(selectedMonth, resTecnico.data._id);
                }
            } else {
                setMiInventario([]);
                setMisAuditorias([]);
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

    const handleMonthChange = (monthId) => {
        const safeMonth = Math.max(monthId, MIN_VISIBLE_MONTH);
        setSelectedMonth(safeMonth);
        if (tecnico?._id) {
            loadProduccion(safeMonth, tecnico._id);
        }
    };

    const openOTDetail = (ot) => {
        setSelectedOT(ot);
        setIsAppealing(false);
        setAppealForm({
            decos: ot.Decos_Adicionales || 0,
            repetidores: ot.Repetidores_WiFi || 0,
            observacion: ot.apelacion?.observacion || ''
        });
    };

    const handleSendAppeal = async () => {
        if (!selectedOT || !tecnico) return;
        setSubmittingAppeal(true);
        try {
            await api.post('/api/tecnicos/produccion/apelacion', {
                actividadId: selectedOT._id,
                tecnicoId: tecnico._id,
                rut: tecnico.rut,
                equipos: {
                    decos: appealForm.decos,
                    repetidores: appealForm.repetidores
                },
                observacion: appealForm.observacion
            });
            
            // Recargar producción para ver el nuevo estado
            await loadProduccion(selectedMonth, tecnico._id);
            setSelectedOT(null);
            alert("Apelación enviada correctamente. Será revisada por supervisión.");
        } catch (err) {
            console.error("Error enviando apelación:", err);
            alert("Error al enviar la apelación. Intente nuevamente.");
        } finally {
            setSubmittingAppeal(false);
        }
    };

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
                                    localStorage.removeItem('platform_user');
                                    sessionStorage.removeItem('platform_user');
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
                            <p className="text-3xl font-black text-slate-800 leading-none">{produccion?.resumen?.totalActividades ?? 0}</p>
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

                {/* ── BANNER: SUPERVISOR + VEHÍCULO ─────────────────────────────────── */}
                {(tecnico?.supervisorId || vehiculo || tecnico?.vehiculoAsignado) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {tecnico?.supervisorId && (
                            <div className="bg-white border border-indigo-100 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0">
                                    {tecnico.supervisorId.name?.charAt(0) || 'S'}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest italic">Mi Supervisor a Cargo</p>
                                    <p className="font-black text-slate-800 uppercase truncate">{tecnico.supervisorId.name}</p>
                                    {tecnico.supervisorId.email && (
                                        <p className="text-[10px] text-slate-400 font-bold truncate">{tecnico.supervisorId.email}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 ml-auto flex-shrink-0">
                                    {tecnico.supervisorId.email && (
                                        <a href={`mailto:${tecnico.supervisorId.email}`}
                                            className="p-2 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-100 transition-all">
                                            <Mail size={16} />
                                        </a>
                                    )}
                                    {tecnico.supervisorId.telefono && (
                                        <a href={`tel:${tecnico.supervisorId.telefono}`}
                                            className="p-2 bg-emerald-50 text-emerald-500 rounded-xl hover:bg-emerald-100 transition-all">
                                            <Phone size={16} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                        {(vehiculo || tecnico?.vehiculoAsignado) && (
                            <div className="bg-white border border-sky-100 rounded-[2rem] p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                                <div className="bg-slate-900 text-white px-3 py-2 rounded-xl font-mono font-black text-sm uppercase shadow flex-shrink-0">
                                    {vehiculo?.patente || tecnico?.vehiculoAsignado?.patente || '---'}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-sky-400 uppercase tracking-widest italic">Vehículo Asignado</p>
                                    <p className="font-black text-slate-800 uppercase truncate">
                                        {vehiculo?.marca || tecnico?.vehiculoAsignado?.marca} {vehiculo?.modelo || tecnico?.vehiculoAsignado?.modelo}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                                        {vehiculo?.estadoLogistico || tecnico?.vehiculoAsignado?.estadoLogistico || 'En Terreno'}
                                    </p>
                                </div>
                                <Truck size={24} className="text-sky-200 ml-auto flex-shrink-0" />
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card icon={User} title="Mi Perfil" subtitle="Tus datos y ficha de RRHH" color="bg-indigo-600" onClick={() => setActiveView('perfil')} />
                    <Card icon={Truck} title="Mis Activos" subtitle={`Vehículo: ${vehiculo?.patente || tecnico?.patente || 'No asignado'}`} color="bg-sky-500" onClick={() => setActiveView('equipamiento')} />
                    <Card icon={PenTool} title="AST Nueva" subtitle="Registra tu inicio de faena" color="bg-amber-500" next="Reportar Ahora" onClick={() => window.location.href = '/prevencion/ast'} />
                    <Card icon={Calendar} title="Solicitudes" subtitle="Vacaciones, Permisos y Licencias" color="bg-rose-500" onClick={() => setActiveView('solicitudes')} badge={perfil?.vacaciones?.filter(v => v.estado === 'Pendiente')?.length} />
                    <Card icon={BarChart3} title="Rendimiento" subtitle="Tu avance productivo y metas" color="bg-emerald-600" onClick={() => setActiveView('produccion')} />
                    <Card icon={ShieldCheck} title="HSE & Seguridad" subtitle="Certificaciones y Licencias" color="bg-violet-600" onClick={() => setActiveView('cumplimiento')} />
                    <Card icon={Fuel} title="Solicitud Combustible" subtitle={lastFuelRequest?.estado === 'Pendiente' ? 'Estado: Pendiente de Aprobación' : 'Registra tu carga del día'} color="bg-orange-600" onClick={() => setActiveView('combustible')} />
                    <Card icon={ClipboardList} title="Mi Inventario 360" subtitle={`Total: ${miInventario.length} categorías asignadas`} color="bg-slate-800" onClick={() => setActiveView('inventario')} />
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
                            <button onClick={handleContactSupervisor} className="flex-1 md:flex-none px-8 py-5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95">Supervisor</button>
                            <button onClick={handleHseAlert} className="flex-1 md:flex-none px-8 py-5 bg-rose-600 hover:bg-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-rose-900/40 transition-all active:scale-95">Alerta HSE</button>
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
                    <div className="flex items-center gap-4"><Zap size={22} className="text-indigo-600" /><p className="text-[11px] font-black uppercase tracking-[0.4em]">Corporate OS v4.2 • Secure Session</p></div>
                    <div className="flex gap-8 text-[11px] font-black uppercase tracking-[0.4em]"><span>Encryption AES-256</span><span>Support Hub</span></div>
                </footer>
            </div>
        );
    }


    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: ACTIVIDADES LPU (CATÁLOGO BAREMIZADA agrupado por categoría)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'actividades-lpu') {
        // Agrupar tarifasLPU por grupo
        const gruposLPU = tarifasLPU.reduce((acc, t) => {
            const g = t.grupo || 'SIN GRUPO';
            if (!acc[g]) acc[g] = [];
            acc[g].push(t);
            return acc;
        }, {});
        const gruposOrdenados = Object.keys(gruposLPU).sort();

        return (
            <div className="max-w-[900px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader('Catálogo LPU Baremizada', BarChart3)}
                {loadingTarifas ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-10">
                        {gruposOrdenados.length > 0 ? (
                            gruposOrdenados.map((grupo) => (
                                <div key={grupo}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-indigo-50 rounded-xl"><BarChart3 size={18} className="text-indigo-600" /></div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{grupo}</h3>
                                    </div>
                                    <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Actividad</th>
                                                    <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Código</th>
                                                    <th className="px-5 py-3 text-[8px] font-black text-indigo-500 uppercase tracking-widest text-center">Puntos Baremo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {gruposLPU[grupo].map((act, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/60">
                                                        <td className="px-5 py-3 text-sm font-black text-slate-700">{act.descripcion}</td>
                                                        <td className="px-5 py-3 text-center font-mono text-xs text-slate-600">{act.codigo}</td>
                                                        <td className="px-5 py-3 text-center font-black text-indigo-700">{act.puntos}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center text-slate-400 italic text-xs">No hay actividades LPU configuradas.</div>
                        )}
                    </div>
                )}
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
    // VIEW: CONFIGURACIÓN DE CÁLCULO (espejo solo lectura para el colaborador)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'configuracion-bonificacion') {
        return (
            <div className="max-w-[900px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader('Configuración de Cálculo de Bonificación', BarChart3)}
                {loadingBonos ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="animate-spin text-indigo-500" size={32} />
                    </div>
                ) : (
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm space-y-10">
                        {/* Baremo Producción */}
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-indigo-50 rounded-xl"><BarChart3 size={18} className="text-indigo-600" /></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Tramos Baremo Producción</h3>
                            </div>
                            <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                                <Info size={14} className="text-amber-500 flex-shrink-0" />
                                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex-1">Puntos No Calculables (se restan antes de aplicar tramo)</span>
                                <span className="bg-white text-amber-700 px-3 py-1 rounded-xl text-sm font-black border border-amber-200">{puntosNoCalculables} pts</span>
                            </div>
                            <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Desde (Pts)</th>
                                            <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Hasta (Pts)</th>
                                            <th className="px-5 py-3 text-[8px] font-black text-indigo-500 uppercase tracking-widest text-right">Valor CLP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {tramosBaremo.length === 0 ? (
                                            <tr><td colSpan="3" className="py-6 text-center text-slate-400 italic text-xs">Sin tramos configurados</td></tr>
                                        ) : tramosBaremo.map((t, i) => (
                                            <tr key={i} className="hover:bg-slate-50/60">
                                                <td className="px-5 py-3 font-mono text-sm font-black text-slate-700">{t.desde}</td>
                                                <td className="px-5 py-3 text-center font-mono text-sm text-slate-600">{t.hasta === null ? 'Más' : t.hasta}</td>
                                                <td className="px-5 py-3 text-right font-black text-indigo-700">${t.valor?.toLocaleString('es-CL')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Calidad RR y AI */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-emerald-50 rounded-xl"><TrendingUp size={16} className="text-emerald-600" /></div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Calidad RR</h4>
                                </div>
                                <div className="overflow-hidden border border-emerald-100 rounded-2xl">
                                    <table className="w-full text-left">
                                        <thead className="bg-emerald-50/50 border-b border-emerald-100">
                                            <tr>
                                                <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Operador / Rango</th>
                                                <th className="px-4 py-2.5 text-[8px] font-black text-emerald-600 uppercase tracking-widest text-right">CLP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-emerald-50">
                                            {tramosRRState.length === 0 ? (
                                                <tr><td colSpan="2" className="py-5 text-center text-slate-400 italic text-xs">Sin tramos configurados</td></tr>
                                            ) : tramosRRState.map((t, i) => (
                                                <tr key={i} className="hover:bg-emerald-50/20">
                                                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700">
                                                        {t.operator === 'Entre' || !t.operator ? `${t.desde}% – ${t.hasta}%` : `${t.operator} ${t.limit}%`}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-black text-emerald-700">${t.valor?.toLocaleString('es-CL')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-blue-50 rounded-xl"><Settings size={16} className="text-blue-600" /></div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Calidad AI</h4>
                                </div>
                                <div className="overflow-hidden border border-blue-100 rounded-2xl">
                                    <table className="w-full text-left">
                                        <thead className="bg-blue-50/50 border-b border-blue-100">
                                            <tr>
                                                <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Operador / Rango</th>
                                                <th className="px-4 py-2.5 text-[8px] font-black text-blue-600 uppercase tracking-widest text-right">CLP</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-blue-50">
                                            {tramosAIState.length === 0 ? (
                                                <tr><td colSpan="2" className="py-5 text-center text-slate-400 italic text-xs">Sin tramos configurados</td></tr>
                                            ) : tramosAIState.map((t, i) => (
                                                <tr key={i} className="hover:bg-blue-50/20">
                                                    <td className="px-4 py-2.5 text-xs font-bold text-slate-700">
                                                        {t.operator === 'Entre' || !t.operator ? `${t.desde}% – ${t.hasta}%` : `${t.operator} ${t.limit}%`}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-black text-blue-700">${t.valor?.toLocaleString('es-CL')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: PRODUCCIÓN (HISTORIAL OT)
    // ──────────────────────────────────────────────────────────────────────────




    // (vista actividades-lpu ya definida arriba — bloque anterior eliminado)
    if (false && activeView === 'actividades-lpu-old') {
        const prod = null;
        return (
            <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    {renderHeader("Actividades LPU Baremizada", BarChart3)}
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl border border-slate-200">
                        {availableMonths.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleMonthChange(m.id)}
                                className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMonth === m.id ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {m.name}
                            </button>
                        ))}
                        <button
                            onClick={() => setActiveView('produccion')}
                            className="px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 ml-2"
                        >
                            Volver a Rendimiento
                        </button>
                    </div>
                </div>
                <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                    <div className="bg-slate-900 px-12 py-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="w-3 h-12 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                            <div>
                                <h4 className="text-white font-black uppercase text-lg tracking-[0.1em] italic leading-none">Actividades LPU Baremizada</h4>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 italic opacity-60">Todas las actividades LPU baremizadas del periodo</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Fecha / ID</th>
                                    <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Actividad Técnica</th>
                                    <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-center">Base</th>
                                    <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-center">Equipos Ad.</th>
                                    <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-right">Pts. Final</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {(!prod?.recientes || prod.recientes.length === 0) ? (
                                    <tr>
                                        <td colSpan="5" className="py-40 text-center">
                                            <div className="flex flex-col items-center">
                                                <Activity className="text-slate-100 mb-8 animate-pulse" size={80} />
                                                <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em] italic">Sin registros para el periodo</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    prod.recientes.map((act, idx) => {
                                        const ptsBase = act.Pts_Actividad_Base || 0;
                                        const ptsDecos = act.Pts_Deco_Adicional || 0;
                                        const ptsRepes = act.Pts_Repetidor_WiFi || 0;
                                        const cantDecos = parseInt(act.Decos_Adicionales || 0);
                                        const cantRepes = parseInt(act.Repetidores_WiFi || 0);
                                        const total = act.PTS_TOTAL_BAREMO || act.ptsVisible || 0;
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                                                <td className="px-12 py-8 min-w-[180px]">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className="text-sm font-black text-slate-900 italic tracking-tight">{act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '—'}</span>
                                                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                                                            OT: {act.ordenId || act.ID_Orden || 'N/A'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 min-w-[320px]">
                                                    <div className="space-y-1.5">
                                                        <p className="text-sm font-black text-slate-900 uppercase italic leading-none tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{act.actividadVisible || act.Actividad || 'Op. Técnica'}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[280px] tracking-widest opacity-60">{act.Subtipo_de_Actividad || 'General'}</p>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-8 text-center text-sm font-black italic text-slate-700">
                                                    {ptsBase} <span className="text-[9px] opacity-40 not-italic uppercase">PB</span>
                                                </td>
                                                <td className="px-8 py-8 text-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="flex gap-2">
                                                            {cantDecos > 0 && (
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                                    <span className="text-[10px] font-black text-indigo-700">{cantDecos} STB <span className="opacity-40 italic">({ptsDecos})</span></span>
                                                                </div>
                                                            )}
                                                            {cantRepes > 0 && (
                                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl">
                                                                    <span className="text-[10px] font-black text-amber-700">{cantRepes} WIFI <span className="opacity-40 italic">({ptsRepes})</span></span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {!cantDecos && !cantRepes && <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest italic">— Sin Adicionales —</span>}
                                                    </div>
                                                </td>
                                                <td className="px-12 py-8 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="text-3xl font-black text-slate-900 italic tracking-tighter tabular-nums">{total.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${act.Estado?.toLowerCase().includes('complet') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${act.Estado?.toLowerCase().includes('complet') ? 'text-emerald-500' : 'text-slate-400'}`}>{act.Estado || 'Procesada'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: PRODUCCIÓN (HISTORIAL OT)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'produccion') {

                const prod = produccion;
                const totalPuntos = prod?.resumen?.totalPuntos ?? 0;
                const diasTrabajados = prod?.resumen?.diasTrabajados ?? 0;
                const META_DIARIA = 7.5;
                const DIAS_LABORALES_MES = 24;
                const META_MENSUAL = META_DIARIA * DIAS_LABORALES_MES;
                const cumplimientoMeta = Math.min(100, Math.round((totalPuntos / META_MENSUAL) * 100));

                // --- Bono imponible: tramo se busca por puntos TOTALES, se multiplica por pts calculables ---
                // (misma lógica que CierreBonos.jsx del administrador)
                const puntosCalculables = Math.round((Math.max(0, totalPuntos - puntosNoCalculables)) * 10) / 10;
                let valorTramo = 0;
                if (tramosBaremo.length > 0) {
                    for (let i = 0; i < tramosBaremo.length; i++) {
                        const tramo = tramosBaremo[i];
                        const hStr = String(tramo.hasta ?? '').trim().toLowerCase();
                        const isMax = hStr === 'más' || hStr === 'mas' || hStr === '' || tramo.hasta === null;
                        const limitMax = isMax ? 999999 : parseFloat(tramo.hasta);
                        if (
                            totalPuntos >= parseFloat(tramo.desde) &&
                            totalPuntos <= limitMax
                        ) {
                            valorTramo = parseFloat(tramo.valor) || 0;
                            break;
                        }
                    }
                }
                const bonoImponible = Math.round(puntosCalculables * valorTramo);


        return (
            <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    {renderHeader("Producción Operativa Online", BarChart3)}
                    {/* Month Selector y acceso a Configuración de Cálculo */}
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-3xl border border-slate-200">
                        {availableMonths.map(m => (
                            <button
                                key={m.id}
                                onClick={() => handleMonthChange(m.id)}
                                className={`px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedMonth === m.id ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {m.name}
                            </button>
                        ))}
                        {/* Botón para ver Configuración de Cálculo */}
                        <button
                            onClick={() => setActiveView('configuracion-bonificacion')}
                            className="px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 ml-2"
                        >
                            Configuración de Cálculo
                        </button>
                        {/* Botón para ver Actividades LPU */}
                        <button
                            onClick={() => setActiveView('actividades-lpu')}
                            className="px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 ml-2"
                        >
                            Actividades LPU
                        </button>
                    </div>
                </div>

                                {/* Bono Imponible Alcanzado */}
                                <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-amber-200 rounded-2xl shadow-lg p-8 flex items-center gap-8 mb-12">
                                    <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-100 border-2 border-emerald-200">
                                        <DollarSign size={48} className="text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl font-black text-emerald-700">Bono Imponible Alcanzado</span>
                                            <span className="ml-2 text-xs text-amber-500 font-bold">(Tramo: {valorTramo ? `$${valorTramo.toLocaleString('es-CL')}` : '$0'} CLP x PB)</span>
                                        </div>
                                        <div className="text-4xl font-black text-emerald-700">${bonoImponible.toLocaleString('es-CL')}</div>
                                        <div className="text-xs text-amber-700 font-bold mt-1">* El bono mostrado es imponible y corresponde a tu producción acumulada neta (descontando puntos no calculables) según tabla de bonificación vigente.</div>

                                        {/* Desglose de cálculo para transparencia */}
                                        <div className="mt-6 bg-white/80 border border-emerald-100 rounded-xl p-4 shadow-inner">
                                            {loadingBonos ? (
                                                <div className="text-xs text-slate-400 italic">Cargando modelo de bonificación...</div>
                                            ) : (
                                                <table className="w-full text-xs">
                                                    <tbody>
                                                        <tr>
                                                            <td className="font-bold text-slate-600 py-1 pr-2">Puntos totales técnico</td>
                                                            <td className="text-right font-mono text-slate-800">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="font-bold text-slate-600 py-1 pr-2">Tramo logrado (valor por PB)</td>
                                                            <td className="text-right font-mono text-emerald-700">{valorTramo ? `$${valorTramo.toLocaleString('es-CL')}` : '$0'}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="font-bold text-slate-600 py-1 pr-2">Puntos no calculables</td>
                                                            <td className="text-right font-mono text-slate-800">{puntosNoCalculables}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="font-bold text-slate-600 py-1 pr-2">Total puntos calculables</td>
                                                            <td className="text-right font-mono text-emerald-700">{puntosCalculables.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="font-bold text-slate-900 py-2 pr-2 border-t border-emerald-100">Total bono imponible</td>
                                                            <td className="text-right font-mono text-emerald-900 font-black border-t border-emerald-100">${bonoImponible.toLocaleString('es-CL')}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>

                {loadingProduccion ? (
                    <div className="flex flex-col items-center justify-center py-40 gap-6 bg-white rounded-[4rem] border border-slate-100 shadow-sm">
                        <div className="relative">
                            <div className="w-24 h-24 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                            <Activity className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] italic mb-1">Sincronizando con TOA</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Analizando rendimiento operativo...</p>
                        </div>
                    </div>
                ) : !tecnico?.idRecursoToa ? (
                    <div className="flex flex-col items-center justify-center py-32 gap-6 text-slate-400 bg-white rounded-[4rem] border border-slate-100 shadow-sm">
                        <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100"><Zap size={64} className="text-slate-200" /></div>
                        <div className="text-center">
                            <p className="font-black text-slate-900 uppercase text-lg tracking-tight italic">Sin ID TOA asociado</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-sm px-10">Tu perfil no tiene un ID Recurso TOA vinculado. Contacta a Operaciones.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Dashboard Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Meta Proyectada */}
                            <div className="lg:col-span-2 bg-slate-900 rounded-[4rem] p-12 text-white relative overflow-hidden group shadow-2xl shadow-slate-200">
                                <TrendingUp size={240} className="absolute -right-20 -bottom-20 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                                <div className="relative z-10 flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] italic mb-4">Avance Meta Mensual ({availableMonths.find(m => m.id === selectedMonth)?.name})</h4>
                                            <p className="text-7xl font-black italic tracking-tighter">{cumplimientoMeta}%</p>
                                        </div>
                                        <div className="px-6 py-3 bg-white/10 backdrop-blur-xl rounded-[2rem] border border-white/10 text-center shadow-2xl">
                                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Días Laborales</p>
                                            <p className="text-2xl font-black uppercase italic">{diasTrabajados} <span className="text-[10px] opacity-20">DE 24</span></p>
                                        </div>
                                    </div>
                                    <div className="mt-12 space-y-6">
                                        <div className="flex justify-between items-end text-[12px] font-black uppercase tracking-[0.2em]">
                                            <span className="text-white/60">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts acumulados</span>
                                            <span className="text-indigo-400">Meta: {META_MENSUAL} pts</span>
                                        </div>
                                        <div className="h-6 bg-white/5 rounded-full overflow-hidden p-1.5 border border-white/10">
                                            <div 
                                                className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-violet-600 rounded-full transition-all duration-1000 shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                                                style={{ width: `${cumplimientoMeta}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Puntos y Promedio */}
                            <div className="bg-white rounded-[4rem] border border-slate-100 p-10 shadow-sm flex flex-col justify-between items-center text-center">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-xl shadow-indigo-50 border border-indigo-100">
                                    <Award size={40} />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Puntos Acumulados</p>
                                    <p className="text-5xl font-black text-slate-900 leading-none italic">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm opacity-20">PTS</span></p>
                                </div>
                                <div className="w-full h-px bg-slate-50 my-8" />
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Promedio Diario</p>
                                    <p className="text-5xl font-black text-indigo-600 leading-none italic">{(Math.round((prod?.resumen?.promedioPorDia || 0) * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm opacity-20">PB</span></p>
                                </div>
                            </div>

                            {/* Ranking Card */}
                            <div className="bg-emerald-500 rounded-[4rem] p-10 text-white text-center flex flex-col justify-between items-center relative overflow-hidden group shadow-2xl shadow-emerald-100">
                                <Trophy size={180} className="absolute -right-10 -bottom-10 text-white/20 -rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2.5rem] flex items-center justify-center text-white mb-6 border border-white/20 shadow-xl">
                                    <Star size={40} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.2em] mb-2 relative z-10 opacity-70">Posición en Ranking</p>
                                    <p className="text-7xl font-black italic relative z-10 tracking-tighter">#{prod?.resumen?.ranking?.posicion || '—'}</p>
                                    <p className="text-[11px] font-bold opacity-60 uppercase relative z-10 mt-4 tracking-widest italic">de {prod?.resumen?.ranking?.total || 0} Especialistas</p>
                                </div>
                            </div>
                        </div>

                        {/* Operative Log (The Table) */}
                        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                            <div className="bg-slate-900 px-12 py-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-3 h-12 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                                    <div>
                                        <h4 className="text-white font-black uppercase text-lg tracking-[0.1em] italic leading-none">Bitácora Técnica de Producción</h4>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 italic opacity-60">Sincronización Real-Time con TOA</p>
                                    </div>
                                </div>
                                
                                <div className="flex flex-1 items-center gap-4 lg:ml-12">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar por OT o Actividad..."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:bg-white/10 transition-all border-dashed"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <select 
                                        className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-[10px] font-black uppercase text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 appearance-none cursor-pointer tracking-widest min-w-[180px]"
                                        value={filterType}
                                        onChange={e => setFilterType(e.target.value)}
                                    >
                                        <option value="Todos" className="bg-slate-900 text-white italic">Filtro: Todos</option>
                                        <option value="ALTA" className="bg-slate-900 text-white">Altas (H-I)</option>
                                        <option value="AVERI" className="bg-slate-900 text-white">Averías (MTBS)</option>
                                        <option value="BAJA" className="bg-slate-900 text-white">Bajas / Retiros</option>
                                        <option value="MANTEN" className="bg-slate-900 text-white">Preventivos</option>
                                    </select>
                                </div>

                                <button onClick={handleExportProduccionCsv} className="px-8 py-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-xl">
                                    <FileText size={18} />
                                    <span>Exportar CSV</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-12 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Fecha / ID</th>
                                            <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic">Actividad Técnica</th>
                                            <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-center">Base</th>
                                            <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-center">Equipos Ad.</th>
                                            <th className="px-8 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] italic text-right">Pts. Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {(!prod?.recientes || prod.recientes.length === 0) ? (
                                            <tr>
                                                <td colSpan="5" className="py-40 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <Activity className="text-slate-100 mb-8 animate-pulse" size={80} />
                                                        <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em] italic">Sin registros para el periodo</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            prod.recientes
                                                .filter(act => {
                                                    const matchSearch = (act.ordenId || act.ID_Orden || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                                       (act.actividadVisible || act.Actividad || '').toLowerCase().includes(searchQuery.toLowerCase());
                                                    const matchType = filterType === 'Todos' || (act.Subtipo_de_Actividad || act.Actividad || '').toUpperCase().includes(filterType);
                                                    return matchSearch && matchType;
                                                })
                                                .map((act, idx) => {
                                                const ptsBase = act.Pts_Actividad_Base || 0;
                                                const ptsDecos = act.Pts_Deco_Adicional || 0;
                                                const ptsRepes = act.Pts_Repetidor_WiFi || 0;
                                                const cantDecos = parseInt(act.Decos_Adicionales || 0);
                                                const cantRepes = parseInt(act.Repetidores_WiFi || 0);
                                                const total = act.PTS_TOTAL_BAREMO || act.ptsVisible || 0;

                                                return (
                                                    <tr 
                                                        key={idx} 
                                                        onClick={() => openOTDetail(act)}
                                                        className="hover:bg-slate-50/80 transition-all cursor-pointer group"
                                                    >
                                                        <td className="px-12 py-8 min-w-[180px]">
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className="text-sm font-black text-slate-900 italic tracking-tight">{act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '—'}</span>
                                                                <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                                                                    OT: {act.ordenId || act.ID_Orden || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-8 min-w-[320px]">
                                                            <div className="space-y-1.5">
                                                                <p className="text-sm font-black text-slate-900 uppercase italic leading-none tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{act.actividadVisible || act.Actividad || 'Op. Técnica'}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[280px] tracking-widest opacity-60">{act.Subtipo_de_Actividad || 'General'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-8 text-center text-sm font-black italic text-slate-700">
                                                            {ptsBase} <span className="text-[9px] opacity-40 not-italic uppercase">PB</span>
                                                        </td>
                                                        <td className="px-8 py-8 text-center">
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="flex gap-2">
                                                                    {cantDecos > 0 && (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                                            <span className="text-[10px] font-black text-indigo-700">{cantDecos} STB <span className="opacity-40 italic">({ptsDecos})</span></span>
                                                                        </div>
                                                                    )}
                                                                    {cantRepes > 0 && (
                                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-xl">
                                                                            <span className="text-[10px] font-black text-amber-700">{cantRepes} WIFI <span className="opacity-40 italic">({ptsRepes})</span></span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {!cantDecos && !cantRepes && <span className="text-[10px] font-black text-slate-200 uppercase tracking-widest italic">— Sin Adicionales —</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-12 py-8 text-right">
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className="text-3xl font-black text-slate-900 italic tracking-tighter tabular-nums">{total.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${act.Estado?.toLowerCase().includes('complet') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${act.Estado?.toLowerCase().includes('complet') ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                        {act.Estado || 'Procesada'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal de Detalle de OT & Apelación */}
                        {selectedOT && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
                                <div className="bg-white w-full max-w-2xl rounded-[4rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100">
                                    <div className="bg-slate-50/50 p-12 border-b border-slate-100 flex justify-between items-start">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100">Detalle Operativo</span>
                                                {selectedOT.apelacion?.status === 'por_validar' && (
                                                    <span className="px-4 py-1.5 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg shadow-amber-100 animate-pulse"><Clock size={12} /> Revisión Pendiente</span>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedOT.actividadVisible}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-3 italic opacity-60">Orden de Trabajo: {selectedOT.ordenId || selectedOT.ID_Orden || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedOT(null)} className="p-4 hover:bg-white hover:shadow-xl rounded-[2rem] transition-all border border-transparent hover:border-slate-100"><XCircle size={40} className="text-slate-200" /></button>
                                    </div>

                                    <div className="p-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                        <div className="grid grid-cols-2 gap-6 mb-10">
                                            <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 group hover:bg-white hover:shadow-xl transition-all">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Baremo LPU Base</p>
                                                <p className="text-4xl font-black text-slate-900 italic tracking-tighter tabular-nums">{selectedOT.Pts_Actividad_Base || 0} <span className="text-sm opacity-20 not-italic uppercase">PTS</span></p>
                                            </div>
                                            <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 group">
                                                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-2 italic opacity-60">Total Producción</p>
                                                <p className="text-4xl font-black italic tracking-tighter tabular-nums">{selectedOT.ptsVisible || 0} <span className="text-sm opacity-30 not-italic uppercase">PTS</span></p>
                                            </div>
                                        </div>

                                        <div className="space-y-8">
                                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.4em] border-b border-slate-100 pb-4 italic">Desglose de Equipamiento (TOA XML)</h4>
                                            
                                            {!isAppealing ? (
                                                <div className="space-y-6">
                                                    <div className="grid gap-4">
                                                        <div className="flex flex-col gap-4 p-8 bg-slate-50 border border-slate-100 rounded-[3rem]">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Equipos Instalados</span>
                                                                <div className="text-right">
                                                                    <span className="text-sm font-black text-slate-900 block uppercase italic tracking-tight">{selectedOT.Equipos_Detalle?.split('|')[0] || '1 Terminal Principal'}</span>
                                                                    <div className="flex flex-wrap gap-2 mt-2 justify-end">
                                                                        {selectedOT.Equipos_Detalle?.split('|').slice(1).map((eq, i) => (
                                                                            <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase">{eq}</span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="h-px bg-slate-200" />
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Puntos Adicionales</span>
                                                                <div className="flex gap-3">
                                                                    {parseInt(selectedOT.Decos_Adicionales || 0) > 0 && 
                                                                        <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-black uppercase">+{selectedOT.Pts_Deco_Adicional} (STB)</span>
                                                                    }
                                                                    {parseInt(selectedOT.Repetidores_WiFi || 0) > 0 && 
                                                                        <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase">+{selectedOT.Pts_Repetidor_WiFi} (WIFI)</span>
                                                                    }
                                                                    {(!selectedOT.Decos_Adicionales && !selectedOT.Repetidores_WiFi) && 
                                                                        <span className="text-[10px] text-slate-400 italic font-bold uppercase tracking-widest opacity-40">Sin puntos adicionales detectados</span>
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="pt-6">
                                                        <button 
                                                            onClick={() => setIsAppealing(true)}
                                                            disabled={selectedOT.apelacion?.status === 'por_validar'}
                                                            className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-4"
                                                        >
                                                            {selectedOT.apelacion?.status === 'por_validar' ? (
                                                                <>Solicitud en Proceso de Revisión <Clock size={16} /></>
                                                            ) : (
                                                                <>¿Detectas un Error? Apelar Cálculo <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" /></>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="space-y-3">
                                                            <label className="text-[11px] font-black text-indigo-600 uppercase tracking-widest px-4 italic">Decos Reales Instalados</label>
                                                            <input 
                                                                type="number"
                                                                value={appealForm.decos}
                                                                onChange={e => setAppealForm({ ...appealForm, decos: e.target.value })}
                                                                className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[2rem] font-black text-xl italic tabular-nums focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all focus:outline-none"
                                                            />
                                                        </div>
                                                        <div className="space-y-3">
                                                            <label className="text-[11px] font-black text-amber-600 uppercase tracking-widest px-4 italic">Repetidores Reales</label>
                                                            <input 
                                                                type="number"
                                                                value={appealForm.repetidores}
                                                                onChange={e => setAppealForm({ ...appealForm, repetidores: e.target.value })}
                                                                className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[2rem] font-black text-xl italic tabular-nums focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-4 italic">Justificación del Reclamo</label>
                                                        <textarea 
                                                            placeholder="Describe detalladamente los equipos instalados que no aparecen en el cálculo automático..."
                                                            value={appealForm.observacion}
                                                            onChange={e => setAppealForm({ ...appealForm, observacion: e.target.value })}
                                                            className="w-full bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] font-bold text-sm h-32 resize-none focus:bg-white focus:ring-4 focus:ring-slate-500/10 transition-all focus:outline-none"
                                                        />
                                                    </div>
                                                    <div className="flex gap-6 pt-6">
                                                        <button onClick={() => setIsAppealing(false)} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-[2rem] font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                                                        <button 
                                                            onClick={handleSendAppeal}
                                                            disabled={submittingAppeal}
                                                            className="flex-[2] py-6 bg-emerald-500 text-white rounded-[2rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-600 active:scale-95 transition-all disabled:opacity-50"
                                                        >
                                                            {submittingAppeal ? <Loader2 className="animate-spin" size={20} /> : <BadgeCheck size={20} />}
                                                            Enviar a Validación Técnica
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: CUMPLIMIENTO HSE
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'cumplimiento') {
        const licenciaDate = tecnico?.fechaVencimientoLicencia || perfil?.fechaVencimientoLicencia;
        const exams = perfil?.accreditation?.physicalExams || [];
        const examApproved = exams.filter(e => e.status === 'Aprobado').length;
        const examLatestDate = exams.length > 0 ? exams.map(e => e.date).filter(Boolean).sort().reverse()[0] : null;
        const ppeList = perfil?.accreditation?.ppe || [];
        const ppeDelivered = ppeList.filter(p => p.delivered).length;
        const ppeLatestDate = ppeList.length > 0 ? ppeList.map(p => p.deliveredAt).filter(Boolean).sort().reverse()[0] : null;
        const items = [
            { label: 'Examen Ocupacional', status: examApproved > 0 ? 'Vigente' : 'Pendiente', date: examLatestDate ? `Último ${new Date(examLatestDate).toLocaleDateString('es-CL')}` : 'Sin registro', icon: User },
            { label: 'Licencia de Conducir', status: statusByExpiry(licenciaDate), date: formatDateLabel(licenciaDate), icon: Truck },
            { label: 'Certificación Altura Física', status: examApproved > 0 ? 'Vigente' : 'Pendiente', date: examLatestDate ? `Último ${new Date(examLatestDate).toLocaleDateString('es-CL')}` : 'Sin registro', icon: HardHat },
            { label: 'Certificación Riesgo Eléctrico', status: examApproved > 0 ? 'Vigente' : 'Pendiente', date: examLatestDate ? `Último ${new Date(examLatestDate).toLocaleDateString('es-CL')}` : 'Sin registro', icon: Zap },
            { label: 'Entrega de EPP (Última)', status: ppeDelivered > 0 ? 'OK' : 'Pendiente', date: ppeLatestDate ? `Recibido ${new Date(ppeLatestDate).toLocaleDateString('es-CL')}` : 'Sin registro', icon: ShieldCheck },
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
    // VIEW: MI INVENTARIO (LOGÍSTICA)
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'inventario') {
        return (
            <div className="max-w-[1200px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Mi Inventario & Auditorías", ClipboardList)}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista de Inventario */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Estatus de Stock Asignado</h4>
                            <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black">{miInventario.length} Ítems</span>
                        </div>

                        <div className="grid gap-4">
                            {miInventario.map((item, idx) => (
                                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                            <Package size={28} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 uppercase italic leading-none">{item.productoRef?.nombre}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">{item.productoRef?.sku} · {item.productoRef?.categoria?.nombre}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">CANTIDAD</p>
                                        <p className="text-2xl font-black text-slate-800">{item.cantidadNuevo + item.cantidadUsadoBueno}</p>
                                    </div>
                                </div>
                            ))}
                            {miInventario.length === 0 && (
                                <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                                    <Package size={48} className="text-slate-100 mx-auto mb-4" />
                                    <p className="text-slate-300 font-black uppercase italic text-xs tracking-widest">No tienes inventario cargado</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Historial de Auditorías */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2 italic">Mis Auditorías</h4>
                        <div className="bg-slate-50 p-6 rounded-[3rem] border border-slate-100 space-y-4">
                            {misAuditorias.map((aud, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(aud.createdAt).toLocaleDateString()}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${aud.resultado === 'Sin Discrepancias' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {aud.resultado || 'FINALIZADA'}
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-slate-800 uppercase italic">Auditoría #{aud.codigo?.toUpperCase()}</p>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Realizada por: {aud.usuarioAuditor?.nombre || 'Logística'}</p>
                                </div>
                            ))}
                             {misAuditorias.length === 0 && (
                                <p className="text-center py-10 text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Sin historial de auditorías</p>
                            )}
                        </div>

                        <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                             <ShieldCheck size={140} className="absolute -right-8 -bottom-8 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                             <h4 className="text-lg font-black uppercase tracking-tight italic mb-2">Transparencia 360</h4>
                             <p className="text-[10px] font-bold text-indigo-200 uppercase leading-relaxed italic">
                                Todos tus activos están protegidos digitalmente. Cualquier discrepancia será notificada automáticamente para tu revisión.
                             </p>
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

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MI PERFIL
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'perfil') {
        return (
            <div className="max-w-[900px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader('Mi Perfil', User)}
                <div className="space-y-6">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                            <div className="relative w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl flex-shrink-0 bg-slate-100 flex items-center justify-center">
                                {perfil?.profilePic
                                    ? <img src={perfil.profilePic} alt="Foto" className="w-full h-full object-cover" />
                                    : <User size={44} className="text-slate-300" />
                                }
                            </div>
                            <div className="flex-1 space-y-2 text-center md:text-left">
                                <h3 className="text-2xl font-black text-slate-900 uppercase italic">
                                    {tecnico?.nombre || tecnico?.nombres
                                        ? `${tecnico.nombres || ''} ${tecnico.apellidos || ''}`.trim()
                                        : perfil?.name || user?.name || 'Sin nombre'}
                                </h3>
                                <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{tecnico?.cargo || user?.cargo || 'Colaborador'}</p>
                                <p className="text-xs text-slate-400 font-bold uppercase">{tecnico?.rut || user?.rut || '—'}</p>
                                <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-3 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">Activo</span>
                                    {tecnico?.mandantePrincipal && <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">{tecnico.mandantePrincipal}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { label: 'Correo Electrónico', value: tecnico?.email || perfil?.email || user?.email, icon: Mail },
                                { label: 'Teléfono', value: tecnico?.telefono || perfil?.telefono || '—', icon: Phone },
                                { label: 'Empresa / Mandante', value: tecnico?.empresaOrigen || tecnico?.mandantePrincipal || tecnico?.departamento || '—', icon: Building2 },
                                { label: 'Cargo', value: tecnico?.cargo || user?.cargo || '—', icon: Briefcase },
                                { label: 'Región', value: tecnico?.region || perfil?.region || '—', icon: MapPin },
                                { label: 'Supervisor Directo', value: tecnico?.supervisorId?.name || '—', icon: User },
                            ].map(({ label, value, icon: Icon }) => (
                                <div key={label} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 flex-shrink-0">
                                        <Icon size={15} className="text-slate-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                                        <p className="text-sm font-black text-slate-700 truncate">{value || '—'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {perfil && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-indigo-50 rounded-xl"><Briefcase size={18} className="text-indigo-600" /></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Información Contractual</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { label: 'Tipo Contrato', value: perfil?.tipoContrato || '—' },
                                    { label: 'Fecha Ingreso', value: perfil?.fechaIngreso ? new Date(perfil.fechaIngreso).toLocaleDateString('es-CL') : '—' },
                                    { label: 'AFP', value: perfil?.afp || '—' },
                                    { label: 'Isapre / Fonasa', value: perfil?.isapre || '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                        <p className="text-sm font-black text-slate-700">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MIS ACTIVOS / EQUIPAMIENTO
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'equipamiento') {
        return (
            <div className="max-w-[900px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader('Mis Activos', Truck)}
                <div className="space-y-6">
                    {/* Vehículo asignado */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-sky-50 rounded-xl"><Truck size={18} className="text-sky-600" /></div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Vehículo Asignado</h3>
                        </div>
                        {(vehiculo || tecnico?.vehiculoAsignado) ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[
                                    { label: 'Patente', value: vehiculo?.patente || tecnico?.vehiculoAsignado?.patente },
                                    { label: 'Marca / Modelo', value: [vehiculo?.marca || tecnico?.vehiculoAsignado?.marca, vehiculo?.modelo || tecnico?.vehiculoAsignado?.modelo].filter(Boolean).join(' ') || '—' },
                                    { label: 'Año', value: vehiculo?.anio || '—' },
                                    { label: 'Estado Logístico', value: vehiculo?.estadoLogistico || 'En Terreno' },
                                    { label: 'Tipo Combustible', value: vehiculo?.tipoCombustible || '—' },
                                    { label: 'KM Registrado', value: vehiculo?.kmActual ? `${vehiculo.kmActual.toLocaleString('es-CL')} km` : '—' },
                                ].map(({ label, value }) => (
                                    <div key={label} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                                        <p className="text-sm font-black text-slate-700">{value || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-400">
                                <Truck size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-xs font-black uppercase tracking-widest italic">Sin vehículo asignado</p>
                            </div>
                        )}
                    </div>

                    {/* Inventario */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-xl"><Package size={18} className="text-slate-600" /></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Equipamiento & Herramientas</h3>
                            </div>
                            <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{miInventario.length} items</span>
                        </div>
                        {miInventario.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Package size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-xs font-black uppercase tracking-widest italic">Sin inventario asignado</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {miInventario.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-xl border border-slate-100"><Package size={14} className="text-slate-500" /></div>
                                            <div>
                                                <p className="text-sm font-black text-slate-700 uppercase">{item.nombre || item.categoria || 'Ítem'}</p>
                                                {item.serial && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">S/N: {item.serial}</p>}
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-100 px-3 py-1 rounded-xl uppercase">
                                            {item.estado || 'Asignado'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Auditorías */}
                    {misAuditorias.length > 0 && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-amber-50 rounded-xl"><ClipboardCheck size={18} className="text-amber-600" /></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Últimas Auditorías de Inventario</h3>
                            </div>
                            <div className="space-y-3">
                                {misAuditorias.slice(0, 5).map((aud, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-sm font-black text-slate-700">{aud.tipo || 'Auditoría'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{aud.fecha ? new Date(aud.fecha).toLocaleDateString('es-CL') : '—'}</p>
                                        </div>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase border ${
                                            aud.resultado === 'Aprobado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            aud.resultado === 'Rechazado' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            'bg-slate-100 text-slate-500 border-slate-200'
                                        }`}>{aud.resultado || 'Pendiente'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null; // Fallback
};

export default PortalColaborador;
