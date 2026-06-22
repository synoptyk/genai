import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api/api';
import { useAuth } from '../../auth/AuthContext';
import CheckListVehicular from '../components/CheckListVehicular';
import PrevInspecciones from '../../prevencion/pages/PrevInspecciones';
import {
    Users, CalendarCheck, Truck, MapPin,
    ShieldCheck, Loader2, ArrowLeft,
    CheckCircle2, AlertTriangle, AlertCircle, X,
    ArrowRight, ClipboardCheck, MessageSquare, Clock, User,
    Fuel, Check, XOctagon, Info, Package, Eye, Car, Phone, Mail, FileText,
    MapPinned, Briefcase, Award, CalendarDays, PlusCircle, TrendingUp, Target, Trophy, PieChart as PieIcon,
    Shirt, BarChart3, Save, Search, AlertOctagon, Wrench, UserPlus,
    CheckSquare, ClipboardList // Added icons for Asistencia Operativa
} from 'lucide-react';
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
    BarChart, Bar, Cell, PieChart, Pie, Legend 
} from 'recharts';
import GestorTurnosOperaciones from '../components/GestorTurnosOperaciones';
import { formatRut, validateRut } from '../../../utils/rutUtils';
import { useCheckPermission } from '../../../hooks/useCheckPermission';
import DynamicAuditModal from '../../logistica/components/DynamicAuditModal';
import DashboardSupervisor from '../components/DashboardSupervisor';
import AsistenciaOperativa from '../components/AsistenciaOperativa';
import { asistenciaApi } from '../../rrhh/rrhhApi'; // Added Asistencia API import

// Modales Flota (Alineación con Mi Flotilla)
import SlideOverFicha from '../../agentetelecom/Flota/Panels/SlideOverFicha';
import SlideOverChecklist from '../../agentetelecom/Flota/Panels/SlideOverChecklist';
import SlideOverSiniestros from '../../agentetelecom/Flota/Panels/SlideOverSiniestros';
import SlideOverHistorial from '../../agentetelecom/Flota/Panels/SlideOverHistorial';
import SlideOverDocumentoPdf from '../../agentetelecom/Flota/Panels/SlideOverDocumentoPdf';

const normalizeRut = (v) => String(v || '').replace(/[^0-9kK]/g, '').toUpperCase().trim();

