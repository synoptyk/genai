import React, { useState, useEffect, useMemo } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
    Bot, Play, Loader2, CheckCircle2, AlertCircle,
    Key, User, Eye, EyeOff, Save, Download,
    Calendar, Database, Shield, RefreshCw, Search,
    Terminal, Cpu, Clock, Square
} from 'lucide-react';

const DescargaTOA = () => {
    const hoyISO = new Date().toISOString().split('T')[0];

    // --- Credenciales TOA ---
    const [toaUsuario, setToaUsuario] = useState('');
    const [toaClave, setToaClave] = useState('');
    const [claveConfigurada, setClaveConfigurada] = useState(false);
    const [mostrarClave, setMostrarClave] = useState(false);
    const [guardandoCreds, setGuardandoCreds] = useState(false);
    const [credsMsg, setCredsMsg] = useState(null);
    const [ultimaSync, setUltimaSync] = useState(null);
    const [estadoSync, setEstadoSync] = useState('Sin configurar');

    // --- Descarga ---
    const [fechaInicio, setFechaInicio] = useState('2026-01-01');
    const [fechaFin, setFechaFin] = useState(hoyISO);
    const [botRunning, setBotRunning] = useState(false);
    const [botMsg, setBotMsg] = useState(null);

    // --- Estado en tiempo real del bot ---
    const [botStatus, setBotStatus] = useState(null);
    const [showLogs, setShowLogs] = useState(true);

    // --- Tabla producción ---
    const [dataRaw, setDataRaw] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // --- Cargar config TOA ---
    const cargarConfigTOA = async () => {
        try {
            const res = await api.get('/empresa/toa-config');
            setToaUsuario(res.data.usuario || '');
            setClaveConfigurada(res.data.claveConfigurada || false);
            setUltimaSync(res.data.ultimaSincronizacion);
            setEstadoSync(res.data.estadoSincronizacion || 'Sin configurar');
        } catch (e) {
            console.error('Error cargando config TOA', e);
        }
    };

    // Contador de fallos consecutivos de polling (para mostrar indicador de reconexión)
    const [pollingFails, setPollingFails] = useState(0);

    // --- Cargar estado del bot ---
    const cargarBotStatus = async () => {
        try {
            const res = await api.get('/bot/status');
            setBotStatus(res.data);
            setPollingFails(0);
            if (res.data.running) setBotRunning(true);
            else setBotRunning(false);
        } catch (e) {
            // 502 / CORS / network error: NO resetear estado — mantener último conocido
            // Solo incrementar contador para mostrar indicador de reconexión
            setPollingFails(prev => prev + 1);
        }
    };

    // --- Cargar datos producción ---
    const cargarDatos = async () => {
        try {
            setLoadingData(true);
            // Endpoint TOA: incluye registros con y sin empresaRef (recupera datos del bot)
            const res = await api.get('/bot/datos-toa');
            setDataRaw(res.data || []);
        } catch (e) {
            console.error('Error cargando datos TOA', e);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        cargarConfigTOA();
        cargarDatos();
        const intervalDatos = setInterval(cargarDatos, 30000);
        // Polling de estado del bot cada 4 segundos
        cargarBotStatus();
        const intervalStatus = setInterval(cargarBotStatus, 4000);
        return () => { clearInterval(intervalDatos); clearInterval(intervalStatus); };
    }, []);

    // --- Guardar credenciales ---
    const guardarCredenciales = async () => {
        if (!toaUsuario.trim() || !toaClave.trim()) {
            setCredsMsg({ type: 'err', text: 'Ingresa usuario y contraseña TOA.' });
            return;
        }
        setGuardandoCreds(true);
        setCredsMsg(null);
        try {
            await api.post('/empresa/toa-config', { usuario: toaUsuario.trim(), clave: toaClave });
            setCredsMsg({ type: 'ok', text: 'Credenciales guardadas y cifradas correctamente.' });
            setClaveConfigurada(true);
            setToaClave('');
        } catch (e) {
            setCredsMsg({ type: 'err', text: e?.response?.data?.error || 'Error al guardar credenciales.' });
        } finally {
            setGuardandoCreds(false);
        }
    };

    // --- Lanzar agente ---
    const lanzarAgente = async () => {
        if (botRunning) return;
        if (!claveConfigurada) {
            setBotMsg({ type: 'err', text: 'Primero configura tus credenciales TOA.' });
            return;
        }
        setBotRunning(true);
        setBotMsg(null);
        setPollingFails(0);
        try {
            const res = await api.post('/bot/run', { fechaInicio, fechaFin });
            setBotMsg({ type: 'ok', text: res.data.message || 'Agente iniciado.' });
            setTimeout(cargarDatos, 15000);
            // NO poner setBotRunning(false) aquí — el polling lo maneja cuando el bot termine
        } catch (e) {
            setBotRunning(false); // Solo apagar en caso de error al iniciar
            setBotMsg({ type: 'err', text: e?.response?.data?.message || e?.response?.data?.error || 'Error al lanzar el agente.' });
        }
    };

    // --- Detener agente ---
    const [deteniendoBot, setDeteniendoBot] = useState(false);
    const detenerAgente = async () => {
        if (!window.confirm('¿Detener la descarga en curso?')) return;
        setDeteniendoBot(true);
        try {
            await api.post('/bot/stop');
            setBotMsg({ type: 'ok', text: 'Descarga detenida.' });
        } catch (e) {
            setBotMsg({ type: 'err', text: 'Error al detener el agente.' });
        } finally {
            setDeteniendoBot(false);
        }
    };

    // --- Columnas dinámicas ---
    const dynamicKeys = useMemo(() => {
        if (!dataRaw || dataRaw.length === 0) return [];
        const allKeys = new Set();
        dataRaw.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        const ignored = ['_id', '__v', 'tecnicoId', 'createdAt', 'updatedAt', 'nombre', 'actividad', 'ordenId', 'fecha', 'puntos', 'latitud', 'longitud', 'clienteAsociado', 'ingreso', 'origen', 'nombreBruto', 'datosRaw', 'categoriaRendimiento', 'meta', 'proyeccion', 'cumplimiento'];
        const preferredOrder = ["Actividad", "Recurso", "Ventana de servicio", "Ventana de Llegada", "Número de Petición", "Numero orden", "Puntos", "Agencia", "Comuna", "Direccion", "Ciudad", "Nombre", "RUT del cliente", "Telefono", "Subtipo de Actividad", "Tipo Trabajo", "Estado", "Zona Trabajo", "Categoría de Capacidad", "Tecnologia Voz", "Tecnologia Banda Ancha", "Tecnologia TV"];
        return Array.from(allKeys).filter(k => !ignored.includes(k)).sort((a, b) => {
            const iA = preferredOrder.indexOf(a), iB = preferredOrder.indexOf(b);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [dataRaw]);

    const handleExport = () => {
        if (!dataRaw.length) return;
        const rows = dataRaw.map(row => {
            const r = { 'Fecha': new Date(row.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) };
            dynamicKeys.forEach(k => r[k] = row[k] || '');
            return r;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Produccion_TOA');
        XLSX.writeFile(wb, `Produccion_TOA_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const diasRango = fechaInicio && fechaFin
        ? Math.max(1, Math.round((new Date(fechaFin) - new Date(fechaInicio)) / 86400000) + 1)
        : 0;

    const filteredData = useMemo(() =>
        dataRaw.filter(r => JSON.stringify(r).toLowerCase().includes(busqueda.toLowerCase())),
        [dataRaw, busqueda]
    );

    const estadoBadge = {
        'Sin configurar': 'bg-slate-100 text-slate-500',
        'Configurado': 'bg-emerald-100 text-emerald-700',
        'Sincronizando': 'bg-blue-100 text-blue-700',
        'Error': 'bg-red-100 text-red-700',
    }[estadoSync] || 'bg-slate-100 text-slate-500';

    return (
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-6 bg-slate-50/50 min-h-screen font-sans">

            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black italic text-slate-800 flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30">
                            <Database size={32} />
                        </div>
                        <span>Descarga <span className="text-blue-600">TOA</span></span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-2 ml-2">Conecta tu cuenta Oracle Field Service y descarga tu base de datos de producción</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${estadoBadge} border`}>
                    <Shield size={12} className="inline mr-1" />
                    TOA: {estadoSync}
                    {ultimaSync && <span className="ml-2 font-normal opacity-70">· Última sync: {new Date(ultimaSync).toLocaleString('es-CL')}</span>}
                </div>
            </div>

            {/* ── SECCIÓN 1: CREDENCIALES TOA ─────────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-xl"><Key size={16} className="text-blue-600" /></div>
                    <div>
                        <h2 className="font-black text-slate-800 text-sm">Credenciales Oracle Field Service (TOA)</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Tu contraseña se guarda cifrada con AES-256. Nunca se expone en texto plano.</p>
                    </div>
                    {claveConfigurada && (
                        <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                            <CheckCircle2 size={12} /> Configurado
                        </span>
                    )}
                </div>
                <div className="p-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <User size={11} /> Usuario TOA
                            </label>
                            <input
                                type="text"
                                value={toaUsuario}
                                onChange={e => setToaUsuario(e.target.value)}
                                placeholder="Ej: 16411496"
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Key size={11} /> Contraseña TOA {claveConfigurada && <span className="text-emerald-500">(configurada)</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type={mostrarClave ? 'text' : 'password'}
                                    value={toaClave}
                                    onChange={e => setToaClave(e.target.value)}
                                    placeholder={claveConfigurada ? '••••••••• (deja vacío para no cambiar)' : 'Ingresa tu contraseña TOA'}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                                />
                                <button onClick={() => setMostrarClave(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {mostrarClave ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={guardarCredenciales}
                            disabled={guardandoCreds}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                        >
                            {guardandoCreds ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Guardar
                        </button>
                    </div>
                    {credsMsg && (
                        <div className={`mt-4 flex items-center gap-2 text-sm font-bold px-4 py-3 rounded-xl ${credsMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {credsMsg.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            {credsMsg.text}
                        </div>
                    )}
                </div>
            </div>

            {/* ── SECCIÓN 2: DESCARGA ──────────────────────────────── */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 rounded-3xl p-6 shadow-2xl border border-blue-800/30 mb-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-2xl">
                            <Bot size={28} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-sm uppercase tracking-widest">Agente TOA</h2>
                            <p className="text-blue-300/70 text-xs mt-0.5">Descarga producción directamente desde Oracle Field Service</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        <div className="flex flex-col gap-1">
                            <label className="text-blue-300/60 text-[10px] font-black uppercase tracking-widest">Fecha Inicio</label>
                            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                                min="2026-01-01" max={fechaFin} disabled={botRunning}
                                className="bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50"
                                style={{ colorScheme: 'dark' }} />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-blue-300/60 text-[10px] font-black uppercase tracking-widest">Fecha Fin</label>
                            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                                min={fechaInicio} max={hoyISO} disabled={botRunning}
                                className="bg-white/10 border border-white/20 text-white text-xs font-bold rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50"
                                style={{ colorScheme: 'dark' }} />
                        </div>
                        <div className="flex flex-col gap-1 justify-end">
                            <label className="text-blue-300/60 text-[10px] font-black uppercase tracking-widest opacity-0">_</label>
                            <span className="text-blue-200/60 text-[11px] font-bold bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl">
                                {diasRango} días
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            {/* Botón Iniciar / Descargando */}
                            <button onClick={lanzarAgente} disabled={botRunning || !claveConfigurada}
                                className={`flex items-center gap-3 px-7 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg ${botRunning || !claveConfigurada
                                    ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed border border-blue-500/30'
                                    : 'bg-blue-500 hover:bg-blue-400 text-white shadow-blue-500/30 hover:scale-105 border border-blue-400/50'
                                    }`}>
                                {botRunning ? <><Loader2 size={18} className="animate-spin" /> Descargando...</> : <><Play size={18} /> Iniciar Descarga</>}
                            </button>

                            {/* Botón Detener — visible solo cuando el bot corre */}
                            {botStatus?.running && (
                                <button onClick={detenerAgente} disabled={deteniendoBot}
                                    title="Detener descarga"
                                    className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all bg-red-600 hover:bg-red-500 text-white border border-red-500/50 shadow-lg shadow-red-500/20 hover:scale-105 disabled:opacity-50">
                                    {deteniendoBot ? <Loader2 size={18} className="animate-spin" /> : <Square size={18} />}
                                    Detener
                                </button>
                            )}
                        </div>

                        {!claveConfigurada && !botRunning && (
                            <p className="text-yellow-400/70 text-[10px] font-bold text-center">⚠ Configura credenciales primero</p>
                        )}
                        {botMsg && (
                            <div className={`flex items-center gap-2 text-[11px] font-bold px-3 py-2 rounded-xl ${botMsg.type === 'ok' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                                {botMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                                {botMsg.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 2.5: ESTADO EN TIEMPO REAL DEL BOT ──────── */}
            {(botRunning || (botStatus && botStatus.logs && botStatus.logs.length > 0)) && (
                <div className="bg-slate-950 rounded-3xl border border-slate-800 mb-8 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${botStatus.running ? 'bg-green-500/20' : botStatus.ultimoError ? 'bg-red-500/20' : 'bg-slate-700'}`}>
                                <Terminal size={15} className={botStatus.running ? 'text-green-400' : botStatus.ultimoError ? 'text-red-400' : 'text-slate-400'} />
                            </div>
                            <span className="text-white font-black text-xs uppercase tracking-widest">Estado del Agente</span>
                            {(botStatus?.running || botRunning) && (
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400 bg-green-500/20 border border-green-500/30 px-2 py-1 rounded-lg animate-pulse">
                                    <Cpu size={10} /> CORRIENDO
                                </span>
                            )}
                            {pollingFails >= 3 && botRunning && (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-lg">
                                    <Loader2 size={10} className="animate-spin" /> Reconectando...
                                </span>
                            )}
                            {!botRunning && botStatus?.ultimoError && (
                                <span className="text-[10px] font-black text-red-400 bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-lg">ERROR</span>
                            )}
                            {!botRunning && !botStatus?.ultimoError && botStatus?.logs?.length > 0 && (
                                <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-lg">COMPLETADO</span>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            {botRunning && botStatus?.totalDias > 0 && (
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-white text-xs font-black">{botStatus.diaActual} / {botStatus.totalDias} días</div>
                                        <div className="text-slate-400 text-[10px]">{botStatus.fechaProcesando}</div>
                                    </div>
                                    <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.round((botStatus.diaActual / botStatus.totalDias) * 100)}%` }} />
                                    </div>
                                    <span className="text-blue-400 text-xs font-black">{Math.round((botStatus.diaActual / botStatus.totalDias) * 100)}%</span>
                                </div>
                            )}
                            <button onClick={() => setShowLogs(v => !v)} className="text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider">
                                {showLogs ? 'Ocultar' : 'Ver'} logs
                            </button>
                        </div>
                    </div>

                    {/* Barra de progreso global */}
                    {botRunning && botStatus?.totalDias > 0 && (
                        <div className="h-1 bg-slate-900">
                            <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
                                style={{ width: `${Math.round((botStatus.diaActual / botStatus.totalDias) * 100)}%` }} />
                        </div>
                    )}

                    {/* Error */}
                    {botStatus?.ultimoError && (
                        <div className="px-6 py-3 bg-red-950/50 border-b border-red-900/50 flex items-center gap-2">
                            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                            <span className="text-red-300 text-xs font-bold">{botStatus.ultimoError}</span>
                        </div>
                    )}

                    {/* Logs */}
                    {showLogs && botStatus?.logs && botStatus.logs.length > 0 && (
                        <div className="p-4 max-h-52 overflow-y-auto font-mono">
                            {[...botStatus.logs].reverse().map((log, i) => (
                                <div key={i} className={`text-[11px] py-0.5 ${
                                    log.includes('ERROR') || log.includes('❌') ? 'text-red-400' :
                                    log.includes('✅') || log.includes('🏁') ? 'text-emerald-400' :
                                    log.includes('📅') ? 'text-blue-400' :
                                    log.includes('⚠️') ? 'text-yellow-400' :
                                    'text-slate-400'
                                }`}>
                                    {log}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── SECCIÓN 3: TABLA DE PRODUCCIÓN ──────────────────── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Database size={18} className="text-blue-500" />
                        <span className="font-black text-slate-700 text-sm uppercase tracking-wider">Base de Datos Producción TOA</span>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-lg">{dataRaw.length.toLocaleString()} registros</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <button onClick={cargarDatos} className="p-2 hover:bg-slate-100 rounded-xl transition-all" title="Actualizar">
                            <RefreshCw size={15} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleExport} disabled={!dataRaw.length}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all">
                            <Download size={14} /> Exportar Excel
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 w-52" />
                        </div>
                    </div>
                </div>

                {loadingData && dataRaw.length === 0 ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Loader2 size={24} className="animate-spin mr-3" /> Cargando datos...
                    </div>
                ) : dataRaw.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Database size={40} className="mb-3 opacity-30" />
                        <p className="font-bold">Sin datos aún</p>
                        <p className="text-xs mt-1">Configura tus credenciales TOA e inicia una descarga</p>
                    </div>
                ) : (
                    <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-[11px] border-collapse">
                            <thead className="sticky top-0 z-10 bg-slate-800 text-white">
                                <tr>
                                    <th className="p-3 text-left font-black whitespace-nowrap sticky left-0 bg-slate-800 z-20 border-r border-slate-700">Fecha</th>
                                    {dynamicKeys.map(k => (
                                        <th key={k} className="p-3 text-left font-black whitespace-nowrap border-r border-slate-700 min-w-[100px]">{k}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.slice(0, 100).map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="p-2.5 border-r border-slate-100 sticky left-0 bg-white font-bold text-slate-600 whitespace-nowrap">
                                            {new Date(row.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' })}
                                        </td>
                                        {dynamicKeys.map(k => (
                                            <td key={k} className="p-2.5 border-r border-slate-50 text-slate-500 whitespace-nowrap max-w-[180px] truncate" title={row[k]}>
                                                {row[k] || ''}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredData.length > 100 && (
                            <div className="text-center py-4 text-xs text-slate-400 font-bold border-t border-slate-100">
                                Mostrando 100 de {filteredData.length} registros. Exporta a Excel para ver todos.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DescargaTOA;
