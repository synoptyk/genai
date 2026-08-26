import React, { useState, useEffect, useRef, useMemo } from 'react';
import { asistenciaApi, turnosApi, candidatosApi, telecomAsistenciaApi } from '../rrhhApi';
import {
    ChevronLeft, ChevronRight, Loader2, Users, Calendar,
    Clock, Shield, Download, Filter, X, Briefcase, Building2, UserCircle, Zap
} from 'lucide-react';
import * as XLSX from 'xlsx';

/* ─────────────── HELPERS ─────────────── */
const monthName = (d) =>
    new Date(d.getFullYear(), d.getMonth(), 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' });

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const toHHmm = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    const m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    const d = new Date(str);
    if (!isNaN(d)) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return null;
};

const timeToMinutes = (hhmm) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const minutesDiff = (from, to) => {
    if (!from || !to) return 0;
    let diff = timeToMinutes(to) - timeToMinutes(from);
    if (diff < 0) diff += 24 * 60; // turno nocturno
    return diff;
};

const fmtMinutes = (min) => {
    if (!min || min === 0) return null;
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.abs(min) % 60;
    const sign = min < 0 ? '-' : '+';
    return `${sign}${h}:${String(m).padStart(2, '0')}`;
};

/** Formatea minutos como "Xh YYm" para las columnas de resumen */
const fmtHrs = (min) => {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.abs(min) % 60;
    if (h === 0 && m === 0) return '0h';
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const dayOfWeek = (year, month, day) =>
    new Date(year, month, day).toLocaleString('es-CL', { weekday: 'short' }).toUpperCase().slice(0, 3);

// Mapa JS getDay() → nombre del día en español (igual que el turno)
const MAPA_DIAS = {
    0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
    4: 'Jueves', 5: 'Viernes', 6: 'Sábado'
};

const FERIADOS_2026 = [
    '2026-01-01','2026-04-03','2026-04-04','2026-05-01','2026-05-21',
    '2026-06-21','2026-06-29','2026-07-16','2026-08-15','2026-09-18',
    '2026-09-19','2026-10-12','2026-10-31','2026-11-01','2026-12-08','2026-12-25'
];
const isFeriado = (year, month, day) =>
    FERIADOS_2026.includes(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`);

const normStr = str => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/* ── getHorarioDia: obtiene el horario específico de un turno para un día de la semana ── */
const getHorarioDia = (turno, diaNombre) => {
    if (!turno) return null;
    const override = (turno.horariosPorDia || []).find(h => normStr(h.dia) === normStr(diaNombre));
    return {
        horaEntrada:     override?.horaEntrada     ?? turno.horaEntrada     ?? null,
        horaSalida:      override?.horaSalida      ?? turno.horaSalida      ?? null,
        colacionMinutos: override?.colacionMinutos  ?? turno.colacionMinutos ?? 60,
        hasOverride: !!override,
    };
};

/* ── Horas efectivas del turno para un día específico ── */
const getHorasEfectivasDia = (turno, diaNombre) => {
    const h = getHorarioDia(turno, diaNombre);
    if (!h || !h.horaEntrada || !h.horaSalida) return null;
    const raw = minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0);
    return Math.max(0, raw) / 60; // en horas decimales
};

/* ─────────────── ESTADO CONFIG ─────────────── */
const ESTADO_CONFIG = {
    'Presente':        { bg: '#dcfce7', border: '#86efac', text: '#15803d', label: 'P' },
    'Ausente':         { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c', label: 'A' },
    'Tardanza':        { bg: '#fef9c3', border: '#fde047', text: '#854d0e', label: 'T' },
    'Licencia Médica': { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8', label: 'LM' },
    'Permiso':         { bg: '#f3e8ff', border: '#c084fc', text: '#6b21a8', label: 'PE' },
    'Vacaciones':      { bg: '#cffafe', border: '#67e8f9', text: '#0e7490', label: 'VA' },
    'Feriado':         { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', label: 'FE' },
    'Suspendido':      { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'SU' },
    'Libre':           { bg: '#f1f5f9', border: '#cbd5e1', text: '#64748b', label: 'L' },
    'NC':              { bg: '#cbd5e1', border: '#94a3b8', text: '#475569', label: 'NC' },
    'Finiquitado':     { bg: '#fdd8e5', border: '#f472b6', text: '#be185d', label: 'FI' },
    'default':         { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', label: '—' },
};
const getCfg = (estado) => ESTADO_CONFIG[estado] || ESTADO_CONFIG['default'];

/* ─────────────── CELDA DÍA ─────────────── */
const CeldaDia = ({ reg, turnoHorario }) => {
    const [hover, setHover] = useState(false);

    if (!reg) {
        return (
            <td style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0', minWidth: 76, verticalAlign: 'middle' }}
                className="text-center py-1 px-0.5">
                <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
            </td>
        );
    }

    const cfg = getCfg(reg.estado);
    const entrada = toHHmm(reg.horaEntrada);
    const salida  = toHHmm(reg.horaSalida);

    const estadosSinHorario = ['NC', 'Finiquitado', 'Libre', 'Permiso', 'Licencia Médica', 'Vacaciones', 'Suspendido'];
    const ignoresHorario = estadosSinHorario.includes(reg.estado);

    // Calcular extras usando el horario ESPECÍFICO del día del turno
    let extraMin = 0;
    if (entrada && salida && turnoHorario && !ignoresHorario) {
        const workedMin = minutesDiff(entrada, salida) - (turnoHorario.colacionMinutos || 0);
        const expectedMin = minutesDiff(turnoHorario.horaEntrada, turnoHorario.horaSalida) - (turnoHorario.colacionMinutos || 0);
        if (expectedMin > 0) extraMin = workedMin - expectedMin;
    }

    const extraStr = extraMin !== 0 ? fmtMinutes(extraMin) : null;
    const isExtra  = extraMin > 0;

    // Horario esperado del turno para mostrar en tooltip
    const espEntrada = ignoresHorario ? null : turnoHorario?.horaEntrada;
    const espSalida  = ignoresHorario ? null : turnoHorario?.horaSalida;

    return (
        <td
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: cfg.bg,
                borderRight: `1px solid ${cfg.border}`,
                borderBottom: `2px solid ${cfg.border}`,
                minWidth: 76,
                position: 'relative',
                transition: 'box-shadow 0.15s',
                boxShadow: hover ? `0 0 0 2px ${cfg.border}` : 'none',
                verticalAlign: 'middle',
            }}
            className="px-1 py-1"
        >
            {/* Badge estado */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                <span style={{ background: cfg.border, color: cfg.text, fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 99, letterSpacing: 1 }}>
                    {cfg.label}
                </span>
            </div>

            {/* Horas reales */}
            {(entrada || salida) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>▲ {entrada || '—'}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>▼ {salida || '—'}</span>
                    {extraStr && (
                        <span style={{
                            fontSize: 9, fontWeight: 900,
                            color: isExtra ? '#15803d' : '#b91c1c',
                            background: isExtra ? '#dcfce7' : '#fee2e2',
                            borderRadius: 99, padding: '0px 4px', marginTop: 1,
                        }}>
                            {extraStr}h
                        </span>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: 'center', fontSize: 9, color: cfg.text, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>
                    {reg.estado === 'Ausente' ? 'INASISTENCIA' :
                     reg.estado === 'Licencia Médica' ? 'LIC.\nMÉDICA' :
                     reg.estado === 'Permiso' ? 'PERMISO' :
                     reg.estado === 'Vacaciones' ? 'VACAC.' :
                     reg.estado === 'Feriado' ? 'FERIADO' :
                     reg.estado === 'Libre' ? 'LIBRE' :
                     reg.estado === 'NC' ? 'NO CONTRAT.' :
                     reg.estado === 'Finiquitado' ? 'FINIQUITADO' : reg.estado}
                </div>
            )}

            {/* Tooltip */}
            {hover && (
                <div style={{
                    position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', color: 'white', borderRadius: 8, padding: '7px 12px',
                    fontSize: 11, whiteSpace: 'nowrap', zIndex: 1000,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.35)', pointerEvents: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                }}>
                    <div style={{ fontWeight: 900, marginBottom: 3, color: '#e2e8f0' }}>{reg.estado}</div>
                    {entrada && <div style={{ color: '#93c5fd' }}>Real entrada: <b style={{ color: 'white' }}>{entrada}</b></div>}
                    {salida  && <div style={{ color: '#c4b5fd' }}>Real salida: <b style={{ color: 'white' }}>{salida}</b></div>}
                    {espEntrada && (
                        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ color: '#94a3b8', fontSize: 10 }}>
                                Turno esperado: <b style={{ color: '#fbbf24' }}>{espEntrada} - {espSalida}</b>
                                {turnoHorario?.hasOverride && <span style={{ color: '#f472b6', marginLeft: 4 }}>· Custom</span>}
                            </div>
                        </div>
                    )}
                    {extraStr && (
                        <div style={{ color: isExtra ? '#4ade80' : '#f87171', marginTop: 3, fontWeight: 700 }}>
                            {isExtra ? '▲ Horas extra: ' : '▼ Descuento: '}<b>{extraStr}h</b>
                        </div>
                    )}
                    {reg.observacionLegal && (
                        <div style={{ color: '#94a3b8', marginTop: 3, maxWidth: 180, whiteSpace: 'normal', fontSize: 10 }}>
                            {reg.observacionLegal}
                        </div>
                    )}
                </div>
            )}
        </td>
    );
};

/* ─────────────── CELDA DÍA SIN REGISTRO (Libre / Feriado / horario esperado) ─────────────── */
const CeldaDiaSinReg = ({ estado, turnoHorario }) => {
    const [hover, setHover] = useState(false);
    const cfg = getCfg(estado);

    return (
        <td
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                background: cfg.bg,
                borderRight: `1px solid ${cfg.border}`,
                borderBottom: `2px solid ${cfg.border}`,
                minWidth: 76,
                position: 'relative',
                transition: 'box-shadow 0.15s',
                boxShadow: hover ? `0 0 0 2px ${cfg.border}` : 'none',
                verticalAlign: 'middle',
            }}
            className="px-1 py-1"
        >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                <span style={{ background: cfg.border, color: cfg.text, fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 99 }}>
                    {cfg.label}
                </span>
            </div>
            {/* Si hay horario de turno esperado (día laboral sin marca), mostrarlo en gris */}
            {turnoHorario && estado !== 'Feriado' && estado !== 'Libre' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>▲ {turnoHorario.horaEntrada}</span>
                    <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace' }}>▼ {turnoHorario.horaSalida}</span>
                </div>
            )}
            {(!turnoHorario || estado === 'Feriado' || estado === 'Libre') && (
                <div style={{ textAlign: 'center', fontSize: 9, color: cfg.text, fontWeight: 700, lineHeight: 1.2 }}>
                    {estado === 'Feriado' ? 'FERIADO' : estado === 'Libre' ? 'LIBRE' : '—'}
                </div>
            )}

            {/* Tooltip */}
            {hover && turnoHorario && estado !== 'Feriado' && estado !== 'Libre' && (
                <div style={{
                    position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', color: 'white', borderRadius: 8, padding: '7px 12px',
                    fontSize: 11, whiteSpace: 'nowrap', zIndex: 1000,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.35)', pointerEvents: 'none',
                }}>
                    <div style={{ fontWeight: 900, color: '#fca5a5', marginBottom: 3 }}>SIN REGISTRO</div>
                    <div style={{ color: '#94a3b8', fontSize: 10 }}>
                        Turno esperado: <b style={{ color: '#fbbf24' }}>{turnoHorario.horaEntrada} - {turnoHorario.horaSalida}</b>
                    </div>
                </div>
            )}
        </td>
    );
};

/* ─────────────── MODAL DETALLE TURNO + TRABAJADOR ─────────────── */
const TurnoModal = ({ turno, candidato, onClose }) => {
    if (!turno) return null;

    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200" style={{ maxHeight: '90vh' }}>
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition-colors z-10">
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="p-6 pb-4 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black leading-tight">{turno.nombre}</h3>
                            <p className="text-indigo-200 text-xs font-medium">{turno.tipo || 'Full Day'} · {turno.descripcion || 'Jornada laboral'}</p>
                        </div>
                    </div>

                    {/* Info trabajador */}
                    {candidato && (
                        <div className="mt-3 pt-3 border-t border-white/20 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <UserCircle size={14} className="text-indigo-300" />
                                <span className="text-sm font-bold text-white">{candidato.fullName || candidato.nombre}</span>
                                <span className="text-indigo-300 text-xs ml-1">{candidato.rut}</span>
                            </div>
                            {(candidato.projectName || candidato.clienteNombre) && (
                                <div className="flex items-center gap-4 mt-1">
                                    {candidato.projectName && (
                                        <div className="flex items-center gap-1.5">
                                            <Briefcase size={12} className="text-indigo-300" />
                                            <span className="text-xs text-indigo-100 font-semibold">{candidato.projectName}</span>
                                        </div>
                                    )}
                                    {candidato.clienteNombre && (
                                        <div className="flex items-center gap-1.5">
                                            <Building2 size={12} className="text-indigo-300" />
                                            <span className="text-xs text-indigo-100 font-semibold">{candidato.clienteNombre}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {candidato.position && (
                                <div className="text-xs text-indigo-300 flex items-center gap-1.5 mt-0.5">
                                    <Users size={12} />
                                    {candidato.position}
                                    {candidato.sede && <span className="ml-2">· {candidato.sede}</span>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Cuerpo scroll */}
                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                    {/* Horario base */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Horario Base (predeterminado)</p>
                        <div className="flex items-center justify-between">
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold mb-1">ENTRADA</p>
                                <p className="text-xl font-black text-indigo-600 font-mono">{turno.horaEntrada || '--:--'}</p>
                            </div>
                            <div className="text-slate-300 font-black text-xl">→</div>
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold mb-1">SALIDA</p>
                                <p className="text-xl font-black text-violet-600 font-mono">{turno.horaSalida || '--:--'}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold mb-1">COLACIÓN</p>
                                <p className="text-lg font-black text-amber-600">{turno.colacionMinutos || 0}<span className="text-xs font-bold ml-0.5">min</span></p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-slate-400 font-bold mb-1">EFECTIVAS</p>
                                <p className="text-lg font-black text-emerald-600">{turno.horasTrabajo || '—'}<span className="text-xs font-bold ml-0.5">hrs/día</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Horario por día */}
                    <div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Horario por Día</p>
                        <div className="overflow-hidden rounded-2xl border border-slate-100">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-slate-50">
                                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase">Día</th>
                                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">Entrada</th>
                                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">Salida</th>
                                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-center">Colac.</th>
                                        <th className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase text-right">Hrs ef.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {DIAS.map((d, i) => {
                                        const activo = (turno.diasSemana || []).includes(d);
                                        const h = getHorarioDia(turno, d);
                                        const mins = h ? Math.max(0, minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0)) : 0;
                                        const hrs = (mins / 60).toFixed(1);
                                        return (
                                            <tr key={d} className={activo ? (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50') : 'bg-slate-50 opacity-40'}>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ background: activo ? (turno.color || '#6366f1') : '#cbd5e1' }} />
                                                        <span className={`text-[11px] font-black uppercase ${activo ? 'text-slate-700' : 'text-slate-300'}`}>{d.slice(0,3)}</span>
                                                        {h?.hasOverride && activo && (
                                                            <span className="text-[7px] bg-pink-100 text-pink-600 font-black px-1 rounded">Custom</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center font-mono text-[11px] font-bold text-indigo-600">{activo ? h?.horaEntrada || '—' : '—'}</td>
                                                <td className="px-3 py-2 text-center font-mono text-[11px] font-bold text-violet-600">{activo ? h?.horaSalida || '—' : '—'}</td>
                                                <td className="px-3 py-2 text-center text-[11px] font-bold text-amber-600">{activo ? `${h?.colacionMinutos || 0}m` : '—'}</td>
                                                <td className="px-3 py-2 text-right">
                                                    {activo ? (
                                                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${parseFloat(hrs) > 9 ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                            {hrs}h
                                                        </span>
                                                    ) : <span className="text-slate-300 text-[11px]">Libre</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tolerancia */}
                    {turno.toleranciaTardanza > 0 && (
                        <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-xs text-amber-700 font-bold">
                            ⏱ Tolerancia tardanza: {turno.toleranciaTardanza} minutos
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ─────────────── COMPONENTE PRINCIPAL ─────────────── */
const CalendarioAsistencia = () => {
    const today = new Date();
    const [mes, setMes] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [loading, setLoading] = useState(false);
    const [registros, setRegistros] = useState([]);
    const [turnos, setTurnos]       = useState([]);
    const [candidatos, setCandidatos] = useState([]);
    
    const [searchQ, setSearchQ]         = useState('');
    const [filterTurno, setFilterTurno] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    const [selectedModal, setSelectedModal] = useState(null); // { turno, candidato }
    const tableRef = useRef(null);

    const year  = mes.getFullYear();
    const month = mes.getMonth();
    const days  = daysInMonth(year, month);

    const [syncing, setSyncing] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [rA, rT, rC] = await Promise.all([
                asistenciaApi.getAll({ year, month: month + 1 }),
                turnosApi.getAll(),
                candidatosApi.getAll({ limit: 2000 }),
            ]);
            setRegistros(rA.data || []);
            setTurnos(rT.data || []);
            setCandidatos(rC.data?.data || rC.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    /* ── Fetch ── */
    useEffect(() => {
        load();
    }, [mes]);

    // Sincronización
    const handleSyncProduccion = async () => {
        if (!window.confirm("¿Deseas sincronizar los datos de asistencia con producción Telecom para este mes?")) {
            return;
        }
        setSyncing(true);
        try {
            const period = `${year}-${String(month + 1).padStart(2, '0')}`;
            // 1. Cargar producción de todo el mes
            const res = await telecomAsistenciaApi.getProduccionStats({ months: period });
            const prodData = res.data?.tecnicos || res.data?.data || [];
            
            console.log("DEBUG ADVANCED SYNC CALENDARIO: prodData returned", prodData.length, "technicians.");
            
            // Mapear días con producción por RUT / TOA ID
            const rutProdMap = {};
            prodData.forEach(t => {
                const cleanRut = (t.rut || '').replace(/[^0-9kK]/g, '');
                if (cleanRut && t.dailyMap) {
                    if (!rutProdMap[cleanRut]) rutProdMap[cleanRut] = new Set();
                    Object.entries(t.dailyMap).forEach(([dateStr, daily]) => {
                        if (daily.orders > 0 || daily.ptsTotal > 0 || daily.ptsCompletados > 0) {
                            rutProdMap[cleanRut].add(dateStr);
                        }
                    });
                } else if (!cleanRut && t.idRecursoToa && t.dailyMap) {
                    const toaId = String(t.idRecursoToa).trim();
                    if (!rutProdMap[`TOA_${toaId}`]) rutProdMap[`TOA_${toaId}`] = new Set();
                    Object.entries(t.dailyMap).forEach(([dateStr, daily]) => {
                        if (daily.orders > 0 || daily.ptsTotal > 0 || daily.ptsCompletados > 0) {
                            rutProdMap[`TOA_${toaId}`].add(dateStr);
                        }
                    });
                }
            });

            const nuevosRegistros = [];
            const mapDia = { Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6, Domingo: 0 };
            
            const todayStr = new Date().toISOString().split('T')[0];

            candidatos.forEach(col => {
                const cRut = (col.rut || '').replace(/[^0-9kK]/g, '');
                const cToa = String(col.idRecursoToa || col.idRecurso || '').trim();
                
                let prodDays = null;
                if (cRut && rutProdMap[cRut]) {
                    prodDays = rutProdMap[cRut];
                } else if (cToa && rutProdMap[`TOA_${cToa}`]) {
                    prodDays = rutProdMap[`TOA_${cToa}`];
                }

                const turno = getTurno(col._id);
                const diasTurno = new Set(turno?.diasSemana || []);
                
                // Fechas límite de contrato
                const contraStart = col.contractStartDate || col.hiring?.contractStartDate || col.fechaIngreso || null;
                const isReallyFiniquitado = col.status === 'Finiquitado' || col.estado === 'Finiquitado';
                const contraEnd = col.fechaFiniquito || (isReallyFiniquitado ? col.contractEndDate : null) || null;

                // Generar para todos los días del mes
                for (let d = 1; d <= days; d++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const fechaD = new Date(`${dateStr}T12:00:00`);
                    
                    // Si la fecha es a futuro, no sincronizamos
                    if (dateStr > todayStr) continue;

                    // Verificar si ya existe registro en la base de datos para este colaborador y día
                    const existing = registros.find(r => {
                        const rCandId = r.candidatoId?._id?.toString() || r.candidatoId?.toString();
                        return rCandId === col._id?.toString() && r.fecha.startsWith(dateStr);
                    });

                    // Si ya existe registro, lo respetamos — salvo en re-sync manual cuando el
                    // registro fue creado automáticamente como 'Finiquitado' y el empleado NO está realmente finiquitado.
                    if (existing) {
                        const esFiniquitadoMalCreado = existing.estado === 'Finiquitado'
                            && !existing.minutosTardanza
                            && !existing.horasExtra
                            && !isReallyFiniquitado;
                        if (!esFiniquitadoMalCreado) continue;
                    }

                    // 1. Verificar si es antes del inicio de contrato
                    if (contraStart) {
                        const dtInicio = new Date(contraStart);
                        dtInicio.setUTCHours(0,0,0,0);
                        const dtActual = new Date(Date.UTC(year, month, d));
                        if (dtActual < dtInicio) {
                            nuevosRegistros.push({
                                candidatoId: col._id,
                                fecha: dateStr,
                                estado: 'NC',
                                descuentaDia: false,
                                minutosTardanza: 0,
                                horasExtra: 0,
                            });
                            continue;
                        }
                    }

                    // 2. Verificar si es después del finiquito
                    if (contraEnd) {
                        const dtFin = new Date(contraEnd);
                        dtFin.setUTCHours(23,59,59,999);
                        const dtActual = new Date(Date.UTC(year, month, d));
                        if (dtActual > dtFin) {
                            nuevosRegistros.push({
                                candidatoId: col._id,
                                fecha: dateStr,
                                estado: 'Finiquitado',
                                descuentaDia: true,
                                minutosTardanza: 0,
                                horasExtra: 0,
                            });
                            continue;
                        }
                    }

                    // 3. Verificar si el técnico tuvo producción
                    const tieneProd = prodDays && prodDays.has(dateStr);

                    if (tieneProd) {
                        nuevosRegistros.push({
                            candidatoId: col._id,
                            turnoId: turno?._id || undefined,
                            fecha: dateStr,
                            horaEntrada: turno?.horaEntrada || '',
                            horaSalida: turno?.horaSalida || '',
                            estado: 'Presente',
                            minutosTardanza: 0,
                            horasExtra: 0,
                        });
                    }
                }
            });

            if (nuevosRegistros.length > 0) {
                await asistenciaApi.bulkUpsert(nuevosRegistros);
                alert(`Sincronizados ${nuevosRegistros.length} nuevos registros desde producción.`);
                load();
            } else {
                alert("No se encontraron marcas de producción pendientes por registrar en este período.");
            }
        } catch (err) {
            console.error("Error sincronizando producción:", err);
            alert("Error al sincronizar producción: " + (err.message || err));
        } finally {
            setSyncing(false);
        }
    };

    /* ── Map candidatoId → turno ── */
    const turnoByWorker = useMemo(() => {
        const map = {};
        turnos.forEach(t => {
            (t.colominoAsignados || []).forEach(c => {
                const id = typeof c === 'object' ? c._id?.toString() : c?.toString();
                if (id) map[id] = t;
            });
        });
        return map;
    }, [turnos]);

    const getTurno = (candidatoId) => {
        const id = typeof candidatoId === 'object' ? candidatoId?._id?.toString() : candidatoId?.toString();
        return id ? turnoByWorker[id] : null;
    };

    /* ── Mapa candidatos ── */
    const candidatoMap = useMemo(() => {
        const m = {};
        candidatos.forEach(c => { m[c._id?.toString()] = c; });
        return m;
    }, [candidatos]);

    /* ── Agrupación registros por candidato ── */
    const byWorker = useMemo(() => {
        const map = {};
        registros.forEach(reg => {
            const cid = reg.candidatoId?._id || reg.candidatoId;
            if (!cid) return;
            const key = cid.toString();
            if (!map[key]) map[key] = { candidatoId: key, dias: {} };
            const d = new Date(reg.fecha);
            map[key].dias[d.getUTCDate()] = reg;
        });
        return map;
    }, [registros]);

    /* ── Lista de trabajadores ── */
    const workerEntries = useMemo(() => {
        const entries = [];
        const seen = new Set();

        // Trabajadores con registros
        Object.entries(byWorker).forEach(([cid, data]) => {
            seen.add(cid);
            // Intentar conseguir el candidato full del fetch de candidatos
            const candidato = candidatoMap[cid] || data.dias[Object.keys(data.dias)[0]]?.candidatoId;
            entries.push({ candidatoId: cid, candidato, dias: data.dias });
        });

        // Trabajadores con turno pero sin registros en el mes
        Object.keys(turnoByWorker).forEach(cid => {
            if (seen.has(cid)) return;
            const candidato = candidatoMap[cid];
            if (candidato) entries.push({ candidatoId: cid, candidato, dias: {} });
        });

        return entries;
    }, [byWorker, turnoByWorker, candidatoMap]);

    /* ── Filtros ── */
    const filtered = useMemo(() => {
        return workerEntries
            .filter(we => {
                const name = we.candidato?.fullName || we.candidato?.nombre || '';
                const rut  = we.candidato?.rut || '';
                if (searchQ && !name.toLowerCase().includes(searchQ.toLowerCase()) && !rut.includes(searchQ)) return false;
                
                const turno = getTurno(we.candidatoId);
                
                // Excluir trabajadores sin turno asignado
                if (!turno) return false;

                if (filterTurno && (turno?.nombre || '') !== filterTurno) return false;

                if (filterStatus === 'CON_AUSENCIAS') {
                    if (!Object.values(we.dias).some(r => r.estado === 'Ausente')) return false;
                }
                if (filterStatus === 'CON_EXTRAS') {
                    const tieneExtras = Object.entries(we.dias).some(([dayN, r]) => {
                        if (!r.horaEntrada || !r.horaSalida) return false;
                        const d = new Date(year, month, parseInt(dayN));
                        const diaNombre = MAPA_DIAS[d.getDay()];
                        const h = getHorarioDia(turno, diaNombre);
                        if (!h) return false;
                        const worked = minutesDiff(toHHmm(r.horaEntrada), toHHmm(r.horaSalida)) - (h.colacionMinutos || 0);
                        const expected = minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0);
                        return (worked - expected) > 0;
                    });
                    if (!tieneExtras) return false;
                }
                return true;
            })
            .sort((a, b) => {
                const na = a.candidato?.fullName || a.candidato?.nombre || '';
                const nb = b.candidato?.fullName || b.candidato?.nombre || '';
                return na.localeCompare(nb, 'es');
            });
    }, [workerEntries, searchQ, filterTurno, filterStatus, year, month, turnoByWorker]);

    const turnosUnicos = useMemo(() => [...new Set(turnos.map(t => t.nombre))], [turnos]);

    /* ── Export Excel ── */
    const downloadExcel = () => {
        const tableDataEstados = [];
        const tableDataHoras = [];

        filtered.forEach(we => {
            const turno = getTurno(we.candidatoId);
            
            // Base metadata for both sheets
            const baseRow = {
                'Trabajador': we.candidato?.fullName || we.candidato?.nombre || '',
                'RUT': we.candidato?.rut || '',
                'Cargo': we.candidato?.position || '',
                'Proyecto': we.candidato?.projectName || '',
                'Cliente': we.candidato?.clienteNombre || '',
                'F. Inicio': we.candidato?.contractStartDate?.split('T')[0] || '',
                'F. Término': we.candidato?.contractEndDate?.split('T')[0] || '',
                'Turno': turno?.nombre || 'SIN TURNO',
            };

            const rowEstados = { ...baseRow };
            const rowHoras = { ...baseRow };

            let p = 0, a = 0, l = 0, pe = 0;
            let totalTurnoMin = 0;
            let totalTrabajadoMin = 0;
            let totalExtraMin = 0;
            let totalNoTrabajadoMin = 0;

            let totalLibresMin = 0;

            for (let day = 1; day <= days; day++) {
                const reg = we.dias[day];
                const d = new Date(year, month, day);
                const diaNombre = MAPA_DIAS[d.getDay()];
                const esLaboral = turno ? (turno.diasSemana || []).includes(diaNombre) : false;
                const esFe = isFeriado(year, month, day);

                let estadoReal = '';
                if (reg) {
                    estadoReal = reg.estado;
                } else if (esFe) {
                    estadoReal = 'Feriado';
                } else if (!esLaboral) {
                    estadoReal = 'Libre';
                } else {
                    estadoReal = d <= today ? 'Ausente' : 'default';
                }

                const esAusenciaJustificada = estadoReal === 'Libre' || estadoReal === 'Permiso';
                const estadosIgnorados = ['NC', 'Finiquitado', 'Licencia Médica', 'Vacaciones', 'Suspendido'];
                const isIgnorado = estadosIgnorados.includes(estadoReal);

                // --- Calcular horas para los totales ---
                let expectedMin = 0;
                if (esLaboral && !esFe && turno && !isIgnorado) {
                    const h = getHorarioDia(turno, diaNombre);
                    if (h?.horaEntrada && h?.horaSalida) {
                        const reqMin = Math.max(0, minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0));
                        if (esAusenciaJustificada) {
                            totalLibresMin += reqMin;
                        } else {
                            expectedMin = reqMin;
                            totalTurnoMin += expectedMin;
                        }
                    }
                }

                let workedMin = 0;
                if (reg && reg.horaEntrada && reg.horaSalida && estadoReal !== 'NC' && estadoReal !== 'Finiquitado') {
                    const entrada = toHHmm(reg.horaEntrada);
                    const salida  = toHHmm(reg.horaSalida);
                    if (entrada && salida) {
                        const h = turno ? getHorarioDia(turno, diaNombre) : null;
                        const col = h?.colacionMinutos ?? 0;
                        workedMin = Math.max(0, minutesDiff(entrada, salida) - col);
                        totalTrabajadoMin += workedMin;
                    }
                }

                if (esLaboral && !esFe && expectedMin > 0 && d <= today) {
                    if (workedMin > expectedMin) {
                        totalExtraMin += (workedMin - expectedMin);
                    } else if (workedMin < expectedMin) {
                        if (reg?.estado !== 'Licencia Médica' && reg?.estado !== 'Vacaciones') {
                            totalNoTrabajadoMin += (expectedMin - workedMin);
                        }
                    }
                } else if (!esLaboral || esFe || esAusenciaJustificada) {
                    if (workedMin > 0) totalExtraMin += workedMin;
                }

            // --- Llenar celdas por día ---
                const diaKey = `Día ${day}`;
                
                // Estados
                if (reg) {
                    rowEstados[diaKey] = reg.estado;
                    if (reg.estado === 'Presente') p++;
                    if (reg.estado === 'Ausente') a++;
                    if (reg.estado === 'Licencia Médica') l++;
                    if (reg.estado === 'Permiso') pe++;
                } else if (esFe) {
                    rowEstados[diaKey] = 'Feriado';
                } else if (!esLaboral) {
                    rowEstados[diaKey] = 'Libre';
                } else {
                    rowEstados[diaKey] = d <= today ? 'Ausente' : '';
                    if (d <= today) a++;
                }

                // Horas
                if (reg && reg.horaEntrada && reg.horaSalida) {
                    const inStr = toHHmm(reg.horaEntrada);
                    const outStr = toHHmm(reg.horaSalida);
                    rowHoras[diaKey] = `${inStr} - ${outStr}`;
                } else if (reg && reg.estado !== 'Presente') {
                    rowHoras[diaKey] = reg.estado; // Ej. Licencia Médica
                } else if (esFe) {
                    rowHoras[diaKey] = 'Feriado';
                } else if (!esLaboral) {
                    rowHoras[diaKey] = 'Libre';
                } else {
                    rowHoras[diaKey] = d <= today ? 'Ausente' : '';
                }
            }

            const fmtHHMM = (min) => {
                if (min === 0) return '00:00';
                const isNeg = min < 0;
                const absMin = Math.abs(min);
                const h = Math.floor(absMin / 60);
                const m = absMin % 60;
                return `${isNeg ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            };

            // --- Totales Finales ---
            const totals = {
                'Total Turno': fmtHHMM(totalTurnoMin),
                'Hrs Trabajadas': fmtHHMM(totalTrabajadoMin),
                'Hrs No Trabajadas': fmtHHMM(totalNoTrabajadoMin),
                'Hrs Libres': fmtHHMM(totalLibresMin),
                'Horas Extras': fmtHHMM(totalExtraMin),
                'Balance': fmtHHMM(totalExtraMin - totalNoTrabajadoMin - totalLibresMin),
                'Total Presente': p,
                'Total Ausente': a,
                'Total Licencia': l,
                'Total Permiso': pe,
            };

            Object.assign(rowEstados, totals);
            Object.assign(rowHoras, totals);

            tableDataEstados.push(rowEstados);
            tableDataHoras.push(rowHoras);
        });

        const wb = XLSX.utils.book_new();
        const wsEstados = XLSX.utils.json_to_sheet(tableDataEstados);
        const wsHoras = XLSX.utils.json_to_sheet(tableDataHoras);

        XLSX.utils.book_append_sheet(wb, wsEstados, 'Estados Diarios');
        XLSX.utils.book_append_sheet(wb, wsHoras, 'Horas Registradas');

        XLSX.writeFile(wb, `Asistencia_${monthName(mes).replace(/ /g, '_')}.xlsx`);
    };


    /* ── Render ── */
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f1f5f9', minHeight: 0 }}>
            {/* Modal */}
            {selectedModal && (
                <TurnoModal
                    turno={selectedModal.turno}
                    candidato={selectedModal.candidato}
                    onClose={() => setSelectedModal(null)}
                />
            )}

            {/* ── Barra superior ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '10px 20px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 12, flexShrink: 0,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                {/* Navegación mes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => setMes(new Date(year, month - 1, 1))}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                        <ChevronLeft size={16} />
                    </button>
                    <div style={{ textAlign: 'center', minWidth: 160 }}>
                        <div style={{ color: 'white', fontWeight: 900, fontSize: 17, textTransform: 'capitalize' }}>
                            {monthName(mes)}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 10 }}>{days} días · {filtered.length} trabajadores</div>
                    </div>
                    <button onClick={() => setMes(new Date(year, month + 1, 1))}
                        className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors">
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* Filtros */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="relative">
                        <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            className="bg-white/10 border border-white/10 rounded-lg text-white text-xs pl-7 pr-3 py-1.5 outline-none appearance-none cursor-pointer">
                            <option value="" className="text-slate-800 bg-white">Todos</option>
                            <option value="CON_AUSENCIAS" className="text-slate-800 bg-white">Con inasistencias</option>
                            <option value="CON_EXTRAS" className="text-slate-800 bg-white">Con horas extras</option>
                        </select>
                    </div>
                    <select value={filterTurno} onChange={e => setFilterTurno(e.target.value)}
                        className="bg-white/10 border border-white/10 rounded-lg text-white text-xs px-3 py-1.5 outline-none appearance-none cursor-pointer">
                        <option value="" className="text-slate-800 bg-white">Todos los turnos</option>
                        {turnosUnicos.map(t => <option key={t} value={t} className="text-slate-800 bg-white">{t}</option>)}
                    </select>
                    <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                        placeholder="Buscar trabajador o RUT..."
                        className="bg-white/10 border border-white/10 rounded-lg text-white text-xs px-3 py-1.5 outline-none w-44 placeholder-slate-500" />
                    <button onClick={handleSyncProduccion} disabled={syncing}
                        className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-400 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md mr-1">
                        <Zap size={13} className={syncing ? 'animate-spin' : ''} /> 
                        {syncing ? 'SINCRONIZANDO...' : 'SINCRONIZAR'}
                    </button>
                    <button onClick={downloadExcel}
                        className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md">
                        <Download size={13} /> EXPORTAR
                    </button>
                </div>
            </div>

            {/* ── Leyenda ── */}
            <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '6px 20px', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Leyenda:</span>
                {Object.entries(ESTADO_CONFIG).filter(([k]) => k !== 'default').map(([estado, cfg]) => (
                    <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ background: cfg.border, color: cfg.text, fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 99 }}>{cfg.label}</span>
                        <span style={{ fontSize: 9, color: '#64748b' }}>{estado}</span>
                    </div>
                ))}
                <div style={{ marginLeft: 'auto', fontSize: 9, color: '#64748b' }}>
                    <span style={{ color: '#1e40af', fontWeight: 700 }}>▲</span> Entrada &nbsp;
                    <span style={{ color: '#7c3aed', fontWeight: 700 }}>▼</span> Salida &nbsp;
                    <b style={{ color: '#94a3b8' }}>Horario gris</b> = turno esperado sin marca
                </div>
            </div>

            {/* ── Tabla ── */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }} ref={tableRef}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                        <Loader2 size={32} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Cargando calendario...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                        <Users size={40} style={{ color: '#cbd5e1' }} />
                        <span style={{ color: '#64748b', fontWeight: 600 }}>No hay registros para este filtro</span>
                    </div>
                ) : (
                    <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {/* ── THEAD ── */}
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr>
                                <th style={{ background: '#1e293b', color: 'white', padding: '8px 14px', textAlign: 'left', fontSize: 10, fontWeight: 800, position: 'sticky', left: 0, zIndex: 20, minWidth: 240, borderRight: '2px solid #334155', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Trabajador
                                </th>
                                <th style={{ background: '#1e293b', color: '#94a3b8', padding: '8px 8px', textAlign: 'center', fontSize: 9, fontWeight: 700, position: 'sticky', left: 240, zIndex: 20, minWidth: 85, borderRight: '2px solid #334155', textTransform: 'uppercase' }}>
                                    Turno
                                </th>
                                {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                                    const dow = dayOfWeek(year, month, day);
                                    const isFe = isFeriado(year, month, day);
                                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                                    return (
                                        <th key={day} style={{
                                            background: isToday ? '#4338ca' : isFe ? '#3730a3' : '#1e293b',
                                            color: isToday ? 'white' : isFe ? '#c7d2fe' : '#e2e8f0',
                                            padding: '6px 2px', textAlign: 'center', fontSize: 10, fontWeight: 700,
                                            minWidth: 76, borderRight: '1px solid #334155',
                                        }}>
                                            <div style={{ fontWeight: 900, fontSize: 13 }}>{day}</div>
                                            <div style={{ fontSize: 8, opacity: 0.65 }}>{dow}</div>
                                            {isFe && <div style={{ fontSize: 7, color: '#a5b4fc' }}>FE</div>}
                                        </th>
                                    );
                                })}
                                {/* Columnas de resumen (sticky derecha) */}
                                <th style={{ background: '#0f172a', color: '#94a3b8', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 720, zIndex: 20, borderLeft: '2px solid #334155', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Total<br/>Turno
                                </th>
                                <th style={{ background: '#0f172a', color: '#4ade80', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 648, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Hrs<br/>Trabajadas
                                </th>
                                <th style={{ background: '#0f172a', color: '#fca5a5', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 576, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Hrs No<br/>Trabajadas
                                </th>
                                <th style={{ background: '#0f172a', color: '#93c5fd', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 504, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Hrs<br/>Libres
                                </th>
                                <th style={{ background: '#0f172a', color: '#fbbf24', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 432, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Horas<br/>Extras
                                </th>
                                <th style={{ background: '#0f172a', color: '#c084fc', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 360, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                    Balance<br/>(Ext - No Trab - Perm)
                                </th>
                                <th style={{ background: '#0f172a', color: '#94a3b8', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 700, minWidth: 72, position: 'sticky', right: 288, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase' }}>
                                    Asistencia
                                </th>
                                <th style={{ background: '#0f172a', color: '#f87171', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 216, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase' }}>
                                    Inasistencia
                                </th>
                                <th style={{ background: '#0f172a', color: '#60a5fa', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 144, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase' }}>
                                    Permisos
                                </th>
                                <th style={{ background: '#0f172a', color: '#fb923c', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 800, minWidth: 72, position: 'sticky', right: 72, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase' }}>
                                    Licencia
                                </th>
                                <th style={{ background: '#0f172a', color: '#34d399', padding: '6px 8px', textAlign: 'center', fontSize: 8, fontWeight: 900, minWidth: 72, position: 'sticky', right: 0, zIndex: 20, borderLeft: '1px solid #1e293b', textTransform: 'uppercase' }}>
                                    Días a Pago
                                </th>
                            </tr>
                        </thead>

                        {/* ── TBODY ── */}
                        <tbody>
                            {filtered.map((we, idx) => {
                                const candidato = we.candidato;
                                const turno = getTurno(we.candidatoId);
                                const name = candidato?.fullName || candidato?.nombre || '—';
                                const rut  = candidato?.rut || '';
                                const dInicio  = candidato?.contractStartDate ? new Date(candidato.contractStartDate).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '';
                                const dTermino = candidato?.contractEndDate  ? new Date(candidato.contractEndDate).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '';
                                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

                                // Pre-calcular estado por día
                                const diasInfo = Array.from({ length: days }, (_, i) => {
                                    const day = i + 1;
                                    const reg = we.dias[day];
                                    const date = new Date(year, month, day);
                                    const diaNombre = MAPA_DIAS[date.getDay()];
                                    const horarioDia = turno ? getHorarioDia(turno, diaNombre) : null;
                                    const esLaboral  = turno ? (turno.diasSemana || []).includes(diaNombre) : false;
                                    const esFe = isFeriado(year, month, day);

                                    if (reg) return { tipo: 'reg', reg, horarioDia };
                                    if (esFe) return { tipo: 'sinreg', estado: 'Feriado', horarioDia: null };
                                    if (!esLaboral) return { tipo: 'sinreg', estado: 'Libre', horarioDia: null };
                                    // Día laboral sin registro
                                    if (date <= today) return { tipo: 'sinreg', estado: 'Ausente', horarioDia };
                                    return { tipo: 'sinreg', estado: 'default', horarioDia };
                                });

                                const presentes = diasInfo.filter(d => d.reg?.estado === 'Presente').length;
                                const ausentes  = diasInfo.filter(d => d.estado === 'Ausente' || d.reg?.estado === 'Ausente').length;
                                const licencias = diasInfo.filter(d => d.reg?.estado === 'Licencia Médica').length;
                                const permisos  = diasInfo.filter(d => d.reg?.estado === 'Permiso').length;
                                const vacaciones = diasInfo.filter(d => d.reg?.estado === 'Vacaciones').length;

                                return (
                                    <tr key={we.candidatoId || idx} style={{ background: rowBg }}>
                                        {/* Nombre */}
                                        <td style={{ position: 'sticky', left: 0, background: rowBg, zIndex: 5, padding: '6px 14px', borderRight: '2px solid #e2e8f0', minWidth: 240 }}>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', lineHeight: 1.2 }}>{name}</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 }}>
                                                <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>{rut}</span>
                                                {dInicio && <span style={{ fontSize: 8, color: '#10b981', background: '#d1fae5', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>Inicio: {dInicio}</span>}
                                                {dTermino && <span style={{ fontSize: 8, color: '#ef4444', background: '#fee2e2', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>Fin: {dTermino}</span>}
                                            </div>
                                            {(candidato?.projectName || candidato?.clienteNombre) && (
                                                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                                    {candidato.projectName && <span style={{ fontSize: 8, color: '#6366f1', background: '#eef2ff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>📋 {candidato.projectName}</span>}
                                                    {candidato.clienteNombre && <span style={{ fontSize: 8, color: '#0e7490', background: '#cffafe', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>🏢 {candidato.clienteNombre}</span>}
                                                </div>
                                            )}
                                        </td>

                                        {/* Turno badge */}
                                        <td style={{ position: 'sticky', left: 240, background: rowBg, zIndex: 5, padding: '6px 6px', borderRight: '2px solid #e2e8f0', textAlign: 'center', minWidth: 85 }}>
                                            <button
                                                onClick={() => turno && setSelectedModal({ turno, candidato })}
                                                style={{
                                                    background: turno ? (turno.color || '#4f46e5') : '#e2e8f0',
                                                    color: turno ? 'white' : '#94a3b8',
                                                    fontSize: 8, fontWeight: 900,
                                                    padding: '3px 7px', borderRadius: 99,
                                                    maxWidth: 78, overflow: 'hidden', textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap', border: 'none',
                                                    cursor: turno ? 'pointer' : 'default',
                                                    transition: 'all 0.15s', display: 'inline-block',
                                                }}
                                                title={turno?.nombre || 'Sin turno'}
                                                className={turno ? 'hover:scale-105 hover:brightness-110 shadow-sm' : ''}
                                            >
                                                {turno?.nombre || 'SIN TURNO'}
                                            </button>
                                        </td>

                                        {/* Celdas días */}
                                        {diasInfo.map((dInfo, i) => {
                                            if (dInfo.tipo === 'reg') {
                                                return (
                                                    <CeldaDia
                                                        key={i}
                                                        reg={dInfo.reg}
                                                        turnoHorario={dInfo.horarioDia}
                                                    />
                                                );
                                            }
                                            return (
                                                <CeldaDiaSinReg
                                                    key={i}
                                                    estado={dInfo.estado}
                                                    turnoHorario={dInfo.horarioDia}
                                                />
                                            );
                                        })}

                                        {/* ── Columnas resumen horas ── */}
                                        {(() => {
                                            // Totales en minutos
                                            let totalTurnoMin = 0;     // horas que el turno exige en el mes
                                            let totalTrabajadoMin = 0; // horas realmente marcadas
                                            let totalExtraMin = 0;     // horas extra (positivas) sumadas
                                            let totalNoTrabajadoMin = 0; // déficit (negativas) sumadas
                                            let totalLibresMin = 0;      // horas de permiso/libre

                                            diasInfo.forEach((dInfo, i) => {
                                                const day = i + 1;
                                                const date = new Date(year, month, day);
                                                const diaNombre = MAPA_DIAS[date.getDay()];
                                                const esLaboral = turno ? (turno.diasSemana || []).map(normStr).includes(normStr(diaNombre)) : false;
                                                const esFe = isFeriado(year, month, day);

                                                const estadoReal = dInfo.reg?.estado || dInfo.estado;
                                                const esAusenciaJustificada = estadoReal === 'Libre' || estadoReal === 'Permiso';
                                                
                                                const estadosIgnorados = ['NC', 'Finiquitado', 'Licencia Médica', 'Vacaciones', 'Suspendido'];
                                                const isIgnorado = estadosIgnorados.includes(estadoReal);

                                                let expectedMin = 0;
                                                // Horas exigidas por turno ese día
                                                if (esLaboral && !esFe && turno && !isIgnorado) {
                                                    const h = getHorarioDia(turno, diaNombre);
                                                    if (h?.horaEntrada && h?.horaSalida) {
                                                        const reqMin = Math.max(0, minutesDiff(h.horaEntrada, h.horaSalida) - (h.colacionMinutos || 0));
                                                        expectedMin = reqMin;
                                                        totalTurnoMin += expectedMin;
                                                        if (esAusenciaJustificada) {
                                                            totalLibresMin += reqMin;
                                                        }
                                                    }
                                                }

                                                // Horas trabajadas reales ese día
                                                let workedMin = 0;
                                                if (dInfo.tipo === 'reg' && dInfo.reg.horaEntrada && dInfo.reg.horaSalida && estadoReal !== 'NC' && estadoReal !== 'Finiquitado') {
                                                    const entrada = toHHmm(dInfo.reg.horaEntrada);
                                                    const salida  = toHHmm(dInfo.reg.horaSalida);
                                                    if (entrada && salida) {
                                                        const h = dInfo.horarioDia;
                                                        const col = h?.colacionMinutos ?? 0;
                                                        workedMin = Math.max(0, minutesDiff(entrada, salida) - col);
                                                        totalTrabajadoMin += workedMin;
                                                    }
                                                }

                                                // Calcular diferencias por día
                                                // Si el día ya pasó o es hoy, y era laboral, calculamos si hay extra o falta
                                                if (esLaboral && !esFe && expectedMin > 0 && date <= today) {
                                                    if (workedMin > expectedMin) {
                                                        totalExtraMin += (workedMin - expectedMin);
                                                    } else if (workedMin < expectedMin && estadoReal !== 'Licencia Médica' && estadoReal !== 'Vacaciones' && !esAusenciaJustificada) {
                                                        totalNoTrabajadoMin += (expectedMin - workedMin);
                                                    }
                                                } else if (!esLaboral || esFe || esAusenciaJustificada) {
                                                    // Si trabajó en día libre, feriado o permiso, todo es extra
                                                    if (workedMin > 0) {
                                                        totalExtraMin += workedMin;
                                                    }
                                                }
                                            });

                                            const thStyle = (bg, color) => ({
                                                position: 'sticky', zIndex: 5, background: bg,
                                                borderLeft: '1px solid #e2e8f0',
                                                padding: '4px 6px', textAlign: 'center', minWidth: 72,
                                                verticalAlign: 'middle',
                                            });

                                            return (
                                                <>
                                                    {/* Total Hrs Turno */}
                                                    <td style={{ ...thStyle('#f1f5f9'), right: 720, borderLeft: '2px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', display: 'block' }}>
                                                            {fmtHrs(totalTurnoMin)}
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#94a3b8', display: 'block', marginTop: 1 }}>turno</span>
                                                    </td>
                                                    {/* Hrs Trabajadas */}
                                                    <td style={{ ...thStyle('#f0fdf4'), right: 648 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', display: 'block' }}>
                                                            {fmtHrs(totalTrabajadoMin)}
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#86efac', display: 'block', marginTop: 1 }}>trabajadas</span>
                                                    </td>
                                                    {/* Hrs No Trabajadas */}
                                                    <td style={{ ...thStyle('#fff7f7'), right: 576 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: totalNoTrabajadoMin > 0 ? '#b91c1c' : '#94a3b8', display: 'block' }}>
                                                            {fmtHrs(totalNoTrabajadoMin)}
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#fca5a5', display: 'block', marginTop: 1 }}>no trabajadas</span>
                                                    </td>
                                                    {/* Hrs Libres */}
                                                    <td style={{ ...thStyle('#eff6ff'), right: 504 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: totalLibresMin > 0 ? '#1d4ed8' : '#94a3b8', display: 'block' }}>
                                                            {fmtHrs(totalLibresMin)}
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#93c5fd', display: 'block', marginTop: 1 }}>libres</span>
                                                    </td>
                                                    {/* Horas Extras */}
                                                    <td style={{ ...thStyle('#fffbeb'), right: 432 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: totalExtraMin > 0 ? '#b45309' : '#94a3b8', display: 'block' }}>
                                                            {fmtHrs(totalExtraMin)}
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#fcd34d', display: 'block', marginTop: 1 }}>extras</span>
                                                    </td>
                                                    {/* Balance */}
                                                    {(() => {
                                                        const netBal = totalExtraMin - totalNoTrabajadoMin - totalLibresMin;
                                                        return (
                                                            <td style={{ ...thStyle('#faf5ff'), right: 360 }}>
                                                                <span style={{ fontSize: 10, fontWeight: 800, color: netBal >= 0 ? '#7e22ce' : '#be185d', display: 'block' }}>
                                                                    {netBal < 0 ? '-' : ''}{fmtHrs(Math.abs(netBal))}
                                                                </span>
                                                                <span style={{ fontSize: 7, color: '#d8b4fe', display: 'block', marginTop: 1 }}>balance</span>
                                                            </td>
                                                        );
                                                    })()}
                                                    {/* Asistencia */}
                                                    <td style={{ ...thStyle('#f1f5f9'), right: 288, borderLeft: '1px solid #e2e8f0' }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', display: 'block' }}>
                                                            {presentes}d
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#86efac', display: 'block', marginTop: 1 }}>asistencia</span>
                                                    </td>
                                                    {/* Inasistencia */}
                                                    <td style={{ ...thStyle('#fef2f2'), right: 216 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: ausentes > 0 ? '#dc2626' : '#94a3b8', display: 'block' }}>
                                                            {ausentes}d
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#fca5a5', display: 'block', marginTop: 1 }}>inasistencia</span>
                                                    </td>
                                                    {/* Permisos */}
                                                    <td style={{ ...thStyle('#eff6ff'), right: 144 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: (licencias + permisos + vacaciones) > 0 ? '#2563eb' : '#94a3b8', display: 'block' }}>
                                                            {licencias + permisos + vacaciones}d
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#93c5fd', display: 'block', marginTop: 1 }}>permisos</span>
                                                    </td>
                                                    {/* Licencia Médica */}
                                                    <td style={{ ...thStyle('#fff7ed'), right: 72 }}>
                                                        <span style={{ fontSize: 10, fontWeight: 800, color: licencias > 0 ? '#ea580c' : '#94a3b8', display: 'block' }}>
                                                            {licencias}d
                                                        </span>
                                                        <span style={{ fontSize: 7, color: '#fdba74', display: 'block', marginTop: 1 }}>lic. méd.</span>
                                                    </td>
                                                    {/* Días a Pago (Art. 44 Código del Trabajo) */}
                                                    {(() => {
                                                        const ingresoDate = candidato?.contractStartDate ? new Date(candidato.contractStartDate) : null;
                                                        const finiquitoDate = candidato?.fechaFiniquito ? new Date(candidato.fechaFiniquito) : null;
                                                        const startOfMonth = new Date(year, month, 1);
                                                        const endOfMonth = new Date(year, month + 1, 0);

                                                        let baseDiasMes = 30;
                                                        if (ingresoDate && !isNaN(ingresoDate.getTime())) {
                                                            if (ingresoDate > endOfMonth) {
                                                                baseDiasMes = 0;
                                                            } else if (ingresoDate > startOfMonth) {
                                                                const startDay = ingresoDate.getDate();
                                                                let endDay = days;
                                                                if (finiquitoDate && !isNaN(finiquitoDate.getTime()) && finiquitoDate <= endOfMonth) {
                                                                    endDay = finiquitoDate.getDate();
                                                                }
                                                                baseDiasMes = Math.min(30, Math.max(0, endDay - startDay + 1));
                                                            }
                                                        }
                                                        if (finiquitoDate && !isNaN(finiquitoDate.getTime()) && finiquitoDate <= endOfMonth && (!ingresoDate || ingresoDate <= startOfMonth)) {
                                                            baseDiasMes = Math.min(30, Math.max(0, finiquitoDate.getDate()));
                                                        }

                                                        const diasAPago = Math.max(0, baseDiasMes - ausentes);
                                                        return (
                                                            <td style={{ ...thStyle('#ecfdf5'), right: 0, borderLeft: '1px solid #a7f3d0' }}>
                                                                <span style={{ fontSize: 11, fontWeight: 900, color: '#059669', display: 'block' }}>
                                                                    {diasAPago}d
                                                                </span>
                                                                <span style={{ fontSize: 7, color: '#6ee7b7', display: 'block', marginTop: 1 }}>a pago</span>
                                                            </td>
                                                        );
                                                    })()}
                                                </>
                                            );
                                        })()}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── Footer ── */}
            <div style={{ background: '#1e293b', padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <Shield size={11} style={{ color: '#4ade80' }} />
                <span style={{ fontSize: 9, color: '#475569' }}>
                    Calendario de Asistencia · {filtered.length} trabajadores · {registros.length} registros · Horarios por día según turno configurado
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#4ade80', fontWeight: 700, textTransform: 'capitalize' }}>
                    {monthName(mes)}
                </span>
            </div>
        </div>
    );
};

export default CalendarioAsistencia;