const PortalSupervision = () => {
    const { user } = useAuth();
    const { hasPermission } = useCheckPermission();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('menu'); // menu, resumen, dotacion, flotilla, inspecciones, ast, solicitudes, produccion

    // Data states
    const [miEquipo, setMiEquipo] = useState([]);
    const [flota, setFlota] = useState([]);
    const [asts, setAsts] = useState([]);
    const [produccion, setProduccion] = useState([]);
    const [solicitudes, setSolicitudes] = useState([]);
    const [historialChecklists, setHistorialChecklists] = useState([]);
    const [fuelRequests, setFuelRequests] = useState([]);

    // UI states
    const [rutInput, setRutInput] = useState('');
    const [idToaInput, setIdToaInput] = useState('');
    const [showChecklist, setShowChecklist] = useState(false);
    const [selectedVehiculo, setSelectedVehiculo] = useState(null);
    const [selectedTecnico, setSelectedTecnico] = useState(null);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [auditTecnico, setAuditTecnico] = useState(null);

    // Ficha completa states
    const [showFicha, setShowFicha] = useState(false);
    const [fichaData, setFichaData] = useState(null);
    const [fichaLoading, setFichaLoading] = useState(false);

    // Asignar vehículo states
    const [showAsignarVehiculo, setShowAsignarVehiculo] = useState(false);
    const [vehiculosDisponibles, setVehiculosDisponibles] = useState([]);
    const [tecnicoParaAsignar, setTecnicoParaAsignar] = useState(null);
    const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
    const [asignandoVehiculo, setAsignandoVehiculo] = useState(false);

    // Nuevos estados para Flota (Alineación)
    const [searchQueryFlota, setSearchQueryFlota] = useState('');
    const [filterCardFlota, setFilterCardFlota] = useState(null);
    const [activePanelFlota, setActivePanelFlota] = useState(null);
    const [checklistTipo, setChecklistTipo] = useState('Asignación');
    const [selectedDocumento, setSelectedDocumento] = useState(null);
    const [tecnicosGlobal, setTecnicosGlobal] = useState([]); // Para pasar a los modales

    // Estados para Asistencia Operativa
    const [asistenciaFecha, setAsistenciaFecha] = useState(new Date().toISOString().split('T')[0]);

    // Estados para Modales Custom y Notificaciones
    const [notification, setNotification] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);
    const [promptModal, setPromptModal] = useState(null);

    const showToast = (message, type = 'success', duration = 4000) => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification(prev => prev && prev.message === message ? null : prev);
        }, duration);
    };


    const fetchData = async () => {
        if (!user?._id && !user?.id) return;
        const userId = user._id || user.id;
        try {
            const today = new Date().toISOString().split('T')[0];
            const [resEquipo, resFlota, resAst, resProd, resSolicitudes, resChecklists, resAllTecnicos] = await Promise.all([
                api.get(`/api/tecnicos/supervisor/${userId}`),
                api.get(`/api/vehiculos`),
                api.get(`/api/prevencion/ast`).catch(() => ({ data: [] })),
                api.get(`/api/produccion?supervisorId=${userId}`).catch(() => ({ data: [] })),
                api.get(`/api/rrhh/candidatos?status=Contratado`).catch(() => ({ data: [] })),
                api.get(`/api/vehiculos/checklists/recientes`).catch(() => ({ data: [] })),
                api.get(`/api/tecnicos/responsables-flota`).catch(() => ({ data: [] }))
            ]);


            setMiEquipo(resEquipo.data || []);
            setFlota(resFlota.data || []);
            setAsts(resAst.data || []);
            setProduccion(resProd.data || []);
            setHistorialChecklists(resChecklists?.data || []);
            setTecnicosGlobal(resAllTecnicos?.data || []);

            // Cargar solicitudes de combustible
            const resFuel = await api.get(`/api/operaciones/combustible/supervisor/${userId}`).catch(() => ({ data: [] }));
            setFuelRequests(resFuel.data || []);

            // Filtrar solicitudes solo de mi equipo
            const rutsEquipo = (resEquipo.data || []).map(t => t.rut);
            const todasSolicitudes = (resSolicitudes.data || []).flatMap(c =>
                (c.vacaciones || []).map(v => ({ ...v, techName: c.fullName, techRut: c.rut, candId: c._id }))
            );
            setSolicitudes(todasSolicitudes.filter(s => rutsEquipo.includes(s.techRut)));

        } catch (error) {
            console.error("Error cargando datos del portal:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleClaim = async () => {
        if (!rutInput) {
            showToast('Debes ingresar un RUT', 'error');
            return;
        }
        if (!validateRut(rutInput)) {
            showToast('El RUT no es válido', 'error');
            return;
        }
        try {
            await api.post('/api/tecnicos/claim', {
                rut: rutInput,
                idRecursoToa: idToaInput,
                supervisorId: user._id || user.id
            });
            setRutInput('');
            setIdToaInput('');
            fetchData();
            showToast('Técnico vinculado correctamente a tu equipo', 'success');
        } catch (error) {
            showToast(error.response?.data?.error || 'Error al vincular técnico', 'error');
        }
    };

    const handleUpdateIdToa = async (tecnicoId, newId) => {
        try {
            await api.put(`/api/tecnicos/${tecnicoId}/id-toa`, { idRecursoToa: newId });
            fetchData();
            showToast('ID TOA actualizado correctamente', 'success');
        } catch (error) {
            showToast('Error al actualizar ID TOA', 'error');
        }
    };

    const handleUnclaim = async (id) => {
        setConfirmModal({
            title: 'Desvincular Técnico',
            message: '¿Estás seguro de que deseas desvincular a este técnico de tu equipo?',
            onConfirm: async () => {
                try {
                    await api.post('/api/tecnicos/unclaim', { id });
                    fetchData();
                    showToast('Técnico desvinculado de tu equipo', 'success');
                } catch (error) {
                    showToast('Error al desvincular técnico', 'error');
                }
            }
        });
    };

    const handleCommentSolicitud = async (candId, vacId, comment) => {
        try {
            await api.put(`/api/rrhh/candidatos/${candId}/vacaciones/${vacId}`, {
                supervisorComment: comment
            });
            showToast('Comentario guardado correctamente', 'success');
            fetchData();
        } catch (error) {
            console.error("Error al guardar comentario:", error);
            showToast('Error al guardar comentario', 'error');
        }
    };

    const handleApproveVacation = async (candId, vacId, currentApprovalChain) => {
        try {
            const nextChain = (currentApprovalChain || []).map(step =>
                step.role === user.role ? { ...step, status: 'Aprobado', approvedBy: user.name, date: new Date() } : step
            );
            const allApproved = nextChain.length > 0 && nextChain.every(step => step.status === 'Aprobado');

            await api.put(`/api/rrhh/candidatos/${candId}/vacaciones/${vacId}`, {
                estado: allApproved ? 'Aprobado' : 'Pendiente',
                aprobadoPor: user.name,
                approvalChain: nextChain,
                validationRequested: !allApproved
            });
            showToast(allApproved ? 'Vacaciones aprobadas' : 'Aprobación registrada y escalada a la siguiente jefatura/gerencia', 'success');
            fetchData(); // Refresh data to reflect the change
        } catch (error) {
            console.error("Error al aprobar vacaciones:", error);
            showToast('Error al aprobar vacaciones', 'error');
        }
    };

    const handleRejectVacation = async (candId, vacId, currentApprovalChain) => {
        try {
            const nextChain = (currentApprovalChain || []).map(step =>
                step.role === user.role ? { ...step, status: 'Rechazado', approvedBy: user.name, date: new Date() } : step
            );

            await api.put(`/api/rrhh/candidatos/${candId}/vacaciones/${vacId}`, {
                estado: 'Rechazado',
                aprobadoPor: user.name,
                approvalChain: nextChain,
                validationRequested: false
            });
            showToast('Vacaciones rechazadas', 'success');
            fetchData();
        } catch (error) {
            console.error("Error al rechazar vacaciones:", error);
            showToast('Error al rechazar vacaciones', 'error');
        }
    };

    const handleOpenFicha = async (tecnicoId) => {
        setFichaLoading(true);
        setShowFicha(true);
        setFichaData(null);
        try {
            const res = await api.get(`/api/tecnicos/${tecnicoId}/ficha`);
            setFichaData(res.data);
        } catch (err) {
            showToast('Error cargando ficha del trabajador', 'error');
            setShowFicha(false);
        } finally {
            setFichaLoading(false);
        }
    };

    const handleAbrirAsignarVehiculo = async (tecnico) => {
        setTecnicoParaAsignar(tecnico);
        setVehiculoSeleccionado(null);
        try {
            const res = await api.get('/api/vehiculos/disponibles');
            setVehiculosDisponibles(res.data || []);
        } catch (err) {
            setVehiculosDisponibles([]);
        }
        setShowAsignarVehiculo(true);
    };

    const handleConfirmarAsignacion = async () => {
        if (!vehiculoSeleccionado || !tecnicoParaAsignar) return;
        setAsignandoVehiculo(true);
        try {
            await api.put(`/api/vehiculos/${vehiculoSeleccionado._id}/asignar`, {
                tecnicoId: tecnicoParaAsignar._id
            });
            setShowAsignarVehiculo(false);
            fetchData();
            showToast(`Vehículo ${vehiculoSeleccionado.patente} asignado correctamente`, 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Error al asignar vehículo', 'error');
        } finally {
            setAsignandoVehiculo(false);
        }
    };

    // Helper para formatear: Primer Nombre y Primer Apellido
    const formatNombreApellido = (tec, rawName) => {
        if (tec && tec.nombres && tec.apellidos) {
            return `${tec.nombres.split(' ')[0]} ${tec.apellidos.split(' ')[0]}`;
        }
        const targetStr = tec?.nombre || rawName;
        if (!targetStr || targetStr === '—') return '—';

        const parts = targetStr.trim().split(/\s+/);
        if (parts.length >= 4) return `${parts[0]} ${parts[2]}`; // Nombre1 Nombre2 Apellido1 Apellido2
        if (parts.length === 3) return `${parts[0]} ${parts[2]}`; // Nombre1 Nombre2 Apellido1 -> Nombre1 Apellido1
        if (parts.length === 2) return `${parts[0]} ${parts[1]}`; // Nombre1 Apellido1
        return targetStr;
    };

    // Helpers y Lógica de Flotilla
    const closePanelFlota = () => {
        setActivePanelFlota(null);
        setSelectedVehiculo(null);
        setSelectedDocumento(null);
    };

    const handleSuccessFlota = (documentoGenerado = null) => {
        fetchData();
        if (documentoGenerado) {
            setSelectedDocumento(documentoGenerado);
            setActivePanelFlota('documento');
        } else {
            closePanelFlota();
        }
    };

    const rutEquipoFlota = new Set(miEquipo.map(t => normalizeRut(t.rut)).filter(Boolean));
    const miFlotaAsignada = flota.filter(v => v.asignadoA && rutEquipoFlota.has(normalizeRut(v.asignadoA.rut)));
    const vehiculosDisponiblesFlota = flota.filter(v => !v.asignadoA);
    const flotaMostrar = [...miFlotaAsignada, ...vehiculosDisponiblesFlota];

    const kpisFlota = {
        total: flotaMostrar.length,
        operativos: flotaMostrar.filter(v => v.estadoOperativo === 'Operativa').length,
        siniestros: flotaMostrar.filter(v => v.estadoOperativo === 'Siniestro').length,
        mantencion: flotaMostrar.filter(v => v.estadoOperativo === 'Mantencion').length,
        enTerreno: flotaMostrar.filter(v => v.estadoLogistico === 'En Terreno').length,
        enPatio: flotaMostrar.filter(v => v.estadoLogistico === 'En Patio').length
    };

    const filteredVehiculosFlota = flotaMostrar.filter(v => {
        if (filterCardFlota) {
            if (filterCardFlota === 'Operativos' && v.estadoOperativo !== 'Operativa') return false;
            if (filterCardFlota === 'Siniestros' && v.estadoOperativo !== 'Siniestro') return false;
            if (filterCardFlota === 'Mantencion' && v.estadoOperativo !== 'Mantencion') return false;
            if (filterCardFlota === 'En Terreno' && v.estadoLogistico !== 'En Terreno') return false;
            if (filterCardFlota === 'En Patio' && v.estadoLogistico !== 'En Patio') return false;
        }
        if (searchQueryFlota) {
            const q = searchQueryFlota.toLowerCase();
            const match = v.patente?.toLowerCase().includes(q) ||
                v.marca?.toLowerCase().includes(q) ||
                v.modelo?.toLowerCase().includes(q) ||
                v.asignadoA?.nombre?.toLowerCase().includes(q) ||
                v.asignadoA?.rut?.toLowerCase().includes(q);
            if (!match) return false;
        }
        return true;
    });

    const getOpColor = (status) => {
        if (status === 'Operativa') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (status === 'Siniestro') return 'bg-red-100 text-red-700 border-red-200';
        if (status === 'Mantencion') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getLogColor = (status) => {
        if (status === 'En Terreno') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (status === 'En Patio') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (status === 'Taller') return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (currentView === 'inspecciones') {
        const rutsPermitidos = miEquipo.map(t => normalizeRut(t.rut)).filter(Boolean);
        return (
            <div className="animate-in fade-in duration-500">
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => setCurrentView('menu')}
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-black text-slate-800 uppercase italic">Módulo de Inspecciones</h2>
                </div>
                <div className="mb-5 bg-white border border-slate-100 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Personal Vinculado al Supervisor</p>
                    <div className="flex flex-wrap gap-2">
                        {miEquipo.map(tec => (
                            <span key={tec._id} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-[10px] font-black uppercase">
                                {(tec.nombres && tec.apellidos) ? `${tec.nombres} ${tec.apellidos}` : (tec.nombre || 'Sin nombre')} · {formatRut(tec.rut || '') || 'Sin RUT'}
                            </span>
                        ))}
                        {miEquipo.length === 0 && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Sin personal vinculado</span>
                        )}
                    </div>
                </div>
                <PrevInspecciones rutsPermitidos={rutsPermitidos} mostrarSoloPermitidos />
            </div>
        );
    }

    if (currentView === 'turnos') {
        return (
            <div className="animate-in fade-in duration-500">
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => setCurrentView('menu')}
                        className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-black text-slate-800 uppercase italic">Gestión de Turnos</h2>
                </div>
                <GestorTurnosOperaciones />
            </div>
        );
    }

    const Card = ({ icon: Icon, title, subtitle, color, onClick, badge }) => (
        <button
            onClick={onClick}
            className="group relative bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200 transition-all active:scale-95 text-left overflow-hidden h-64 flex flex-col justify-between"
        >
            <div className={`absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4`}>
                <Icon size={180} />
            </div>

            <div className={`p-4 rounded-2xl ${color} text-white w-fit shadow-lg`}>
                <Icon size={32} />
            </div>

            <div>
                <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{title}</h3>
                    {badge && <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{badge}</span>}
                </div>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase italic">{subtitle}</p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest group-hover:text-blue-500 group-hover:translate-x-2 transition-all">
                Ingresar <ArrowRight size={14} />
            </div>
        </button>
    );

    return (
        <div className="max-w-[1400px] mx-auto pb-20 px-4 pt-4 animate-in fade-in duration-500 w-full overflow-x-hidden relative">

            {/* Header Dinámico */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-4">
                    {currentView !== 'menu' && (
                        <button
                            onClick={() => setCurrentView('menu')}
                            className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-all shadow-sm"
                        >
                            <ArrowLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="text-blue-600">Portal</span> Supervisión
                        </h1>
                        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-1 italic">
                            {currentView === 'menu' ? 'Centro de Operaciones Digital' : `Módulo > ${currentView.toUpperCase()} `}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 bg-slate-100 p-1 rounded-2xl overflow-hidden border border-slate-200">
                    <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Equipo</p>
                        <p className="text-sm font-black text-slate-700">{miEquipo.length}</p>
                    </div>
                    <div className="px-5 py-2 text-center flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Supervisor</p>
                        <p className="text-[11px] font-bold text-blue-600 uppercase">{user?.name?.split(' ')[0]}</p>
                    </div>
                </div>
            </div>

            {/* VISTA: MENÚ PRINCIPAL (LAS 6 TARJETAS) */}
            {currentView === 'menu' && (
                <>
                    {/* QUICK WINS: DASHBOARD DE ALERTAS OPERATIVAS */}
                    <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-4 duration-500">
                        {/* ALERTA 1: Usuarios sin TOA */}
                        {miEquipo.filter(t => (!t.idRecursoToa || t.idRecursoToa.trim() === '') && (!t.rrhh?.idRecursoToa || t.rrhh?.idRecursoToa.trim() === '')).length > 0 && (
                            <div className="bg-rose-50 border border-rose-200 p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-rose-100 transition-all" onClick={() => setCurrentView('dotacion')}>
                                <div className="p-3 bg-rose-500 text-white rounded-2xl shadow">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest italic">Urgente</p>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Sin ID Recurso</p>
                                    <p className="text-xs font-bold text-slate-500">
                                        {miEquipo.filter(t => (!t.idRecursoToa || t.idRecursoToa.trim() === '') && (!t.rrhh?.idRecursoToa || t.rrhh?.idRecursoToa.trim() === '')).length} Técnicos
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ALERTA 2: Solicitudes Pendientes */}
                        {solicitudes.filter(s => s.estado === 'Pendiente').length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-amber-100 transition-all" onClick={() => setCurrentView('solicitudes')}>
                                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow">
                                    <CalendarCheck size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Revisar</p>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Permisos</p>
                                    <p className="text-xs font-bold text-slate-500">
                                        {solicitudes.filter(s => s.estado === 'Pendiente').length} Por Aprobar
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ALERTA 3: Falta Vehículo Asignado */}
                        {miEquipo.filter(t => !t.vehiculoAsignado).length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => setCurrentView('dotacion')}>
                                <div className="p-3 bg-slate-500 text-white rounded-2xl shadow">
                                    <Car size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Atención</p>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Sin Vehículo</p>
                                    <p className="text-xs font-bold text-slate-500">
                                        {miEquipo.filter(t => !t.vehiculoAsignado).length} Técnicos
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ALERTA 4: Combustible Pendiente */}
                        {fuelRequests.filter(r => r.estado === 'Pendiente').length > 0 && (
                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-[2rem] flex items-center gap-4 cursor-pointer hover:bg-orange-100 transition-all" onClick={() => setCurrentView('combustible')}>
                                <div className="p-3 bg-orange-600 text-white rounded-2xl shadow">
                                    <Fuel size={20} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest italic">Aprobar</p>
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tight">Combustible</p>
                                    <p className="text-xs font-bold text-slate-500">
                                        {fuelRequests.filter(r => r.estado === 'Pendiente').length} Solicitudes
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card
                            icon={BarChart3}
                            title="Dashboard Gestión"
                            subtitle="Resumen de avance y alertas"
                            color="bg-blue-600"
                            onClick={() => setCurrentView('resumen')}
                        />
                        <Card
                            icon={Users}
                            title="Mi Dotación"
                            subtitle="Auto-asignación de técnicos"
                            color="bg-violet-500"
                            onClick={() => setCurrentView('dotacion')}
                        />
                        <Card
                            icon={CheckSquare}
                            title="Asistencia Operativa"
                            subtitle="Presencia y disponibilidad diaria"
                            color="bg-teal-600"
                            onClick={() => setCurrentView('asistencia_operativa')}
                        />
                        <Card
                            icon={Truck}
                            title="Mi Flotilla"
                            subtitle="Vínculo y Checklist Vehicular"
                            color="bg-sky-500"
                            onClick={() => setCurrentView('flotilla')}
                        />
                        <Card
                            icon={MapPin}
                            title="Inspecciones"
                            subtitle="Control de terreno y calidad"
                            color="bg-emerald-500"
                            onClick={() => setCurrentView('inspecciones')}
                        />
                        <Card
                            icon={ShieldCheck}
                            title="Seguimiento AST"
                            subtitle="Cumplimiento seguridad hoy"
                            color="bg-amber-500"
                            badge={asts.filter(a => {
                                const today = new Date().toISOString().split('T')[0];
                                return (a.createdAt || a.fecha)?.startsWith(today);
                            }).length}
                            onClick={() => setCurrentView('ast')}
                        />
                        <Card
                            icon={CalendarCheck}
                            title="Solicitudes"
                            subtitle="Permisos, Vacaciones y Horas"
                            color="bg-rose-500"
                            badge={solicitudes.filter(s => s.estado === 'Pendiente').length}
                            onClick={() => setCurrentView('solicitudes')}
                        />
                        <Card
                            icon={BarChart3}
                            title="Producción"
                            subtitle="Rendimiento de mi equipo"
                            color="bg-indigo-500"
                            onClick={() => setCurrentView('produccion')}
                        />
                        <Card
                            icon={Clock}
                            title="Gestión Turnos"
                            subtitle="Programación L-S"
                            color="bg-fuchsia-500"
                            onClick={() => setCurrentView('turnos')}
                        />
                        <Card
                            icon={Fuel}
                            title="Gestión Combustible"
                            subtitle="Aprobación y Control de Cargas"
                            color="bg-orange-600"
                            onClick={() => setCurrentView('combustible')}
                            badge={fuelRequests.filter(r => r.estado === 'Pendiente').length}
                        />
                        <Card
                            icon={Package}
                            title="Auditoría Logística"
                            subtitle="Control dinámico de inventario"
                            color="bg-slate-700"
                            onClick={() => {
                                setAuditTecnico(null);
                                setShowAuditModal(true);
                            }}
                        />
                    </div>
                </>
            )}

            {/* VISTA: ASISTENCIA OPERATIVA */}
            {currentView === 'asistencia_operativa' && (
                <AsistenciaOperativa 
                    miEquipo={miEquipo}
                    asistenciaFecha={asistenciaFecha}
                    setAsistenciaFecha={setAsistenciaFecha}
                    solicitudes={solicitudes}
                    user={user}
                    showToast={showToast}
                />
            )}

            {/* VISTA: RESUMEN / DASHBOARD */}
            {currentView === 'resumen' && (
                <DashboardSupervisor
                    miEquipo={miEquipo}
                    asts={asts}
                    fuelRequests={fuelRequests}
                    setCurrentView={setCurrentView}
                />
            )}

            {/* VISTA: MI DOTACIÓN */}
            {currentView === 'dotacion' && (
                <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500 w-full overflow-x-hidden relative">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                            <div className="p-4 bg-violet-100 text-violet-600 rounded-[1.5rem]"><Users size={32} /></div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Vincular Personal</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase italic">Ingresa el RUT para agregar a tu equipo</p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                            <input
                                type="text"
                                placeholder="RUT Trabajador..."
                                className={`flex-1 p-5 border rounded-[1.5rem] font-bold text-lg outline-none focus:ring-4 focus:ring-violet-500/10 transition-all uppercase ${rutInput && !validateRut(rutInput) ? 'bg-rose-50 border-rose-400 text-rose-600 focus:border-rose-500' : 'bg-slate-50 border-slate-200 focus:border-violet-400'}`}
                                value={rutInput}
                                onChange={(e) => setRutInput(formatRut(e.target.value))}
                            />
                            <input
                                type="text"
                                placeholder="ID TOA (Opcional)..."
                                className="w-full md:w-48 p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold text-lg outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all"
                                value={idToaInput}
                                onChange={(e) => setIdToaInput(e.target.value)}
                            />
                            <button
                                onClick={handleClaim}
                                className="px-8 bg-violet-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-violet-200 hover:scale-[1.05] transition-all"
                            >
                                Vincular
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 italic">Mi Equipo Asignado</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {miEquipo.map(tec => (
                                <div key={tec._id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm group hover:border-violet-200 hover:shadow-lg transition-all overflow-hidden">
                                    {/* Fila principal */}
                                    <div className="flex items-center gap-4 p-5">
                                        <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center font-black text-xl flex-shrink-0">
                                            {(tec.nombres || tec.nombre)?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-800 uppercase tracking-tight truncate">
                                                {tec.nombres && tec.apellidos ? `${tec.nombres} ${tec.apellidos}` : tec.nombre}
                                            </p>
                                            <p className="text-[11px] font-mono text-slate-400 mt-0.5">{tec.rut}</p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => handleOpenFicha(tec._id)}
                                                className="p-2.5 text-violet-500 hover:bg-violet-50 rounded-xl transition-all"
                                                title="Ver Ficha Completa"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => { setAuditTecnico(tec); setShowAuditModal(true); }}
                                                className="p-2.5 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Auditar Inventario"
                                            >
                                                <ShieldCheck size={18} />
                                            </button>
                                            {!tec.vehiculoAsignado && (
                                                <button
                                                    onClick={() => handleAbrirAsignarVehiculo(tec)}
                                                    className="p-2.5 text-sky-500 hover:bg-sky-50 rounded-xl transition-all"
                                                    title="Asignar Vehículo"
                                                >
                                                    <Car size={18} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleUnclaim(tec._id)}
                                                className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    {/* Fila detalles */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-50 border-t border-slate-50 bg-slate-50/50">
                                        <div className="px-4 py-2.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Cargo</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate mt-0.5">{tec.cargo || '—'}</p>
                                        </div>
                                        <div className="px-4 py-2.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Proyecto / Mandante</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate mt-0.5">
                                                {(tec.proyectoDisplay || tec.rrhh?.projectId?.nombreProyecto || tec.proyecto || '—')} / {(tec.mandanteDisplay || tec.rrhh?.projectId?.cliente?.nombre || tec.mandantePrincipal || '—')}
                                            </p>
                                        </div>
                                        <div className="px-4 py-2.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Región / Sede</p>
                                            <p className="text-[11px] font-bold text-slate-700 truncate mt-0.5">{tec.region || tec.sede || '—'}</p>
                                        </div>
                                        <div className="px-4 py-2.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Vehículo / Logística</p>
                                            <p className="text-[11px] font-bold mt-0.5">
                                                {tec.vehiculoAsignado
                                                    ? <span className="text-sky-600 font-black flex items-center gap-1">🚗 {tec.vehiculoAsignado.patente} <span className="text-[9px] opacity-60">({tec.vehiculoAsignado.estadoOperativo})</span></span>
                                                    : <span className="text-slate-400">Sin asignar</span>
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    {/* Nueva Fila: Tallas y Contacto Rápido (Opcional/Colapsable si fuera muy grande, pero aquí va directo) */}
                                    <div className="grid grid-cols-3 divide-x divide-slate-50 border-t border-slate-50 bg-white group-hover:bg-indigo-50/20 transition-all">
                                        <div className="px-4 py-2">
                                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Contacto</p>
                                            <p className="text-[10px] font-bold text-slate-500">{tec.telefono || tec.email || '—'}</p>
                                        </div>
                                        <div className="px-4 py-2">
                                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">Dotación (Tallas)</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                                {tec.tallaPantalon || tec.rrhh?.tallaPantalon ? `P: ${tec.tallaPantalon || tec.rrhh?.tallaPantalon}` : ''} 
                                                {tec.tallaCalzado || tec.rrhh?.tallaCalzado ? ` | C: ${tec.tallaCalzado || tec.rrhh?.tallaCalzado}` : ''}
                                                {!(tec.tallaPantalon || tec.rrhh?.tallaPantalon) && '—'}
                                            </p>
                                        </div>
                                        <div className="px-4 py-2">
                                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest">ID TOA</p>
                                            <button 
                                                onClick={() => {
                                                    setPromptModal({
                                                        title: 'Configurar ID TOA',
                                                        subtitle: `Asignando identificador para ${tec.nombre || (tec.nombres && tec.apellidos ? `${tec.nombres} ${tec.apellidos}` : '')}`,
                                                        placeholder: 'Ej: 12345',
                                                        defaultValue: tec.idRecursoToa || tec.rrhh?.idRecursoToa || '',
                                                        required: true,
                                                        onConfirm: (val) => {
                                                            handleUpdateIdToa(tec._id, val);
                                                        }
                                                    });
                                                }}
                                                className="text-[10px] font-bold text-indigo-500 font-mono hover:underline decoration-dotted underline-offset-4"
                                            >
                                                {tec.idRecursoToa || tec.rrhh?.idRecursoToa || 'CONFIGURAR ID'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL AUDITORIA DINAMICA */}
            <DynamicAuditModal
                isOpen={showAuditModal}
                onClose={() => setShowAuditModal(false)}
                tecnicoPreload={auditTecnico}
                tecnicosPermitidos={miEquipo}
            />

            {/* VISTA: MI FLOTILLA */}
            {currentView === 'flotilla' && (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 uppercase italic">Mi Flotilla</h2>
                            <p className="text-slate-500 font-medium mt-1">Gestión de vehículos asignados a tu equipo.</p>
                        </div>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div onClick={() => setFilterCardFlota(null)} className={`bg-white p-5 rounded-2xl border ${filterCardFlota === null ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-slate-800">{kpisFlota.total}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Flotilla</span>
                        </div>
                        <div onClick={() => setFilterCardFlota('Operativos')} className={`bg-emerald-50 p-5 rounded-2xl border ${filterCardFlota === 'Operativos' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-emerald-600">{kpisFlota.operativos}</span>
                            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1">Operativos</span>
                        </div>
                        <div onClick={() => setFilterCardFlota('En Terreno')} className={`bg-blue-50 p-5 rounded-2xl border ${filterCardFlota === 'En Terreno' ? 'border-blue-400 ring-2 ring-blue-200' : 'border-blue-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-blue-600">{kpisFlota.enTerreno}</span>
                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-1">En Terreno</span>
                        </div>
                        <div onClick={() => setFilterCardFlota('En Patio')} className={`bg-indigo-50 p-5 rounded-2xl border ${filterCardFlota === 'En Patio' ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-indigo-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-indigo-600">{kpisFlota.enPatio}</span>
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">En Patio</span>
                        </div>
                        <div onClick={() => setFilterCardFlota('Mantencion')} className={`bg-amber-50 p-5 rounded-2xl border ${filterCardFlota === 'Mantencion' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-amber-600">{kpisFlota.mantencion}</span>
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">En Taller</span>
                        </div>
                        <div onClick={() => setFilterCardFlota('Siniestros')} className={`bg-red-50 p-5 rounded-2xl border ${filterCardFlota === 'Siniestros' ? 'border-red-400 ring-2 ring-red-200' : 'border-red-100'} shadow-sm flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all`}>
                            <span className="text-3xl font-black text-red-600">{kpisFlota.siniestros}</span>
                            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-1">Siniestros</span>
                        </div>
                    </div>

                    {/* MAIN CONTENT AREA */}
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[500px]">
                        {/* Toolbar */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="relative w-full max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar por patente, marca, conductor..."
                                    value={searchQueryFlota}
                                    onChange={(e) => setSearchQueryFlota(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-sm focus:border-blue-500 outline-none shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {filteredVehiculosFlota.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                                    <Truck size={48} className="text-slate-200 mb-4" />
                                    <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No se encontraron vehículos</p>
                                </div>
                            ) : (
                                <table className="w-full min-w-[1000px] lg:min-w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Patente</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Vehículo</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">Conductor & Zona</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Estado Op. / Reemplazo</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-center">Logística</th>
                                            <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVehiculosFlota.map((v) => (
                                            <tr key={v._id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors group">
                                                <td className="py-4 px-6">
                                                    <button onClick={() => { setSelectedVehiculo(v); setActivePanelFlota('ficha'); }} className="inline-flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg font-black tracking-widest hover:bg-blue-600 transition-colors">
                                                        <Car size={14} /> {v.patente}
                                                    </button>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="font-bold text-slate-800 text-sm">{v.marca} {v.modelo}</div>
                                                    <div className="text-xs text-slate-400 font-medium">Año: {v.anio || 'N/A'}</div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {v.asignadoA ? (
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm truncate max-w-[150px]">{v.asignadoA.nombre || v.asignadoA.nombres}</div>
                                                            <div className="text-[10px] text-slate-500 font-medium">RUT: {formatRut(v.asignadoA.rut || v.asignadoA.rutRaw || '') || 'N/A'}</div>
                                                            <div className="text-[10px] text-slate-400 font-medium mt-0.5"><MapPin size={10} className="inline mr-1" />{v.zona || 'Metropolitana'}</div>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md mb-1 inline-block">Sin Asignar (Disponible)</span>
                                                            <div className="text-[10px] text-slate-400 font-medium"><MapPin size={10} className="inline mr-1" />{v.zona || 'Metropolitana'}</div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${getOpColor(v.estadoOperativo)}`}>
                                                            {v.estadoOperativo === 'Operativa' && <CheckCircle2 size={12} />}
                                                            {v.estadoOperativo === 'Siniestro' && <AlertOctagon size={12} />}
                                                            {v.estadoOperativo === 'Mantencion' && <Wrench size={12} />}
                                                            {v.estadoOperativo?.toUpperCase()}
                                                        </span>
                                                        {v.tieneReemplazo === 'SI' && v.patenteReemplazo && (
                                                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                Rmplz: {v.patenteReemplazo}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${getLogColor(v.estadoLogistico)}`}>
                                                        {v.estadoLogistico?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                        {(hasPermission('flota_vehiculos', 'crear') || hasPermission('flota_vehiculos', 'editar')) && v.estadoOperativo !== 'Siniestro' && (
                                                            <>
                                                                {v.asignadoA && (
                                                                    <button onClick={() => { setSelectedVehiculo(v); setChecklistTipo('Recepción'); setActivePanelFlota('checklist'); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg tooltip-btn" title="Recepcionar Vehículo (Trabajador)">
                                                                        <ClipboardCheck size={18} />
                                                                    </button>
                                                                )}
                                                                {!v.asignadoA && (
                                                                    <>
                                                                        <button onClick={() => { setSelectedVehiculo(v); setChecklistTipo('Asignación'); setActivePanelFlota('checklist'); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg tooltip-btn" title="Asignar Vehículo (Checklist Entrega)">
                                                                            <UserPlus size={18} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                        {(hasPermission('flota_vehiculos', 'crear') || hasPermission('flota_vehiculos', 'editar')) && (
                                                            <button onClick={() => { setSelectedVehiculo(v); setActivePanelFlota('siniestro'); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg tooltip-btn" title="Reportar Siniestro">
                                                                <AlertTriangle size={18} />
                                                            </button>
                                                        )}
                                                        {hasPermission('flota_vehiculos', 'ver') && (
                                                            <button onClick={() => { setSelectedVehiculo(v); setActivePanelFlota('historial'); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg tooltip-btn" title="Ver Historial (Timeline)">
                                                                <Clock size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* VISTA: SEGUIMIENTO AST */}
            {currentView === 'ast' && (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    {/* Resumen rápido */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Completaron AST', val: miEquipo.filter(t => asts.some(a => (a.createdAt || a.fecha)?.startsWith(new Date().toISOString().split('T')[0]) && a.rutTrabajador === t.rut)).length, color: 'bg-emerald-500' },
                            { label: 'Pendientes Hoy', val: miEquipo.filter(t => !asts.some(a => (a.createdAt || a.fecha)?.startsWith(new Date().toISOString().split('T')[0]) && a.rutTrabajador === t.rut)).length, color: 'bg-rose-500' },
                            { label: 'Total Equipo', val: miEquipo.length, color: 'bg-indigo-500' },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">{label}</p>
                                <p className={`text-3xl font-black mt-1 ${color.replace('bg-', 'text-')}`}>{val}</p>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl overflow-x-auto custom-scrollbar">
                        <h2 className="text-xl font-black text-slate-800 uppercase italic mb-6">Estado AST del Día — Mi Equipo</h2>
                        <table className="w-full">
                            <thead>
                                <tr className="text-left border-b border-slate-50">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest px-4">Trabajador</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Cargo / Proyecto</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">Vehículo</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">AST Hoy</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">Hora</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {miEquipo.map(tec => {
                                    const astHoy = asts.find(a => {
                                        const today = new Date().toISOString().split('T')[0];
                                        return (a.createdAt || a.fecha)?.startsWith(today) && (a.rutTrabajador === tec.rut);
                                    });
                                    const vehTec = flota.find(v => v.asignadoA?.rut === tec.rut || v.asignadoA?._id === tec.vehiculoAsignado);

                                    return (
                                        <tr key={tec._id} className="group hover:bg-slate-50 transition-all">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white ${astHoy ? 'bg-emerald-500' : 'bg-rose-400'}`}>
                                                        {(tec.nombres || tec.nombre)?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-700 uppercase leading-none">
                                                            {tec.nombres && tec.apellidos ? `${tec.nombres} ${tec.apellidos}` : tec.nombre}
                                                        </p>
                                                        <p className="text-[9px] font-mono text-slate-400 mt-0.5">{tec.rut}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <p className="text-[11px] font-bold text-slate-600 uppercase">{tec.cargo || '—'}</p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">{(tec.proyectoDisplay || tec.rrhh?.projectId?.nombreProyecto || tec.proyecto || '—')} / {(tec.mandanteDisplay || tec.rrhh?.projectId?.cliente?.nombre || tec.mandantePrincipal || '—')}</p>
                                            </td>
                                            <td className="py-4 text-center">
                                                {vehTec ? (
                                                    <span className="bg-slate-900 text-white px-2 py-1 rounded-lg font-mono text-[10px] font-black uppercase">{vehTec.patente}</span>
                                                ) : (
                                                    <span className="text-slate-300 text-[9px] font-bold uppercase">—</span>
                                                )}
                                            </td>
                                            <td className="py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${astHoy ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600 animate-pulse'}`}>
                                                    {astHoy ? '✓ Listo' : '⚠ Pendiente'}
                                                </span>
                                            </td>
                                            <td className="py-4 text-center font-mono text-xs text-slate-500">
                                                {astHoy ? new Date(astHoy.createdAt || astHoy.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VISTA: SOLICITUDES */}
            {currentView === 'solicitudes' && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500 w-full overflow-x-hidden relative">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 italic">Permisos del Equipo</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {solicitudes.map((s, idx) => {
                            const tecInfo = miEquipo.find(t => t.rut === s.techRut);
                            return (
                                <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-black text-lg">
                                                {s.techName?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{s.techName}</p>
                                                <p className="text-[10px] font-bold text-rose-500 uppercase italic">{s.tipo} • {s.diasHabiles} Días</p>
                                                {tecInfo && (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                        {tecInfo.cargo}{tecInfo.mandantePrincipal ? ` · ${tecInfo.mandantePrincipal}` : ''}{tecInfo.region ? ` · ${tecInfo.region}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${s.estado === 'Aprobado' ? 'bg-emerald-50 text-emerald-600' :
                                            s.estado === 'Rechazado' ? 'bg-rose-50 text-rose-600' :
                                                'bg-amber-50 text-amber-600'
                                            }`}>
                                            {s.estado}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4 bg-slate-50 rounded-2xl">
                                        <div className="border-r border-slate-200 pr-4">
                                            <p className="text-[8px] font-black text-slate-400 uppercase italic">Desde</p>
                                            <p className="text-xs font-bold text-slate-700">{new Date(s.fechaInicio).toLocaleDateString()}</p>
                                        </div>
                                        <div className="pl-4">
                                            <p className="text-[8px] font-black text-slate-400 uppercase italic">Hasta</p>
                                            <p className="text-xs font-bold text-slate-700">{new Date(s.fechaFin).toLocaleDateString()}</p>
                                        </div>
                                    </div>

                                    {s.estado === 'Pendiente' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setConfirmModal({
                                                        title: 'Aprobar Solicitud',
                                                        message: `¿Estás seguro de que deseas aprobar la solicitud de ${s.tipo} para ${s.techName}?`,
                                                        onConfirm: () => handleApproveVacation(s.candId, s._id, s.approvalChain)
                                                    });
                                                }}
                                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100/50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Check size={14} /> Aprobar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setConfirmModal({
                                                        title: 'Rechazar Solicitud',
                                                        message: `¿Estás seguro de que deseas rechazar la solicitud de ${s.tipo} para ${s.techName}?`,
                                                        onConfirm: () => handleRejectVacation(s.candId, s._id, s.approvalChain)
                                                    });
                                                }}
                                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100/50 transition-all flex items-center justify-center gap-2"
                                            >
                                                <X size={14} /> Rechazar
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase italic ml-2">Comentario Supervisor para Gerencia</label>
                                        <div className="flex gap-2">
                                            <textarea
                                                placeholder="Agregar observación o aval..."
                                                className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-200 transition-all resize-none h-20"
                                                defaultValue={s.supervisorComment}
                                                id={`comment-${s.candId}-${s._id}`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(`comment-${s.candId}-${s._id}`);
                                                    const comment = el ? el.value : '';
                                                    handleCommentSolicitud(s.candId, s._id, comment);
                                                }}
                                                className="px-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center p-4 shadow-lg shadow-blue-200 active:scale-95"
                                            >
                                                <Save size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {solicitudes.length === 0 && (
                            <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                                <MessageSquare size={48} className="text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-300 font-black uppercase italic text-xs tracking-widest">No hay solicitudes pendientes</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* VISTA: PRODUCCIÓN */}
            {currentView === 'produccion' && (() => {
                // 1. Procesamiento de datos para Gráficos
                const today = new Date();
                const last7Days = [...Array(7)].map((_, i) => {
                    const d = new Date();
                    d.setDate(today.getDate() - (6 - i));
                    return d.toISOString().split('T')[0];
                });

                // Datos para Gráfico de Tendencia (Últimos 7 días)
                const trendData = last7Days.map(date => {
                    const dayProd = (produccion || []).filter(p => p && p.fecha && String(p.fecha).startsWith(date));
                    return {
                        fecha: new Date(date + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
                        completadas: dayProd.filter(p => p && p.Estado && String(p.Estado).toLowerCase().includes('complet')).length,
                        puntos: dayProd.reduce((acc, p) => acc + (parseFloat(p?.puntos) || 0), 0)
                    };
                });

                // Datos para Ranking de Técnicos (Puntos acumulados)
                const techRanking = (miEquipo || []).map(tec => {
                    if (!tec) return null;
                    const idToa = tec.idRecursoToa || tec.rrhh?.idRecursoToa || tec.rrhh?.externalId;
                    const tecProd = (produccion || []).filter(p => {
                        if (!p) return false;
                        const prodIdToa = p['ID_Recurso'] || p.idRecurso || p.idRecursoToa;
                        return (prodIdToa && idToa && String(prodIdToa) === String(idToa)) || 
                               (p.tecnicoRut === tec.rut || p.rut === tec.rut);
                    });
                    return {
                        name: tec.nombres?.split(' ')[0] || tec.nombre?.split(' ')[0] || 'Técnico',
                        puntos: tecProd.reduce((acc, p) => acc + (parseFloat(p?.puntos) || 0), 0),
                        ots: tecProd.filter(p => p && p.Estado && String(p.Estado).toLowerCase().includes('complet')).length
                    };
                }).filter(Boolean).sort((a, b) => b.puntos - a.puntos).slice(0, 8);

                // Datos para Mix de Estados (Pie Chart)
                const statusCounts = (produccion || []).reduce((acc, p) => {
                    if (!p) return acc;
                    const estado = p.Estado || 'Pendiente';
                    acc[estado] = (acc[estado] || 0) + 1;
                    return acc;
                }, {});

                const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
                const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

                return (
                    <div className="space-y-8 animate-in slide-in-from-bottom duration-500 pb-20">
                        {/* KPIs de Cabecera */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                                <TrendingUp size={120} className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">Puntos Equipo (Hoy)</p>
                                <div className="flex items-end gap-2 relative z-10">
                                    <h4 className="text-6xl font-black">
                                        {Math.round((produccion || []).filter(p => p && p.fecha && String(p.fecha).startsWith(new Date().toISOString().split('T')[0]))
                                            .reduce((acc, p) => acc + (parseFloat(p?.puntos) || 0), 0))}
                                    </h4>
                                    <span className="text-xs font-bold mb-3 uppercase italic">Pts</span>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg"><Target size={18} /></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efectividad</p>
                                </div>
                                <h4 className="text-4xl font-black text-slate-800">
                                    {Math.round(((produccion || []).filter(p => p && p.Estado && String(p.Estado).toLowerCase().includes('complet')).length / Math.max(1, (produccion || []).length)) * 100)}%
                                </h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic">Vs Total de Órdenes</p>
                            </div>

                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><Trophy size={18} /></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Performer</p>
                                </div>
                                <h4 className="text-xl font-black text-slate-800 uppercase truncate">
                                    {techRanking[0]?.name || '---'}
                                </h4>
                                <p className="text-[9px] font-bold text-amber-600 uppercase mt-1 italic">{techRanking[0]?.puntos || 0} Puntos Acumulados</p>
                            </div>

                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-center">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><Users size={18} /></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio/Técnico</p>
                                </div>
                                <h4 className="text-4xl font-black text-slate-800">
                                    {Math.round((produccion || []).filter(p => p && p.Estado && String(p.Estado).toLowerCase().includes('complet')).length / Math.max(1, (miEquipo || []).length))}
                                </h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic">OTs por persona</p>
                            </div>
                        </div>

                        {/* Fila de Gráficos */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Gráfico 1: Tendencia */}
                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase italic">Evolución de Producción</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Últimos 7 días de operación</p>
                                    </div>
                                    <TrendingUp size={24} className="text-indigo-500" />
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '1rem' }}
                                                itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                                            />
                                            <Area type="monotone" dataKey="completadas" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorProd)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Gráfico 2: Ranking */}
                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 uppercase italic">Ranking del Equipo</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Puntos generados por técnico</p>
                                    </div>
                                    <Trophy size={24} className="text-amber-500" />
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={techRanking} layout="vertical" margin={{ left: 20 }}>
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#475569' }} />
                                            <Tooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar dataKey="puntos" radius={[0, 10, 10, 0]} barSize={24}>
                                                {techRanking.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#e2e8f0'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Mix de Estados y Tabla Resumen */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col items-center">
                                <div className="w-full flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-black text-slate-800 uppercase italic">Mix de Estados</h3>
                                    <PieIcon size={20} className="text-slate-400" />
                                </div>
                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase">{value}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="text-sm font-black text-slate-800 uppercase italic">Registro Reciente de Actividad</h3>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-tighter">Últimas 50 OTs</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead>
                                            <tr className="bg-slate-50/80">
                                                <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest italic">Técnico</th>
                                                <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest italic">Orden</th>
                                                <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest italic">Estado</th>
                                                <th className="px-5 py-4 font-black text-slate-400 uppercase tracking-widest italic">Ptos</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {produccion.slice(0, 10).map((p, i) => {
                                                const tecObj = miEquipo.find(t => {
                                                    const idToa = t.idRecursoToa || t.rrhh?.idRecursoToa;
                                                    const prodIdToa = p['ID_Recurso'] || p.idRecurso || p.idRecursoToa;
                                                    return (prodIdToa && idToa && prodIdToa.toString() === idToa.toString()) || 
                                                           (t.rut === p.tecnicoRut || t.rut === p.rut);
                                                });
                                                const nombreAMostrar = formatNombreApellido(tecObj, p.nombre || p['Técnico'] || p.Técnico || '---');
                                                return (
                                                    <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-5 py-3">
                                                            <div className="font-black text-slate-800 uppercase leading-none">{nombreAMostrar}</div>
                                                            {tecObj && <div className="text-[8px] font-bold text-indigo-400 mt-0.5">{tecObj.idRecursoToa || 'Vínculo ID'}</div>}
                                                        </td>
                                                        <td className="px-5 py-3 font-bold text-indigo-600 font-mono">{p.ordenId || '---'}</td>
                                                        <td className="px-5 py-3">
                                                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${p.Estado?.toLowerCase().includes('complet') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                {p.Estado}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 font-black text-slate-800">{p.puntos || 0}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        
                        {/* Tabla Maestra Original (Opcional, la mantenemos para detalle total) */}
                        <div className="bg-slate-900/5 p-8 rounded-[3rem] border-2 border-dashed border-slate-200">
                             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase italic">Base de Datos TOA</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 italic">Auditoría detallada de registros históricos</p>
                                </div>
                             </div>
                             {/* ... aquí iría la tabla original slice(0, 500) si se desea mantener ... */}
                             <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Sección de auditoría detallada disponible para exportación</p>
                        </div>
                    </div>
                );
            })()}

            {/* MODAL CHECKLIST (PASO 2 DE FLOTA) */}
            {showChecklist && selectedVehiculo && (
                <CheckListVehicular
                    vehiculo={selectedVehiculo}
                    tecnico={selectedTecnico || { nombre: 'MODO VISTA PREVIA', rut: '--.--.--', cargo: 'SUPERVISOR', isPreview: true }}
                    tipoInicial={selectedVehiculo.checklistTipo || 'Asignación'}
                    onSave={() => {
                        setShowChecklist(false);
                        fetchData();
                    }}
                    onClose={() => setShowChecklist(false)}
                />
            )}

            {/* VISTA: GESTIÓN COMBUSTIBLE */}
            {currentView === 'combustible' && (
                <div className="animate-in fade-in slide-in-from-bottom duration-500 space-y-8 pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-orange-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Pendientes</p>
                            <p className="text-3xl font-black text-amber-500 tabular-nums">{fuelRequests.filter(r => r.estado === 'Pendiente').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-emerald-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Aprobados</p>
                            <p className="text-3xl font-black text-emerald-500 tabular-nums">{fuelRequests.filter(r => r.estado === 'Aprobado').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-blue-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Cargas Realizadas</p>
                            <p className="text-3xl font-black text-blue-500 tabular-nums">{fuelRequests.filter(r => r.estado === 'Carga Realizada').length}</p>
                        </div>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:border-slate-300">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Total Hoy</p>
                            <p className="text-3xl font-black text-slate-800 tabular-nums">{fuelRequests.length}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none">Control de Carga de Combustible</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 italic tracking-tight">Validación de kilometraje y evidencia fotográfica</p>
                            </div>
                            <div className="flex gap-2">
                                <span className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full border border-slate-200 text-[9px] font-black text-slate-500 uppercase tracking-tighter shadow-sm animate-pulse">
                                    <Clock size={12} className="text-amber-500" /> Monitoreo en Vivo
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/30">
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Técnico / RUT</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Vehículo / KM</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Evidencia</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Estado</th>
                                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest italic text-right">Gestión</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {fuelRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-8 py-24 text-center">
                                                <div className="flex flex-col items-center gap-4 opacity-10">
                                                    <Fuel size={80} />
                                                    <p className="text-sm font-black uppercase italic tracking-[0.3em] text-slate-900">Sin movimientos</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        fuelRequests.map((req) => (
                                            <tr key={req._id} className="hover:bg-slate-50/50 transition-all group">
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">{req.nombre || 'Personal'}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{req.rut}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-indigo-600 uppercase italic leading-none">{req.patente}</span>
                                                        <div className="flex items-center gap-2 mt-1.5 ">
                                                            <span className="text-[10px] font-black text-slate-50 bg-slate-900 w-fit px-2 py-0.5 rounded-md shadow-sm">
                                                                {parseInt(req.kmActual).toLocaleString()} KM
                                                            </span>
                                                            {/* Buscar la solicitud anterior del MISMO vehículo en la lista (que está ordenada por fecha desc) */}
                                                            {(() => {
                                                                const index = fuelRequests.findIndex(r => r._id === req._id);
                                                                const prevInList = fuelRequests.slice(index + 1).find(r => r.patente === req.patente && r.estado !== 'Rechazado');
                                                                const prevInKm = prevInList ? parseInt(req.kmActual) - parseInt(prevInList.kmActual) : null;
                                                                if (prevInKm !== null) {
                                                                    return (
                                                                        <span className={`text-[9px] font-black ${prevInKm < 0 ? 'text-rose-500' : 'text-emerald-500'} italic`}>
                                                                            ({prevInKm > 0 ? '+' : ''}{prevInKm.toLocaleString()} KM)
                                                                        </span>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => window.open(req.fotoTacometro, '_blank')}
                                                        className="w-20 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-xl hover:scale-110 active:scale-95 transition-all relative group shadow-slate-200"
                                                    >
                                                        <img src={req.fotoTacometro} alt="KM" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                                        <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <Info size={20} className="text-white scale-75 group-hover:scale-100 transition-transform" />
                                                        </div>
                                                    </button>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border shadow-sm inline-flex items-center gap-2
                                                        ${req.estado === 'Pendiente' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                                                            req.estado === 'Aprobado' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 shadow-emerald-50' :
                                                                req.estado === 'Carga Realizada' ? 'bg-blue-50 border-blue-100 text-blue-600 shadow-blue-50' :
                                                                    'bg-rose-50 border-rose-100 text-rose-600 shadow-rose-50'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${req.estado === 'Pendiente' ? 'bg-amber-500 animate-pulse' :
                                                            req.estado === 'Aprobado' ? 'bg-emerald-500' :
                                                                req.estado === 'Carga Realizada' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                                                        {req.estado}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end gap-3">
                                                        {req.estado === 'Pendiente' && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setPromptModal({
                                                                            title: 'Aprobar Carga',
                                                                            subtitle: `¿Algún comentario o nota para la carga de la patente ${req.patente}? (Opcional)`,
                                                                            placeholder: 'Comentario opcional...',
                                                                            defaultValue: '',
                                                                            required: false,
                                                                            onConfirm: (comentario) => {
                                                                                api.put(`/api/operaciones/combustible/${req._id}/estado`, { estado: 'Aprobado', comentarioSupervisor: comentario })
                                                                                    .then(() => { 
                                                                                        showToast("Carga aprobada correctamente", "success"); 
                                                                                        fetchData(); 
                                                                                    })
                                                                                    .catch(() => showToast("Error al aprobar la carga", "error"));
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-200 hover:scale-110 active:scale-95 transition-all hover:bg-emerald-600"
                                                                    title="Aprobar Carga"
                                                                >
                                                                    <Check size={20} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setPromptModal({
                                                                            title: 'Rechazar Carga',
                                                                            subtitle: `Ingresa el motivo del rechazo para la patente ${req.patente}:`,
                                                                            placeholder: 'Motivo del rechazo...',
                                                                            defaultValue: '',
                                                                            required: true,
                                                                            onConfirm: (comentario) => {
                                                                                api.put(`/api/operaciones/combustible/${req._id}/estado`, { estado: 'Rechazado', comentarioSupervisor: comentario })
                                                                                    .then(() => { 
                                                                                        showToast("Carga rechazada correctamente", "success"); 
                                                                                        fetchData(); 
                                                                                    })
                                                                                    .catch(() => showToast("Error al rechazar la carga", "error"));
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="p-3.5 bg-rose-500 text-white rounded-2xl shadow-xl shadow-rose-200 hover:scale-110 active:scale-95 transition-all hover:bg-rose-600"
                                                                    title="Rechazar"
                                                                >
                                                                    <XOctagon size={20} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {req.estado === 'Aprobado' && (
                                                            <button
                                                                onClick={() => {
                                                                    api.put(`/api/operaciones/combustible/${req._id}/estado`, { estado: 'Carga Realizada' })
                                                                        .then(() => { 
                                                                            showToast("Confirmación de carga realizada", "success"); 
                                                                            fetchData(); 
                                                                        })
                                                                        .catch(() => showToast("Error al confirmar la carga", "error"));
                                                                }}
                                                                className="flex items-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-200 hover:scale-[1.05] active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest group/btn"
                                                            >
                                                                <Fuel size={18} className="text-orange-500 group-hover/btn:rotate-12 transition-transform" /> Confirmar Carga
                                                            </button>
                                                        )}
                                                        {(req.estado === 'Carga Realizada' || req.estado === 'Rechazado') && (
                                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase italic px-4 border border-slate-100 rounded-xl py-2 bg-slate-50/50">
                                                                <CheckCircle2 size={14} /> Finalizado
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            {/* ── MODAL: FICHA COMPLETA DEL TRABAJADOR ─────────────────────────── */}
            {showFicha && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl my-8 overflow-hidden border border-slate-100">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-violet-600 to-indigo-700 p-8 text-white relative overflow-hidden">
                            <div className="absolute -right-8 -top-8 opacity-10"><Users size={160} /></div>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center text-3xl font-black border-2 border-white/30">
                                        {fichaData?.tecnico?.nombre?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black uppercase tracking-tight">
                                            {fichaData?.tecnico?.nombre || fichaData?.tecnico?.nombres + ' ' + fichaData?.tecnico?.apellidos}
                                        </h2>
                                        <p className="text-violet-200 text-xs font-bold uppercase italic mt-1">
                                            {fichaData?.tecnico?.cargo} · {fichaData?.tecnico?.rut}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowFicha(false); setFichaData(null); }}
                                    className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/20"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            {fichaLoading && (
                                <div className="mt-6 flex items-center gap-3">
                                    <Loader2 className="animate-spin" size={16} />
                                    <span className="text-sm font-bold uppercase">Cargando ficha...</span>
                                </div>
                            )}
                        </div>

                        {fichaData && !fichaLoading && (
                            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Datos Personales */}
                                <section className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                        <User size={12} /> Datos del Trabajador
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                            { label: 'RUT', value: fichaData.tecnico?.rut },
                                            { label: 'Cargo', value: fichaData.tecnico?.cargo },
                                            { label: 'Departamento', value: fichaData.tecnico?.departamento },
                                            { label: 'Sede', value: fichaData.tecnico?.sede },
                                            { label: 'Email', value: fichaData.tecnico?.email || fichaData.candidato?.email },
                                            { label: 'Teléfono', value: fichaData.candidato?.phone },
                                        ].map(({ label, value }) => value ? (
                                            <div key={label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">{label}</p>
                                                <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{value}</p>
                                            </div>
                                        ) : null)}
                                    </div>
                                </section>

                                {/* Vehículo Asignado */}
                                {fichaData.tecnico?.vehiculoAsignado && (
                                    <section className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                            <Car size={12} /> Vehículo Asignado
                                        </h3>
                                        <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 flex items-center gap-4">
                                            <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-mono font-black text-sm uppercase shadow">
                                                {fichaData.tecnico.vehiculoAsignado.patente}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-700 uppercase">
                                                    {fichaData.tecnico.vehiculoAsignado.marca} {fichaData.tecnico.vehiculoAsignado.modelo}
                                                </p>
                                                <p className="text-[9px] text-sky-500 font-bold uppercase">
                                                    {fichaData.tecnico.vehiculoAsignado.estadoLogistico} · {fichaData.tecnico.vehiculoAsignado.estadoOperativo}
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* Contacto Emergencia */}
                                {(fichaData.candidato?.emergencyContact || fichaData.candidato?.emergencyPhone) && (
                                    <section className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                            <Phone size={12} /> Contacto de Emergencia
                                        </h3>
                                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 grid grid-cols-2 gap-3">
                                            {fichaData.candidato?.emergencyContact && (
                                                <div>
                                                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest italic">Contacto</p>
                                                    <p className="text-xs font-bold text-slate-700">{fichaData.candidato.emergencyContact}</p>
                                                </div>
                                            )}
                                            {fichaData.candidato?.emergencyPhone && (
                                                <div>
                                                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest italic">Teléfono</p>
                                                    <p className="text-xs font-bold text-slate-700">{fichaData.candidato.emergencyPhone}</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                                {/* Contrato */}
                                {fichaData.candidato?.contractType && (
                                    <section className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                            <FileText size={12} /> Contrato
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {[
                                                { label: 'Tipo Contrato', value: fichaData.candidato?.contractType },
                                                { label: 'Inicio', value: fichaData.candidato?.contractStartDate ? new Date(fichaData.candidato.contractStartDate).toLocaleDateString('es-CL') : null },
                                                { label: 'Término', value: fichaData.candidato?.contractEndDate ? new Date(fichaData.candidato.contractEndDate).toLocaleDateString('es-CL') : null },
                                            ].map(({ label, value }) => value ? (
                                                <div key={label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">{label}</p>
                                                    <p className="text-xs font-bold text-slate-700 mt-0.5">{value}</p>
                                                </div>
                                            ) : null)}
                                        </div>
                                    </section>
                                )}

                                 {/* Tallas y Dotación (Captura Talento) */}
                                <section className="space-y-3">
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                        <Shirt size={12} /> Dotación y Tallas (HR)
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Talla Camisa', value: fichaData.candidato?.tallaCamisa || fichaData.tecnico?.tallaCamisa },
                                            { label: 'Talla Pantalón', value: fichaData.candidato?.tallaPantalon || fichaData.tecnico?.tallaPantalon },
                                            { label: 'Talla Calzado', value: fichaData.candidato?.tallaCalzado || fichaData.tecnico?.tallaCalzado },
                                            { label: 'Overol', value: fichaData.candidato?.overol || fichaData.tecnico?.overol },
                                            { label: 'Guantes', value: fichaData.candidato?.guantes || fichaData.tecnico?.guantes },
                                            { label: 'ID Recurso TOA', value: fichaData.candidato?.idRecursoToa || fichaData.tecnico?.idRecursoToa || fichaData.tecnico?.rrhh?.idRecursoToa },
                                        ].map(({ label, value }) => (
                                            <div key={label} className={`rounded-2xl p-4 border transition-all ${value ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                                                <p className={`text-[8px] font-black uppercase tracking-widest italic ${value ? 'text-indigo-400' : 'text-slate-400'}`}>{label}</p>
                                                <p className={`text-xs font-bold mt-0.5 ${value ? 'text-indigo-700' : 'text-slate-400'}`}>{value || 'No reg.'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                {/* Acreditaciones */}
                                {fichaData.candidato?.accreditation?.length > 0 && (
                                    <section className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                            <Award size={12} /> Acreditaciones
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {fichaData.candidato.accreditation.map((a, i) => (
                                                <span key={i} className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                                                    {a.nombre || a}
                                                </span>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                {/* Notas del supervisor */}
                                {fichaData.candidato?.notes && (
                                    <section className="space-y-3">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] italic flex items-center gap-2">
                                            <MessageSquare size={12} /> Notas
                                        </h3>
                                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                                            <p className="text-xs text-slate-600 font-bold leading-relaxed">{fichaData.candidato.notes}</p>
                                        </div>
                                    </section>
                                )}

                                {/* Acciones: solo lectura, pero puede ir a checklist */}
                                {fichaData.tecnico?.vehiculoAsignado && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <button
                                            onClick={() => {
                                                const tec = miEquipo.find(t => t._id === fichaData.tecnico._id) || fichaData.tecnico;
                                                const veh = fichaData.tecnico.vehiculoAsignado;
                                                setSelectedTecnico(tec);
                                                setSelectedVehiculo({ ...veh, checklistTipo: 'Inspección Rutinaria' });
                                                setShowFicha(false);
                                                setShowChecklist(true);
                                            }}
                                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                                        >
                                            <ClipboardCheck size={16} /> Iniciar Checklist Vehicular
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODAL: ASIGNAR VEHÍCULO ───────────────────────────────────────── */}
            {showAsignarVehiculo && tecnicoParaAsignar && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[4000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
                        <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-7 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tight">Asignar Vehículo</h2>
                                    <p className="text-sky-200 text-xs font-bold uppercase italic mt-1">
                                        Para: {tecnicoParaAsignar.nombre}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowAsignarVehiculo(false)}
                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="p-7 space-y-5">
                            {vehiculosDisponibles.length === 0 ? (
                                <div className="text-center py-10 space-y-3">
                                    <Truck size={40} className="text-slate-200 mx-auto" />
                                    <p className="text-slate-400 font-black uppercase italic text-xs tracking-widest">
                                        No hay vehículos disponibles en este momento
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                                        Selecciona una patente disponible
                                    </p>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {vehiculosDisponibles.map(v => (
                                            <button
                                                key={v._id}
                                                onClick={() => setVehiculoSeleccionado(v)}
                                                className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${vehiculoSeleccionado?._id === v._id
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-200'
                                                        : 'bg-slate-50 border-slate-100 hover:border-blue-200'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`px-3 py-1.5 rounded-xl font-mono font-black text-sm uppercase ${vehiculoSeleccionado?._id === v._id ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
                                                        }`}>
                                                        {v.patente}
                                                    </div>
                                                    <div>
                                                        <p className={`text-xs font-black uppercase ${vehiculoSeleccionado?._id === v._id ? 'text-white' : 'text-slate-700'}`}>
                                                            {v.marca} {v.modelo}
                                                        </p>
                                                        <p className={`text-[9px] font-bold uppercase ${vehiculoSeleccionado?._id === v._id ? 'text-blue-200' : 'text-slate-400'}`}>
                                                            {v.anio}
                                                        </p>
                                                    </div>
                                                </div>
                                                {vehiculoSeleccionado?._id === v._id && <CheckCircle2 size={18} />}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowAsignarVehiculo(false)}
                                            className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={handleConfirmarAsignacion}
                                            disabled={!vehiculoSeleccionado || asignandoVehiculo}
                                            className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-40 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2"
                                        >
                                            {asignandoVehiculo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                            Confirmar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* showChecklist && !selectedTecnico && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-6">
                    <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm text-center space-y-6 border border-slate-50">
                        <div className="p-6 bg-amber-100 text-amber-600 rounded-[2rem] w-fit mx-auto border-4 border-white shadow-lg">
                            <AlertCircle size={48} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Acción Requerida</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase leading-relaxed">
                            Debes seleccionar un técnico de la lista lateral <span className="text-blue-600">(Equipo Seleccionado)</span> antes de iniciar el checklist vehicular.
                        </p>
                        <button
                            onClick={() => setShowChecklist(false)}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                        >
                            Cerrar y elegir técnico
                        </button>
                    </div>
                </div>
            ) */}
            {/* MODALES DESLIZANTES FLOTA (ALINEACIÓN) */}
            {activePanelFlota === 'ficha' && (
                <SlideOverFicha vehiculo={selectedVehiculo} tecnicos={tecnicosGlobal} onClose={closePanelFlota} onSuccess={handleSuccessFlota} />
            )}
            {activePanelFlota === 'checklist' && (
                <SlideOverChecklist vehiculo={selectedVehiculo} tecnicos={tecnicosGlobal} tipo={checklistTipo} onClose={closePanelFlota} onSuccess={handleSuccessFlota} />
            )}
            {activePanelFlota === 'siniestro' && (
                <SlideOverSiniestros vehiculo={selectedVehiculo} tecnicos={tecnicosGlobal} onClose={closePanelFlota} onSuccess={handleSuccessFlota} />
            )}
            {activePanelFlota === 'historial' && (
                <SlideOverHistorial vehiculo={selectedVehiculo} onClose={closePanelFlota} />
            )}
            {activePanelFlota === 'documento' && (
                <SlideOverDocumentoPdf documento={selectedDocumento} vehiculo={selectedVehiculo} onClose={closePanelFlota} />
            )}

            {/* ── MODALES CUSTOM: TOAST, PROMPT Y CONFIRM ──────────────────────── */}
            
            {/* Toast Notification Component */}
            {notification && (
                <div className="fixed bottom-5 right-5 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl backdrop-blur-md border ${
                        notification.type === 'success' ? 'bg-emerald-500/95 border-emerald-400 text-white shadow-emerald-100/50' :
                        notification.type === 'error' ? 'bg-rose-500/95 border-rose-400 text-white shadow-rose-100/50' :
                        'bg-slate-900/95 border-slate-800 text-white'
                    }`}>
                        {notification.type === 'success' && <CheckCircle2 size={18} className="text-white shrink-0" />}
                        {notification.type === 'error' && <AlertCircle size={18} className="text-white shrink-0" />}
                        {notification.type === 'info' && <Info size={18} className="text-white shrink-0" />}
                        <span className="text-xs font-black uppercase tracking-wide">{notification.message}</span>
                        <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* PromptModal Component */}
            {promptModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-2">{promptModal.title}</h3>
                        {promptModal.subtitle && <p className="text-xs font-bold text-slate-400 uppercase italic mb-4">{promptModal.subtitle}</p>}
                        <input
                            type="text"
                            placeholder={promptModal.placeholder || "Escribe aquí..."}
                            defaultValue={promptModal.defaultValue || ""}
                            id="custom-prompt-input"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all mb-6"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const inputVal = document.getElementById('custom-prompt-input')?.value || '';
                                    if (promptModal.required && !inputVal.trim()) {
                                        showToast('Este campo es requerido', 'error');
                                        return;
                                    }
                                    promptModal.onConfirm(inputVal);
                                    setPromptModal(null);
                                }
                            }}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (promptModal.onCancel) promptModal.onCancel();
                                    setPromptModal(null);
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const inputVal = document.getElementById('custom-prompt-input')?.value || '';
                                    if (promptModal.required && !inputVal.trim()) {
                                        showToast('Este campo es requerido', 'error');
                                        return;
                                    }
                                    promptModal.onConfirm(inputVal);
                                    setPromptModal(null);
                                }}
                                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 transition-all"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ConfirmModal Component */}
            {confirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 text-center">
                        <div className="p-4 bg-rose-50 text-rose-500 rounded-[2rem] w-fit mx-auto mb-6">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">{confirmModal.title}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase italic mb-6 leading-relaxed">
                            {confirmModal.message}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (confirmModal.onCancel) confirmModal.onCancel();
                                    setConfirmModal(null);
                                }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(null);
                                }}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-100 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default PortalSupervision;
