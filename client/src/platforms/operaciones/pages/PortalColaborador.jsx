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
    Activity, Archive,
    ClipboardList,
    TrendingUp, Star, Trophy, Settings,
    Wrench, Shield, Cpu, Layers, Hammer, Gauge, Timer, Target, Check,
    Upload, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import logisticaApi from '../../logistica/logisticaApi';
import {
    ResponsiveContainer, ComposedChart, BarChart, Bar, XAxis, YAxis,
    Tooltip as RechartsTooltip, Line, Cell, Area, AreaChart, ReferenceLine
} from 'recharts';
import GarantiasTab from '../../agentetelecom/components/GarantiasTab';
import AgendaColaboradorTab from '../components/AgendaColaboradorTab';
import NotificacionesTramites from './NotificacionesTramites';

const getLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocalización no soportada en su dispositivo.'));
        } else {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    let msg = 'Error obteniendo ubicación. Asegúrese de tener el GPS activado.';
                    if (error.code === 1) msg = 'Permiso de ubicación denegado. Debe autorizar el GPS para esta acción.';
                    reject(new Error(msg));
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    });
};

const SignaturePad = ({ onSave, onCancel }) => {
    const canvasRef = React.useRef(null);
    const [isDrawing, setIsDrawing] = React.useState(false);

    const getCoordinates = (e) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        // e.preventDefault(); // Sometimes prevents touch scrolling if outside, but we want it for canvas
        const coords = getCoordinates(e);
        if (!coords) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#333';
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        // e.preventDefault();
        const coords = getCoordinates(e);
        if (!coords) return;
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const endDrawing = () => {
        setIsDrawing(false);
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            // Check if canvas is empty (simplified check)
            const ctx = canvas.getContext('2d');
            const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
            const hasPixels = pixelBuffer.some(color => color !== 0);
            if (!hasPixels) {
                alert("Debe dibujar su firma antes de continuar.");
                return;
            }
            onSave(canvas.toDataURL('image/png'));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden touch-none relative" style={{ touchAction: 'none' }}>
                <canvas 
                    ref={canvasRef}
                    width={400}
                    height={200}
                    className="w-full h-[150px] cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={(e) => { e.preventDefault(); startDrawing(e.nativeEvent); }}
                    onTouchMove={(e) => { e.preventDefault(); draw(e.nativeEvent); }}
                    onTouchEnd={(e) => { e.preventDefault(); endDrawing(); }}
                />
                <button onClick={clear} className="absolute top-2 right-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">Limpiar</button>
            </div>
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-slate-200">Cancelar</button>
                <button onClick={handleSave} className="flex-1 py-3 text-white bg-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg hover:bg-indigo-700">Confirmar Firma</button>
            </div>
        </div>
    );
};


// ── Helper: Clasificar tipo de actividad ──
const getCategory = (act) => {
    const sub = String(act.Subtipo_de_Actividad || act.subtipo || act.Actividad || '').toLowerCase();
    const type = String(act.Tipo_Trabajo || act.actividadVisible || '').toLowerCase();
    if (sub.includes('alta') || type.includes('alta')) return 'alta';
    if (sub.includes('repar') || sub.includes('aver') || sub.includes('reclamo') ||
        type.includes('repar') || type.includes('aver') || type.includes('reclamo')) return 'reparacion';
    return 'rutina';
};

