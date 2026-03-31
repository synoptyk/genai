import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Verified build v1.0.3
import {
    CircleDollarSign, Users, User, Calendar, Search, Loader2,
    ChevronDown, ChevronUp, Download, RefreshCw, Eye,
    TrendingUp, TrendingDown, X, Printer,
    ShieldCheck, Landmark, AlertCircle,
    Building2, Save, Scale, Heart
} from 'lucide-react';
import { candidatosApi, nominaApi, rrhhApi, bonosApi, bonosConfigApi } from '../rrhhApi';
import {
    calcularLiquidacionReal,
    candidatoToWorkerData,
    TASAS_AFP
} from '../utils/payrollCalculator';
import * as XLSX from 'xlsx';
import { MapPin, Briefcase as BriefcaseIcon } from 'lucide-react';
import { useIndicadores } from '../../../contexts/IndicadoresContext';
import { formatRut } from '../../../utils/rutUtils';
import { useAuth } from '../../auth/AuthContext';

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

// ─── Mapeador de Columnas (Smart Mapping Popover) ───────────────────────────
const ColumnMapper = ({ label, code, currentSource, onMap, onLabelChange, options }) => {
    const [open, setOpen] = useState(false);
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [tempLabel, setTempLabel] = useState(label);
    
    const displayCode = options.find(o => o.value === currentSource)?.value || code;

    return (
        <div className="relative group/col">
            <div
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-all ${
                    currentSource?.includes('closure') || currentSource?.match(/^\d{4}$/) ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent'
                } border`}
            >
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{displayCode}</span>
                    <button onClick={() => setOpen(!open)} className="hover:scale-110 transition-transform">
                        <Scale size={10} className={currentSource?.includes('closure') || currentSource?.match(/^\d{4}$/) ? 'text-indigo-400' : 'text-slate-300'} />
                    </button>
                </div>
                
                {isEditingLabel && onLabelChange ? (
                    <input 
                        autoFocus
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value.toUpperCase())}
                        onBlur={() => { onLabelChange(tempLabel); setIsEditingLabel(false); }}
                        onKeyDown={(e) => e.key === 'Enter' && (onLabelChange(tempLabel), setIsEditingLabel(false))}
                        className="text-[10px] font-black text-slate-700 uppercase tracking-tight bg-transparent border-b border-indigo-400 w-20 text-center focus:outline-none"
                    />
                ) : (
                    <span 
                        onClick={() => onLabelChange && setIsEditingLabel(true)}
                        className={`text-[10px] font-black text-slate-700 uppercase tracking-tight max-w-[80px] truncate ${onLabelChange ? 'cursor-edit hover:text-indigo-600' : ''}`}
                    >
                        {label}
                    </span>
                )}
                
                <button onClick={() => setOpen(!open)} className="text-slate-400 hover:text-indigo-400"><ChevronDown size={10} /></button>
            </div>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                            <div className="p-2 bg-indigo-600 rounded-xl text-white"><Scale size={14} /></div>
                            <div>
                                <h4 className="text-[10px] font-black text-slate-800 uppercase">Vínculo de Datos ({displayCode})</h4>
                                <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">Ajustar origen para {label}</p>
                            </div>
                        </div>
                        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                            {options.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => { onMap(code, opt.value); setOpen(false); }}
                                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                                        currentSource === opt.value ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'
                                    }`}
                                >
                                    <div className="flex flex-col items-start text-left">
                                        <span className="text-[10px] font-black uppercase tracking-tight">{opt.label}</span>
                                        <span className={`text-[8px] font-bold uppercase opacity-60`}>{opt.desc}</span>
                                    </div>
                                    {currentSource === opt.value && <div className="w-2 h-2 bg-white rounded-full" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL LIQUIDACIÓN INDIVIDUAL (Hoja DT)
// ─────────────────────────────────────────────────────────────────────────────
const ModalLiquidacion = ({ emp, onClose, params }) => {
    const { user } = useAuth();
    const [ajustes, setAjustes] = useState({
        horasExtra: 0,
        bonoProductividad: 0,
        bonoAsistencia: 0,
        bonosImponibles: 0,
        colacion: 0,
        movilizacion: 0,
        viaticos: 0,
        bonosNoImponibles: 0,
        anticipo: 0,
        cuotaSindical: 0,
        descuentoJudicial: 0,
        otrosDescuentos: 0,
    });

    // AUTO-LOAD NOMINA VALUES (NUEVO REQUERIMIENTO: No digitar desde cero)
    useEffect(() => {
        if (emp && emp._liq) {
            const l = emp._liq;
            setAjustes(prev => ({
                ...prev,
                horasExtra: l.habImponibles?.horasExtra || 0,
                colacion: l.habNoImponibles?.colacion || 0,
                movilizacion: l.habNoImponibles?.movilizacion || 0,
                viaticos: l.habNoImponibles?.viaticos || 0,
                bonosImponibles: l.habImponibles?.bonosInyectados || 0,
                bonosNoImponibles: l.habNoImponibles?.bonosInyectados || 0,
                bonosPorCodigo: l.habImponibles?.bonosPorCodigo || {},
            }));
        }
    }, [emp]);

    const worker = candidatoToWorkerData(emp);
    // Inyectamos los bonos por código ya calculados en la nómina si no hay cambios manuales en el modal
    const currentAjustes = { 
        ...ajustes, 
        bonosPorCodigo: ajustes.bonosPorCodigo || emp._liq?.habImponibles?.bonosPorCodigo || {} 
    };
    const liq = calcularLiquidacionReal(worker, currentAjustes, params);

    const handleChange = (key, val) => setAjustes(prev => ({ ...prev, [key]: parseInt(val) || 0 }));

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto print:p-0 print:bg-white animate-in fade-in duration-300">
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
                            padding: 20mm !important;
                            background: white !important;
                        }
                        .no-print { display: none !important; }
                    }
                `}
            </style>
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl my-4 overflow-hidden print:shadow-none print:my-0 print:rounded-none print-container">
                {/* Header Premium */}
                <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-8 flex items-center justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                            {emp.profilePic ? <img src={emp.profilePic} alt="" className="w-full h-full object-cover rounded-3xl" /> : emp.fullName?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{emp.fullName}</h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-indigo-100 text-[11px] font-bold uppercase tracking-wider">
                                <span className="flex items-center gap-1.5"><User size={12} className="text-indigo-400" /> {formatRut(emp.rut)}</span>
                                <span className="flex items-center gap-1.5"><BriefcaseIcon size={12} className="text-teal-400" /> {emp.position}</span>
                                <span className="flex items-center gap-1.5"><Calendar size={12} className="text-amber-400" /> {emp.contractType || 'Indefinido'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3 no-print relative z-10">
                        <button onClick={() => window.print()}
                            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border border-white/10 active:scale-95 shadow-xl">
                            <Printer size={16} /> Imprimir Liquidación
                        </button>
                        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-rose-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/10 active:scale-95">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/50">
                    {/* LEFT (4 cols): Ajustes del periodo */}
                    <div className="lg:col-span-4 space-y-6 no-print">
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                Ajustes Mensuales {params.period}
                            </h4>

                            <div className="space-y-6">
                                <SeccionCollapsible title="Remuneración Variable" icon={TrendingUp} iconColor="bg-indigo-500" defaultOpen>
                                    <div className="grid grid-cols-1 gap-4 mt-2">
                                        {[
                                            ['Horas Extra (cantidad)', 'horasExtra'],
                                            ['Otros Bonos Imponibles', 'bonosImponibles'],
                                        ].map(([label, key]) => (
                                            <div key={key}>
                                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
                                                <input type="number" min="0" value={ajustes[key] || 0}
                                                    onChange={e => handleChange(key, e.target.value)}
                                                    className="w-full py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </SeccionCollapsible>

                                <SeccionCollapsible title="Asignaciones No Imponibles" icon={Building2} iconColor="bg-teal-500">
                                    <div className="grid grid-cols-1 gap-4 mt-2">
                                        {[
                                            ['Colación', 'colacion'],
                                            ['Movilización', 'movilizacion'],
                                            ['Viáticos / Otros', 'viaticos'],
                                        ].map(([label, key]) => (
                                            <div key={key}>
                                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
                                                <input type="number" min="0" value={ajustes[key] || 0}
                                                    onChange={e => handleChange(key, e.target.value)}
                                                    className="w-full py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-100/50 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </SeccionCollapsible>

                                <SeccionCollapsible title="Descuentos y Otros" icon={TrendingDown} iconColor="bg-rose-500">
                                    <div className="grid grid-cols-1 gap-4 mt-2">
                                        {[
                                            ['Anticipo Sueldo', 'anticipo'],
                                            ['Cuota Sindical', 'cuotaSindical'],
                                            ['Otros Descuentos', 'otrosDescuentos'],
                                        ].map(([label, key]) => (
                                            <div key={key}>
                                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
                                                <input type="number" min="0" value={ajustes[key] || 0}
                                                    onChange={e => handleChange(key, e.target.value)}
                                                    className="w-full py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-rose-100/50 transition-all" />
                                            </div>
                                        ))}
                                    </div>
                                </SeccionCollapsible>
                            </div>
                        </div>

                        {/* Ficha Info Quick View */}
                        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-1000" />
                            <h5 className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-4 flex items-center gap-2">
                                <ShieldCheck size={12} /> Datos Maestros Ficha
                            </h5>
                            <div className="space-y-3">
                                {[
                                    ['AFP', emp.afp || 'No informada'],
                                    ['Salud', emp.previsionSalud || 'FONASA'],
                                    ['RUT', formatRut(emp.rut)],
                                    ['Sueldo Pactado', fmt(emp.sueldoBase || 0)],
                                ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between items-center text-[10px]">
                                        <span className="font-bold opacity-50 uppercase tracking-tighter">{label}</span>
                                        <span className="font-black text-indigo-100">{val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT (8 cols): Previsualización Premium */}
                    <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-10 print:p-0 print:border-none print:shadow-none">
                        {/* Membrete Empresa */}
                        <div className="flex justify-between items-start mb-10 border-b border-slate-100 pb-8">
                            <div>
                                <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-1">LIQUIDACIÓN DE SUELDO</h1>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em]">{params.period}</p>
                            </div>
                             <div className="text-right">
                                <h2 className="text-sm font-black text-slate-800 uppercase leading-none">{user?.empresaRef || 'Nuestra Empresa'}</h2>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Giro: {user?.giroEmpresa || 'Servicios Generales'}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">RUT: {user?.rutEmpresa || '---'}</p>
                            </div>
                        </div>

                        {/* Datos del Trabajador en Rejilla */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 bg-slate-50 rounded-3xl p-6 border border-slate-100">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre Completo</p>
                                <p className="text-[11px] font-black text-slate-800 uppercase">{emp.fullName}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">RUT</p>
                                <p className="text-[11px] font-black text-slate-800 tabular-nums">{formatRut(emp.rut)}</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Antigüedad (Días)</p>
                                <p className="text-[11px] font-black text-indigo-600">{liq.diasTrabajados} de 30 días</p>
                            </div>
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Previsión / Salud</p>
                                <p className="text-[11px] font-black text-teal-600 uppercase">{(emp.afp || 'S/A')} · {emp.previsionSalud || 'FONASA'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-1 gap-12">
                            {/* HABERES Y DESCUENTOS DETALLADOS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                {/* HABERES */}
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                            <div className="w-1 h-3 bg-emerald-500 rounded-full" /> Haberes Imponibles
                                        </p>
                                        <FilaLibro concepto="Sueldo Base" monto={liq.habImponibles.sueldoBase} />
                                        <FilaLibro concepto="Semana Corrida" monto={liq.habImponibles.semanaCorrida} />
                                        <FilaLibro concepto="Gratificación Legal" monto={liq.habImponibles.gratificacion} />
                                        {liq.habImponibles.horaExtraMonto > 0 && <FilaLibro concepto="Horas Extraordinarias" monto={liq.habImponibles.horaExtraMonto} />}
                                        
                                        {/* Detalle Bonos por Código */}
                                        {Object.entries(liq.habImponibles.bonosPorCodigo || {}).map(([code, amount]) => (
                                            <FilaLibro key={code} concepto={`Bono Código ${code}`} monto={amount} />
                                        ))}
                                        
                                        <div className="pt-2">
                                            <FilaLibro concepto="Total Haberes Imponibles" monto={liq.habImponibles.subtotal} isSubtotal />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-t border-slate-100 pt-4">
                                        <p className="text-[9px] font-black text-teal-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                            <div className="w-1 h-3 bg-teal-500 rounded-full" /> Haberes No Imponibles
                                        </p>
                                        <FilaLibro concepto="Asignación Colación" monto={liq.habNoImponibles.colacion} />
                                        <FilaLibro concepto="Asignación Movilización" monto={liq.habNoImponibles.movilizacion} />
                                        {liq.habNoImponibles.asignacionFamiliar > 0 && <FilaLibro concepto="Asignación Familiar" monto={liq.habNoImponibles.asignacionFamiliar} />}
                                        {liq.habNoImponibles.otros > 0 && <FilaLibro concepto="Otros No Imponibles" monto={liq.habNoImponibles.otros} />}
                                        
                                        <div className="pt-2">
                                            <FilaLibro concepto="Total Haberes" monto={liq.totalHaberes} isSubtotal />
                                        </div>
                                    </div>
                                </div>

                                {/* DESCUENTOS */}
                                <div className="space-y-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                            <div className="w-1 h-3 bg-rose-500 rounded-full" /> Descuentos Previsionales
                                        </p>
                                        <FilaLibro concepto={`Previsión AFP (${worker.afp})`} monto={liq.prevision.afp} isNegative />
                                        <FilaLibro concepto={`Salud 7% (${worker.previsionSalud})`} monto={liq.prevision.salud} isNegative />
                                        {liq.prevision.afc > 0 && <FilaLibro concepto="Seguro Cesantía (AFC)" monto={liq.prevision.afc} isNegative />}
                                        {liq.impuestoUnico > 0 && <FilaLibro concepto="Impuesto Único 2ª Categoría" monto={liq.impuestoUnico} isNegative />}
                                        
                                        {liq.prevision.excesoIsapre > 0 && <FilaLibro concepto="Cotización Adicional Isapre" monto={liq.prevision.excesoIsapre} isNegative />}
                                    </div>

                                    <div className="space-y-1.5 border-t border-slate-100 pt-4">
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                            <div className="w-1 h-3 bg-slate-400 rounded-full" /> Otros Descuentos
                                        </p>
                                        <FilaLibro concepto="Total Anticipos / Varios" monto={liq.otrosDescuentos} isNegative />
                                        
                                        <div className="pt-2 space-y-1.5">
                                            <FilaLibro concepto="Total Descuentos" monto={liq.totalDescuentos} isSubtotal isNegative />
                                            <div className="bg-indigo-900 rounded-2xl p-6 mt-6 shadow-2xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700" />
                                                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest block mb-2">Alcance Líquido</span>
                                                <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{fmt(liq.liquidoAPagar)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Firma y Glosa Legal */}
                        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12">
                             <div className="flex-1">
                                <p className="text-[9px] font-medium text-slate-400 italic leading-relaxed max-w-sm">
                                    Certifico que he recibido de {user?.empresaRef || 'el Empleador'}, a mi total satisfacción, el saldo líquido indicado en esta liquidación, sin tener cargo ni reclamo alguno que formular.
                                </p>
                            </div>
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-48 h-0.5 bg-slate-200" />
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Firma del Trabajador</span>
                                <span className="text-[7px] text-slate-300 font-mono tracking-widest">DIGITAL ID: {emp._id?.slice(-12)}</span>
                            </div>
                        </div>

                        {/* COSTO EMPRESA - Solo visual para admin */}
                        <div className="mt-12 p-6 bg-slate-50 rounded-3xl border border-slate-100 no-print">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Análisis Costo Empresa (Patronal)</span>
                                <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200">PRIVADO</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px]">
                                <div>
                                    <p className="text-slate-400 font-bold mb-1">SIS (Seguro Inv.)</p>
                                    <p className="font-black text-slate-700">{fmt(liq.patronales.sis)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold mb-1">Mutualidad</p>
                                    <p className="font-black text-slate-700">{fmt(liq.patronales.mutual)}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 font-bold mb-1">AFC Empleador</p>
                                    <p className="font-black text-slate-700">{fmt(liq.patronales.afc)}</p>
                                </div>
                                <div>
                                    <p className="text-indigo-400 font-bold mb-1">Expectativa Vida</p>
                                    <p className="font-black text-indigo-700">{fmt(liq.patronales.expectativaVida)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper para normalizar nombres y permitir match por texto
const normalize = (str) => (str || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// ─────────────────────────────────────────────────────────────────────────────
//  NÓMINA PRINCIPAL — LIBRO DE REMUNERACIONES
// ─────────────────────────────────────────────────────────────────────────────
const NominaRRHH = () => {
    const { ufValue, params: indicParams, loading: indLoading, lastSync } = useIndicadores();

    const [nomina, setNomina] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    const [bonosConsolidados, setBonosConsolidados] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closuresData, setClosuresData] = useState([]);
    const [manualValues, setManualValues] = useState({}); // { 'RUT_COLID': amount }
    const [payrollMapping, setPayrollMapping] = useState({
        mappings: {
            sueldoBase: 'ficha.sueldoBase',
            gratificacion: 'formula.legal_25'
        },
        extraColumns: [] // { id, label, code }
    });

    const [payrollTemplates, setPayrollTemplates] = useState([]);
    const [currentTemplateName, setCurrentTemplateName] = useState('');

    const [periodStats, setPeriodStats] = useState({
        diasHabiles: 25,
        domingosFestivos: 5
    });

    // --- ACCIONES DE PLANTILLAS ---
    const handleSaveTemplate = async () => {
        if (!currentTemplateName) {
            alert('Ingresa un nombre para la plantilla');
            return;
        }
        const newTemplate = {
            name: currentTemplateName,
            config: payrollMapping,
            createdAt: new Date().toISOString()
        };
        try {
            // Guardamos la variante con nombre
            await rrhhApi.post('/nomina/templates', newTemplate);
            // PERSISTIMOS TAMBIÉN COMO CONFIG ACTIVA (MASTER)
            await rrhhApi.post('/nomina/config', payrollMapping);
            
            setPayrollTemplates([...payrollTemplates, newTemplate]);
            setCurrentTemplateName('');
            setAlert({ type: 'success', message: `Plantilla "${newTemplate.name}" guardada y establecida como activa` });
        } catch (e) {
            console.error('Error saving template:', e);
        }
    };

    const loadTemplate = async (template) => {
        setPayrollMapping(template.config);
        try {
            // Al cargar una plantilla, la hacemos la activa persistente
            await rrhhApi.post('/nomina/config', template.config);
            setAlert({ type: 'info', message: `Plantilla "${template.name}" cargada y activa` });
        } catch (e) {
            console.error('Error updating config on load:', e);
        }
    };

    const mappingOptions = [
        { label: 'Sueldo Ficha', value: 'ficha.sueldoBase', code: '1010', desc: 'Sueldo base pactado en contrato' },
        { label: 'Gratif. Legal', value: 'formula.legal_25', code: '1020', desc: '25% imponible (Tope 4.75 IMM)' },
        { label: 'Semana Corrida', value: 'formula.semana_corrida', code: '1001', desc: 'Promedio remuneración variable' },
        { label: 'Bono TOA Completo', value: 'closure.totalBonus', code: '1030', desc: 'Suma de Baremo + RR + AI' },
        { label: 'Bono Baremo', value: 'closure.baremoBonus', code: '1030', desc: 'Cumplimiento de puntos' },
        { label: 'Bono Calidad (RR)', value: 'closure.rrBonus', code: '1041', desc: 'Productividad de calidad' },
        { label: 'Bono Auditoría (AI)', value: 'closure.aiBonus', code: '1041', desc: 'Incentivo revisión AI' },
        { label: 'Bono Asistencia', value: 'closure.asistenciaBonus', code: '1050', desc: 'Cumplimiento de asistencia' },
        { label: 'Viático Variable', value: 'closure.viatico', code: '2010', desc: 'Monto no imp. desde producción' },
        { label: 'Manual Periodo', value: 'manual.current', code: '1040', desc: 'Valor ingresado manualmente' },
    ];

    const dynamicMappingOptions = useMemo(() => [
        ...mappingOptions,
        ...closuresData.map(c => ({
            label: `CIERRE: ${c.modeloRef?.nombre}`, 
            value: `closure.${c.modeloRef?._id}`,
            code: c.modeloRef?.tipoBonoRef?.codigo || '1030',
            desc: 'Vincular a Cierre de Bonos' 
        })),
        { label: 'Valor Manual', value: 'manual', code: '1040', desc: 'Ingreso directo en tabla' }
    ], [closuresData]);

    const params = { ...indicParams, ...periodStats, period };

    // --- ACCIONES ---
    const handleSaveHistorial = async () => {
        // Formatear liquidaciones para envío a DB
        const batch = filtered.map(e => ({
            trabajadorId: e._id,
            nombreTrabajador: e.fullName,
            rutTrabajador: e.rut,
            cargo: e.position,
            periodo: (() => {
                const [y, m] = period.split('-');
                return `${m}-${y}`;
            })(),
            haberes: {
                sueldoBase: e._liq.habImponibles.sueldoBase,
                gratificacion: e._liq.habImponibles.gratificacion,
                bonosImponibles: e._liq.habImponibles.otros + e._liq.habImponibles.bonosInyectados,
                totImponible: e._liq.habImponibles.subtotal,
                movilizacion: e._liq.habNoImponibles.movilizacion,
                colacion: e._liq.habNoImponibles.colacion,
                asignacionFamiliar: e._liq.habNoImponibles.asignacionFamiliar,
                otrosNoImponibles: e._liq.habNoImponibles.viaticos + e._liq.habNoImponibles.bonoVacaciones + e._liq.habNoImponibles.bonosNoImponiblesExtra,
                totNoImponible: e._liq.habNoImponibles.subtotal,
                totHaberes: e._liq.totalHaberes
            },
            descuentos: {
                afp: {
                    nombre: e.afp,
                    monto: e._liq.prevision.afp,
                    tasa: TASAS_AFP[(e.afp || '').toUpperCase()] || 11.41
                },
                salud: {
                    nombre: e.previsionSalud,
                    monto: e._liq.prevision.salud,
                    isapreAdicionalClp: e._liq.prevision.excesoIsapre
                },
                afc: e._liq.prevision.afc,
                impuestoUnico: e._liq.impuestoUnico,
                otros: e._liq.otrosDescuentos,
                totDescuentos: e._liq.totalDescuentos
            },
            sueldoLiquido: e._liq.liquidoAPagar,
            costoEmpresa: e._liq.costoTotalEmpresa,
            patronales: {
                sis: e._liq.patronales.sis,
                afc: e._liq.patronales.afc,
                mutual: e._liq.patronales.mutual
            }
        }));

        setConfirmModal({
            title: '¿Confirmar Cierre de Periodo?',
            message: `Se generará un snapshot histórico para ${filtered.length} colaboradores en el periodo ${period}. Esta acción habilitará la descarga de archivos para Previred.`,
            action: async () => {
                setConfirmModal(null);
                setSaving(true);
                try {
                    await nominaApi.guardarLote(batch);
                    setAlert({ type: 'success', msg: 'Periodo cerrado y snapshot guardado exitosamente.' });
                } catch (e) {
                    console.error("Save Error:", e);
                    setAlert({ type: 'error', msg: 'Error al cerrar el periodo. Verifica la conexión.' });
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    const fetchNomina = useCallback(async () => {
        setLoading(true);
        try {
            const [y, m] = period.split('-');
            const yearNum = parseInt(y);
            const monthNum = parseInt(m);
            // Lógica de mes desfasado: Sueldo base del mes actual, Bonos de producción del mes anterior
            const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
            const prevYear = monthNum === 1 ? yearNum - 1 : yearNum;

            const [resStaff, resBonos, resConfig, resMap, resTemplates] = await Promise.all([
                candidatosApi.getAll({ status: 'Contratado' }),
                bonosApi.getClosure(prevYear, prevMonth).catch(() => ({ data: [] })),
                bonosConfigApi.getAll().catch(() => ({ data: [] })),
                rrhhApi.get('/nomina/config').catch(() => ({ data: null })),
                rrhhApi.get('/nomina/templates').catch(() => ({ data: [] }))
            ]);
            setNomina(resStaff.data || []);
            setClosuresData(resBonos.data || []);
            setBonosConfig(resConfig.data || []);
            if (resMap.data) setPayrollMapping(resMap.data);
            if (resTemplates.data) setPayrollTemplates(resTemplates.data);
        } catch (e) {
            console.error('❌ Error fetching payroll data:', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchNomina();
    }, [fetchNomina]);

    const processed = useMemo(() => {
        if (!nomina.length) return [];
        
        return nomina.filter(c => {
            if (!c.contractStartDate) return true; // Si no hay fecha mostramos record (o podrias elegir ocultarlo)
            const [y, m] = period.split('-').map(Number);
            // El trabajador debe haber ingresado antes o durante el mes actual para participar de la nómina
            const lastDayOfPeriod = new Date(y, m, 0); 
            const startDate = new Date(c.contractStartDate);
            return startDate <= lastDayOfPeriod;
        }).map(c => {
            const worker = candidatoToWorkerData(c);
            
            // 2. EXTRAER BONOS DINÁMICOS POR CÓDIGO DT (VARIABLE + FIJO)
            const groupBonusesByCode = () => {
                const bag = {};
                
                // A. De la ficha (Bono Fijo)
                (c.bonuses || []).forEach(b => {
                    const code = b.tipoBonoRef?.codigo || '1040'; // Default 1040: No Específico
                    bag[code] = (bag[code] || 0) + (parseInt(b.amount) || 0);
                });

                // B. De los Múltiples Cierres (Múltiples Modelos de Producción)
                closuresData.forEach(closure => {
                    const modelId = closure.modeloRef?._id;
                    const modelName = closure.modeloRef?.nombre;
                    const defaultCode = closure.modeloRef?.tipoBonoRef?.codigo || '1030';
                    
                    // Si este modelo ya está vinculado a una columna EXTRA explícita, 
                    // NO lo sumamos aquí para evitar duplicación en el LRE.
                    const isExplicitlyLinked = (payrollMapping.extraColumns || []).some(extra => extra.source === `closure.${modelId}`);
                    if (isExplicitlyLinked) return;

                    const res = closure.calculos?.find(b => (b.tecnicoId === c.idRecursoToa) || (b.rut === c.rut) || (normalize(b.nombre) === normalize(c.fullName)));

                    if (res) {
                        const mappedCode = payrollMapping.mappings?.[`model_${modelId}`] || defaultCode;
                        bag[mappedCode] = (bag[mappedCode] || 0) + (res.baremoBonus || 0);
                        
                        if (res.asistenciaBonus) bag['1050'] = (bag['1050'] || 0) + (res.asistenciaBonus || 0);
                        if (res.rrBonus || res.aiBonus) {
                             bag['1041'] = (bag['1041'] || 0) + (res.rrBonus || 0) + (res.aiBonus || 0);
                        }
                    }
                });
                
                // C. VALORES MANUALES Y VÍNCULOS DINÁMICOS EN COLUMNAS EXTRAS
                (payrollMapping.extraColumns || []).forEach(col => {
                    let val = 0;
                    if (col.source?.startsWith('closure.')) {
                        const parts = col.source.split('.');
                        const sId = parts[1];

                        const modelCl = closuresData.find(cl => cl.modeloRef?._id === sId);
                        if (modelCl) {
                            const res = modelCl.calculos?.find(b => (b.tecnicoId === c.idRecursoToa) || (b.rut === c.rut) || (normalize(b.nombre) === normalize(c.fullName)));
                            val = res?.baremoBonus || 0;
                        } else {
                            val = closuresData.reduce((tot, cl) => {
                                const res = cl.calculos?.find(b => (b.tecnicoId === c.idRecursoToa) || (b.rut === c.rut) || (normalize(b.nombre) === normalize(c.fullName)));
                                return tot + (parseInt(res?.[sId]) || 0);
                            }, 0);
                        }
                    } else {
                        val = manualValues[`${c.rut}_${col.id}`] || 0;
                    }
                    
                    if (val) bag[col.code] = (bag[col.code] || 0) + parseInt(val);
                });
                
                return bag;
            };

            const bonosAgrupados = groupBonusesByCode();

            const ajustes = {
                bonosPorCodigo: bonosAgrupados,
                horasExtra: 0, 
                diasHabiles: periodStats.diasHabiles,
                domingosFestivos: periodStats.domingosFestivos
            };

            const liq = calcularLiquidacionReal(worker, ajustes, params);
            
            // --- BREAKDOWN DE NO IMPONIBLES PARA AUDITORÍA ---
            const noImpBreakdown = [];
            if (liq.habNoImponibles.asignacionFamiliar > 0) noImpBreakdown.push(`Asig. Fam: ${fmt(liq.habNoImponibles.asignacionFamiliar)}`);
            if (liq.habNoImponibles.colacion > 0) noImpBreakdown.push(`Colación: ${fmt(liq.habNoImponibles.colacion)}`);
            if (liq.habNoImponibles.movilizacion > 0) noImpBreakdown.push(`Movil: ${fmt(liq.habNoImponibles.movilizacion)}`);
            
            Object.entries(bonosAgrupados).forEach(([code, val]) => {
                if (code.startsWith('2') && val > 0) {
                    const label = mappingOptions.find(o => o.code === code)?.label || `Bono ${code}`;
                    noImpBreakdown.push(`${label}: ${fmt(val)}`);
                }
            });
            liq._breakdownNoImp = noImpBreakdown.join(' | ');

            return { 
                ...c, 
                _worker: worker, 
                _liq: liq, 
                _bonosAgrupados: bonosAgrupados
            };
        });
    }, [nomina, closuresData, params, payrollMapping, manualValues, periodStats]);

    const handleUpdateMapping = async (columnKey, dataSource) => {
        const newMappings = { ...payrollMapping.mappings, [columnKey]: dataSource };
        const newState = { ...payrollMapping, mappings: newMappings };
        setPayrollMapping(newState);
        try {
            await rrhhApi.post('/nomina/config', newState);
        } catch (e) {
            console.error('Error saving mapping:', e);
        }
    };

    const handleUpdateColumnMapping = async (colId, code, dataSource) => {
        const newState = { 
            ...payrollMapping, 
            extraColumns: payrollMapping.extraColumns.map(c => c.id === colId ? { ...c, code, source: dataSource } : c) 
        };
        setPayrollMapping(newState);
        await rrhhApi.post('/nomina/config', newState);
    };

    const handleUpdateColumnLabel = async (colId, label) => {
        const newState = { 
            ...payrollMapping, 
            extraColumns: payrollMapping.extraColumns.map(c => c.id === colId ? { ...c, label } : c) 
        };
        setPayrollMapping(newState);
        await rrhhApi.post('/nomina/config', newState);
    };

    const handleAddExtraColumn = async () => {
        const id = `col_${Date.now()}`;
        const newCol = { id, label: 'NUEVO BONO', code: '1040', source: 'manual' };
        const newState = { 
            ...payrollMapping, 
            extraColumns: [...(payrollMapping.extraColumns || []), newCol] 
        };
        setPayrollMapping(newState);
        await rrhhApi.post('/nomina/config', newState);
    };

    const handleRemoveExtraColumn = async (id) => {
        const newState = { 
            ...payrollMapping, 
            extraColumns: payrollMapping.extraColumns.filter(c => c.id !== id) 
        };
        setPayrollMapping(newState);
        await rrhhApi.post('/nomina/config', newState);
    };

    const handleExportLRE = () => {
        if (!processed.length) return;
        const [y, m] = period.split('-');
        
        // Formato CSV delimitado por ; para la DT
        let csv = "RUT;Nombres;Apellido Paterno;Apellido Materno;1010;1020;2010;Total Imponible;Total Haberes;Descuento AFP;Descuento Salud;Liquido Pagado\n";
        
        processed.forEach(e => {
            const l = e._liq;
            const names = e.fullName.split(' ');
            const nom = names[0] || '';
            const pat = names[1] || '';
            const mat = names[2] || '';
            
            // Mapeo dinámico de bonos por código
            const b = l.habImponibles.bonosPorCodigo || {};
            
            const line = [
                e.rut,
                nom, pat, mat,
                l.habImponibles.sueldoBase,
                l.habImponibles.gratificacion,
                l.habImponibles.horaExtraMonto,
                l.habImponibles.subtotal,
                l.totalHaberes,
                l.prevision.afp,
                l.prevision.salud,
                l.liquidoAPagar
            ].join(';');
            csv += line + "\n";
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `LRE_DT_${m}_${y}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const legalAlerts = useMemo(() => {
        const alerts = [];
        processed.forEach(emp => {
            const h = emp._liq?.habNoImponibles;
            if (!h) return;
            
            // Check Colacion
            const configCol = bonosConfig.find(b => b.nombre.toLowerCase().includes('colación'));
            if (configCol && h.colacion > configCol.limiteReferencial) {
                alerts.push({ worker: emp.fullName, bono: 'Colación', monto: h.colacion, limite: configCol.limiteReferencial, msg: configCol.avisoLegal });
            }
            
            // Check Movilizacion
            const configMov = bonosConfig.find(b => b.nombre.toLowerCase().includes('movilización'));
            if (configMov && h.movilizacion > configMov.limiteReferencial) {
                alerts.push({ worker: emp.fullName, bono: 'Movilización', monto: h.movilizacion, limite: configMov.limiteReferencial, msg: configMov.avisoLegal });
            }
        });
        return alerts;
    }, [processed, bonosConfig]);

    const filtered = useMemo(() =>
        processed.filter(e => {
            const t = searchTerm.toLowerCase();
            return !searchTerm ||
                e.fullName?.toLowerCase().includes(t) ||
                e.rut?.includes(t) ||
                e.position?.toLowerCase().includes(t);
        }), [processed, searchTerm]);

    const totales = useMemo(() => ({
        bruto: filtered.reduce((s, e) => s + (e._liq?.totalHaberes || 0), 0),
        imponible: filtered.reduce((s, e) => s + (e._liq?.habImponibles?.subtotal || 0), 0),
        descuentos: filtered.reduce((s, e) => s + (e._liq?.totalDescuentos || 0), 0),
        liquido: filtered.reduce((s, e) => s + (e._liq?.liquidoAPagar || 0), 0),
        costoEmpresa: filtered.reduce((s, e) => s + (e._liq?.costoTotalEmpresa || 0), 0),
        longevidad: filtered.reduce((s, e) => s + (e._liq?.patronales?.expectativaVida || 0), 0),
    }), [filtered]);

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* ── HEADER EJECUTIVO ── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 mt-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200">
                            <CircleDollarSign size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                Nómina <span className="text-indigo-600">& Remuneraciones</span>
                            </h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Libro de Remuneraciones Electrónico · Período {period} · Conforme a Normativa DT 2026
                            </p>
                            <div className="flex items-center gap-2 mt-1 py-1 px-3 bg-amber-50 border border-amber-100 rounded-lg w-fit">
                                <TrendingUp size={10} className="text-amber-500" />
                                <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">
                                    Producción Variables: Mes Desfasado ({( () => {
                                        const [y, m] = period.split('-').map(Number);
                                        const prevM = m === 1 ? 12 : m - 1;
                                        const prevY = m === 1 ? y - 1 : y;
                                        return `${String(prevM).padStart(2, '0')}/${prevY}`;
                                    })()})
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-transparent border-none text-[11px] font-black uppercase text-slate-700 focus:outline-none" />
                        </div>
                        <div className="w-px h-6 bg-slate-100 mx-1" />
                        <div className="flex items-center gap-3 pr-3">
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 uppercase">Hábiles</span>
                                <input type="number" value={periodStats.diasHabiles} 
                                    onChange={e => setPeriodStats(prev => ({...prev, diasHabiles: parseInt(e.target.value) || 0}))} 
                                    className="w-8 text-[11px] font-black text-indigo-600 focus:outline-none bg-transparent" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[7px] font-black text-slate-400 uppercase">D/Fst</span>
                                <input type="number" value={periodStats.domingosFestivos} 
                                    onChange={e => setPeriodStats(prev => ({...prev, domingosFestivos: parseInt(e.target.value) || 0}))} 
                                    className="w-8 text-[11px] font-black text-emerald-600 focus:outline-none bg-transparent" />
                            </div>
                        </div>
                    </div>

                    <button onClick={handleExportLRE} className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                        <Download size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" /> Exportar DT
                    </button>
                    
                    <button onClick={handleSaveHistorial} disabled={saving || filtered.length === 0}
                        className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? 'Procesando...' : 'Cerrar Período'}
                    </button>
                </div>
            </div>

            {/* ── DASHBOARD DE TOTALES CRYSTAL ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5 mb-8">
                {[
                    { label: 'Colaboradores', value: filtered.length, icon: Users, theme: 'bg-white text-slate-800 border-slate-100', suffix: 'activos' },
                    { label: 'Total Bruto', value: totales.bruto, icon: CircleDollarSign, theme: 'bg-indigo-600 text-white shadow-indigo-100', isMoney: true },
                    { label: 'Total Impon.', value: totales.imponible, icon: ShieldCheck, theme: 'bg-violet-600 text-white shadow-violet-100', isMoney: true },
                    { label: 'Expectativa Vida', value: totales.longevidad, icon: Heart, theme: 'bg-amber-500 text-white shadow-amber-100', isMoney: true, suffix: 'Ley 2026' },
                    { label: 'Descuentos', value: totales.descuentos, icon: TrendingDown, theme: 'bg-rose-600 text-white shadow-rose-100', isMoney: true },
                    { label: 'Líquido Total', value: totales.liquido, icon: Landmark, theme: 'bg-emerald-600 text-white shadow-emerald-100', isMoney: true },
                ].map((s, i) => (
                    <div key={i} className={`${s.theme} p-6 rounded-[2rem] border shadow-xl relative overflow-hidden group`}>
                        <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 ${s.isMoney ? 'scale-150' : 'scale-100'}`}>
                            <s.icon size={80} />
                        </div>
                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{s.label}</span>
                                <div className={`p-2 rounded-xl sm:block hidden ${s.isMoney ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}><s.icon size={16} /></div>
                            </div>
                            <div>
                                <p className="text-2xl font-black tracking-tight leading-none mb-1">
                                    {s.isMoney ? `$${(s.value / 1000).toLocaleString('es-CL', { maximumFractionDigits: (s.value < 1000000 ? 0 : 1) })}k` : s.value}
                                </p>
                                <p className="text-[9px] font-bold opacity-60 uppercase">{s.suffix || 'CLP Consolidado'}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Costo Empresa Extra Premium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div className="md:col-span-2 bg-white/50 backdrop-blur-md border border-white rounded-[2rem] p-4 pr-8 flex items-center justify-between shadow-2xl shadow-indigo-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-lg"><Building2 size={24} /></div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Costo Total Empresa</span>
                            <span className="text-[8px] font-bold text-indigo-500 uppercase">Cálculo 2026: Haberes + SIS + Mutual + AFC Patronal</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-4xl font-black text-slate-800 tabular-nums tracking-tighter">{fmt(totales.costoEmpresa)}</span>
                        <span className="text-[10px] font-bold text-slate-400 block -mt-1">IVA No Aplicable</span>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-[2rem] p-5 text-white shadow-xl shadow-slate-100 flex items-center justify-between overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                    <div className="relative z-10">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-80 block mb-1">Expectativa de Vida 2026</span>
                        <span className="text-2xl font-black tabular-nums">{fmt(totales.costoEmpresa ? Math.round(totales.imponible * 0.005) : 0)}</span>
                        <p className="text-[7px] font-bold uppercase mt-1 opacity-60">Aporte Patronal Longevidad (0.5%)</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center relative z-10"><ShieldCheck size={18} /></div>
                </div>
            </div>

            {/* Alertas Legales */}
            {legalAlerts.length > 0 && (
                <div className="mb-8 p-5 rounded-[2rem] bg-rose-50/50 border border-rose-100/50 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-200"><AlertCircle size={18} /></div>
                        <div>
                            <h3 className="text-sm font-black text-rose-800 uppercase tracking-tight">Vigilancia Legal DT</h3>
                            <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Se han detectado {legalAlerts.length} inconsistencias en topes impositivos</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {legalAlerts.slice(0, 3).map((a, i) => (
                            <div key={i} className="p-4 bg-white/60 rounded-2xl border border-rose-100 shadow-sm">
                                <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">{a.worker}</p>
                                <p className="text-[9px] font-bold text-rose-500 uppercase mb-2">{a.bono} excede razonabilidad</p>
                                <div className="flex items-end justify-between border-t border-rose-50 pt-2">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Monto</span>
                                    <span className="text-xs font-black text-rose-600">{fmt(a.monto)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TABLA DE REMUNERACIONES MASTER ── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden mb-12">
                {/* TOOLBAR SUPERIOR */}
                <div className="p-6 border-b border-slate-50 bg-slate-50/20 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="relative flex-1 w-full md:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" placeholder="Filtrar por RUT o Nombre..." value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-300" />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* PLANTILLAS UI */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                            <input 
                                type="text" 
                                placeholder="Nombre Plantilla..." 
                                value={currentTemplateName}
                                onChange={e => setCurrentTemplateName(e.target.value)}
                                className="px-3 py-1.5 text-[10px] font-bold bg-transparent border-none outline-none w-28"
                            />
                            <button onClick={handleSaveTemplate}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Guardar como Plantilla">
                                <Save size={14} />
                            </button>
                        </div>

                        {payrollTemplates.length > 0 && (
                            <select 
                                onChange={(e) => {
                                    const t = payrollTemplates[e.target.selectedIndex - 1];
                                    if (t) loadTemplate(t);
                                }}
                                className="bg-white border border-slate-100 rounded-2xl px-3 py-2.5 text-[10px] font-black uppercase tracking-tight text-slate-600 shadow-sm focus:ring-4 focus:ring-slate-50 outline-none"
                            >
                                <option value="">Cargar Plantilla...</option>
                                {payrollTemplates.map((t, idx) => (
                                    <option key={idx} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        )}

                        <button onClick={handleAddExtraColumn} 
                            className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all active:scale-95">
                            <RefreshCw size={14} className="text-indigo-400" /> Nueva Columna
                        </button>
                        <button onClick={fetchNomina} 
                            className="p-3 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:bg-slate-50 transition-all shadow-sm">
                            <Loader2 size={16} className={loading ? 'animate-spin text-indigo-500' : ''} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[1200px] border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 backdrop-blur-xl sticky top-0 z-30 transition-shadow group">
                                <th className="px-6 py-6 whitespace-nowrap bg-slate-50/80 border-b border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColumnMapper label="Sueldo Base" code="1010" currentSource={payrollMapping.mappings.sueldoBase} onMap={handleUpdateMapping} options={mappingOptions} />
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <div className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl bg-teal-50 border border-teal-100 shadow-sm">
                                        <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">1001</span>
                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Sm. Corrida</span>
                                    </div>
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColumnMapper label="Gratif. Legal" code="1020" currentSource={payrollMapping.mappings.gratificacion} onMap={handleUpdateMapping} options={mappingOptions} />
                                </th>

                                {closuresData.map(cl => (
                                    <th key={cl.modeloRef?._id} className="px-4 py-6 text-right border-b border-slate-100">
                                        <ColumnMapper 
                                            label={cl.modeloRef?.nombre || 'Bono'} 
                                            code={cl.modeloRef?.tipoBonoRef?.codigo || "1030"} 
                                            currentSource={payrollMapping.mappings[`model_${cl.modeloRef?._id}`] || (cl.modeloRef?.tipoBonoRef?.codigo || "1030")} 
                                            onMap={(key, val) => handleUpdateMapping(`model_${cl.modeloRef?._id}`, val)} 
                                            options={dynamicMappingOptions} 
                                        />
                                    </th>
                                ))}

                                {(payrollMapping.extraColumns || []).map(col => {
                                    const mapOpt = dynamicMappingOptions.find(o => o.value === col.source);
                                    return (
                                        <th key={col.id} className="px-4 py-6 text-right border-b border-slate-100 relative group/extra">
                                            <ColumnMapper 
                                                label={col.label} 
                                                code={mapOpt?.code || col.code || "1040"} 
                                                currentSource={col.source || 'manual'} 
                                                onMap={(c, val) => handleUpdateColumnMapping(col.id, c, val)} 
                                                onLabelChange={(newLab) => handleUpdateColumnLabel(col.id, newLab)}
                                                options={dynamicMappingOptions} 
                                            />
                                            <button onClick={() => handleRemoveExtraColumn(col.id)} 
                                                className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full opacity-0 group-hover/extra:opacity-100 transition-opacity z-40 transform hover:scale-110 shadow-lg">
                                                <X size={10} />
                                            </button>
                                        </th>
                                    );
                                })}

                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColumnMapper label="B. Asistencia" code="1050" currentSource={payrollMapping.mappings.bonoAsistencia || '1050'} onMap={(k, v) => handleUpdateMapping('bonoAsistencia', v)} options={dynamicMappingOptions} />
                                </th>

                                <th className="px-4 py-6 text-right bg-slate-50/40 border-b border-slate-100">
                                   <div className="flex flex-col items-end">
                                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">1011</span>
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">H. Extra</span>
                                   </div>
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tot Impon.</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-teal-400 uppercase tracking-widest">No Impon.</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Haberes</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">AFP</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Salud</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">AFC</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Impuesto</span></th>
                                <th className="px-4 py-6 text-right border-b border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Otros</span></th>
                                <th className="px-4 py-6 text-right border-b border-indigo-100 bg-indigo-50/20"><span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest">Liquido</span></th>
                                <th className="px-6 py-6 text-center border-b border-slate-100"><BriefcaseIcon size={16} className="mx-auto text-slate-300" /></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="30" className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative">
                                                <Loader2 size={48} className="animate-spin text-indigo-600 opacity-20" />
                                                <Loader2 size={48} className="animate-spin text-indigo-600 absolute inset-0 [animation-delay:-0.3s]" />
                                            </div>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Orquestando datos legales...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="30" className="py-32 text-center">
                                        <div className="max-w-xs mx-auto">
                                            <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-4 border-2 border-dashed border-slate-100"><Search size={24} /></div>
                                            <p className="text-sm font-black text-slate-800 uppercase mb-1">Sin coincidencias</p>
                                            <p className="text-xs text-slate-400 font-medium leading-relaxed">No encontramos técnicos para el filtro actual. Verifica la búsqueda o sincroniza el período.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(e => {
                                const l = e._liq;
                                if (!l) return null;
                                return (
                                    <tr key={e._id} className="hover:bg-indigo-50/20 transition-all group/row">
                                        <td className="px-6 py-5 sticky left-0 bg-white group-hover/row:bg-indigo-50/20 z-10 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-indigo-100 overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                                                    {e.profilePic ? <img src={e.profilePic} alt="" className="w-full h-full object-cover" /> : e.fullName?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <p className="font-black text-xs text-slate-800 uppercase tracking-tight truncate">{e.fullName}</p>
                                                    <p className="text-[9px] text-slate-400 font-mono tracking-tighter">{formatRut(e.rut)}</p>
                                                    <div className="flex gap-1 mt-1">
                                                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-lg border border-indigo-100">{e.afp}</span>
                                                        <span className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-lg border border-emerald-100 uppercase tracking-tighter truncate max-w-[50px]">{e.previsionSalud === 'ISAPRE' ? (e.isapreNombre || 'ISAPRE') : 'FONASA'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-right tabular-nums">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-bold text-slate-500">{fmt(l.habImponibles.sueldoBase)}</span>
                                                {l.diasTrabajados < 30 && (
                                                    <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full inline-block mt-0.5 w-fit uppercase">
                                                        {l.diasTrabajados} Días
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-5 text-right text-xs font-black text-teal-600 tabular-nums bg-teal-50/20">{fmt(l.habImponibles.semanaCorrida || 0)}</td>
                                        <td className="px-4 py-5 text-right text-xs font-bold text-slate-500 tabular-nums">{fmt(l.habImponibles.gratificacion)}</td>
                                        
                                        {closuresData.map(cl => {
                                            const res = cl.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                            return <td key={cl.modeloRef?._id} className="px-4 py-5 text-right text-xs font-black text-indigo-500 tabular-nums">{fmt(res?.baremoBonus || 0)}</td>;
                                        })}

                                        {(payrollMapping.extraColumns || []).map(col => {
                                            let val = 0;
                                            if (col.source?.startsWith('closure.')) {
                                                const parts = col.source.split('.');
                                                const sId = parts[1];
                                                const modelCl = closuresData.find(m => m.modeloRef?._id === sId);
                                                if (modelCl) {
                                                    const res = modelCl.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                                    val = res?.baremoBonus || 0;
                                                } else {
                                                    val = closuresData.reduce((tot, m) => {
                                                        const res = m.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                                        return tot + (parseInt(res?.[sId]) || 0);
                                                    }, 0);
                                                }
                                            } else {
                                                val = manualValues[`${e.rut}_${col.id}`] || 0;
                                            }
                                            return (
                                                <td key={col.id} className="px-4 py-5 text-right">
                                                    {col.source?.startsWith('closure.') ? (
                                                        <span className="text-xs font-black text-indigo-600 tabular-nums bg-indigo-50/50 px-2 py-1 rounded-lg">{fmt(val)}</span>
                                                    ) : (
                                                        <input type="number" placeholder="0" 
                                                            value={manualValues[`${e.rut}_${col.id}`] || ''}
                                                            onChange={(inp) => setManualValues(prev => ({ ...prev, [`${e.rut}_${col.id}`]: inp.target.value }))}
                                                            className="bg-slate-50 border-none text-right text-xs font-medium text-slate-500 tabular-nums focus:bg-white focus:ring-1 focus:ring-indigo-100 p-1.5 rounded-lg w-20 outline-none transition-all" 
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-5 text-right text-xs font-black text-slate-500 tabular-nums">{fmt(l.habImponibles.bonosPorCodigo?.['1050'] || 0)}</td>
                                        <td className="px-4 py-5 text-right text-xs font-bold text-slate-400 tabular-nums">{fmt(l.habImponibles.horaExtraMonto)}</td>
                                        <td className="px-4 py-5 text-right text-xs font-black text-indigo-600 bg-indigo-50/20 tabular-nums">{fmt(l.habImponibles.subtotal)}</td>
                                        <td className="px-4 py-5 text-right text-xs font-bold text-teal-600 bg-teal-50/20 tabular-nums cursor-help" title={l._breakdownNoImp}>
                                            {fmt(l.habNoImponibles.subtotal)}
                                        </td>
                                        <td className="px-4 py-5 text-right text-xs font-black text-slate-800 tabular-nums">{fmt(l.totalHaberes)}</td>
                                        <td className="px-4 py-5 text-right text-xs text-rose-600/70 font-bold tabular-nums">-{fmt(l.prevision.afp)}</td>
                                        <td className="px-4 py-5 text-right text-xs text-rose-600/70 font-bold tabular-nums">-{fmt(l.prevision.salud)}</td>
                                        <td className="px-4 py-5 text-right text-xs text-rose-600/70 font-bold tabular-nums">-{l.prevision.afc ? fmt(l.prevision.afc) : '0'}</td>
                                        <td className="px-4 py-5 text-right text-xs text-amber-600 font-black tabular-nums">{l.impuestoUnico > 0 ? `-${fmt(l.impuestoUnico)}` : <span className="text-emerald-500 text-[8px] uppercase font-black tracking-tighter">Exento</span>}</td>
                                        <td className="px-4 py-5 text-right text-xs text-slate-400 tabular-nums">-{fmt(l.otrosDescuentos)}</td>
                                        <td className="px-4 py-5 text-right bg-indigo-50/20 tabular-nums"><span className="text-sm font-black text-indigo-900">{fmt(l.liquidoAPagar)}</span></td>
                                        <td className="px-6 py-5 text-center">
                                            <button onClick={() => setSelected(e)} className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all group-hover/row:scale-110 active:scale-90"><Eye size={14} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* ── TOTALES DEL LIBRO ── */}
                        {!loading && filtered.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-800 border-t-4 border-indigo-500 text-white shadow-2xl">
                                    <td className="px-6 py-8 text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap bg-slate-900/50">TOTALES LIBRO</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.sueldoBase || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5 text-teal-400">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.semanaCorrida || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.gratificacion || 0), 0))}</td>
                                    
                                    {/* Subtotales closures y extras DINÁMICOS (NUEVO REQUERIMIENTO) */}
                                    {closuresData.map(cl => {
                                        const sum = filtered.reduce((acc, e) => {
                                            const res = cl.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                            return acc + (res?.baremoBonus || 0);
                                        }, 0);
                                        return <td key={cl.modeloRef?._id} className="px-4 py-8 text-right text-xs font-black tabular-nums text-indigo-200">{fmt(sum)}</td>;
                                    })}
                                    
                                    {(payrollMapping.extraColumns || []).map(col => {
                                        const sum = filtered.reduce((acc, e) => {
                                            let val = 0;
                                            if (col.source?.startsWith('closure.')) {
                                                const sId = col.source.split('.')[1];
                                                const modelCl = closuresData.find(m => m.modeloRef?._id === sId);
                                                if (modelCl) {
                                                    const res = modelCl.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                                    val = res?.baremoBonus || 0;
                                                } else {
                                                    val = closuresData.reduce((tot, m) => {
                                                        const res = m.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                                        return tot + (parseInt(res?.[sId]) || 0);
                                                    }, 0);
                                                }
                                            } else {
                                                val = manualValues[`${e.rut}_${col.id}`] || 0;
                                            }
                                            return acc + parseInt(val || 0);
                                        }, 0);
                                        return <td key={col.id} className="px-4 py-8 text-right text-xs font-black tabular-nums text-indigo-100">{fmt(sum)}</td>;
                                    })}

                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-l border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.bonosPorCodigo?.['1050'] || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.horaExtraMonto || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-indigo-300 tabular-nums bg-indigo-500/10">{fmt(totales.imponible)}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-teal-300 tabular-nums bg-teal-500/10">{fmt(filtered.reduce((s, e) => s + (e._liq?.habNoImponibles?.subtotal || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-base font-black tabular-nums ring-1 ring-white/10">{fmt(totales.bruto)}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-rose-300/80 tabular-nums">-{fmt(filtered.reduce((s, e) => s + (e._liq?.prevision?.afp || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-rose-300/80 tabular-nums">-{fmt(filtered.reduce((s, e) => s + (e._liq?.prevision?.salud || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-rose-300/80 tabular-nums">-{fmt(filtered.reduce((s, e) => s + (e._liq?.prevision?.afc || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-amber-300/80 tabular-nums">-{fmt(filtered.reduce((s, e) => s + (e._liq?.impuestoUnico || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black text-white/50 tabular-nums">-{fmt(filtered.reduce((s, e) => s + (e._liq?.otrosDescuentos || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xl font-black text-emerald-400 tabular-nums bg-emerald-500/20">{fmt(totales.liquido)}</td>
                                    <td className="px-6 py-8" />
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
            {/* ALERT FLOTANTE PREMIUM */}
            {alert && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] min-w-[320px] flex items-center gap-4 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500
                    ${alert.type === 'error'
                        ? 'bg-red-500/90 text-white border-red-400/50 shadow-red-500/20'
                        : 'bg-emerald-500/90 text-white border-emerald-400/50 shadow-emerald-500/20'}`}>
                    <div className="bg-white/20 p-2 rounded-xl shadow-inner">
                        {alert.type === 'error' ? <AlertCircle size={20} /> : <ShieldCheck size={20} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-70">Sistema Corporativo</span>
                        <span className="text-[12px] font-black uppercase tracking-wider mt-1">{alert.msg}</span>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMACIÓN PREMIUM */}
            {confirmModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3 uppercase">{confirmModal.title}</h3>
                            <p className="text-slate-500 text-xs font-bold leading-relaxed px-4">{confirmModal.message}</p>
                        </div>
                        <div className="px-10 pb-10 flex gap-3">
                            <button onClick={() => setConfirmModal(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.action}
                                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NominaRRHH;
