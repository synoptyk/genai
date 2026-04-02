import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Fingerprint, Users, CheckCircle2, XCircle, Clock, Loader2, Plus, Calendar,
    BarChart3, Download, RefreshCw, ChevronLeft, ChevronRight, Search,
    AlertCircle, Zap, Check, X, Edit3, Trash2, Filter, ClipboardList,
    TrendingUp, TrendingDown, Timer, Star, Award, AlertTriangle,
    Copy, CheckSquare, Square, ChevronDown, ChevronUp, ArrowRight,
    FileText, Upload, Save, Shield, Moon, Sun, Briefcase
} from 'lucide-react';
import { asistenciaApi, candidatosApi, turnosApi } from '../rrhhApi';
import * as XLSX from 'xlsx';
import { MapPin } from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────────
const ESTADOS = ['Presente', 'Ausente', 'Tardanza', 'Licencia', 'Permiso', 'Vacaciones', 'Feriado', 'Libre', 'Finiquitado'];
const TIPOS_AUSENCIA = [
    'Inasistencia Injustificada',
    'Licencia Médica',
    'Licencia Maternal/Paternal',
    'Accidente del Trabajo',
    'Permiso con Goce de Sueldo',
    'Permiso sin Goce de Sueldo',
    'Vacaciones',
    'Feriado Legal',
];
const ESTADO_CONFIG = {
    'Presente':   { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✓', descuenta: false },
    'Ausente':    { color: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700',    icon: '✗', descuenta: true  },
    'Tardanza':   { color: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',   icon: 'T', descuenta: false },
    'Licencia':   { color: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700',    icon: 'L', descuenta: false },
    'Permiso':    { color: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700', icon: 'P', descuenta: false },
    'Vacaciones': { color: 'bg-sky-500',     text: 'text-sky-700',     bg: 'bg-sky-50',      border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700',      icon: 'V', descuenta: false },
    'Feriado':    { color: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-500',  icon: 'F', descuenta: false },
    'Libre':      { color: 'bg-slate-200',   text: 'text-slate-500',   bg: 'bg-slate-50',    border: 'border-slate-100',   badge: 'bg-slate-100 text-slate-500',  icon: '—', descuenta: false },
    'Finiquitado': { color: 'bg-rose-50',     text: 'text-rose-500',    bg: 'bg-white',       border: 'border-rose-100',    badge: 'bg-rose-50 text-rose-500',    icon: '∅', descuenta: true },
};
const DIAS_SEMANA_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Feriados Chile (2025 – 2026) ─────────────────────────────────────────────
const FERIADOS_CL_BASE = [
    // 2025
    '2025-01-01','2025-04-18','2025-04-19','2025-05-01','2025-05-21',
    '2025-06-29','2025-07-16','2025-08-15','2025-09-18','2025-09-19',
    '2025-10-31','2025-11-01','2025-12-08','2025-12-25',
    // 2026
    '2026-01-01','2026-04-03','2026-04-04','2026-05-01','2026-05-21',
    '2026-06-29','2026-07-16','2026-08-15','2026-09-18','2026-09-19',
    '2026-10-12','2026-10-31','2026-11-01','2026-12-08','2026-12-25',
];
const FERIADOS_NOMBRES = {
    '01-01':'Año Nuevo','04-18':'Viernes Santo','04-19':'Sábado Santo',
    '04-03':'Viernes Santo','04-04':'Sábado Santo',
    '05-01':'Día del Trabajo','05-21':'Glorias Navales',
    '06-29':'San Pedro y San Pablo','07-16':'Virgen del Carmen',
    '08-15':'Asunción de la Virgen','09-18':'Día de la Independencia',
    '09-19':'Día de las Glorias del Ejército','10-12':'Encuentro de dos Mundos',
    '10-31':'Iglesias Evangélicas','11-01':'Día de todos los Santos',
    '12-08':'Inmaculada Concepción','12-25':'Navidad',
};

// ─── Utils ─────────────────────────────────────────────────────────────────────
const fmtTime = (hhmm) => hhmm || '—';
const fmtCLP  = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;
const calcMinutosTardanza = (horaEntradaReal, horaEntradaTurno, tolerancia = 5) => {
    if (!horaEntradaReal || !horaEntradaTurno) return 0;
    const [rH, rM] = horaEntradaReal.split(':').map(Number);
    const [tH, tM] = horaEntradaTurno.split(':').map(Number);
    const diff = (rH * 60 + rM) - (tH * 60 + tM);
    return diff > tolerancia ? diff : 0;
};
const calcHorasTrabajadas = (entrada, salida, colacion = 0) => {
    if (!entrada || !salida) return 0;
    const [eH, eM] = entrada.split(':').map(Number);
    const [sH, sM] = salida.split(':').map(Number);
    const minutos = (sH * 60 + sM) - (eH * 60 + eM) - colacion;
    return Math.max(0, Math.round((minutos / 60) * 10) / 10);
};

// ─── Componente Badge Estado ───────────────────────────────────────────────────
const EstadoBadge = ({ estado, small = false }) => {
    const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG['Ausente'];
    return (
        <span className={`inline-flex items-center gap-1 ${small ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]'} font-black uppercase rounded-full ${cfg.badge}`}>
            {estado}
        </span>
    );
};

// ─── Celda del calendario ─────────────────────────────────────────────────────
const CeldaCalendario = ({ registro, esHoy, esFuturo, esFinSemana, esFeriado, esDomingo, onClick }) => {
    const cellBg = esFeriado
        ? 'border-red-200 bg-red-50/60'
        : esDomingo
            ? 'border-purple-200 bg-purple-50/40'
            : esFinSemana
                ? 'border-slate-200 bg-slate-50/50'
                : 'border-slate-200';

    if (esFuturo) return (
        <td className={`p-0.5 ${esFeriado ? 'bg-red-50/30' : esDomingo ? 'bg-purple-50/20' : ''}`}>
            <div className={`w-9 h-9 rounded-xl border border-dashed cursor-not-allowed opacity-40 ${esFeriado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`} />
        </td>
    );
    if (!registro) return (
        <td className={`p-0.5 ${esFeriado ? 'bg-red-50/20' : esDomingo ? 'bg-purple-50/10' : ''}`}>
            <button onClick={onClick}
                className={`w-9 h-9 rounded-xl border border-dashed transition-all hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center ${cellBg}`}>
                <Plus size={10} className={esFeriado ? 'text-red-300' : esDomingo ? 'text-purple-300' : 'text-slate-300'} />
            </button>
        </td>
    );
    const cfg = ESTADO_CONFIG[registro.estado] || ESTADO_CONFIG['Ausente'];
    const feriadoBadge = esFeriado && registro.estado !== 'Feriado';
    return (
        <td className={`p-0.5 ${esFeriado ? 'bg-red-50/20' : esDomingo ? 'bg-purple-50/10' : ''}`}>
            <button onClick={onClick}
                title={`${esFeriado ? '🎌 Feriado · ' : ''}${registro.estado}${registro.horasExtra > 0 ? ` · HE: ${registro.horasExtra}h` : ''}${registro.minutosTardanza > 0 ? ` · Tard: ${registro.minutosTardanza}min` : ''}`}
                className={`w-9 h-9 rounded-xl ${cfg.color} text-white text-[11px] font-black shadow-sm hover:scale-110 hover:shadow-md transition-all relative flex items-center justify-center
                    ${esHoy ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}
                    ${esFeriado ? 'ring-2 ring-offset-1 ring-red-400' : ''}`}>
                {cfg.icon}
                {registro.horasExtra > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[7px] font-black text-white flex items-center justify-center shadow">+</span>
                )}
                {feriadoBadge && (
                    <span className="absolute -bottom-1 -left-1 w-3 h-3 bg-red-500 rounded-full border border-white text-[6px] font-black text-white flex items-center justify-center">!</span>
                )}
            </button>
        </td>
    );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
const ControlAsistencia = () => {
    const today = new Date();
    const [period, setPeriod]   = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    const [viewTab, setViewTab] = useState('calendario');
    const [selectedDate, setSelectedDate] = useState(today.toISOString().substring(0, 10));
    const [registrosMes, setRegistrosMes] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [turnos, setTurnos]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [alert, setAlert]     = useState(null);

    // Modal registro individual
    const [modalReg, setModalReg]   = useState(null); // { colaborador, day, registro? }
    const [formReg, setFormReg]     = useState({});

    // Selección bulk
    const [bulkSelect, setBulkSelect] = useState(new Set());
    const [bulkEstado, setBulkEstado] = useState('Presente');

    // Filtros
    const [searchQ, setSearchQ]     = useState('');
    const [filterStatus, setFilterStatus] = useState('Operativo'); // Operativo, Finiquitado, Todos
    const [turnoFilter, setTurnoFilter] = useState('');

    // Horas extra — panel de gestión
    const [heFilter, setHeFilter]   = useState('Pendiente');

    // Sync nómina
    const [syncPreview, setSyncPreview] = useState(null);

    // Feriados personalizados (localStorage)
    const [feriadosCustom, setFeriadosCustom] = useState(() => {
        try { return JSON.parse(localStorage.getItem('rrhh_feriadosCustom') || '[]'); } catch { return []; }
    });
    const [showFeriadosPanel, setShowFeriadosPanel] = useState(false);
    const [newFeriado, setNewFeriado] = useState('');

    // Menu marcado rápido por fila
    const [activeRowMenu, setActiveRowMenu] = useState(null); // col._id

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // ── Derived period info ───────────────────────────────────────────────────
    const [periodYear, periodMonth] = period.split('-').map(Number);
    const diasEnMes = new Date(periodYear, periodMonth, 0).getDate();
    const todayStr  = today.toISOString().substring(0, 10);

    const diasArray = Array.from({ length: diasEnMes }, (_, i) => i + 1);

    // ── Fetch data ────────────────────────────────────────────────────────────
    const fetchMes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await asistenciaApi.getAll({ month: periodMonth, year: periodYear });
            setRegistrosMes(res.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [periodMonth, periodYear]);

    const fetchBase = useCallback(async () => {
        try {
            // Traer todos los candidatos y turnos relevantes
            const [resCand, resTur] = await Promise.all([
                candidatosApi.getAll(),
                turnosApi.getAll()
            ]);
            setColaboradores(resCand.data || []);
            setTurnos(resTur.data || []);
        } catch (e) {
            // Fallback en caso de que getAll no retorne lo esperado o falle
            try {
                const [colContraRes, colFiniqRes, turRes] = await Promise.all([
                    candidatosApi.getAll({ status: 'Contratado' }),
                    candidatosApi.getAll({ status: 'Finiquitado' }),
                    turnosApi.getAll(),
                ]);
                const todos = [...(colContraRes.data || []), ...(colFiniqRes.data || [])];
                const dedup = Object.values(Object.fromEntries(todos.map(c => [c._id, c])));
                setColaboradores(dedup);
                setTurnos(turRes.data || []);
            } catch (err) { console.error(err); }
        }
    }, []);

    useEffect(() => { fetchMes(); }, [fetchMes]);
    useEffect(() => { fetchBase(); }, [fetchBase]);

    // ── Maps & computed ───────────────────────────────────────────────────────
    // turnoMap: candidatoId → turno
    const turnoMap = useMemo(() => {
        const m = {};
        turnos.forEach(t => {
            (t.colominoAsignados || []).forEach(cId => {
                m[cId?.toString()] = t;
            });
        });
        return m;
    }, [turnos]);

    // ── Feriados set (base + custom) ─────────────────────────────────────────
    const feriadoSet = useMemo(() => new Set([...FERIADOS_CL_BASE, ...feriadosCustom]), [feriadosCustom]);

    const dayToDateStr = useCallback((d) =>
        `${period}-${String(d).padStart(2, '0')}`, [period]);

    const isDayFeriado = useCallback((d) =>
        feriadoSet.has(dayToDateStr(d)), [feriadoSet, dayToDateStr]);

    const isDomingo = useCallback((d) => {
        const fecha = new Date(periodYear, periodMonth - 1, d);
        return fecha.getDay() === 0;
    }, [periodYear, periodMonth]);

    // calendarioMap: candidatoId → { day: registro }
    // ⚠️ Usar getUTCDate() para evitar bug de timezone: '2026-04-01T00:00:00Z'
    // en Chile (UTC-3) es '2026-03-31T21:00:00' → getDate() devolvería 31 en vez de 1.
    const calendarioMap = useMemo(() => {
        const m = {};
        registrosMes.forEach(r => {
            const cId = r.candidatoId?._id?.toString() || r.candidatoId?.toString();
            const day  = new Date(r.fecha).getUTCDate(); // UTC siempre — no depende del timezone local
            if (!m[cId]) m[cId] = {};
            m[cId][day] = r;
        });
        return m;
    }, [registrosMes]);

    // Merge colaboradores de fetchBase + empleados hallados en registros del período
    // (captura finiquitados que tienen producción en el mes aunque no estén en la BD activa)
    const colaboradoresCompletos = useMemo(() => {
        const map = {};
        colaboradores.forEach(c => { map[c._id?.toString()] = c; });
        // Extraer candidatos populados desde los registros del mes
        registrosMes.forEach(r => {
            const c = r.candidatoId;
            if (c && c._id) {
                const key = c._id?.toString();
                if (!map[key]) map[key] = c; // añadir si no existe
            }
        });
        return Object.values(map).sort((a, b) =>
            (a.fullName || '').localeCompare(b.fullName || '', 'es-CL')
        );
    }, [colaboradores, registrosMes]);

    // colaboradores filtrados
    const colaboradoresFiltrados = useMemo(() => {
        let list = colaboradoresCompletos;

        // 1. Filtrar por Estado (UI)
        if (filterStatus === 'Operativo') {
            list = list.filter(c => c.status === 'Contratado');
        } else if (filterStatus === 'Finiquitado') {
            list = list.filter(c => c.status === 'Finiquitado');
        }

        // 2. Filtro por Búsqueda
        if (searchQ) {
            const q = searchQ.toLowerCase();
            list = list.filter(c => 
                c.fullName?.toLowerCase().includes(q) || 
                c.rut?.includes(q) || 
                c.position?.toLowerCase().includes(q)
            );
        }

        // 3. Filtro por Turno
        if (turnoFilter) {
            const turno = turnos.find(t => t._id === turnoFilter);
            if (turno) {
                const ids = new Set((turno.colominoAsignados || []).map(id => id?.toString()));
                list = list.filter(c => ids.has(c._id?.toString()));
            }
        }
        return list;
    }, [colaboradoresCompletos, filterStatus, searchQ, turnoFilter, turnos]);

    // Stats globales del período
    const statsGlobales = useMemo(() => {
        const t = { presente: 0, ausente: 0, tardanza: 0, licencia: 0, permiso: 0, feriado: 0, libre: 0, horasExtra: 0, minTardanza: 0 };
        registrosMes.forEach(r => {
            if (r.estado === 'Presente')   t.presente++;
            if (r.estado === 'Ausente')    t.ausente++;
            if (r.estado === 'Tardanza')   t.tardanza++;
            if (r.estado === 'Licencia')   t.licencia++;
            if (r.estado === 'Permiso' || r.estado === 'Vacaciones')    t.permiso++;
            if (r.estado === 'Feriado')    t.feriado++;
            if (r.estado === 'Libre')      t.libre++;
            t.horasExtra  += r.horasExtraAprobadas || 0;
            t.minTardanza += r.minutosTardanza || 0;
        });
        const total = t.presente + t.ausente + t.tardanza + t.licencia + t.permiso + t.feriado + t.libre;
        t.tasaAsistencia = total > 0 ? Math.round(((t.presente + t.tardanza) / total) * 100) : 0;
        return t;
    }, [registrosMes]);

    // Resumen por colaborador (para tab Resumen y Nómina)
    const resumenPorColaborador = useMemo(() => {
        return colaboradoresFiltrados.map(col => {
            const regs = Object.values(calendarioMap[col._id?.toString()] || {});
            const diasPresente   = regs.filter(r => r.estado === 'Presente').length;
            const diasTardanza   = regs.filter(r => r.estado === 'Tardanza').length;
            const diasAusente    = regs.filter(r => r.estado === 'Ausente').length;
            const diasLicencia   = regs.filter(r => ['Licencia', 'Permiso', 'Vacaciones'].includes(r.estado)).length;
            const diasFeriado    = regs.filter(r => r.estado === 'Feriado').length;
            const minTardanza    = regs.reduce((s, r) => s + (r.minutosTardanza || 0), 0);
            const horasExtraDecl = regs.reduce((s, r) => s + (r.horasExtra || 0), 0);
            const horasExtraApro = regs.reduce((s, r) => s + (r.horasExtraAprobadas || 0), 0);
            const diasDescontados = regs.filter(r => r.descuentaDia).length;
            const diasTrabajados  = diasPresente + diasTardanza;
            const turno = turnoMap[col._id?.toString()];
            return {
                ...col,
                turnoNombre: turno?.nombre || '—',
                diasTrabajados,
                diasAusente,
                diasLicencia,
                diasFeriado,
                diasTardanza,
                minTardanza,
                horasExtraDecl,
                horasExtraApro,
                diasDescontados,
                calificaBono: diasAusente === 0 && diasTardanza === 0,
                totalRegistros: regs.length,
            };
        });
    }, [colaboradoresFiltrados, calendarioMap, turnoMap]);

    // HE pendientes de aprobación
    const hePendientes = useMemo(() => {
        return registrosMes
            .filter(r => r.horasExtra > 0 && (heFilter === 'todos' ? true : r.estadoHorasExtra === heFilter))
            .map(r => ({
                ...r,
                colaboradorNombre: r.candidatoId?.fullName || '—',
                diaNum: new Date(r.fecha).getUTCDate(), // UTC para consistencia con calendarioMap
            }))
            .sort((a, b) => a.diaNum - b.diaNum);
    }, [registrosMes, heFilter]);

    // ── Acciones ──────────────────────────────────────────────────────────────
    const handlePrevPeriod = () => {
        const d = new Date(periodYear, periodMonth - 2, 1);
        setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const handleNextPeriod = () => {
        const d = new Date(periodYear, periodMonth, 1);
        setPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };

    // Abrir modal para un colaborador+día
    const openModal = (col, day, existente = null) => {
        const fecha = `${period}-${String(day).padStart(2, '0')}`;
        const turno = turnoMap[col._id?.toString()];
        setFormReg({
            candidatoId:        col._id,
            turnoId:            existente?.turnoId?._id || turno?._id || '',
            fecha,
            horaEntrada:        existente?.horaEntrada || turno?.horaEntrada || '',
            horaSalida:         existente?.horaSalida  || turno?.horaSalida  || '',
            estado:             existente?.estado || 'Presente',
            minutosTardanza:    existente?.minutosTardanza || 0,
            horasExtra:         existente?.horasExtra || 0,
            horasExtraAprobadas: existente?.horasExtraAprobadas || 0,
            estadoHorasExtra:   existente?.estadoHorasExtra || 'Sin HE',
            tipoAusencia:       existente?.tipoAusencia || null,   // null = sin tipo (enum no acepta '')
            descuentaDia:       existente?.descuentaDia || false,
            observacion:        existente?.observacion || '',
            _id:                existente?._id || null,
        });
        setModalReg({ col, day, existente });
    };

    // Auto-calcular tardanza cuando cambia hora entrada
    const handleFormEntrada = (horaEntrada) => {
        const turnoId = formReg.turnoId;
        const turno   = turnos.find(t => t._id === turnoId);
        const min     = turno ? calcMinutosTardanza(horaEntrada, turno.horaEntrada, turno.toleranciaTardanza || 5) : 0;
        setFormReg(p => ({
            ...p,
            horaEntrada,
            minutosTardanza: min,
            estado: min > 0 ? 'Tardanza' : (p.estado === 'Tardanza' ? 'Presente' : p.estado),
        }));
    };

    const handleSaveRegistro = async () => {
        setSaving(true);
        try {
            const payload = { ...formReg };

            // Limpiar campos de enum vacíos — Mongoose rechaza '' en enum (solo acepta valores válidos o null)
            if (!payload.turnoId) delete payload.turnoId;
            if (!payload.tipoAusencia) payload.tipoAusencia = null;
            if (!payload.estadoHorasExtra) payload.estadoHorasExtra = 'Sin HE';

            // Normalizar numéricos
            payload.horasExtra          = Number(payload.horasExtra) || 0;
            payload.horasExtraAprobadas = Number(payload.horasExtraAprobadas) || 0;
            payload.minutosTardanza     = Number(payload.minutosTardanza) || 0;

            const id = payload._id;
            delete payload._id; // no enviar _id en el body

            if (id) {
                await asistenciaApi.update(id, payload);
            } else {
                await asistenciaApi.create(payload);
            }
            setModalReg(null);
            fetchMes();
            showAlert(id ? 'Registro actualizado' : 'Asistencia registrada');
        } catch (e) {
            console.error('Error guardando asistencia:', e.response?.data || e);
            showAlert(`Error: ${e.response?.data?.message || 'No se pudo guardar el registro'}`, 'error');
        }
        finally { setSaving(false); }
    };

    const handleDeleteRegistro = async (id) => {
        if (!window.confirm('¿Eliminar este registro?')) return;
        try {
            await asistenciaApi.remove(id);
            setModalReg(null);
            fetchMes();
            showAlert('Registro eliminado');
        } catch (e) { showAlert('Error al eliminar', 'error'); }
    };

    // Bulk: marcar todos los seleccionados (o todos si no hay selección) como un estado
    const handleBulkMarcar = async (day) => {
        const fecha = `${period}-${String(day).padStart(2, '0')}`;
        const cols  = bulkSelect.size > 0
            ? colaboradoresFiltrados.filter(c => bulkSelect.has(c._id))
            : colaboradoresFiltrados;
        const registros = cols.map(c => {
            const turno = turnoMap[c._id?.toString()];
            return {
                candidatoId: c._id,
                turnoId:     turno?._id || undefined,
                fecha,
                horaEntrada: turno?.horaEntrada || '',
                horaSalida:  turno?.horaSalida  || '',
                estado:      bulkEstado,
                minutosTardanza: 0,
                horasExtra: 0,
            };
        });
        setSaving(true);
        try {
            await asistenciaApi.bulkUpsert(registros);
            fetchMes();
            showAlert(`${registros.length} registros marcados como ${bulkEstado}`);
        } catch (e) { showAlert('Error en operación masiva', 'error'); }
        finally { setSaving(false); }
    };

    // Bulk: marcar toda la semana desde turno para los colaboradores seleccionados
    const handleBulkSemana = async () => {
        const [y, m] = period.split('-').map(Number);
        const registros = [];
        colaboradoresFiltrados
            .filter(c => bulkSelect.size === 0 || bulkSelect.has(c._id))
            .forEach(c => {
                const turno = turnoMap[c._id?.toString()];
                const diasTurno = new Set(turno?.diasSemana || []);
                const mapDia = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0 };
                for (let d = 1; d <= diasEnMes; d++) {
                    const fechaStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    const fechaD = new Date(`${fechaStr}T12:00:00`);
                    if (fechaD > today) break;

                    // Verificación de Finiquito (Sincronización automática de fecha de término)
                    const fechaContraFin = c.contractEndDate || c.fechaFiniquito;
                    const esFiniquitado = fechaContraFin && new Date(fechaContraFin) < fechaD;

                    const diaNombre = Object.keys(mapDia).find(k => mapDia[k] === fechaD.getDay());
                    const esDiaLaboral = !turno || (turno.diasSemana?.length === 0 || diasTurno.has(diaNombre));
                    
                    registros.push({
                        candidatoId: c._id,
                        turnoId:     turno?._id || undefined,
                        fecha:       fechaStr,
                        horaEntrada: (esDiaLaboral && !esFiniquitado) ? (turno?.horaEntrada || '') : '',
                        horaSalida:  (esDiaLaboral && !esFiniquitado) ? (turno?.horaSalida  || '') : '',
                        estado:      esFiniquitado ? 'Finiquitado' : (esDiaLaboral ? 'Presente' : 'Libre'),
                        descuentaDia: esFiniquitado, // Muy importante para que el motor de nómina descuente estos días
                        minutosTardanza: 0,
                        horasExtra: 0,
                    });
                }
            });
        if (!registros.length) { showAlert('No hay registros que generar', 'error'); return; }
        setSaving(true);
        try {
            await asistenciaApi.bulkUpsert(registros);
            fetchMes();
            showAlert(`${registros.length} registros generados desde turnos`);
        } catch (e) { showAlert('Error en generación masiva', 'error'); }
        finally { setSaving(false); }
    };

    // Aprobar/rechazar HE
    const handleHEAction = async (registro, action) => {
        try {
            await asistenciaApi.update(registro._id, {
                estadoHorasExtra: action === 'aprobar' ? 'Aprobado' : 'Rechazado',
                horasExtraAprobadas: action === 'aprobar' ? registro.horasExtra : 0,
            });
            fetchMes();
            showAlert(action === 'aprobar' ? 'Horas extra aprobadas' : 'Horas extra rechazadas');
        } catch (e) { showAlert('Error al procesar HE', 'error'); }
    };

    // Export Excel — Resumen período
    const handleExportExcel = () => {
        const mes = String(periodMonth).padStart(2, '0');
        const rows = resumenPorColaborador.map(c => ({
            'RUT':             c.rut || '',
            'Nombre':          c.fullName || '',
            'Cargo':           c.position || c.cargo || '',
            'Turno':           c.turnoNombre,
            'Días Trabajados': c.diasTrabajados,
            'Ausencias':       c.diasAusente,
            'Licencias/Permisos': c.diasLicencia,
            'Tardanzas':       c.diasTardanza,
            'Min. Tardanza':   c.minTardanza,
            'HE Declaradas':   c.horasExtraDecl,
            'HE Aprobadas':    c.horasExtraApro,
            'Descuenta Día':   c.diasDescontados,
            'Bono Asistencia': c.calificaBono ? 'SÍ' : 'NO',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Asistencia ${mes}-${periodYear}`);
        XLSX.writeFile(wb, `Asistencia_${mes}_${periodYear}.xlsx`);
    };

    // Toggle bulk selection
    const toggleBulk = (id) => {
        setBulkSelect(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const toggleBulkAll = () => {
        if (bulkSelect.size === colaboradoresFiltrados.length) setBulkSelect(new Set());
        else setBulkSelect(new Set(colaboradoresFiltrados.map(c => c._id)));
    };

    // Marcar todos los días del mes (hasta hoy) de una fila como un estado
    const handleMarkRowAs = async (col, estado) => {
        const turno = turnoMap[col._id?.toString()];
        const registros = [];
        for (let d = 1; d <= diasEnMes; d++) {
            const fechaStr = dayToDateStr(d);
            if (fechaStr > todayStr) break;
            registros.push({
                candidatoId: col._id,
                turnoId:     turno?._id || undefined,
                fecha:       fechaStr,
                horaEntrada: turno?.horaEntrada || '',
                horaSalida:  turno?.horaSalida  || '',
                estado,
                minutosTardanza: 0,
                horasExtra: 0,
            });
        }
        if (!registros.length) return;
        setActiveRowMenu(null);
        setSaving(true);
        try {
            await asistenciaApi.bulkUpsert(registros);
            fetchMes();
            showAlert(`${registros.length} días marcados como ${estado} para ${col.fullName}`);
        } catch (e) { showAlert('Error en marcación masiva', 'error'); }
        finally { setSaving(false); }
    };

    // Marcar todos los colaboradores de una columna (día) como un estado
    const handleMarkColumnAs = async (day, estado) => {
        const fecha = dayToDateStr(day);
        const cols  = bulkSelect.size > 0
            ? colaboradoresFiltrados.filter(c => bulkSelect.has(c._id))
            : colaboradoresFiltrados;
        const registros = cols.map(c => {
            const turno = turnoMap[c._id?.toString()];
            return {
                candidatoId: c._id,
                turnoId:     turno?._id || undefined,
                fecha,
                horaEntrada: turno?.horaEntrada || '',
                horaSalida:  turno?.horaSalida  || '',
                estado,
                minutosTardanza: 0,
                horasExtra: 0,
            };
        });
        setSaving(true);
        try {
            await asistenciaApi.bulkUpsert(registros);
            fetchMes();
            showAlert(`${registros.length} registros → día ${day} marcados como ${estado}`);
        } catch (e) { showAlert('Error en marcación masiva', 'error'); }
        finally { setSaving(false); }
    };

    // Feriados custom
    const addFeriadoCustom = () => {
        if (!newFeriado || feriadoSet.has(newFeriado)) { showAlert('Fecha inválida o ya registrada', 'error'); return; }
        const updated = [...feriadosCustom, newFeriado].sort();
        setFeriadosCustom(updated);
        localStorage.setItem('rrhh_feriadosCustom', JSON.stringify(updated));
        setNewFeriado('');
        showAlert(`Feriado ${newFeriado} agregado`);
    };
    const removeFeriadoCustom = (fecha) => {
        const updated = feriadosCustom.filter(f => f !== fecha);
        setFeriadosCustom(updated);
        localStorage.setItem('rrhh_feriadosCustom', JSON.stringify(updated));
    };

    // Feriados del período actual (para stats)
    const feriadosPeriodo = useMemo(() => diasArray.filter(d => isDayFeriado(d)), [diasArray, isDayFeriado]);

    const TABS = [
        { id: 'calendario',  label: 'Calendario',      icon: Calendar    },
        { id: 'diario',      label: 'Registro Diario', icon: ClipboardList },
        { id: 'resumen',     label: 'Resumen Período', icon: BarChart3   },
        { id: 'horasextra',  label: 'Horas Extra',     icon: Timer       },
    ];

    // ── Mes/año display ───────────────────────────────────────────────────────
    const periodoLabel = new Date(periodYear, periodMonth - 1, 1)
        .toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-24">
            {/* ALERT */}
            {alert && (
                <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-black uppercase tracking-wide animate-in slide-in-from-right ${alert.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {alert.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
                    {alert.msg}
                </div>
            )}

            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 mt-2">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-200">
                        <Fingerprint size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Control de <span className="text-indigo-600">Asistencia</span>
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            Módulo de Gestión de Asistencia · Integrado con Nómina
                        </p>
                    </div>
                </div>

                {/* Navegación período */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                        <button onClick={handlePrevPeriod} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><ChevronLeft size={16} /></button>
                        <span className="px-4 py-2 text-sm font-black text-slate-700 uppercase tracking-widest min-w-[160px] text-center">{periodoLabel}</span>
                        <button onClick={handleNextPeriod} className="p-2 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight size={16} /></button>
                    </div>
                    <button onClick={fetchMes} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                        <RefreshCw size={16} className={loading ? 'animate-spin text-indigo-500' : 'text-slate-400'} />
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all">
                        <Download size={14} className="text-emerald-500" /> Exportar
                    </button>
                </div>
            </div>

            {/* ── KPI CARDS ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {[
                    { label: 'Asistencia',  value: `${statsGlobales.tasaAsistencia}%`,  sub: 'tasa período',  color: 'bg-indigo-600', icon: TrendingUp },
                    { label: 'Presentes',   value: statsGlobales.presente,  sub: 'registros',     color: 'bg-emerald-600', icon: CheckCircle2 },
                    { label: 'Ausencias',   value: statsGlobales.ausente,   sub: 'sin justificar', color: 'bg-rose-600',   icon: XCircle     },
                    { label: 'Tardanzas',   value: statsGlobales.tardanza,  sub: `${Math.round(statsGlobales.minTardanza / 60 * 10) / 10}h total`, color: 'bg-amber-500', icon: Clock },
                    { label: 'Horas Extra', value: `${statsGlobales.horasExtra}h`, sub: 'acumuladas', color: 'bg-violet-600', icon: Timer },
                    { label: 'Colaboradores', value: colaboradoresFiltrados.length, sub: `en período · ${colaboradores.filter(c=>c.status==='Contratado').length} activos`, color: 'bg-slate-700', icon: Users },
                ].map((s, i) => (
                    <div key={i} className={`${s.color} text-white p-5 rounded-[1.5rem] shadow-xl relative overflow-hidden`}>
                        <div className="absolute -right-3 -bottom-3 opacity-10"><s.icon size={64} /></div>
                        <div className="relative z-10">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-80 block mb-1">{s.label}</span>
                            <p className="text-2xl font-black leading-none mb-0.5">{s.value}</p>
                            <p className="text-[8px] font-bold opacity-60 uppercase">{s.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── TABS ── */}
            <div className="flex gap-1 bg-white border border-slate-100 p-1 rounded-2xl shadow-sm mb-6 w-fit">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setViewTab(t.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewTab === t.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <t.icon size={13} /> {t.label}
                    </button>
                ))}
            </div>

            {/* ════════════════════════════════════════════════════════
                TAB: CALENDARIO MENSUAL
            ════════════════════════════════════════════════════════ */}
            {viewTab === 'calendario' && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                    {/* TOOLBAR */}
                    <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                <input type="text" placeholder="Buscar colaborador..." value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-50 shadow-sm" />
                            </div>

                            {/* Filtro estado */}
                            <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                {[
                                    { id: 'Operativo', label: 'Operativos', icon: CheckCircle2, color: 'text-emerald-500' },
                                    { id: 'Finiquitado', label: 'Finiquitados', icon: XCircle, color: 'text-rose-500' },
                                    { id: 'Todos', label: 'Todos', icon: Users, color: 'text-indigo-500' }
                                ].map(s => (
                                    <button key={s.id} onClick={() => setFilterStatus(s.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${filterStatus === s.id ? 'bg-slate-50 text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
                                        <s.icon size={11} className={filterStatus === s.id ? s.color : ''} />
                                        {s.label}
                                    </button>
                                ))}
                            </div>

                            {/* Filtro turno */}
                            {turnos.length > 0 && (
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                                    <select value={turnoFilter} onChange={e => setTurnoFilter(e.target.value)}
                                        className="pl-9 pr-8 py-2.5 bg-white border border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-600 outline-none shadow-sm focus:ring-2 focus:ring-indigo-50 appearance-none min-w-[150px]">
                                        <option value="">Todos los turnos</option>
                                        {turnos.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
                                </div>
                            )}

                            {/* Bulk estado selector */}
                            <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-xl p-1 shadow-sm">
                                {['Presente', 'Ausente', 'Tardanza', 'Feriado', 'Libre'].map(e => (
                                    <button key={e} onClick={() => setBulkEstado(e)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${bulkEstado === e ? ESTADO_CONFIG[e].badge + ' ring-1 ring-current shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}>
                                        {e}
                                    </button>
                                ))}
                            </div>

                            {/* Acciones bulk */}
                            <div className="flex items-center gap-2">
                                <button onClick={handleBulkSemana} disabled={saving}
                                    className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all disabled:opacity-50">
                                    <Zap size={12} /> Auto-fill Turnos
                                </button>
                                <button onClick={() => setShowFeriadosPanel(p => !p)}
                                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showFeriadosPanel ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-100' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}>
                                    <MapPin size={12} /> Feriados {feriadosPeriodo.length > 0 && <span className="bg-white/30 px-1.5 py-0.5 rounded-full text-[8px]">{feriadosPeriodo.length}</span>}
                                </button>
                                {bulkSelect.size > 0 && (
                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100">
                                        {bulkSelect.size} seleccionados
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Panel de Feriados */}
                        {showFeriadosPanel && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest">🎌 Gestión de Feriados</h4>
                                        <p className="text-[9px] text-red-500 font-bold mt-0.5">Feriados oficiales de Chile + personalizados · Período {period}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input type="date" value={newFeriado} onChange={e => setNewFeriado(e.target.value)}
                                            className="px-3 py-1.5 bg-white border border-red-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-300" />
                                        <button onClick={addFeriadoCustom}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-700 transition-all">
                                            <Plus size={11} /> Agregar
                                        </button>
                                    </div>
                                </div>
                                {/* Feriados del período */}
                                <div className="flex flex-wrap gap-2">
                                    {feriadosPeriodo.length > 0 ? feriadosPeriodo.map(d => {
                                        const dateStr = dayToDateStr(d);
                                        const mmdd = dateStr.slice(5);
                                        const nombre = FERIADOS_NOMBRES[mmdd] || 'Feriado';
                                        const esCustom = feriadosCustom.includes(dateStr);
                                        const fecha = new Date(periodYear, periodMonth - 1, d);
                                        return (
                                            <div key={d} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[9px] font-black ${esCustom ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-red-200 text-red-700'}`}>
                                                <span className="font-mono">{d}</span>
                                                <span>{DIAS_SEMANA_ES[fecha.getDay()]}</span>
                                                <span className="font-bold opacity-80">{nombre}</span>
                                                {esCustom && (
                                                    <button onClick={() => removeFeriadoCustom(dateStr)} className="ml-1 text-orange-400 hover:text-orange-700 transition-all"><X size={10} /></button>
                                                )}
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-[9px] text-red-400 italic">No hay feriados registrados para este período.</p>
                                    )}
                                </div>
                                {feriadosPeriodo.length > 0 && (
                                    <div className="flex gap-2 mt-3">
                                        <button onClick={() => {
                                            feriadosPeriodo.forEach(d => handleMarkColumnAs(d, 'Feriado'));
                                        }} disabled={saving}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-red-700 transition-all disabled:opacity-50">
                                            <Zap size={11} /> Marcar todos los feriados del período
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Leyenda */}
                        <div className="flex flex-wrap gap-3 items-center">
                            {Object.entries(ESTADO_CONFIG).map(([e, cfg]) => (
                                <div key={e} className="flex items-center gap-1.5">
                                    <div className={`w-4 h-4 rounded-md ${cfg.color} text-white text-[8px] font-black flex items-center justify-center`}>{cfg.icon}</div>
                                    <span className="text-[9px] font-bold text-slate-500">{e}</span>
                                </div>
                            ))}
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-amber-400 flex items-center justify-center"><span className="text-[7px] font-black text-white">+</span></div>
                                <span className="text-[9px] font-bold text-slate-500">HE registradas</span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                                <div className="w-4 h-4 rounded-md bg-red-100 border border-red-300 flex items-center justify-center"><span className="text-[7px] font-black text-red-600">🎌</span></div>
                                <span className="text-[9px] font-bold text-red-500">Feriado</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-purple-100 border border-purple-300 flex items-center justify-center"><span className="text-[7px] font-black text-purple-600">D</span></div>
                                <span className="text-[9px] font-bold text-purple-500">Domingo</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded-md bg-slate-100 border border-slate-300 flex items-center justify-center"><span className="text-[7px] font-black text-slate-500">S</span></div>
                                <span className="text-[9px] font-bold text-slate-500">Sábado</span>
                            </div>
                            <span className="text-[8px] text-slate-400 italic ml-1">· Clic en cabecera de día = marcar columna</span>
                        </div>
                    </div>

                    {/* GRID */}
                    {loading ? (
                        <div className="flex justify-center items-center py-32">
                            <Loader2 size={36} className="animate-spin text-indigo-500 opacity-50" />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse" style={{ minWidth: `${diasEnMes * 44 + 360}px` }}>
                                <thead>
                                    <tr className="bg-slate-50/80 sticky top-0 z-20">
                                        {/* Checkbox all */}
                                        <th className="w-8 px-3 py-4 sticky left-0 bg-slate-50/80 z-30">
                                            <button onClick={toggleBulkAll}>
                                                {bulkSelect.size === colaboradoresFiltrados.length && bulkSelect.size > 0
                                                    ? <CheckSquare size={14} className="text-indigo-500" />
                                                    : <Square size={14} className="text-slate-300" />}
                                            </button>
                                        </th>
                                        {/* Colaborador col */}
                                        <th className="px-4 py-4 text-left sticky left-8 bg-slate-50/80 z-30 min-w-[280px]">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</p>
                                            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-wide">RUT · Cargo · Cliente</p>
                                        </th>
                                        {/* Días */}
                                        {diasArray.map(d => {
                                            const fecha   = new Date(periodYear, periodMonth - 1, d);
                                            const diaSem  = DIAS_SEMANA_ES[fecha.getDay()];
                                            const esDom   = fecha.getDay() === 0;
                                            const esSab   = fecha.getDay() === 6;
                                            const esFS    = esDom || esSab;
                                            const esFer   = isDayFeriado(d);
                                            const dateStr = dayToDateStr(d);
                                            const esHoy   = dateStr === todayStr;
                                            const esFuturo = dateStr > todayStr;
                                            // Suggest estado for column mark
                                            const suggestedEstado = esFer ? 'Feriado' : bulkEstado;
                                            // Header bg
                                            const thBg = esFer
                                                ? 'bg-red-100/70 hover:bg-red-200/80 cursor-pointer'
                                                : esDom
                                                    ? 'bg-purple-100/50 hover:bg-purple-200/70 cursor-pointer'
                                                    : esSab
                                                        ? 'bg-slate-100/60 hover:bg-slate-200/70 cursor-pointer'
                                                        : esHoy
                                                            ? 'bg-indigo-50 hover:bg-indigo-100 cursor-pointer'
                                                            : esFuturo ? '' : 'hover:bg-slate-100/80 cursor-pointer';
                                            return (
                                                <th key={d}
                                                    title={esFer ? `🎌 Feriado — Clic para marcar columna como Feriado` : `Clic para marcar día ${d} como ${bulkEstado}`}
                                                    onClick={() => !esFuturo && handleMarkColumnAs(d, suggestedEstado)}
                                                    className={`text-center w-10 py-3 transition-colors select-none ${thBg}`}>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-[8px] font-bold ${esFer ? 'text-red-500' : esDom ? 'text-purple-500' : esSab ? 'text-slate-400' : 'text-slate-400'}`}>
                                                            {diaSem}
                                                        </span>
                                                        <span className={`text-[11px] font-black mt-0.5
                                                            ${esHoy ? 'bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto shadow-indigo-100 shadow-md' :
                                                              esFer ? 'text-red-600' :
                                                              esDom ? 'text-purple-600' :
                                                              esSab ? 'text-slate-500' : 'text-slate-700'}`}>
                                                            {d}
                                                        </span>
                                                        {(esDom || esSab) && (
                                                            <span className={`text-[6px] font-black uppercase mt-0.5 px-1 rounded-sm ${esDom ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                {esDom ? 'Libre' : 'Sáb'}
                                                             </span>
                                                        )}
                                                        {esFer && <span className="text-[7px] text-red-500 leading-none mt-0.5">🎌 Feriado</span>}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        {/* Stats cols */}
                                        <th className="px-3 text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap">Días<br/>Trab.</th>
                                        <th className="px-3 text-center text-[9px] font-black text-rose-400 uppercase tracking-widest">Aus.</th>
                                        <th className="px-3 text-center text-[9px] font-black text-amber-500 uppercase tracking-widest">Tard.</th>
                                        <th className="px-3 text-center text-[9px] font-black text-violet-500 uppercase tracking-widest whitespace-nowrap">HE</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {colaboradoresFiltrados.map(col => {
                                        const cId   = col._id?.toString();
                                        const turno = turnoMap[cId];
                                        const stats = resumenPorColaborador.find(r => r._id === col._id) || {};
                                        const dias  = calendarioMap[cId] || {};
                                        const isBulk = bulkSelect.has(col._id);
                                        const isMenuOpen = activeRowMenu === col._id;
                                        return (
                                            <tr key={col._id} className={`hover:bg-indigo-50/10 transition-colors ${isBulk ? 'bg-indigo-50/30' : ''}`}>
                                                {/* Checkbox */}
                                                <td className={`px-3 sticky left-0 z-10 ${isBulk ? 'bg-indigo-50' : 'bg-white'}`}>
                                                    <button onClick={() => toggleBulk(col._id)}>
                                                        {isBulk ? <CheckSquare size={14} className="text-indigo-500" /> : <Square size={14} className="text-slate-200" />}
                                                    </button>
                                                </td>
                                                {/* Colaborador + quick-mark menu */}
                                                <td className="px-3 py-2 sticky left-8 bg-white z-10 min-w-[280px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 shadow-sm"
                                                            style={{ backgroundColor: turno?.color || '#6366F1' }}>
                                                            {col.fullName?.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <p className="text-[11px] font-black text-slate-800 uppercase leading-tight">{col.fullName}</p>
                                                                {col.status === 'Finiquitado' && (
                                                                    <div className="flex items-center gap-1 mt-0.5">
                                                                        <span className="text-[7px] font-black bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full uppercase border border-rose-200 flex-shrink-0">Finiq.</span>
                                                                        <span className="text-[7px] font-bold text-rose-400 uppercase">Terminó: {new Date(col.contractEndDate || col.fechaFiniquito).toLocaleDateString()}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <p className="text-[8px] font-mono font-bold text-indigo-400 leading-tight">{col.rut || '—'}</p>
                                                            <p className="text-[8px] font-bold text-slate-500 leading-tight truncate max-w-[200px]">{col.position || col.cargo || '—'}</p>
                                                            {(col.projectName || col.sede) && (
                                                                <p className="text-[7px] font-bold text-emerald-600 leading-tight truncate max-w-[200px]">
                                                                    📋 {col.projectName || col.sede}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {/* Quick mark row button */}
                                                        <div className="relative">
                                                            <button
                                                                title="Marcar toda la fila"
                                                                onClick={() => setActiveRowMenu(isMenuOpen ? null : col._id)}
                                                                className={`p-1.5 rounded-lg transition-all ${isMenuOpen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600'}`}>
                                                                <ChevronDown size={11} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {isMenuOpen && (
                                                                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden">
                                                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                                                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marcar mes completo como:</p>
                                                                    </div>
                                                                    {ESTADOS.map(e => {
                                                                        const cfg = ESTADO_CONFIG[e];
                                                                        return (
                                                                            <button key={e} onClick={() => handleMarkRowAs(col, e)}
                                                                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[10px] font-black hover:bg-slate-50 transition-colors`}>
                                                                                <span className={`w-5 h-5 rounded-lg ${cfg.color} text-white text-[8px] flex items-center justify-center flex-shrink-0`}>{cfg.icon}</span>
                                                                                <span className={cfg.text}>{e}</span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Celdas de días */}
                                                {diasArray.map(d => {
                                                    const registro  = dias[d];
                                                    const fechaStr  = dayToDateStr(d);
                                                    const fechaObj  = new Date(periodYear, periodMonth - 1, d);
                                                    const esFuturo  = fechaStr > todayStr;
                                                    const esDom     = fechaObj.getDay() === 0;
                                                    const esFS      = esDom || fechaObj.getDay() === 6;
                                                    const esHoy     = fechaStr === todayStr;
                                                    const esFer     = isDayFeriado(d);
                                                    return (
                                                        <CeldaCalendario key={d}
                                                            registro={registro}
                                                            esHoy={esHoy}
                                                            esFuturo={esFuturo}
                                                            esFinSemana={esFS}
                                                            esFeriado={esFer}
                                                            esDomingo={esDom}
                                                            onClick={() => !esFuturo && openModal(col, d, registro)}
                                                        />
                                                    );
                                                })}
                                                {/* Stats */}
                                                <td className="px-3 text-center text-xs font-black text-emerald-600">{stats.diasTrabajados ?? '—'}</td>
                                                <td className="px-3 text-center text-xs font-black text-rose-500">{stats.diasAusente ?? '—'}</td>
                                                <td className="px-3 text-center text-xs font-black text-amber-500">{stats.diasTardanza ?? '—'}</td>
                                                <td className="px-3 text-center text-xs font-black text-violet-600">{stats.horasExtraDecl > 0 ? `${stats.horasExtraDecl}h` : '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB: REGISTRO DIARIO
            ════════════════════════════════════════════════════════ */}
            {viewTab === 'diario' && (
                <div>
                    {/* Date selector + bulk mark day */}
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                                max={todayStr}
                                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-sm" />
                        </div>
                        <button onClick={() => {
                            const d = new Date(selectedDate).getDate();
                            setBulkEstado('Presente');
                            handleBulkMarcar(d);
                        }} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100 disabled:opacity-50">
                            <Zap size={13} /> Marcar todos Presentes
                        </button>
                        <button onClick={() => openModal({ _id: '', fullName: '' }, new Date(selectedDate).getDate())}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                            <Plus size={13} /> Nuevo Registro
                        </button>
                    </div>

                    {/* Lista del día */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="p-5 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-tight">
                                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h3>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {colaboradoresFiltrados.map(col => {
                                const day = new Date(selectedDate).getDate();
                                const registro = calendarioMap[col._id?.toString()]?.[day];
                                const turno = turnoMap[col._id?.toString()];
                                return (
                                    <div key={col._id} className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors ${registro ? '' : 'opacity-60'}`}>
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                                            style={{ backgroundColor: turno?.color || '#6366F1' }}>
                                            {col.fullName?.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-800 uppercase">{col.fullName}</p>
                                            <p className="text-[9px] text-slate-400 font-bold">{turno?.nombre || 'Sin turno'} · {col.position || col.cargo || ''}</p>
                                        </div>
                                        {registro ? (
                                            <>
                                                <EstadoBadge estado={registro.estado} small />
                                                <span className="text-[10px] font-mono font-bold text-slate-500">{fmtTime(registro.horaEntrada)} — {fmtTime(registro.horaSalida)}</span>
                                                {registro.minutosTardanza > 0 && <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{registro.minutosTardanza}min tard.</span>}
                                                {registro.horasExtra > 0 && <span className="text-[9px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">+{registro.horasExtra}h HE</span>}
                                                <button onClick={() => openModal(col, day, registro)} className="p-2 bg-slate-100 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-all"><Edit3 size={12} /></button>
                                                <button onClick={() => handleDeleteRegistro(registro._id)} className="p-2 bg-slate-100 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-all"><Trash2 size={12} /></button>
                                            </>
                                        ) : (
                                            <button onClick={() => openModal(col, day)}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-100 hover:text-indigo-600 transition-all">
                                                <Plus size={11} /> Registrar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB: RESUMEN PERÍODO
            ════════════════════════════════════════════════════════ */}
            {viewTab === 'resumen' && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Resumen del Período</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Base para sincronización con Nómina & Remuneraciones</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleExportExcel} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm">
                                <Download size={13} className="text-emerald-500" /> Exportar Excel
                            </button>
                            <a href="/rrhh/nomina" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100">
                                <ArrowRight size={13} /> Ir a Nómina
                            </a>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[900px]">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        {['Colaborador', 'Turno', 'Días Trab.', 'Ausencias', 'Tardanzas', 'Min Tard.', 'HE Decl.', 'HE Apro.', 'Descuento', 'Bono Asist.'].map(h => (
                                            <th key={h} className="px-5 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {resumenPorColaborador.map(c => (
                                        <tr key={c._id} className="hover:bg-indigo-50/10 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center justify-center">{c.fullName?.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-800 uppercase">{c.fullName}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono">{c.rut}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-[10px] font-bold text-slate-600">{c.turnoNombre}</td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-sm font-black text-emerald-600">{c.diasTrabajados}</span>
                                                <span className="text-[9px] text-slate-400 ml-1">/{diasEnMes}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {c.diasAusente > 0
                                                    ? <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">{c.diasAusente}</span>
                                                    : <span className="text-xs font-black text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {c.diasTardanza > 0
                                                    ? <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{c.diasTardanza}</span>
                                                    : <span className="text-xs font-black text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center text-xs font-bold text-slate-500">{c.minTardanza > 0 ? `${c.minTardanza}min` : '—'}</td>
                                            <td className="px-5 py-4 text-center text-xs font-bold text-violet-600">{c.horasExtraDecl > 0 ? `${c.horasExtraDecl}h` : '—'}</td>
                                            <td className="px-5 py-4 text-center">
                                                {c.horasExtraApro > 0
                                                    ? <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{c.horasExtraApro}h</span>
                                                    : <span className="text-xs font-black text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {c.diasDescontados > 0
                                                    ? <span className="text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">-{c.diasDescontados}d</span>
                                                    : <span className="text-[9px] text-slate-300">—</span>}
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {c.calificaBono
                                                    ? <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">✓ Califica</span>
                                                    : <span className="text-[9px] font-black text-rose-400 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">✗ No</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                TAB: HORAS EXTRA
            ════════════════════════════════════════════════════════ */}
            {viewTab === 'horasextra' && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Gestión de Horas Extra</h2>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Art. 32 C.T. — Recargo 50% · Código DT 1003</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-slate-100 p-1 rounded-2xl shadow-sm">
                            {['Pendiente', 'Aprobado', 'Rechazado', 'todos'].map(f => (
                                <button key={f} onClick={() => setHeFilter(f)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${heFilter === f
                                        ? f === 'Aprobado' ? 'bg-emerald-600 text-white'
                                          : f === 'Rechazado' ? 'bg-rose-600 text-white'
                                          : f === 'Pendiente' ? 'bg-amber-500 text-white'
                                          : 'bg-slate-800 text-white'
                                        : 'text-slate-400 hover:bg-slate-50'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats HE */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { label: 'HE Pendientes', val: registrosMes.filter(r => r.estadoHorasExtra === 'Pendiente').reduce((s, r) => s + r.horasExtra, 0), color: 'bg-amber-500' },
                            { label: 'HE Aprobadas',  val: registrosMes.filter(r => r.estadoHorasExtra === 'Aprobado').reduce((s, r) => s + r.horasExtraAprobadas, 0), color: 'bg-emerald-600' },
                            { label: 'HE Rechazadas', val: registrosMes.filter(r => r.estadoHorasExtra === 'Rechazado').reduce((s, r) => s + r.horasExtra, 0), color: 'bg-rose-600' },
                        ].map(s => (
                            <div key={s.label} className={`${s.color} text-white p-5 rounded-2xl shadow-lg`}>
                                <p className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-1">{s.label}</p>
                                <p className="text-3xl font-black">{s.val}h</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                        {hePendientes.length === 0 ? (
                            <div className="py-24 text-center">
                                <Timer size={40} className="mx-auto text-slate-200 mb-4" />
                                <p className="text-sm font-black text-slate-400 uppercase">No hay horas extra en estado {heFilter}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {hePendientes.map(r => {
                                    const col = colaboradores.find(c => c._id === (r.candidatoId?._id || r.candidatoId));
                                    const turno = turnos.find(t => t._id === (r.turnoId?._id || r.turnoId));
                                    return (
                                        <div key={r._id} className="flex items-center gap-5 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="w-10 h-10 rounded-xl bg-violet-600 text-white text-sm font-black flex items-center justify-center flex-shrink-0">
                                                {(r.colaboradorNombre || '?').charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 uppercase">{r.colaboradorNombre}</p>
                                                <p className="text-[9px] text-slate-400">
                                                    {new Date(r.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })}
                                                    {r.horaEntrada && ` · ${r.horaEntrada}–${r.horaSalida}`}
                                                    {turno && ` · Turno: ${turno.nombre}`}
                                                </p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-violet-700">{r.horasExtra}h</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase">declaradas</p>
                                            </div>
                                            {r.observacion && (
                                                <p className="text-[9px] text-slate-500 italic max-w-[160px] truncate">{r.observacion}</p>
                                            )}
                                            <div className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase ${
                                                r.estadoHorasExtra === 'Aprobado'  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                r.estadoHorasExtra === 'Rechazado' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                {r.estadoHorasExtra}
                                            </div>
                                            {r.estadoHorasExtra === 'Pendiente' && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleHEAction(r, 'aprobar')}
                                                        className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all shadow-sm">
                                                        <Check size={11} /> Aprobar
                                                    </button>
                                                    <button onClick={() => handleHEAction(r, 'rechazar')}
                                                        className="flex items-center gap-1 px-3 py-2 bg-rose-100 text-rose-700 rounded-xl text-[9px] font-black uppercase hover:bg-rose-200 transition-all">
                                                        <X size={11} /> Rechazar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════════════
                MODAL: REGISTRO / EDICIÓN
            ════════════════════════════════════════════════════════ */}
            {modalReg && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-700 rounded-t-[2rem] flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                                    {formReg._id ? 'Editar Registro' : 'Registrar Asistencia'}
                                </h2>
                                <p className="text-[10px] font-bold text-indigo-200 mt-1 uppercase">
                                    {modalReg.col?.fullName} · {new Date(`${formReg.fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </p>
                            </div>
                            <button onClick={() => setModalReg(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all"><X size={18} /></button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Selector colaborador (si no viene del calendario) */}
                            {!modalReg.col?._id && (
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Colaborador *</label>
                                    <select required value={formReg.candidatoId}
                                        onChange={e => setFormReg(p => ({ ...p, candidatoId: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        <option value="">— Seleccionar colaborador —</option>
                                        {colaboradores.map(c => <option key={c._id} value={c._id}>{c.fullName} ({c.rut})</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Estado */}
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado</label>
                                <div className="flex flex-wrap gap-2">
                                    {ESTADOS.map(e => (
                                        <button key={e} type="button" onClick={() => setFormReg(p => ({ ...p, estado: e }))}
                                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${formReg.estado === e ? ESTADO_CONFIG[e].badge + ' ring-2 ring-current scale-105' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Tipo ausencia (si aplica) */}
                            {['Ausente', 'Licencia', 'Permiso', 'Vacaciones', 'Feriado'].includes(formReg.estado) && (
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Tipo de Ausencia</label>
                                    <select value={formReg.tipoAusencia || ''}
                                        onChange={e => setFormReg(p => ({
                                            ...p,
                                            tipoAusencia: e.target.value || null,  // '' → null (enum no acepta string vacío)
                                            descuentaDia: e.target.value === 'Inasistencia Injustificada',
                                        }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        <option value="">— Seleccionar tipo —</option>
                                        {TIPOS_AUSENCIA.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                        <input type="checkbox" checked={formReg.descuentaDia}
                                            onChange={e => setFormReg(p => ({ ...p, descuentaDia: e.target.checked }))}
                                            className="w-4 h-4 rounded accent-rose-600" />
                                        <span className="text-[9px] font-black text-rose-700 uppercase tracking-wide">Descuenta del sueldo (ausencia injustificada)</span>
                                    </label>
                                </div>
                            )}

                            {/* Turno */}
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Turno asignado</label>
                                <select value={formReg.turnoId}
                                    onChange={e => {
                                        const t = turnos.find(t => t._id === e.target.value);
                                        setFormReg(p => ({
                                            ...p,
                                            turnoId: e.target.value,
                                            horaEntrada: t?.horaEntrada || p.horaEntrada,
                                            horaSalida:  t?.horaSalida  || p.horaSalida,
                                        }));
                                    }}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="">— Sin turno —</option>
                                    {turnos.map(t => (
                                        <option key={t._id} value={t._id}>{t.nombre} ({t.horaEntrada}–{t.horaSalida})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Horario */}
                            {['Presente', 'Tardanza'].includes(formReg.estado) && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Hora Entrada</label>
                                        <input type="time" value={formReg.horaEntrada}
                                            onChange={e => handleFormEntrada(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Hora Salida</label>
                                        <input type="time" value={formReg.horaSalida}
                                            onChange={e => setFormReg(p => ({ ...p, horaSalida: e.target.value }))}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                    </div>
                                </div>
                            )}

                            {/* Tardanza */}
                            {formReg.minutosTardanza > 0 && (
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3">
                                    <Clock size={16} className="text-amber-600 flex-shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black text-amber-700">Tardanza detectada: {formReg.minutosTardanza} minutos</p>
                                        <p className="text-[8px] text-amber-500">Se registrará en el historial de asistencia</p>
                                    </div>
                                    <input type="number" value={formReg.minutosTardanza}
                                        onChange={e => setFormReg(p => ({ ...p, minutosTardanza: parseInt(e.target.value) || 0 }))}
                                        className="ml-auto w-16 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-black text-amber-700 outline-none" />
                                </div>
                            )}

                            {/* Horas Extra */}
                            <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Timer size={14} className="text-violet-600" />
                                        <span className="text-[10px] font-black text-violet-700 uppercase tracking-wide">Horas Extra (Art. 32 CT)</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-1">Horas declaradas</label>
                                        <input type="number" min="0" max="12" step="0.5" value={formReg.horasExtra}
                                            onChange={e => setFormReg(p => ({
                                                ...p,
                                                horasExtra: parseFloat(e.target.value) || 0,
                                                estadoHorasExtra: parseFloat(e.target.value) > 0 ? 'Pendiente' : 'Sin HE',
                                            }))}
                                            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm font-black text-violet-700 outline-none focus:ring-2 focus:ring-violet-200" />
                                    </div>
                                    <div>
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-1">Estado aprobación</label>
                                        <select value={formReg.estadoHorasExtra}
                                            onChange={e => setFormReg(p => ({ ...p, estadoHorasExtra: e.target.value }))}
                                            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-violet-200">
                                            {['Sin HE', 'Pendiente', 'Aprobado', 'Rechazado'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {formReg.estadoHorasExtra === 'Aprobado' && (
                                    <div className="mt-2">
                                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-wide block mb-1">Horas aprobadas</label>
                                        <input type="number" min="0" max={formReg.horasExtra} step="0.5"
                                            value={formReg.horasExtraAprobadas}
                                            onChange={e => setFormReg(p => ({ ...p, horasExtraAprobadas: parseFloat(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 bg-white border border-violet-200 rounded-xl text-sm font-black text-emerald-700 outline-none" />
                                    </div>
                                )}
                            </div>

                            {/* Observación */}
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Observación</label>
                                <textarea value={formReg.observacion}
                                    onChange={e => setFormReg(p => ({ ...p, observacion: e.target.value }))}
                                    rows={2}
                                    placeholder="Opcional..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                            </div>

                            {/* Botones */}
                            <div className="flex gap-3 pt-2">
                                {formReg._id && (
                                    <button type="button" onClick={() => handleDeleteRegistro(formReg._id)}
                                        className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button type="button" onClick={() => setModalReg(null)}
                                    className="flex-1 py-3 border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                                <button type="button" onClick={handleSaveRegistro} disabled={saving}
                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    {formReg._id ? 'Actualizar' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControlAsistencia;