const CATEGORY_STYLES = {
    alta:      { label: 'Alta',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    reparacion:{ label: 'Reparación', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    rutina:    { label: 'Rutina',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};

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
    const [garantiasMetrics, setGarantiasMetrics] = useState({ aiValue: 0, rrValue: 0, aiFails: 0, aiTotal: 0, rrFails: 0, rrTotal: 0 });
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
    const [appealForm, setAppealForm] = useState({ decos: 0, repetidores: 0, telefonos: 0, codigoLpu: '', observacion: '', actividadIncorrecta: false, evidenciaUrl: '' });
    const [uploadingImage, setUploadingImage] = useState(false);
    const [submittingAppeal, setSubmittingAppeal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('Todos'); // Todos, Altas, Averías, etc
    const [filterDate, setFilterDate] = useState(''); // YYYY-MM-DD o vacío = todos
    const [equipamientoFilter, setEquipamientoFilter] = useState('');
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('TODOS');
    const [misObservacionesActivas, setMisObservacionesActivas] = useState([]);
    const [selectedItemObservation, setSelectedItemObservation] = useState(null);
    const [observationForm, setObservationForm] = useState({ comentario: '', fotoUrl: '' });
    const [submittingObservation, setSubmittingObservation] = useState(false);
    
    // Estados Auto-Auditoría
    const [isAutoAuditing, setIsAutoAuditing] = useState(false);
    const [auditResponses, setAuditResponses] = useState({}); // { productoId: { estado, comentario, foto } }
    const [submittingAudit, setSubmittingAudit] = useState(false);
    const [auditItemTarget, setAuditItemTarget] = useState(null);
    const [auditItemStatus, setAuditItemStatus] = useState(null);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [historialAuditorias, setHistorialAuditorias] = useState([]);

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

            // Cargar Garantías del mes desfasado (mes anterior)
            let prevMonthForApi = monthId; // 0-indexed. Enero = 0, así que el mes previo es Diciembre = 12 (para el string)
            let prevYearForApi = year;
            if (prevMonthForApi === 0) {
               prevMonthForApi = 12;
               prevYearForApi = year - 1;
            }
            const prevDaysInMonth = new Date(prevYearForApi, prevMonthForApi, 0).getDate();
            const desdeGarantias = `${prevYearForApi}-${String(prevMonthForApi).padStart(2, '0')}-01`;
            const hastaGarantias = `${prevYearForApi}-${String(prevMonthForApi).padStart(2, '0')}-${String(prevDaysInMonth).padStart(2, '0')}`;

            const gRes = await api.get('/api/bot/garantias-stats', { params: { desde: desdeGarantias, hasta: hastaGarantias, tecnicoId: tecnicoId } }).catch(() => ({ data: { statsTecnicos: {} } }));
            let gData = {};
            if (gRes?.data?.statsTecnicos) {
                const values = Object.values(gRes.data.statsTecnicos);
                if (values.length > 0) gData = values[0];
            }
            
            setGarantiasMetrics({
                aiValue: gData.aiValue || 0,
                rrValue: gData.rrValue || 0,
                aiFails: gData.fallasAltas || 0,
                aiTotal: gData.evaluadasAltas || 0,
                rrFails: gData.fallasReparaciones || 0,
                rrTotal: gData.evaluadasReparaciones || 0
            });
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
            const matchDate = !filterDate || (act.fecha && new Date(act.fecha).toISOString().slice(0,10) === filterDate);
            return matchSearch && matchType && matchDate;
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

            // Evitar llamadas para RUTs de sistema o pendientes
            const isSystemUser = rut === 'CEOROOT';
            const isPending = rut === 'TPENDIENTE' || !rut;

            if (!isSystemUser && !isPending) {
                const results = await Promise.all([
                    api.get(`/api/rrhh/candidatos/rut/${rut}`).catch(() => ({ data: null })),
                    api.get(`/api/tecnicos/rut/${rut}`).catch(() => ({ data: null })),
                    api.get(`/api/prevencion/ast?rut=${rut}`).catch(() => ({ data: [] }))
                ]);
                resCandidato = results[0];
                resTecnico = results[1];
                resAst = results[2];
            } else if (isSystemUser) {
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
                const [resInv, resAud, resObs, resHist] = await Promise.all([
                    logisticaApi.get(`/stock-tecnico?tecnicoId=${resTecnico.data._id}`).catch(() => ({ data: [] })),
                    logisticaApi.get(`/auditorias-tecnico?tecnicoId=${resTecnico.data._id}`).catch(() => ({ data: [] })),
                    logisticaApi.get(`/observaciones-stock/tecnico/${resTecnico.data._id}`).catch(() => ({ data: [] })),
                    logisticaApi.get(`/historial-auto-auditorias/${resTecnico.data._id}`).catch(() => ({ data: [] }))
                ]);
                setMiInventario(resInv.data);
                setMisAuditorias(resAud.data);
                setMisObservacionesActivas(resObs.data);
                setHistorialAuditorias(resHist.data);

                // 7. Cargar producción TOA si el técnico tiene idRecursoToa
                if (resTecnico.data.idRecursoToa) {
                    loadProduccion(selectedMonth, resTecnico.data._id);
                }
            } else {
                setMiInventario([]);
                setMisAuditorias([]);
                setMisObservacionesActivas([]);
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

    useEffect(() => {
        const handleAppealResolved = async (e) => {
            console.log("🔄 [PortalColaborador] Recibida notificación de apelación resuelta en tiempo real:", e.detail);
            if (tecnico?._id) {
                // Volver a cargar la producción del mes seleccionado para reflejar los puntos actualizados inmediatamente
                await loadProduccion(selectedMonth, tecnico._id);
            }
        };

        const handleOpenOTById = async (e) => {
            const actividadId = e.detail;
            console.log("🔍 [PortalColaborador] Solicitud para abrir OT por ID:", actividadId);
            
            // Si la producción ya está cargada y contiene la actividad, la abrimos de inmediato
            if (produccion?.recientes) {
                const act = produccion.recientes.find(a => String(a._id) === String(actividadId));
                if (act) {
                    openOTDetail(act);
                    return;
                }
            }
            
            // Si no está, cargamos de nuevo e intentamos buscarla
            if (tecnico?._id) {
                await loadProduccion(selectedMonth, tecnico._id);
                // Esperamos un brevísimo instante para el seteo del estado
                setTimeout(() => {
                    if (produccion?.recientes) {
                        const act = produccion.recientes.find(a => String(a._id) === String(actividadId));
                        if (act) {
                            openOTDetail(act);
                        }
                    }
                }, 150);
            }
        };

        window.addEventListener('appealResolvedNotif', handleAppealResolved);
        window.addEventListener('openOTById', handleOpenOTById);

        return () => {
            window.removeEventListener('appealResolvedNotif', handleAppealResolved);
            window.removeEventListener('openOTById', handleOpenOTById);
        };
    }, [tecnico?._id, selectedMonth, produccion?.recientes]);

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
            telefonos: ot.Telefonos || 0,
            codigoLpu: ot.apelacion?.codigoLpu || '',
            observacion: ot.apelacion?.observacion || '',
            evidenciaUrl: ot.apelacion?.evidenciaUrl || '',
            actividadIncorrecta: ot.apelacion?.motivo === 'actividad_incorrecta' || !!ot.apelacion?.codigoLpu || false
        });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido.');
            return;
        }

        const formData = new FormData();
        formData.append('imagen', file);

        setUploadingImage(true);
        try {
            const res = await api.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data && res.data.url) {
                setAppealForm({ ...appealForm, evidenciaUrl: res.data.url });
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error al subir la imagen. Intente nuevamente.');
        } finally {
            setUploadingImage(false);
        }
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
                    repetidores: appealForm.repetidores,
                    telefonos: appealForm.telefonos
                },
                codigoLpu: appealForm.actividadIncorrecta ? appealForm.codigoLpu : undefined,
                evidenciaUrl: appealForm.evidenciaUrl,
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
                    <Card icon={Mail} title="Bandeja & Trámites" subtitle="Firma electrónica y avisos" color="bg-pink-600" onClick={() => setActiveView('notificaciones')} badge={null} />
                    <Card icon={BarChart3} title="Mis KPI's" subtitle="Producción, tendencias y análisis de desempeño" color="bg-emerald-600" onClick={() => setActiveView('produccion')} />
                    <Card icon={ShieldCheck} title="HSE & Seguridad" subtitle="Certificaciones y Licencias" color="bg-violet-600" onClick={() => setActiveView('cumplimiento')} />
                    <Card icon={Fuel} title="Solicitud Combustible" subtitle={lastFuelRequest?.estado === 'Pendiente' ? 'Estado: Pendiente de Aprobación' : 'Registra tu carga del día'} color="bg-orange-600" onClick={() => setActiveView('combustible')} />
                    <Card icon={ClipboardList} title="Mi Inventario 360" subtitle={`Total: ${Array.from(new Set(miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).map(item => item.productoRef?.categoria?.nombre || item.categoria || 'Otros'))).length} categorías asignadas`} color="bg-slate-800" onClick={() => setActiveView('inventario')} />
                    <Card icon={Archive} title="Historial Auditorías" subtitle={`Total: ${historialAuditorias.length} auditorías firmadas`} color="bg-teal-600" onClick={() => setActiveView('historial-auditorias')} />
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
                                    <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                        <table className="w-full min-w-[600px] text-left">
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
                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                                <table className="w-full min-w-[500px] text-left">
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
                                <div className="overflow-x-auto border border-emerald-100 rounded-2xl">
                                    <table className="w-full min-w-[300px] text-left">
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
                                <div className="overflow-x-auto border border-blue-100 rounded-2xl">
                                    <table className="w-full min-w-[300px] text-left">
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
                const bonoBaremo = Math.round(puntosCalculables * valorTramo);

                const calculateTierBonus = (val, tramosArr) => {
                    if (!tramosArr || tramosArr.length === 0) return 0;
                    const value = parseFloat(val) || 0;
                    const matchingTiers = tramosArr.filter(t => {
                        if (t.operator === '<') return value < t.limit;
                        if (t.operator === '>') return value > t.limit;
                        if (t.operator === '<=') return value <= t.limit;
                        if (t.operator === '>=') return value >= t.limit;
                        const hasta = t.hasta === 'Más' || t.hasta === 'mas' || t.hasta === null ? 999999 : parseFloat(t.hasta);
                        return value >= parseFloat(t.desde) && value <= hasta;
                    });
                    if (matchingTiers.length === 0) return 0;
                    return Math.max(...matchingTiers.map(t => t.valor || 0));
                };

                let rrBonus = 0;
                let aiBonus = 0;
                if (puntosCalculables > 0) {
                    rrBonus = calculateTierBonus(garantiasMetrics.rrValue, tramosRRState);
                    aiBonus = calculateTierBonus(garantiasMetrics.aiValue, tramosAIState);
                }

                const bonoTotalFinal = bonoBaremo + rrBonus + aiBonus;


        return (
            <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    {renderHeader("Mis KPI's & Producción", BarChart3)}
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
                        <button
                            onClick={() => setActiveView('garantias')}
                            className="px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 ml-2 flex items-center gap-2"
                        >
                            <ShieldAlert size={14} /> Mis Garantías
                        </button>
                        <button
                            onClick={() => setActiveView('agenda')}
                            className="px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 ml-2 flex items-center gap-2"
                        >
                            <Calendar size={14} /> Mi Agenda
                        </button>
                    </div>
                </div>

                                {/* Bono Imponible Alcanzado */}
                                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-3xl shadow-xl overflow-hidden mb-12 relative">
                                    {/* Abstract background blobs */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                                    <div className="relative z-10 p-8 flex flex-col xl:flex-row items-start xl:items-center gap-8">
                                        <div className="flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-200 border-4 border-white shrink-0">
                                            <DollarSign size={48} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 w-full">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl font-black text-emerald-800 uppercase tracking-tight">Total Bono Mensual</span>
                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-full tracking-widest border border-emerald-200">Bono Imponible</span>
                                                    </div>
                                                </div>
                                                <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                                                    ${bonoTotalFinal.toLocaleString('es-CL')}
                                                </div>
                                            </div>
                                            <div className="text-xs text-emerald-700/80 font-medium mb-6">
                                                * El monto total se calcula sumando la producción de Puntos Baremos más los bonos de calidad alcanzados (Avería de Infancia y Garantías).
                                            </div>

                                            {/* Desglose en tarjetas (Puntos Baremos, Calidad AI, Calidad RR) */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                                
                                                {/* Card 1: Puntos Baremos */}
                                                <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl p-5 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-50">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                            <Target size={16} />
                                                        </div>
                                                        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Puntos Baremos</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">Puntos Totales:</span>
                                                            <span className="font-mono font-bold text-slate-800">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">No Calculables:</span>
                                                            <span className="font-mono text-slate-500">-{puntosNoCalculables}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">Tramo Alcanzado:</span>
                                                            <span className="font-mono font-bold text-emerald-600">${valorTramo ? valorTramo.toLocaleString('es-CL') : 0} c/u</span>
                                                        </div>
                                                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Total Producción</span>
                                                            <span className="text-lg font-black text-emerald-700">${bonoBaremo.toLocaleString('es-CL')}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 2: Avería Infancia (AI) */}
                                                <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-50">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                            <Activity size={16} />
                                                        </div>
                                                        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Avería Infancia</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">Fallas Altas / Totales:</span>
                                                            <span className="font-mono font-bold text-slate-800">{garantiasMetrics.aiFails} / {garantiasMetrics.aiTotal}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">% Logrado:</span>
                                                            <span className={`font-mono font-bold ${garantiasMetrics.aiValue > 10 ? 'text-rose-500' : 'text-blue-600'}`}>{Number(garantiasMetrics.aiValue).toFixed(1)}%</span>
                                                        </div>
                                                        {puntosCalculables <= 0 && (
                                                            <div className="text-[10px] font-bold text-rose-500 text-center uppercase tracking-wider py-1">No cumple pts mínimos</div>
                                                        )}
                                                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Bono Calidad AI</span>
                                                            <span className="text-lg font-black text-emerald-700">${aiBonus.toLocaleString('es-CL')}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card 3: Repetido Reparado (RR) */}
                                                <div className="bg-white/80 backdrop-blur border border-emerald-100 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-emerald-50">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                            <Wrench size={16} />
                                                        </div>
                                                        <span className="text-sm font-black text-slate-700 uppercase tracking-wide">Repetido Reparado</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">Repetidas / Totales:</span>
                                                            <span className="font-mono font-bold text-slate-800">{garantiasMetrics.rrFails} / {garantiasMetrics.rrTotal}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-slate-500 font-medium">% Logrado:</span>
                                                            <span className={`font-mono font-bold ${garantiasMetrics.rrValue > 10 ? 'text-rose-500' : 'text-indigo-600'}`}>{Number(garantiasMetrics.rrValue).toFixed(1)}%</span>
                                                        </div>
                                                        {puntosCalculables <= 0 && (
                                                            <div className="text-[10px] font-bold text-rose-500 text-center uppercase tracking-wider py-1">No cumple pts mínimos</div>
                                                        )}
                                                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                                                            <span className="text-[10px] font-black uppercase text-slate-400">Bono Calidad RR</span>
                                                            <span className="text-lg font-black text-emerald-700">${rrBonus.toLocaleString('es-CL')}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
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
                            <p className="font-black text-slate-900 uppercase text-lg tracking-tight italic">Sin ID Recurso asociado</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2 max-w-sm px-10">Tu perfil no tiene un ID Recurso vinculado. Contacta a Operaciones.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {(() => {
                            // --- Cálculo de KPIs Telecom ---
                            const META_DIARIA_KPI = 7.5;

                            const asignadas = prod?.recientes?.length || 0;
                            const completadas = prod?.recientes?.filter(act => {
                                const estLower = (act.Estado || act.estado || '').toLowerCase();
                                return estLower.includes('completad') || estLower.includes('finalizad') || estLower.includes('ok') || estLower.includes('ejecutad');
                            }).length || 0;
                            const pendientes = asignadas - completadas;
                            const eficienciaPct = asignadas > 0 ? Math.round((completadas / asignadas) * 100) : 0;

                            // --- Clasificación y Tiempos por Tipo de Actividad ---
                            const tipoMap = {
                                alta:       { label: 'Altas / Instalaciones', icon: '🟢', completadas: 0, asignadas: 0, minutos: 0, count: 0, pts: 0 },
                                reparacion: { label: 'Reparaciones / Averías', icon: '🔴', completadas: 0, asignadas: 0, minutos: 0, count: 0, pts: 0 },
                                rutina:     { label: 'Rutinas / Otros',        icon: '🔵', completadas: 0, asignadas: 0, minutos: 0, count: 0, pts: 0 },
                            };

                            let totalMinutos = 0;
                            (prod?.recientes || []).forEach(act => {
                                const estLower = (act.Estado || act.estado || '').toLowerCase();
                                const isCompleted = estLower.includes('completad') || estLower.includes('finalizad') || estLower.includes('ok') || estLower.includes('ejecutad');

                                let minDur = 0;
                                const durRaw = act['Duración de la actividad'] || act['Duración_de_la_actividad'] || act['duracion'] || '';
                                if (durRaw && typeof durRaw === 'string' && durRaw.includes(':')) {
                                    const parts = durRaw.split(':');
                                    if (parts.length === 2) {
                                        minDur = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                                    }
                                }
                                // 40 min fijos por traslado/contacto
                                minDur += 40;
                                if (isCompleted) totalMinutos += minDur;

                                const cat = getCategory(act);
                                tipoMap[cat].asignadas += 1;
                                tipoMap[cat].pts += (act.PTS_TOTAL_BAREMO || act.ptsVisible || 0);
                                if (isCompleted) {
                                    tipoMap[cat].completadas += 1;
                                    tipoMap[cat].minutos += minDur;
                                    tipoMap[cat].count += 1;
                                }
                            });

                            const totalHoras = Math.round((totalMinutos / 60) * 10) / 10;
                            const avgMinutos = completadas > 0 ? Math.round(totalMinutos / completadas) : 0;

                            const promedioDiario = prod?.resumen?.promedioPorDia || 0;
                            const rendimientoMetaPct = Math.min(100, Math.round((promedioDiario / META_DIARIA_KPI) * 100));
                            const ptsVsMetaMensual = Math.min(100, Math.round((totalPuntos / META_MENSUAL) * 100));

                            // Velocidad por tipo
                            const velocidadTipos = Object.entries(tipoMap).map(([key, t]) => ({
                                key,
                                label: t.label,
                                icon: t.icon,
                                asignadas: t.asignadas,
                                completadas: t.completadas,
                                efPct: t.asignadas > 0 ? Math.round((t.completadas / t.asignadas) * 100) : 0,
                                avgMin: t.count > 0 ? Math.round(t.minutos / t.count) : 0,
                                pts: Math.round(t.pts * 10) / 10,
                                ptsAvg: t.completadas > 0 ? Math.round((t.pts / t.completadas) * 10) / 10 : 0,
                            })).filter(t => t.asignadas > 0);

                            // --- Dataset 1: Tendencia Diaria de Puntos ---
                            const dailyMap = {};
                            (prod?.recientes || []).forEach(act => {
                                if (!act.fecha) return;
                                const d = act.fecha.split('T')[0];
                                if (!dailyMap[d]) dailyMap[d] = { date: d, pts: 0, ots: 0 };
                                dailyMap[d].pts += (act.PTS_TOTAL_BAREMO || act.ptsVisible || 0);
                                dailyMap[d].ots += 1;
                            });
                            const dailyTrend = Object.values(dailyMap)
                                .sort((a, b) => a.date.localeCompare(b.date))
                                .map(d => ({
                                    ...d,
                                    label: d.date.split('-').slice(1).reverse().join('/'),
                                    pts: Math.round(d.pts * 10) / 10
                                }));

                            // --- Dataset 2: Promedio por Día de Semana ---
                            const dowMap = {
                                1: { day: 'Lu', pts: 0, days: new Set() },
                                2: { day: 'Ma', pts: 0, days: new Set() },
                                3: { day: 'Mi', pts: 0, days: new Set() },
                                4: { day: 'Ju', pts: 0, days: new Set() },
                                5: { day: 'Vi', pts: 0, days: new Set() },
                                6: { day: 'Sá', pts: 0, days: new Set() },
                                0: { day: 'Do', pts: 0, days: new Set() }
                            };
                            (prod?.recientes || []).forEach(act => {
                                if (!act.fecha) return;
                                const dObj = new Date(act.fecha);
                                const dayNum = dObj.getDay();
                                const dateStr = act.fecha.split('T')[0];
                                if (dowMap[dayNum]) {
                                    dowMap[dayNum].pts += (act.PTS_TOTAL_BAREMO || act.ptsVisible || 0);
                                    dowMap[dayNum].days.add(dateStr);
                                }
                            });
                            const dowData = [1, 2, 3, 4, 5, 6, 0].map(num => {
                                const item = dowMap[num];
                                const activeDaysCount = item.days.size;
                                return {
                                    day: item.day,
                                    avg: activeDaysCount > 0 ? Math.round((item.pts / activeDaysCount) * 10) / 10 : 0
                                };
                            });

                            // --- Dataset 3: Top Actividades ---
                            const activityMap = {};
                            (prod?.recientes || []).forEach(act => {
                                const name = act.actividadVisible || act.Actividad || 'Op. Técnica';
                                if (!activityMap[name]) activityMap[name] = { name, pts: 0, count: 0 };
                                activityMap[name].pts += (act.PTS_TOTAL_BAREMO || act.ptsVisible || 0);
                                activityMap[name].count += 1;
                            });
                            const topActivities = Object.values(activityMap)
                                .sort((a, b) => b.pts - a.pts)
                                .slice(0, 5)
                                .map(a => ({
                                    ...a,
                                    pts: Math.round(a.pts * 10) / 10,
                                    avg: a.count > 0 ? Math.round((a.pts / a.count) * 10) / 10 : 0,
                                    nameShort: a.name.length > 28 ? a.name.slice(0, 26) + '…' : a.name,
                                }));

                            // Componentes Auxiliares Locales
                            const KpiTooltip = ({ active, payload, label, unit = 'pts' }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-4 shadow-2xl min-w-[140px] text-left">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                                        <p className="text-xl font-black text-white leading-none">
                                            {payload[0].value?.toLocaleString('es-CL', { minimumFractionDigits: 1 })}
                                            <span className="text-[10px] text-indigo-400 font-bold ml-1">{unit}</span>
                                        </p>
                                        {payload[1] && <p className="text-[9px] text-slate-400 mt-1">{payload[1].name}: {payload[1].value}</p>}
                                    </div>
                                );
                            };

                            const DowLabel = (props) => {
                                const { x, y, width, value } = props;
                                if (!value || value === 0) return null;
                                const cumple = value >= META_DIARIA_KPI;
                                return (
                                    <text
                                        x={x + width / 2}
                                        y={y - 6}
                                        fill={cumple ? '#10b981' : '#f59e0b'}
                                        fontSize={10}
                                        fontWeight={900}
                                        textAnchor="middle"
                                    >
                                        {value}
                                    </text>
                                );
                            };

                            const TrendLabel = (props) => {
                                const { x, y, value } = props;
                                if (!value || value === 0) return null;
                                const cumple = value >= META_DIARIA_KPI;
                                return (
                                    <text x={x} y={y - 8} fill={cumple ? '#10b981' : '#6366f1'} fontSize={9} fontWeight={900} textAnchor="middle">
                                        {value}
                                    </text>
                                );
                            };

                            const TopActLabel = (props) => {
                                const { x, y, width, value } = props;
                                if (!value || value === 0) return null;
                                return (
                                    <text x={x + width + 6} y={y + 10} fill="#475569" fontSize={10} fontWeight={900}>
                                        {value} pts
                                    </text>
                                );
                            };

                            return (
                                <div className="space-y-12">
                                    {/* ── TARJETA PREMIUM DE AVANCE UNIFICADA ── */}
                                    <div className="bg-slate-900 rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 text-white relative overflow-hidden group shadow-2xl shadow-slate-200">
                                        <div className="absolute -right-20 -bottom-20 text-white/5 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
                                            <TrendingUp size={300} />
                                        </div>
                                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8 h-full">
                                            <div className="flex-1 space-y-6">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-[10px] sm:text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] italic mb-3">Avance Meta Mensual ({availableMonths.find(m => m.id === selectedMonth)?.name})</h4>
                                                        <p className="text-5xl sm:text-7xl font-black italic tracking-tighter">{cumplimientoMeta}%</p>
                                                    </div>
                                                    <div className="px-6 py-3.5 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 text-center shadow-2xl flex flex-col items-center justify-center">
                                                        <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">Días Laborales</p>
                                                        <p className="text-xl sm:text-2xl font-black uppercase italic leading-none">{diasTrabajados} <span className="text-[10px] opacity-20">DE 24</span></p>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-end text-[11px] sm:text-[12px] font-black uppercase tracking-[0.2em]">
                                                        <span className="text-white/60">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts acumulados</span>
                                                        <span className="text-indigo-400">Meta: {META_MENSUAL} pts</span>
                                                    </div>
                                                    <div className="h-5 sm:h-6 bg-white/5 rounded-full overflow-hidden p-1.5 border border-white/10">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-violet-600 rounded-full transition-all duration-1000 shadow-[0_0_30px_rgba(99,102,241,0.4)]"
                                                            style={{ width: `${cumplimientoMeta}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="hidden lg:block w-px h-32 bg-white/10 mx-8" />

                                            <div className="flex flex-col sm:flex-row lg:flex-col gap-4 sm:gap-6 lg:gap-4 justify-between lg:justify-center items-center shrink-0">
                                                <div className="flex items-center gap-4 bg-white/5 rounded-3xl p-5 border border-white/10 min-w-[200px] shadow-xl">
                                                    <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                                        <Award size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Puntos Netos</p>
                                                        <p className="text-2xl font-black text-white leading-none italic">{(Math.round(totalPuntos * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1 })} <span className="text-[10px] opacity-40 not-italic">PTS</span></p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 bg-emerald-500/10 rounded-3xl p-5 border border-emerald-500/20 min-w-[200px] shadow-xl">
                                                    <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                                                        <Trophy size={24} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Posición Ranking</p>
                                                        <p className="text-2xl font-black text-white leading-none italic">#{prod?.resumen?.ranking?.posicion || '—'} <span className="text-[10px] opacity-40 not-italic">/ {prod?.resumen?.ranking?.total || 0}</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── ROW DE 3 TARJETAS KPI TELECOM ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                        {/* ── TARJETA 1: EFICIENCIA OPERATIVA ── */}
                                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-emerald-100/50 hover:-translate-y-1 transition-all relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
                                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm"><Zap size={22} /></div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Métrica de Calidad</p>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase italic leading-none">Eficiencia Operativa</h4>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-2 relative z-10">
                                                <div>
                                                    <p className="text-5xl font-black text-slate-800 leading-none italic tracking-tighter">{eficienciaPct}<span className="text-xl opacity-40">%</span></p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">{completadas} de {asignadas} asignadas</p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{completadas} realizadas</span>
                                                        <span className="text-slate-200">·</span>
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-rose-500"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />{pendientes} no realizadas</span>
                                                    </div>
                                                </div>
                                                <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle cx="32" cy="32" r="26" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                                                        <circle cx="32" cy="32" r="26" stroke={eficienciaPct >= 90 ? '#10b981' : eficienciaPct >= 70 ? '#f59e0b' : '#ef4444'} strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - eficienciaPct / 100)} strokeLinecap="round" />
                                                    </svg>
                                                    <span className={`absolute text-[10px] font-black tracking-tighter ${eficienciaPct >= 90 ? 'text-emerald-600' : eficienciaPct >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>{eficienciaPct}%</span>
                                                </div>
                                            </div>
                                            {/* Desglose por tipo */}
                                            {velocidadTipos.length > 0 && (
                                                <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 relative z-10">
                                                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Desglose por Tipo</p>
                                                    {velocidadTipos.map(t => (
                                                        <div key={t.key}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[9px] font-black text-slate-600 flex items-center gap-1.5">{t.icon} {t.label.split('/')[0].trim()}</span>
                                                                <span className="text-[9px] font-black text-slate-500">{t.completadas}/{t.asignadas} · <span className={t.efPct >= 90 ? 'text-emerald-600' : t.efPct >= 70 ? 'text-amber-500' : 'text-rose-500'}>{t.efPct}%</span></span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-700 ${t.efPct >= 90 ? 'bg-emerald-400' : t.efPct >= 70 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${t.efPct}%` }} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── TARJETA 2: HORAS DE ACTIVIDAD ── */}
                                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-amber-100/50 hover:-translate-y-1 transition-all relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
                                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl shadow-sm"><Clock size={22} /></div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Gestión de Tiempos</p>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase italic leading-none">Horas de Actividad</h4>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-2 relative z-10">
                                                <div>
                                                    <p className="text-5xl font-black text-slate-800 leading-none italic tracking-tighter">{totalHoras} <span className="text-xs opacity-40 not-italic uppercase">HRS</span></p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 italic">Prom. Global: {avgMinutos} min/actividad</p>
                                                </div>
                                                <div className="w-12 h-12 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                                                    <Timer size={24} className="animate-pulse" />
                                                </div>
                                            </div>
                                            {/* Velocidad por tipo de actividad con metas */}
                                            {(() => {
                                                // Metas de tiempo por tipo
                                                const metaMin = { alta: 90, reparacion: 45, rutina: 30 }; // minutos
                                                const metaLabel = { alta: '1.5 hrs', reparacion: '45 min', rutina: '30 min' };
                                                return velocidadTipos.length > 0 && (
                                                    <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 relative z-10">
                                                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Velocidad por Tipo vs Meta</p>
                                                        {velocidadTipos.map(t => {
                                                            const meta = metaMin[t.key] || 60;
                                                            const pct = meta > 0 ? Math.min(100, Math.round((t.avgMin / meta) * 100)) : 0;
                                                            // Verde = debajo de la meta (más rápido), rojo = supera la meta (más lento)
                                                            const cumple = t.avgMin <= meta || t.avgMin === 0;
                                                            return (
                                                                <div key={t.key} className="py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                    <div className="flex justify-between items-center mb-1.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm">{t.icon}</span>
                                                                            <div>
                                                                                <p className="text-[9px] font-black text-slate-700 leading-none">{t.label.split('/')[0].trim()}</p>
                                                                                <p className="text-[8px] font-bold text-slate-400 mt-0.5">{t.completadas} ej. · Meta: {metaLabel[t.key]}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className={`text-sm font-black italic ${cumple ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                                                {t.avgMin > 0 ? t.avgMin : '—'}<span className="text-[8px] font-bold text-slate-400 not-italic ml-0.5">min</span>
                                                                            </p>
                                                                            <p className="text-[8px] font-bold text-slate-400">{t.ptsAvg} pts/OT</p>
                                                                        </div>
                                                                    </div>
                                                                    {t.avgMin > 0 && (
                                                                        <div className="relative h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all duration-700 ${cumple ? 'bg-emerald-400' : 'bg-rose-400'}`}
                                                                                style={{ width: `${Math.min(100, pct)}%` }}
                                                                            />
                                                                            {/* Marca de meta al 100% */}
                                                                            <div className="absolute right-0 top-0 h-full w-0.5 bg-slate-400 opacity-60" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* ── TARJETA 3: PUNTOS POR DÍA vs META ── */}
                                        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 hover:-translate-y-1 transition-all relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-1000" />
                                            <div className="flex items-center gap-4 mb-6 relative z-10">
                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm"><Gauge size={22} /></div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Productividad Diaria</p>
                                                    <h4 className="text-sm font-black text-slate-800 uppercase italic leading-none">Puntos por Día</h4>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-2 relative z-10">
                                                <div>
                                                    <p className="text-5xl font-black text-slate-800 leading-none italic tracking-tighter">{(Math.round(promedioDiario * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1 })} <span className="text-xs opacity-40 not-italic uppercase">PTS</span></p>
                                                    <p className={`text-[10px] font-black uppercase tracking-widest mt-2 italic ${rendimientoMetaPct >= 100 ? 'text-emerald-600' : rendimientoMetaPct >= 70 ? 'text-amber-500' : 'text-rose-500'}`}>
                                                        {rendimientoMetaPct}% de meta diaria ({META_DIARIA_KPI} pts)
                                                    </p>
                                                </div>
                                                <div className="w-16 h-16 relative flex items-center justify-center shrink-0">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle cx="32" cy="32" r="26" stroke="#f1f5f9" strokeWidth="6" fill="transparent" />
                                                        <circle cx="32" cy="32" r="26" stroke={rendimientoMetaPct >= 100 ? '#10b981' : rendimientoMetaPct >= 70 ? '#f59e0b' : '#6366f1'} strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - rendimientoMetaPct / 100)} strokeLinecap="round" />
                                                    </svg>
                                                    <span className={`absolute text-[10px] font-black tracking-tighter ${rendimientoMetaPct >= 100 ? 'text-emerald-600' : rendimientoMetaPct >= 70 ? 'text-amber-500' : 'text-indigo-600'}`}>{rendimientoMetaPct}%</span>
                                                </div>
                                            </div>
                                            {/* Análisis vs Meta */}
                                            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 relative z-10">
                                                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Análisis vs Meta</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-center">
                                                        <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Meta Diaria</p>
                                                        <p className="text-base font-black text-indigo-700 italic">{META_DIARIA_KPI}<span className="text-[9px] opacity-60 ml-0.5 not-italic">pts</span></p>
                                                    </div>
                                                    <div className={`rounded-2xl p-3 text-center border ${rendimientoMetaPct >= 100 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${rendimientoMetaPct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>Promedio Real</p>
                                                        <p className={`text-base font-black italic ${rendimientoMetaPct >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                            {(Math.round(promedioDiario * 10) / 10).toLocaleString('es-CL', { minimumFractionDigits: 1 })}<span className="text-[9px] opacity-60 ml-0.5 not-italic">pts</span>
                                                        </p>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Días Activos</p>
                                                        <p className="text-base font-black text-slate-700 italic">{dailyTrend.length}<span className="text-[9px] opacity-60 ml-0.5 not-italic">días</span></p>
                                                    </div>
                                                    <div className={`rounded-2xl p-3 text-center border ${promedioDiario >= META_DIARIA_KPI ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${promedioDiario >= META_DIARIA_KPI ? 'text-emerald-400' : 'text-rose-400'}`}>Estado Meta</p>
                                                        <p className={`text-[11px] font-black italic leading-tight ${promedioDiario >= META_DIARIA_KPI ? 'text-emerald-700' : 'text-rose-600'}`}>
                                                            {promedioDiario >= META_DIARIA_KPI ? '✅ Cumple' : '⚠️ Por alcanzar'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── SECCIÓN DE GRÁFICOS DE RENDIMIENTO ── */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                                        {/* Tendencia diaria con etiquetas */}
                                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 sm:p-8 min-w-0">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2"><TrendingUp size={16} className="text-indigo-500" /> Tendencia de Puntos Diarios</h4>
                                                <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-black text-indigo-600 uppercase">Meta: {META_DIARIA_KPI} pts/día</span>
                                            </div>
                                            <div className="h-[240px] w-full">
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                    <ComposedChart data={dailyTrend} margin={{ top: 22, right: 10, left: -25, bottom: 0 }}>
                                                        <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip content={<KpiTooltip unit="pts" />} />
                                                        <ReferenceLine y={META_DIARIA_KPI} stroke="#10b981" strokeDasharray="5 3" strokeWidth={2} label={{ value: `Meta ${META_DIARIA_KPI}`, position: 'right', fontSize: 9, fontWeight: 900, fill: '#10b981', dx: 4 }} />
                                                        <defs>
                                                            <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                                                            </linearGradient>
                                                        </defs>
                                                        <Area type="monotone" dataKey="pts" fill="url(#colorPts)" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 6 }} />
                                                        <Line type="monotone" dataKey="pts" stroke="#6366f1" strokeWidth={3} dot={{ r: 3, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }} label={<TrendLabel />} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Promedio por día de semana con etiquetas y meta coloreada */}
                                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 sm:p-8 min-w-0">
                                            <div className="flex justify-between items-center mb-6">
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2"><Calendar size={16} className="text-emerald-500" /> Promedio por Día de Semana</h4>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[9px] font-black text-slate-400 uppercase">≥ Meta</span></div>
                                                    <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-[9px] font-black text-slate-400 uppercase">Bajo Meta</span></div>
                                                </div>
                                            </div>
                                            <div className="h-[240px] w-full">
                                                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                    <BarChart data={dowData} margin={{ top: 22, right: 10, left: -25, bottom: 0 }}>
                                                        <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 900, fill: '#475569' }} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip content={<KpiTooltip unit="pts" />} />
                                                        <ReferenceLine y={META_DIARIA_KPI} stroke="#10b981" strokeDasharray="5 3" strokeWidth={2} label={{ value: `${META_DIARIA_KPI} pts`, position: 'right', fontSize: 9, fontWeight: 900, fill: '#10b981', dx: 4 }} />
                                                        <Bar dataKey="avg" radius={[8, 8, 0, 0]} maxBarSize={36} label={<DowLabel />}>
                                                            {dowData.map((entry, index) => (
                                                                <Cell key={index} fill={entry.avg >= META_DIARIA_KPI ? '#10b981' : entry.avg > 0 ? '#f59e0b' : '#e2e8f0'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Top Actividades con etiquetas y columna de cantidad */}
                                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 sm:p-8 mt-8 min-w-0">
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest italic flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Top Actividades por Puntos Baremo</h4>
                                            <span className="px-3 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[9px] font-black text-amber-600 uppercase">{topActivities.length} tipos distintos</span>
                                        </div>
                                        <div className="h-[260px] w-full">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                                                <BarChart data={topActivities} layout="vertical" margin={{ top: 5, right: 80, left: 10, bottom: 5 }}>
                                                    <XAxis type="number" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                    <YAxis type="category" dataKey="nameShort" tick={{ fontSize: 9, fontWeight: 800, fill: '#475569' }} width={130} axisLine={false} tickLine={false} />
                                                    <RechartsTooltip content={<KpiTooltip unit="pts" />} />
                                                    <Bar dataKey="pts" radius={[0, 8, 8, 0]} maxBarSize={22} label={<TopActLabel />}>
                                                        {topActivities.map((entry, index) => (
                                                            <Cell key={index} fill={index === 0 ? '#4f46e5' : index === 1 ? '#6366f1' : index === 2 ? '#818cf8' : '#a5b4fc'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {/* Tabla resumen por actividad con % de peso */}
                                        {topActivities.length > 0 && (() => {
                                            const totalPtsTop = topActivities.reduce((s, a) => s + a.pts, 0);
                                            const totalOtsTop = topActivities.reduce((s, a) => s + a.count, 0);
                                            return (
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <div className="grid grid-cols-5 gap-2 text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 px-2">
                                                        <span className="col-span-2">Actividad</span>
                                                        <span className="text-center">OTs</span>
                                                        <span className="text-center">Pts/OT</span>
                                                        <span className="text-center">% Peso</span>
                                                    </div>
                                                    {topActivities.map((t, i) => {
                                                        const pesoPts = totalPtsTop > 0 ? Math.round((t.pts / totalPtsTop) * 100) : 0;
                                                        const pesoOts = totalOtsTop > 0 ? Math.round((t.count / totalOtsTop) * 100) : 0;
                                                        return (
                                                            <div key={i} className="grid grid-cols-5 gap-2 items-center py-2 px-2 rounded-xl hover:bg-slate-50 transition-colors">
                                                                <span className="col-span-2 text-[9px] font-bold text-slate-600 truncate">{t.nameShort}</span>
                                                                <span className="text-[10px] font-black text-slate-700 text-center">{t.count}</span>
                                                                <span className="text-[10px] font-black text-indigo-600 text-center">{t.avg}</span>
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-[10px] font-black text-amber-600">{pesoPts}%</span>
                                                                    <div className="w-full h-1 bg-slate-100 rounded-full mt-0.5 overflow-hidden">
                                                                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pesoPts}%` }} />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Operative Log (The Bitacora) */}
                        <div className="bg-white rounded-[2.5rem] sm:rounded-[4rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                            <div className="bg-slate-900 px-6 sm:px-12 py-8 sm:py-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6 sm:gap-8">
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className="w-3 h-12 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                                    <div>
                                        <h4 className="text-white font-black uppercase text-base sm:text-lg tracking-[0.1em] italic leading-none">Bitácora Técnica de Producción</h4>
                                        <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2 sm:mt-2 italic opacity-60">Sincronización Real-Time con TOA</p>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-4 xl:ml-12">
                                    {/* Búsqueda por texto */}
                                    <div className="relative flex-1">
                                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar por OT o Actividad..."
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold text-white placeholder:text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:bg-white/10 transition-all border-dashed"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>

                                    {/* Filtro por Fecha */}
                                    <div className="relative flex items-center gap-2">
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-5 text-[11px] font-black text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:bg-white/10 transition-all cursor-pointer tracking-widest appearance-none min-w-[160px] [color-scheme:dark]"
                                                value={filterDate}
                                                onChange={e => setFilterDate(e.target.value)}
                                            />
                                            {filterDate && (
                                                <button
                                                    onClick={() => setFilterDate('')}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                                    title="Limpiar fecha"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setFilterDate(new Date().toISOString().slice(0, 10))}
                                            className={`px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                                filterDate === new Date().toISOString().slice(0, 10)
                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                                    : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            Hoy
                                        </button>
                                    </div>

                                    {/* Filtro por Tipo */}
                                    <select 
                                        className="bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-[10px] font-black uppercase text-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 appearance-none cursor-pointer tracking-widest min-w-[160px]"
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

                                <button onClick={handleExportProduccionCsv} className="px-6 sm:px-8 py-4 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all border border-white/10 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-xl">
                                    <FileText size={18} />
                                    <span>Exportar CSV</span>
                                </button>
                            </div>

                            {/* Vista de Escritorio - Tabla Completa */}
                            <div className="hidden lg:block overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left border-collapse">
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
                                                    const matchDate = !filterDate || (act.fecha && new Date(act.fecha).toISOString().slice(0,10) === filterDate);
                                                    return matchSearch && matchType && matchDate;
                                                })
                                                .map((act, idx) => {
                                                const hasAppeal = !!act.apelacion;
                                                const appealStatus = act.apelacion?.status;
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
                                                         className={`transition-all cursor-pointer group ${
                                                             hasAppeal ? (
                                                                 appealStatus === 'por_validar' ? 'bg-amber-50/20 hover:bg-amber-50/40' :
                                                                 appealStatus === 'aprobada' ? 'bg-emerald-50/20 hover:bg-emerald-50/40' :
                                                                 'bg-rose-50/10 hover:bg-rose-50/20'
                                                             ) : 'hover:bg-slate-50/80'
                                                         }`}
                                                     >
                                                         <td className={`px-12 py-8 min-w-[180px] ${
                                                             hasAppeal ? (
                                                                 appealStatus === 'por_validar' ? 'border-l-4 border-amber-500' :
                                                                 appealStatus === 'aprobada' ? 'border-l-4 border-emerald-500' :
                                                                 'border-l-4 border-rose-500'
                                                             ) : ''
                                                         }`}>
                                                             <div className="flex flex-col gap-1.5">
                                                                 <span className="text-sm font-black text-slate-900 italic tracking-tight">{act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '—'}</span>
                                                                 <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest w-fit border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                                                                     OT: {act.ordenId || act.ID_Orden || 'N/A'}
                                                                 </span>
                                                                 {hasAppeal && (
                                                                     <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest w-fit border mt-1.5 animate-pulse ${
                                                                         appealStatus === 'por_validar' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                         appealStatus === 'aprobada' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                                         'bg-rose-50 text-rose-600 border-rose-200'
                                                                     }`}>
                                                                         {appealStatus === 'por_validar' && '⚠️ Pendiente'}
                                                                         {appealStatus === 'aprobada' && '✅ Aprobada'}
                                                                         {appealStatus === 'rechazada' && '❌ Rechazada'}
                                                                     </span>
                                                                 )}
                                                             </div>
                                                         </td>
                                                        <td className="px-8 py-8 min-w-[340px]">
                                                             <div className="space-y-2.5">
                                                                 {/* Nombre actividad + badge categoría */}
                                                                 <div className="flex items-start gap-2 flex-wrap">
                                                                     <p className="text-sm font-black text-slate-900 uppercase italic leading-none tracking-tight group-hover:text-indigo-600 transition-colors">{act.actividadVisible || act.Actividad || 'Op. Técnica'}</p>
                                                                     {(() => { const cat = getCategory(act); const s = CATEGORY_STYLES[cat]; return <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border whitespace-nowrap ${s.cls}`}>{s.label}</span>; })()}
                                                                 </div>
                                                                 <p className="text-[10px] font-bold text-slate-400 uppercase truncate max-w-[300px] tracking-widest opacity-60">{act.Subtipo_de_Actividad || 'General'}</p>
                                                                 {/* Datos cliente */}
                                                                 <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                                                                     {(act.Nombre || act.nombre_cliente) && (
                                                                         <div className="flex items-center gap-1.5">
                                                                             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Cliente</span>
                                                                             <span className="text-[10px] font-bold text-slate-600 truncate max-w-[240px]">{act.Nombre || act.nombre_cliente}</span>
                                                                         </div>
                                                                     )}
                                                                     {(act.Direccion || act.direccion) && (
                                                                         <div className="flex items-center gap-1.5">
                                                                             <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Dir.</span>
                                                                             <span className="text-[10px] font-bold text-slate-500 truncate max-w-[240px]">{act.Direccion || act.direccion}</span>
                                                                         </div>
                                                                     )}
                                                                     {(act.Comuna || act.comuna) && (
                                                                         <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-widest w-fit">{act.Comuna || act.comuna}</span>
                                                                     )}
                                                                 </div>
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

                            {/* Vista Móvil - Lista de Tarjetas */}
                            <div className="block lg:hidden divide-y divide-slate-100">
                                {(!prod?.recientes || prod.recientes.length === 0) ? (
                                    <div className="py-20 text-center flex flex-col items-center">
                                        <Activity className="text-slate-100 mb-6 animate-pulse" size={60} />
                                        <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Sin registros para el periodo</p>
                                    </div>
                                ) : (
                                    prod.recientes
                                        .filter(act => {
                                            const matchSearch = (act.ordenId || act.ID_Orden || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                               (act.actividadVisible || act.Actividad || '').toLowerCase().includes(searchQuery.toLowerCase());
                                            const matchType = filterType === 'Todos' || (act.Subtipo_de_Actividad || act.Actividad || '').toUpperCase().includes(filterType);
                                            const matchDate = !filterDate || (act.fecha && new Date(act.fecha).toISOString().slice(0,10) === filterDate);
                                            return matchSearch && matchType && matchDate;
                                        })
                                        .map((act, idx) => {
                                            const hasAppeal = !!act.apelacion;
                                            const appealStatus = act.apelacion?.status;
                                            const ptsBase = act.Pts_Actividad_Base || 0;
                                            const ptsDecos = act.Pts_Deco_Adicional || 0;
                                            const ptsRepes = act.Pts_Repetidor_WiFi || 0;
                                            const cantDecos = parseInt(act.Decos_Adicionales || 0);
                                            const cantRepes = parseInt(act.Repetidores_WiFi || 0);
                                            const total = act.PTS_TOTAL_BAREMO || act.ptsVisible || 0;

                                            return (
                                                <div 
                                                    key={idx} 
                                                    onClick={() => openOTDetail(act)}
                                                    className={`p-6 transition-all cursor-pointer flex flex-col gap-4 ${
                                                        hasAppeal ? (
                                                            appealStatus === 'por_validar' ? 'bg-amber-50/30 border-l-4 border-amber-500 border-b border-slate-100' :
                                                            appealStatus === 'aprobada' ? 'bg-emerald-50/30 border-l-4 border-emerald-500 border-b border-slate-100' :
                                                            'bg-rose-50/20 border-l-4 border-rose-500 border-b border-slate-100'
                                                        ) : 'hover:bg-slate-50 active:bg-slate-100/80 border-b border-slate-100'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-black text-slate-900 tracking-tight">{act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '—'}</span>
                                                            {hasAppeal && (
                                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest w-fit border animate-pulse ${
                                                                    appealStatus === 'por_validar' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                                    appealStatus === 'aprobada' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                                    'bg-rose-50 text-rose-600 border-rose-200'
                                                                }`}>
                                                                    {appealStatus === 'por_validar' && '⚠️ Pendiente'}
                                                                    {appealStatus === 'aprobada' && '✅ Aprobada'}
                                                                    {appealStatus === 'rechazada' && '❌ Rechazada'}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                                            OT: {act.ordenId || act.ID_Orden || 'N/A'}
                                                        </span>
                                                    </div>


                                                    <div className="space-y-2">
                                                        {/* Actividad + badge categoría */}
                                                        <div className="flex items-start gap-2 flex-wrap">
                                                            <p className="text-sm font-black text-slate-800 uppercase italic leading-tight">{act.actividadVisible || act.Actividad || 'Op. Técnica'}</p>
                                                            {(() => { const cat = getCategory(act); const s = CATEGORY_STYLES[cat]; return <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border whitespace-nowrap ${s.cls}`}>{s.label}</span>; })()}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{act.Subtipo_de_Actividad || 'General'}</p>
                                                        {/* Datos cliente en móvil */}
                                                        <div className="flex flex-col gap-1 pt-2 border-t border-slate-100 mt-1">
                                                            {(act.Nombre || act.nombre_cliente) && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Cliente</span>
                                                                    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[220px]">{act.Nombre || act.nombre_cliente}</span>
                                                                </div>
                                                            )}
                                                            {(act.Direccion || act.direccion) && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Dir.</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 truncate max-w-[220px]">{act.Direccion || act.direccion}</span>
                                                                </div>
                                                            )}
                                                            {(act.Comuna || act.comuna) && (
                                                                <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-widest w-fit">{act.Comuna || act.comuna}</span>
                                                            )}
                                                        </div>
                                                    </div>


                                                    <div className="flex justify-between items-center pt-2">
                                                        <div className="flex gap-1.5 flex-wrap">
                                                            {cantDecos > 0 && (
                                                                <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-[9px] font-black text-indigo-700 rounded-lg">
                                                                    {cantDecos} STB
                                                                </span>
                                                            )}
                                                            {cantRepes > 0 && (
                                                                <span className="px-2 py-1 bg-amber-50 border border-amber-100 text-[9px] font-black text-amber-700 rounded-lg">
                                                                    {cantRepes} WIFI
                                                                </span>
                                                            )}
                                                            {!cantDecos && !cantRepes && (
                                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic">Base Sola</span>
                                                            )}
                                                        </div>

                                                        <div className="text-right flex items-center gap-3">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-2xl font-black text-slate-800 italic tracking-tighter leading-none">{total.toLocaleString('es-CL', { minimumFractionDigits: 1 })}</span>
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Puntos</span>
                                                            </div>
                                                            <div className={`w-2 h-2 rounded-full ${act.Estado?.toLowerCase().includes('complet') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>

                        {/* Modal de Detalle de OT & Apelación (Mejorado) */}
                        {selectedOT && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                                <div className="bg-white w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-200 flex flex-col max-h-[90vh]">
                                    
                                    {/* Modal Header */}
                                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                                                <ClipboardCheck size={20} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Detalle Operativo & Apelación</h3>
                                                    {selectedOT.apelacion?.status === 'por_validar' && (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 text-[9px] font-black uppercase flex items-center gap-1 shadow-sm"><Clock size={10} /> Pendiente</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">OT: {selectedOT.ordenId || selectedOT.ID_Orden || 'S/N'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedOT(null)} 
                                            className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    {/* Modal Body */}
                                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                                        
                                        {/* Información de Terreno (Compacta) */}
                                        <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 mb-6 shadow-sm">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block border-b border-slate-100 pb-2 mb-2">Información de Terreno</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de la Actividad</p>
                                                    <p className="text-xs font-bold text-slate-800">{selectedOT.fecha ? new Date(selectedOT.fecha).toLocaleDateString('es-CL') : (selectedOT.Fecha_de_Cita || selectedOT['Fecha de Cita'] || 'N/A')}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                                    <p className="text-xs font-bold text-slate-800 truncate" title={selectedOT.Nombre || selectedOT.NOMBRE}>{selectedOT.Nombre || selectedOT.NOMBRE || 'N/A'}</p>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dirección</p>
                                                    <p className="text-xs font-bold text-slate-800">
                                                        {[selectedOT.Direccion || selectedOT.DIRECCION, selectedOT.Comuna || selectedOT.COMUNA].filter(Boolean).join(', ') || 'N/A'}
                                                    </p>
                                                </div>
                                                
                                                {/* Nuevos Campos Agregados */}
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ventana de Servicio</p>
                                                    <p className="text-xs font-bold text-slate-800">{selectedOT['Ventana de servicio'] || selectedOT.Ventana_de_servicio || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Inicio - Fin (Visita)</p>
                                                    <p className="text-xs font-bold text-slate-800">{selectedOT['Inicio - Fin'] || selectedOT['Inicio_-_Fin'] || selectedOT.Inicio_Fin || 'N/A'}</p>
                                                </div>
                                                {(selectedOT['Submotivo de Reparacion'] || selectedOT.Submotivo_de_Reparacion || selectedOT.Submotivo_de_Reparación) && (
                                                    <div className="sm:col-span-2">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Submotivo de Reparación</p>
                                                        <p className="text-xs font-bold text-slate-800">{selectedOT['Submotivo de Reparacion'] || selectedOT.Submotivo_de_Reparacion || selectedOT.Submotivo_de_Reparación}</p>
                                                    </div>
                                                )}

                                                {(selectedOT.Observaciones || selectedOT.OBSERVACIONES || selectedOT.OBSERVACION) && (
                                                    <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observación del Trabajo (TOA)</p>
                                                        <p className="text-xs font-medium text-slate-600 italic">"{selectedOT.Observaciones || selectedOT.OBSERVACIONES || selectedOT.OBSERVACION}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {!isAppealing ? (
                                            <div className="space-y-6 animate-in slide-in-from-bottom-2">
                                                {/* Puntos y Desglose Actual */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    
                                                    {/* Tarjeta de Producción */}
                                                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100/50 flex flex-col justify-center">
                                                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1 opacity-80">Actividad Registrada</p>
                                                        <h4 className="text-lg font-black leading-tight mb-4">{selectedOT.actividadVisible}</h4>
                                                        
                                                        <div className="flex justify-between items-end border-t border-indigo-500/50 pt-4 mt-auto">
                                                            <div>
                                                                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Base LPU</p>
                                                                <p className="text-xl font-black font-mono">{selectedOT.Pts_Actividad_Base || 0}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1">Total Calculado</p>
                                                                <p className="text-3xl font-black font-mono">{selectedOT.ptsVisible || 0} <span className="text-sm font-bold opacity-50">pts</span></p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Equipamiento TOA */}
                                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Desglose de Equipos (TOA)</h4>
                                                        
                                                        <div className="space-y-4">
                                                            <div>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base Instalada</span>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[9px] font-black text-slate-600 uppercase">{selectedOT.Equipos_Detalle?.split('|')[0] || '1 Terminal'}</span>
                                                                    {selectedOT.Equipos_Detalle?.split('|').slice(1).map((eq, i) => (
                                                                        <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-150 rounded text-[9px] font-bold text-slate-500 uppercase">{eq}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            
                                                            <div>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Adicionales Puntuados</span>
                                                                <div className="flex gap-2">
                                                                    {parseInt(selectedOT.Decos_Adicionales || 0) > 0 ? (
                                                                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-[10px] font-black uppercase">{selectedOT.Decos_Adicionales} Decos (+{selectedOT.Pts_Deco_Adicional})</span>
                                                                    ) : null}
                                                                    {parseInt(selectedOT.Repetidores_WiFi || 0) > 0 ? (
                                                                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-black uppercase">{selectedOT.Repetidores_WiFi} WiFi (+{selectedOT.Pts_Repetidor_WiFi})</span>
                                                                    ) : null}
                                                                    {(!selectedOT.Decos_Adicionales && !selectedOT.Repetidores_WiFi) && (
                                                                        <span className="text-[10px] text-slate-400 font-bold italic">No se detectaron adicionales</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Estado de Apelación Existente */}
                                                {selectedOT.apelacion && (
                                                    <div className={`p-5 rounded-2xl border shadow-sm ${
                                                        selectedOT.apelacion.status === 'por_validar' ? 'bg-amber-50/50 border-amber-200' :
                                                        selectedOT.apelacion.status === 'aprobada' ? 'bg-emerald-50/50 border-emerald-200' :
                                                        'bg-rose-50/50 border-rose-200'
                                                    }`}>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Historial de Apelación</span>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                                                selectedOT.apelacion.status === 'por_validar' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                                selectedOT.apelacion.status === 'aprobada' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                'bg-rose-100 text-rose-700 border-rose-200'
                                                            }`}>
                                                                {selectedOT.apelacion.status === 'por_validar' && 'En Revisión'}
                                                                {selectedOT.apelacion.status === 'aprobada' && 'Aprobada'}
                                                                {selectedOT.apelacion.status === 'rechazada' && 'Rechazada'}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-700 space-y-2">
                                                            <div className="flex items-center gap-3">
                                                                {selectedOT.apelacion.equipos?.decos > 0 && <span className="font-bold bg-white px-2 py-1 rounded shadow-sm border border-slate-100">{selectedOT.apelacion.equipos.decos} Decos</span>}
                                                                {selectedOT.apelacion.equipos?.repetidores > 0 && <span className="font-bold bg-white px-2 py-1 rounded shadow-sm border border-slate-100">{selectedOT.apelacion.equipos.repetidores} Repetidores</span>}
                                                                {selectedOT.apelacion.codigoLpu && <span className="font-bold bg-white px-2 py-1 rounded shadow-sm border border-slate-100">Actividad: {selectedOT.apelacion.codigoLpu}</span>}
                                                            </div>
                                                            {selectedOT.apelacion.observacion && (
                                                                <p className="italic bg-white/60 p-3 rounded-lg border border-slate-100">"{selectedOT.apelacion.observacion}"</p>
                                                            )}
                                                            {selectedOT.apelacion.respuesta && (
                                                                <div className="mt-3 pt-3 border-t border-slate-200/50">
                                                                    <span className="font-black text-[9px] uppercase tracking-wider text-slate-500 block mb-1">Respuesta del Supervisor:</span>
                                                                    <p className="font-medium bg-white p-3 rounded-lg border border-slate-200">"{selectedOT.apelacion.respuesta}"</p>
                                                                    {selectedOT.apelacion.evidenciaSupervisorUrl && (
                                                                        <a href={selectedOT.apelacion.evidenciaSupervisorUrl} target="_blank" rel="noopener noreferrer" className="mt-2 text-[10px] font-bold text-indigo-700 hover:underline flex items-center gap-1 bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-200 w-fit">
                                                                            <ImageIcon size={14} className="text-indigo-500" /> Ver Respaldo del Supervisor
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Botón Acción Principal */}
                                                <div className="pt-2">
                                                    <button 
                                                        onClick={() => setIsAppealing(true)}
                                                        disabled={!!selectedOT.apelacion?.status}
                                                        className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg hover:bg-slate-700 active:bg-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
                                                    >
                                                        {selectedOT.apelacion?.status ? (
                                                            selectedOT.apelacion.status === 'por_validar' ? (
                                                                <>Solicitud en Proceso de Revisión <Clock size={16} /></>
                                                            ) : selectedOT.apelacion.status === 'aprobada' ? (
                                                                <>Apelación Procesada (Aprobada) <BadgeCheck size={16} /></>
                                                            ) : (
                                                                <>Apelación Procesada (Rechazada) <XCircle size={16} /></>
                                                            )
                                                        ) : (
                                                            <>¿Hubo un error en TOA? Generar Apelación <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button onClick={() => setIsAppealing(false)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors">
                                                        <ChevronLeft size={18} />
                                                    </button>
                                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Generar Apelación</h4>
                                                </div>

                                                <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-5">
                                                    
                                                    {/* Error en LPU */}
                                                    <div>
                                                        <div 
                                                            className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${appealForm.actividadIncorrecta ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                                                            onClick={() => setAppealForm({ ...appealForm, actividadIncorrecta: !appealForm.actividadIncorrecta })}
                                                        >
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${appealForm.actividadIncorrecta ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300'}`}>
                                                                {appealForm.actividadIncorrecta && <Check size={14} strokeWidth={4} />}
                                                            </div>
                                                            <div>
                                                                <span className={`text-[11px] font-black uppercase tracking-wider block ${appealForm.actividadIncorrecta ? 'text-indigo-800' : 'text-slate-600'}`}>Error de Actividad (LPU)</span>
                                                                <span className="text-[10px] text-slate-500 font-medium">Marcar si la actividad en TOA no corresponde a lo que realmente hiciste.</span>
                                                            </div>
                                                        </div>

                                                        {appealForm.actividadIncorrecta && (
                                                            <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Selecciona la Actividad LPU Real</label>
                                                                <select 
                                                                    value={appealForm.codigoLpu}
                                                                    onChange={e => setAppealForm({ ...appealForm, codigoLpu: e.target.value })}
                                                                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                                                >
                                                                    <option value="">Seleccione una actividad...</option>
                                                                    {tarifasLPU.map(t => (
                                                                        <option key={t.codigo} value={t.codigo}>[{t.codigo}] {t.descripcion} ({t.puntos} pts)</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Equipos Reales */}
                                                    <div className="pt-4 border-t border-slate-100">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Equipos Reales Instalados</label>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Decos (STB)</label>
                                                                <input 
                                                                    type="number"
                                                                    min="0"
                                                                    value={appealForm.decos}
                                                                    onChange={e => setAppealForm({ ...appealForm, decos: e.target.value })}
                                                                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-black text-lg text-slate-800 tabular-nums focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-center"
                                                                />
                                                            </div>
                                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Repetidores (WIFI)</label>
                                                                <input 
                                                                    type="number"
                                                                    min="0"
                                                                    value={appealForm.repetidores}
                                                                    onChange={e => setAppealForm({ ...appealForm, repetidores: e.target.value })}
                                                                    className="w-full bg-white border border-slate-200 p-2.5 rounded-lg font-black text-lg text-slate-800 tabular-nums focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-center"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Observaciones y Evidencia */}
                                                    <div className="pt-4 border-t border-slate-100 space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Justificación del Reclamo</label>
                                                            <textarea 
                                                                placeholder="Explica brevemente la diferencia entre lo registrado y lo realizado..."
                                                                value={appealForm.observacion}
                                                                onChange={e => setAppealForm({ ...appealForm, observacion: e.target.value })}
                                                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-xs text-slate-700 h-24 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                                                            />
                                                        </div>
                                                        
                                                        <div>
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                                <ImageIcon size={12} /> Respaldo / Captura TOA (Opcional)
                                                            </label>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                                <label className={`flex items-center justify-center gap-2 px-4 py-2.5 ${uploadingImage ? 'bg-slate-100 text-slate-400' : 'bg-slate-800 hover:bg-slate-700 text-white'} rounded-lg font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors shadow-sm`}>
                                                                    {uploadingImage ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
                                                                    {uploadingImage ? 'Subiendo...' : 'Adjuntar Imagen'}
                                                                    <input 
                                                                        type="file" 
                                                                        accept="image/*" 
                                                                        className="hidden" 
                                                                        onChange={handleImageUpload} 
                                                                        disabled={uploadingImage}
                                                                    />
                                                                </label>
                                                                {appealForm.evidenciaUrl && (
                                                                    <a href={appealForm.evidenciaUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-1 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                                                                        <CheckCircle2 size={14} className="text-emerald-500" /> Imagen Adjunta
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-4 pt-2">
                                                    <button 
                                                        onClick={() => setIsAppealing(false)} 
                                                        className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button 
                                                        onClick={handleSendAppeal}
                                                        disabled={submittingAppeal}
                                                        className="flex-[2] py-3.5 bg-emerald-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 hover:bg-emerald-500 active:bg-emerald-700 transition-all disabled:opacity-50"
                                                    >
                                                        {submittingAppeal ? <Loader2 className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
                                                        Enviar a Validación
                                                    </button>
                                                </div>
                                            </div>
                                        )}
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
    // VIEW: GARANTIAS
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'garantias') {
        const tecnicoFijo = tecnico?.idRecursoToa || tecnico?.idRecurso || tecnico?._id || user?.idRecurso || user?.id;
        
        return (
            <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    {renderHeader("Mis Garantías", ShieldAlert)}
                    {/* Month Selector */}
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
                    </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-100 p-8 rounded-[3rem] shadow-inner mb-8 text-center max-w-3xl mx-auto">
                   <p className="text-slate-500 font-medium text-sm italic">Aquí puedes revisar tu calidad y reingresos del mes seleccionado. Mantener un bajo nivel de fallas asegura un buen desempeño y bonificación.</p>
                </div>
                
                <GarantiasTab 
                    dateFrom={`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`} 
                    dateTo={`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(activeYear, selectedMonth + 1, 0).getDate()}`} 
                    selectedZonas={[]} 
                    selectedProyectos={[]} 
                    selectedCategorias={[]} 
                    selectedMonths={[`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}`]} 
                    tecnicoFijo={tecnicoFijo} 
                />
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: AGENDA
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'agenda') {
        const tecnicoFijo = tecnico?.idRecursoToa || tecnico?.idRecurso || tecnico?._id || user?.idRecurso || user?.id;
        
        return (
            <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
                    {renderHeader("Mi Agenda", Calendar)}
                    {/* Month Selector */}
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
                    </div>
                </div>
                
                <AgendaColaboradorTab 
                    dateFrom={`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`} 
                    dateTo={`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}-${new Date(activeYear, selectedMonth + 1, 0).getDate()}`} 
                    selectedMonths={[`${activeYear}-${String(selectedMonth + 1).padStart(2, '0')}`]} 
                    tecnicoFijo={tecnicoFijo} 
                />
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
        const handleSendObservation = async (e) => {
            e.preventDefault();
            if (!observationForm.comentario) return alert("Debes ingresar un comentario detallado.");
            setSubmittingObservation(true);
            try {
                const coords = await getLocation();
                const data = {
                    ...observationForm,
                    tecnicoRef: tecnico?._id,
                    productoRef: selectedItemObservation.productoRef?._id || selectedItemObservation.productoRef || selectedItemObservation._id,
                    geolocalizacion: coords
                };
                await logisticaApi.post('/observaciones-stock', data);
                alert("Alerta enviada correctamente. Su supervisor ha sido notificado.");
                setSelectedItemObservation(null);
                setObservationForm({ comentario: '', fotoUrl: '' });
                fetchData();
            } catch (err) {
                alert("Error al reportar alerta: " + (err.response?.data?.message || err.message));
            } finally {
                setSubmittingObservation(false);
            }
        };

        const handleCaptureObservation = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    try {
                        const optimized = await resizeImage(reader.result);
                        setObservationForm(prev => ({ ...prev, fotoUrl: optimized }));
                    } catch (err) {
                        console.error('Error optimizando foto:', err);
                        setObservationForm(prev => ({ ...prev, fotoUrl: reader.result }));
                    }
                };
                reader.readAsDataURL(file);
            }
        };

        const startAutoAudit = () => {
            setIsAutoAuditing(true);
            setEquipamientoFilter('');
            setAuditResponses({});
        };

        const handleAuditSelect = (item, status) => {
            if (status === 'Bueno') {
                setAuditResponses(prev => ({ ...prev, [item._id]: { estado: 'Bueno', productoRef: item.productoRef?._id || item.productoRef } }));
            } else {
                setAuditItemTarget(item);
                setAuditItemStatus(status);
                setObservationForm({ comentario: '', fotoUrl: '' });
            }
        };

        const handleSaveAuditItem = (e) => {
            e.preventDefault();
            if (auditItemStatus === 'Malo' && !observationForm.fotoUrl) {
                return alert("Para reportar un activo como Malo/Dañado debes adjuntar una fotografía de evidencia.");
            }
            if (!observationForm.comentario) {
                return alert("Debes ingresar un motivo detallado.");
            }

            setAuditResponses(prev => ({
                ...prev,
                [auditItemTarget._id]: {
                    estado: auditItemStatus,
                    comentario: observationForm.comentario,
                    fotoUrl: observationForm.fotoUrl,
                    productoRef: auditItemTarget.productoRef?._id || auditItemTarget.productoRef
                }
            }));
            
            setAuditItemTarget(null);
            setAuditItemStatus(null);
            setObservationForm({ comentario: '', fotoUrl: '' });
        };

        const finishAutoAudit = async () => {
            const items = Object.values(auditResponses);
            if (items.length === 0) {
                alert("No has auditado ningún ítem.");
                setIsAutoAuditing(false);
                return;
            }
            setShowSignatureModal(true);
        };

        const submitSignedAutoAudit = async (signatureBase64) => {
            setSubmittingAudit(true);
            try {
                const coords = await getLocation();
                const items = Object.values(auditResponses);
                
                await logisticaApi.post('/auto-auditoria-firmada', {
                    tecnicoId: tecnico?._id,
                    items,
                    firmaUrl: signatureBase64,
                    geolocalizacion: coords
                });
                
                alert("Auto-Auditoría firmada y enviada correctamente.");
                setIsAutoAuditing(false);
                setAuditResponses({});
                setShowSignatureModal(false);
                fetchData();
            } catch (err) {
                alert("Error al procesar auto-auditoría: " + (err.message));
            } finally {
                setSubmittingAudit(false);
            }
        };

        return (
            <div className="max-w-[1200px] mx-auto px-4 pt-4 animate-in slide-in-from-right duration-500 pb-20">
                {renderHeader("Mi Inventario & Auditorías", ClipboardList)}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista de Inventario */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Estatus de Stock Asignado</h4>
                            <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black">{miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).length} Ítems</span>
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Filtrar por nombre o categoría..."
                                    value={equipamientoFilter}
                                    onChange={e => setEquipamientoFilter(e.target.value)}
                                    disabled={isAutoAuditing}
                                    className="w-full bg-white border border-slate-100 rounded-[1.5rem] pl-12 pr-4 py-4 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all shadow-sm disabled:opacity-50"
                                />
                            </div>
                            {equipamientoFilter && !isAutoAuditing && (
                                <button onClick={() => setEquipamientoFilter('')} className="px-5 py-4 bg-slate-100 text-slate-500 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">
                                    <XCircle size={16} />
                                </button>
                            )}
                            {!isAutoAuditing && (
                                <button onClick={startAutoAudit} className="px-5 py-4 bg-indigo-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2">
                                    <ClipboardCheck size={16} /> <span className="hidden sm:inline">Auto-Auditarme</span>
                                </button>
                            )}
                            {isAutoAuditing && (
                                <button onClick={finishAutoAudit} disabled={submittingAudit} className="px-5 py-4 bg-emerald-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-emerald-200 transition-all flex items-center gap-2">
                                    {submittingAudit ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} 
                                    <span className="hidden sm:inline">Finalizar</span>
                                </button>
                            )}
                        </div>

                        {/* Categorías como Tarjetas / Pestañas */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
                            <div 
                                onClick={() => setSelectedCategoryTab('TODOS')}
                                className={`p-4 rounded-[2rem] border transition-all cursor-pointer flex flex-col justify-between min-h-[100px] group ${selectedCategoryTab === 'TODOS' ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-xl shadow-indigo-100 border-transparent' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className={`p-2.5 rounded-xl border transition-colors ${selectedCategoryTab === 'TODOS' ? 'bg-indigo-500/20 border-indigo-400/20 text-white' : 'bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                        <Package size={18} />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${selectedCategoryTab === 'TODOS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                        {miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).length}
                                    </span>
                                </div>
                                <div>
                                    <h4 className={`text-[11px] font-black uppercase tracking-wider ${selectedCategoryTab === 'TODOS' ? 'text-white' : 'text-slate-700'}`}>Todos</h4>
                                    <p className={`text-[8px] font-bold mt-0.5 ${selectedCategoryTab === 'TODOS' ? 'text-indigo-100' : 'text-slate-400'}`}>Ver todo el stock</p>
                                </div>
                            </div>

                            {Array.from(new Set(miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).map(item => item.productoRef?.categoria?.nombre || item.categoria || 'Otros'))).map(cat => {
                                const count = miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0 && (item.productoRef?.categoria?.nombre || item.categoria || 'Otros') === cat).length;
                                const isActive = selectedCategoryTab === cat;
                                
                                // Elegir ícono dinámicamente en base al nombre de la categoría
                                let IconComponent = Wrench;
                                const lowerCat = cat.toLowerCase();
                                if (lowerCat.includes('epp') || lowerCat.includes('seguridad') || lowerCat.includes('protección') || lowerCat.includes('casco') || lowerCat.includes('chaleco')) IconComponent = Shield;
                                else if (lowerCat.includes('equipo') || lowerCat.includes('tecnología') || lowerCat.includes('cámara') || lowerCat.includes('fusión') || lowerCat.includes('router') || lowerCat.includes('ont')) IconComponent = Cpu;
                                else if (lowerCat.includes('cable') || lowerCat.includes('fibra') || lowerCat.includes('insumo') || lowerCat.includes('conector') || lowerCat.includes('ferretería')) IconComponent = Layers;
                                else if (lowerCat.includes('herramienta') || lowerCat.includes('taladro') || lowerCat.includes('destornillador')) IconComponent = Hammer;
                                else if (lowerCat.includes('instrumento') || lowerCat.includes('medidor') || lowerCat.includes('tester') || lowerCat.includes('otdr') || lowerCat.includes('power')) IconComponent = Gauge;

                                return (
                                    <div 
                                        key={cat}
                                        onClick={() => setSelectedCategoryTab(cat)}
                                        className={`p-4 rounded-[2rem] border transition-all cursor-pointer flex flex-col justify-between min-h-[100px] group ${isActive ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-xl shadow-indigo-100 border-transparent' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className={`p-2.5 rounded-xl border transition-colors ${isActive ? 'bg-indigo-500/20 border-indigo-400/20 text-white' : 'bg-slate-50 text-slate-500 border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                <IconComponent size={18} />
                                            </div>
                                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                {count}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className={`text-[11px] font-black uppercase tracking-wider truncate ${isActive ? 'text-white' : 'text-slate-700'}`}>{cat}</h4>
                                            <p className={`text-[8px] font-bold mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>Equipos asignados</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid gap-4 mt-2">
                            {miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).filter(item => {
                                // Filtro por pestaña de categoría
                                if (selectedCategoryTab !== 'TODOS') {
                                    const cat = item.productoRef?.categoria?.nombre || item.categoria || 'Otros';
                                    if (cat !== selectedCategoryTab) return false;
                                }
                                // Filtro por búsqueda de texto
                                const nombre = item.productoRef?.nombre || item.nombre || '';
                                const cat = item.productoRef?.categoria?.nombre || item.categoria || '';
                                const search = equipamientoFilter.toLowerCase();
                                return nombre.toLowerCase().includes(search) || cat.toLowerCase().includes(search);
                            }).map((item, idx) => {
                                const qty = (item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0);
                                const prodIdStr = String(item.productoRef?._id || item.productoRef || item._id);
                                const activeObs = misObservacionesActivas.find(obs => String(obs.productoRef?._id || obs.productoRef) === prodIdStr);
                                const auditedResponse = auditResponses[item._id];

                                return (
                                    <div key={idx} 
                                         onClick={() => (!isAutoAuditing && !activeObs) ? setSelectedItemObservation(item) : null}
                                         className={`p-6 rounded-[2rem] border transition-all flex flex-col group gap-4 
                                         ${isAutoAuditing ? (auditedResponse ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200 shadow-inner') : (activeObs ? 'bg-rose-50 border-rose-500 animate-pulse shadow-sm cursor-not-allowed' : 'bg-white border-slate-100 hover:border-indigo-200 cursor-pointer shadow-sm hover:shadow-md')}`}>
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors flex-shrink-0 ${activeObs ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}>
                                                    {activeObs ? <AlertCircle size={28} /> : <Package size={28} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={`font-black uppercase italic leading-none ${activeObs ? 'text-rose-700' : 'text-slate-800'}`}>{item.productoRef?.nombre}</p>
                                                        {activeObs && <span className="text-[8px] px-2 py-0.5 bg-rose-600 text-white rounded-full uppercase font-black">Alerta Activa</span>}
                                                        {isAutoAuditing && auditedResponse && (
                                                            <span className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-black text-white ${auditedResponse.estado === 'Bueno' ? 'bg-emerald-500' : auditedResponse.estado === 'Malo' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                                                                {auditedResponse.estado}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">{item.productoRef?.sku} · {item.productoRef?.categoria?.nombre || 'Sin Categoría'}</p>
                                                    
                                                    {tecnico?.fechaIngreso && (
                                                        <div className="mt-2 flex items-center gap-1.5">
                                                            <CalendarClock size={12} className={activeObs ? "text-rose-400" : "text-slate-400"} />
                                                            <span className={`text-[8px] font-black uppercase tracking-widest ${activeObs ? 'text-rose-500' : 'text-slate-500'}`}>
                                                                Asignación Inicial: {new Date(tecnico.fechaIngreso).toLocaleDateString('es-CL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {!isAutoAuditing ? (
                                                <div className="text-right sm:ml-auto">
                                                    <p className={`text-[9px] font-black uppercase italic mb-1 ${activeObs ? 'text-rose-400' : 'text-slate-400'}`}>CANTIDAD</p>
                                                    <p className={`text-2xl font-black ${activeObs ? 'text-rose-700' : 'text-slate-800'}`}>{qty > 0 ? qty : 1}</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2 sm:justify-end sm:ml-auto mt-2 sm:mt-0 w-full sm:w-auto">
                                                    <button onClick={(e) => { e.stopPropagation(); handleAuditSelect(item, 'Bueno'); }}
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditedResponse?.estado === 'Bueno' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        Bueno
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleAuditSelect(item, 'Malo'); }}
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditedResponse?.estado === 'Malo' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        Malo
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleAuditSelect(item, 'No Tengo'); }}
                                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${auditedResponse?.estado === 'No Tengo' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                                        No Tengo
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Columnas Técnicas: Marca, Modelo, Nº Serie, IMEI */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 pt-4 border-t border-slate-100/80">
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Marca</p>
                                                <p className="text-[11px] font-black text-slate-700 uppercase truncate italic">
                                                    {item.productoRef?.marca || 'Genérica'}
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Modelo</p>
                                                <p className="text-[11px] font-black text-slate-700 uppercase truncate italic">
                                                    {item.productoRef?.modelo || '—'}
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nº Serie</p>
                                                <p className="text-[11px] font-black text-slate-700 uppercase truncate italic">
                                                    {item.productoRef?.nroSerie || '—'}
                                                </p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Propiedad</p>
                                                <p className="text-[11px] font-black text-slate-700 uppercase truncate italic">
                                                    {item.productoRef?.propiedad || 'Propio'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).length === 0 && (
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

                {/* Modal Auto-Auditoría (Malo / No Tengo) */}
                {auditItemTarget && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100">
                            <div className={`p-8 border-b border-slate-100 flex justify-between items-center ${auditItemStatus === 'Malo' ? 'bg-amber-50' : 'bg-rose-50'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${auditItemStatus === 'Malo' ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className={`text-xl font-black uppercase italic leading-none ${auditItemStatus === 'Malo' ? 'text-amber-800' : 'text-rose-800'}`}>
                                            Reportar como {auditItemStatus}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Activo: {auditItemTarget.productoRef?.nombre || auditItemTarget.nombre}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setAuditItemTarget(null); setAuditItemStatus(null); }} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200">
                                    <XCircle size={28} />
                                </button>
                            </div>

                            {auditItemStatus === 'No Tengo' && (
                                <div className="px-8 pt-6 pb-2">
                                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3">
                                        <AlertCircle size={20} className="text-rose-500 flex-shrink-0" />
                                        <p className="text-[10px] font-bold text-rose-800 uppercase leading-relaxed">
                                            Su registro será derivado a supervisión y logística para validar y reponer. 
                                            <span className="block mt-1 font-black text-rose-600">Considerar que si es pérdida por descuido esto puede generarte cobro para la reposición.</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSaveAuditItem} className="p-8 pt-4 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Motivo / Justificación</label>
                                    <textarea 
                                        required
                                        placeholder={auditItemStatus === 'Malo' ? "Describe el daño o problema que presenta..." : "Indica cuándo o cómo perdiste el activo..."}
                                        value={observationForm.comentario}
                                        onChange={e => setObservationForm({ ...observationForm, comentario: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[2rem] font-bold text-sm h-32 resize-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Evidencia Fotográfica {auditItemStatus === 'Malo' ? '(Obligatoria)' : '(Opcional)'}</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden relative group bg-slate-50/50 flex flex-col items-center justify-center min-h-[160px]">
                                        {observationForm.fotoUrl ? (
                                            <>
                                                <img src={observationForm.fotoUrl} alt="Evidencia" className="w-full h-full object-cover absolute inset-0" />
                                                <button
                                                    type="button"
                                                    onClick={() => setObservationForm({ ...observationForm, fotoUrl: '' })}
                                                    className="absolute top-4 right-4 p-3 bg-rose-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <XCircle size={20} />
                                                </button>
                                            </>
                                        ) : (
                                            <label className="cursor-pointer flex flex-col items-center gap-3 hover:scale-105 transition-all p-8 w-full h-full justify-center">
                                                <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-500 border border-indigo-50">
                                                    <Search size={24} />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Toca para capturar<br/>foto del activo</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={handleCaptureObservation}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => { setAuditItemTarget(null); setAuditItemStatus(null); }} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all"
                                    >
                                        <CheckCircle2 size={20} /> Confirmar Estado
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal de Reporte de Observación Normal */}
                {selectedItemObservation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none">Reportar Alerta</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Activo: {selectedItemObservation.productoRef?.nombre || selectedItemObservation.nombre}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedItemObservation(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200">
                                    <XCircle size={28} />
                                </button>
                            </div>

                            <form onSubmit={handleSendObservation} className="p-8 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Detalle de la Observación / Problema</label>
                                    <textarea 
                                        required
                                        placeholder="Ej: El taladro presenta fallas en la batería o la gata hidráulica está perdiendo aceite..."
                                        value={observationForm.comentario}
                                        onChange={e => setObservationForm({ ...observationForm, comentario: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[2rem] font-bold text-sm h-32 resize-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Evidencia Fotográfica (Opcional)</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden relative group bg-slate-50/50 flex flex-col items-center justify-center min-h-[160px]">
                                        {observationForm.fotoUrl ? (
                                            <>
                                                <img src={observationForm.fotoUrl} alt="Evidencia" className="w-full h-full object-cover absolute inset-0" />
                                                <button
                                                    type="button"
                                                    onClick={() => setObservationForm({ ...observationForm, fotoUrl: '' })}
                                                    className="absolute top-4 right-4 p-3 bg-rose-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <XCircle size={20} />
                                                </button>
                                            </>
                                        ) : (
                                            <label className="cursor-pointer flex flex-col items-center gap-3 hover:scale-105 transition-all p-8 w-full h-full justify-center">
                                                <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-500 border border-indigo-50">
                                                    <Search size={24} />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Toca para capturar<br/>foto del activo</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={handleCaptureObservation}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setSelectedItemObservation(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={submittingObservation}
                                        className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {submittingObservation ? <Loader2 className="animate-spin" size={20} /> : <AlertCircle size={20} />}
                                        Reportar al Supervisor
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showSignatureModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-slate-50 w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="text-center mb-4 shrink-0">
                                <div className="mx-auto w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                    <ShieldCheck size={32} />
                                </div>
                                <h3 className="text-lg font-black text-slate-800 tracking-tight">Firma de Auto-Auditoría</h3>
                                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">{tecnico?.nombres} {tecnico?.apellidos} - {tecnico?.rut}</p>
                            </div>

                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 overflow-y-auto flex-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center border-b pb-2">Resumen de Ítems Auditados</h4>
                                <ul className="space-y-3">
                                    {Object.entries(auditResponses).map(([id, data]) => {
                                        const item = miInventario.find(i => (i.productoRef?._id || i.productoRef) === id);
                                        return (
                                            <li key={id} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                                                <span className="font-bold text-slate-700 truncate mr-2" title={item?.productoRef?.nombre || 'Ítem'}>{item?.productoRef?.nombre || 'Ítem'}</span>
                                                <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${data.estado === 'Bueno' ? 'bg-emerald-100 text-emerald-700' : data.estado === 'Malo' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                                                    {data.estado}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="text-[9px] font-bold text-slate-400 mt-4 text-center italic border-t pt-2">Se adjuntará su geolocalización actual como evidencia forense.</p>
                            </div>

                            <div className="shrink-0">
                                {submittingAudit ? (
                                    <div className="py-12 flex flex-col items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                                        <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Procesando firma y GPS...</p>
                                    </div>
                                ) : (
                                    <SignaturePad 
                                        onSave={submitSignedAutoAudit} 
                                        onCancel={() => setShowSignatureModal(false)}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const resizeImage = (base64Str, maxWidth = 1200, maxHeight = 1200) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
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

                const coords = await getLocation();
                const data = {
                    ...fuelForm,
                    rut: user.rut,
                    nombre: user.name,
                    geolocalizacion: coords
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
                reader.onloadend = async () => {
                    try {
                        const optimized = await resizeImage(reader.result);
                        setFuelForm(prev => ({ ...prev, fotoTacometro: optimized }));
                    } catch (err) {
                        console.error('Error optimizando foto:', err);
                        setFuelForm(prev => ({ ...prev, fotoTacometro: reader.result }));
                    }
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
                                            capture="environment"
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
    // VIEW: NOTIFICACIONES
    // ──────────────────────────────────────────────────────────────────────────
    {activeView === 'notificaciones' && <NotificacionesTramites user={user} onBack={() => setActiveView('main')} perfil={perfil} />}

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
                                { label: 'ID TOA', value: tecnico?.idRecursoToa || tecnico?.idRecurso || '—', icon: Fingerprint },
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
                                    { label: 'Tipo Contrato', value: perfil?.contractType || perfil?.hiring?.contractType || '—' },
                                    { label: 'Fecha Ingreso', value: (perfil?.contractStartDate || perfil?.hiring?.contractStartDate) ? new Date(perfil.contractStartDate || perfil.hiring.contractStartDate).toLocaleDateString('es-CL') : '—' },
                                    { label: 'AFP', value: perfil?.afp || '—' },
                                    { label: 'Isapre / Fonasa', value: perfil?.previsionSalud ? `${perfil.previsionSalud} ${perfil.isapreNombre ? `(${perfil.isapreNombre})` : ''}` : '—' },
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
    // VIEW: HISTORIAL AUDITORIAS
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'historial-auditorias') {
        return (
            <div className="animate-fade-in p-6 max-w-7xl mx-auto">
                <button
                    onClick={() => setActiveView('main')}
                    className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
                >
                    <ChevronLeft className="w-5 h-5" />
                    Volver al Panel Principal
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <Archive className="w-8 h-8 text-teal-600" />
                        Historial General del Colaborador
                    </h2>
                    <p className="text-slate-500 mt-2 text-lg">Revisa tus auto-auditorías firmadas con geolocalización.</p>
                </div>

                {historialAuditorias.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <Archive className="w-20 h-20 text-slate-300 mb-6" />
                        <h3 className="text-2xl font-bold text-slate-700 mb-2">Sin Historial</h3>
                        <p className="text-slate-500 text-lg">Aún no has firmado ninguna auto-auditoría.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {historialAuditorias.map((audit) => (
                            <div key={audit._id} className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                            <span className="text-sm font-bold text-slate-700">Completada</span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400">
                                            {new Date(audit.fecha).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 mb-4">
                                        <strong>Auditoría ID:</strong> {audit._id.slice(-6).toUpperCase()}
                                    </p>
                                    <div className="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-500 font-mono">
                                        <MapPin className="w-3 h-3 inline-block mr-1 text-teal-600" />
                                        Lat: {audit.geolocalizacion?.lat}, Lng: {audit.geolocalizacion?.lng}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 mb-2">Firma del Colaborador:</p>
                                    <div className="bg-white border-2 border-slate-100 rounded-xl p-2 flex justify-center items-center h-24">
                                        {audit.firmaDataUrl ? (
                                            <img src={audit.firmaDataUrl} alt="Firma" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <span className="text-xs text-slate-400">Firma no disponible</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // VIEW: MIS ACTIVOS / EQUIPAMIENTO
    // ──────────────────────────────────────────────────────────────────────────
    if (activeView === 'equipamiento') {
        const handleSendObservation = async (e) => {
            e.preventDefault();
            if (!observationForm.comentario) return alert("Debes ingresar un comentario detallado.");
            setSubmittingObservation(true);
            try {
                const coords = await getLocation();
                const data = {
                    ...observationForm,
                    tecnicoRef: tecnico?._id,
                    productoRef: selectedItemObservation.productoRef?._id || selectedItemObservation.productoRef || selectedItemObservation._id,
                    geolocalizacion: coords
                };
                await logisticaApi.post('/observaciones-stock', data);
                alert("Alerta enviada correctamente. Su supervisor ha sido notificado.");
                setSelectedItemObservation(null);
                setObservationForm({ comentario: '', fotoUrl: '' });
                fetchData();
            } catch (err) {
                alert("Error al reportar alerta: " + (err.response?.data?.message || err.message));
            } finally {
                setSubmittingObservation(false);
            }
        };

        const handleCaptureObservation = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = async () => {
                    try {
                        const optimized = await resizeImage(reader.result);
                        setObservationForm(prev => ({ ...prev, fotoUrl: optimized }));
                    } catch (err) {
                        console.error('Error optimizando foto:', err);
                        setObservationForm(prev => ({ ...prev, fotoUrl: reader.result }));
                    }
                };
                reader.readAsDataURL(file);
            }
        };

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
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-xl"><Package size={18} className="text-slate-600" /></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Equipamiento & Herramientas</h3>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar equipo o herramienta..."
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
                                        value={equipamientoFilter}
                                        onChange={(e) => setEquipamientoFilter(e.target.value)}
                                    />
                                </div>
                                <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-2 rounded-xl whitespace-nowrap">{miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).length} items</span>
                            </div>
                        </div>
                        {miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Package size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="text-xs font-black uppercase tracking-widest italic">Sin inventario asignado</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {miInventario.filter(item => ((item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0)) > 0).filter(item => {
                                    const nombre = item.productoRef?.nombre || item.nombre || '';
                                    const cat = item.productoRef?.categoria?.nombre || item.categoria || '';
                                    const search = equipamientoFilter.toLowerCase();
                                    return nombre.toLowerCase().includes(search) || cat.toLowerCase().includes(search);
                                }).map((item, i) => {
                                    const qty = (item.cantidadNuevo || 0) + (item.cantidadUsadoBueno || 0);
                                    const name = item.productoRef?.nombre || item.nombre || 'Herramienta / Equipo';
                                    const category = item.productoRef?.categoria?.nombre || item.categoria || 'General';
                                    const prodIdStr = String(item.productoRef?._id || item.productoRef || item._id);
                                    const activeObs = misObservacionesActivas.find(obs => String(obs.productoRef?._id || obs.productoRef) === prodIdStr);

                                    return (
                                        <div key={i} 
                                             onClick={() => !activeObs && setSelectedItemObservation(item)}
                                             className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${activeObs ? 'bg-rose-50 border-rose-500 animate-pulse shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-indigo-200 cursor-pointer hover:shadow-md'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl border shadow-sm ${activeObs ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-white border-slate-100 text-slate-500'}`}>
                                                    {activeObs ? <AlertCircle size={18} /> : <Package size={18} />}
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-black uppercase ${activeObs ? 'text-rose-700' : 'text-slate-800'}`}>{name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg border ${activeObs ? 'bg-rose-200/50 border-rose-200 text-rose-600' : 'bg-slate-200/50 border-slate-200 text-slate-500'}`}>{category}</span>
                                                        {item.serial && <span className={`text-[9px] font-bold uppercase tracking-widest border px-2 py-0.5 rounded-lg ${activeObs ? 'bg-rose-100 border-rose-200 text-rose-600' : 'border-slate-200 text-slate-400 bg-white'}`}>S/N: {item.serial}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right hidden sm:block">
                                                    <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${activeObs ? 'text-rose-400' : 'text-slate-400'}`}>CANTIDAD</p>
                                                    <p className={`text-sm font-black tabular-nums ${activeObs ? 'text-rose-700' : 'text-slate-800'}`}>{qty > 0 ? qty : 1}</p>
                                                </div>
                                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase shadow-sm whitespace-nowrap border ${activeObs ? 'bg-rose-600 text-white border-rose-500' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                    {activeObs ? 'Alerta Activa' : (item.estado || 'Asignado')}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
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

                {/* Modal de Reporte de Observación */}
                {selectedItemObservation && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none">Reportar Alerta</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Activo: {selectedItemObservation.productoRef?.nombre || selectedItemObservation.nombre}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedItemObservation(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm border border-transparent hover:border-slate-200">
                                    <XCircle size={28} />
                                </button>
                            </div>

                            <form onSubmit={handleSendObservation} className="p-8 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Detalle de la Observación / Problema</label>
                                    <textarea 
                                        required
                                        placeholder="Ej: El taladro presenta fallas en la batería o la gata hidráulica está perdiendo aceite..."
                                        value={observationForm.comentario}
                                        onChange={e => setObservationForm({ ...observationForm, comentario: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-100 p-6 rounded-[2rem] font-bold text-sm h-32 resize-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 transition-all focus:outline-none"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 italic">Evidencia Fotográfica (Opcional)</label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-[2rem] overflow-hidden relative group bg-slate-50/50 flex flex-col items-center justify-center min-h-[160px]">
                                        {observationForm.fotoUrl ? (
                                            <>
                                                <img src={observationForm.fotoUrl} alt="Evidencia" className="w-full h-full object-cover absolute inset-0" />
                                                <button
                                                    type="button"
                                                    onClick={() => setObservationForm({ ...observationForm, fotoUrl: '' })}
                                                    className="absolute top-4 right-4 p-3 bg-rose-600 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <XCircle size={20} />
                                                </button>
                                            </>
                                        ) : (
                                            <label className="cursor-pointer flex flex-col items-center gap-3 hover:scale-105 transition-all p-8 w-full h-full justify-center">
                                                <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-500 border border-indigo-50">
                                                    <Search size={24} />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Toca para capturar<br/>foto del activo</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    className="hidden"
                                                    onChange={handleCaptureObservation}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setSelectedItemObservation(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={submittingObservation}
                                        className="flex-[2] py-5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {submittingObservation ? <Loader2 className="animate-spin" size={20} /> : <AlertCircle size={20} />}
                                        Reportar al Supervisor
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return null; // Fallback
};

export default PortalColaborador;
