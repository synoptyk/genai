import React, { useState, useEffect, useRef, useMemo } from 'react';
import { telecomApi as api } from './telecomApi';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
    Bot, Play, Loader2, CheckCircle2, AlertCircle,
    Key, User, Eye, EyeOff, Save, Download,
    Calendar, Database, Shield, RefreshCw, Search,
    Terminal, Cpu, Clock, Square, List, Check, X,
    Globe, Edit3, Monitor, Users, Briefcase,
    FileSpreadsheet, Settings, Navigation, ChevronRight, FileText,
    Lock, Unlock, Zap, Activity, DollarSign, Users as UsersIcon
} from 'lucide-react';
import MultiSearchableSelect from '../../components/MultiSearchableSelect';
import { adminApi } from '../rrhh/rrhhApi';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ═══════════════════════════════════════════════════════════════════════
// SIN FILTRO DE COLUMNAS — MOSTRAR TODAS LAS COLUMNAS DE LA BASE DE DATOS
// ═══════════════════════════════════════════════════════════════════════
// Todas las columnas que vengan de MongoDB se mostrarán exactamente como están

const DescargaTOA = () => {
    const navigate = useNavigate();
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
    const [ultimaFallaRed, setUltimaFallaRed] = useState('');
    const datosInFlightRef = useRef(false);
    const datosBackoffUntilRef = useRef(0);
    const statusInFlightRef = useRef(false);
    const screenshotInFlightRef = useRef(false);
    const botRunningRef = useRef(false);

    // --- Grupos (ya no se necesita selección manual) ---

    // --- Live screenshot ---
    const [screenshot, setScreenshot]   = useState(null);
    const [screenshotTime, setScreenshotTime] = useState(null);
    const screenshotRef = useRef(null);

    // --- Tabla ---
    const [dataRaw, setDataRaw]         = useState([]);
    const [totalReal, setTotalReal]     = useState(0);   // total real en MongoDB
    const [totalPaginasServer, setTotalPaginasServer] = useState(1);
    const [loadingData, setLoadingData] = useState(true);
    const [busquedaInput, setBusquedaInput] = useState(''); // estado tipeo
    const [busqueda, setBusqueda]       = useState('');     // debounced
    const [filtroDesde, setFiltroDesde] = useState('');       // rango desde (YYYY-MM-DD)
    const [filtroHasta, setFiltroHasta] = useState('');       // rango hasta (YYYY-MM-DD)
    const [filtroColumna, setFiltroColumna] = useState('');   // columna específica
    const [filtroValor, setFiltroValor]   = useState('');     // valor para esa columna
    const [sortKey, setSortKey]           = useState('fecha'); // columna de orden
    const [sortDir, setSortDir]           = useState('desc');  // 'asc' | 'desc'
    const [paginaActual, setPaginaActual] = useState(1);
    const [filasPorPagina, setFilasPorPagina] = useState(10000); // Mostrar todos los registros por defecto
    const [columnasVisibles, setColumnasVisibles] = useState(null); // null = todas
    const [showColManager, setShowColManager] = useState(false);
    const [showCalendario, setShowCalendario] = useState(true);  // calendario integrado
    const [calMesTabla, setCalMesTabla] = useState(() => { const h = new Date(); return { year: h.getFullYear(), month: h.getMonth() }; });
    const [rangeStart, setRangeStart]   = useState(null);        // primer click del rango
    const [deteniendoBot, setDeteniendoBot] = useState(false);
    const [showLogs, setShowLogs]       = useState(true);
    const [selectedClientes, setSelectedClientes] = useState([]);
    const [availableClientes, setAvailableClientes] = useState([]);

    // --- Limpieza inteligente ---
    const [showLimpieza, setShowLimpieza]     = useState(false);
    const [reglasLimpieza, setReglasLimpieza] = useState([{ columna: 'Subtipo de Actividad', operador: 'equals', valor: 'Almuerzo' }]);
    const [previewLimpieza, setPreviewLimpieza] = useState(null); // { total, muestra }
    const [loadingPreview, setLoadingPreview]   = useState(false);
    const [loadingLimpieza, setLoadingLimpieza] = useState(false);
    const [limpiezaMsg, setLimpiezaMsg]         = useState(null);
    const [confirmandoStop, setConfirmandoStop]         = useState(false);
    const [confirmandoLimpieza, setConfirmandoLimpieza] = useState(false);

    // --- Recálculo MongoDB ---
    const [recalculando, setRecalculando] = useState(false);
    const [recalculoStats, setRecalculoStats] = useState(null);

    const [fechasDescargadas, setFechasDescargadas] = useState([]);
    const [mesCalendario, setMesCalendario]         = useState(() => {
        const h = new Date(); return { year: h.getFullYear(), month: h.getMonth() };
    });

    const isTransientNetworkError = (e) => {
        const code = String(e?.code || '').toLowerCase();
        const msg = String(e?.message || '').toLowerCase();
        return code.includes('err_network') || msg.includes('network') || msg.includes('quic') || msg.includes('timeout') || msg.includes('err_network_changed');
    };

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
        if (statusInFlightRef.current) return;
        statusInFlightRef.current = true;
        try {
            const res = await api.get('/bot/status');
            const data = res.data;
            setBotStatus(data);
            setPollingFails(0);
            setUltimaFallaRed('');
            setBotRunning(!!data.running);
        } catch (e) {
            setPollingFails(prev => prev + 1);
            if (isTransientNetworkError(e)) {
                setUltimaFallaRed(e?.message || 'Error de red transitorio');
            }
        } finally {
            statusInFlightRef.current = false;
        }
    };

    // ── Polling screenshot en vivo ────────────────────────────────────────────
    const cargarScreenshot = async () => {
        if (screenshotInFlightRef.current) return;
        screenshotInFlightRef.current = true;
        try {
            const res = await api.get('/bot/screenshot');
            if (res.status === 204) return;
            if (res.data?.data) {
                setScreenshot(res.data.data);
                setScreenshotTime(res.data.time);
            }
        } catch (_) {
        } finally {
            screenshotInFlightRef.current = false;
        }
    };

    // ── Cargar datos producción ───────────────────────────────────────────────
    const cargarDatos = async (desde, hasta) => {
        if (datosInFlightRef.current) return;
        if (Date.now() < datosBackoffUntilRef.current) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setUltimaFallaRed('Sin conexión de red');
            return;
        }
        datosInFlightRef.current = true;
        setLoadingData(true);
        try {
            const d = desde || filtroDesde;
            const h = hasta || filtroHasta;
            const params = {
                page: paginaActual,
                limit: filasPorPagina,
                sortKey,
                sortDir
            };
            if (busqueda.trim()) params.busqueda = busqueda.trim();
            if (d) params.desde = d;
            if (h) params.hasta = h;
            if (selectedClientes && selectedClientes.length > 0) params.clientes = selectedClientes;

            const res = await api.get('/bot/datos-toa-espejo', { params });
            datosBackoffUntilRef.current = 0;
            setUltimaFallaRed('');
            if (res.data?.datos && Array.isArray(res.data.datos)) {
                setDataRaw(res.data.datos);
                setTotalReal(res.data.totalReal || res.data.datos.length);
                setTotalPaginasServer(res.data.totalPaginas || 1);
            } else {
                setDataRaw(Array.isArray(res.data) ? res.data : []);
                setTotalReal(Array.isArray(res.data) ? res.data.length : 0);
                setTotalPaginasServer(1);
            }
        } catch (e) {
            if (isTransientNetworkError(e)) {
                setUltimaFallaRed(e?.message || 'Error de red transitorio');
                datosBackoffUntilRef.current = Date.now() + 5000;
            } else {
                console.error('Datos TOA', e);
            }
        } finally {
            setLoadingData(false);
            datosInFlightRef.current = false;
        }
    };

    // ── Cargar fechas ya descargadas ──────────────────────────────────────────
    const cargarFechasDescargadas = async () => {
        try {
            const res = await api.get('/bot/fechas-descargadas');
            setFechasDescargadas(res.data?.fechas || []);
        } catch (e) { console.error('Fechas descargadas', e); }
    };


    useEffect(() => {
        botRunningRef.current = botRunning;
    }, [botRunning]);

    useEffect(() => {
        cargarConfigTOA();
        cargarDatos();
        cargarFechasDescargadas();
        adminApi.getClientes().then(res => setAvailableClientes(res.data)).catch(() => {});

        const i1 = setInterval(() => {
            if (document.visibilityState === 'visible') cargarDatos();
        }, 60000); // 1 min

        const i4 = setInterval(cargarFechasDescargadas, 45000); // 45s
        
        cargarBotStatus();
        const i2 = setInterval(cargarBotStatus, 5000); // 5s

        const i3 = setInterval(() => {
            if (document.visibilityState === 'visible' && botRunningRef.current) {
                cargarScreenshot();
            }
        }, 4000); // 4s

        return () => { 
            clearInterval(i1); 
            clearInterval(i2); 
            clearInterval(i3); 
            clearInterval(i4); 
        };
    }, []);

    // ── Debounce de Búsqueda ────────────────────────────────────────────────
    useEffect(() => {
        const handler = setTimeout(() => {
            setBusqueda(busquedaInput);
            setPaginaActual(1); // Reset page on new search
        }, 500);
        return () => clearTimeout(handler);
    }, [busquedaInput]);

    // ── Recargar datos del servidor al detectar cambios paramétricos ─────────
    useEffect(() => {
        cargarDatos(filtroDesde, filtroHasta);
    }, [filtroDesde, filtroHasta, busqueda, paginaActual, filasPorPagina, sortKey, sortDir, selectedClientes]);

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
        setDeteniendoBot(true);
        setConfirmandoStop(false);
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
    // ═══════════════════════════════════════════════════════════════════════
    // FUNCIÓN: Normalizar nombres de columnas (deduplicar variaciones)
    // ═══════════════════════════════════════════════════════════════════════
    // dynamicKeys: TODAS las columnas que vienen en los datos, sin transformaciones
    const dynamicKeys = useMemo(() => {
        if (!dataRaw || dataRaw.length === 0) return [];

        // Extraer todas las claves únicas de todos los registros
        const allKeys = new Set();
        dataRaw.forEach(row => {
            Object.keys(row).forEach(key => {
                allKeys.add(key);
            });
        });

        // Convertir a array, ordenar alfabéticamente y retornar
        // SIN renombres, sin filtrados, exactamente como vienen del API
        return Array.from(allKeys).sort();
    }, [dataRaw]);

    // Exportar Excel — server-side (TODOS los registros, sin límite)
    const [exportando, setExportando] = useState(false);
    const [exportandoPDF, setExportandoPDF] = useState(false);
    const [recalculandoDecos, setRecalculandoDecos] = useState(false);
    const [sincronizando, setSincronizando] = useState(false);
    const [sincronizacionStats, setSincronizacionStats] = useState(null);

    const handleExport = async () => {
        setExportando(true);
        try {
            const params = {};
            if (filtroDesde) params.desde = filtroDesde;
            if (filtroHasta) params.hasta = filtroHasta;
            if (selectedClientes && selectedClientes.length > 0) params.clientes = selectedClientes;

            // Usar endpoint estándar (probado y funcional)
            console.log('📥 Iniciando descarga...');

            const res = await api.get('/bot/exportar-toa', {
                params,
                responseType: 'arraybuffer',
                timeout: 300000  // 5 minutos para grandes volúmenes
            });

            // Verificar si es un JSON de error (convertimos arraybuffer a string si el content-type es json)
            const contentType = res.headers['content-type'];
            if (contentType && contentType.includes('application/json')) {
                const enc = new TextDecoder("utf-8");
                const errData = JSON.parse(enc.decode(res.data));
                alert(`Error al exportar: ${errData.error || 'No se pudo generar el archivo'}`);
                setExportando(false);
                return;
            }

            // Crear el Blob desde el ArrayBuffer
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const rangoStr = params.desde && params.hasta ? `_${params.desde}_a_${params.hasta}` : '_COMPLETO';
            const filename = `Produccion_TOA${rangoStr}_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Usar FileReader para convertir a DataURL (fuerza al navegador a reconocer el nombre con más fiabilidad)
            const reader = new FileReader();
            reader.onload = (e) => {
                const link = document.createElement('a');
                link.href = e.target.result;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                
                // Limpieza tras el click
                setTimeout(() => {
                    if (link.parentNode) document.body.removeChild(link);
                }, 500);
            };
            reader.readAsDataURL(blob);
            
        } catch (e) {
            console.error('Error exportando:', e);
            alert('Error al exportar. Si el rango de fechas es muy amplio, intente reducirlo o verifique su conexión.');
        } finally { 
            setExportando(false); 
        }
    };

    const handleExportPDF = async () => {
        const tableElement = document.querySelector('table');
        if (!tableElement) {
            alert('No hay datos en la tabla para exportar a PDF');
            return;
        }

        setExportandoPDF(true);
        // Pequeño delay para permitir que el DOM se asiente
        setTimeout(async () => {
            try {
                const canvas = await html2canvas(tableElement, {
                    scale: 1.5,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: -window.scrollY, // Mantener visualmente el elemento
                    ignoreElements: (el) => el.classList.contains('sticky') || el.classList.contains('print:hidden')
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.8);
                const pdf = new jsPDF('l', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                pdf.setFontSize(14);
                pdf.setTextColor(15, 23, 42); // slate-900
                pdf.text('Reporte de Producción TOA - Agente Telecom', 10, 15);
                pdf.setFontSize(9);
                pdf.setTextColor(100, 116, 139); // slate-500
                pdf.text(`Filtros: ${filtroDesde || 'Inicio'} al ${filtroHasta || 'Fin'} | Registros: ${dataRaw.length}`, 10, 22);
                
                pdf.addImage(imgData, 'JPEG', 5, 30, pdfWidth - 10, Math.min(pdfHeight, 170));
                pdf.save(`Reporte_TOA_${new Date().toISOString().split('T')[0]}.pdf`);
            } catch (error) {
                console.error('Error generando PDF:', error);
                alert('Error al generar el PDF. Si el error persiste, intente refrescar la página.');
            } finally {
                setExportandoPDF(false);
            }
        }, 150);
    };

    const recalcularDecosWifi = async () => {
        if (recalculandoDecos) return;
        const ok = window.confirm('Esto actualizara los decodificadores adicionales a tarifa WiFi (0.25) en toda la base de datos de tu empresa. Deseas continuar?');
        if (!ok) return;
        setRecalculandoDecos(true);
        try {
            const { data } = await api.post('/bot/recalcular-decos');
            setBotMsg({
                type: 'ok',
                text: `Decos recalculados OK. Actualizados: ${data?.updated || 0}, sin cambios: ${data?.skipped || 0}, tarifa aplicada: ${data?.decoWifiPts || 0.25}`
            });
            await cargarDatos();
            await cargarFechasDescargadas();
        } catch (e) {
            setBotMsg({ type: 'err', text: e?.response?.data?.error || 'Error al recalcular decos WiFi.' });
        } finally {
            setRecalculandoDecos(false);
        }
    };

    const handleRecalcularMongoDB = async () => {
        if (!filtroDesde || !filtroHasta) {
            alert('Por favor selecciona un rango de fechas primero');
            return;
        }

        if (recalculando) return;

        const ok = window.confirm(
            `Esto recalculará todas las actividades sin puntos entre ${filtroDesde} y ${filtroHasta} usando la configuración LPU actual.\n\n` +
            `Se aplicarán los baremos y se calcularán los puntos correctamente.\n\n¿Deseas continuar?`
        );
        if (!ok) return;

        setRecalculando(true);
        console.log('📥 Iniciando recálculo MongoDB:', { fechaInicio: filtroDesde, fechaFin: filtroHasta });

        try {
            const payload = {
                fechaInicio: filtroDesde,
                fechaFin: filtroHasta
            };
            console.log('📤 Enviando payload:', payload);

            const res = await api.post('/recalcular-actividades-mongodb', payload);
            console.log('📥 Respuesta del servidor:', res.data);

            if (res.data.success && res.data.stats) {
                const stats = res.data.stats;
                setRecalculoStats(stats);
                setBotMsg({
                    type: 'ok',
                    text: `✅ Recálculo completado. Actualizadas: ${stats.recalculadas} | Con puntos: ${stats.totalConPuntos}/${stats.totalActividades} | Puntos totales: ${stats.totalPuntos} | Cobertura: ${stats.porcentajeCobertura}%`
                });
                console.log('✅ Éxito:', stats);

                // Recargar datos después de 1.5 segundos
                setTimeout(async () => {
                    await cargarDatos(filtroDesde, filtroHasta);
                    await cargarFechasDescargadas();
                }, 1500);
            } else {
                console.warn('⚠️  Respuesta sin estructura esperada:', res.data);
                setBotMsg({
                    type: 'err',
                    text: `Respuesta inesperada del servidor. Revisa la consola para más detalles.`
                });
            }
        } catch (e) {
            console.error('❌ Error completo:', e);
            console.error('    Status:', e?.response?.status);
            console.error('    Data:', e?.response?.data);
            const errorMsg = e?.response?.data?.error || e?.message || 'Error desconocido';
            setBotMsg({ type: 'err', text: `❌ Error: ${errorMsg}` });
        } finally {
            setRecalculando(false);
        }
    };

    const handleSincronizarMisTecnicos = async () => {
        if (sincronizando) return;

        const ok = window.confirm(
            `Esto sincronizará la producción de todos tus técnicos vinculados` +
            (filtroDesde && filtroHasta ? ` entre ${filtroDesde} y ${filtroHasta}` : '') +
            `.\n\n¿Deseas continuar?`
        );
        if (!ok) return;

        setSincronizando(true);
        console.log('🔄 Iniciando sincronización de técnicos vinculados');

        try {
            const payload = {};
            if (filtroDesde) payload.fechaInicio = filtroDesde;
            if (filtroHasta) payload.fechaFin = filtroHasta;

            const res = await api.post('/sincronizar-tecnicos-vinculados', payload);
            console.log('📥 Respuesta:', res.data);

            if (res.data.success && res.data.stats) {
                const stats = res.data.stats;
                setSincronizacionStats(stats);
                setBotMsg({
                    type: 'ok',
                    text: `✅ Sincronización completada. Técnicos: ${stats.tecnicosConProduccion}/${stats.tecnicosVinculados} | Actividades: ${stats.actividadesEncontradas} | Puntos: ${stats.puntosTotal}`
                });
                console.log('✅ Éxito:', stats);
            }
        } catch (e) {
            console.error('❌ Error:', e);
            const errorMsg = e?.response?.data?.error || e?.message || 'Error desconocido';
            setBotMsg({ type: 'err', text: `❌ Error: ${errorMsg}` });
        } finally {
            setSincronizando(false);
        }
    };


    const formatCellValue = (k, val) => {
        if (val === null || val === undefined || val === '') return '—';
        const raw = (typeof val === 'object') ? JSON.stringify(val) : String(val);

        // Todas las columnas de puntos
        if ([
            'PTS_TOTAL_BAREMO', 'PTS_ACTIVIDAD_BASE', 'PTS_DECO_ADICIONAL',
            'PTS_REPETIDOR_WIFI', 'PTS_TELEFONO'
        ].includes(k)) {
            const n = Number(raw);
            return Number.isFinite(n)
                ? n.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                : raw;
        }

        // Todas las columnas de cantidad de equipos
        if ([
            'DECOS_ADICIONALES', 'REPETIDORES_WIFI', 'TELEFONOS', 'TOTAL_EQUIPOS_EXTRAS'
        ].includes(k)) {
            const n = Number(raw);
            return Number.isFinite(n) ? Math.floor(n) : raw;
        }

        // Valor monetario
        if (k === 'VALOR_ACTIVIDAD_CLP') {
            const n = Number(raw);
            return Number.isFinite(n) ? n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }) : raw;
        }

        return raw;
    };

    const diasRango    = fechaInicio && fechaFin ? Math.max(1, Math.round((new Date(fechaFin) - new Date(fechaInicio)) / 86400000) + 1) : 0;

    const paginaSegura  = paginaActual;

    // Filter by single local column if the user desires (operates on the 50 elements returned)
    const datosPagina = useMemo(() => {
        if (filtroColumna && filtroValor) {
            return dataRaw.filter(r => {
                const val = r[filtroColumna];
                const str = (val === null || val === undefined) ? '' : String(val).toLowerCase();
                return str.includes(filtroValor.toLowerCase());
            });
        }
        return dataRaw;
    }, [dataRaw, filtroColumna, filtroValor]);

    // Columnas visibles: TODAS las columnas, sin filtrados
    const displayKeys = useMemo(() => {
        return dynamicKeys; // Mostrar TODAS las columnas sin restricción
    }, [dynamicKeys]);

    // Estadísticas rápidas del filtro activo
    const statsActivo = useMemo(() => {
        const tieneFiltro = filtroDesde || filtroHasta || filtroColumna || busqueda;
        if (!tieneFiltro) return null;
        const fechasUnicas = new Set(dataRaw.map(r => r.fecha ? new Date(r.fecha).toISOString().split('T')[0] : ''));
        return { total: totalReal, fechas: fechasUnicas.size };
    }, [dataRaw, filtroDesde, filtroHasta, filtroColumna, busqueda, totalReal]);

    // Limpiar todos los filtros y recargar datos sin filtro
    const limpiarFiltros = () => {
        setFiltroDesde(''); setFiltroHasta(''); setRangeStart(null);
        setFiltroColumna(''); setFiltroValor(''); setBusquedaInput(''); setBusqueda('');
        setSortKey('fecha'); setSortDir('desc'); setPaginaActual(1);
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
        setLoadingLimpieza(true); setLimpiezaMsg(null);
        setConfirmandoLimpieza(false);
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

    // Valores únicos para sugerencias rápidas de limpieza — TODAS las columnas dinámicas
    const valoresUnicos = useMemo(() => {
        const map = {};
        // Usar dynamicKeys para que sea 100% consistente con la tabla
        dynamicKeys.forEach(col => {
            const vals = new Map();
            dataRaw.forEach(r => {
                const v = r[col];
                if (v !== null && v !== undefined && v !== '') {
                    const valStr = typeof v === 'string' ? v.trim() : String(v);
                    if (valStr) vals.set(valStr, (vals.get(valStr) || 0) + 1);
                }
            });
            // Top 25 valores únicos, ordenados por frecuencia
            if (vals.size > 0) {
                map[col] = Array.from(vals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25);
            }
        });
        return map;
    }, [dataRaw, dynamicKeys]);

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
        { id: 'analisis-op',  label: 'Análisis Operativo',    icon: <Activity size={15} />,    color: 'bg-violet-600 hover:bg-violet-700', desc: 'Dashboard de producción técnica', accion: () => navigate('/rendimiento', { state: { desde: filtroDesde, hasta: filtroHasta } }) },
        { id: 'analisis-fin',  label: 'Análisis Financiero', icon: <DollarSign size={15} />, color: 'bg-emerald-600 hover:bg-emerald-700', desc: 'Dashboard de valorización CLP', accion: () => navigate('/produccion-financiera', { state: { desde: filtroDesde, hasta: filtroHasta } }) },
        { id: 'recalc-decos', label: 'Recalcular Decos WiFi', icon: <RefreshCw size={15} className={recalculandoDecos ? 'animate-spin' : ''} />, color: 'bg-cyan-600 hover:bg-cyan-700', desc: 'Forzar DECO adicional = WiFi (0.25)', accion: recalcularDecosWifi, disabled: recalculandoDecos || !totalReal },
        { id: 'bajar-mongodb', label: 'Bajar Data MongoDB', icon: <RefreshCw size={15} className={recalculando ? 'animate-spin' : ''} />, color: 'bg-teal-600 hover:bg-teal-700', desc: 'Recalcular actividades sin puntos', accion: handleRecalcularMongoDB, disabled: recalculando || !filtroDesde || !filtroHasta },
        { id: 'excel',     label: 'Exportar Excel',  icon: <FileSpreadsheet size={15} />, color: 'bg-indigo-600 hover:bg-indigo-700', desc: 'Descargar xlsx de producción', accion: handleExport, disabled: exportando || !totalReal },
        { id: 'pdf',       label: 'Exportar PDF',    icon: <FileText size={15} />,        color: 'bg-rose-600 hover:bg-rose-700',     desc: 'Generar reporte PDF de la tabla', accion: handleExportPDF, disabled: exportandoPDF || !totalReal },
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
                            
                            {/* Atajos rápidos para el BOT */}
                            <div className="flex flex-wrap gap-2 mt-3">
                                <button onClick={() => { setFechaInicio(hoyISO); setFechaFin(hoyISO); }} disabled={botRunning}
                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all disabled:opacity-40">
                                    Hoy
                                </button>
                                <button onClick={() => { 
                                    const yd = new Date(); yd.setDate(yd.getDate()-1); 
                                    const iso = yd.toISOString().split('T')[0];
                                    setFechaInicio(iso); setFechaFin(iso); 
                                }} disabled={botRunning}
                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all disabled:opacity-40">
                                    Ayer
                                </button>
                                {filtroDesde && (
                                    <button onClick={() => { setFechaInicio(filtroDesde); setFechaFin(filtroHasta || filtroDesde); }} disabled={botRunning}
                                        className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-all disabled:opacity-40">
                                        <RefreshCw size={10} /> Sincronizar con tabla
                                    </button>
                                )}
                            </div>
                            {/* Resumen compacto */}
                            {fechaInicio && fechaFin && (() => {
                                const descargaSet = new Set(fechasDescargadas.map(f => f.fecha));
                                let pendientes = 0, yaDescargados = 0;
                                const ini = new Date(fechaInicio + 'T00:00:00');
                                const fin = new Date(fechaFin   + 'T00:00:00');
                                for (let d = new Date(ini); d <= fin; d.setDate(d.getDate() + 1)) {
                                    if (d.getDay() !== 0) { // Omitir domingos en la cuenta visual
                                        if (descargaSet.has(d.toISOString().split('T')[0])) yaDescargados++; else pendientes++;
                                    }
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
                                {!confirmandoStop ? (
                                    <button onClick={() => setConfirmandoStop(true)} disabled={deteniendoBot}
                                        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all disabled:opacity-50">
                                        {deteniendoBot ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />} Detener agente
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                        <span className="text-[11px] font-bold text-red-700 flex-1">¿Detener la descarga en curso?</span>
                                        <button onClick={detenerAgente} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-red-600 text-white hover:bg-red-700 transition-all">Sí, detener</button>
                                        <button onClick={() => setConfirmandoStop(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all">Cancelar</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {botMsg && (
                            <div className={`mx-4 mb-4 flex items-center gap-2 text-xs font-bold px-3 py-2.5 rounded-xl ${botMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {botMsg.type === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {botMsg.text}
                            </div>
                        )}

                        {/* Panel de estadísticas de recálculo MongoDB */}
                        {recalculoStats && (
                            <div className="mx-4 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                                <h4 className="font-black text-orange-900 mb-3 text-sm flex items-center gap-2">
                                    <Database size={14} />
                                    📊 Última Actualización MongoDB
                                </h4>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-white rounded-lg p-2 border border-orange-100">
                                        <div className="text-orange-600 font-black text-lg">{recalculoStats.recalculadas}</div>
                                        <div className="text-orange-700 text-[10px] font-bold">Recalculadas</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-orange-100">
                                        <div className="text-orange-600 font-black text-lg">{recalculoStats.totalConPuntos}</div>
                                        <div className="text-orange-700 text-[10px] font-bold">Con Puntos</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-orange-100">
                                        <div className="text-orange-600 font-black text-lg">{recalculoStats.totalActividades}</div>
                                        <div className="text-orange-700 text-[10px] font-bold">Total</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-orange-100">
                                        <div className="text-orange-600 font-black text-lg">{recalculoStats.porcentajeCobertura}%</div>
                                        <div className="text-orange-700 text-[10px] font-bold">Cobertura</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-orange-200 text-center">
                                    <span className="text-orange-600 font-black text-sm">💰 Puntos Totales: <span className="text-lg text-orange-700">{recalculoStats.totalPuntos}</span></span>
                                </div>
                            </div>
                        )}

                        {/* Panel de estadísticas de sincronización de técnicos */}
                        {sincronizacionStats && (
                            <div className="mx-4 mb-4 p-4 bg-cyan-50 border border-cyan-200 rounded-xl">
                                <h4 className="font-black text-cyan-900 mb-3 text-sm flex items-center gap-2">
                                    <Users size={14} />
                                    👥 Sincronización de Técnicos Vinculados
                                </h4>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-white rounded-lg p-2 border border-cyan-100">
                                        <div className="text-cyan-600 font-black text-lg">{sincronizacionStats.tecnicosVinculados}</div>
                                        <div className="text-cyan-700 text-[10px] font-bold">Vinculados</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-cyan-100">
                                        <div className="text-cyan-600 font-black text-lg">{sincronizacionStats.tecnicosConProduccion}</div>
                                        <div className="text-cyan-700 text-[10px] font-bold">Con Datos</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-cyan-100">
                                        <div className="text-cyan-600 font-black text-lg">{sincronizacionStats.actividadesEncontradas}</div>
                                        <div className="text-cyan-700 text-[10px] font-bold">Actividades</div>
                                    </div>
                                    <div className="bg-white rounded-lg p-2 border border-cyan-100">
                                        <div className="text-cyan-600 font-black text-lg">{Math.round((sincronizacionStats.tecnicosConProduccion / sincronizacionStats.tecnicosVinculados) * 100)}%</div>
                                        <div className="text-cyan-700 text-[10px] font-bold">Cobertura</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-cyan-200 text-center">
                                    <span className="text-cyan-600 font-black text-sm">💰 Puntos Totales: <span className="text-lg text-cyan-700">{sincronizacionStats.puntosTotal}</span></span>
                                </div>
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
                                            ? `${dataRaw.length.toLocaleString()} de ${totalReal.toLocaleString()}`
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
                            {/* Filtro Clientes */}
                            <div className="w-56">
                                <MultiSearchableSelect
                                    label=""
                                    icon={UsersIcon}
                                    options={availableClientes.map(c => ({ label: c.nombre, value: c.nombre }))} // Usamos nombre ya que el server filtra por clienteAsociado (string)
                                    value={selectedClientes}
                                    onChange={setSelectedClientes}
                                    placeholder="— TODOS LOS CLIENTES —"
                                    compact={true}
                                />
                            </div>
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
                            {/* Búsqueda global en BD */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input type="text" placeholder="Búsqueda desde BD..." value={busquedaInput} onChange={e => setBusquedaInput(e.target.value)}
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
                            <button onClick={handleExportPDF} disabled={exportandoPDF || !totalReal}
                                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all">
                                {exportandoPDF ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                {exportandoPDF ? 'Generando...' : 'PDF'}
                            </button>
                            <button onClick={handleRecalcularMongoDB} disabled={recalculando || !filtroDesde || !filtroHasta}
                                className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all">
                                {recalculando ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />}
                                {recalculando ? 'Bajando...' : '📥 Bajar Data'}
                            </button>
                            <button onClick={handleSincronizarMisTecnicos} disabled={sincronizando}
                                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-sm transition-all">
                                {sincronizando ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />}
                                {sincronizando ? 'Sincronizando...' : '👥 Mis Técnicos'}
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
                                <button onClick={() => setReglasLimpieza([{ columna: 'SUBTIPO_DE_ACTIVIDAD', operador: 'equals', valor: 'Almuerzo' }])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all">
                                    Almuerzos
                                </button>
                                <button onClick={() => setReglasLimpieza([{ columna: 'ESTADO', operador: 'equals', valor: 'Cancelado' }])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-all">
                                    Cancelados
                                </button>
                                <button onClick={() => setReglasLimpieza([
                                    { columna: 'SUBTIPO_DE_ACTIVIDAD', operador: 'equals', valor: 'Almuerzo' },
                                    { columna: 'ESTADO', operador: 'equals', valor: 'Cancelado' }
                                ])}
                                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all">
                                    Almuerzos + Cancelados
                                </button>
                                <button onClick={() => setReglasLimpieza([{ columna: 'NOMBRE', operador: 'empty', valor: '' }])}
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
                                {previewLimpieza && previewLimpieza.total > 0 && !confirmandoLimpieza && (
                                    <button onClick={() => setConfirmandoLimpieza(true)} disabled={loadingLimpieza}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-all shadow-sm">
                                        {loadingLimpieza ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                        Eliminar {previewLimpieza.total.toLocaleString()} registros
                                    </button>
                                )}
                                {confirmandoLimpieza && (
                                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                        <span className="text-[11px] font-bold text-red-700 flex-1">¿Eliminar {previewLimpieza.total.toLocaleString()} registros? No se puede deshacer.</span>
                                        <button onClick={ejecutarLimpieza} disabled={loadingLimpieza} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-red-600 text-white hover:bg-red-700 transition-all disabled:opacity-50">
                                            {loadingLimpieza ? <Loader2 size={10} className="animate-spin inline" /> : 'Sí, eliminar'}
                                        </button>
                                        <button onClick={() => setConfirmandoLimpieza(false)} className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all">Cancelar</button>
                                    </div>
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
                ) : dataRaw.length === 0 && !loadingData ? (
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
                        {/* ═══════════════════════════════════════════════════════════════
                            TABLA LIMPIA — 100% PURO: Todas las columnas y registros de TOA
                            SIN transformaciones, SIN filtros, SIN renombres
                            ════════════════════════════════════════════════════════════════ */}
                        <div className="overflow-auto" style={{ maxHeight: '800px', backgroundColor: '#fff' }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '11px',
                                fontFamily: 'Courier New, monospace'
                            }}>
                                {/* ENCABEZADO — Nombres exactos de columnas */}
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#1a1a1a', color: '#fff', zIndex: 10 }}>
                                    <tr>
                                        {displayKeys.map(colName => (
                                            <th key={colName} style={{
                                                padding: '10px',
                                                textAlign: 'left',
                                                borderRight: '1px solid #444',
                                                borderBottom: '2px solid #444',
                                                minWidth: '120px',
                                                whiteSpace: 'nowrap',
                                                fontWeight: 'bold',
                                                backgroundColor: '#222'
                                            }}>
                                                {colName}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                {/* CUERPO — Datos puros exactamente como vienen */}
                                <tbody>
                                    {dataRaw.length === 0 ? (
                                        <tr>
                                            <td colSpan={displayKeys.length} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : (
                                        dataRaw.map((row, rowIdx) => (
                                            <tr key={rowIdx} style={{
                                                backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f8f8f8',
                                                borderBottom: '1px solid #ddd',
                                                hover: { backgroundColor: '#f0f0f0' }
                                            }}>
                                                {displayKeys.map(colName => {
                                                    const value = row[colName];
                                                    let displayValue = '';

                                                    if (value === null || value === undefined) {
                                                        displayValue = '';
                                                    } else if (typeof value === 'object') {
                                                        displayValue = JSON.stringify(value);
                                                    } else {
                                                        displayValue = String(value);
                                                    }

                                                    return (
                                                        <td key={`${rowIdx}-${colName}`} style={{
                                                            padding: '8px 10px',
                                                            borderRight: '1px solid #ddd',
                                                            whiteSpace: 'nowrap',
                                                            textAlign: 'left',
                                                            color: '#333'
                                                        }}>
                                                            {displayValue}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* ── BARRA PAGINACIÓN ───────────────────────────────── */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 to-white flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-500 font-bold">
                                    {(Math.max(0, (paginaSegura - 1) * filasPorPagina + 1)).toLocaleString()}–{(Math.min(paginaSegura * filasPorPagina, totalReal)).toLocaleString()} de {totalReal.toLocaleString()} en BD
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
                                    const end = Math.min(totalPaginasServer, paginaSegura + 2);
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
                                <button onClick={() => setPaginaActual(p => Math.min(totalPaginasServer, p + 1))} disabled={paginaSegura >= totalPaginasServer}
                                    className="px-2.5 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    ›
                                </button>
                                <button onClick={() => setPaginaActual(totalPaginasServer)} disabled={paginaSegura >= totalPaginasServer}
                                    className="px-2 py-1 rounded text-[10px] font-black text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-30 transition-all">
                                    »»
                                </button>
                                <span className="text-[9px] text-slate-400 font-bold ml-2">Pág {paginaSegura}/{totalPaginasServer}</span>
                            </div>
                        </div>

                        {/* ── PANEL ESTADÍSTICAS RECÁLCULO ──────────────────────────── */}
                        {recalculoStats && (
                            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                                <h4 className="font-black text-emerald-900 mb-2">📊 Última Actualización MongoDB</h4>
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                    <div>
                                        <div className="text-emerald-600 font-bold">{recalculoStats.recalculadas}</div>
                                        <div className="text-emerald-700 text-xs">Recalculadas</div>
                                    </div>
                                    <div>
                                        <div className="text-emerald-600 font-bold">{recalculoStats.totalConPuntos}</div>
                                        <div className="text-emerald-700 text-xs">Con Puntos</div>
                                    </div>
                                    <div>
                                        <div className="text-emerald-600 font-bold">{recalculoStats.totalActividades}</div>
                                        <div className="text-emerald-700 text-xs">Total</div>
                                    </div>
                                    <div>
                                        <div className="text-emerald-600 font-bold">{recalculoStats.porcentajeCobertura}%</div>
                                        <div className="text-emerald-700 text-xs">Cobertura</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DescargaTOA;
