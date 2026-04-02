import React, { useState, useEffect, useMemo } from 'react'; // Verified build v1.2.0
import {
    Calendar, Plus, Clock, Users, Edit3, Trash2, X, Loader2,
    Shield, Zap, Moon, AlertTriangle, Coffee, CheckCircle2, Info,
    BarChart2, ChevronDown, ChevronUp, TrendingUp
} from 'lucide-react';
import { turnosApi } from '../rrhhApi';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#64748B'];
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Ley chilena: transición 45h → 40h (Ley 21.561 "40 Horas")
const LIMITE_LEGAL = { max: 45, objetivo: 40 };

const DEFAULT_FORM = {
    nombre: '',
    descripcion: '',
    tipo: 'Full Day',
    horaEntrada: '08:00',
    horaSalida: '18:00',
    horasTrabajo: 9,
    colacionMinutos: 60,
    diasSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    horariosPorDia: [],          // configuración específica por día
    toleranciaTardanza: 5,
    esNocturno: false,
    horasExtraPolicy: {
        habilitado: false,
        maxDiarias: 2,
        maxSemanales: 10,
        recargo: 1.5,
    },
    recargos: {
        nocturno: 35,
        festivo: 50,
        sabado: 0,
    },
    color: '#6366F1',
    activo: true,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const timeToMinutes = (hhmm) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const minutesToHHMM = (mins) => {
    const h = Math.floor(Math.abs(mins) / 60);
    const m = Math.abs(mins) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const calcDayMinutes = (entrada, salida, colacion = 0) => {
    const raw = timeToMinutes(salida) - timeToMinutes(entrada) - (colacion || 0);
    return Math.max(0, raw);
};

/** Devuelve el horario de un día dado, con fallback al horario global */
const getHorarioDia = (form, dia) => {
    const override = (form.horariosPorDia || []).find(h => h.dia === dia);
    return {
        horaEntrada:     override?.horaEntrada     ?? form.horaEntrada,
        horaSalida:      override?.horaSalida      ?? form.horaSalida,
        colacionMinutos: override?.colacionMinutos  ?? form.colacionMinutos,
    };
};

/** Horas trabajadas por día (en decimal) */
const calcDayHours = (form, dia) => {
    const h = getHorarioDia(form, dia);
    return calcDayMinutes(h.horaEntrada, h.horaSalida, h.colacionMinutos) / 60;
};

/** Total horas semanales configuradas */
const calcWeeklyHours = (form) =>
    (form.diasSemana || []).reduce((acc, dia) => acc + calcDayHours(form, dia), 0);

// ── Sub-componentes del formulario ───────────────────────────────────────────
const FormSection = ({ title, icon: Icon, color, children, collapsible = false, defaultOpen = true }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <button type="button"
                className={`w-full flex items-center justify-between gap-2.5 px-4 py-3 ${color} ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => collapsible && setOpen(v => !v)}
            >
                <div className="flex items-center gap-2.5">
                    <Icon size={14} className="text-white" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{title}</span>
                </div>
                {collapsible && (open ? <ChevronUp size={14} className="text-white/70" /> : <ChevronDown size={14} className="text-white/70" />)}
            </button>
            {open && <div className="p-4 space-y-3">{children}</div>}
        </div>
    );
};

const LabelInput = ({ label, children, hint }) => (
    <div>
        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
        {children}
        {hint && <p className="text-[8px] text-slate-400 mt-1 leading-tight">{hint}</p>}
    </div>
);

// ── Indicador de horas semanales ─────────────────────────────────────────────
const WeeklyHoursIndicator = ({ totalHours, diasCount }) => {
    const pct = Math.min((totalHours / LIMITE_LEGAL.max) * 100, 110);
    const obj40Pct = (LIMITE_LEGAL.objetivo / LIMITE_LEGAL.max) * 100;

    const color = totalHours > LIMITE_LEGAL.max
        ? { bar: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'Excede límite legal (45h)' }
        : totalHours > LIMITE_LEGAL.objetivo
        ? { bar: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: `Sobre objetivo 40h — Transición Ley 21.561` }
        : { bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Conforme Ley 40 Horas' };

    return (
        <div className={`p-4 rounded-2xl border ${color.bg} ${color.border}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <BarChart2 size={14} className={color.text} />
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Total Horas Semanales</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-2xl font-black tabular-nums ${color.text}`}>
                        {totalHours.toFixed(1)}
                        <span className="text-sm font-bold ml-0.5">h</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold">/ {diasCount} día{diasCount !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Barra de progreso */}
            <div className="relative h-3 bg-white rounded-full overflow-visible border border-slate-100">
                {/* Marcador objetivo 40h */}
                <div className="absolute top-0 bottom-0 w-px bg-indigo-400 z-10"
                    style={{ left: `${obj40Pct}%` }}
                    title="Objetivo 40h (Ley 21.561)">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] font-black text-indigo-500 whitespace-nowrap">40h</div>
                </div>
                {/* Barra de horas */}
                <div
                    className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                />
            </div>

            <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[8px] font-bold ${color.text}`}>{color.label}</span>
                <div className="flex items-center gap-3 text-[8px] text-slate-400 font-bold">
                    <span>Obj. 40h <span className="text-indigo-500">•</span></span>
                    <span>Máx legal 45h</span>
                </div>
            </div>

            {/* Promedio por día */}
            {diasCount > 0 && (
                <div className="mt-2 pt-2 border-t border-white/60 flex items-center gap-4 flex-wrap">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wide">Promedio/día:</span>
                    <span className={`text-[10px] font-black ${color.text}`}>{(totalHours / diasCount).toFixed(1)} hrs</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Horas/mes aprox:</span>
                    <span className="text-[10px] font-black text-slate-600">{(totalHours * 4.33).toFixed(0)} hrs</span>
                </div>
            )}
        </div>
    );
};

// ── Tabla de horario por día ──────────────────────────────────────────────────
const HorarioPorDiaTable = ({ form, setForm }) => {
    const dias = form.diasSemana || [];

    const updateDia = (dia, field, value) => {
        const current = form.horariosPorDia || [];
        const exists = current.find(h => h.dia === dia);
        let updated;
        if (exists) {
            updated = current.map(h => h.dia === dia ? { ...h, [field]: value } : h);
        } else {
            // Crear entrada para este día con los valores globales como base
            const global = {
                dia,
                horaEntrada: form.horaEntrada,
                horaSalida: form.horaSalida,
                colacionMinutos: form.colacionMinutos,
            };
            updated = [...current, { ...global, [field]: value }];
        }
        setForm(prev => ({ ...prev, horariosPorDia: updated }));
    };

    /** Aplicar horario global a todos los días */
    const applyGlobalToAll = () => {
        const updated = dias.map(dia => ({
            dia,
            horaEntrada: form.horaEntrada,
            horaSalida: form.horaSalida,
            colacionMinutos: form.colacionMinutos,
        }));
        setForm(prev => ({ ...prev, horariosPorDia: updated }));
    };

    if (dias.length === 0) return (
        <div className="text-center py-6 text-slate-300">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-[10px] font-bold uppercase">Selecciona días de trabajo primero</p>
        </div>
    );

    return (
        <div className="space-y-2">
            {/* Toolbar de la tabla */}
            <div className="flex items-center justify-between mb-1">
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    Configura el horario de cada día — modifica individualmente o usa el botón para igualar todos
                </p>
                <button type="button" onClick={applyGlobalToAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100">
                    Aplicar horario global a todos
                </button>
            </div>

            {/* Tabla días */}
            <div className="overflow-hidden rounded-2xl border border-slate-100">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="px-3 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Día</th>
                            <th className="px-3 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                            <th className="px-3 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Salida</th>
                            <th className="px-3 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Colación (min)</th>
                            <th className="px-3 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Hrs efectivas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {dias.map((dia, idx) => {
                            const h = getHorarioDia(form, dia);
                            const hasOverride = (form.horariosPorDia || []).some(x => x.dia === dia);
                            const dayHrs = calcDayHours(form, dia);
                            const esSabadoDomingo = dia === 'Sábado' || dia === 'Domingo';

                            return (
                                <tr key={dia} className={`transition-colors ${esSabadoDomingo ? 'bg-amber-50/40' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                                    {/* Día */}
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: form.color || '#6366F1' }} />
                                            <span className="text-[10px] font-black text-slate-700 uppercase">
                                                {dia.substring(0, 3)}
                                            </span>
                                            {hasOverride && (
                                                <span className="text-[7px] font-black text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded-md border border-indigo-100">
                                                    Custom
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Hora entrada */}
                                    <td className="px-3 py-2">
                                        <input type="time"
                                            value={h.horaEntrada}
                                            onChange={e => updateDia(dia, 'horaEntrada', e.target.value)}
                                            className="text-[10px] font-black text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-24 transition-all hover:border-indigo-300" />
                                    </td>

                                    {/* Hora salida */}
                                    <td className="px-3 py-2">
                                        <input type="time"
                                            value={h.horaSalida}
                                            onChange={e => updateDia(dia, 'horaSalida', e.target.value)}
                                            className="text-[10px] font-black text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 w-24 transition-all hover:border-indigo-300" />
                                    </td>

                                    {/* Colación */}
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-1.5">
                                            <Coffee size={11} className="text-amber-400 flex-shrink-0" />
                                            <input type="number" min="0" max="120"
                                                value={h.colacionMinutos}
                                                onChange={e => updateDia(dia, 'colacionMinutos', parseInt(e.target.value) || 0)}
                                                className="text-[10px] font-black text-slate-700 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-100 w-16 text-center transition-all hover:border-amber-300" />
                                        </div>
                                    </td>

                                    {/* Horas efectivas */}
                                    <td className="px-3 py-2 text-right">
                                        <span className={`text-[11px] font-black tabular-nums px-2 py-1 rounded-xl inline-block ${
                                            dayHrs === 0
                                                ? 'text-slate-300 bg-slate-50'
                                                : dayHrs < 4
                                                ? 'text-amber-600 bg-amber-50'
                                                : dayHrs > 9
                                                ? 'text-rose-500 bg-rose-50'
                                                : 'text-emerald-600 bg-emerald-50'
                                        }`}>
                                            {dayHrs.toFixed(1)}h
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {/* Fila total */}
                    <tfoot>
                        <tr className="bg-slate-800 text-white">
                            <td className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest" colSpan={4}>
                                Total Semanal
                            </td>
                            <td className="px-3 py-2.5 text-right">
                                {(() => {
                                    const total = calcWeeklyHours(form);
                                    return (
                                        <span className={`text-sm font-black tabular-nums ${
                                            total > LIMITE_LEGAL.max ? 'text-rose-400' :
                                            total > LIMITE_LEGAL.objetivo ? 'text-amber-300' :
                                            'text-emerald-400'
                                        }`}>
                                            {total.toFixed(1)}h
                                        </span>
                                    );
                                })()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const ProgramacionTurnos = () => {
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [activeCard, setActiveCard] = useState(null);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const res = await turnosApi.getAll();
            setTurnos(res.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Calcular horasTrabajo como promedio ponderado
            const totalMins = (form.diasSemana || []).reduce((acc, dia) => {
                const h = getHorarioDia(form, dia);
                return acc + calcDayMinutes(h.horaEntrada, h.horaSalida, h.colacionMinutos);
            }, 0);
            const avgHours = form.diasSemana?.length > 0
                ? Math.round((totalMins / form.diasSemana.length) / 60 * 10) / 10
                : form.horasTrabajo;

            const payload = { ...form, horasTrabajo: avgHours };

            if (editId) await turnosApi.update(editId, payload);
            else await turnosApi.create(payload);

            setShowForm(false);
            setEditId(null);
            setForm(DEFAULT_FORM);
            fetchAll();
        } catch (err) {
            alert('Error al guardar turno: ' + (err.response?.data?.message || err.message));
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar este turno? Los colaboradores asignados perderán el vínculo.')) return;
        try { await turnosApi.remove(id); fetchAll(); }
        catch (e) { alert('Error al eliminar'); }
    };

    const openEdit = (t) => {
        setForm({
            ...DEFAULT_FORM,
            ...t,
            horasExtraPolicy: { ...DEFAULT_FORM.horasExtraPolicy, ...(t.horasExtraPolicy || {}) },
            recargos: { ...DEFAULT_FORM.recargos, ...(t.recargos || {}) },
            horariosPorDia: t.horariosPorDia || [],
        });
        setEditId(t._id);
        setShowForm(true);
    };

    const toggleDia = (dia) => {
        const yaEsta = (form.diasSemana || []).includes(dia);
        let nuevosDias;
        let nuevosHorarios = form.horariosPorDia || [];

        if (yaEsta) {
            nuevosDias = (form.diasSemana || []).filter(d => d !== dia);
            // Mantener el override por si se re-selecciona después
        } else {
            nuevosDias = [...(form.diasSemana || []), dia];
            // Si no tiene override, no creamos uno (usa global como fallback)
        }
        setForm(prev => ({ ...prev, diasSemana: nuevosDias, horariosPorDia: nuevosHorarios }));
    };

    const setNested = (key, subkey, value) => setForm(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [subkey]: value },
    }));

    // Calcular totales del form
    const weeklyHours = useMemo(() => calcWeeklyHours(form), [form]);
    const diasCount = (form.diasSemana || []).length;

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-orange-500 text-white p-3 rounded-2xl shadow-lg shadow-orange-200">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800">
                            Programación de <span className="text-orange-500">Turnos</span>
                        </h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                            Jornadas con horarios por día · Conforme Ley 21.561 (40 horas)
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { setEditId(null); setForm(DEFAULT_FORM); setShowForm(true); }}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-orange-200 active:scale-95"
                >
                    <Plus size={16} /> Nuevo Turno
                </button>
            </div>

            {/* ── CARDS ── */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-orange-500" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {turnos.map(t => {
                        // Calcular horas semanales reales del turno guardado
                        const turnoWeeklyHrs = calcWeeklyHours({
                            diasSemana: t.diasSemana || [],
                            horaEntrada: t.horaEntrada,
                            horaSalida: t.horaSalida,
                            colacionMinutos: t.colacionMinutos,
                            horariosPorDia: t.horariosPorDia || [],
                        });
                        const hrsColor = turnoWeeklyHrs > LIMITE_LEGAL.max
                            ? 'text-rose-600 bg-rose-50'
                            : turnoWeeklyHrs > LIMITE_LEGAL.objetivo
                            ? 'text-amber-600 bg-amber-50'
                            : 'text-emerald-600 bg-emerald-50';

                        return (
                            <div
                                key={t._id}
                                className={`bg-white rounded-2xl border overflow-hidden transition-all group cursor-pointer ${activeCard === t._id ? 'shadow-2xl border-slate-200 scale-[1.01]' : 'border-slate-100 hover:shadow-lg'}`}
                                onClick={() => setActiveCard(activeCard === t._id ? null : t._id)}
                            >
                                <div className="h-1.5" style={{ backgroundColor: t.color || '#6366F1' }} />
                                <div className="p-6">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-slate-800 uppercase truncate">{t.nombre}</h3>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg">{t.tipo}</span>
                                                {t.esNocturno && (
                                                    <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                        <Moon size={9} /> Nocturno
                                                    </span>
                                                )}
                                                {!t.activo && <span className="text-[9px] font-black text-rose-400 bg-rose-50 px-2 py-0.5 rounded-lg">Inactivo</span>}
                                            </div>
                                            {t.descripcion && <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed">{t.descripcion}</p>}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                            <button onClick={ev => { ev.stopPropagation(); openEdit(t); }}
                                                className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl"><Edit3 size={14} /></button>
                                            <button onClick={ev => { ev.stopPropagation(); handleDelete(t._id); }}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={14} /></button>
                                        </div>
                                    </div>

                                    {/* Horario global */}
                                    <div className="flex items-center gap-3 mb-4 bg-slate-50 rounded-2xl p-3">
                                        <Clock size={14} className="text-orange-500 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <span className="font-black text-slate-700 text-sm">{t.horaEntrada} – {t.horaSalida}</span>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {t.colacionMinutos > 0 && <span className="text-[8px] text-slate-400">{t.colacionMinutos} min colación</span>}
                                                {t.toleranciaTardanza > 0 && <span className="text-[8px] text-amber-500 font-bold">{t.toleranciaTardanza} min tolerancia</span>}
                                            </div>
                                        </div>
                                        {/* Badge horas semanales */}
                                        <div className={`flex flex-col items-center px-2.5 py-1.5 rounded-xl ${hrsColor}`}>
                                            <span className="text-sm font-black tabular-nums leading-none">{turnoWeeklyHrs.toFixed(1)}</span>
                                            <span className="text-[7px] font-black uppercase leading-none mt-0.5">h/sem</span>
                                        </div>
                                    </div>

                                    {/* Días — con horas por día si hay override */}
                                    <div className="flex flex-wrap gap-1.5 mb-4">
                                        {DIAS_SEMANA.map(d => {
                                            const activo = (t.diasSemana || []).includes(d);
                                            if (!activo) return null;
                                            const hDia = getHorarioDia({
                                                horaEntrada: t.horaEntrada,
                                                horaSalida: t.horaSalida,
                                                colacionMinutos: t.colacionMinutos,
                                                horariosPorDia: t.horariosPorDia || [],
                                            }, d);
                                            const hrsDay = calcDayMinutes(hDia.horaEntrada, hDia.horaSalida, hDia.colacionMinutos) / 60;
                                            const hasOverride = (t.horariosPorDia || []).some(x => x.dia === d);
                                            return (
                                                <div key={d} className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[8px] font-black uppercase px-2 py-1 rounded-lg text-white"
                                                        style={{ backgroundColor: t.color || '#6366F1' }}>
                                                        {d.substring(0, 3)}
                                                    </span>
                                                    {hasOverride && (
                                                        <span className="text-[7px] font-black text-slate-500">{hrsDay.toFixed(1)}h</span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between text-[9px] text-slate-400">
                                        <div className="flex items-center gap-1.5">
                                            <Users size={12} />
                                            <span>{(t.colominoAsignados || []).length} colaboradores</span>
                                        </div>
                                        {t.horasExtraPolicy?.habilitado && (
                                            <div className="flex items-center gap-1 text-indigo-500 font-bold">
                                                <Zap size={11} />
                                                <span>HE {t.horasExtraPolicy.maxDiarias}h/día</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Detalle expandido */}
                                    {activeCard === t._id && (t.horasExtraPolicy?.habilitado || t.recargos?.nocturno > 0) && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                            {t.horasExtraPolicy?.habilitado && (
                                                <div className="col-span-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                    <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                        <Zap size={9} /> Política Horas Extra
                                                    </p>
                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                        {[
                                                            ['Máx Diarias', `${t.horasExtraPolicy.maxDiarias}h`],
                                                            ['Máx Semanales', `${t.horasExtraPolicy.maxSemanales}h`],
                                                            ['Recargo', `${Math.round(((t.horasExtraPolicy.recargo || 1.5) - 1) * 100)}%`],
                                                        ].map(([lab, val]) => (
                                                            <div key={lab}>
                                                                <p className="text-[7px] text-indigo-400 font-bold uppercase">{lab}</p>
                                                                <p className="text-[11px] font-black text-indigo-700">{val}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {turnos.length === 0 && (
                        <div className="col-span-3 py-20 text-center text-slate-400">
                            <Calendar size={48} className="mx-auto opacity-20 mb-4" />
                            <p className="font-bold">No hay turnos definidos</p>
                            <p className="text-xs mt-1">Crea el primer turno para organizar los horarios</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL FORMULARIO ── */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8">
                        {/* Header modal */}
                        <div className="p-8 bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-between rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase">{editId ? 'Editar Turno' : 'Nuevo Turno'}</h2>
                                <p className="text-orange-100 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                                    Configuración de jornada laboral · Ley 21.561 Chile
                                </p>
                            </div>
                            <button onClick={() => setShowForm(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-5">

                            {/* ── 1. Identificación ── */}
                            <FormSection title="Identificación" icon={Calendar} color="bg-orange-500">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <LabelInput label="Nombre del Turno *">
                                            <input required className="input-rrhh"
                                                placeholder="Ej: Jornada Completa L-V"
                                                value={form.nombre}
                                                onChange={e => setForm({ ...form, nombre: e.target.value })} />
                                        </LabelInput>
                                    </div>
                                    <div className="col-span-2">
                                        <LabelInput label="Descripción (opcional)">
                                            <input className="input-rrhh"
                                                placeholder="Ej: Turno estándar administración"
                                                value={form.descripcion || ''}
                                                onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                                        </LabelInput>
                                    </div>
                                    <LabelInput label="Tipo">
                                        <select className="input-rrhh" value={form.tipo}
                                            onChange={e => setForm({ ...form, tipo: e.target.value })}>
                                            {['Mañana', 'Tarde', 'Noche', 'Full Day', 'Personalizado'].map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </LabelInput>
                                    <LabelInput label="Estado">
                                        <select className="input-rrhh" value={form.activo ? 'true' : 'false'}
                                            onChange={e => setForm({ ...form, activo: e.target.value === 'true' })}>
                                            <option value="true">Activo</option>
                                            <option value="false">Inactivo</option>
                                        </select>
                                    </LabelInput>
                                </div>
                            </FormSection>

                            {/* ── 2. Días de la semana ── */}
                            <FormSection title="Días de Trabajo" icon={Calendar} color="bg-slate-700">
                                <div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">Selecciona los días — luego configura el horario de cada uno</p>
                                    <div className="flex flex-wrap gap-2">
                                        {DIAS_SEMANA.map(d => (
                                            <button key={d} type="button" onClick={() => toggleDia(d)}
                                                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${(form.diasSemana || []).includes(d) ? 'text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                                style={(form.diasSemana || []).includes(d) ? { backgroundColor: form.color } : {}}>
                                                {d.substring(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </FormSection>

                            {/* ── 3. Horario global (defaults) ── */}
                            <FormSection title="Horario Base (Predeterminado)" icon={Clock} color="bg-indigo-600" collapsible defaultOpen>
                                <p className="text-[8px] font-bold text-slate-400 mb-2 leading-relaxed">
                                    Este horario se aplica a todos los días como predeterminado. Puedes sobrescribir día a día en la tabla inferior.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <LabelInput label="Hora Entrada">
                                        <input type="time" className="input-rrhh"
                                            value={form.horaEntrada}
                                            onChange={e => setForm({ ...form, horaEntrada: e.target.value })} />
                                    </LabelInput>
                                    <LabelInput label="Hora Salida">
                                        <input type="time" className="input-rrhh"
                                            value={form.horaSalida}
                                            onChange={e => setForm({ ...form, horaSalida: e.target.value })} />
                                    </LabelInput>
                                    <LabelInput label="Colación predeterminada (min)"
                                        hint="Minutos de colación descontados del tiempo efectivo de trabajo">
                                        <input type="number" className="input-rrhh" min="0" max="120"
                                            value={form.colacionMinutos || 0}
                                            onChange={e => setForm({ ...form, colacionMinutos: parseInt(e.target.value) || 0 })} />
                                    </LabelInput>
                                    <LabelInput label="Tolerancia tardanza (min)"
                                        hint="Minutos de gracia antes de marcar tardanza en asistencia">
                                        <input type="number" className="input-rrhh" min="0" max="60"
                                            value={form.toleranciaTardanza ?? 5}
                                            onChange={e => setForm({ ...form, toleranciaTardanza: parseInt(e.target.value) || 0 })} />
                                    </LabelInput>
                                </div>
                                <div className="flex items-center gap-3 pt-1">
                                    <button type="button"
                                        onClick={() => setForm({ ...form, esNocturno: !form.esNocturno })}
                                        className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${form.esNocturno ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.esNocturno ? 'left-7' : 'left-1'}`} />
                                    </button>
                                    <span className={`text-[10px] font-black uppercase ${form.esNocturno ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {form.esNocturno ? 'Turno Nocturno (aplica recargo nocturno)' : 'Turno Diurno'}
                                    </span>
                                </div>
                            </FormSection>

                            {/* ── 4. Horario por día + Calculador semanal ── */}
                            <FormSection title="Horario por Día + Calculador Semanal" icon={BarChart2} color="bg-teal-600">
                                <HorarioPorDiaTable form={form} setForm={setForm} />

                                {/* Indicador de horas semanales */}
                                {diasCount > 0 && (
                                    <div className="mt-3">
                                        <WeeklyHoursIndicator totalHours={weeklyHours} diasCount={diasCount} />
                                    </div>
                                )}

                                {/* Avisos legales */}
                                <div className="flex items-start gap-1.5 p-3 bg-blue-50 rounded-xl border border-blue-100 mt-1">
                                    <Info size={11} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-[8px] text-blue-600 font-bold leading-relaxed space-y-0.5">
                                        <p>📌 <strong>Ley 21.561 "40 Horas":</strong> La semana laboral máxima se reduce gradualmente a 40h (en vigor desde 2024). Actualmente el tope legal es 45h/semana.</p>
                                        <p>📌 En Chile es común el esquema L-V 9h + Sáb 5h = 50h/sem — <strong>verifica que cumpla el máximo legal.</strong></p>
                                        <p>📌 Los Sábados pueden tener horario reducido. Configúralo directamente en la tabla por día.</p>
                                    </div>
                                </div>
                            </FormSection>

                            {/* ── 5. Política Horas Extra ── */}
                            <FormSection title="Política de Horas Extra" icon={Zap} color="bg-violet-600" collapsible defaultOpen>
                                <div className="flex items-center gap-3 mb-3">
                                    <button type="button"
                                        onClick={() => setNested('horasExtraPolicy', 'habilitado', !form.horasExtraPolicy?.habilitado)}
                                        className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ${form.horasExtraPolicy?.habilitado ? 'bg-violet-600' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.horasExtraPolicy?.habilitado ? 'left-7' : 'left-1'}`} />
                                    </button>
                                    <span className={`text-[10px] font-black uppercase ${form.horasExtraPolicy?.habilitado ? 'text-violet-700' : 'text-slate-400'}`}>
                                        {form.horasExtraPolicy?.habilitado ? 'Habilitadas — Art. 32 C.T.' : 'Sin Horas Extra'}
                                    </span>
                                </div>
                                {form.horasExtraPolicy?.habilitado && (
                                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                                        <LabelInput label="Máx Horas/Día">
                                            <input type="number" className="input-rrhh" min="1" max="8"
                                                value={form.horasExtraPolicy?.maxDiarias ?? 2}
                                                onChange={e => setNested('horasExtraPolicy', 'maxDiarias', parseInt(e.target.value))} />
                                        </LabelInput>
                                        <LabelInput label="Máx Horas/Semana">
                                            <input type="number" className="input-rrhh" min="1" max="40"
                                                value={form.horasExtraPolicy?.maxSemanales ?? 10}
                                                onChange={e => setNested('horasExtraPolicy', 'maxSemanales', parseInt(e.target.value))} />
                                        </LabelInput>
                                        <LabelInput label="Factor Recargo">
                                            <select className="input-rrhh"
                                                value={form.horasExtraPolicy?.recargo ?? 1.5}
                                                onChange={e => setNested('horasExtraPolicy', 'recargo', parseFloat(e.target.value))}>
                                                <option value={1.5}>1.5× — 50% (mín. legal)</option>
                                                <option value={2.0}>2.0× — 100%</option>
                                                <option value={2.5}>2.5× — 150%</option>
                                            </select>
                                        </LabelInput>
                                    </div>
                                )}
                            </FormSection>

                            {/* ── 6. Recargos ── */}
                            <FormSection title="Recargos Legales" icon={Shield} color="bg-amber-500" collapsible defaultOpen>
                                <div className="grid grid-cols-3 gap-3">
                                    <LabelInput label="Nocturno (%)" hint="Entre 21:00 y 07:00 — Ref. 35%">
                                        <input type="number" className="input-rrhh" min="0" max="100"
                                            value={form.recargos?.nocturno ?? 35}
                                            onChange={e => setNested('recargos', 'nocturno', parseInt(e.target.value) || 0)} />
                                    </LabelInput>
                                    <LabelInput label="Festivo (%)" hint="Domingos y festivos — Ref. 50%">
                                        <input type="number" className="input-rrhh" min="0" max="200"
                                            value={form.recargos?.festivo ?? 50}
                                            onChange={e => setNested('recargos', 'festivo', parseInt(e.target.value) || 0)} />
                                    </LabelInput>
                                    <LabelInput label="Sábado (%)" hint="Sábados según contrato">
                                        <input type="number" className="input-rrhh" min="0" max="100"
                                            value={form.recargos?.sabado ?? 0}
                                            onChange={e => setNested('recargos', 'sabado', parseInt(e.target.value) || 0)} />
                                    </LabelInput>
                                </div>
                            </FormSection>

                            {/* ── 7. Color ── */}
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Color del Turno</label>
                                <div className="flex gap-3 flex-wrap">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                                            className={`w-9 h-9 rounded-2xl transition-all ${form.color === c ? 'ring-4 ring-offset-2 ring-slate-700 scale-125' : 'hover:scale-110'}`}
                                            style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>

                            {/* ── Summary bar ── */}
                            {diasCount > 0 && (
                                <div className="p-4 bg-slate-800 rounded-2xl text-white flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <TrendingUp size={18} className="text-indigo-400" />
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Resumen del Turno</p>
                                            <p className="text-sm font-black">{form.nombre || 'Sin nombre'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {[
                                            ['Días/sem', diasCount],
                                            ['Hrs/sem', weeklyHours.toFixed(1) + 'h'],
                                            ['Hrs/mes', (weeklyHours * 4.33).toFixed(0) + 'h'],
                                            ['Prom/día', diasCount > 0 ? (weeklyHours / diasCount).toFixed(1) + 'h' : '—'],
                                        ].map(([lab, val]) => (
                                            <div key={lab} className="text-center">
                                                <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">{lab}</p>
                                                <p className={`text-sm font-black ${weeklyHours > LIMITE_LEGAL.max && lab === 'Hrs/sem' ? 'text-rose-400' : weeklyHours > LIMITE_LEGAL.objetivo && lab === 'Hrs/sem' ? 'text-amber-300' : 'text-white'}`}>{val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Actions ── */}
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="flex-1 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-100 disabled:opacity-50 hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                                    {saving
                                        ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                                        : <><CheckCircle2 size={16} /> {editId ? 'Actualizar Turno' : 'Crear Turno'}</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramacionTurnos;
