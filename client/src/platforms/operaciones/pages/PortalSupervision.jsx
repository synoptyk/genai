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
    ArrowRight, ClipboardCheck, BarChart3, MessageSquare, Save, Clock, User,
    Fuel, Check, XOctagon, Info, Package, Eye, Car, Phone, Mail, FileText,
    MapPinned, Briefcase, Award, CalendarDays, PlusCircle
} from 'lucide-react';
import GestorTurnosOperaciones from '../components/GestorTurnosOperaciones';
import { formatRut, validateRut } from '../../../utils/rutUtils';
import DynamicAuditModal from '../../logistica/components/DynamicAuditModal';

const PortalSupervision = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [currentView, setCurrentView] = useState('menu'); // menu, dotacion, flotilla, inspecciones, ast, solicitudes, produccion

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

    const fetchData = async () => {
        if (!user?._id && !user?.id) return;
        const userId = user._id || user.id;
        try {
            const [resEquipo, resFlota, resAst, resProd, resSolicitudes, resChecklists] = await Promise.all([
                api.get(`/api/tecnicos/supervisor/${userId}`),
                api.get(`/api/vehiculos`),
                api.get(`/api/prevencion/ast`).catch(() => ({ data: [] })),
                api.get(`/api/produccion`).catch(() => ({ data: [] })),
                api.get(`/api/rrhh/candidatos?status=Contratado`).catch(() => ({ data: [] })),
                api.get(`/api/vehiculos/checklists/recientes`).catch(() => ({ data: [] }))
            ]);

            setMiEquipo(resEquipo.data || []);
            setFlota(resFlota.data || []);
            setAsts(resAst.data || []);
            setProduccion(resProd.data || []);
            setHistorialChecklists(resChecklists?.data || []);

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
        if (!rutInput) return;
        try {
            await api.post('/api/tecnicos/claim', {
                rut: rutInput,
                supervisorId: user._id || user.id
            });
            setRutInput('');
            fetchData();
            alert('Técnico asignado a tu equipo');
        } catch (error) {
            alert(error.response?.data?.error || 'Error al asignar');
        }
    };

    const handleUnclaim = async (id) => {
        if (!window.confirm('¿Desvincular a este técnico de tu equipo?')) return;
        try {
            await api.post('/api/tecnicos/unclaim', { id });
            fetchData();
        } catch (error) {
            alert('Error al desvincular');
        }
    };

    const handleCommentSolicitud = async (candId, vacId, comment) => {
        try {
            await api.put(`/api/rrhh/candidatos/${candId}/vacaciones/${vacId}`, {
                supervisorComment: comment
            });
            alert('Comentario enviado a RRHH/Gerencia');
        } catch (error) {
            console.error("Error al guardar comentario:", error);
            alert('Error al guardar comentario');
        }
    };

    const handleApproveVacation = async (candId, vacId, currentApprovalChain) => {
        try {
            await api.put(`/api/rrhh/candidatos/${candId}/vacaciones/${vacId}`, {
                estado: 'Aprobado',
                aprobadoPor: user.name,
                approvalChain: currentApprovalChain.map(step =>
                    step.role === user.role ? { ...step, status: 'Aprobado', approvedBy: user.name, date: new Date() } : step
                )
            });
            alert('Vacaciones aprobadas');
            fetchData(); // Refresh data to reflect the change
        } catch (error) {
            console.error("Error al aprobar vacaciones:", error);
            alert('Error al aprobar vacaciones');
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
            alert('Error cargando ficha del trabajador');
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
            alert(`Vehículo ${vehiculoSeleccionado.patente} asignado a ${tecnicoParaAsignar.nombre}`);
        } catch (err) {
            alert(err.response?.data?.error || 'Error al asignar vehículo');
        } finally {
            setAsignandoVehiculo(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (currentView === 'inspecciones') {
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
                <PrevInspecciones />
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
        <div className="max-w-[1400px] mx-auto pb-20 px-4 pt-4 animate-in fade-in duration-500">

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card
                        icon={Users}
                        title="Mi Dotación"
                        subtitle="Auto-asignación de técnicos"
                        color="bg-violet-500"
                        onClick={() => setCurrentView('dotacion')}
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
            )}

            {/* VISTA: MI DOTACIÓN */}
            {currentView === 'dotacion' && (
                <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
                        <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                            <div className="p-4 bg-violet-100 text-violet-600 rounded-[1.5rem]"><Users size={32} /></div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Vincular Personal</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase italic">Ingresa el RUT para agregar a tu equipo</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="RUT Trabajador..."
                                className={`flex-1 p-5 border rounded-[1.5rem] font-bold text-lg outline-none focus:ring-4 focus:ring-violet-500/10 transition-all uppercase ${rutInput && !validateRut(rutInput) ? 'bg-rose-50 border-rose-400 text-rose-600 focus:border-rose-500' : 'bg-slate-50 border-slate-200 focus:border-violet-400'}`}
                                value={rutInput}
                                onChange={(e) => setRutInput(formatRut(e.target.value))}
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
                                <div key={tec._id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-violet-200 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400">
                                            {tec.nombre?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 uppercase tracking-tight">{tec.nombre}</p>
                                            <p className="text-[10px] font-mono text-slate-400">{tec.rut} • {tec.cargo}</p>
                                            {tec.vehiculoAsignado && (
                                                <p className="text-[9px] font-black text-sky-500 uppercase mt-0.5">
                                                    🚗 {tec.vehiculoAsignado.patente}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpenFicha(tec._id)}
                                            className="p-3 text-violet-500 hover:bg-violet-50 rounded-xl transition-all"
                                            title="Ver Ficha Completa"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAuditTecnico(tec);
                                                setShowAuditModal(true);
                                            }}
                                            className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                            title="Auditar Inventario"
                                        >
                                            <ShieldCheck size={20} />
                                        </button>
                                        {!tec.vehiculoAsignado && (
                                            <button
                                                onClick={() => handleAbrirAsignarVehiculo(tec)}
                                                className="p-3 text-sky-500 hover:bg-sky-50 rounded-xl transition-all"
                                                title="Asignar Vehículo"
                                            >
                                                <Car size={20} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleUnclaim(tec._id)}
                                            className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X size={20} />
                                        </button>
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
            />

            {/* VISTA: MI FLOTILLA */}
            {currentView === 'flotilla' && (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* VEHÍCULOS DEL EQUIPO */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Flota de Mi Equipo</h3>
                                    <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">
                                        {(() => {
                                            const rutEquipo = miEquipo.map(t => t.rut);
                                            const miFlota = flota.filter(v => v.asignadoA && rutEquipo.includes(v.asignadoA.rut));
                                            return `${miFlota.length} vehículos asignados · ${flota.length - miFlota.length} disponibles`;
                                        })()}
                                    </p>
                                </div>
                                {!selectedTecnico && (
                                    <span className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-black uppercase">
                                        ← Selecciona técnico primero
                                    </span>
                                )}
                            </div>

                            {/* Vehículos asignados al equipo del supervisor */}
                            {(() => {
                                const rutEquipo = miEquipo.map(t => t.rut);
                                const miFlota = flota.filter(v => v.asignadoA && rutEquipo.includes(v.asignadoA.rut));
                                const disponibles = flota.filter(v => !v.asignadoA);
                                const flotaMostrar = [...miFlota, ...disponibles];

                                return flotaMostrar.length === 0 ? (
                                    <div className="p-16 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                                        <Truck size={48} className="text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-300 font-black uppercase italic text-xs tracking-widest">Sin vehículos asignados al equipo</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {miFlota.length > 0 && (
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-2 mt-2">🔗 Asignados al equipo</p>
                                        )}
                                        {miFlota.map(vehiculo => (
                                            <div key={vehiculo._id} className="bg-white p-5 rounded-[2rem] border border-indigo-100 shadow-sm flex items-center justify-between hover:border-sky-300 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-mono font-black text-sm uppercase shadow">
                                                        {vehiculo.patente}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-700 uppercase">{vehiculo.marca} {vehiculo.modelo}</p>
                                                        <p className="text-[10px] text-indigo-500 font-bold uppercase flex items-center gap-1">
                                                            <User size={10} /> {vehiculo.asignadoA?.nombre || vehiculo.asignadoA?.rut}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 items-end opacity-0 group-hover:opacity-100 transition-all">
                                                    <button
                                                        onClick={() => {
                                                            if (!selectedTecnico) return alert('Selecciona un técnico de tu equipo primero (panel derecho).');
                                                            setSelectedVehiculo({ ...vehiculo, checklistTipo: 'Asignación' });
                                                            setShowChecklist(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-indigo-200 hover:scale-105 transition-all"
                                                    >
                                                        📋 Asignación
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!selectedTecnico) return alert('Selecciona un técnico de tu equipo primero (panel derecho).');
                                                            setSelectedVehiculo({ ...vehiculo, checklistTipo: 'Devolución' });
                                                            setShowChecklist(true);
                                                        }}
                                                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-200 hover:scale-105 transition-all"
                                                    >
                                                        🏁 Devolución
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {disponibles.length > 0 && (
                                            <>
                                                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest px-2 mt-4">🅿️ Disponibles en patio</p>
                                                {disponibles.map(vehiculo => (
                                                    <div key={vehiculo._id} className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-sky-200 transition-all group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="bg-slate-600 text-white px-3 py-1.5 rounded-xl font-mono font-black text-sm uppercase">
                                                                {vehiculo.patente}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-600 uppercase">{vehiculo.marca} {vehiculo.modelo}</p>
                                                                <p className="text-[9px] text-slate-400 font-bold uppercase">Sin Asignar</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (!selectedTecnico) return alert('Selecciona un técnico de tu equipo primero (panel derecho).');
                                                                setSelectedVehiculo({ ...vehiculo, checklistTipo: 'Asignación' });
                                                                setShowChecklist(true);
                                                            }}
                                                            className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-[9px] font-black uppercase shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                                        >
                                                            📋 Asignar
                                                        </button>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* PANEL EQUIPO */}
                        <div className="bg-slate-900 rounded-[3rem] p-8 text-white space-y-6 flex flex-col justify-between">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight italic">Técnico para Checklist</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Selecciona quién firmará el acta</p>
                            </div>

                            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                                {miEquipo.map(tec => (
                                    <div
                                        key={tec._id}
                                        className={`w-full p-4 rounded-[1.5rem] border transition-all flex flex-col gap-2 ${selectedTecnico?._id === tec._id
                                            ? 'bg-blue-600 border-blue-400 shadow-2xl shadow-blue-500/20'
                                            : 'bg-slate-800 border-slate-700'
                                            }`}
                                    >
                                        <button
                                            onClick={() => setSelectedTecnico(tec)}
                                            className="w-full text-left flex items-center justify-between"
                                        >
                                            <div>
                                                <p className="text-xs font-black uppercase">{tec.nombre?.split(' ')[0]} {tec.nombre?.split(' ').pop()}</p>
                                                <p className="text-[9px] font-mono text-slate-400">{tec.rut}</p>
                                                {flota.find(v => v.asignadoA?.rut === tec.rut) && (
                                                    <p className="text-[8px] font-black text-indigo-300 uppercase mt-0.5">
                                                        🚗 {flota.find(v => v.asignadoA?.rut === tec.rut)?.patente}
                                                    </p>
                                                )}
                                            </div>
                                            {selectedTecnico?._id === tec._id && <CheckCircle2 size={18} />}
                                        </button>
                                        {(() => {
                                            const vehAsig = flota.find(v => v.asignadoA?.rut === tec.rut);
                                            if (!vehAsig) return (
                                                <button
                                                    onClick={() => handleAbrirAsignarVehiculo(tec)}
                                                    className="w-full py-1.5 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-[9px] font-black uppercase tracking-widest hover:bg-sky-500/30 transition-all flex items-center justify-center gap-1"
                                                >
                                                    <PlusCircle size={12} /> Asignar Vehículo
                                                </button>
                                            );
                                            return (
                                                <button
                                                    onClick={() => {
                                                        setSelectedTecnico(tec);
                                                        setSelectedVehiculo({ ...vehAsig, checklistTipo: 'Inspección Rutinaria' });
                                                        setShowChecklist(true);
                                                    }}
                                                    className="w-full py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/30 transition-all flex items-center justify-center gap-1"
                                                >
                                                    <ClipboardCheck size={12} /> Checklist Semanal
                                                </button>
                                            );
                                        })()}
                                    </div>
                                ))}
                                {miEquipo.length === 0 && (
                                    <p className="text-center text-slate-500 text-xs font-bold uppercase italic py-6">Sin equipo asignado</p>
                                )}
                            </div>

                            {selectedTecnico ? (
                                <div className="p-4 bg-blue-600/20 rounded-[2rem] border border-blue-500/30 flex items-center gap-3">
                                    <CheckCircle2 className="text-blue-400" size={20} />
                                    <div>
                                        <p className="text-[9px] font-black text-blue-300 uppercase">Técnico Seleccionado</p>
                                        <p className="text-sm font-black text-white uppercase">{selectedTecnico.nombre?.split(' ')[0]}</p>
                                    </div>
                                    <button onClick={() => setSelectedTecnico(null)} className="ml-auto p-1 text-slate-400 hover:text-white transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="p-5 bg-slate-800 rounded-[2rem] border border-slate-700 flex flex-col items-center gap-2 text-center">
                                    <AlertTriangle className="text-amber-500" size={24} />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase italic leading-tight">
                                        Selecciona un técnico antes de registrar el checklist.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HISTORIAL RECIENTE DE CHECKLISTS */}
                    {historialChecklists.length > 0 && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl"><ClipboardCheck size={18} /></div>
                                <div>
                                    <h4 className="font-black text-slate-800 uppercase text-sm">Historial Reciente de Checklists</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Últimos registros del equipo</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Vehículo</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">QR / ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {historialChecklists.map(c => (
                                            <tr key={c._id} className="hover:bg-slate-50 transition-all">
                                                <td className="px-6 py-4 font-black text-slate-700 font-mono uppercase tracking-wide">{c.vehiculo?.patente || '---'}</td>
                                                <td className="px-6 py-4 font-bold text-slate-600 uppercase text-[11px]">{c.tecnico?.nombre || c.tecnico?.rut || '---'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                                        c.tipo === 'Asignación' ? 'bg-indigo-50 text-indigo-700' :
                                                        c.tipo === 'Devolución' ? 'bg-emerald-50 text-emerald-700' :
                                                        'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {c.tipo}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">{new Date(c.createdAt).toLocaleString('es-CL')}</td>
                                                <td className="px-6 py-4 font-mono text-slate-400 text-[10px]">{c.qrCodeId}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VISTA: SEGUIMIENTO AST */}
            {currentView === 'ast' && (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl overflow-x-auto">
                        <h2 className="text-xl font-black text-slate-800 uppercase italic mb-6">Estado AST del Día</h2>
                        <table className="w-full">
                            <thead>
                                <tr className="text-left border-b border-slate-50">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest px-4 text-center">Técnico</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">Estado</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">Hora</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase italic tracking-widest text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {miEquipo.map(tec => {
                                    const astHoy = asts.find(a => {
                                        const today = new Date().toISOString().split('T')[0];
                                        return (a.createdAt || a.fecha)?.startsWith(today) && (a.rutTrabajador === tec.rut);
                                    });

                                    return (
                                        <tr key={tec._id} className="group hover:bg-slate-50 transition-all">
                                            <td className="py-5 px-4">
                                                <p className="text-sm font-black text-slate-700 uppercase">{tec.nombre}</p>
                                                <p className="text-[9px] font-mono text-slate-400">{tec.rut}</p>
                                            </td>
                                            <td className="py-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${astHoy ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600 animate-pulse'}`}>
                                                    {astHoy ? 'REALIZADO' : 'PENDIENTE'}
                                                </span>
                                            </td>
                                            <td className="py-5 text-center font-mono text-xs text-slate-500">
                                                {astHoy ? new Date(astHoy.createdAt || astHoy.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </td>
                                            <td className="py-5 text-center">
                                                <button className="p-2 text-slate-300 hover:text-blue-500 transition-all">
                                                    <ArrowRight size={18} />
                                                </button>
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
                <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500">
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-6 italic">Permisos del Equipo</h2>
                    <div className="grid grid-cols-1 gap-4">
                        {solicitudes.map((s, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center font-black text-lg">
                                            {s.techName?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{s.techName}</p>
                                            <p className="text-[10px] font-bold text-rose-500 uppercase italic">{s.tipo} • {s.diasHabiles} Días</p>
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
                                                const comment = document.getElementById(`comment - ${s.candId} -${s._id} `).value;
                                                handleCommentSolicitud(s.candId, s._id, comment);
                                            }}
                                            className="px-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center p-4 shadow-lg shadow-blue-200 active:scale-95"
                                        >
                                            <Save size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
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
            {currentView === 'produccion' && (
                <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-indigo-600 p-8 rounded-[3rem] text-white space-y-2 shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                            <BarChart3 size={120} className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 italic">Total OTs Equipo (Hoy)</p>
                            <div className="flex items-end gap-2 relative z-10">
                                <h4 className="text-6xl font-black">
                                    {produccion.filter(p => {
                                        const today = new Date().toISOString().split('T')[0];
                                        const tecRuts = miEquipo.map(t => t.rut);
                                        return (p.fecha)?.startsWith(today) && (p.Estado === 'Completado') && (tecRuts.includes(p.tecnicoRut || p.rut));
                                    }).length}
                                </h4>
                                <span className="text-xs font-bold mb-3 uppercase italic">Operaciones</span>
                            </div>
                        </div>

                        <div className="md:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-center gap-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase italic">Meta de Productividad</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Comparación vs Cuota Global de Equipo</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase italic">Diferencia Meta</p>
                                    <p className="text-2xl font-black text-rose-500">-{Math.max(0, (miEquipo.length * 3) - produccion.filter(p => {
                                        const today = new Date().toISOString().split('T')[0];
                                        const tecRuts = miEquipo.map(t => t.rut);
                                        return (p.fecha)?.startsWith(today) && (p.Estado === 'Completado') && (tecRuts.includes(p.tecnicoRut || p.rut));
                                    }).length)} OTs</p>
                                </div>
                            </div>
                            <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative p-1">
                                <div className="h-full bg-indigo-500 rounded-full shadow-sm transition-all duration-1500 ease-out" style={{
                                    width: `${Math.min(100, (produccion.filter(p => {
                                        const today = new Date().toISOString().split('T')[0];
                                        const tecRuts = miEquipo.map(t => t.rut);
                                        return (p.fecha)?.startsWith(today) && (p.Estado === 'Completado') && (tecRuts.includes(p.tecnicoRut || p.rut));
                                    }).length / Math.max(1, miEquipo.length * 3)) * 100) || 0
                                        }% `
                                }}></div>
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase italic tracking-widest">
                                <span>Inicio</span>
                                <span className="text-indigo-600">Rendimiento Equipo: {Math.round((produccion.filter(p => {
                                    const today = new Date().toISOString().split('T')[0];
                                    const tecRuts = miEquipo.map(t => t.rut);
                                    return (p.fecha)?.startsWith(today) && (p.Estado === 'Completado') && (tecRuts.includes(p.tecnicoRut || p.rut));
                                }).length / Math.max(1, miEquipo.length * 3)) * 100) || 0}%</span>
                                <span>{miEquipo.length * 3} OTs Meta</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

                        <div className="overflow-x-auto">
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
                                                                        const comentario = prompt("¿Algún comentario o nota para el técnico? (Opcional)");
                                                                        api.put(`/api/operaciones/combustible/${req._id}/estado`, { estado: 'Aprobado', comentarioSupervisor: comentario })
                                                                            .then(() => { alert("Aprobado"); fetchData(); });
                                                                    }}
                                                                    className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-xl shadow-emerald-200 hover:scale-110 active:scale-95 transition-all hover:bg-emerald-600"
                                                                    title="Aprobar Carga"
                                                                >
                                                                    <Check size={20} />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const comentario = prompt("Razón del rechazo:");
                                                                        api.put(`/api/operaciones/combustible/${req._id}/estado`, { estado: 'Rechazado', comentarioSupervisor: comentario })
                                                                            .then(() => { alert("Rechazado"); fetchData(); });
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
                                                                        .then(() => { alert("Confirmado"); fetchData(); });
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
                                                className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                                                    vehiculoSeleccionado?._id === v._id
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-200'
                                                        : 'bg-slate-50 border-slate-100 hover:border-blue-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`px-3 py-1.5 rounded-xl font-mono font-black text-sm uppercase ${
                                                        vehiculoSeleccionado?._id === v._id ? 'bg-white/20 text-white' : 'bg-slate-900 text-white'
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

        </div>
    );
};

export default PortalSupervision;
