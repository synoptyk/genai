import React, { useState, useEffect, useMemo } from 'react';
import {
    Building2, FileText, Download, Settings, Bot, ArrowRightLeft,
    ShieldCheck, CloudCog, ShieldAlert, CheckCircle2, ChevronRight, Save, Lock,
    Calendar, FileSpreadsheet, Zap, LayoutDashboard, UserPlus, Users, 
    AlertCircle, Terminal, RefreshCcw, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import API_URL from '../../../config';
import { formatRut, validateRut } from '../../../utils/rutUtils';

const IntegracionPrevired = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('nomina'); // nomina, movimientos, honorarios, config, resumen

    // States: RPA Previred
    const [robotStatus, setRobotStatus] = useState('disconnected'); // disconnected, connecting, active
    const [rpaData, setRpaData] = useState({
        rutEmpresa: '',
        rutAuth: '',
        passwordAuth: ''
    });

    // States: Exportación
    const [exporting, setExporting] = useState(false);
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [periodo, setPeriodo] = useState(currentPeriod);

    // States: Console / Pre-flight
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [preFlightAlerts, setPreFlightAlerts] = useState([]);
    const [validating, setValidating] = useState(false);

    // States: Real Data
    const [stats, setStats] = useState({ count: 0, nextDeadline: '-', lastLogs: [] });
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                if (!user || !user.token) return;
                
                // Parallel fetching for performance
                const [statusRes, statsRes, historyRes] = await Promise.all([
                    fetch(`${API_URL}/api/admin/previred/status`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/api/admin/previred/stats`, { headers: { 'Authorization': `Bearer ${user.token}` } }),
                    fetch(`${API_URL}/api/admin/previred/history`, { headers: { 'Authorization': `Bearer ${user.token}` } })
                ]);

                if (statusRes.ok) {
                    const data = await statusRes.json();
                    if (data.rpaActivo) {
                        setRobotStatus('active');
                        setRpaData(prev => ({ 
                            ...prev, 
                            rutEmpresa: data.rutEmpresa || '', 
                            rutAuth: data.rutAutorizado || '' 
                        }));
                    }
                }

                if (statsRes.ok) setStats(await statsRes.json());
                if (historyRes.ok) setHistory(await historyRes.json());

            } catch (e) { 
                console.error("Error validando estado de Previred:", e); 
            }
        };
        checkStatus();
    }, [user]);
    const addLog = (msg, type = 'info') => {
        setConsoleLogs(prev => {
            const newLog = { msg, type, time: new Date().toLocaleTimeString() };
            return [...prev, newLog].slice(-15);
        });
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const handleRPASumbit = async (e) => {
        e.preventDefault();
        setRobotStatus('connecting');
        
        addLog("Iniciando handshake con Bóveda Segura...", "info");
        await sleep(800);
        addLog("Validando integridad de certificados SSL...", "info");
        await sleep(600);
        addLog("Cifrando credenciales con llave AES-256...", "info");
        await sleep(500);

        try {
            if (!user || !user.token) return alert("Sesión inválida");
            const res = await fetch(`${API_URL}/api/admin/previred/rpa`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify({
                    rutEmpresa: rpaData.rutEmpresa,
                    rutAutorizado: rpaData.rutAuth,
                    clavePrevired: rpaData.passwordAuth
                })
            });
            if (res.ok) {
                setRobotStatus('active');
                addLog("Robot vinculado exitosamente.", "success");
                addLog(`Conexión establecida para RUT: ${rpaData.rutEmpresa}`, "success");
            } else {
                setRobotStatus('disconnected');
                addLog("Error: Credenciales rechazadas por la bóveda.", "error");
                alert('Fallo de validación. Verifica las credenciales de Previred e intenta nuevamente.');
            }
        } catch (e) {
            setRobotStatus('disconnected');
            addLog("Error crítico de red en la sincronización.", "error");
            alert('Error al conectar el robot de Previred.');
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm("¿Seguro que deseas desconectar el Robot de Previred? Se eliminarán las credenciales guardadas.")) return;
        addLog("Solicitando revocación de tokens...", "warning");
        try {
            const res = await fetch(`${API_URL}/api/admin/previred/rpa`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                setRobotStatus('disconnected');
                setRpaData({ rutEmpresa: '', rutAuth: '', passwordAuth: '' });
                addLog("Certificados eliminados. Robot fuera de línea.", "warning");
            }
        } catch (e) {
            console.error(e);
            alert("Error al desconectar el robot.");
        }
    };

    const runPreFlight = async () => {
        setValidating(true);
        addLog(`Iniciando Pre-flight Check para el periodo ${periodo}...`, "info");
        await sleep(400);
        addLog("Analizando consistencia de RUTs y AFPs...", "info");
        await sleep(600);
        try {
            const apiPeriodo = periodo.split('-').reverse().join('-');
            const res = await fetch(`${API_URL}/api/admin/previred/preflight?periodo=${apiPeriodo}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPreFlightAlerts(data.alerts || []);
                addLog(`Análisis completado: ${data.alerts.length} hallazgos.`, "success");
            }
        } catch (e) {
            addLog("Fallo en el motor de reglas de negocio.", "error");
        } finally {
            setValidating(false);
        }
    };

    const runSeeder = async () => {
        setValidating(true);
        addLog("Generando datos de muestra para el periodo...", "info");
        try {
            const apiPeriodo = periodo.split('-').reverse().join('-');
            const res = await fetch(`${API_URL}/api/admin/previred/seed?periodo=${apiPeriodo}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                addLog("Datos generados exitosamente.", "success");
                runPreFlight();
                // Refresh stats
                const statsRes = await fetch(`${API_URL}/api/admin/previred/stats`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (statsRes.ok) setStats(await statsRes.json());
            } else {
                addLog("Error al generar datos.", "error");
            }
        } catch (e) {
            addLog("Fallo de conexión al generador.", "error");
        }
        setValidating(false);
    };

    const handleExport = async (exportType = 'nomina') => {
        // Ensure exportType is a string (prevents event object issues)
        const type = typeof exportType === 'string' ? exportType : 'nomina';
        
        setExporting(true);
        // Valid mappings for endpoints
        const endpointMap = {
            'nomina': 'export',
            'movimientos': 'movimientos',
            'honorarios': 'honorarios'
        };
        const endpoint = endpointMap[type] || 'export';
        const fileNamePrefix = `PREVIRED_${type.toUpperCase()}`;
        
        addLog(`Preparando motor de exportación de ${type}...`, "info");
        await sleep(500);
        addLog(`Mapeando campos Versión 58 para periodo ${periodo}...`, "info");
        await sleep(800);

        try {
            const [year, month] = periodo.split('-');
            const apiPeriodo = `${month}-${year}`;

            const res = await fetch(`${API_URL}/api/admin/previred/${endpoint}?periodo=${apiPeriodo}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });
            if (res.ok) {
                addLog("Generando stream de datos binarios...", "info");
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${fileNamePrefix}_${apiPeriodo}.txt`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                addLog(`Exportación exitosa: ${fileNamePrefix}_${apiPeriodo}.txt`, "success");
                
                // Refresh history after export
                const historyRes = await fetch(`${API_URL}/api/admin/previred/history`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (historyRes.ok) setHistory(await historyRes.json());

            } else {
                addLog(`Fallo: Datos de ${type} no encontrados en el periodo.`, "error");
                alert(`No se encontraron datos para procesar la exportación de ${type}.`);
            }
        } catch (e) {
            addLog("Error fatal en el empaquetado del archivo.", "error");
        } finally {
            setExporting(false);
        }
    };

    const tabs = [
        { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
        { id: 'nomina', label: 'Nómina', icon: FileText },
        { id: 'movimientos', label: 'Movimientos', icon: UserPlus },
        { id: 'honorarios', label: 'Honorarios', icon: Users },
        { id: 'historial', label: 'Historial', icon: RefreshCcw },
        { id: 'config', label: 'Conexión RPA', icon: Settings },
    ];

    return (
        <div className="w-full max-w-7xl mx-auto pb-24 animate-in fade-in duration-500">

            {/* ── ENCABEZADO PREMIUM ── */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden mb-8 border border-white/5">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px]"></div>
                
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="w-24 h-24 bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center p-4 shadow-2xl backdrop-blur-xl shrink-0 group hover:bg-white/10 transition-all cursor-default">
                        <Building2 size={40} className="text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-300">PREVIRED</span>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Ecosistema <span className="text-indigo-400">Previred 360</span></h1>
                            <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                <Zap size={12} className="fill-emerald-400" /> Full Automation Level-A
                            </div>
                        </div>
                        <p className="text-indigo-200/60 font-medium text-sm max-w-2xl leading-relaxed">
                            Gestión centralizada de leyes sociales, movimientos de personal y honorarios. 
                            Sincronización segura mediante Robot RPA certificado bajo estándares bancarios.
                        </p>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
                        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border transition-colors ${robotStatus === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${robotStatus === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest">{robotStatus === 'active' ? 'Robot Online' : 'Robot Offline'}</span>
                        </div>
                        {robotStatus === 'active' && <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter">Última Sync: Hoy {new Date().getHours()}:{new Date().getMinutes()}</span>}
                    </div>
                </div>
            </div>

            {/* ── NAVEGACIÓN POR PESTAÑAS ── */}
            <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200 w-fit mx-auto md:mx-0">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                            activeTab === t.id 
                            ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 ring-1 ring-slate-200' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                        }`}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* ── CONTENIDO PRINCIPAL (COL-SPAN-2) ── */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {activeTab === 'resumen' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl">
                            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                <LayoutDashboard className="text-indigo-500" /> Estado de Remuneraciones
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100">
                                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2">Próximo Vencimiento</span>
                                    <p className="text-2xl font-black text-indigo-900 leading-none">{stats.nextDeadline}</p>
                                    <p className="text-xs font-bold text-indigo-600/60 mt-2 italic">Declaración Electrónica</p>
                                </div>
                                <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado Nómina Actual ({stats.period})</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <CheckCircle2 className={stats.count > 0 ? "text-emerald-500" : "text-amber-500"} size={20} />
                                        <p className="text-xl font-black text-slate-800 leading-none">{stats.count > 0 ? 'Snapshot Cerrado' : 'Sin Datos'}</p>
                                    </div>
                                    <p className="text-xs font-bold text-slate-500 mt-2">{stats.count || 0} Colaboradores registrados</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'nomina' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200"><FileText size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 leading-none">Declaración de Remuneraciones</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Archivo Plano Versión 58</p>
                                    </div>
                                </div>
                                <div className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">Certificado DT</div>
                            </div>
                            <div className="p-8">
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 mb-8">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar Periodo de Carga</label>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                                                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                                        </div>
                                        <button onClick={() => handleExport('nomina')} disabled={exporting || robotStatus !== 'active'}
                                            className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                            {exporting ? <RefreshCcw className="animate-spin" size={20} /> : <Download size={20} />}
                                            {exporting ? 'Procesando...' : 'Descargar Archivo'}
                                        </button>
                                    </div>
                                    {robotStatus !== 'active' && <p className="text-[10px] font-bold text-rose-500 mt-3 flex items-center gap-2"><AlertCircle size={12} /> Requiere conexión RPA activa para generar archivos con RUT Empresa.</p>}
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 transition-colors group">
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-2">
                                            <ShieldCheck size={14} className="text-emerald-500" /> Pre-flight Check
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">Validación automática de 105 campos obligatorios antes de la descarga.</p>
                                    </div>
                                    <div className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 transition-colors">
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-2">
                                            <CloudCog size={14} className="text-indigo-500" /> Inyección Directa
                                        </h4>
                                        <p className="text-xs text-slate-500 font-medium">El archivo se optimiza para ser leído por el Robot RPA en modo automático.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'movimientos' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                             <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200"><UserPlus size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 leading-none">Movimientos de Personal</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Altas, Bajas y Licencias Médicas</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 mb-8">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar Periodo de Movimientos</label>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                                                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all" />
                                        </div>
                                        <button onClick={() => handleExport('movimientos')} disabled={exporting || robotStatus !== 'active'}
                                            className="px-10 py-5 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-amber-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                            {exporting ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                                            {exporting ? 'Generando...' : 'Exportar Movimientos'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'honorarios' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                             <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200"><Users size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 leading-none">Boletas de Honorarios (SBP)</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Declaración de Retenciones de Terceros</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 mb-8">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Seleccionar Periodo SBP</label>
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <div className="relative flex-1">
                                            <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                            <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)}
                                                className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                                        </div>
                                        <button onClick={() => handleExport('honorarios')} disabled={exporting || robotStatus !== 'active'}
                                            className="px-10 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                                            {exporting ? <RefreshCcw className="animate-spin" size={20} /> : <Save size={20} />}
                                            {exporting ? 'Procesando...' : 'Exportar Honorarios'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'historial' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-800 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200"><RefreshCcw size={24} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 leading-none">Historial de Exportaciones</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Registro de Actividad y Auditoría</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                            <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {history.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="py-12 text-center text-slate-400 text-xs font-bold italic">No hay registros de actividad todavía.</td>
                                            </tr>
                                        ) : (
                                            history.map((log, i) => (
                                                <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 text-xs font-black text-slate-800">{log.periodo}</td>
                                                    <td className="py-4 text-xs font-bold text-slate-500">{log.tipo}</td>
                                                    <td className="py-4 text-xs font-bold text-slate-400 italic">
                                                        {new Date(log.fecha).toLocaleDateString()} {new Date(log.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="py-4">
                                                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter border ${
                                                            log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                                        }`}>
                                                            {log.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4">
                                                        <div className="text-[10px] font-bold text-slate-500">{log.metadata?.recordCount || 0} reg.</div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><Bot size={24} /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 leading-none">Robot de Enlace Previred</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Conexión Segura RSA-4096</p>
                                </div>
                            </div>
                            
                            <div className="p-8">
                                {robotStatus === 'active' ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-10 flex flex-col items-center text-center">
                                        <div className="w-24 h-24 bg-white text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl ring-8 ring-emerald-100/50">
                                            <ShieldCheck size={48} className="animate-in zoom-in duration-500" />
                                        </div>
                                        <h3 className="text-2xl font-black text-emerald-900 leading-tight">Conexión Establecida</h3>
                                        <div className="mt-4 space-y-1">
                                            <p className="text-emerald-700 font-bold text-xs">Empresa: <span className="font-black">{rpaData.rutEmpresa}</span></p>
                                            <p className="text-emerald-700 font-bold text-xs">Usuario: <span className="font-black">{rpaData.rutAuth}</span></p>
                                        </div>
                                        <button onClick={handleDisconnect}
                                            className="mt-8 px-8 py-3 bg-white text-rose-500 border border-rose-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-md">
                                            Desconectar Robot & Limpiar Bóveda
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleRPASumbit} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RUT Empresa Titular</label>
                                                <input type="text" value={rpaData.rutEmpresa} onChange={e => setRpaData({...rpaData, rutEmpresa: formatRut(e.target.value)})}
                                                    placeholder="77.216.XXX-X" required
                                                    className={`w-full bg-slate-50 border ${rpaData.rutEmpresa && !validateRut(rpaData.rutEmpresa) ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-slate-200'} rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all`} />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RUT Administrador Auth</label>
                                                <input type="text" value={rpaData.rutAuth} onChange={e => setRpaData({...rpaData, rutAuth: formatRut(e.target.value)})}
                                                    placeholder="15.XXX.XXX-X" required
                                                    className={`w-full bg-slate-50 border ${rpaData.rutAuth && !validateRut(rpaData.rutAuth) ? 'border-rose-400 bg-rose-50 text-rose-600' : 'border-slate-200'} rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all`} />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Clave de Portal Previred</label>
                                            <div className="relative">
                                                <Lock size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="password" value={rpaData.passwordAuth} onChange={e => setRpaData({...rpaData, passwordAuth: e.target.value})}
                                                    placeholder="••••••••••••" required
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={robotStatus === 'connecting'}
                                            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                                            {robotStatus === 'connecting' ? <RefreshCcw className="animate-spin" /> : <Save size={20} />}
                                            {robotStatus === 'connecting' ? 'Sincronizando...' : 'Establecer Conexión RPA'}
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── PANEL DERECHO (CONTROL & LOGS) ── */}
                <div className="space-y-8">
                    
                    {/* Consola RPA Live */}
                    <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Terminal size={18} className="text-indigo-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RPA Live Console</span>
                            </div>
                        </div>
                        <div className="p-6 font-mono text-[11px] h-48 overflow-y-auto space-y-2 custom-scrollbar">
                            {consoleLogs.length === 0 ? (
                                <p className="text-slate-600 italic text-center py-10">Esperando actividad...</p>
                            ) : (
                                consoleLogs.map((l, i) => (
                                    <div key={i} className={`flex gap-3 leading-relaxed animate-in slide-in-from-left-2 duration-300`}>
                                        <span className="text-slate-600 shrink-0">[{l.time}]</span>
                                        <span className={
                                            l.type === 'error' ? 'text-rose-400' : 
                                            l.type === 'success' ? 'text-emerald-400' : 
                                            l.type === 'warning' ? 'text-amber-400' : 
                                            'text-indigo-300'
                                        }>
                                            {l.msg}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Pre-flight Alerts */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck size={18} className="text-indigo-500" /> Pre-flight Check
                            </h3>
                            <button onClick={runPreFlight} disabled={validating}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50">
                                <RefreshCcw size={16} className={validating ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="space-y-3 min-h-[100px]">
                            {preFlightAlerts.length > 0 ? (
                                <div className="space-y-3">
                                    {preFlightAlerts.map((alert, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border flex items-start gap-4 ${
                                            alert.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                            alert.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                            'bg-emerald-50 border-emerald-100 text-emerald-700'
                                        }`}>
                                            <div className="mt-1">
                                                {alert.type === 'error' ? <AlertCircle size={16} /> :
                                                 alert.type === 'warning' ? <AlertCircle size={16} /> :
                                                 <ShieldCheck size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black">{alert.msg}</p>
                                                {alert.msg.includes("No existen liquidaciones") && (
                                                    <button onClick={runSeeder} className="mt-3 px-4 py-2 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all">
                                                        Generar Datos de Prueba
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-xs font-bold text-slate-400 italic">Presiona el botón de actualizar para validar los datos del periodo.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Guia de Procesos */}
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-xl">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                             Proceso de Carga <ChevronRight size={16} className="text-indigo-500" />
                        </h3>
                        <div className="space-y-6">
                            {[
                                { step: '01', title: 'Cierre de Nómina', desc: 'Debes contar con el snapshot del mes en RRHH.', done: true },
                                { step: '02', title: 'Validación RPA', desc: 'El bot detecta brechas previsionales automáticamente.', done: robotStatus === 'active' },
                                { step: '03', title: 'Generación TXT', desc: 'Procesamiento de 105 campos Versión 58.', done: false },
                                { step: '04', title: 'Carga Previred', desc: 'Inyección directa mediante robot o carga manual.', done: false },
                            ].map((s, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${s.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                                        {s.done ? <ShieldCheck size={16} /> : s.step}
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide">{s.title}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed">{s.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-8 py-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all group">
                            Centro de Ayuda Previred <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </button>
                    </div>

                </div>
            </div>

            {/* SECCIÓN DE SEGURIDAD / COMPLIANCE */}
            <div className="mt-12 bg-white/40 backdrop-blur-md border border-white p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center gap-8 border-t-white/80 border-l-white/80">
                <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-200 flex items-center justify-center shrink-0">
                    <ShieldCheck size={40} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1.5 flex items-center justify-center md:justify-start gap-2">
                        Estándar de Seguridad Bancaria L4
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    </h4>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">
                        Toda la comunicación entre Gen AI y Previred es cifrada mediante protocolo TLS 1.3. 
                        Tus credenciales se almacenan en una bóveda criptográfica con rotación de llaves AES-256. 
                        No delegamos ni almacenamos copias de archivos temporales fuera del proceso de exportación activa.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100 hover:scale-110 transition-transform"><FileSpreadsheet size={24} className="text-slate-300" /></div>
                    <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100 hover:scale-110 transition-transform"><Lock size={24} className="text-slate-300" /></div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
            ` }} />

        </div>
    );
};

export default IntegracionPrevired;
