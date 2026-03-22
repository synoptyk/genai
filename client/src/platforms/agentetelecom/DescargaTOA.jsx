import React, { useState, useEffect, useRef, useMemo } from 'react';
import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
    Bot, Play, Loader2, CheckCircle2, AlertCircle,
    Key, User, Eye, EyeOff, Save, Download,
    Calendar, Database, Shield, RefreshCw, Search,
    Terminal, Cpu, Clock, Square, List, Check, X,
    Globe, Edit3, Monitor, Users, Briefcase,
    FileSpreadsheet, Settings, Navigation, ChevronRight,
    Lock, Unlock, Zap, Activity
} from 'lucide-react';

const DescargaTOA = () => {
    const hoyISO = new Date().toISOString().split('T')[0];

    // --- Configuración TOA (URL + credenciales) ---
    const [toaUrl, setToaUrl]                 = useState('https://telefonica-cl.etadirect.com/');
    const [toaUsuario, setToaUsuario]         = useState('');
    const [toaClave, setToaClave]             = useState('');
    const [claveConfigurada, setClaveConfigurada] = useState(false);
    const [mostrarClave, setMostrarClave]     = useState(false);
    const [editandoCreds, setEditandoCreds]   = useState(false);
    const [guardandoCreds, setGuardandoCreds] = useState(false);
    const [credsMsg, setCredsMsg]             = useState(null);
    const [ultimaSync, setUltimaSync]         = useState(null);
    const [estadoSync, setEstadoSync]         = useState('Sin configurar');

    // --- Bot ---
    const [fechaInicio, setFechaInicio] = useState('2026-01-01');
    const [fechaFin, setFechaFin]       = useState(hoyISO);
    const [botRunning, setBotRunning]   = useState(false);
    const [botMsg, setBotMsg]           = useState(null);
    const [botStatus, setBotStatus]     = useState(null);
    const [pollingFails, setPollingFails] = useState(0);

    // --- Grupos (ya no se necesita selección manual) ---

    // --- Live screenshot ---
    const [screenshot, setScreenshot]   = useState(null);
    const [screenshotTime, setScreenshotTime] = useState(null);
    const screenshotRef = useRef(null);

    // --- Tabla ---
    const [dataRaw, setDataRaw]         = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [busqueda, setBusqueda]       = useState('');
    const [deteniendoBot, setDeteniendoBot] = useState(false);
    const [showLogs, setShowLogs]       = useState(true);

    // --- Fechas ya descargadas ---
    const [fechasDescargadas, setFechasDescargadas] = useState([]); // [{ fecha: 'YYYY-MM-DD', total: N }]
    const [mesCalendario, setMesCalendario]         = useState(() => {
        const h = new Date(); return { year: h.getFullYear(), month: h.getMonth() };
    });

    // ── Cargar config TOA ─────────────────────────────────────────────────────
    const cargarConfigTOA = async () => {
        try {
            const res = await api.get('/empresa/toa-config');
            setToaUrl(res.data.url || 'https://telefonica-cl.etadirect.com/');
            setToaUsuario(res.data.usuario || '');
            setClaveConfigurada(res.data.claveConfigurada || false);
            setUltimaSync(res.data.ultimaSincronizacion);
            setEstadoSync(res.data.estadoSincronizacion || 'Sin configurar');
            // Si ya está configurado, no mostrar el modo edición
            if (res.data.claveConfigurada) setEditandoCreds(false);
            else setEditandoCreds(true); // primer uso → mostrar campos
        } catch (e) { console.error('Config TOA', e); setEditandoCreds(true); }
    };

    // ── Polling bot status ────────────────────────────────────────────────────
    const cargarBotStatus = async () => {
        try {
            const res = await api.get('/bot/status');
            const data = res.data;
            setBotStatus(data);
            setPollingFails(0);
            setBotRunning(!!data.running);
        } catch (e) { setPollingFails(prev => prev + 1); }
    };

    // ── Polling screenshot en vivo ────────────────────────────────────────────
    const cargarScreenshot = async () => {
        try {
            const res = await api.get('/bot/screenshot');
            if (res.status === 204) return;
            if (res.data?.data) {
                setScreenshot(res.data.data);
                setScreenshotTime(res.data.time);
            }
        } catch (_) {}
    };

    // ── Cargar datos producción ───────────────────────────────────────────────
    const cargarDatos = async () => {
        try {
            setLoadingData(true);
            const res = await api.get('/bot/datos-toa');
            setDataRaw(res.data || []);
        } catch (e) { console.error('Datos TOA', e); }
        finally { setLoadingData(false); }
    };

    // ── Cargar fechas ya descargadas ──────────────────────────────────────────
    const cargarFechasDescargadas = async () => {
        try {
            const res = await api.get('/bot/fechas-descargadas');
            setFechasDescargadas(res.data?.fechas || []);
        } catch (e) { console.error('Fechas descargadas', e); }
    };

    useEffect(() => {
        cargarConfigTOA();
        cargarDatos();
        cargarFechasDescargadas();
        const i1 = setInterval(cargarDatos, 30000);
        const i4 = setInterval(cargarFechasDescargadas, 30000);
        cargarBotStatus();
        const i2 = setInterval(cargarBotStatus, 3000);
        const i3 = setInterval(cargarScreenshot, 2000); // screenshot cada 2s
        return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); };
    }, []);

    // ── Auto-refresh cuando el bot termina ───────────────────────────────────
    const botRunningPrev = useRef(false);
    useEffect(() => {
        const eraRunning = botRunningPrev.current;
        const ahoraRunning = botRunning;
        botRunningPrev.current = ahoraRunning;
        // Transición running → stopped: refrescar datos inmediatamente
        if (eraRunning && !ahoraRunning) {
            setTimeout(() => {
                cargarDatos();
                cargarFechasDescargadas();
            }, 1500); // pequeña pausa para que MongoDB confirme escrituras
        }
    }, [botRunning]);

    // ── Guardar credenciales ──────────────────────────────────────────────────
    const guardarCredenciales = async () => {
        if (!toaUrl.trim())      { setCredsMsg({ type: 'err', text: 'Ingresa la URL de TOA.' }); return; }
        if (!toaUsuario.trim())  { setCredsMsg({ type: 'err', text: 'Ingresa el usuario TOA.' }); return; }
        if (!claveConfigurada && !toaClave.trim()) {
            setCredsMsg({ type: 'err', text: 'Ingresa la contraseña TOA.' }); return;
        }
        setGuardandoCreds(true); setCredsMsg(null);
        try {
            const body = { url: toaUrl.trim(), usuario: toaUsuario.trim() };
            if (toaClave.trim()) body.clave = toaClave;
            await api.post('/empresa/toa-config', body);
            setCredsMsg({ type: 'ok', text: 'Configuración guardada y cifrada.' });
            setClaveConfigurada(true); setToaClave(''); setEditandoCreds(false);
        } catch (e) {
            setCredsMsg({ type: 'err', text: e?.response?.data?.error || 'Error al guardar.' });
        } finally { setGuardandoCreds(false); }
    };

    // ── Lanzar agente ─────────────────────────────────────────────────────────
    const lanzarAgente = async () => {
        if (botRunning) return;
        if (!claveConfigurada) { setBotMsg({ type: 'err', text: 'Configura credenciales TOA primero.' }); return; }
        setBotRunning(true); setBotMsg(null);
        setPollingFails(0); setScreenshot(null);
        try {
            const res = await api.post('/bot/run', { fechaInicio, fechaFin });
            setBotMsg({ type: 'ok', text: res.data.message || 'Agente iniciado...' });
        } catch (e) {
            setBotRunning(false);
            setBotMsg({ type: 'err', text: e?.response?.data?.message || e?.response?.data?.error || 'Error al iniciar.' });
        }
    };

    // (Confirmar grupos ya no es necesario — el bot procesa automáticamente)

    // ── Detener agente ────────────────────────────────────────────────────────
    const detenerAgente = async () => {
        if (!window.confirm('¿Detener la descarga en curso?')) return;
        setDeteniendoBot(true);
        try {
            await api.post('/bot/stop');
            setBotMsg({ type: 'ok', text: 'Descarga detenida.' });
        } catch (e) { setBotMsg({ type: 'err', text: 'Error al detener.' }); }
        finally { setDeteniendoBot(false); }
    };

    // (toggleGrupo, seleccionarTodos, deseleccionarTodos ya no son necesarios)

    // ── Export ────────────────────────────────────────────────────────────────
    const dynamicKeys = useMemo(() => {
        if (!dataRaw || dataRaw.length === 0) return [];
        const allKeys = new Set();
        dataRaw.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        const ignored = ['_id', '__v', 'tecnicoId', 'createdAt', 'updatedAt', 'nombre', 'actividad', 'ordenId', 'fecha', 'puntos', 'latitud', 'longitud', 'clienteAsociado', 'ingreso', 'origen', 'nombreBruto', 'datosRaw', 'categoriaRendimiento', 'meta', 'proyeccion', 'cumplimiento', 'rawData', 'camposCustom', 'fuenteDatos', 'projectId', 'ceco', 'ultimaActualizacion'];
        const preferredOrder = ["Actividad", "Recurso", "Ventana de servicio", "Ventana de Llegada", "Número de Petición", "Estado", "Subtipo de Actividad", "Nombre", "RUT del cliente", "Ciudad"];
        return Array.from(allKeys).filter(k => !ignored.includes(k)).sort((a, b) => {
            const iA = preferredOrder.indexOf(a), iB = preferredOrder.indexOf(b);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1; if (iB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [dataRaw]);

    const handleExport = () => {
        if (!dataRaw.length) return;
        const rows = dataRaw.map(row => {
            const r = { Fecha: new Date(row.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) };
            dynamicKeys.forEach(k => {
                const v = row[k];
                r[k] = (v === null || v === undefined) ? '' : (typeof v === 'object') ? JSON.stringify(v) : String(v);
            });
            return r;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Produccion_TOA');
        XLSX.writeFile(wb, `Produccion_TOA_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const diasRango    = fechaInicio && fechaFin ? Math.max(1, Math.round((new Date(fechaFin) - new Date(fechaInicio)) / 86400000) + 1) : 0;
    const filteredData = useMemo(() => dataRaw.filter(r => JSON.stringify(r).toLowerCase().includes(busqueda.toLowerCase())), [dataRaw, busqueda]);
    const estadoBadge  = { 'Sin configurar': 'bg-slate-100 text-slate-500', 'Configurado': 'bg-emerald-100 text-emerald-700', 'Sincronizando': 'bg-blue-100 text-blue-700', 'Error': 'bg-red-100 text-red-700' }[estadoSync] || 'bg-slate-100 text-slate-500';
    const progreso     = botStatus?.totalDias > 0 ? Math.round((botStatus.diaActual / botStatus.totalDias) * 100) : 0;

    // Botones de acción rápida
    const ACCIONES = [
        { id: 'descargar', label: 'Descargar datos', icon: <Download size={15} />, color: 'bg-blue-600 hover:bg-blue-700', desc: 'Extraer producción del rango', accion: lanzarAgente, disabled: botRunning || !claveConfigurada },
        { id: 'tecnicos',  label: 'Ver técnicos',    icon: <Users size={15} />,    color: 'bg-violet-600 hover:bg-violet-700', desc: 'Leer perfiles del equipo', proximamente: true },
        { id: 'trabajos',  label: 'Ver trabajos',    icon: <Briefcase size={15} />, color: 'bg-cyan-600 hover:bg-cyan-700', desc: 'Trabajos en curso / pendientes', proximamente: true },
        { id: 'excel',     label: 'Exportar Excel',  icon: <FileSpreadsheet size={15} />, color: 'bg-emerald-600 hover:bg-emerald-700', desc: 'Descargar xlsx de producción', accion: handleExport, disabled: !dataRaw.length },
        { id: 'navegar',   label: 'Navegar TOA',     icon: <Navigation size={15} />, color: 'bg-orange-600 hover:bg-orange-700', desc: 'Abrir y explorar plataforma', proximamente: true },
        { id: 'gestionar', label: 'Gestionar TOA',   icon: <Settings size={15} />,   color: 'bg-slate-700 hover:bg-slate-800', desc: 'Acciones avanzadas del agente', proximamente: true },
    ];

    return (
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-6 bg-slate-50/50 min-h-screen font-sans">

            {/* HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h1 className="text-4xl font-black italic text-slate-800 flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30"><Bot size={32} /></div>
                        <span>Agente <span className="text-blue-600">TOA</span></span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-2 ml-2">Agente inteligente Oracle Field Service — navega, extrae y gestiona tu plataforma</p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${estadoBadge} border`}>
                    <Shield size={12} className="inline mr-1" />TOA: {estadoSync}
                    {ultimaSync && <span className="ml-2 font-normal opacity-70">· Última sync: {new Date(ultimaSync).toLocaleString('es-CL')}</span>}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* LAYOUT PRINCIPAL: IZQUIERDA (config + acciones) | DERECHA (pantalla) */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col xl:flex-row gap-6 mb-6">

                {/* ── COLUMNA IZQUIERDA ─────────────────────────────────────── */}
                <div className="flex flex-col gap-5 xl:w-[400px] flex-shrink-0">

                    {/* CONFIGURACIÓN TOA */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-xl"><Key size={14} className="text-blue-600" /></div>
                                <div>
                                    <h2 className="font-black text-slate-800 text-sm">Conexión TOA</h2>
                                    <p className="text-[10px] text-slate-400 mt-0.5">URL · Usuario · Contraseña</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {claveConfigurada && (
                                    <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                                        <Lock size={10} /> Configurado
                                    </span>
                                )}
                                {claveConfigurada && !editandoCreds && (
                                    <button onClick={() => setEditandoCreds(true)}
                                        className="flex items-center gap-1 text-[10px] font-black text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2 py-1 rounded-lg transition-all">
                                        <Edit3 size={10} /> Editar
                                    </button>
                                )}
                            </div>
                        </div>

                        {editandoCreds ? (
                            <div className="p-5 flex flex-col gap-4">
                                {/* URL */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Globe size={10} /> URL de TOA
                                    </label>
                                    <input type="text" value={toaUrl} onChange={e => setToaUrl(e.target.value)}
                                        placeholder="https://telefonica-cl.etadirect.com/"
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                </div>
                                {/* Usuario */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <User size={10} /> Usuario TOA
                                    </label>
                                    <input type="text" value={toaUsuario} onChange={e => setToaUsuario(e.target.value)}
                                        placeholder="Ej: 16411496"
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                </div>
                                {/* Contraseña */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Key size={10} /> Contraseña {claveConfigurada && <span className="text-emerald-500 font-normal">(vacío = sin cambios)</span>}
                                    </label>
                                    <div className="relative">
                                        <input type={mostrarClave ? 'text' : 'password'} value={toaClave} onChange={e => setToaClave(e.target.value)}
                                            placeholder={claveConfigurada ? '•••••••• (sin cambios)' : 'Ingresa tu contraseña'}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all" />
                                        <button onClick={() => setMostrarClave(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {mostrarClave ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {credsMsg && (
                                    <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl ${credsMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                        {credsMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {credsMsg.text}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button onClick={guardarCredenciales} disabled={guardandoCreds}
                                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all">
                                        {guardandoCreds ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
                                    </button>
                                    {claveConfigurada && (
                                        <button onClick={() => { setEditandoCreds(false); setCredsMsg(null); setToaClave(''); }}
                                            className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all">
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-5 flex flex-col gap-3">
                                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                                    <Globe size={13} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-600 truncate">{toaUrl}</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                                    <User size={13} className="text-slate-400 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-600">{toaUsuario || '—'}</span>
                                </div>
                                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                                    <Lock size={13} className="text-emerald-500 flex-shrink-0" />
                                    <span className="text-xs font-bold text-slate-600">Contraseña AES-256 cifrada</span>
                                    <CheckCircle2 size={12} className="text-emerald-500 ml-auto" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RANGO DE FECHAS + MINI CALENDARIO */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                            <Calendar size={14} className="text-blue-500" />
                            <span className="font-black text-slate-700 text-sm">Rango de fechas</span>
                            <span className="ml-auto text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{diasRango} días</span>
                        </div>
                        <div className="p-5 flex flex-col gap-3">
                            {/* Inputs de fecha */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Desde</label>
                                    <input type="date" value={fechaInicio} onChange={e => {
                                        setFechaInicio(e.target.value);
                                        const d = new Date(e.target.value + 'T00:00:00');
                                        setMesCalendario({ year: d.getFullYear(), month: d.getMonth() });
                                    }}
                                        min="2026-01-01" max={fechaFin} disabled={botRunning}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Hasta</label>
                                    <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                                        min={fechaInicio} max={hoyISO} disabled={botRunning}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50" />
                                </div>
                            </div>

                            {/* Mini calendario */}
                            {(() => {
                                const { year, month } = mesCalendario;
                                const mesesNombre = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                                const diasSemana  = ['L','M','X','J','V','S','D'];
                                const primerDia   = new Date(year, month, 1).getDay(); // 0=Dom
                                const offsetLunes = (primerDia + 6) % 7; // ajustar a Lunes=0
                                const diasEnMes   = new Date(year, month + 1, 0).getDate();
                                const descargaMap = new Map(fechasDescargadas.map(f => [f.fecha, f.total]));
                                const hoy         = new Date().toISOString().split('T')[0];

                                const celdas = [];
                                for (let i = 0; i < offsetLunes; i++) celdas.push(null);
                                for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

                                const isoFecha = (d) => `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

                                return (
                                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                        {/* Cabecera navegación mes */}
                                        <div className="flex items-center justify-between mb-2">
                                            <button onClick={() => setMesCalendario(p => {
                                                const d = new Date(p.year, p.month - 1, 1);
                                                return { year: d.getFullYear(), month: d.getMonth() };
                                            })} className="text-slate-400 hover:text-slate-700 px-1 text-xs font-black">‹</button>
                                            <span className="text-[11px] font-black text-slate-600">{mesesNombre[month]} {year}</span>
                                            <button onClick={() => setMesCalendario(p => {
                                                const d = new Date(p.year, p.month + 1, 1);
                                                return { year: d.getFullYear(), month: d.getMonth() };
                                            })} className="text-slate-400 hover:text-slate-700 px-1 text-xs font-black">›</button>
                                        </div>
                                        {/* Días semana */}
                                        <div className="grid grid-cols-7 mb-1">
                                            {diasSemana.map(ds => (
                                                <div key={ds} className="text-center text-[9px] font-black text-slate-400 py-0.5">{ds}</div>
                                            ))}
                                        </div>
                                        {/* Celdas */}
                                        <div className="grid grid-cols-7 gap-px">
                                            {celdas.map((d, idx) => {
                                                if (!d) return <div key={`e${idx}`} />;
                                                const iso     = isoFecha(d);
                                                const total   = descargaMap.get(iso);
                                                const enRango = iso >= fechaInicio && iso <= fechaFin;
                                                const esHoy   = iso === hoy;

                                                let bg = 'bg-white text-slate-400';
                                                let dot = null;
                                                let title = iso;

                                                if (total) {
                                                    // Ya descargado
                                                    bg = 'bg-emerald-100 text-emerald-700 font-black';
                                                    dot = <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />;
                                                    title = `${iso} — ${total} registros descargados`;
                                                } else if (enRango) {
                                                    // En rango pero sin datos → pendiente de descarga
                                                    bg = 'bg-amber-50 text-amber-700 font-bold ring-1 ring-amber-300';
                                                    dot = <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />;
                                                    title = `${iso} — pendiente de descarga`;
                                                }
                                                if (esHoy) bg += ' ring-2 ring-blue-400';

                                                return (
                                                    <div key={iso} title={title}
                                                        onClick={() => {
                                                            if (!botRunning) {
                                                                if (!fechaInicio || iso < fechaInicio) setFechaInicio(iso);
                                                                else setFechaFin(iso);
                                                            }
                                                        }}
                                                        className={`relative flex items-center justify-center rounded text-[10px] py-1 cursor-pointer hover:opacity-80 transition-all ${bg}`}>
                                                        {d}
                                                        {dot}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Leyenda */}
                                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                                            <div className="flex items-center gap-1">
                                                <span className="w-2.5 h-2.5 rounded bg-emerald-100 ring-1 ring-emerald-400 inline-block" />
                                                <span className="text-[9px] text-slate-500">Descargado</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="w-2.5 h-2.5 rounded bg-amber-50 ring-1 ring-amber-300 inline-block" />
                                                <span className="text-[9px] text-slate-500">Pendiente</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="w-2.5 h-2.5 rounded bg-white ring-1 ring-slate-200 inline-block" />
                                                <span className="text-[9px] text-slate-500">Sin datos</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Resumen de fechas en rango */}
                            {fechaInicio && fechaFin && (() => {
                                const descargaSet = new Set(fechasDescargadas.map(f => f.fecha));
                                let pendientes = 0, yaDescargados = 0;
                                const ini = new Date(fechaInicio + 'T00:00:00');
                                const fin = new Date(fechaFin   + 'T00:00:00');
                                for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
                                    const iso = d.toISOString().split('T')[0];
                                    if (descargaSet.has(iso)) yaDescargados++;
                                    else pendientes++;
                                }
                                return (
                                    <div className="flex gap-2">
                                        {yaDescargados > 0 && (
                                            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                                                <div className="text-[18px] font-black text-emerald-700">{yaDescargados}</div>
                                                <div className="text-[9px] text-emerald-600 font-bold">Ya descargados</div>
                                                <div className="text-[8px] text-emerald-500">se saltarán</div>
                                            </div>
                                        )}
                                        {pendientes > 0 && (
                                            <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center">
                                                <div className="text-[18px] font-black text-amber-700">{pendientes}</div>
                                                <div className="text-[9px] text-amber-600 font-bold">A descargar</div>
                                                <div className="text-[8px] text-amber-500">nuevos días</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* BOTONES DE ACCIÓN */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                            <Zap size={14} className="text-blue-500" />
                            <span className="font-black text-slate-700 text-sm">Acciones del agente</span>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-2">
                            {ACCIONES.map(acc => (
                                <button key={acc.id}
                                    onClick={acc.accion && !acc.proximamente ? acc.accion : undefined}
                                    disabled={acc.disabled || acc.proximamente}
                                    title={acc.proximamente ? 'Próximamente' : acc.desc}
                                    className={`relative flex flex-col items-start gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all text-white shadow-sm
                                        ${acc.disabled || acc.proximamente ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.03] hover:shadow-md cursor-pointer'}
                                        ${acc.color}`}>
                                    <div className="flex items-center gap-2 w-full">
                                        {acc.icon}
                                        <span className="font-black text-[11px] leading-tight">{acc.label}</span>
                                        {acc.proximamente && (
                                            <span className="ml-auto text-[8px] font-black opacity-70 bg-white/20 px-1.5 py-0.5 rounded">PRÓX</span>
                                        )}
                                    </div>
                                    <span className="text-[9px] opacity-70 leading-tight">{acc.desc}</span>
                                </button>
                            ))}
                        </div>

                        {/* Botón principal Detener */}
                        {botStatus?.running && (
                            <div className="px-4 pb-4">
                                <button onClick={detenerAgente} disabled={deteniendoBot}
                                    className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50">
                                    {deteniendoBot ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Detener agente
                                </button>
                            </div>
                        )}

                        {botMsg && (
                            <div className={`mx-4 mb-4 flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl ${botMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {botMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {botMsg.text}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── COLUMNA DERECHA: PANTALLA EN VIVO ──────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col gap-5">

                    {/* PANTALLA EN VIVO */}
                    <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex-1 min-h-[400px] flex flex-col">
                        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-3 flex-shrink-0">
                            <div className={`p-1.5 rounded-lg ${botRunning ? 'bg-green-500/20' : 'bg-slate-800'}`}>
                                <Monitor size={14} className={botRunning ? 'text-green-400' : 'text-slate-500'} />
                            </div>
                            <span className="text-white font-black text-xs uppercase tracking-widest">Pantalla en vivo</span>
                            {botRunning && (
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400 bg-green-500/20 border border-green-500/30 px-2 py-1 rounded-lg animate-pulse">
                                    <Activity size={9} /> EN VIVO
                                </span>
                            )}
                            {screenshotTime && (
                                <span className="ml-auto text-[10px] text-slate-600 font-mono">
                                    {new Date(screenshotTime).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}
                                </span>
                            )}
                        </div>

                        <div className="flex-1 flex items-center justify-center bg-slate-900 relative overflow-hidden">
                            {screenshot ? (
                                <img
                                    ref={screenshotRef}
                                    src={`data:image/jpeg;base64,${screenshot}`}
                                    alt="Pantalla TOA en vivo"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-slate-700">
                                    <Monitor size={48} className="opacity-30" />
                                    <div className="text-center">
                                        <p className="text-sm font-black text-slate-600">Sin señal</p>
                                        <p className="text-xs mt-1 text-slate-700">Inicia el agente para ver la navegación en vivo</p>
                                    </div>
                                    {botRunning && (
                                        <div className="flex items-center gap-2 text-green-500 text-xs font-bold animate-pulse">
                                            <Loader2 size={14} className="animate-spin" /> Conectando...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Barra de progreso integrada */}
                        {botRunning && botStatus?.totalDias > 0 && (
                            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center gap-4 flex-shrink-0">
                                <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${progreso}%` }} />
                                </div>
                                <span className="text-blue-400 text-[11px] font-black">{progreso}%</span>
                                <span className="text-slate-500 text-[10px]">{botStatus.diaActual}/{botStatus.totalDias} días</span>
                                {botStatus.fechaProcesando && (
                                    <span className="text-slate-600 text-[10px] font-mono">{botStatus.fechaProcesando}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* TERMINAL LOGS */}
                    {(botRunning || (botStatus?.logs?.length > 0)) && (
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-800 flex items-center gap-3">
                                <Terminal size={13} className={botRunning ? 'text-green-400' : 'text-slate-500'} />
                                <span className="text-white font-black text-[11px] uppercase tracking-widest">Terminal</span>
                                {botStatus?.grupoProcesando && (
                                    <span className="text-[10px] font-black text-cyan-400 bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded-lg">
                                        {botStatus.grupoProcesando}
                                    </span>
                                )}
                                {pollingFails >= 3 && botRunning && (
                                    <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-lg">
                                        Reconectando...
                                    </span>
                                )}
                                <button onClick={() => setShowLogs(v => !v)}
                                    className="ml-auto text-slate-500 hover:text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                                    {showLogs ? 'Ocultar' : 'Ver'} logs
                                </button>
                            </div>
                            {showLogs && botStatus?.logs && botStatus.logs.length > 0 && (
                                <div className="p-4 max-h-44 overflow-y-auto font-mono">
                                    {[...botStatus.logs].reverse().map((log, i) => (
                                        <div key={i} className={`text-[11px] py-0.5 leading-relaxed ${
                                            log.includes('ERROR') || log.includes('❌') ? 'text-red-400' :
                                            log.includes('✅') || log.includes('🏁') ? 'text-emerald-400' :
                                            log.includes('📋') || log.includes('🔍') ? 'text-blue-400' :
                                            log.includes('📅') ? 'text-cyan-400' :
                                            log.includes('⚠️') ? 'text-yellow-400' :
                                            log.includes('🔑') ? 'text-purple-400' :
                                            'text-slate-400'
                                        }`}>{log}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* TABLA DE PRODUCCIÓN */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Database size={16} className="text-blue-500" />
                        <span className="font-black text-slate-700 text-sm uppercase tracking-wider">Producción TOA</span>
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-lg">{dataRaw.length.toLocaleString()} registros</span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <button onClick={cargarDatos} className="p-2 hover:bg-slate-100 rounded-xl transition-all" title="Actualizar">
                            <RefreshCw size={14} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleExport} disabled={!dataRaw.length}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all">
                            <Download size={13} /> Excel
                        </button>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 w-48" />
                        </div>
                    </div>
                </div>

                {loadingData && dataRaw.length === 0 ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Loader2 size={24} className="animate-spin mr-3" /> Cargando...
                    </div>
                ) : dataRaw.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <Database size={40} className="opacity-20" />
                        <p className="font-black">Sin datos aún</p>
                        <p className="text-xs">Configura credenciales e inicia el agente</p>
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
                                        {dynamicKeys.map(k => {
                                            const val = row[k];
                                            const display = (val === null || val === undefined) ? ''
                                                : (typeof val === 'object') ? JSON.stringify(val)
                                                : String(val);
                                            return (
                                                <td key={k} className="p-2.5 border-r border-slate-50 text-slate-500 whitespace-nowrap max-w-[180px] truncate" title={display}>
                                                    {display}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredData.length > 100 && (
                            <div className="text-center py-4 text-xs text-slate-400 font-bold border-t border-slate-100">
                                Mostrando 100 de {filteredData.length} — Exporta a Excel para ver todos
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DescargaTOA;
