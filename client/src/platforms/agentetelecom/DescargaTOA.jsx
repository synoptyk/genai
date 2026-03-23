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
    const [totalReal, setTotalReal]     = useState(0);   // total real en MongoDB
    const [loadingData, setLoadingData] = useState(true);
    const [busqueda, setBusqueda]       = useState('');
    const [filtroDesde, setFiltroDesde] = useState('');       // rango desde (YYYY-MM-DD)
    const [filtroHasta, setFiltroHasta] = useState('');       // rango hasta (YYYY-MM-DD)
    const [filtroColumna, setFiltroColumna] = useState('');   // columna específica
    const [filtroValor, setFiltroValor]   = useState('');     // valor para esa columna
    const [sortKey, setSortKey]           = useState('fecha'); // columna de orden
    const [sortDir, setSortDir]           = useState('desc');  // 'asc' | 'desc'
    const [paginaActual, setPaginaActual] = useState(1);
    const [filasPorPagina, setFilasPorPagina] = useState(50);
    const [columnasVisibles, setColumnasVisibles] = useState(null); // null = todas
    const [showColManager, setShowColManager] = useState(false);
    const [showCalendario, setShowCalendario] = useState(true);  // calendario integrado
    const [calMesTabla, setCalMesTabla] = useState(() => { const h = new Date(); return { year: h.getFullYear(), month: h.getMonth() }; });
    const [rangeStart, setRangeStart]   = useState(null);        // primer click del rango
    const [deteniendoBot, setDeteniendoBot] = useState(false);
    const [showLogs, setShowLogs]       = useState(true);

    // --- Limpieza inteligente ---
    const [showLimpieza, setShowLimpieza]     = useState(false);
    const [reglasLimpieza, setReglasLimpieza] = useState([{ columna: 'Subtipo de Actividad', operador: 'equals', valor: 'Almuerzo' }]);
    const [previewLimpieza, setPreviewLimpieza] = useState(null); // { total, muestra }
    const [loadingPreview, setLoadingPreview]   = useState(false);
    const [loadingLimpieza, setLoadingLimpieza] = useState(false);
    const [limpiezaMsg, setLimpiezaMsg]         = useState(null);

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
    const cargarDatos = async (desde, hasta) => {
        try {
            setLoadingData(true);
            const params = {};
            // Usar los filtros actuales del estado si no se pasan como argumento
            const d = desde || filtroDesde;
            const h = hasta || filtroHasta;
            if (d) params.desde = d;
            if (h) params.hasta = h;
            const res = await api.get('/bot/datos-toa', { params });
            // Soportar tanto formato nuevo {datos, totalReal} como viejo (array directo)
            if (res.data?.datos && Array.isArray(res.data.datos)) {
                setDataRaw(res.data.datos);
                setTotalReal(res.data.totalReal || res.data.datos.length);
            } else {
                setDataRaw(Array.isArray(res.data) ? res.data : []);
                setTotalReal(Array.isArray(res.data) ? res.data.length : 0);
            }
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
        const i1 = setInterval(() => cargarDatos(), 30000);
        const i4 = setInterval(cargarFechasDescargadas, 30000);
        cargarBotStatus();
        const i2 = setInterval(cargarBotStatus, 3000);
        const i3 = setInterval(cargarScreenshot, 2000); // screenshot cada 2s
        return () => { clearInterval(i1); clearInterval(i2); clearInterval(i3); clearInterval(i4); };
    }, []);

    // ── Recargar datos del servidor cuando cambian los filtros de fecha ──────
    useEffect(() => {
        if (filtroDesde || filtroHasta) {
            cargarDatos(filtroDesde, filtroHasta);
        }
        setPaginaActual(1);
    }, [filtroDesde, filtroHasta]);

    // ── Auto-refresh cuando el bot termina ───────────────────────────────────
    const botRunningPrev = useRef(false);
    useEffect(() => {
        const eraRunning = botRunningPrev.current;
        const ahoraRunning = botRunning;
        botRunningPrev.current = ahoraRunning;
        // Transición running → stopped: refrescar datos y config inmediatamente
        if (eraRunning && !ahoraRunning) {
            setTimeout(() => {
                cargarDatos();
                cargarFechasDescargadas();
                cargarConfigTOA(); // actualiza estadoSync a 'Configurado'
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
            // Actualizar estado local inmediatamente sin esperar el polling
            setBotRunning(false);
            setBotStatus(prev => prev ? { ...prev, running: false } : null);
            setEstadoSync('Configurado');
            setBotMsg({ type: 'ok', text: 'Descarga detenida.' });
            // Refrescar datos tras detener
            setTimeout(() => { cargarDatos(); cargarFechasDescargadas(); }, 1000);
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
        const preferredOrder = [
            "Actividad", "Recurso", "Ventana de servicio", "Ventana de Llegada", "Número de Petición", "Estado", "Subtipo de Actividad", "Nombre", "RUT del cliente", "Ciudad",
            // Columnas derivadas del XML de productos
            "Velocidad_Internet", "Plan_TV", "Telefonia", "Modem", "Deco_Principal",
            "Decos_Adicionales", "Repetidores_WiFi", "Telefonos", "Total_Equipos_Extras",
            "Tipo_Operacion", "Equipos_Detalle", "Total_Productos",
            // Columnas de baremización LPU
            "Pts_Total_Baremo", "Pts_Actividad_Base", "Codigo_LPU_Base", "Desc_LPU_Base",
            "Pts_Deco_Adicional", "Pts_Repetidor_WiFi", "Pts_Telefono"
        ];
        return Array.from(allKeys).filter(k => !ignored.includes(k)).sort((a, b) => {
            const iA = preferredOrder.indexOf(a), iB = preferredOrder.indexOf(b);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1; if (iB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [dataRaw]);

    // Exportar Excel — server-side (TODOS los registros, sin límite)
    const [exportando, setExportando] = useState(false);
    const handleExport = async () => {
        setExportando(true);
        try {
            const params = {};
            if (filtroDesde) params.desde = filtroDesde;
            if (filtroHasta) params.hasta = filtroHasta;
            // Descargar directamente del servidor (archivo binario)
            const res = await api.get('/bot/exportar-toa', { params, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const rangoStr = params.desde && params.hasta ? `_${params.desde}_a_${params.hasta}` : '_COMPLETO';
            link.download = `Produccion_TOA${rangoStr}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error exportando:', e);
            alert('Error al exportar. Intenta con un rango de fechas más pequeño.');
        } finally { setExportando(false); }
    };

    const diasRango    = fechaInicio && fechaFin ? Math.max(1, Math.round((new Date(fechaFin) - new Date(fechaInicio)) / 86400000) + 1) : 0;

    // ── MOTOR DE FILTROS INTELIGENTE ────────────────────────────────────────
    const filteredData = useMemo(() => {
        let result = dataRaw.filter(r => {
            // 1. Filtro por rango de fechas (desde el calendario — client-side refinement)
            if (filtroDesde || filtroHasta) {
                const fechaRow = r.fecha ? new Date(r.fecha).toISOString().split('T')[0] : '';
                if (filtroDesde && fechaRow < filtroDesde) return false;
                if (filtroHasta && fechaRow > filtroHasta) return false;
            }
            // 2. Filtro por columna específica
            if (filtroColumna && filtroValor) {
                const val = r[filtroColumna];
                const str = (val === null || val === undefined) ? '' : String(val).toLowerCase();
                if (!str.includes(filtroValor.toLowerCase())) return false;
            }
            // 3. Búsqueda global de texto
            if (busqueda) return JSON.stringify(r).toLowerCase().includes(busqueda.toLowerCase());
            return true;
        });

        // ORDENAMIENTO
        result.sort((a, b) => {
            let vA, vB;
            if (sortKey === 'fecha') {
                vA = a.fecha ? new Date(a.fecha).getTime() : 0;
                vB = b.fecha ? new Date(b.fecha).getTime() : 0;
            } else {
                vA = (a[sortKey] || '').toString().toLowerCase();
                vB = (b[sortKey] || '').toString().toLowerCase();
                // intentar comparación numérica si ambos son números
                const nA = Number(vA), nB = Number(vB);
                if (!isNaN(nA) && !isNaN(nB) && vA !== '' && vB !== '') { vA = nA; vB = nB; }
            }
            if (vA < vB) return sortDir === 'asc' ? -1 : 1;
            if (vA > vB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [dataRaw, busqueda, filtroDesde, filtroHasta, filtroColumna, filtroValor, sortKey, sortDir]);

    // Paginación
    const totalPaginas  = Math.max(1, Math.ceil(filteredData.length / filasPorPagina));
    const paginaSegura  = Math.min(paginaActual, totalPaginas);
    const datosPagina   = filteredData.slice((paginaSegura - 1) * filasPorPagina, paginaSegura * filasPorPagina);

    // Reset page cuando cambian filtros
    useEffect(() => { setPaginaActual(1); }, [busqueda, filtroDesde, filtroHasta, filtroColumna, filtroValor, sortKey, sortDir]);

    // Columnas visibles (null = todas)
    const displayKeys = useMemo(() => {
        if (!columnasVisibles) return dynamicKeys;
        return dynamicKeys.filter(k => columnasVisibles.includes(k));
    }, [dynamicKeys, columnasVisibles]);

    // Estadísticas rápidas del filtro activo
    const statsActivo = useMemo(() => {
        const tieneFiltro = filtroDesde || filtroHasta || filtroColumna || busqueda;
        if (!tieneFiltro) return null;
        const fechasUnicas = new Set(filteredData.map(r => r.fecha ? new Date(r.fecha).toISOString().split('T')[0] : ''));
        return { total: filteredData.length, fechas: fechasUnicas.size };
    }, [filteredData, filtroDesde, filtroHasta, filtroColumna, busqueda]);

    // Limpiar todos los filtros y recargar datos sin filtro
    const limpiarFiltros = () => {
        setFiltroDesde(''); setFiltroHasta(''); setRangeStart(null);
        setFiltroColumna(''); setFiltroValor(''); setBusqueda('');
        setSortKey('fecha'); setSortDir('desc'); setPaginaActual(1);
        cargarDatos('', '');
    };

    // ── Calendario de tabla — helpers ───────────────────────────────────────
    const descargaMapTabla = useMemo(() => {
        const m = new Map();
        fechasDescargadas.forEach(f => m.set(f.fecha, f.total));
        return m;
    }, [fechasDescargadas]);

    const totalSeleccionado = useMemo(() => {
        if (!filtroDesde) return 0;
        let sum = 0;
        fechasDescargadas.forEach(f => {
            if (f.fecha >= filtroDesde && f.fecha <= (filtroHasta || filtroDesde)) sum += f.total;
        });
        return sum;
    }, [filtroDesde, filtroHasta, fechasDescargadas]);

    const handleCalDayClick = (iso) => {
        if (!descargaMapTabla.has(iso)) return; // solo días con datos
        if (rangeStart && rangeStart !== iso) {
            // Segundo click → completar rango
            const desde = rangeStart < iso ? rangeStart : iso;
            const hasta = rangeStart < iso ? iso : rangeStart;
            setFiltroDesde(desde);
            setFiltroHasta(hasta);
            setRangeStart(null);
        } else {
            // Primer click → iniciar selección (single day por defecto)
            setRangeStart(iso);
            setFiltroDesde(iso);
            setFiltroHasta(iso);
        }
    };

    const isInRange = (iso) => {
        if (!filtroDesde) return false;
        const hasta = filtroHasta || filtroDesde;
        return iso >= filtroDesde && iso <= hasta;
    };

    // ── LIMPIEZA INTELIGENTE ───────────────────────────────────────────────
    const agregarRegla = () => setReglasLimpieza(prev => [...prev, { columna: '', operador: 'equals', valor: '' }]);
    const eliminarRegla = (idx) => setReglasLimpieza(prev => prev.filter((_, i) => i !== idx));
    const actualizarRegla = (idx, campo, valor) => setReglasLimpieza(prev => prev.map((r, i) => i === idx ? { ...r, [campo]: valor } : r));

    const previewLimpiar = async () => {
        const reglasValidas = reglasLimpieza.filter(r => r.columna && (r.operador === 'empty' || r.valor));
        if (!reglasValidas.length) { setLimpiezaMsg({ type: 'err', text: 'Agrega al menos una regla válida.' }); return; }
        setLoadingPreview(true); setLimpiezaMsg(null); setPreviewLimpieza(null);
        try {
            const res = await api.post('/bot/preview-limpieza', { reglas: reglasValidas });
            setPreviewLimpieza(res.data);
        } catch (e) { setLimpiezaMsg({ type: 'err', text: e?.response?.data?.error || 'Error al previsualizar.' }); }
        finally { setLoadingPreview(false); }
    };

    const ejecutarLimpieza = async () => {
        if (!previewLimpieza?.total) return;
        if (!window.confirm(`¿Eliminar permanentemente ${previewLimpieza.total.toLocaleString()} registros? Esta acción NO se puede deshacer.`)) return;
        setLoadingLimpieza(true); setLimpiezaMsg(null);
        try {
            const reglasValidas = reglasLimpieza.filter(r => r.columna && (r.operador === 'empty' || r.valor));
            const res = await api.post('/bot/limpiar-datos', { reglas: reglasValidas, confirmado: true });
            setLimpiezaMsg({ type: 'ok', text: `${res.data.eliminados.toLocaleString()} registros eliminados correctamente.` });
            setPreviewLimpieza(null);
            // Refrescar datos
            setTimeout(() => { cargarDatos(); cargarFechasDescargadas(); }, 500);
        } catch (e) { setLimpiezaMsg({ type: 'err', text: e?.response?.data?.error || 'Error al limpiar.' }); }
        finally { setLoadingLimpieza(false); }
    };

    // Valores únicos para sugerencias rápidas de limpieza
    const valoresUnicos = useMemo(() => {
        const map = {};
        const colsInteres = ['Subtipo de Actividad', 'Estado', 'Actividad', 'Tipo de Actividad'];
        colsInteres.forEach(col => {
            const vals = new Map();
            dataRaw.forEach(r => {
                const v = r[col];
                if (v && typeof v === 'string' && v.trim()) vals.set(v, (vals.get(v) || 0) + 1);
            });
            map[col] = Array.from(vals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
        });
        return map;
    }, [dataRaw]);

    // Toggle sort
    const handleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    };

    const estadoBadge  = { 'Sin configurar': 'bg-slate-100 text-slate-500', 'Configurado': 'bg-emerald-100 text-emerald-700', 'Sincronizando': 'bg-blue-100 text-blue-700', 'Error': 'bg-red-100 text-red-700' }[estadoSync] || 'bg-slate-100 text-slate-500';
    const progreso     = botStatus?.totalDias > 0 ? Math.round((botStatus.diaActual / botStatus.totalDias) * 100) : 0;
    const hayFiltroActivo = filtroDesde || filtroHasta || filtroColumna || busqueda;

    // Botones de acción rápida
    const ACCIONES = [
        { id: 'descargar', label: 'Descargar datos', icon: <Download size={15} />, color: 'bg-blue-600 hover:bg-blue-700', desc: 'Extraer producción del rango', accion: lanzarAgente, disabled: botRunning || !claveConfigurada },
        { id: 'tecnicos',  label: 'Ver técnicos',    icon: <Users size={15} />,    color: 'bg-violet-600 hover:bg-violet-700', desc: 'Leer perfiles del equipo', proximamente: true },
        { id: 'trabajos',  label: 'Ver trabajos',    icon: <Briefcase size={15} />, color: 'bg-cyan-600 hover:bg-cyan-700', desc: 'Trabajos en curso / pendientes', proximamente: true },
        { id: 'excel',     label: 'Exportar Excel',  icon: <FileSpreadsheet size={15} />, color: 'bg-emerald-600 hover:bg-emerald-700', desc: 'Descargar xlsx de producción', accion: handleExport, disabled: exportando || !totalReal },
        { id: 'navegar',   label: 'Navegar TOA',     icon: <Navigation size={15} />, color: 'bg-orange-600 hover:bg-orange-700', desc: 'Abrir y explorar plataforma', proximamente: true },
        { id: 'gestionar', label: 'Gestionar TOA',   icon: <Settings size={15} />,   color: 'bg-slate-700 hover:bg-slate-800', desc: 'Acciones avanzadas del agente', proximamente: true },
    ];

    return (
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 min-h-screen font-sans">

            {/* HEADER — Gradient banner */}
            <div className="relative -mx-4 md:-mx-8 px-4 md:px-8 pt-8 pb-6 mb-8 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2" />

                <div className="relative flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4">
                    <div>
                        <div className="flex items-center gap-4">
                            <div className="p-3.5 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl shadow-2xl">
                                <Bot size={30} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-white tracking-tight">
                                    Agente <span className="text-blue-400">TOA</span>
                                </h1>
                                <p className="text-blue-200/60 text-xs mt-1 font-medium">Oracle Field Service — Extracción inteligente de producción</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/10 ${
                            estadoSync === 'Configurado' ? 'bg-emerald-500/20 text-emerald-300' :
                            estadoSync === 'Sincronizando' ? 'bg-blue-500/20 text-blue-300' :
                            estadoSync === 'Error' ? 'bg-red-500/20 text-red-300' :
                            'bg-white/10 text-white/60'
                        }`}>
                            <Shield size={11} className="inline mr-1.5" />TOA: {estadoSync}
                        </div>
                        {ultimaSync && (
                            <span className="text-[10px] text-blue-200/40 font-medium">
                                Sync: {new Date(ultimaSync).toLocaleString('es-CL')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats cards row */}
                <div className="relative flex flex-wrap gap-3 mt-6">
                    {[
                        { label: 'Total registros', value: totalReal.toLocaleString(), icon: <Database size={14} />, color: 'from-blue-500/20 to-blue-600/10 border-blue-400/20 text-blue-300' },
                        { label: 'Días descargados', value: fechasDescargadas.length.toString(), icon: <Calendar size={14} />, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-400/20 text-emerald-300' },
                        { label: 'Rango del bot', value: `${diasRango} días`, icon: <Clock size={14} />, color: 'from-violet-500/20 to-violet-600/10 border-violet-400/20 text-violet-300' },
                        { label: 'Estado agente', value: botRunning ? 'Ejecutando' : 'Inactivo', icon: <Cpu size={14} />, color: botRunning ? 'from-green-500/20 to-green-600/10 border-green-400/20 text-green-300' : 'from-slate-500/20 to-slate-600/10 border-slate-400/20 text-slate-400' },
                    ].map((stat, i) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r border backdrop-blur-sm ${stat.color}`}>
                            {stat.icon}
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{stat.label}</div>
                                <div className="text-sm font-black">{stat.value}</div>
                            </div>
                        </div>
                    ))}
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

                    {/* RANGO DE FECHAS DEL BOT (compacto) */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/20 flex items-center gap-3">
                            <div className="p-1.5 bg-indigo-100 rounded-lg"><Calendar size={12} className="text-indigo-600" /></div>
                            <span className="font-black text-slate-700 text-sm">Rango de descarga</span>
                            <span className="ml-auto text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">{diasRango} días</span>
                        </div>
                        <div className="p-4">
                            <div className="flex gap-2.5">
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Desde</label>
                                    <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                                        min="2026-01-01" max={fechaFin} disabled={botRunning}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Hasta</label>
                                    <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                                        min={fechaInicio} max={hoyISO} disabled={botRunning}
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50" />
                                </div>
                            </div>
                            {/* Resumen compacto */}
                            {fechaInicio && fechaFin && (() => {
                                const descargaSet = new Set(fechasDescargadas.map(f => f.fecha));
                                let pendientes = 0, yaDescargados = 0;
                                const ini = new Date(fechaInicio + 'T00:00:00');
                                const fin = new Date(fechaFin   + 'T00:00:00');
                                for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
                                    if (descargaSet.has(d.toISOString().split('T')[0])) yaDescargados++; else pendientes++;
                                }
                                return (
                                    <div className="flex gap-2 mt-3">
                                        <div className="flex-1 bg-emerald-50/70 border border-emerald-200/60 rounded-lg px-3 py-1.5 text-center">
                                            <span className="text-sm font-black text-emerald-700">{yaDescargados}</span>
                                            <span className="text-[9px] text-emerald-600 font-bold ml-1.5">descargados</span>
                                        </div>
                                        <div className="flex-1 bg-amber-50/70 border border-amber-200/60 rounded-lg px-3 py-1.5 text-center">
                                            <span className="text-sm font-black text-amber-700">{pendientes}</span>
                                            <span className="text-[9px] text-amber-600 font-bold ml-1.5">pendientes</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* BOTONES DE ACCIÓN */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30 flex items-center gap-3">
                            <div className="p-1.5 bg-blue-100 rounded-lg"><Zap size={12} className="text-blue-600" /></div>
                            <div>
                                <span className="font-black text-slate-700 text-sm block">Acciones del agente</span>
                                <span className="text-[9px] text-slate-400 font-medium">Controla la extracción y exportación</span>
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-2.5">
                            {ACCIONES.map(acc => (
                                <button key={acc.id}
                                    onClick={acc.accion && !acc.proximamente ? acc.accion : undefined}
                                    disabled={acc.disabled || acc.proximamente}
                                    title={acc.proximamente ? 'Próximamente' : acc.desc}
                                    className={`group relative flex flex-col items-start gap-1.5 px-3.5 py-3 rounded-xl text-left transition-all text-white shadow-sm overflow-hidden
                                        ${acc.disabled || acc.proximamente ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.02] hover:shadow-lg cursor-pointer'}
                                        ${acc.color}`}>
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="relative flex items-center gap-2 w-full">
                                        {acc.icon}
                                        <span className="font-black text-[11px] leading-tight">{acc.label}</span>
                                        {acc.proximamente && (
                                            <span className="ml-auto text-[8px] font-black opacity-70 bg-white/20 px-1.5 py-0.5 rounded">PRÓX</span>
                                        )}
                                    </div>
                                    <span className="relative text-[9px] opacity-70 leading-tight">{acc.desc}</span>
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
                    <div className="bg-slate-950 rounded-2xl border border-slate-800/80 shadow-2xl shadow-slate-900/50 overflow-hidden flex-1 min-h-[400px] flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-800/60 bg-gradient-to-r from-slate-900 to-slate-950 flex items-center gap-3 flex-shrink-0">
                            <div className={`p-1.5 rounded-lg transition-colors ${botRunning ? 'bg-green-500/20 shadow-sm shadow-green-500/20' : 'bg-slate-800'}`}>
                                <Monitor size={14} className={botRunning ? 'text-green-400' : 'text-slate-500'} />
                            </div>
                            <span className="text-white/80 font-black text-[11px] uppercase tracking-[0.15em]">Pantalla en vivo</span>
                            {botRunning && (
                                <span className="flex items-center gap-1.5 text-[10px] font-black text-green-400 bg-green-500/15 border border-green-500/25 px-2.5 py-1 rounded-lg">
                                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                                    EN VIVO
                                </span>
                            )}
                            {screenshotTime && (
                                <span className="ml-auto text-[10px] text-slate-600 font-mono">
                                    {new Date(screenshotTime).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}
                                </span>
                            )}
                        </div>

                        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 relative overflow-hidden">
                            {/* Subtle grid pattern */}
                            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                            {screenshot ? (
                                <img
                                    ref={screenshotRef}
                                    src={`data:image/jpeg;base64,${screenshot}`}
                                    alt="Pantalla TOA en vivo"
                                    className="w-full h-full object-contain relative z-[1]"
                                />
                            ) : (
                                <div className="relative z-[1] flex flex-col items-center gap-4 text-slate-700">
                                    <div className="p-6 rounded-full bg-slate-800/50 border border-slate-700/30">
                                        <Monitor size={40} className="opacity-40 text-slate-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-black text-slate-500">Sin señal</p>
                                        <p className="text-[11px] mt-1.5 text-slate-600 max-w-[200px] leading-relaxed">Inicia el agente para ver la navegación en tiempo real</p>
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

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* TABLA DE PRODUCCIÓN — ULTRA ROBUSTA                               */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-200/50 overflow-hidden">

                {/* ── BARRA SUPERIOR ─────────────────────────────────────────── */}
                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-white via-white to-blue-50/30">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm shadow-blue-500/20">
                                <Database size={15} className="text-white" />
                            </div>
                            <div>
                                <span className="font-black text-slate-800 text-sm block tracking-tight">Base de datos de producción</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                                        {statsActivo
                                            ? `${filteredData.length.toLocaleString()} de ${totalReal.toLocaleString()}`
                                            : totalReal > dataRaw.length
                                                ? `${dataRaw.length.toLocaleString()} de ${totalReal.toLocaleString()}`
                                                : totalReal.toLocaleString()
                                        } registros
                                    </span>
                                    {statsActivo && (
                                        <span className="bg-violet-100 text-violet-700 text-[10px] font-black px-2 py-0.5 rounded-md">
                                            {statsActivo.fechas} {statsActivo.fechas === 1 ? 'día' : 'días'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {/* Toggle calendario */}
                            <button onClick={() => setShowCalendario(p => !p)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showCalendario ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                                <Calendar size={13} /> {filtroDesde ? (filtroDesde === filtroHasta
                                    ? new Date(filtroDesde + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' })
                                    : `${new Date(filtroDesde + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' })} → ${new Date(filtroHasta + 'T00:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' })}`
                                ) : 'Calendario'}
                            </button>
                            {filtroDesde && (
                                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-1 rounded-lg">
                                    {totalSeleccionado.toLocaleString()} órdenes
                                </span>
                            )}
                            {/* Filtro por columna */}
                            <select value={filtroColumna} onChange={e => { setFiltroColumna(e.target.value); setFiltroValor(''); }}
                                className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 max-w-[150px]">
                                <option value="">Filtrar columna</option>
                                {dynamicKeys.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                            {filtroColumna && (
                                <input type="text" placeholder={`Buscar en ${filtroColumna}...`} value={filtroValor}
                                    onChange={e => setFiltroValor(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 w-36" />
                            )}
                            {/* Búsqueda global */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input type="text" placeholder="Buscar global..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-8 pr-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/30 w-36" />
                            </div>
                            {/* Limpiar filtros */}
                            {hayFiltroActivo && (
                                <button onClick={limpiarFiltros}
                                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all">
                                    <X size={12} /> Limpiar
                                </button>
                            )}
                            {/* Limpieza inteligente */}
                            <button onClick={() => setShowLimpieza(p => !p)}
                                className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${showLimpieza ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-red-300 hover:bg-red-50'}`}
                                title="Limpieza inteligente de datos">
                                <Zap size={12} /> Limpiar
                            </button>
                            {/* Gestión columnas */}
                            <button onClick={() => setShowColManager(p => !p)}
                                className={`p-2 rounded-xl transition-all border ${showColManager ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                                title="Gestionar columnas">
                                <Settings size={13} />
                            </button>
                            <button onClick={() => { cargarDatos(); cargarFechasDescargadas(); }}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all border border-slate-200" title="Actualizar datos">
                                <RefreshCw size={13} className={`text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={handleExport} disabled={exportando || !totalReal}
                                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all">
                                {exportando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                {exportando ? 'Generando...' : `Excel ${filtroDesde ? `(${totalSeleccionado.toLocaleString()})` : `(${totalReal.toLocaleString()})`}`}
                            </button>
                        </div>
                    </div>

                    {/* ── CALENDARIO INTEGRADO DE FECHAS ────────────────────── */}
                    {showCalendario && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            {/* Atajos rápidos + navegación */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                {[
                                    { label: 'Hoy', fn: () => { setFiltroDesde(hoyISO); setFiltroHasta(hoyISO); setRangeStart(null); const h = new Date(); setCalMesTabla({ year: h.getFullYear(), month: h.getMonth() }); } },
                                    { label: 'Ayer', fn: () => { const d = new Date(); d.setDate(d.getDate()-1); const y = d.toISOString().split('T')[0]; setFiltroDesde(y); setFiltroHasta(y); setRangeStart(null); setCalMesTabla({ year: d.getFullYear(), month: d.getMonth() }); } },
                                    { label: 'Últ. 7 días', fn: () => { const d = new Date(); d.setDate(d.getDate()-6); setFiltroDesde(d.toISOString().split('T')[0]); setFiltroHasta(hoyISO); setRangeStart(null); } },
                                    { label: 'Últ. 30 días', fn: () => { const d = new Date(); d.setDate(d.getDate()-29); setFiltroDesde(d.toISOString().split('T')[0]); setFiltroHasta(hoyISO); setRangeStart(null); } },
                                    { label: 'Este mes', fn: () => { const d = new Date(); setFiltroDesde(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setFiltroHasta(hoyISO); setRangeStart(null); } },
                                    { label: 'Todos', fn: () => { setFiltroDesde(''); setFiltroHasta(''); setRangeStart(null); cargarDatos('', ''); } },
                                ].map(a => (
                                    <button key={a.label} onClick={a.fn}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-all">
                                        {a.label}
                                    </button>
                                ))}
                                {filtroDesde && (
                                    <button onClick={() => { setFiltroDesde(''); setFiltroHasta(''); setRangeStart(null); cargarDatos('', ''); }}
                                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 transition-all">
                                        <X size={11} /> Quitar filtro
                                    </button>
                                )}
                                {rangeStart && (
                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg animate-pulse">
                                        Selecciona el segundo día para completar el rango
                                    </span>
                                )}
                            </div>

                            {/* Grilla del calendario — 2 meses lado a lado */}
                            <div className="flex gap-4 overflow-x-auto pb-1">
                                {[0, 1].map(offset => {
                                    const mesObj = new Date(calMesTabla.year, calMesTabla.month + offset, 1);
                                    const year = mesObj.getFullYear();
                                    const month = mesObj.getMonth();
                                    const diasEnMes = new Date(year, month + 1, 0).getDate();
                                    const primerDia = new Date(year, month, 1).getDay(); // 0=Dom
                                    const startOffset = primerDia === 0 ? 6 : primerDia - 1; // Lun=0
                                    const nombreMes = mesObj.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

                                    return (
                                        <div key={`${year}-${month}`} className="min-w-[260px]">
                                            {offset === 0 && (
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <button onClick={() => setCalMesTabla(p => { const d = new Date(p.year, p.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-all text-xs">◀</button>
                                                    <span className="text-[11px] font-black text-slate-600 capitalize">{nombreMes}</span>
                                                    <button onClick={() => setCalMesTabla(p => { const d = new Date(p.year, p.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
                                                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-all text-xs">▶</button>
                                                </div>
                                            )}
                                            {offset === 1 && (
                                                <div className="flex items-center justify-center mb-1.5">
                                                    <span className="text-[11px] font-black text-slate-600 capitalize">{nombreMes}</span>
                                                </div>
                                            )}
                                            {/* Header días */}
                                            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                                                {['L','M','X','J','V','S','D'].map(d => (
                                                    <div key={d} className="text-center text-[8px] font-black text-slate-400 py-0.5">{d}</div>
                                                ))}
                                            </div>
                                            {/* Días */}
                                            <div className="grid grid-cols-7 gap-0.5">
                                                {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
                                                {Array.from({ length: diasEnMes }).map((_, i) => {
                                                    const day = i + 1;
                                                    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                                    const total = descargaMapTabla.get(iso);
                                                    const tieneDatos = !!total;
                                                    const seleccionado = isInRange(iso);
                                                    const esHoy = iso === hoyISO;
                                                    const esRangeStart = rangeStart === iso;

                                                    let bg = 'bg-white text-slate-300';
                                                    if (seleccionado) bg = 'bg-blue-600 text-white shadow-sm';
                                                    else if (tieneDatos) bg = 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
                                                    else bg = 'bg-white text-slate-300';
                                                    if (esRangeStart) bg = 'bg-amber-500 text-white shadow-sm';
                                                    if (esHoy && !seleccionado && !esRangeStart) bg += ' ring-1 ring-blue-400';

                                                    return (
                                                        <button key={iso} onClick={() => handleCalDayClick(iso)}
                                                            disabled={!tieneDatos}
                                                            title={tieneDatos ? `${iso}: ${total.toLocaleString()} órdenes` : iso}
                                                            className={`relative rounded p-0.5 text-center transition-all ${bg} ${tieneDatos ? 'cursor-pointer hover:scale-105' : 'cursor-default opacity-50'}`}>
                                                            <div className="text-[10px] font-bold leading-tight">{day}</div>
                                                            {tieneDatos && (
                                                                <div className={`text-[7px] font-black leading-tight ${seleccionado || esRangeStart ? 'text-white/80' : 'text-emerald-500'}`}>
                                                                    {total >= 1000 ? `${(total/1000).toFixed(1)}k` : total}
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Panel gestión de columnas ──────────────────────────── */}
                    {showColManager && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase">Columnas visibles</span>
                                <button onClick={() => setColumnasVisibles(null)}
                                    className="text-[9px] font-bold text-blue-600 hover:underline">Mostrar todas</button>
                                <button onClick={() => setColumnasVisibles(dynamicKeys.slice(0, 8))}
                                    className="text-[9px] font-bold text-blue-600 hover:underline">Solo principales</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {dynamicKeys.map(k => {
                                    const activo = !columnasVisibles || columnasVisibles.includes(k);
                                    return (
                                        <button key={k} onClick={() => {
                                            if (!columnasVisibles) {
                                                setColumnasVisibles(dynamicKeys.filter(dk => dk !== k));
                                            } else {
                                                setColumnasVisibles(prev =>
                                                    prev.includes(k) ? prev.filter(p => p !== k) : [...prev, k]
                                                );
                                            }
                                        }}
                                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-all ${activo
                                                ? 'bg-blue-100 text-blue-700 border-blue-300'
                                                : 'bg-slate-50 text-slate-400 border-slate-200 line-through'}`}>
                                            {activo && <Check size={9} className="inline mr-0.5" />}{k}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Panel LIMPIEZA INTELIGENTE ──────────────────────────── */}
                    {showLimpieza && (
                        <div className="mt-3 pt-3 border-t border-red-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Zap size={14} className="text-red-500" />
                                <span className="text-[11px] font-black text-red-700 uppercase tracking-wider">Limpieza inteligente de datos</span>
                                <span className="text-[9px] text-slate-400 font-bold ml-2">Elimina filas irrelevantes para liberar almacenamiento</span>
                            </div>

                            {/* Reglas de limpieza */}
                            <div className="space-y-2 mb-3">
                                {reglasLimpieza.map((regla, idx) => (
                                    <div key={idx} className="flex flex-wrap items-center gap-2 bg-red-50/50 rounded-lg p-2 border border-red-100">
                                        <span className="text-[9px] font-black text-red-400 w-6 text-center">{idx + 1}</span>
                                        <select value={regla.columna} onChange={e => actualizarRegla(idx, 'columna', e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/30 min-w-[150px]">
                                            <option value="">Seleccionar columna...</option>
                                            {dynamicKeys.map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                        <select value={regla.operador} onChange={e => actualizarRegla(idx, 'operador', e.target.value)}
                                            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none min-w-[100px]">
                                            <option value="equals">es igual a</option>
                                            <option value="contains">contiene</option>
                                            <option value="starts">empieza con</option>
                                            <option value="empty">está vacío</option>
                                        </select>
                                        {regla.operador !== 'empty' && (
                                            <div className="relative">
                                                <input type="text" value={regla.valor} onChange={e => actualizarRegla(idx, 'valor', e.target.value)}
                                                    placeholder="Valor..." list={`sug-${idx}`}
                                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/30 w-40" />
                                                {regla.columna && valoresUnicos[regla.columna] && (
                                                    <datalist id={`sug-${idx}`}>
                                                        {valoresUnicos[regla.columna].map(([v, c]) => (
                                                            <option key={v} value={v}>{v} ({c})</option>
                                                        ))}
                                                    </datalist>
                                                )}
                                            </div>
                                        )}
                                        {reglasLimpieza.length > 1 && (
                                            <button onClick={() => eliminarRegla(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <button onClick={agregarRegla}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all">
                                    + Agregar regla
                                </button>
                                <span className="text-[9px] text-slate-400 font-bold ml-2">Presets:</span>
                                <button onClick={() => setReglasLimpieza([{ columna: 'Subtipo de Actividad', operador: 'equals', valor: 'Almuerzo' }])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">
                                    Almuerzos
                                </button>
                                <button onClick={() => setReglasLimpieza([{ columna: 'Estado', operador: 'equals', valor: 'Cancelado' }])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all">
                                    Cancelados
                                </button>
                                <button onClick={() => setReglasLimpieza([
                                    { columna: 'Subtipo de Actividad', operador: 'equals', valor: 'Almuerzo' },
                                    { columna: 'Estado', operador: 'equals', valor: 'Cancelado' }
                                ])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all">
                                    Almuerzos + Cancelados
                                </button>
                                <button onClick={() => setReglasLimpieza([{ columna: 'Nombre', operador: 'empty', valor: '' }])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-all">
                                    Sin nombre
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={previewLimpiar} disabled={loadingPreview}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-all shadow-sm">
                                    {loadingPreview ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                                    Previsualizar
                                </button>
                                {previewLimpieza && previewLimpieza.total > 0 && (
                                    <button onClick={ejecutarLimpieza} disabled={loadingLimpieza}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-all shadow-sm">
                                        {loadingLimpieza ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                        Eliminar {previewLimpieza.total.toLocaleString()} registros
                                    </button>
                                )}
                            </div>

                            {previewLimpieza && (
                                <div className={`mt-3 p-3 rounded-xl border ${previewLimpieza.total > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle size={14} className={previewLimpieza.total > 0 ? 'text-red-500' : 'text-emerald-500'} />
                                        <span className={`text-[11px] font-black ${previewLimpieza.total > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                            {previewLimpieza.total > 0
                                                ? `${previewLimpieza.total.toLocaleString()} registros coinciden y serán eliminados`
                                                : 'No se encontraron registros que coincidan'}
                                        </span>
                                    </div>
                                    {previewLimpieza.muestra && previewLimpieza.muestra.length > 0 && (
                                        <div className="mt-2">
                                            <span className="text-[9px] text-red-500 font-bold uppercase">Muestra de registros a eliminar:</span>
                                            <div className="mt-1 space-y-1">
                                                {previewLimpieza.muestra.map((m, i) => (
                                                    <div key={i} className="text-[10px] text-red-600 bg-white/60 rounded px-2 py-1 font-mono">
                                                        {m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '—'} | {m.subtipo || m.actividad || '—'} | {m.estado} | {m.nombre || '—'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {limpiezaMsg && (
                                <div className={`mt-2 px-3 py-2 rounded-lg text-[10px] font-bold ${limpiezaMsg.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {limpiezaMsg.type === 'ok' ? <CheckCircle2 size={12} className="inline mr-1" /> : <AlertCircle size={12} className="inline mr-1" />}
                                    {limpiezaMsg.text}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── CONTENIDO TABLA ─────────────────────────────────────────── */}
                {loadingData && dataRaw.length === 0 ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Loader2 size={24} className="animate-spin mr-3" /> Cargando datos...
                    </div>
                ) : dataRaw.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                        <Database size={40} className="opacity-20" />
                        <p className="font-black">Sin datos aún</p>
                        <p className="text-xs">Configura credenciales e inicia el agente para extraer datos</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Search size={32} className="opacity-30" />
                        <p className="font-black text-sm">Sin resultados</p>
                        <p className="text-xs">No se encontraron registros con los filtros actuales</p>
                        <button onClick={limpiarFiltros} className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all">
                            Limpiar filtros
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="overflow-auto max-h-[650px]">
                            <table className="w-full text-[11px] border-collapse">
                                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                                    <tr>
                                        <th onClick={() => handleSort('fecha')}
                                            className="p-3 text-left font-black whitespace-nowrap sticky left-0 bg-slate-800 z-20 border-r border-slate-700/50 cursor-pointer hover:bg-slate-700 select-none transition-colors text-[10px] uppercase tracking-wider">
                                            Fecha {sortKey === 'fecha' && <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                                        </th>
                                        {displayKeys.map(k => (
                                            <th key={k} onClick={() => handleSort(k)}
                                                className="p-3 text-left font-black whitespace-nowrap border-r border-slate-700/50 min-w-[90px] cursor-pointer hover:bg-slate-700 select-none transition-colors text-[10px] uppercase tracking-wider">
                                                {k} {sortKey === k && <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {datosPagina.map((row, idx) => (
                                        <tr key={idx} className={`transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/60`}>
                                            <td className="p-2.5 border-r border-slate-100 sticky left-0 font-bold text-slate-600 whitespace-nowrap"
                                                style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                {row.fecha ? new Date(row.fecha).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '—'}
                                            </td>
                                            {displayKeys.map(k => {
                                                const val = row[k];
                                                const display = (val === null || val === undefined) ? ''
                                                    : (typeof val === 'object') ? JSON.stringify(val)
                                                    : String(val);
                                                return (
                                                    <td key={k} className="p-2.5 border-r border-slate-50 text-slate-500 whitespace-nowrap max-w-[200px] truncate" title={display}>
                                                        {display}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* ── BARRA PAGINACIÓN ───────────────────────────────── */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-500 font-bold">
                                    {((paginaSegura - 1) * filasPorPagina + 1).toLocaleString()}–{Math.min(paginaSegura * filasPorPagina, filteredData.length).toLocaleString()} de {filteredData.length.toLocaleString()}
                                </span>
                                <select value={filasPorPagina} onChange={e => { setFilasPorPagina(Number(e.target.value)); setPaginaActual(1); }}
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 outline-none">
                                    {[25, 50, 100, 250, 500].map(n => <option key={n} value={n}>{n} filas</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setPaginaActual(1)} disabled={paginaSegura <= 1}
                                    className="px-2 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    ««
                                </button>
                                <button onClick={() => setPaginaActual(p => Math.max(1, p - 1))} disabled={paginaSegura <= 1}
                                    className="px-2.5 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    ‹
                                </button>
                                {/* Números de página */}
                                {(() => {
                                    const pages = [];
                                    const start = Math.max(1, paginaSegura - 2);
                                    const end = Math.min(totalPaginas, paginaSegura + 2);
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    return pages.map(p => (
                                        <button key={p} onClick={() => setPaginaActual(p)}
                                            className={`px-2.5 py-1 rounded text-[10px] font-black transition-all border ${p === paginaSegura
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'}`}>
                                            {p}
                                        </button>
                                    ));
                                })()}
                                <button onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))} disabled={paginaSegura >= totalPaginas}
                                    className="px-2.5 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    ›
                                </button>
                                <button onClick={() => setPaginaActual(totalPaginas)} disabled={paginaSegura >= totalPaginas}
                                    className="px-2 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    »»
                                </button>
                                <span className="text-[9px] text-slate-400 font-bold ml-2">Pág {paginaSegura}/{totalPaginas}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DescargaTOA;
