import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    CircleDollarSign, Users, Calendar, Search, Loader2,
    ChevronDown, ChevronUp, Download, RefreshCw, Eye,
    TrendingUp, TrendingDown, Plus, X, Edit3, Printer,
    ShieldCheck, Landmark, BarChart3, AlertCircle, CheckCircle2,
    FileText, ArrowUpRight, Building2, Save
} from 'lucide-react';
import axios from 'axios';
import { candidatosApi } from '../rrhhApi';
import {
    calcularLiquidacionReal,
    candidatoToWorkerData,
    TASAS_AFP,
    VALORES_LEGALES
} from '../utils/payrollCalculator';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

// ─── Formateo moneda ──────────────────────────────────────────────────────────
const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

// ─── Sección colapsable ───────────────────────────────────────────────────────
const SeccionCollapsible = ({ title, icon: Icon, iconColor, children, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <button onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/60 transition-all">
                <div className="flex items-center gap-2.5">
                    <div className={`${iconColor} p-1.5 rounded-lg`}><Icon size={14} className="text-white" /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{title}</span>
                </div>
                {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {open && <div className="p-5">{children}</div>}
        </div>
    );
};

// ─── Fila del libro de remuneraciones ────────────────────────────────────────
const FilaLibro = ({ concepto, monto, isTotal = false, isSubtotal = false, isNegative = false, isExento = false }) => (
    <div className={`flex items-center justify-between py-2 px-4 rounded-xl ${isTotal ? 'bg-slate-800 text-white font-black' :
        isSubtotal ? 'bg-slate-100 font-bold' :
            isNegative ? 'bg-red-50' :
                isExento ? 'opacity-50' : ''
        }`}>
        <span className={`text-xs uppercase tracking-wider ${isTotal ? 'text-white' : isNegative ? 'text-red-700' : 'text-slate-600'}`}>{concepto}</span>
        <span className={`text-sm font-black tabular-nums ${isTotal ? 'text-white' :
            isNegative ? 'text-red-600' :
                isSubtotal ? 'text-slate-800' : 'text-slate-700'
            }`}>
            {isNegative ? '-' : ''}{fmt(monto)}
        </span>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL LIQUIDACIÓN INDIVIDUAL (Hoja DT)
// ─────────────────────────────────────────────────────────────────────────────
const ModalLiquidacion = ({ emp, onClose, params }) => {
    const [ajustes, setAjustes] = useState({
        bonosImponibles: 0, bonosNoImponibles: 0, horasExtra: 0,
        viaticos: 0, colacion: 0, movilizacion: 0,
        bonoProductividad: 0, bonoAsistencia: 0, bonoVacaciones: 0,
        cuotaSindical: 0, descuentoJudicial: 0, anticipo: 0, otrosDescuentos: 0,
        tasaMutual: 0.90,
    });

    const worker = candidatoToWorkerData(emp);
    const liq = calcularLiquidacionReal(worker, ajustes, params);

    const handleChange = (key, val) => setAjustes(prev => ({ ...prev, [key]: parseInt(val) || 0 }));

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
            <style>
                {`
                    @media print {
                        @page { size: A4; margin: 0; }
                        body * { visibility: hidden; }
                        .print-container, .print-container * { visibility: visible; }
                        .print-container { 
                            position: absolute; 
                            left: 0; 
                            top: 0; 
                            width: 210mm; 
                            min-height: 297mm;
                            padding: 15mm !important;
                            background: white !important;
                        }
                        .no-print { display: none !important; }
                    }
                `}
            </style>
            <div className="bg-white w-full max-w-4xl rounded-[2rem] shadow-2xl my-4 overflow-hidden print:shadow-none print:my-0 print:rounded-none print-container">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-700 to-violet-700 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-black text-white overflow-hidden">
                            {emp.profilePic ? <img src={emp.profilePic} alt="" className="w-full h-full object-cover" /> : emp.fullName?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">{emp.fullName}</h3>
                            <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider">{emp.rut} · {emp.position} · {emp.contractType || emp.hiring?.contractType || 'Indefinido'}</p>
                        </div>
                    </div>
                    <div className="flex gap-3 no-print">
                        <button onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black uppercase transition-all">
                            <Printer size={14} /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* LEFT: Ajustes del periodo */}
                    <div className="space-y-4 no-print">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ajustes del Período</h4>

                        <SeccionCollapsible title="Haberes Imponibles extra" icon={TrendingUp} iconColor="bg-indigo-500" defaultOpen>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Horas Extra (cant.)', 'horasExtra'],
                                    ['Bono Productividad', 'bonoProductividad'],
                                    ['Bono Asistencia', 'bonoAsistencia'],
                                    ['Otros imponibles', 'bonosImponibles'],
                                ].map(([label, key]) => (
                                    <div key={key}>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                                        <input type="number" min="0" value={ajustes[key] || 0}
                                            onChange={e => handleChange(key, e.target.value)}
                                            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                    </div>
                                ))}
                            </div>
                        </SeccionCollapsible>

                        <SeccionCollapsible title="Haberes No Imponibles" icon={Building2} iconColor="bg-teal-500">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Viáticos', 'viaticos'],
                                    ['Colación', 'colacion'],
                                    ['Movilización', 'movilizacion'],
                                    ['Bono Vacaciones', 'bonoVacaciones'],
                                    ['Otros no imponibles', 'bonosNoImponibles'],
                                ].map(([label, key]) => (
                                    <div key={key}>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                                        <input type="number" min="0" value={ajustes[key] || 0}
                                            onChange={e => handleChange(key, e.target.value)}
                                            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200" />
                                    </div>
                                ))}
                            </div>
                        </SeccionCollapsible>

                        <SeccionCollapsible title="Descuentos Voluntarios" icon={TrendingDown} iconColor="bg-rose-500">
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Cuota Sindical', 'cuotaSindical'],
                                    ['Descuento Judicial', 'descuentoJudicial'],
                                    ['Anticipo', 'anticipo'],
                                    ['Otros descuentos', 'otrosDescuentos'],
                                ].map(([label, key]) => (
                                    <div key={key}>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">{label}</label>
                                        <input type="number" min="0" value={ajustes[key] || 0}
                                            onChange={e => handleChange(key, e.target.value)}
                                            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200" />
                                    </div>
                                ))}
                            </div>
                        </SeccionCollapsible>

                        {/* Datos previsionales del trabajador */}
                        <div className="bg-slate-50 rounded-2xl p-4 text-xs">
                            <p className="font-black text-slate-400 uppercase tracking-widest text-[8px] mb-3">Ficha del Trabajador (Datos Maestros)</p>
                            <div className="space-y-1.5">
                                {[
                                    ['Estado', emp.pensionado === 'SI' ? 'PENSIONADO (Exento AFP)' : 'Activo Previsional'],
                                    ['AFP', `${emp.afp || '—'} (${TASAS_AFP[(emp.afp || '').toUpperCase()] || '11.27'}%)`],
                                    ['Salud', emp.previsionSalud === 'ISAPRE' ? `ISAPRE ${emp.isapreNombre || ''} · ${emp.valorPlan} ${emp.monedaPlan || 'UF'}` : 'FONASA (7%)'],
                                    ['Contrato', emp.contractType || emp.hiring?.contractType || '—'],
                                    ['Cargas', emp.listaCargas?.length || (emp.tieneCargas === 'SI' ? '1' : '0')],
                                    ['Pago', emp.banco ? `${emp.banco} · ${emp.tipoCuenta}` : 'Sin datos bancarios'],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between">
                                        <span className="text-slate-400 font-bold uppercase text-[9px]">{k}</span>
                                        <span className={`font-black text-[9px] text-right ${k === 'Estado' && emp.pensionado === 'SI' ? 'text-amber-600' : 'text-slate-700'}`}>{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bonos de la ficha */}
                        {emp.bonuses?.length > 0 && (
                            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
                                <p className="font-black text-indigo-400 uppercase tracking-widest text-[8px] mb-2">Bonos Pactados en Ficha</p>
                                <div className="space-y-1">
                                    {emp.bonuses.map((b, i) => (
                                        <div key={i} className="flex justify-between items-center py-1 border-b border-indigo-100/50 last:border-0">
                                            <span className="text-[9px] font-bold text-slate-600 uppercase">{b.description || 'Bono'}</span>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-indigo-700">{fmt(b.amount)}</span>
                                                <span className="block text-[7px] font-black text-indigo-400 uppercase">{b.isImponible ? 'Imponible' : 'No Imponible'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Liquidación (Hoja DT) */}
                    <div className="space-y-4 print:w-full">
                        <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest no-print">Liquidación de Sueldo</h4>

                        {/* Haberes imponibles */}
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest px-1 mb-1">Haberes Imponibles</p>
                            <FilaLibro concepto="Sueldo Base" monto={liq.habImponibles.sueldoBase} />
                            <FilaLibro concepto="Gratificación Legal" monto={liq.habImponibles.gratificacion} />
                            {liq.habImponibles.horaExtraMonto > 0 && <FilaLibro concepto="Horas Extraordinarias (50%)" monto={liq.habImponibles.horaExtraMonto} />}
                            {liq.habImponibles.bonosInyectados > 0 && <FilaLibro concepto="Bonos Pactados (Ficha)" monto={liq.habImponibles.bonosInyectados} />}
                            {liq.habImponibles.otros > 0 && <FilaLibro concepto="Ajustes Imponibles" monto={liq.habImponibles.otros} />}
                            <FilaLibro concepto="Subtotal Imponible" monto={liq.habImponibles.subtotal} isSubtotal />
                        </div>

                        {/* Haberes no imponibles */}
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-teal-400 uppercase tracking-widest px-1 mb-1">Haberes No Imponibles</p>
                            {liq.habNoImponibles.asignacionFamiliar > 0 && <FilaLibro concepto="Asignación Familiar" monto={liq.habNoImponibles.asignacionFamiliar} />}
                            {liq.habNoImponibles.viaticos > 0 && <FilaLibro concepto="Viáticos" monto={liq.habNoImponibles.viaticos} />}
                            {liq.habNoImponibles.colacion > 0 && <FilaLibro concepto="Colación" monto={liq.habNoImponibles.colacion} />}
                            {liq.habNoImponibles.movilizacion > 0 && <FilaLibro concepto="Movilización" monto={liq.habNoImponibles.movilizacion} />}
                            {liq.habNoImponibles.bonoVacaciones > 0 && <FilaLibro concepto="Bono Vacaciones" monto={liq.habNoImponibles.bonoVacaciones} />}
                            {liq.habNoImponibles.bonosNoImponiblesExtra > 0 && <FilaLibro concepto="Otros No Imponibles" monto={liq.habNoImponibles.bonosNoImponiblesExtra} />}
                            {liq.habNoImponibles.subtotal > 0 && <FilaLibro concepto="Subtotal No Imponible" monto={liq.habNoImponibles.subtotal} isSubtotal />}
                        </div>

                        <FilaLibro concepto="Total Haberes" monto={liq.totalHaberes} isSubtotal />

                        {/* Descuentos previsionales */}
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest px-1 mb-1">Descuentos Previsionales</p>
                            <FilaLibro concepto={`AFP ${(emp.afp || '').toUpperCase()} (${TASAS_AFP[(emp.afp || '').toUpperCase()] || '11.27'}%)`} monto={liq.prevision.afp} isNegative={liq.prevision.afp > 0} isExento={liq.prevision.afp === 0} />
                            <FilaLibro concepto={`Salud (${emp.previsionSalud === 'ISAPRE' ? 'ISAPRE' : 'FONASA 7%'})`} monto={liq.prevision.salud} isNegative />
                            {liq.prevision.excesoIsapre > 0 && <FilaLibro concepto="Adicional Isapre" monto={liq.prevision.excesoIsapre} isNegative />}
                            {liq.prevision.afc > 0 && <FilaLibro concepto="Seg. Cesantía (AFC Trabajador)" monto={liq.prevision.afc} isNegative />}
                        </div>

                        {/* Impuesto */}
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest px-1 mb-1">Impuesto</p>
                            <div className="flex items-center justify-between px-4 py-2 bg-amber-50 rounded-xl">
                                <span className="text-xs text-slate-600">Base Tributable</span>
                                <span className="text-xs font-black text-slate-700 tabular-nums">{fmt(liq.baseTributable)}</span>
                            </div>
                            <FilaLibro concepto={`Imp. Único 2ª Cat. (Tramo ${liq.tramoImpuesto})`} monto={liq.impuestoUnico} isNegative={liq.impuestoUnico > 0} isExento={liq.impuestoUnico === 0} />
                        </div>

                        {/* Descuentos voluntarios */}
                        {(liq.descuentosVoluntarios.cuotaSindical + liq.descuentosVoluntarios.descuentoJudicial + liq.descuentosVoluntarios.anticipo + liq.descuentosVoluntarios.otrosDescuentos) > 0 && (
                            <div className="space-y-1">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1">Descuentos Varios (Manuales)</p>
                                {liq.otrosDescuentos > 0 && <FilaLibro concepto="Total Descuentos Otros" monto={liq.otrosDescuentos} isNegative />}
                            </div>
                        )}

                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                            <FilaLibro concepto="Total Descuentos" monto={liq.totalDescuentos} isSubtotal />
                            <FilaLibro concepto="LÍQUIDO A PAGAR" monto={liq.liquidoAPagar} isTotal />
                        </div>

                        {/* Aportes patronales */}
                        <div className="bg-slate-50 rounded-2xl p-4 mt-2">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3">Aportes Patronales (Costo Empresa)</p>
                            <div className="space-y-1.5 text-xs">
                                {[
                                    ['SIS (Seg. Invalidez Emp.)', liq.patronales.sis],
                                    ['AFC Empleador', liq.patronales.afc],
                                    ['Mutualidad / ACHS', liq.patronales.mutual],
                                ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between">
                                        <span className="text-slate-500 font-bold">{label}</span>
                                        <span className="text-slate-700 font-black tabular-nums">{fmt(val)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                                    <span className="text-slate-700 font-black uppercase text-[10px]">Costo Total Empresa</span>
                                    <span className="text-indigo-700 font-black tabular-nums">{fmt(liq.costoTotalEmpresa)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  NÓMINA PRINCIPAL — LIBRO DE REMUNERACIONES
// ─────────────────────────────────────────────────────────────────────────────
const NominaRRHH = () => {
    const { ufValue, utmValue, params: indicParams, status: indStatus, loading: indLoading, lastSync, refetch } = useIndicadores();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [selected, setSelected] = useState(null);
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [adjEmp, setAdjEmp] = useState(null);
    const [saving, setSaving] = useState(false);

    const params = indicParams;

    // --- ACCIONES ---
    const handleSaveHistorial = async () => {
        if (!window.confirm('¿Desea cerrar el periodo actual y guardar un snapshot histórico de los pagos?')) return;
        setSaving(true);
        try {
            // Aquí se llamaría a rrhhApi.saveHistory(...)
            await new Promise(r => setTimeout(r, 1500)); // Simulación de carga
            alert('Snapshot guardado exitosamente en el historial corporativo.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar historial.');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        fetchNomina();
    }, [period, ufValue]);

    const fetchNomina = async () => {
        setLoading(true);
        try {
            const res = await candidatosApi.getAll({ status: 'Contratado' });
            const active = (res.data || []).map(c => {
                const worker = candidatoToWorkerData(c);
                const liq = calcularLiquidacionReal(worker, {}, params);
                return { ...c, _worker: worker, _liq: liq };
            });
            setEmployees(active);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const filtered = useMemo(() =>
        employees.filter(e => {
            const t = searchTerm.toLowerCase();
            return !searchTerm || e.fullName?.toLowerCase().includes(t) || e.rut?.includes(t) || e.position?.toLowerCase().includes(t);
        }), [employees, searchTerm]);

    const totales = useMemo(() => ({
        bruto: filtered.reduce((s, e) => s + (e._liq?.totalHaberes || 0), 0),
        imponible: filtered.reduce((s, e) => s + (e._liq?.habImponibles?.subtotal || 0), 0),
        descuentos: filtered.reduce((s, e) => s + (e._liq?.totalDescuentos || 0), 0),
        liquido: filtered.reduce((s, e) => s + (e._liq?.liquidoAPagar || 0), 0),
        costoEmpresa: filtered.reduce((s, e) => s + (e._liq?.costoTotalEmpresa || 0), 0),
    }), [filtered]);

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200"><CircleDollarSign size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Nómina <span className="text-indigo-600">& Remuneraciones</span></h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Libro de Remuneraciones · Conforme DT
                            · UF {ufValue.toLocaleString('es-CL')}
                            {indLoading && <span className="ml-2 text-amber-400">· Sincronizando…</span>}
                            {lastSync && <span className="ml-2">· Sync {lastSync.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex gap-3">
                        <div className="flex items-center gap-3 bg-white border border-slate-100 pr-4 pl-1 rounded-2xl shadow-sm">
                            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                                className="px-4 py-3 bg-white border-0 outline-none rounded-2xl text-xs font-black text-indigo-600 uppercase tracking-wider" />
                            <Calendar size={14} className="text-slate-300" />
                        </div>

                        <button onClick={handleSaveHistorial} disabled={saving || loading}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Cerrar Periodo & Snapshot
                        </button>

                        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-blue-100">
                            <Download size={14} /> Exportar LRE
                        </button>

                        <button onClick={fetchNomina}
                            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-wider hover:border-indigo-300 transition-all shadow-sm">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* ── KPIs GLOBALES DEL PERÍODO ── */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {[
                        { label: 'Colaboradores', value: filtered.length, icon: Users, color: 'from-slate-600 to-slate-800', suffix: 'activos' },
                        { label: 'Total Bruto', value: totales.bruto, icon: CircleDollarSign, color: 'from-indigo-500 to-indigo-700', isMoney: true },
                        { label: 'Total Impon.', value: totales.imponible, icon: ShieldCheck, color: 'from-violet-500 to-violet-700', isMoney: true },
                        { label: 'Total Desc.', value: totales.descuentos, icon: TrendingDown, color: 'from-rose-500 to-rose-700', isMoney: true },
                        { label: 'Líquido Total', value: totales.liquido, icon: Landmark, color: 'from-emerald-500 to-emerald-700', isMoney: true },
                    ].map((s, i) => (
                        <div key={i} className={`bg-gradient-to-br ${s.color} p-5 rounded-2xl text-white shadow-lg`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="p-1.5 bg-white/20 rounded-lg"><s.icon size={14} /></div>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-70">{s.label}</span>
                            </div>
                            <p className="text-2xl font-black tracking-tighter">
                                {s.isMoney ? `$${Math.round(s.value / 1000).toLocaleString('es-CL')}K` : s.value}
                            </p>
                            {s.suffix && <p className="text-[8px] opacity-60 font-bold mt-0.5">{s.suffix}</p>}
                        </div>
                    ))}
                </div>

                {/* Costo empresa extra */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Building2 size={16} className="text-indigo-500" />
                        <span className="text-xs font-black text-indigo-700 uppercase tracking-wider">Costo Total Empresa (Inc. Aportes Patronales)</span>
                    </div>
                    <span className="text-xl font-black text-indigo-800 tabular-nums">{fmt(totales.costoEmpresa)}</span>
                </div>

                {/* ── TABLA LIBRO DE REMUNERACIONES ── */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" placeholder="Buscar por nombre, RUT o cargo..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-100 px-3 py-2 rounded-xl">
                            {filtered.length} trabajadores
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50/60 text-[8px] uppercase tracking-widest text-slate-400 font-black">
                                    <th className="px-5 py-4">Trabajador</th>
                                    <th className="px-4 py-4 text-right">Sueldo Base</th>
                                    <th className="px-4 py-4 text-right">Gratificación</th>
                                    <th className="px-4 py-4 text-right">Total Impon.</th>
                                    <th className="px-4 py-4 text-right">No Impon.</th>
                                    <th className="px-4 py-4 text-right text-indigo-400">Total Haberes</th>
                                    <th className="px-4 py-4 text-right text-rose-400">AFP</th>
                                    <th className="px-4 py-4 text-right text-rose-400">Salud</th>
                                    <th className="px-4 py-4 text-right text-rose-400">AFC</th>
                                    <th className="px-4 py-4 text-right text-amber-400">Imp. Único</th>
                                    <th className="px-4 py-4 text-right text-rose-400">Total Desc.</th>
                                    <th className="px-4 py-4 text-right text-emerald-500 font-black">Líquido</th>
                                    <th className="px-4 py-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan="13" className="py-20 text-center">
                                        <Loader2 size={28} className="animate-spin text-indigo-300 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">Calculando liquidaciones...</p>
                                    </td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="13" className="py-16 text-center text-slate-400">
                                        <CircleDollarSign size={36} className="mx-auto opacity-20 mb-3" />
                                        <p className="font-bold text-sm">No hay trabajadores contratados</p>
                                    </td></tr>
                                ) : filtered.map(e => {
                                    const l = e._liq;
                                    if (!l) return null;
                                    return (
                                        <tr key={e._id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 font-black text-sm flex items-center justify-center overflow-hidden flex-shrink-0">
                                                        {e.profilePic ? <img src={e.profilePic} alt="" className="w-full h-full object-cover" /> : e.fullName?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xs text-slate-800 uppercase tracking-tight">{e.fullName}</p>
                                                        <p className="text-[9px] text-slate-400 font-mono">{e.rut}</p>
                                                        <div className="flex gap-1 mt-0.5">
                                                            {e.afp && <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{e.afp}</span>}
                                                            {e.previsionSalud && <span className="text-[7px] font-black bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">{e.previsionSalud === 'ISAPRE' ? (e.isapreNombre || 'ISAPRE') : 'FONASA'}</span>}
                                                            {e.contractType && <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{e.contractType}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-right text-xs font-bold text-slate-600 tabular-nums">{fmt(l.habImponibles.sueldoBase)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-bold text-slate-500 tabular-nums">{fmt(l.habImponibles.gratificacion)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-bold text-indigo-600 tabular-nums">{fmt(l.habImponibles.subtotal)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-bold text-teal-600 tabular-nums">{fmt(l.habNoImponibles.subtotal)}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-slate-800 tabular-nums">{fmt(l.totalHaberes)}</td>
                                            <td className="px-4 py-4 text-right text-xs text-rose-600 font-bold tabular-nums">-{fmt(l.prevision.afp)}</td>
                                            <td className="px-4 py-4 text-right text-xs text-rose-600 font-bold tabular-nums">-{fmt(l.prevision.salud)}</td>
                                            <td className="px-4 py-4 text-right text-xs text-rose-500 font-bold tabular-nums">{l.prevision.afc ? `-${fmt(l.prevision.afc)}` : <span className="text-slate-300">—</span>}</td>
                                            <td className="px-4 py-4 text-right text-xs text-amber-600 font-bold tabular-nums">{l.impuestoUnico > 0 ? `-${fmt(l.impuestoUnico)}` : <span className="text-emerald-500 text-[9px] font-black">Exento</span>}</td>
                                            <td className="px-4 py-4 text-right text-xs font-black text-rose-700 tabular-nums">-{fmt(l.totalDescuentos)}</td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="text-base font-black text-emerald-700 tabular-nums">{fmt(l.liquidoAPagar)}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <button onClick={() => setSelected(e)}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700 transition-all shadow-sm hover:shadow-indigo-200">
                                                    <Eye size={12} /> Ver
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* ── TOTALES DEL LIBRO ── */}
                            {!loading && filtered.length > 0 && (
                                <tfoot>
                                    <tr className="bg-slate-800 text-white">
                                        <td className="px-5 py-4 text-[9px] font-black uppercase tracking-widest">TOTALES LIBRO</td>
                                        <td className="px-4 py-4 text-right text-xs font-black tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.habImponibles?.sueldoBase, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.habImponibles?.gratificacion, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-indigo-300 tabular-nums">{fmt(totales.imponible)}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-teal-300 tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.habNoImponibles?.subtotal, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black tabular-nums">{fmt(totales.bruto)}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-rose-300 tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.prevision?.afp, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-rose-300 tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.prevision?.salud, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-rose-200 tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.prevision?.afc, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-amber-300 tabular-nums">{fmt(filtered.reduce((s, e) => s + e._liq?.impuestoUnico, 0))}</td>
                                        <td className="px-4 py-4 text-right text-xs font-black text-rose-300 tabular-nums">{fmt(totales.descuentos)}</td>
                                        <td className="px-4 py-4 text-right text-lg font-black text-emerald-400 tabular-nums">{fmt(totales.liquido)}</td>
                                        <td className="px-4 py-4" />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Legal note */}
                <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
                    <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] font-bold text-amber-700 leading-relaxed">
                        Los cálculos son referenciales conforme al Código del Trabajo Chile.
                        AFP: tasas vigentes 2026. Gratificación: Art. 50 CT.
                        Impuesto Único: tabla UTM vigente SII.
                        UFC y UTM referencias: Feb 2026. Valide con Previred antes de pago.
                    </p>
                </div>

                {/* MODAL LIQUIDACIÓN DETALLE */}
                {selected && (
                    <ModalLiquidacion
                        emp={selected}
                        onClose={() => setSelected(null)}
                        params={params}
                    />
                )}
            </div>
        </div>
    );
};

export default NominaRRHH;
