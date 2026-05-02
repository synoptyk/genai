import React, { useState, useEffect, useRef, useCallback } from 'react';
import telecomApi from './telecomApi';
import { bonosConfigApi } from '../rrhh/rrhhApi';
import * as XLSX from 'xlsx';
import { useAuth } from '../auth/AuthContext';
import {
    UserCog, Users, Search, Edit3, Trash2, LayoutGrid, List, FileDown,
    Car, Unlink, AlertTriangle, RefreshCw,
    FileText, Ban, Upload,
    Briefcase, DollarSign, User,
    Award, X, Plus, AlertCircle, LogOut,
    Phone, Mail, MessageSquare, Gauge, ShieldCheck, MapPinned, MoreVertical,
    CalendarCheck, UserCheck2, ClipboardPlus, Handshake, ExternalLink, Lock,
    Zap, TrendingUp, BarChart2, Activity, Star, Calendar
} from 'lucide-react';
import { formatRut, cleanRut } from '../../utils/rutUtils';

const Dotacion = () => {
    const { user } = useAuth();
    // --- ESTADOS ---
    const [personal, setPersonal] = useState([]);
    const [bonosMaster, setBonosMaster] = useState([]);

    // Helper Avatar
    const getAvatar = (p) => {
        if (p.rrhh?.profilePic) return p.rrhh.profilePic;
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(p.nombre)}&background=random&color=fff&bold=true`;
    };
    const [stats, setStats] = useState({ total: 0, conMovil: 0, sinMovil: 0, alertas: 0 });
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Contexto de Visión
    const isSupervisor = ['supervisor', 'supervisor_hse'].includes(user?.role?.toLowerCase());
    const isHighLevel = ['system_admin', 'ceo', 'ceo_genai', 'gerencia', 'admin', 'rrhh_admin'].includes(user?.role?.toLowerCase());

    // UI
    const [viewMode, setViewMode] = useState('grid');
    const [filtro, setFiltro] = useState('');

    // Modal de Gestión Operativa
    const [modalOpen, setModalOpen] = useState(false);
    const [editData, setEditData] = useState(null);
    const [activeTab, setActiveTab] = useState('operativa'); 
    const [cargaTemp, setCargaTemp] = useState({ rut: '', nombre: '', parentesco: '' });

    // Producción
    const [produccion, setProduccion] = useState(null);
    const [loadingProduccion, setLoadingProduccion] = useState(false);
    const [filtroProdDesde, setFiltroProdDesde] = useState('');
    const [filtroProdHasta, setFiltroProdHasta] = useState('');

    // --- DOMINIO DE DATOS ---
    const CONTRATOS = ["INDEFINIDO", "PLAZO FIJO", "POR OBRA O FAENA", "HONORARIOS"];
    const ESTADO_CIVIL = ["SOLTERO/A", "CASADO/A", "DIVORCIADO/A", "VIUDO/A"];
    const BANCOS = ["BANCO ESTADO", "BANCO SANTANDER", "BANCO DE CHILE", "BANCO BCI", "BANCO ITAU", "SCOTIABANK", "BANCO FALABELLA", "OTRO"];
    const TIPOS_CUENTA = ["CUENTA RUT", "CUENTA CORRIENTE", "CUENTA VISTA", "CUENTA DE AHORRO"];
    const ISAPRES = ["FONASA", "COLMENA", "CONSALUD", "CRUZ BLANCA", "HABITAT", "NUEVA MASVIDA", "BANMEDICA"];
    const AFPS = ["PROVIDA", "HABITAT", "CAPITAL", "CUPRUM", "MODELO", "PLANVITAL", "UNO"];
    const BONOS = ["NINGUNO", "BONO FIJO", "BONO POR METAS", "BONO MIXTO"];

    // --- CARGA DE DATOS (CON FILTRO DE SUPERVISOR SI ES NECESARIO) ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const userId = user?._id || user?.id; // Robustez para ambos formatos de ID
            
            // Si es supervisor y NO tiene roles de alto nivel, solo cargamos SU dotación vinculada
            const endpoint = (isSupervisor && !isHighLevel) 
                ? `/tecnicos/supervisor/${userId}` 
                : '/tecnicos';
            
            const [resPersonal, resFlota, resBonos] = await Promise.all([
                telecomApi.get(endpoint),
                telecomApi.get('/vehiculos'),
                bonosConfigApi.getAll().catch(() => ({ data: [] }))
            ]);

            const flotaDB = resFlota.data;
            setBonosMaster(resBonos.data || []);
            let contadorMovil = 0;
            let contadorAlertas = 0;

            const dataUnificada = resPersonal.data.map(persona => {
                const vehiculoAsignado = flotaDB.find(v =>
                    (v.asignadoA && v.asignadoA._id === persona._id) ||
                    (v.asignadoA && v.asignadoA.rut === persona.rut)
                );

                if (vehiculoAsignado) contadorMovil++;

                let estadoIntegridad = 'OK';
                if (persona.cargo?.toUpperCase().includes('TECNICO') && !vehiculoAsignado && persona.estadoActual === 'OPERATIVO') {
                    estadoIntegridad = 'WARNING_SIN_MOVIL';
                    contadorAlertas++;
                }

                return {
                    ...persona,
                    flota: vehiculoAsignado ? {
                        patente: vehiculoAsignado.patente,
                        modelo: `${vehiculoAsignado.marca} ${vehiculoAsignado.modelo}`,
                        estado: vehiculoAsignado.estadoOperativo,
                        idVehiculo: vehiculoAsignado._id,
                        vinculado: true
                    } : { vinculado: false },
                    integridad: estadoIntegridad
                };
            });

            setPersonal(dataUnificada);
            setStats({
                total: dataUnificada.filter(p => p.estadoActual !== 'FINIQUITADO').length,
                conMovil: contadorMovil,
                sinMovil: dataUnificada.filter(p => p.estadoActual !== 'FINIQUITADO').length - contadorMovil,
                alertas: contadorAlertas
            });

        } catch (e) {
            console.error("Error sincronización:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // --- ACCIONES ACTUALIZADAS ---
    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            if (editData.estadoActual === 'FINIQUITADO' && !editData.fechaFiniquito) {
                return alert("Debe indicar Fecha de Finiquito para desvincular.");
            }
            await telecomApi.post('/tecnicos', editData);
            alert("Gestión operativa actualizada correctamente");
            setModalOpen(false);
            fetchData();
        } catch (e) { alert("Error al actualizar: " + (e.response?.data?.error || e.message)); }
    };

    const handleCargaAdd = () => {
        if (!cargaTemp.rut || !cargaTemp.nombre) return alert("Complete los datos de la carga");
        const list = [...(editData.listaCargas || []), cargaTemp];
        setEditData({ ...editData, listaCargas: list, tieneCargas: 'SI' });
        setCargaTemp({ rut: '', nombre: '', parentesco: '' });
    };

    const handleCargaRemove = (index) => {
        const list = (editData.listaCargas || []).filter((_, i) => i !== index);
        setEditData({ ...editData, listaCargas: list, tieneCargas: list.length > 0 ? 'SI' : 'NO' });
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const headers = rawData[0].map(h => (h || '').toString().trim().toUpperCase());
                const rows = rawData.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((h, i) => { obj[h] = row[i]; });
                    return obj;
                });

                const tecnicosImportados = rows.filter(r => r["RUT"]).map(row => ({
                    rut: cleanRut(row["RUT"]),
                    nombre: row["NOMBRE COMPLETO"] || row["NOMBRE"] || `${row["NOMBRES"] || ''} ${row["APELLIDOS"] || ''}`.trim(),
                    cargo: row["CARGO"] || 'TECNICO',
                    area: row["AREA"],
                    mandantePrincipal: row["MANDANTE"],
                    ceco: row["CECO"],
                    estadoActual: (row["ESTADO"] || 'OPERATIVO').toUpperCase()
                }));

                await telecomApi.post('/tecnicos/bulk', { tecnicos: tecnicosImportados });
                alert(`✅ Sync completado: ${tecnicosImportados.length} procesados.`);
                fetchData();
            } catch (err) { alert("Error procesando archivo"); }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const exportarExcel = () => {
        const dataExport = dataFiltrada.map(p => ({
            ESTADO: p.estadoActual,
            RUT: p.rut,
            NOMBRE: `${p.nombre} ${p.apellidos || ''}`,
            CARGO: p.cargo,
            AREA: p.area,
            VEHICULO: p.flota.vinculado ? p.flota.patente : 'S/A'
        }));
        const ws = XLSX.utils.json_to_sheet(dataExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Dotacion");
        XLSX.writeFile(wb, "Dotacion_Supervisada.xlsx");
    };

    // --- CONSTANTES DE NEGOCIO ---
    const ESTADOS = [
        { id: 'OPERATIVO', label: 'Operativo', color: 'emerald', icon: ShieldCheck },
        { id: 'VACACIONES', label: 'Vacaciones', color: 'blue', icon: CalendarCheck },
        { id: 'LICENCIA MEDICA', label: 'Licencia Médica', color: 'amber', icon: AlertCircle },
        { id: 'PERMISO CON GOCE', label: 'Permiso c/Goce', color: 'indigo', icon: UserCheck2 },
        { id: 'PERMISO SIN GOCE', label: 'Permiso s/Goce', color: 'slate', icon: UserCog },
        { id: 'AUSENTE', label: 'Ausente', color: 'red', icon: Plus },
        { id: 'FINIQUITADO', label: 'Finiquitado', color: 'gray', icon: LogOut }
    ];

    const MANDANTES = ["TIGO", "MOVISTAR", "ENTEL", "CLARO", "WOM", "VTR", "INTERNO"];

    // --- ACCIONES DE UI ---
    const fetchProduccion = useCallback(async (tecnicoId, desde = '', hasta = '') => {
        if (!tecnicoId) return;
        setLoadingProduccion(true);
        setProduccion(null);
        try {
            const params = {};
            if (desde) params.desde = desde;
            if (hasta) params.hasta = hasta;
            const res = await telecomApi.get(`/tecnicos/${tecnicoId}/produccion`, { params });
            setProduccion(res.data);
        } catch (e) {
            console.error('Error cargando producción:', e);
            setProduccion({
                error: true,
                message: e?.response?.data?.message || e?.response?.data?.error || 'No fue posible cargar la producción.'
            });
        } finally {
            setLoadingProduccion(false);
        }
    }, []);

    const handleEdit = (persona) => {
        setEditData({ ...persona, listaCargas: persona.listaCargas || [] });
        setModalOpen(true);
        setActiveTab('contractual');
        setProduccion(null);
        setFiltroProdDesde('');
        setFiltroProdHasta('');
    };

    const handleWhatsApp = (tel) => {
        if (!tel) return;
        const cleanTel = tel.toString().replace(/\+/g, '').replace(/\s/g, '');
        window.open(`https://wa.me/${cleanTel}`, '_blank');
    };

    // --- UI HELPERS ---
    const KpiCard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="bg-white/70 backdrop-blur-md p-5 rounded-[2rem] border border-white/40 shadow-xl shadow-slate-200/50 flex items-center gap-5 transition-all hover:scale-[1.02] active:scale-[0.98]">
            <div className={`p-4 rounded-2xl bg-${color}-500/10 text-${color}-600`}>
                <Icon size={28} />
            </div>
            <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">{title}</p>
                <h3 className="text-3xl font-black text-slate-800 leading-tight">{value}</h3>
                {subtext && <p className="text-[10px] text-slate-400 font-bold opacity-70 italic">~ {subtext}</p>}
            </div>
        </div>
    );

    const StatusBadge = ({ status }) => {
        const config = ESTADOS.find(e => e.id === status) || ESTADOS[0];
        const Icon = config.icon;
        return (
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-${config.color}-50 text-${config.color}-700 border border-${config.color}-200/50 shadow-sm`}>
                <Icon size={12} strokeWidth={3} />
                {config.label}
            </span>
        );
    };

    const dataFiltrada = personal.filter(p => {
        const term = filtro.toLowerCase();
        return (
            p.nombre?.toLowerCase().includes(term) ||
            p.apellidos?.toLowerCase().includes(term) ||
            p.rut?.toLowerCase().includes(term) ||
            (p.flota?.patente && p.flota.patente.toLowerCase().includes(term))
        );
    });

    return (
        <div className="page-sm animate-in fade-in duration-700 max-w-full mx-auto pb-8 sm:pb-10">

            {/* HEADER DESIGN */}
            <div className="relative mb-8 sm:mb-12">
                <div className="page-header flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6">
                    <div>
                                <div className="flex items-center gap-3 sm:gap-4 mb-2">
                                      <div className="p-2.5 sm:p-3 bg-blue-600 rounded-xl sm:rounded-2xl shadow-xl shadow-blue-500/40 text-white">
                                          <Users size={26} strokeWidth={2.5} />
                             </div>
                             <div>
                                          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none">
                                    Consola de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Dotación</span>
                                </h1>
                                <p className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase mt-2 ml-1">
                                    {isSupervisor ? `GESTIÓN DE EQUIPO: ${user.name}` : 'PANEL MAESTRO DE RECURSOS OPERATIVOS'}
                                </p>
                             </div>
                        </div>
                    </div>
                    
                    <div className="page-header-actions flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
                        <button onClick={exportarExcel} className="p-3 bg-white border-2 border-slate-100 text-slate-400 rounded-xl sm:rounded-2xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-lg shadow-slate-200/30 active:scale-95">
                            <FileDown size={22} />
                        </button>
                        {isHighLevel && (
                             <button onClick={() => fileInputRef.current.click()} className="group bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] uppercase flex items-center justify-center gap-2 sm:gap-3 hover:translate-y-[-2px] hover:shadow-2xl hover:shadow-slate-500/30 transition-all w-full sm:w-auto">
                                <Upload size={18} /> Sincronizar Maestro (Excel)
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".xlsx" />
                             </button>
                        )}
                        <button onClick={fetchData} className="p-3 bg-white border-2 border-slate-100 text-slate-400 rounded-xl sm:rounded-2xl hover:text-blue-600 hover:border-blue-200 transition-all shadow-lg shadow-slate-200/30 active:scale-95">
                            <RefreshCw size={22} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mt-6 sm:mt-10">
                    <KpiCard title="Mi Equipo" value={stats.total} icon={UserCheck2} color="blue" subtext="Colaboradores asignados" />
                    <KpiCard title="Operatividad" value={personal.filter(p => p.estadoActual === 'OPERATIVO').length} icon={Gauge} color="emerald" subtext="Disponibles en terreno" />
                    <KpiCard title="Con Móvil" value={stats.conMovil} icon={Car} color="indigo" subtext="Soporte logístico OK" />
                    <KpiCard title="Alertas" value={stats.alertas} icon={AlertTriangle} color="rose" subtext="Requerimientos críticos" />
                </div>
            </div>

            {/* CONTROLES AVANZADOS */}
            <div className="filter-bar flex flex-col lg:flex-row justify-between items-center mb-6 sm:mb-8 gap-3 sm:gap-4 px-0 sm:px-2">
                <div className="relative w-full lg:max-w-2xl group filter-bar-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Filtrar por Técnico, RUT, Móvil o Área..."
                        className="w-full pl-11 pr-4 sm:pr-6 py-4 sm:py-5 rounded-[1rem] sm:rounded-[1.5rem] text-sm font-bold text-slate-700 bg-white border-2 border-slate-100 shadow-xl shadow-slate-100/50 outline-none focus:border-blue-500 focus:ring-4 sm:focus:ring-8 focus:ring-blue-500/5 transition-all"
                        value={filtro}
                        onChange={e => setFiltro(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 sm:gap-4 bg-white/50 p-2 rounded-2xl sm:rounded-3xl border border-white/60 w-full lg:w-auto justify-between lg:justify-start">
                    <div className="flex bg-slate-200/50 p-1 rounded-2xl">
                        <button onClick={() => setViewMode('grid')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase ${viewMode === 'grid' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                            <LayoutGrid size={16} /> Grid
                        </button>
                        <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-black text-[10px] uppercase ${viewMode === 'list' ? 'bg-white shadow-xl text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                            <List size={16} /> Lista
                        </button>
                    </div>
                </div>
            </div>

            {/* VISTA COMANDANTE (GRID) */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-8">
                    {dataFiltrada.map(p => (
                        <div key={p._id} className="relative group perspective">
                            <div className={`bg-white rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden shadow-2xl hover:shadow-blue-500/10 ${p.estadoActual === 'FINIQUITADO' ? 'opacity-60 grayscale border-slate-100' : 'border-slate-50 hover:border-blue-200'}`}>
                                
                                {/* CARD TOP: AVATAR & QUICK STATS */}
                                <div className="p-6 pb-0 flex justify-between items-start">
                                    <div className="relative">
                                        <div className="w-20 h-20 rounded-[2rem] overflow-hidden border-4 border-slate-50 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                            <img src={getAvatar(p)} alt={p.nombre} className="w-full h-full object-cover" />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-lg border-4 border-white flex items-center justify-center text-white shadow-lg ${p.estadoActual === 'OPERATIVO' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                            <UserCheck2 size={12} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <StatusBadge status={p.estadoActual} />
                                        {p.idRecursoToa && (
                                            <span className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white rounded-lg text-[8px] font-black tracking-tighter">
                                                <Zap size={8} /> TOA: {p.idRecursoToa}
                                            </span>
                                        )}
                                        {p.mandantePrincipal && (
                                            <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter">
                                                {p.mandantePrincipal}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* CARD INFO */}
                                <div className="p-6">
                                    <div className="mb-4">
                                        <h4 className="text-lg font-black text-slate-800 leading-tight uppercase group-hover:text-blue-600 transition-colors truncate">
                                            {p.nombre} {p.apellidos}
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">
                                            {formatRut(p.rut)} • {p.cargo}
                                        </p>
                                    </div>

                                    {/* OPERATIONAL META */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className={`flex flex-col p-3 rounded-2xl border ${p.flota.vinculado ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Vehículo</span>
                                            <div className="flex items-center gap-2">
                                                <Car size={14} className={p.flota.vinculado ? 'text-indigo-600' : 'text-slate-300'} />
                                                <span className={`text-[11px] font-black ${p.flota.vinculado ? 'text-indigo-700' : 'text-slate-400 italic'}`}>
                                                    {p.flota.vinculado ? p.flota.patente : 'S/A'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col p-3 rounded-2xl bg-blue-50/50 border border-blue-100">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Gestión</span>
                                            <div className="flex items-center gap-2">
                                                <MapPinned size={14} className="text-blue-600" />
                                                <span className="text-[11px] font-black text-blue-700 uppercase truncate">
                                                    {p.area || 'Terreno'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QUICK ACTIONS */}
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleWhatsApp(p.telefono || p.rrhh?.phone)}
                                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageSquare size={18} strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => handleEdit(p)}
                                            className="flex-[2] flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase hover:bg-blue-700 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                                        >
                                            <ClipboardPlus size={16} /> Gestión Operativa
                                        </button>
                                        <div className="relative group/menu">
                                            <button className="h-full px-3 py-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-colors">
                                                <MoreVertical size={18} />
                                            </button>
                                            <div className="absolute bottom-full right-0 mb-3 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 hidden group-hover/menu:block animate-in slide-in-from-bottom-2 z-30">
                                                <button onClick={() => window.open(p.rrhh?.cvUrl)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors">
                                                    <FileText size={14} className="text-blue-500" /> Ver Ficha RRHH
                                                </button>
                                                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors">
                                                    <ShieldCheck size={14} className="text-emerald-500" /> Auditoría EPP
                                                </button>
                                                <div className="border-t border-slate-50 my-1"></div>
                                                <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors">
                                                    <AlertTriangle size={14} /> Reportar Incidencia
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* VISTA LISTA MODERNA */
                <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-2xl overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left whitespace-nowrap">
                            <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="p-6">Información Colaborador</th>
                                    <th className="p-6 text-center">Estado Operativo</th>
                                    <th className="p-6">ID Recurso</th>
                                    <th className="p-6">Soporte Logístico</th>
                                    <th className="p-6">Área de Gestión</th>
                                    <th className="p-6 text-right">Herramientas</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {dataFiltrada.map(p => (
                                    <tr key={p._id} className="hover:bg-blue-50/30 transition-all group">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-lg group-hover:scale-110 transition-transform">
                                                    <img src={getAvatar(p)} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <h5 className="font-black text-slate-800 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                                        {p.nombre} {p.apellidos}
                                                    </h5>
                                                    <p className="text-[10px] font-bold text-slate-400 tracking-widest">{formatRut(p.rut)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-center">
                                            <div className="flex justify-center">
                                                <StatusBadge status={p.estadoActual} />
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            {p.idRecursoToa ? (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-[10px] font-black">
                                                    <Zap size={10} /> {p.idRecursoToa}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 italic">Sin configurar</span>
                                            )}
                                        </td>
                                        <td className="p-6">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Car size={14} className={p.flota.vinculado ? 'text-indigo-500' : 'text-slate-300'} />
                                                    <span className={`text-[11px] font-black ${p.flota.vinculado ? 'text-slate-700' : 'text-slate-400 italic'}`}>
                                                        {p.flota.vinculado ? p.flota.patente : 'SIN ASIGNACIÓN'}
                                                    </span>
                                                </div>
                                                {p.flota.vinculado && <span className="text-[9px] font-bold text-slate-400">{p.flota.modelo}</span>}
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                    <Briefcase size={14} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-slate-700 uppercase tracking-tighter">{p.cargo}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 leading-none">{p.area || '-'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <button onClick={() => handleWhatsApp(p.telefono)} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                                                    <Phone size={16} />
                                                </button>
                                                <button onClick={() => handleEdit(p)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/30">
                                                    Gestionar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- MODAL DE EDICIÓN COMPLETA (TABS) --- */}
            {modalOpen && editData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200 flex flex-col">

                        {/* HEADER */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl sticky top-0 bg-white z-20">
                            <div>
                                <h3 className="font-black text-slate-700 uppercase text-lg flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" /> Editar Colaborador
                                </h3>
                                <p className="text-xs text-slate-400 font-bold tracking-widest mt-1">
                                    {editData.rut} • {editData.nombre} {editData.apellidos}
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors"><Ban size={24} /></button>
                        </div>

                        {/* ALERT FOR FINIQUITADO */}
                        {editData.estadoActual === 'FINIQUITADO' && (
                            <div className="bg-red-50 border-b border-red-100 p-3 flex justify-center text-red-700 text-xs font-bold uppercase tracking-widest">
                                <AlertCircle size={14} className="mr-2" /> Colaborador Finiquitado / Inactivo
                            </div>
                        )}

                        {/* TABS */}
                        <div className="flex bg-slate-100 p-1 mx-6 mt-6 rounded-xl gap-1 shrink-0">
                            {['contractual', 'personal', !isSupervisor && 'financiero', 'produccion'].filter(Boolean).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        if (tab === 'produccion' && editData?._id && !produccion) {
                                            fetchProduccion(editData._id, filtroProdDesde, filtroProdHasta);
                                        }
                                    }}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${
                                        activeTab === tab
                                            ? tab === 'produccion' ? 'bg-orange-500 shadow-sm text-white' : 'bg-white shadow-sm text-blue-600'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab === 'contractual' && <Briefcase size={14} />}
                                    {tab === 'personal' && <User size={14} />}
                                    {tab === 'financiero' && <DollarSign size={14} />}
                                    {tab === 'produccion' && <BarChart2 size={14} />}
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* FORM BODY */}
                        <form onSubmit={handleUpdate} className="p-6 space-y-6 flex-1 overflow-y-auto">

                            {/* TAB 1: CONTRACTUAL */}
                            {activeTab === 'contractual' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">

                                    {/* STATUS SELECTOR (CRITICAL) */}
                                    <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
                                        <h4 className="text-xs font-black text-slate-600 uppercase mb-4 flex items-center gap-2"><Award size={14} /> Situación Actual</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <SelectGroup label="Estado" value={editData.estadoActual} onChange={v => setEditData({ ...editData, estadoActual: v })}>
                                                {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                                            </SelectGroup>

                                            {(['VACACIONES', 'LICENCIA MEDICA', 'PERMISO CON GOCE', 'PERMISO SIN GOCE'].includes(editData.estadoActual)) && (
                                                <>
                                                    <InputGroup label="Desde" type="date" value={editData.fechaInicioEstado} onChange={v => setEditData({ ...editData, fechaInicioEstado: v })} />
                                                    <InputGroup label="Hasta" type="date" value={editData.fechaFinEstado} onChange={v => setEditData({ ...editData, fechaFinEstado: v })} />
                                                </>
                                            )}

                                            {editData.estadoActual === 'FINIQUITADO' && (
                                                <>
                                                    <InputGroup label="Fecha Finiquito" type="date" value={editData.fechaFiniquito} onChange={v => setEditData({ ...editData, fechaFiniquito: v })} />
                                                    <InputGroup label="Motivo Salida" value={editData.motivoSalida} onChange={v => setEditData({ ...editData, motivoSalida: v })} />
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 bg-blue-50/20 p-5 rounded-2xl border border-blue-100/50 flex gap-6 items-center shadow-sm">
                                        <div className="relative group/lock">
                                            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center border-2 border-blue-100 shadow-sm transition-all group-hover/lock:scale-110">
                                                <Lock size={24} className="text-blue-500" />
                                            </div>
                                            <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-lg shadow-lg opacity-0 group-hover/lock:opacity-100 transition-opacity">
                                                <ShieldCheck size={12} />
                                            </div>
                                        </div>
                                        
                                        <div className="flex-1 space-y-4">
                                            {/* Row 1: RUT and NAME */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Identificación RUT (RRHH)</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span>{formatRut(editData.rut)}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                                <div className="flex-[2]">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Nombre Completo (RRHH)</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span className="truncate">{editData.nombre} {editData.apellidos || ''}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Row 2: CARGO and AREA */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Cargo Asignado</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span className="truncate">{editData.cargo || 'Técnico'}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Área Gestión</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span className="truncate">{editData.area || 'Operaciones'}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 3: SEDE and PROYECTO */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Sede / Región</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span className="truncate">{editData.sede || editData.rrhh?.sede || 'SIN ASIGNAR'}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest mb-1.5 block">Proyecto</label>
                                                    <div className="py-2.5 px-4 bg-white border border-blue-100 rounded-xl font-black text-slate-700 shadow-sm flex items-center justify-between text-xs">
                                                        <span className="truncate">{editData.proyecto || editData.rrhh?.projectName || 'GENERAL'}</span>
                                                        <Lock size={12} className="text-slate-300" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {!isHighLevel && (
                                        <div className="col-span-2 px-6 py-4 bg-slate-900 rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-800 rounded-lg text-white">
                                                    <AlertCircle size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-black text-white uppercase tracking-tighter">Información Maestra de RRHH</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Estos campos solo pueden ser editados por administración</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => alert(`Solicitud de Cambio: Contacte al líder de RRHH para actualizar la ficha de ${editData.nombre}`)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"
                                            >
                                                <ExternalLink size={14} /> Solicitar Revisión
                                            </button>
                                        </div>
                                    )}

                                    <div className="col-span-2 border-t border-slate-100 pt-6"></div>

                                    {/* MANDANTE & CECO (Locked for Supervisor) */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            {isSupervisor ? (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Mandante</label>
                                                    <div className="py-2.5 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 text-xs">{editData.mandantePrincipal || 'NO DEFINIDO'}</div>
                                                </div>
                                            ) : (
                                                <SelectGroup label="Mandante Principal" value={editData.mandantePrincipal} onChange={v => setEditData({ ...editData, mandantePrincipal: v })}>
                                                    <option value="">Seleccione...</option>
                                                    {MANDANTES.map(m => <option key={m} value={m}>{m}</option>)}
                                                </SelectGroup>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            {isSupervisor ? (
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Centro Costo (CECO)</label>
                                                    <div className="py-2.5 px-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-slate-600 text-xs">{editData.ceco || 'NO DEFINIDO'}</div>
                                                </div>
                                            ) : (
                                                <InputGroup label="Centro Costo (CECO)" value={editData.ceco} onChange={v => setEditData({ ...editData, ceco: v })} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2"></div>

                                    {/* TOA INFO (Operational - Editable for Supervisor) */}
                                    <div className="col-span-2 grid grid-cols-2 gap-4 bg-orange-50/30 p-4 rounded-xl border border-orange-100">
                                        <div className="col-span-2 flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-white text-[10px] font-black italic">TOA</div>
                                            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Credenciales de Despacho</span>
                                        </div>
                                        <InputGroup label="Usuario TOA" value={editData.usuarioToa} onChange={v => setEditData({ ...editData, usuarioToa: v })} />
                                        <InputGroup label="ID Recurso TOA" value={editData.idRecursoToa} onChange={v => setEditData({ ...editData, idRecursoToa: v })} />
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Información Contractual</div>

                                    {isSupervisor ? (
                                        <div className="col-span-2 grid grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Fecha Ingreso</label>
                                                <div className="py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg font-bold text-slate-600 text-[11px]">{editData.fechaIngreso ? new Date(editData.fechaIngreso).toLocaleDateString() : 'N/A'}</div>
                                            </div>
                                            <div className="space-y-1.5 col-span-2">
                                                <label className="text-[10px] uppercase font-black text-slate-400 tracking-widest block">Tipo Contrato</label>
                                                <div className="py-2 px-3 bg-slate-50 border border-slate-100 rounded-lg font-bold text-slate-600 text-[11px] uppercase">{editData.tipoContrato || 'N/A'}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <InputGroup label="Fecha Ingreso" type="date" value={editData.fechaIngreso} onChange={v => setEditData({ ...editData, fechaIngreso: v })} />
                                            <div className="flex gap-4">
                                                <SelectGroup label="Tipo Contrato" value={editData.tipoContrato} onChange={v => setEditData({ ...editData, tipoContrato: v })}>
                                                    {CONTRATOS.map(c => <option key={c} value={c}>{c}</option>)}
                                                </SelectGroup>
                                                {editData.tipoContrato === 'PLAZO FIJO' && (
                                                    <InputGroup label="Duración (Meses)" type="number" value={editData.duracionContrato} onChange={v => setEditData({ ...editData, duracionContrato: v })} />
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {/* LICENCIA DE CONDUCIR */}
                                    <div className="col-span-2 mt-4 flex items-end gap-4 p-4 border border-slate-200 rounded-xl">
                                        <div className="flex-1">
                                            <SelectGroup label="¿Requiere Conducir?" value={editData.requiereLicencia} onChange={v => setEditData({ ...editData, requiereLicencia: v })}>
                                                <option value="NO">No</option>
                                                <option value="SI">Sí</option>
                                            </SelectGroup>
                                        </div>
                                        {editData.requiereLicencia === 'SI' && (
                                            <div className="flex-1">
                                                <InputGroup label="Vencimiento Licencia" type="date" value={editData.fechaVencimientoLicencia} onChange={v => setEditData({ ...editData, fechaVencimientoLicencia: v })} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB PRODUCCIÓN */}
                            {activeTab === 'produccion' && (
                                <div className="animate-in slide-in-from-right-4 duration-300 space-y-5">
                                    {/* Filtro fechas */}
                                    <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desde</label>
                                            <input type="date" value={filtroProdDesde} onChange={e => setFiltroProdDesde(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hasta</label>
                                            <input type="date" value={filtroProdHasta} onChange={e => setFiltroProdHasta(e.target.value)}
                                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-200" />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => fetchProduccion(editData._id, filtroProdDesde, filtroProdHasta)}
                                            disabled={loadingProduccion}
                                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase flex items-center gap-2 transition-all disabled:opacity-50"
                                        >
                                            {loadingProduccion ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                                            Consultar
                                        </button>
                                    </div>

                                    {/* ID Recurso badge */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
                                        <div className="p-2 bg-orange-500 rounded-lg text-white"><Zap size={16} /></div>
                                        <div>
                                            <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">ID Recurso Vinculado</p>
                                            <p className="text-sm font-black text-orange-700">{editData.idRecursoToa || <span className="text-slate-400 italic font-normal">Sin configurar — asigna el ID en tab Contractual</span>}</p>
                                        </div>
                                    </div>

                                    {loadingProduccion && (
                                        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                                            <RefreshCw size={20} className="animate-spin" />
                                            <span className="text-sm font-bold">Cargando producción...</span>
                                        </div>
                                    )}

                                    {produccion?.sin_toa && (
                                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                                            <Zap size={40} className="text-slate-200" />
                                            <p className="font-black text-slate-500">Sin ID Recurso configurado</p>
                                            <p className="text-xs text-slate-400">Ve a la tab Contractual y asigna el ID Recurso para vincular la producción.</p>
                                        </div>
                                    )}

                                    {produccion?.error && !loadingProduccion && (
                                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-rose-500 bg-rose-50 border border-rose-200 rounded-xl">
                                            <AlertCircle size={28} />
                                            <p className="font-black">No se pudo cargar la producción</p>
                                            <p className="text-xs text-rose-400">{produccion.message}</p>
                                        </div>
                                    )}

                                    {produccion && produccion.resumen && !produccion.sin_toa && !loadingProduccion && (
                                        <>
                                            {/* KPIs */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                {[
                                                    { label: 'Actividades', value: produccion.resumen.totalActividades?.toLocaleString('es-CL'), icon: Activity, color: 'blue' },
                                                    { label: 'Puntos TOA', value: produccion.resumen.totalPuntos?.toLocaleString('es-CL'), icon: Star, color: 'amber' },
                                                    { label: 'Días trabajados', value: produccion.resumen.diasTrabajados, icon: Calendar, color: 'emerald' },
                                                    { label: 'Promedio/día', value: produccion.resumen.promedioPorDia?.toLocaleString('es-CL'), icon: TrendingUp, color: 'violet' },
                                                ].map((kpi, i) => (
                                                    <div key={i} className={`bg-${kpi.color}-50 border border-${kpi.color}-100 rounded-2xl p-4`}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <kpi.icon size={14} className={`text-${kpi.color}-500`} />
                                                            <span className={`text-[9px] font-black text-${kpi.color}-400 uppercase tracking-widest`}>{kpi.label}</span>
                                                        </div>
                                                        <p className={`text-2xl font-black text-${kpi.color}-700`}>{kpi.value ?? '—'}</p>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Ingreso total */}
                                            {produccion.resumen.totalIngreso > 0 && (
                                                <div className="flex items-center justify-between bg-emerald-900 text-white px-5 py-4 rounded-2xl">
                                                    <div>
                                                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Valorización total estimada</p>
                                                        <p className="text-2xl font-black">${produccion.resumen.totalIngreso?.toLocaleString('es-CL')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Promedio diario</p>
                                                        <p className="text-lg font-black text-emerald-400">${produccion.resumen.promedioIngresoDia?.toLocaleString('es-CL')}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Mejor día */}
                                            {produccion.mejorDia && (
                                                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                                    <Star size={18} className="text-amber-500" />
                                                    <div>
                                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Mejor día registrado</p>
                                                        <p className="text-sm font-black text-amber-800">{produccion.mejorDia._id} — <span>{produccion.mejorDia.puntos?.toLocaleString('es-CL')} pts</span> · {produccion.mejorDia.actividades} actividades</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Historial reciente */}
                                            {produccion.recientes?.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Últimas actividades registradas</p>
                                                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                        {produccion.recientes.map((act, i) => (
                                                            <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                                                                <div>
                                                                    <p className="text-[11px] font-black text-slate-700">{act.Actividad || act.actividad || 'Actividad'}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400">
                                                                        {act.Subtipo_de_Actividad && `${act.Subtipo_de_Actividad} · `}
                                                                        {act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : '—'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-right">
                                                                    {(act.PTS_TOTAL_BAREMO || act.puntos) > 0 && (
                                                                        <span className="text-xs font-black text-amber-600">{(act.PTS_TOTAL_BAREMO || act.puntos)?.toLocaleString('es-CL')} pts</span>
                                                                    )}
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                                        (act.Estado || act.Estado_Actividad || '').toLowerCase().includes('complet') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                                                    }`}>{act.Estado || act.Estado_Actividad || '—'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sin actividades */}
                                            {produccion.resumen.totalActividades === 0 && (
                                                <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
                                                    <BarChart2 size={36} className="text-slate-200" />
                                                    <p className="font-black text-slate-500">Sin actividades en el período</p>
                                                    <p className="text-xs">Ajusta las fechas o verifica que el ID Recurso sea correcto.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: PERSONAL */}
                            {activeTab === 'personal' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                                    <InputGroup label="Fecha Nacimiento" type="date" value={editData.fechaNacimiento} onChange={v => setEditData({ ...editData, fechaNacimiento: v })} />
                                    <InputGroup label="Nacionalidad" value={editData.nacionalidad} onChange={v => setEditData({ ...editData, nacionalidad: v })} />

                                    <SelectGroup label="Estado Civil" value={editData.estadoCivil} onChange={v => setEditData({ ...editData, estadoCivil: v })}>
                                        <option value="">Seleccione...</option>
                                        {ESTADO_CIVIL.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                                    </SelectGroup>

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2"></div>

                                    <InputGroup label="Email" type="email" value={editData.email} onChange={v => setEditData({ ...editData, email: v })} />
                                    <InputGroup label="Teléfono" type="tel" value={editData.telefono} onChange={v => setEditData({ ...editData, telefono: v })} />

                                    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase mb-4">Domicilio</h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-2"><InputGroup label="Calle" value={editData.calle} onChange={v => setEditData({ ...editData, calle: v })} /></div>
                                            <InputGroup label="Número" value={editData.numero} onChange={v => setEditData({ ...editData, numero: v })} />
                                            <InputGroup label="Depto/Block" value={editData.deptoBlock} onChange={v => setEditData({ ...editData, deptoBlock: v })} />
                                            <InputGroup label="Comuna" value={editData.comuna} onChange={v => setEditData({ ...editData, comuna: v })} />
                                            <InputGroup label="Region" value={editData.region} onChange={v => setEditData({ ...editData, region: v })} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: FINANCIERO (Solo Admin/RRHH) */}
                            {activeTab === 'financiero' && !isSupervisor && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="col-span-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                        <h4 className="text-xs font-black text-emerald-600 uppercase mb-4 flex items-center gap-2"><DollarSign size={14} /> Datos Bancarios</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <SelectGroup label="Banco" value={editData.banco} onChange={v => setEditData({ ...editData, banco: v })}>
                                                <option value="">Seleccione...</option>
                                                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </SelectGroup>
                                            <SelectGroup label="Tipo Cuenta" value={editData.tipoCuenta} onChange={v => setEditData({ ...editData, tipoCuenta: v })}>
                                                <option value="">Seleccione...</option>
                                                {TIPOS_CUENTA.map(t => <option key={t} value={t}>{t}</option>)}
                                            </SelectGroup>
                                            <div className="col-span-2">
                                                <InputGroup label="Número de Cuenta" value={editData.numeroCuenta} onChange={v => setEditData({ ...editData, numeroCuenta: v })} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* PREVISION */}
                                    <div className="col-span-2 grid grid-cols-2 gap-6 border-t border-slate-100 pt-4">
                                        <SelectGroup label="Sistema Salud" value={editData.previsionSalud} onChange={v => setEditData({ ...editData, previsionSalud: v })}>
                                            <option value="FONASA">FONASA</option>
                                            <option value="ISAPRE">ISAPRE</option>
                                        </SelectGroup>

                                        {editData.previsionSalud === 'ISAPRE' && (
                                            <>
                                                <SelectGroup label="Nombre Isapre" value={editData.isapreNombre} onChange={v => setEditData({ ...editData, isapreNombre: v })}>
                                                    <option value="">Seleccione...</option>
                                                    {ISAPRES.filter(i => i !== 'FONASA').map(i => <option key={i} value={i}>{i}</option>)}
                                                </SelectGroup>
                                                <div className="flex gap-2">
                                                    <InputGroup label="Valor Plan" type="number" value={editData.valorPlan} onChange={v => setEditData({ ...editData, valorPlan: v })} />
                                                    <div className="w-24">
                                                        <SelectGroup label="Moneda" value={editData.monedaPlan} onChange={v => setEditData({ ...editData, monedaPlan: v })}>
                                                            <option value="UF">UF</option>
                                                            <option value="CLP">$</option>
                                                        </SelectGroup>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        <SelectGroup label="AFP" value={editData.afp} onChange={v => setEditData({ ...editData, afp: v })}>
                                            <option value="">Seleccione...</option>
                                            {AFPS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </SelectGroup>

                                        <SelectGroup label="Pensionado" value={editData.pensionado} onChange={v => setEditData({ ...editData, pensionado: v })}>
                                            <option value="NO">No</option>
                                            <option value="SI">Sí</option>
                                        </SelectGroup>
                                    </div>

                                    {/* CARGAS */}
                                    <div className="col-span-2 border-t border-slate-100 pt-4 pb-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                                                <Users size={14} /> Cargas Familiares
                                            </h4>
                                            <SelectGroup label="¿Tiene Cargas?" value={editData.tieneCargas} onChange={v => setEditData({ ...editData, tieneCargas: v })}>
                                                <option value="NO">No</option>
                                                <option value="SI">Sí</option>
                                            </SelectGroup>
                                        </div>

                                        {editData.tieneCargas === 'SI' && (
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                                <div className="flex gap-2 items-end mb-4">
                                                    <InputGroup label="RUT Carga" value={cargaTemp.rut} onChange={v => setCargaTemp({ ...cargaTemp, rut: formatRut(v) })} />
                                                    <InputGroup label="Nombre" value={cargaTemp.nombre} onChange={v => setCargaTemp({ ...cargaTemp, nombre: v })} />
                                                    <InputGroup label="Parentesco" value={cargaTemp.parentesco} onChange={v => setCargaTemp({ ...cargaTemp, parentesco: v })} />
                                                    <button type="button" onClick={handleCargaAdd} className="bg-blue-500 text-white p-2.5 rounded-lg mb-[1px]"><Plus size={16} /></button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {editData.listaCargas?.map((c, i) => (
                                                        <div key={i} className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm text-xs">
                                                            <span className="font-bold">{c.nombre}</span> <span className="text-slate-400">({c.parentesco})</span>
                                                            <button type="button" onClick={() => handleCargaRemove(i)} className="text-red-400"><X size={12} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 border-t border-slate-100 pt-6 mt-2">
                                        <InputGroup label="Sueldo Base Mensual" type="number" value={editData.sueldoBase} onChange={v => setEditData({ ...editData, sueldoBase: v })} />

                                        <div className="mt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <Award size={14} className="text-blue-600" /> Bonificaciones Unificadas (v5.0)
                                                </h4>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const bonoId = window.prompt("Ingrese ID del Bono (Pronto: Selector Visual) o seleccione del catálogo maestro.");
                                                        if (bonoId) setEditData({ ...editData, bonosConfig: [...(editData.bonosConfig || []), bonoId] });
                                                    }}
                                                    className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                                                >
                                                    + Vincular Bono Maestro
                                                </button>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 gap-2">
                                                {/* LISTA DE BONOS ACTIVOS */}
                                                {(editData.bonosConfig || []).map((b) => {
                                                    const master = typeof b === 'object' ? b : bonosMaster.find(m => m._id === b);
                                                    if (!master) return null;
                                                    return (
                                                        <div key={master._id} className="flex items-center justify-between p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50 group/bono">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 border border-blue-100">
                                                                    <Award size={16} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[11px] font-black text-slate-700 uppercase">{master.nombre}</p>
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{master.strategy} · {master.codigoDT || '1040'}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="text-xs font-black text-blue-700">
                                                                    {master.strategy === 'FIJO' ? `$${(master.valorPorDefecto || 0).toLocaleString('es-CL')}` : 'Variable'}
                                                                </span>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setEditData({ ...editData, bonosConfig: editData.bonosConfig.filter(id => (typeof id === 'string' ? id : id._id) !== master._id) })}
                                                                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {(!editData.bonosConfig || editData.bonosConfig.length === 0) && (
                                                    <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">Sin bonificaciones inteligentes asignadas</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* LEGACY FALLBACK */}
                                            {editData.tipoBonificacion && editData.tipoBonificacion !== 'NINGUNO' && (
                                                <div className="mt-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                                                    <p className="text-[9px] font-black text-orange-400 uppercase mb-2">Configuración Legacy (Detectada)</p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-slate-600">{editData.tipoBonificacion}</span>
                                                        <span className="text-xs font-black text-orange-600">${(editData.montoBonoFijo || 0).toLocaleString('es-CL')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between pt-4 border-t border-slate-100 mt-4 sticky bottom-0 bg-white pb-2">
                                {/* FINIQUITAR ACTION */}
                                {editData.estadoActual !== 'FINIQUITADO' && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm("¿Iniciar proceso de Finiquito?")) {
                                                setEditData({ ...editData, estadoActual: 'FINIQUITADO', activeTab: 'contractual' });
                                                setActiveTab('contractual');
                                            }
                                        }}
                                        className="text-red-500 font-bold text-xs uppercase flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
                                    >
                                        <LogOut size={16} /> Finiquitar
                                    </button>
                                )}

                                <button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/20 transition-all transform hover:scale-105 active:scale-95 ml-auto">
                                    Guardar Cambios Oficiales
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

// --- HELPER COMPONENTS FOR FORM ---
const InputGroup = ({ label, value, onChange, type = "text" }) => (
    <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">{label}</label>
        <input
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

const SelectGroup = ({ label, value, onChange, children }) => (
    <div className="relative group">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
        <div className="relative">
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-bold text-sm rounded-xl py-3 pl-4 pr-10 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-sm cursor-pointer"
            >
                {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
            </div>
        </div>
    </div>
);

const InfoField = ({ label, value }) => (
    <div>
        <label className="text-[9px] font-black text-blue-400 uppercase block">{label}</label>
        <div className="text-sm font-black text-blue-800">{value}</div>
    </div>
);

export default Dotacion;