import React, { useState, useEffect, useCallback, useMemo } from 'react'; // Verified build v1.0.3
import {
    CircleDollarSign, Users, User, Calendar, Search, Loader2,
    ChevronDown, ChevronUp, Download, RefreshCw, Eye,
    TrendingUp, TrendingDown, X, Printer, FileText,
    ShieldCheck, Landmark, AlertCircle,
    Building2, Save, Scale, Heart, Award,
    CalendarCheck, CheckCircle2, XCircle, Stethoscope, UserMinus, ClipboardList, ArrowRight
} from 'lucide-react';
import { candidatosApi, nominaApi, rrhhApi, bonosApi, bonosConfigApi, proyectosApi, asistenciaApi } from '../rrhhApi';
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

// ─── Nomenclatura oficial Libro de Remuneraciones (Código del Trabajo) ────────
const DT_CODE_LABELS = {
    '1001': { label: 'Semana Corrida',                    desc: 'Art. 45 C.T. — Promedio rem. variable'    },
    '1003': { label: 'Horas Extraordinarias',             desc: 'Art. 32 C.T. — Recargo 50%'              },
    '1010': { label: 'Sueldo Base',                       desc: 'Art. 42 C.T. — Remuneración pactada'     },
    '1020': { label: 'Gratificación Legal',               desc: 'Art. 50 C.T. — 25% tope 4.75 IMM'        },
    '1030': { label: 'Incentivo / Comisión / Metas',      desc: 'Tratos, ventas o cumplimiento de metas'  },
    '1040': { label: 'Bono Imponible Período',            desc: 'Remuneración variable o fija adicional'   },
    '1041': { label: 'Bonificación de Calidad',           desc: 'Índice RR, AI o auditoría'               },
    '1050': { label: 'Bono de Asistencia / Puntualidad',  desc: 'Cumplimiento asistencia y horarios'       },
    '1060': { label: 'Bono de Antigüedad',                desc: 'Por permanencia y años de servicio'       },
    '2010': { label: 'Viático / Asignación de Terreno',   desc: 'No imponible — Desplazamiento laboral'   },
    '2020': { label: 'Asignación de Movilización',        desc: 'No imponible — Transporte'               },
    '2030': { label: 'Asignación de Colación',            desc: 'No imponible — Alimentación'             },
    '2040': { label: 'Asig. Herramientas / Desgaste',     desc: 'No imponible — Uso de equipos propios'   },
    '2050': { label: 'Asignación de Caja / Otros',        desc: 'No imponible — Asignaciones especiales'  },
};

// ─── Fila del libro de remuneraciones ────────────────────────────────────────
const FilaLibro = ({ concepto, desc, code, monto, isTotal = false, isSubtotal = false, isNegative = false, isExento = false }) => (
    <div className={`flex items-center justify-between gap-4 py-1.5 px-4 rounded-lg transition-colors ${
        isTotal     ? 'bg-slate-900 text-white font-black' :
        isSubtotal  ? 'bg-slate-100 font-bold border border-slate-200' :
        isExento    ? 'opacity-40' :
                      'hover:bg-slate-50/50'
    }`}>
        <div className="flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`fila-libro-concepto text-[10px] font-bold tracking-tight leading-snug ${
                    isTotal ? 'text-white' : isNegative ? 'text-rose-700' : 'text-slate-700'
                }`}>{concepto}</span>
                {code && !isTotal && (
                    <span className="fila-libro-code text-[6px] font-black text-slate-400 bg-slate-50 border border-slate-200 px-1 py-0.5 rounded uppercase tracking-tighter leading-none">{code}</span>
                )}
            </div>
            {desc && !isTotal && !isSubtotal && (
                <span className="fila-libro-desc block text-[7px] font-medium text-slate-400 tracking-wide mt-0.5 leading-none opacity-60 uppercase">{desc}</span>
            )}
        </div>
        <span className={`fila-libro-monto ml-4 text-[10px] font-black tabular-nums shrink-0 ${
            isTotal    ? 'text-white' :
            isNegative ? 'text-rose-600' :
            isSubtotal ? 'text-slate-800' :
                         'text-slate-700'
        }`}>
            {isNegative ? '−' : ''}{fmt(monto)}
        </span>
    </div>
);

// ─── Cabecera de columna estática (reemplaza ColumnMapper) ──────────────────
const ColHeader = ({ label, code, colorClass = 'text-slate-500', bgClass = 'bg-slate-50 border-slate-100' }) => (
    <div className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl ${bgClass} border shadow-sm`}>
        <span className={`text-[9px] font-black uppercase tracking-widest ${colorClass}`}>{code}</span>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight text-center leading-tight">{label}</span>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  MODAL LIQUIDACIÓN INDIVIDUAL (Hoja DT)
// ─────────────────────────────────────────────────────────────────────────────
const ModalLiquidacion = ({ emp, onClose, params }) => {
    const { user } = useAuth();
    const [ajustes, setAjustes] = useState({
        anticipo: 0,
        cuotaSindical: 0,
        otrosDescuentos: 0,
    });

    // AUTO-LOAD desde liquidación ya calculada en nómina
    useEffect(() => {
        if (emp && emp._liq) {
            const l = emp._liq;
            setAjustes({
                anticipo: 0,
                cuotaSindical: 0,
                otrosDescuentos: l.otrosDescuentos || 0,
                bonosPorCodigo: l.habImponibles?.bonosPorCodigo || {},
                horasExtra: l.habImponibles?.horasExtraQty || 0,
                colacion: l.habNoImponibles?.colacion || 0,
                movilizacion: l.habNoImponibles?.movilizacion || 0,
                viaticos: l.habNoImponibles?.viaticos || 0,
            });
        }
    }, [emp]);

    const worker = candidatoToWorkerData(emp);
    const mergedBonosPorCodigo = { ...(ajustes.bonosPorCodigo || emp._liq?.habImponibles?.bonosPorCodigo || {}) };
    const currentAjustes = { ...ajustes, bonosPorCodigo: mergedBonosPorCodigo };
    const liq = calcularLiquidacionReal(worker, currentAjustes, params);


    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto print:p-0 print:bg-white animate-in fade-in duration-300">
            <style>
                {`
                    @media screen {
                        .print-only { display: none !important; }
                    }
                    @media print {
                        @page { size: A4 portrait; margin: 0; }
                        body { margin: 0; padding: 0; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        
                        body * { visibility: hidden; }
                        .print-container, .print-container * { visibility: visible; }
                        .print-container {
                            position: fixed;
                            left: 0; top: 0;
                            width: 210mm;
                            height: 297mm;
                            background: white !important;
                            padding: 10mm !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                        }
                        .no-print { display: none !important; }
                        .print-right-panel {
                            width: 100% !important;
                            padding: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                            border-radius: 0 !important;
                        }
                    }
                    
                    /* Clase especial para la captura html2canvas para evitar distorsiones */
                    .html2canvas-capture-fix {
                        width: 800px !important;
                        transform: none !important;
                        margin: 0 !important;
                        padding: 30px !important;
                        box-shadow: none !important;
                        border: none !important;
                        background: white !important;
                    }
                    .html2canvas-capture-fix .text-3xl { font-size: 20px !important; }
                    .html2canvas-capture-fix .text-[10px] { font-size: 9px !important; }
                    .html2canvas-capture-fix .fila-libro-monto { font-size: 9px !important; }
                    .html2canvas-capture-fix * { font-family: 'Inter', -apple-system, sans-serif !important; }
                `}
            </style>
            <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl my-4 print:shadow-none print:my-0 print:rounded-none print:overflow-visible print-container">
                {/* Header Premium */}
                <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-8 flex items-center justify-between relative overflow-hidden no-print" data-html2canvas-ignore="true">
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
                        <button onClick={() => {
                            const node = document.getElementById('liq-doc-printable');
                            const originalClass = node.className;
                            node.classList.add('html2canvas-capture-fix');
                            
                            import('html2canvas').then(h2c => h2c.default(node, { scale: 3, useCORS: true, logging: false }).then(canvas => {
                                node.className = originalClass; // Restaurar
                                const img = canvas.toDataURL('image/png', 1.0);
                                import('jspdf').then(jsP => {
                                    const pdf = new jsP.jsPDF('p', 'mm', 'a4');
                                    pdf.addImage(img, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                                    pdf.save(`Liquidacion_${emp.fullName.replace(/ /g,'_')}_${params.period}.pdf`);
                                });
                            }));
                        }}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl descargar-pdf-btn">
                            <Download size={16} /> Descargar PDF
                        </button>
                        <button onClick={() => window.print()}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600/50 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border border-white/10 active:scale-95 shadow-xl">
                            <Printer size={16} /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-3 bg-white/10 hover:bg-rose-500 text-white rounded-2xl transition-all backdrop-blur-md border border-white/10 active:scale-95">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/50 print:p-0 print:grid-cols-1 print:bg-white print:gap-0">
                    {/* LEFT (4 cols): Fuentes de Datos + Descuentos */}
                    <div className="lg:col-span-4 space-y-4 no-print print-left-panel">

                        {/* PANEL FUENTES DE DATOS — READ ONLY */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-2">
                                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Fuentes de Datos — {params.period}</span>
                            </div>
                            <div className="p-5 space-y-4">

                                {/* FICHA */}
                                <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-slate-700 rounded-lg"><User size={10} className="text-white" /></div>
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Ficha del Colaborador</span>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            ['Sueldo Pactado', fmt(emp.sueldoBase || 0)],
                                            ['AFP', (emp.afp || 'No informada').toUpperCase()],
                                            ['Salud', (emp.previsionSalud || 'FONASA').toUpperCase()],
                                            ['Contrato', (emp.contractType || 'Indefinido').toUpperCase()],
                                        ].map(([label, val]) => (
                                            <div key={label} className="flex justify-between items-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
                                                <span className="text-[9px] font-black text-slate-700">{val}</span>
                                            </div>
                                        ))}
                                        {liq.habNoImponibles.colacion > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Colación</span>
                                                <span className="text-[9px] font-black text-teal-600">{fmt(liq.habNoImponibles.colacion)}</span>
                                            </div>
                                        )}
                                        {liq.habNoImponibles.movilizacion > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Movilización</span>
                                                <span className="text-[9px] font-black text-teal-600">{fmt(liq.habNoImponibles.movilizacion)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* BONOS VARIABLES — CIERRES */}
                                <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/60">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-indigo-600 rounded-lg"><TrendingUp size={10} className="text-white" /></div>
                                        <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest">Bonos Variables — Cierres</span>
                                    </div>
                                    {emp._bonosAgrupados && Object.entries(emp._bonosAgrupados).filter(([code, amt]) => code.startsWith('1') && amt > 0 && !['1010','1001','1020','1003'].includes(code)).length > 0 ? (
                                        <div className="space-y-1.5">
                                            {Object.entries(emp._bonosAgrupados)
                                                .filter(([code, amt]) => code.startsWith('1') && amt > 0 && !['1010','1001','1020','1003'].includes(code))
                                                .map(([code, amt]) => (
                                                    <div key={code} className="flex justify-between items-center">
                                                        <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-tighter">{DT_CODE_LABELS[code]?.label || `Bono ${code}`}</span>
                                                        <span className="text-[10px] font-black text-indigo-700">{fmt(amt)}</span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    ) : (
                                        <p className="text-[8px] text-slate-400 font-bold italic">Sin bonos variables para este período</p>
                                    )}
                                </div>

                                {/* ASISTENCIA */}
                                <div className="p-4 bg-teal-50/40 rounded-2xl border border-teal-100/60">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="p-1.5 bg-teal-600 rounded-lg"><CalendarCheck size={10} className="text-white" /></div>
                                        <span className="text-[9px] font-black text-teal-700 uppercase tracking-widest">Asistencia</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Días Trabajados</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black text-teal-700">{liq.diasTrabajados}</span>
                                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${emp._asistencia?.diasTrabajados !== undefined ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {emp._asistencia?.diasTrabajados !== undefined ? 'Sync' : 'Estándar'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">HE Aprobadas</span>
                                            <span className="text-[10px] font-black text-indigo-600">{emp._asistencia?.horasExtraAprobadas || 0} hrs</span>
                                        </div>
                                        {(emp._asistencia?.diasAusente || 0) > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Ausencias</span>
                                                <span className="text-[10px] font-black text-rose-500">{emp._asistencia.diasAusente} días</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* DESCUENTOS ADICIONALES — ÚNICO EDITABLE */}
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 bg-rose-50/60 border-b border-rose-100/60 flex items-center gap-2">
                                <div className="p-1.5 bg-rose-500 rounded-lg"><TrendingDown size={10} className="text-white" /></div>
                                <span className="text-[10px] font-black text-rose-700 uppercase tracking-[0.2em]">Descuentos Adicionales</span>
                            </div>
                            <div className="p-5 grid grid-cols-1 gap-4">
                                {[
                                    ['Anticipo Sueldo', 'anticipo'],
                                    ['Cuota Sindical', 'cuotaSindical'],
                                    ['Otros Descuentos', 'otrosDescuentos'],
                                ].map(([label, key]) => (
                                    <div key={key}>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">{label}</label>
                                        <input type="number" min="0" value={ajustes[key] || 0}
                                            onChange={e => setAjustes(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                                            className="w-full py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-rose-100/50 transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT (8 cols): Documento Liquidación */}
                    <div id="liq-doc-printable" className="lg:col-span-8 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none print:overflow-visible print-right-panel">

                        {/* Banda superior de color */}
                        <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-teal-500" />

                        <div className="p-10 print:p-8">
                            {/* ── Membrete ── */}
                            <div className="flex justify-between items-start mb-8 pb-7 border-b-2 border-slate-100">
                                <div>
                                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-1">Documento Oficial</p>
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Liquidación de Sueldo</h1>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                            <Calendar size={9} /> {params.period}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{liq.diasTrabajados} días trabajados</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {user?.empresaRef?.logo
                                        ? <img src={user.empresaRef.logo} alt="logo" className="h-10 mb-2 ml-auto object-contain" />
                                        : <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center ml-auto mb-2 shadow-lg shadow-indigo-100">
                                            <span className="text-white font-black text-sm">{(user?.empresaRef?.nombre || 'E')[0]}</span>
                                          </div>
                                    }
                                    <h2 className="text-sm font-black text-slate-800 uppercase leading-tight">{user?.empresaRef?.nombre || 'Nuestra Empresa'}</h2>
                                    <p className="text-[8px] font-medium text-slate-400 uppercase mt-0.5">{user?.empresaRef?.giroComercial || 'Servicios Generales'}</p>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">RUT {user?.empresaRef?.rut || '---'}</p>
                                </div>
                            </div>

                            {/* ── Ficha del Trabajador (COMPACTA) ── */}
                            <div className="grid grid-cols-4 gap-x-6 gap-y-3 mb-8 px-4 py-5 bg-slate-50/50 rounded-2xl border border-slate-100">
                                {[
                                    { label: 'Nombre Completo',  value: emp.fullName, colSpan: 'col-span-2' },
                                    { label: 'RUT',              value: formatRut(emp.rut) },
                                    { label: 'Cargo',            value: emp.position || '—' },
                                    { label: 'AFP',              value: (emp.afp || 'No informada').toUpperCase() },
                                    { label: 'Salud',            value: (emp.previsionSalud || 'FONASA').toUpperCase() },
                                    { label: 'Contrato',         value: (emp.contractType || 'Indefinido').toUpperCase() },
                                    { label: 'Periodo',          value: params.period },
                                    { label: 'Días Trab.',       value: liq.diasTrabajados },
                                ].map(({ label, value, colSpan }) => (
                                    <div key={label} className={colSpan || ''}>
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                                        <p className="text-[10px] font-black text-slate-800 uppercase truncate">{value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* ── Haberes y Descuentos (EJECUTIVO) ── */}
                            <div className="grid grid-cols-2 gap-8 mb-8 items-start">

                                {/* COLUMNA IZQUIERDA: HABERES */}
                                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex-1">
                                    <div className="pb-3 mb-4 border-b border-emerald-200 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-emerald-700 uppercase tracking-[0.2em]">Haberes Mensuales</span>
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                    </div>
                                    
                                    <div className="space-y-1.5">
                                        <FilaLibro concepto="Sueldo Base" code="1010" monto={liq.habImponibles.sueldoBase} />
                                        <FilaLibro concepto="Gratificación Legal" code="1020" monto={liq.habImponibles.gratificacion} />
                                        {liq.habImponibles.semanaCorrida > 0 && <FilaLibro concepto="Semana Corrida" code="1001" monto={liq.habImponibles.semanaCorrida} />}
                                        {liq.habImponibles.horaExtraMonto > 0 && <FilaLibro concepto="Horas Extraordinarias" code="1003" monto={liq.habImponibles.horaExtraMonto} />}
                                        
                                        {Object.entries(liq.habImponibles.bonosPorCodigo || {})
                                            .filter(([code, amount]) => code.startsWith('1') && amount > 0)
                                            .map(([code, amount]) => (
                                                <FilaLibro key={code} concepto={DT_CODE_LABELS[code]?.label || 'Bono Imponible'} code={code} monto={amount} />
                                            ))
                                        }

                                        <div className="pt-2 mt-4 border-t border-slate-200 space-y-1.5">
                                            {liq.habNoImponibles.colacion > 0 && <FilaLibro concepto="Asignación Colación" code="2030" monto={liq.habNoImponibles.colacion} />}
                                            {liq.habNoImponibles.movilizacion > 0 && <FilaLibro concepto="Asignación Movilización" code="2020" monto={liq.habNoImponibles.movilizacion} />}
                                            {liq.habNoImponibles.asignacionFamiliar > 0 && <FilaLibro concepto="Asig. Familiar" code="2000" monto={liq.habNoImponibles.asignacionFamiliar} />}
                                            {Object.entries(mergedBonosPorCodigo)
                                                .filter(([code, amount]) => code.startsWith('2') && amount > 0)
                                                .map(([code, amount]) => (
                                                    <FilaLibro key={code} concepto={DT_CODE_LABELS[code]?.label || 'Asig. No Imponible'} code={code} monto={amount} />
                                                ))
                                            }
                                        </div>

                                        <div className="pt-4">
                                            <FilaLibro concepto="Total Haberes" monto={liq.totalHaberes} isTotal />
                                        </div>
                                    </div>
                                </div>

                                {/* COLUMNA DERECHA: DESCUENTOS */}
                                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex-1">
                                    <div className="pb-3 mb-4 border-b border-rose-200 flex items-center justify-between">
                                        <span className="text-[9px] font-black text-rose-700 uppercase tracking-[0.2em]">Descuentos Legales</span>
                                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                                    </div>

                                    <div className="space-y-1.5">
                                        <FilaLibro concepto={`AFP ${emp.afp || 'HABITAT'} (${TASAS_AFP[(emp.afp || 'HABITAT').toUpperCase()] || '11.27'}%)`} code="7000" monto={liq.prevision.afp} isNegative />
                                        <FilaLibro concepto={`Salud ${emp.previsionSalud || 'FONASA'} (${emp.previsionSalud === 'ISAPRE' ? 'Plan UF' : '7%'})`} code="7001" monto={liq.prevision.salud} isNegative />
                                        {liq.prevision.afc > 0 && <FilaLibro concepto="Seguro Cesantía (AFC) (0.6%)" code="7002" monto={liq.prevision.afc} isNegative />}
                                        {liq.prevision.excesoIsapre > 0 && <FilaLibro concepto="Adicional Isapre" code="7003" monto={liq.prevision.excesoIsapre} isNegative />}
                                        
                                        {liq.impuestoUnico > 0 && (
                                            <div className="pt-2 mt-4 border-t border-slate-200">
                                                <FilaLibro concepto="Impuesto 2ª Categoría" code="6000" monto={liq.impuestoUnico} isNegative />
                                            </div>
                                        )}

                                        {liq.otrosDescuentos > 0 && (
                                            <div className="pt-2 mt-4 border-t border-slate-200">
                                                <FilaLibro concepto="Anticipos / Varios" monto={liq.otrosDescuentos} isNegative />
                                            </div>
                                        )}

                                        <div className="pt-4">
                                            <FilaLibro concepto="Total Descuentos" monto={liq.totalDescuentos} isSubtotal />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Alcance Líquido — Profesional ── */}
                            <div className="bg-slate-900 rounded-3xl p-6 flex items-center justify-between relative overflow-hidden mb-8 border-b-2 border-indigo-500">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                                <div>
                                    <p className="text-[8px] font-black text-indigo-300 uppercase tracking-[0.4em] mb-1">Alcance Líquido a Pagar</p>
                                    <p className="text-[9px] font-medium text-slate-400">Páguese la cantidad indicada al trabajador titular.</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-white tabular-nums tracking-tighter leading-none">{fmt(liq.liquidoAPagar)}</p>
                                    <div className="flex items-center gap-3 justify-end mt-2">
                                        <div className="px-2 py-0.5 border border-slate-700 rounded text-[7px] font-bold text-slate-400 uppercase tracking-widest">Haberes {fmt(liq.totalHaberes)}</div>
                                        <div className="px-2 py-0.5 border border-slate-700 rounded text-[7px] font-bold text-slate-400 uppercase tracking-widest">Desc. {fmt(liq.totalDescuentos)}</div>
                                    </div>
                                </div>
                            </div>

                            {/* ── Firma y Glosa Legal ── */}
                            <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-8 items-end">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Declaración del Trabajador</p>
                                    <p className="text-[8px] font-medium text-slate-400 italic leading-relaxed">
                                        Certifico que he recibido de <span className="font-black not-italic text-slate-600">{user?.empresaRef?.nombre || 'el Empleador'}</span>, a mi total satisfacción, el saldo líquido indicado en esta liquidación, sin tener cargo ni reclamo alguno que formular.
                                    </p>
                                    <p className="text-[7px] font-mono text-slate-300 mt-2 tracking-widest">ID: {emp._id?.slice(-16)?.toUpperCase()}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-full h-px bg-slate-200" />
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Firma y Timbre Empleador</p>
                                    <div className="w-full h-px bg-slate-200 mt-4" />
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Firma del Trabajador</p>
                                    <p className="text-[7px] text-slate-300 font-medium">{emp.fullName}</p>
                                </div>
                            </div>

                            {/* ── Costo Empresa (solo admin) ── */}
                            <div className="mt-8 p-5 bg-slate-50 rounded-3xl border border-slate-100 no-print" data-html2canvas-ignore="true">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Costo Total Empresa (Patronal)</span>
                                        <p className="text-[7px] font-medium text-slate-400 mt-0.5">Aportes empleador — No visible al trabajador</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-xl border border-indigo-200">PRIVADO</span>
                                        <span className="text-sm font-black text-indigo-700">{fmt(liq.costoTotalEmpresa)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'SIS',              val: liq.patronales.sis,            sub: 'Seguro Invalidez' },
                                        { label: 'Mutual',           val: liq.patronales.mutual,         sub: 'Accidentes trabajo' },
                                        { label: 'AFC Empleador',    val: liq.patronales.afc,            sub: '2.4% contrato indef.' },
                                        { label: 'Exp. de Vida',     val: liq.patronales.expectativaVida, sub: 'Longevidad 2026' },
                                    ].map(({ label, val, sub }) => (
                                        <div key={label} className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                                            <p className="text-[13px] font-black text-slate-800 tabular-nums">{fmt(val)}</p>
                                            <p className="text-[7px] text-slate-300 mt-0.5">{sub}</p>
                                        </div>
                                    ))}
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

/**
 * Calcula estadísticas de calendario para un periodo YYYY-MM
 * Útil para regularizar Semana Corrida y Proporcionalidad
 */
const calculateMonthStats = (periodKey) => {
    if (!periodKey) return { diasHabiles: 25, domingosFestivos: 5 };
    const [year, month] = periodKey.split('-').map(Number);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    
    let sundays = 0;
    let workDays = 0; // Lunes a Sábado (Estándar Operativo)
    
    for (let d = 1; d <= lastDayOfMonth; d++) {
        const dayOfWeek = new Date(year, month - 1, d).getDay();
        if (dayOfWeek === 0) sundays++; // Domingo
        else workDays++; // Lun-Sab
    }
    
    return { 
        diasHabiles: workDays, 
        domingosFestivos: sundays 
    };
};

// ─────────────────────────────────────────────────────────────────────────────
//  NÓMINA PRINCIPAL — LIBRO DE REMUNERACIONES
// ─────────────────────────────────────────────────────────────────────────────
const NominaRRHH = () => {
    const { ufValue, params: indicParams, loading: indLoading, lastSync } = useIndicadores();

    const [nomina, setNomina] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCliente, setFilterCliente] = useState('');
    const [filterProyecto, setFilterProyecto] = useState('');
    const [filterStatus, setFilterStatus] = useState('Operativo'); // Operativo, Finiquitado, Todos
    const [filterCargo, setFilterCargo] = useState('');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    const [bonosConsolidados, setBonosConsolidados] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closuresData, setClosuresData] = useState([]);
    const [manualValues, setManualValues] = useState({}); // { 'RUT_dias_trabajados': value }

    const [periodStats, setPeriodStats] = useState({
        diasHabiles: 25,
        domingosFestivos: 5
    });

    const [productionStats, setProductionStats] = useState({
        diasHabiles: 25,
        domingosFestivos: 5
    });

    // ── Sincronización de Asistencia Real ──────────────────────────────────────
    const [asistenciaSyncData, setAsistenciaSyncData] = useState({}); // { candidatoId: { diasTrabajados, horasExtraAprobadas, calificaBono } }
    const [syncingAsistencia, setSyncingAsistencia] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [syncPreview, setSyncPreview] = useState([]);
    const [downloadingMassive, setDownloadingMassive] = useState(false);

    // --- DESCARGA MASIVA ---

    const handleMassiveDownload = async () => {
        if (!filtered.length) return;
        setDownloadingMassive(true);
        setAlert({ type: 'info', msg: 'Iniciando generación masiva... No cierres la pestaña.' });
        
        try {
            const h2c = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            for (let i = 0; i < filtered.length; i++) {
                const empData = filtered[i];
                setSelected(empData);
                // Esperamos un poco a que el modal cargue y renderice
                await new Promise(r => setTimeout(r, 600));
                
                const node = document.getElementById('liq-doc-printable');
                if (node) {
                    const originalClass = node.className;
                    node.classList.add('html2canvas-capture-fix');
                    const canvas = await h2c(node, { scale: 2.5, useCORS: true, logging: false });
                    node.className = originalClass; // Restaurar
                    
                    const img = canvas.toDataURL('image/png', 0.9);
                    if (i > 0) pdf.addPage();
                    pdf.addImage(img, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                }
                setAlert({ type: 'info', msg: `Generando: ${i+1} de ${filtered.length}...` });
            }
            
            pdf.save(`NOMINA_MASIVA_${period}.pdf`);
            setSelected(null);
            setAlert({ type: 'success', msg: '✓ Descarga masiva completada exitosamente.' });
        } catch (e) {
            console.error('Error en descarga masiva:', e);
            setAlert({ type: 'error', msg: 'Error durante la generación masiva.' });
        } finally {
            setDownloadingMassive(false);
        }
    };


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

            const [resStaff, resBonos, resConfig, resProyectos, resAsistencia] = await Promise.all([
                candidatosApi.getAll(),
                bonosApi.getClosure(prevYear, prevMonth).catch(() => ({ data: [] })),
                bonosConfigApi.getAll().catch(() => ({ data: [] })),
                proyectosApi.getAll().catch(() => ({ data: [] })),
                asistenciaApi.getResumenPeriodo(monthNum, yearNum).catch(() => ({ data: [] })),
            ]);
            setNomina(resStaff.data || []);
            setClosuresData(resBonos.data || []);
            setBonosConfig(resConfig.data || []);
            setProyectos(resProyectos.data || []);

            // Calcular automáticamente estadísticas de calendario para el mes de producción (Desfasado)
            const autoStats = calculateMonthStats(`${prevYear}-${String(prevMonth).padStart(2, '0')}`);
            setProductionStats(autoStats);

            // También actualizamos el periodo de pago actual
            const currentStats = calculateMonthStats(`${yearNum}-${String(monthNum).padStart(2, '0')}`);
            setPeriodStats(currentStats);

        } catch (e) {
            console.error('❌ Error fetching payroll data:', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchNomina();
    }, [fetchNomina]);

    const [auditResults, setAuditResults] = useState([]);
    const [showAuditPanel, setShowAuditPanel] = useState(false);
    const [autoRegularizeMode, setAutoRegularizeMode] = useState(true); // Activo por defecto

    // --- AUTO-FETCH ASISTENCIA ---
    useEffect(() => {
        if (!period) return;
        
        const autoSync = async () => {
            try {
                const [y, m] = period.split('-');
                const res = await asistenciaApi.getResumenPeriodo(m, y);
                const map = {};
                res.data.forEach(r => {
                    map[r.empId || r.candidatoId] = {
                        diasTrabajados: r.diasTrabajados,
                        horasExtraAprobadas: r.horasExtraAprobadas,
                        calificaBono: r.calificaBono,
                        diasAusente: r.diasAusente,
                        diasPresente: r.diasPresente,
                        diasLicencia: r.diasLicencia,
                        diasTardanza: r.diasTardanza,
                        horasNormales: r.horasNormalesTrabajadas,
                    };
                });
                setAsistenciaSyncData(map);
            } catch (error) {
                console.error("Error auto-fetching attendance:", error);
            }
        };
        
        autoSync();
    }, [period]);

    // --- AUDITORÍA INTELIGENTE ---
    const runAudit = useCallback((data) => {
        const issues = [];
        data.forEach(e => {
            const l = e._liq;
            const c = e;

            // 1. Detección de sobrepago a finiquitados
            if (c.status === 'Finiquitado' && l.diasTrabajados === 30) {
                issues.push({ id: c.rut, type: 'critical', msg: 'Finiquitado con sueldo completo. Verificar proporcionalidad.', category: 'Financiero' });
            }

            // 2. Faltantes de previsión
            if (!c.afp || !c.previsionSalud) {
                issues.push({ id: c.rut, type: 'warning', msg: 'Falta información previsional/salud. Usando defaults.', category: 'Admin' });
            }

            // 3. Inconsistencias de asistencia (registros manuales vs automáticos)
            if (e._asistencia?.diasTrabajados !== undefined && l.diasTrabajados !== e._asistencia.diasTrabajados) {
                issues.push({ id: c.rut, type: 'info', msg: 'Diferencia entre asistencia y días pagados (ajuste manual).', category: 'Sync' });
            }
        });
        setAuditResults(issues);
    }, []);

    const groupBonusesByCode = useCallback((c) => {
        const bag = {};
        let variableBaseSC = 0; // Solo lo devengado por día (variable) genera Semana Corrida

        // 1. Bonos fijos de la Ficha (No generan semana corrida)
        (c.bonuses || []).forEach(b => {
            const code = b.codigoDT || b.tipoBonoRef?.codigo || (b.isImponible !== false ? '1040' : '2040');
            const amount = (parseInt(b.amount) || 0);
            bag[code] = (bag[code] || 0) + amount;
        });

        // 2. Bonos de Cierre TOA (Variables por producción — generan SC si son imponibles)
        closuresData.forEach(closure => {
            const defaultCode = closure.modeloRef?.tipoBonoRef?.codigo || '1030';
            const res = closure.calculos?.find(b =>
                (b.tecnicoId === c.idRecursoToa || b.tecnicoId === c.toaId) ||
                (b.rut === c.rut) ||
                (normalize(b.nombre) === normalize(c.fullName))
            );
            if (res) {
                const bonusVal = (res.baremoBonus || 0);
                bag[defaultCode] = (bag[defaultCode] || 0) + bonusVal;
                if (defaultCode.startsWith('1')) variableBaseSC += bonusVal;
                if (res.asistenciaBonus) bag['1050'] = (bag['1050'] || 0) + (res.asistenciaBonus || 0);
            }
        });

        return { bag, variableBaseSC };
    }, [closuresData]);

    const processed = useMemo(() => {
        const [yStr, mStr] = period.split('-');
        const y = parseInt(yStr);
        const m = parseInt(mStr);
        const firstDayOfPeriod = new Date(y, m - 1, 1);
        const lastDayOfPeriod  = new Date(y, m, 0);

        const result = nomina.filter(c => {
            // 1. Filtrar por Estado (UI)
            if (filterStatus === 'Operativo' && c.status !== 'Contratado') return false;
            if (filterStatus === 'Finiquitado' && c.status !== 'Finiquitado') return false;
            
            // 2. Determinar si participó en el periodo (Vivió laboralmente en el mes)
            if (!c.contractStartDate) return true; 
            const startDate = new Date(c.contractStartDate);
            if (startDate > lastDayOfPeriod) return false; 

            const endDate = c.fechaFiniquito ? new Date(c.fechaFiniquito) : (c.contractEndDate ? new Date(c.contractEndDate) : null);
            if (endDate && endDate < firstDayOfPeriod) return false; 

            return true;
        }).map(c => {
            const worker = candidatoToWorkerData(c);
            
            const licenciasMes = (c.vacaciones || [])
                .filter(v => v.estado === 'Aprobado' && v.tipo === 'Licencia Médica')
                .reduce((tot, v) => {
                    const vStart = new Date(v.fechaInicio);
                    const vEnd   = new Date(v.fechaFin);
                    const overlapStart = new Date(Math.max(vStart, firstDayOfPeriod));
                    const overlapEnd   = new Date(Math.min(vEnd, lastDayOfPeriod));
                    if (overlapStart <= overlapEnd) {
                        const diffTime = Math.abs(overlapEnd - overlapStart);
                        return tot + (Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
                    }
                    return tot;
                }, 0);

            const { bag: bonosAgrupados, variableBaseSC } = groupBonusesByCode(c);
            const cIdStr = c._id?.toString();
            const syncEntry = asistenciaSyncData[cIdStr] || (c.rut ? asistenciaSyncData[c.rut] : null);

            const manualDias = manualValues[`${c.rut}_dias_trabajados`];
            const ajustes = {
                bonosPorCodigo: bonosAgrupados,
                variableBaseSC,
                horasExtra: syncEntry?.horasExtraAprobadas || 0,
                diasTrabajadosReal: manualDias !== undefined ? Number(manualDias) : ((syncEntry !== undefined && syncEntry !== null) ? syncEntry.diasTrabajados : undefined),
                diasLicencia: Math.max(licenciasMes, syncEntry?.diasLicencia || 0),
                diasAusente: syncEntry?.diasAusente || 0,
                diasHabiles: productionStats.diasHabiles,      // Semana Corrida usa Mes Producción
                domingosFestivos: productionStats.domingosFestivos // Semana Corrida usa Mes Producción
            };

            const liq = calcularLiquidacionReal(worker, ajustes, params);
            
            const projectIdKey = c.projectId?._id?.toString() || c.projectId?.toString() || '';
            const proyectoData  = proyectos.find(p => p._id?.toString() === projectIdKey || p._id === projectIdKey);
            
            return {
                ...c,
                _worker: worker,
                _liq: liq,
                _bonosAgrupados: bonosAgrupados,
                _asistencia: syncEntry || {},
                _clienteId: proyectoData?.cliente?._id?.toString() || proyectoData?.cliente?.toString() || 'sin_cliente',
                _clienteNombre: proyectoData?.cliente?.nombre || '—',
                _proyectoNombre: proyectoData?.nombreProyecto || proyectoData?.projectName || c.projectName || '—',
            };
        });

        setTimeout(() => runAudit(result), 100);
        return result;
    }, [nomina, proyectos, closuresData, params, manualValues, periodStats, asistenciaSyncData, filterStatus, runAudit, groupBonusesByCode]);

    const handleExportTable = () => {
        if (!filtered.length) return;
        
        const data = filtered.map(e => {
            const l = e._liq;
            const row = {
                'RUT': e.rut,
                'Colaborador': e.fullName,
                'Estado': e.status,
                'Cargo': e.position || e.cargo || '—',
                'Cliente': e._clienteNombre,
                'Proyecto': e._proyectoNombre,
                'Pres.': e._asistencia?.diasPresente || 0,
                'Aus.': e._asistencia?.diasAusente || 0,
                'Lic.': e._asistencia?.diasLicencia || 0,
                'Término': e.contractEndDate || e.fechaFiniquito ? new Date(e.contractEndDate || e.fechaFiniquito).toLocaleDateString() : '—',
                'Días Trab.': l.diasTrabajados,
                'H. Pagadas': ((e._asistencia?.horasNormales || 0) + (e._asistencia?.horasExtraAprobadas || 0)).toFixed(1),
                'Sueldo Base': l.habImponibles.sueldoBase,
                'Semana Corrida': l.habImponibles.semanaCorrida || 0,
                'Gratificación': l.habImponibles.gratificacion,
            };

            // Bonos dinámicos de cierres
            closuresData.forEach(cl => {
                const res = cl.calculos?.find(b => 
                    (b.tecnicoId && (b.tecnicoId === e.idRecursoToa || b.tecnicoId === e.toaId)) || 
                    (b.rut && b.rut === e.rut) || 
                    (normalize(b.nombre) === normalize(e.fullName))
                );
                row[cl.modeloRef?.nombre || 'Bono'] = res?.baremoBonus || 0;
            });

            row['Bono Asistencia'] = l.habImponibles.bonosPorCodigo?.['1050'] || 0;
            row['H. Extra $'] = l.habImponibles.horaExtraMonto;
            row['Total Imponible'] = l.habImponibles.subtotal;
            row['No Imponible'] = l.habNoImponibles.subtotal;
            row['Total Haberes'] = l.totalHaberes;
            row['AFP'] = l.prevision.afp;
            row['Salud'] = l.prevision.salud;
            row['AFC'] = l.prevision.afc || 0;
            row['Impuesto Único'] = l.impuestoUnico;
            row['Otros Descuentos'] = l.otrosDescuentos;
            row['Líquido a Pagar'] = l.liquidoAPagar;
            
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Nómina Detalle");
        XLSX.writeFile(wb, `Nomina_Completa_${period}.xlsx`);
    };

    const handleManualUpdate = (rut, field, val) => {
        const key = `${rut}_${field}`;
        setManualValues(prev => ({ ...prev, [key]: val === '' ? undefined : val }));
    };

    const handleSyncAsistencia = async () => {
        if (!period) return;
        setSyncingAsistencia(true);
        try {
            const [y, m] = period.split('-');
            const res = await asistenciaApi.getResumenPeriodo(m, y);
            
            const preview = processed.map(emp => {
                const raw = res.data.find(r => (r.empId === emp._worker?._id) || (r.candidatoId === emp._id) || (r.rut === emp.rut));
                return {
                    empId: emp._id,
                    rut: emp.rut,
                    nombre: emp.fullName,
                    diasActual: emp._liq?.diasTrabajados || 30,
                    diasNuevo: raw ? raw.diasTrabajados : (emp._liq?.diasTrabajados || 30),
                    heNuevo: raw ? raw.horasExtraAprobadas : 0,
                    diasAusente: raw ? raw.diasAusente : 0,
                    diasTardanza: raw ? raw.diasTardanza : 0,
                    calificaBono: raw ? raw.calificaBono : false
                };
            });

            setSyncPreview(preview);
            setShowSyncModal(true);
            
            // También guardamos en el estado de fondo para cálculos reactivos
            const map = {};
            res.data.forEach(r => {
                map[r.empId || r.candidatoId] = {
                    diasTrabajados: r.diasTrabajados,
                    horasExtraAprobadas: r.horasExtraAprobadas,
                    calificaBono: r.calificaBono,
                    diasAusente: r.diasAusente,
                    diasPresente: r.diasPresente,
                    diasLicencia: r.diasLicencia,
                    diasTardanza: r.diasTardanza,
                    horasNormales: r.horasNormalesTrabajadas,
                };
            });
            setAsistenciaSyncData(map);
        } catch (e) {
            console.error('Error syncing attendance:', e);
            setAlert({ type: 'error', msg: 'Error al sincronizar datos de asistencia.' });
        } finally {
            setSyncingAsistencia(false);
        }
    };

    const handleConfirmSync = () => {
        setShowSyncModal(false);
        setAlert({ type: 'success', msg: '✓ Sincronización aplicada — datos de asistencia activos.' });
        setTimeout(() => setAlert(null), 3000);
    };


    const handleExportLRE = () => {
        if (!processed.length) return;
        const [y, m] = period.split('-');

        // 1. Recopilar todos los códigos DT usados en todos los trabajadores
        const allCodes = new Set();
        processed.forEach(e => Object.keys(e._bonosAgrupados || {}).forEach(c => allCodes.add(c)));

        // 2. Mapa de etiquetas por código
        const codeLabels = {};
        Object.entries(DT_CODE_LABELS).forEach(([code, { label }]) => { codeLabels[code] = label; });

        const impCodes = [...allCodes].filter(c => c.startsWith('1')).sort();
        const noImpCodes = [...allCodes].filter(c => c.startsWith('2')).sort();

        // 3. Construir filas
        const rows = processed.map(e => {
            const l = e._liq;
            const b = e._bonosAgrupados || {};

            const row = {};

            // — Identificación —
            row['RUT']                  = e.rut || '';
            row['Nombre Completo']      = e.fullName || '';
            row['AFP']                  = e._worker?.afp || e.afp || '';
            row['Previsión Salud']      = e._worker?.previsionSalud || e.previsionSalud || '';
            row['Tipo Contrato']        = e._worker?.contractType || e.contractType || '';
            row['Días Trabajados']      = l.diasTrabajados;
            row['Días Presentes']       = e._asistencia?.diasPresente || 0;
            row['Días Ausentes']        = e._asistencia?.diasAusente || 0;
            row['Días Licencia']        = e._asistencia?.diasLicencia || 0;
            row['Término Contrato']     = (e.contractEndDate || e.fechaFiniquito) ? new Date(e.contractEndDate || e.fechaFiniquito).toLocaleDateString() : 'Activo';

            // — Haberes Imponibles —
            row['1010 - Sueldo Base']        = l.habImponibles.sueldoBase;
            row['1020 - Gratificación']      = l.habImponibles.gratificacion;
            row['1001 - Semana Corrida']     = l.habImponibles.semanaCorrida;
            row['Horas Extra']               = l.habImponibles.horaExtraMonto;
            row['Bonos Fijos (Ficha)']       = l.habImponibles.bonosInyectados;

            // Columnas dinámicas de bonos imponibles (1xxx)
            impCodes.forEach(code => {
                row[`${code} - ${codeLabels[code] || 'Bono ' + code}`] = b[code] || 0;
            });

            row['TOTAL IMPONIBLES'] = l.habImponibles.subtotal;

            // — Haberes No Imponibles —
            row['Asignación Familiar'] = l.habNoImponibles.asignacionFamiliar;
            row['Colación']            = l.habNoImponibles.colacion;
            row['Movilización']        = l.habNoImponibles.movilizacion;
            row['Bonos Fijos No Imp.'] = l.habNoImponibles.bonosInyectados;

            // Columnas dinámicas de bonos no imponibles (2xxx)
            noImpCodes.forEach(code => {
                row[`${code} - ${codeLabels[code] || 'Bono ' + code}`] = b[code] || 0;
            });

            row['TOTAL NO IMPONIBLES'] = l.habNoImponibles.subtotal;
            row['TOTAL HABERES']       = l.totalHaberes;

            // — Descuentos Previsionales —
            row['Descuento AFP']       = l.prevision.afp;
            row['Descuento Salud']     = l.prevision.salud;
            row['AFC Trabajador']      = l.prevision.afc;
            row['TOTAL PREVISIÓN']     = l.prevision.subtotal;

            // — Impuesto —
            row['Base Tributable']         = l.baseTributable;
            row['Tramo Impuesto']          = l.tramoImpuesto;
            row['Impuesto Único 2ª Cat.']  = l.impuestoUnico;

            // — Otros —
            row['Otros Descuentos'] = l.otrosDescuentos;
            row['TOTAL DESCUENTOS'] = l.totalDescuentos;
            row['LÍQUIDO A PAGAR']  = l.liquidoAPagar;

            // — Costo Empresa —
            row['SIS (Empresa)']       = l.patronales.sis;
            row['Mutual (Empresa)']    = l.patronales.mutual;
            row['AFC Patronal']        = l.patronales.afc;
            row['Expectativa de Vida'] = l.patronales.expectativaVida;
            row['COSTO TOTAL EMPRESA'] = l.costoTotalEmpresa;

            return row;
        });

        // 4. Exportar como .xlsx
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `LRE ${m}-${y}`);
        XLSX.writeFile(wb, `LRE_Completo_${m}_${y}.xlsx`);
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

    // ── Opciones de filtros dinámicos ──────────────────────────────────────────
    const availableClientes = useMemo(() => {
        const seen = new Set();
        const list = [];
        processed.forEach(e => {
            if (e._clienteId && !seen.has(e._clienteId)) {
                seen.add(e._clienteId);
                list.push({ id: e._clienteId, nombre: e._clienteNombre });
            }
        });
        return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [processed]);

    const availableProyectos = useMemo(() => {
        const seen = new Set();
        const list = [];
        processed.forEach(e => {
            if (!e._proyectoNombre || e._proyectoNombre === '—') return;
            if (!seen.has(e._proyectoNombre)) {
                seen.add(e._proyectoNombre);
                list.push({ nombre: e._proyectoNombre, clienteId: e._clienteId });
            }
        });
        return list.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [processed]);

    const availableCargos = useMemo(() => {
        const seen = new Set();
        processed.forEach(e => { const c = e.position || e.cargo; if (c) seen.add(c); });
        return [...seen].sort((a, b) => a.localeCompare(b));
    }, [processed]);

    // ── Costo por cliente (breakdown para panel resumen) ──────────────────────
    const clienteBreakdown = useMemo(() => {
        const map = {};
        processed.forEach(e => {
            const id = e._clienteId || 'sin_cliente';
            const nombre = e._clienteNombre || 'Sin Cliente Asignado';
            if (!map[id]) map[id] = { id, nombre, count: 0, bruto: 0, liquido: 0, costo: 0, imponible: 0 };
            map[id].count++;
            map[id].bruto    += e._liq?.totalHaberes            || 0;
            map[id].liquido  += e._liq?.liquidoAPagar           || 0;
            map[id].costo    += e._liq?.costoTotalEmpresa       || 0;
            map[id].imponible+= e._liq?.habImponibles?.subtotal || 0;
        });
        return Object.values(map).sort((a, b) => b.costo - a.costo);
    }, [processed]);

    const filtered = useMemo(() =>
        processed.filter(e => {
            const t = searchTerm.toLowerCase();
            const matchSearch = !searchTerm ||
                e.fullName?.toLowerCase().includes(t) ||
                e.rut?.includes(t) ||
                e.position?.toLowerCase().includes(t) ||
                e.cargo?.toLowerCase().includes(t) ||
                e._clienteNombre?.toLowerCase().includes(t) ||
                e._proyectoNombre?.toLowerCase().includes(t);
            const matchCliente  = !filterCliente  || e._clienteId === filterCliente;
            const matchProyecto = !filterProyecto || e._proyectoNombre === filterProyecto;
            const matchCargo    = !filterCargo    || e.position === filterCargo || e.cargo === filterCargo;
            return matchSearch && matchCliente && matchProyecto && matchCargo;
        }), [processed, searchTerm, filterCliente, filterProyecto, filterCargo]);

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
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <div className="flex items-center gap-2 py-1 px-3 bg-amber-50 border border-amber-100 rounded-lg w-fit">
                                    <TrendingUp size={10} className="text-amber-500" />
                                    <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">
                                        Producción Variables: Mes Desfasado ({( () => {
                                            const [y, m] = period.split('-').map(Number);
                                            const prevM = m === 1 ? 12 : m - 1;
                                            const prevY = m === 1 ? y - 1 : y;
                                            return `${String(prevM).padStart(2, '0')}/${prevY}`;
                                        })()})
                                    </span>
                                    <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[7px] font-black">
                                        SC: {productionStats.diasHabiles}H/{productionStats.domingosFestivos}D
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Periodo y Días Pago Actual */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-3xl shadow-sm">
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" size={14} />
                            <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                                className="pl-9 pr-6 py-2 bg-transparent border-none text-[11px] font-black uppercase text-slate-700 focus:outline-none" />
                        </div>
                        <div className="w-px h-6 bg-slate-100 mx-1" />
                        <div className="flex flex-col pr-1">
                            <span className="text-[6px] font-black text-slate-400 uppercase leading-none">Días Pago</span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-black text-slate-400">H</span>
                                    <input type="number" value={periodStats.diasHabiles} 
                                        onChange={e => setPeriodStats(prev => ({...prev, diasHabiles: parseInt(e.target.value) || 0}))} 
                                        className="w-8 text-[11px] font-black text-slate-600 focus:outline-none bg-transparent" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-black text-slate-400">D</span>
                                    <input type="number" value={periodStats.domingosFestivos} 
                                        onChange={e => setPeriodStats(prev => ({...prev, domingosFestivos: parseInt(e.target.value) || 0}))} 
                                        className="w-8 text-[11px] font-black text-slate-600 focus:outline-none bg-transparent" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Días Producción (Semana Corrida) */}
                    <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-200/50 p-1.5 rounded-3xl shadow-sm">
                        <div className="p-2 bg-indigo-600 text-white rounded-2xl"><TrendingUp size={14} /></div>
                        <div className="flex flex-col pr-3">
                            <span className="text-[6px] font-black text-indigo-400 uppercase leading-none">Días Prod. (SC)</span>
                            <div className="flex items-center gap-3 mt-0.5">
                                <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-black text-indigo-400">H:</span>
                                    <input type="number" value={productionStats.diasHabiles} 
                                        onChange={e => setProductionStats(prev => ({...prev, diasHabiles: parseInt(e.target.value) || 0}))} 
                                        className="w-8 text-[11px] font-black text-indigo-700 focus:outline-none bg-transparent" />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[7px] font-black text-indigo-400">D:</span>
                                    <input type="number" value={productionStats.domingosFestivos} 
                                        onChange={e => setProductionStats(prev => ({...prev, domingosFestivos: parseInt(e.target.value) || 0}))} 
                                        className="w-8 text-[11px] font-black text-indigo-700 focus:outline-none bg-transparent" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleExportLRE} className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                        <Download size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" /> Exportar DT
                    </button>

                    <button onClick={handleExportTable} className="group flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                        <ClipboardList size={14} className="text-teal-500 group-hover:scale-110 transition-transform" /> Exportar Tabla
                    </button>
                    
                    <button onClick={() => setShowAuditPanel(!showAuditPanel)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 z-50 ${auditResults.length > 0 ? 'bg-rose-50 text-rose-600 border border-rose-200 ring-4 ring-rose-500/10' : 'bg-white border border-slate-200 text-slate-500'}`}>
                        <Scale size={14} className={auditResults.length > 0 ? 'animate-pulse' : ''} /> 
                        Auditoría {auditResults.length > 0 && `(${auditResults.length})`}
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

            {/* ── PANEL COSTO POR CLIENTE ── */}
            {clienteBreakdown.length > 0 && (
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                            <Building2 size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Costo por Cliente</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Costo total de remuneraciones por cliente · Clic para filtrar</p>
                        </div>
                        {filterCliente && (
                            <button onClick={() => { setFilterCliente(''); setFilterProyecto(''); }}
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100">
                                <X size={10} /> Ver todos
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {clienteBreakdown.map((cl, i) => {
                            const isActive = filterCliente === cl.id;
                            return (
                                <button
                                    key={cl.id}
                                    onClick={() => {
                                        setFilterCliente(isActive ? '' : cl.id);
                                        setFilterProyecto('');
                                    }}
                                    className={`text-left p-5 rounded-[1.5rem] border transition-all hover:shadow-lg active:scale-[0.98] ${
                                        isActive
                                            ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-100'
                                            : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-[10px] font-black uppercase tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>{cl.nombre}</p>
                                            <p className={`text-[8px] font-bold uppercase mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>{cl.count} colaborador{cl.count !== 1 ? 'es' : ''}</p>
                                        </div>
                                        <div className={`text-[8px] font-black px-2 py-1 rounded-lg ${isActive ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>#{i + 1}</div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[8px] font-bold uppercase ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>Costo Empresa</span>
                                            <span className={`text-[11px] font-black tabular-nums ${isActive ? 'text-white' : 'text-slate-800'}`}>{fmt(cl.costo)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[8px] font-bold uppercase ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>Líquido</span>
                                            <span className={`text-[10px] font-black tabular-nums ${isActive ? 'text-indigo-100' : 'text-emerald-600'}`}>{fmt(cl.liquido)}</span>
                                        </div>
                                        <div className={`mt-2 pt-2 border-t ${isActive ? 'border-white/20' : 'border-slate-50'}`}>
                                            <div className="flex justify-between items-center">
                                                <span className={`text-[8px] font-bold uppercase ${isActive ? 'text-indigo-200' : 'text-slate-300'}`}>Imponible</span>
                                                <span className={`text-[9px] font-black tabular-nums ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>{fmt(cl.imponible)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── TABLA DE REMUNERACIONES MASTER ── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden mb-12">
                {/* ── PANEL ESTADO DE INTEGRACIÓN ── */}
                <div className="px-6 pt-5 pb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mr-1">Fuentes activas:</span>
                    {closuresData.length > 0 ? (
                        closuresData.map(cl => (
                            <span key={cl._id} className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                                <CheckCircle2 size={9} /> Cierre: {cl.modeloRef?.nombre || 'Bono'}
                            </span>
                        ))
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-xl text-[8px] font-black text-amber-600 uppercase tracking-widest">
                            <AlertCircle size={9} /> Sin cierres para este período
                        </span>
                    )}
                    {Object.keys(asistenciaSyncData).length > 0 ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 border border-teal-100 rounded-xl text-[8px] font-black text-teal-600 uppercase tracking-widest">
                            <CalendarCheck size={9} /> Asistencia: {Object.keys(asistenciaSyncData).length} sincronizados
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            <Calendar size={9} /> Asistencia: cálculo estándar
                        </span>
                    )}
                    {bonosConfig.length > 0 && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-xl text-[8px] font-black text-violet-600 uppercase tracking-widest">
                            <ShieldCheck size={9} /> {bonosConfig.length} tipos de bono
                        </span>
                    )}
                </div>

                {/* TOOLBAR SUPERIOR */}
                <div className="p-6 border-b border-slate-50 bg-slate-50/20 backdrop-blur-sm flex flex-col gap-4">
                    {/* Fila 1: Búsqueda + Filtros Unificados */}
                    <div className="flex flex-wrap items-center gap-4 bg-white/50 p-4 rounded-3xl border border-slate-100 shadow-sm">
                        {/* FILTRO ESTADO */}
                        <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200 shadow-inner">
                            {[
                                { id: 'Operativo', label: 'Operativos', icon: CheckCircle2, color: 'text-emerald-600' },
                                { id: 'Finiquitado', label: 'Finiquitados', icon: UserMinus, color: 'text-rose-600' },
                                { id: 'Todos', label: 'Todos', icon: Users, color: 'text-indigo-600' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setFilterStatus(s.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${
                                        filterStatus === s.id
                                            ? 'bg-white text-slate-800 shadow-lg scale-105 active:scale-95'
                                            : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <s.icon size={12} className={filterStatus === s.id ? s.color : ''} />
                                    {s.label}
                                </button>
                            ))}
                        </div>

                        {/* FILTRO CLIENTE */}
                        <div className="relative min-w-[180px]">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" size={14} />
                            <select
                                value={filterCliente}
                                onChange={e => { setFilterCliente(e.target.value); setFilterProyecto(''); }}
                                className="w-full pl-9 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 appearance-none transition-all"
                            >
                                <option value="">Todos los Clientes</option>
                                {clienteBreakdown.map(cl => (
                                    <option key={cl.id} value={cl.id}>{cl.nombre}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
                        </div>

                        {/* FILTRO PROYECTO */}
                        <div className="relative min-w-[180px]">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none" size={14} />
                            <select
                                value={filterProyecto}
                                onChange={e => setFilterProyecto(e.target.value)}
                                className="w-full pl-9 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-emerald-50 appearance-none transition-all"
                            >
                                <option value="">Todos los Proyectos</option>
                                {availableProyectos
                                    .filter(p => !filterCliente || p.clienteId === filterCliente)
                                    .map(p => (
                                        <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                                    ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
                        </div>

                        {/* FILTRO CARGO */}
                        <div className="relative min-w-[180px]">
                            <BriefcaseIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400 pointer-events-none" size={14} />
                            <select
                                value={filterCargo}
                                onChange={e => setFilterCargo(e.target.value)}
                                className="w-full pl-9 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-violet-50 appearance-none transition-all"
                            >
                                <option value="">Todos los Cargos</option>
                                {availableCargos.map(cargo => (
                                    <option key={cargo} value={cargo}>{cargo}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
                        </div>

                        {/* BUSCADOR */}
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                            <input type="text" placeholder="Búsqueda rápida (Nombre, RUT, Cargo)..." value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-300 uppercase" />
                        </div>

                        {/* LIMPIAR */}
                        {(filterCliente || filterProyecto || filterCargo || searchTerm || filterStatus !== 'Operativo') && (
                            <button onClick={() => { setFilterCliente(''); setFilterProyecto(''); setFilterCargo(''); setSearchTerm(''); setFilterStatus('Operativo'); }}
                                className="flex items-center gap-1.5 px-4 py-3 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 group">
                                <X size={12} className="group-hover:rotate-90 transition-transform" /> 
                            </button>
                        )}
                    </div>


                    {/* Fila 2: Acciones */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* SYNC ASISTENCIA → NÓMINA */}
                        <button onClick={handleSyncAsistencia} disabled={syncingAsistencia}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-teal-600 hover:text-white transition-all shadow-sm disabled:opacity-50"
                            title={`Importar días trabajados y horas extra reales desde el módulo de Asistencia para el período ${period}`}>
                            {syncingAsistencia
                                ? <Loader2 size={13} className="animate-spin" />
                                : <CalendarCheck size={13} />}
                            Sync Asistencia
                            {Object.keys(asistenciaSyncData).length > 0 && (
                                <span className="bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full ml-1">
                                    {Object.keys(asistenciaSyncData).length}
                                </span>
                            )}
                        </button>
                        {Object.keys(asistenciaSyncData).length > 0 && (
                            <button onClick={() => { setAsistenciaSyncData({}); setAlert({ type: 'success', msg: 'Datos de asistencia eliminados — volviendo a cálculo estándar.' }); setTimeout(() => setAlert(null), 3000); }}
                                className="flex items-center gap-1.5 px-3 py-2.5 bg-white text-slate-400 border border-slate-100 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
                                title="Eliminar sincronización de asistencia y volver al cálculo estándar">
                                <X size={11} /> Limpiar Sync
                            </button>
                        )}
                        <button onClick={handleExportTable}
                            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                            <FileText size={14} className="text-emerald-500" /> Exportar Tabla
                        </button>
                        <button onClick={handleMassiveDownload} disabled={loading || !filtered.length || downloadingMassive}
                            className={`flex items-center gap-2 px-6 py-3 ${downloadingMassive ? 'bg-amber-100 text-amber-700' : 'bg-slate-800 text-white'} rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:opacity-50`}>
                            {downloadingMassive ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} className="text-indigo-400" />}
                            {downloadingMassive ? 'Generando...' : 'Descarga Masiva'}
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
                                <th className="px-4 py-6 border-b border-slate-100">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest">Cargo</span>
                                        <span className="text-[8px] font-bold text-indigo-400 uppercase">Cliente · Proyecto</span>
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Pres.</span>
                                        <CheckCircle2 size={11} className="text-emerald-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Aus.</span>
                                        <XCircle size={11} className="text-rose-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Lic.</span>
                                        <Stethoscope size={11} className="text-amber-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Inicio</span>
                                        <CalendarCheck size={11} className="text-emerald-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Contrato</span>
                                        <Award size={11} className="text-amber-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white text-slate-400">
                                        <span className="text-[7px] font-black uppercase tracking-tighter">Días</span>
                                        <Calendar size={11} className="text-indigo-500 mt-1" />
                                    </div>
                                </th>
                                <th className="px-2 py-6 text-center border-b border-slate-100 group/h">
                                    <div className="flex flex-col items-center bg-white/40 p-2 rounded-xl border border-slate-100 transition-colors group-hover/h:bg-white">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Térm.</span>
                                        <UserMinus size={11} className="text-rose-400 mt-1" />
                                    </div>
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColHeader label="Sueldo Base" code="1010" />
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColHeader label="Sm. Corrida" code="1001" colorClass="text-teal-600" bgClass="bg-teal-50 border-teal-100" />
                                </th>
                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColHeader label="Gratif. Legal" code="1020" />
                                </th>

                                {closuresData.map(cl => (
                                    <th key={cl.modeloRef?._id} className="px-4 py-6 text-right border-b border-slate-100">
                                        <ColHeader
                                            label={cl.modeloRef?.nombre || 'Bono'}
                                            code={cl.modeloRef?.tipoBonoRef?.codigo || '1030'}
                                            colorClass="text-indigo-600"
                                            bgClass="bg-indigo-50 border-indigo-100"
                                        />
                                    </th>
                                ))}

                                <th className="px-4 py-6 text-right border-b border-slate-100">
                                    <ColHeader label="B. Asistencia" code="1050" colorClass="text-emerald-600" bgClass="bg-emerald-50 border-emerald-100" />
                                </th>

                                <th className="px-4 py-6 text-right bg-slate-50/40 border-b border-slate-100">
                                   <div className="flex flex-col items-end">
                                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">1011</span>
                                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">H. Extra</span>
                                   </div>
                                </th>
                                <th className="px-4 py-6 text-right bg-indigo-50/40 border-b border-indigo-100">
                                   <div className="flex flex-col items-end">
                                       <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-none">CANT</span>
                                       <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tight text-right">H. Pagadas</span>
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
                                    <tr key={e._id} className={`hover:bg-indigo-50/20 transition-all group/row ${auditResults.some(i => i.id === e.rut) ? 'bg-rose-50/10' : ''}`}>
                                        <td className="px-6 py-5 sticky left-0 bg-white group-hover/row:bg-indigo-50/20 z-10 transition-colors">
                                            <div className="flex items-center gap-4 relative">
                                                {auditResults.some(i => i.id === e.rut && i.type === 'critical') && (
                                                    <div className="absolute -top-1 -left-1 p-1.5 bg-rose-500 text-white rounded-full z-20 shadow-xl animate-bounce">
                                                        <AlertCircle size={10} />
                                                    </div>
                                                )}
                                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-lg shadow-indigo-100 overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                                                    {e.profilePic ? <img src={e.profilePic} alt="" className="w-full h-full object-cover" /> : e.fullName?.charAt(0)}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <p className="font-black text-xs text-slate-800 uppercase tracking-tight truncate">{e.fullName}</p>
                                                    <p className="text-[9px] text-slate-400 font-mono tracking-tighter">{formatRut(e.rut)}</p>
                                                    <div className="flex gap-1 mt-1">
                                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg border uppercase tracking-tighter transition-all ${
                                                            e.status === 'Finiquitado' 
                                                                ? 'bg-rose-50 text-rose-500 border-rose-100 animate-pulse' 
                                                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                        }`}>
                                                            {e.status}
                                                        </span>
                                                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-lg border border-indigo-100">{e.afp}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-5">
                                            <div className="flex flex-col min-w-0 max-w-[150px]">
                                                <span className="text-[10px] font-black text-violet-700 uppercase tracking-tight truncate">{e.position || e.cargo || '—'}</span>
                                                <button
                                                    onClick={() => { setFilterCliente(e._clienteId || ''); setFilterProyecto(''); }}
                                                    className="text-[8px] font-black text-indigo-500 hover:text-indigo-700 truncate mt-0.5 text-left transition-colors"
                                                    title={`Filtrar por ${e._clienteNombre}`}
                                                >
                                                    {e._clienteNombre !== '—' ? e._clienteNombre : '—'}
                                                </button>
                                                {e._proyectoNombre && e._proyectoNombre !== '—' && (
                                                    <button
                                                        onClick={() => { setFilterProyecto(e._proyectoNombre); setFilterCliente(e._clienteId || ''); }}
                                                        className="text-[7px] font-bold text-emerald-500 hover:text-emerald-700 truncate text-left transition-colors"
                                                        title={`Filtrar por proyecto ${e._proyectoNombre}`}
                                                    >
                                                        {e._proyectoNombre}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        {/* NUEVAS CELDAS ASISTENCIA */}
                                        <td className="px-2 py-5 text-center">
                                            <span className={`text-[10px] font-black ${e._asistencia?.diasPresente > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                {e._asistencia?.diasPresente || 0}
                                            </span>
                                        </td>
                                        <td className="px-2 py-5 text-center">
                                            <span className={`text-[10px] font-black ${e._asistencia?.diasAusente > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                                                {e._asistencia?.diasAusente || 0}
                                            </span>
                                        </td>
                                        <td className="px-2 py-5 text-center">
                                            <span className={`text-[10px] font-black ${e._asistencia?.diasLicencia > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                                                {e._asistencia?.diasLicencia || 0}
                                            </span>
                                        </td>
                                        <td className="px-2 py-5 text-center">
                                            <span className="text-[9px] font-black text-slate-600 block">
                                                {e.contractStartDate ? new Date(e.contractStartDate).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : '—'}
                                            </span>
                                            <span className="text-[6px] font-bold text-slate-400 uppercase">{e.contractStartDate ? new Date(e.contractStartDate).getFullYear() : ''}</span>
                                        </td>
                                        <td className="px-2 py-5 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${
                                                    e.contractType?.includes('INDEFINIDO') ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                    {e.contractType || 'IND'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-2 py-5 text-center">
                                            <div className="relative group/edit inline-block">
                                                <input 
                                                    type="number"
                                                    value={l.diasTrabajados}
                                                    onChange={(evt) => handleManualUpdate(e.rut, 'dias_trabajados', evt.target.value)}
                                                    className={`w-12 py-1.5 text-center rounded-lg text-[11px] font-black focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all ${
                                                        manualValues[`${e.rut}_dias_trabajados`] 
                                                            ? 'bg-amber-50 text-amber-600 border-amber-300' 
                                                            : (e._asistencia?.diasTrabajados !== undefined ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white border-slate-100 text-slate-600')
                                                    } border`}
                                                    title={manualValues[`${e.rut}_dias_trabajados`] ? 'Valor editado manualmente' : 'Valor regularizado automáticamente'}
                                                />
                                                {e._asistencia?.diasTrabajados !== undefined && !manualValues[`${e.rut}_dias_trabajados`] && (
                                                    <span className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 py-5 text-center bg-rose-50/20">
                                            <span className="text-[9px] font-black text-rose-500 block">
                                                {e.contractEndDate || e.fechaFiniquito ? new Date(e.contractEndDate || e.fechaFiniquito).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' }) : '—'}
                                            </span>
                                            <span className="text-[6px] font-bold text-rose-300 uppercase">{e.contractEndDate || e.fechaFiniquito ? new Date(e.contractEndDate || e.fechaFiniquito).getFullYear() : ''}</span>
                                        </td>
                                        <td className="px-4 py-5 text-right font-black text-slate-700 bg-slate-50/30 tabular-nums">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs">{fmt(l.habImponibles.sueldoBase)}</span>
                                                {l.diasTrabajados < 30 && (
                                                    <span className="text-[7px] text-rose-500 font-black uppercase tracking-tighter leading-none mt-1 select-none">
                                                        Regularizado Proporcional
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

                                        <td className="px-4 py-5 text-right text-xs font-black text-slate-500 tabular-nums">{fmt(l.habImponibles.bonosPorCodigo?.['1050'] || 0)}</td>
                                        <td className="px-4 py-5 text-right text-xs font-bold text-slate-400 tabular-nums">{fmt(l.habImponibles.horaExtraMonto)}</td>
                                        <td className="px-4 py-5 text-right bg-indigo-50/10 border-x border-indigo-50/50">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[11px] font-black text-indigo-700">
                                                    {((e._asistencia?.horasNormales || 0) + (e._asistencia?.horasExtraAprobadas || 0)).toFixed(1)}h
                                                </span>
                                                <span className="text-[7px] text-indigo-400 font-bold uppercase tabular-nums">Total Cant.</span>
                                            </div>
                                        </td>
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
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => setSelected(e)} className="p-2.5 bg-white border border-slate-100 text-slate-400 rounded-xl shadow-sm hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-90" title="Ver Liquidación"><Eye size={14} /></button>
                                                <button onClick={() => {
                                                    setSelected(e);
                                                    setTimeout(() => {
                                                        const btn = document.querySelector('.descargar-pdf-btn');
                                                        if (btn) btn.click();
                                                    }, 700);
                                                }} className="p-2.5 bg-white border border-slate-100 text-slate-400 rounded-xl shadow-sm hover:text-emerald-600 hover:bg-emerald-50 transition-all active:scale-90" title="Descargar PDF"><Download size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* ── TOTALES DEL LIBRO ── */}
                        {!loading && filtered.length > 0 && (
                            <tfoot>
                                <tr className="bg-slate-800 border-t-4 border-indigo-500 text-white shadow-2xl">
                                    <td colSpan={9} className="px-6 py-8 text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap bg-slate-900/50">TOTALES LIBRO</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.sueldoBase || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5 text-teal-400">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.semanaCorrida || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-r border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.gratificacion || 0), 0))}</td>
                                    
                                    {closuresData.map(cl => {
                                        const sum = filtered.reduce((acc, e) => {
                                            const res = cl.calculos?.find(b => (b.tecnicoId === e.idRecursoToa) || (b.rut === e.rut) || (normalize(b.nombre) === normalize(e.fullName)));
                                            return acc + (res?.baremoBonus || 0);
                                        }, 0);
                                        return <td key={cl.modeloRef?._id} className="px-4 py-8 text-right text-xs font-black tabular-nums text-indigo-200">{fmt(sum)}</td>;
                                    })}

                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums border-l border-white/5">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.bonosPorCodigo?.['1050'] || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-xs font-black tabular-nums">{fmt(filtered.reduce((s, e) => s + (e._liq?.habImponibles?.horaExtraMonto || 0), 0))}</td>
                                    <td className="px-4 py-8 text-right text-[10px] font-black text-indigo-300 tabular-nums bg-indigo-500/5">{filtered.reduce((s, e) => s + (e._asistencia?.horasNormales || 0) + (e._asistencia?.horasExtraAprobadas || 0), 0).toFixed(1)}h</td>
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

            {/* ── MODAL SYNC ASISTENCIA — PREVIEW ── */}
            {showSyncModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xl z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-400">
                        {/* Header */}
                        <div className="px-8 py-6 bg-gradient-to-r from-teal-600 to-emerald-500 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 rounded-xl"><CalendarCheck size={20} className="text-white" /></div>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-tight">Sync Asistencia → Nómina</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <button 
                                            onClick={() => {
                                                const [ny, nm] = period.split('-').map(Number);
                                                const pm = nm === 1 ? 12 : nm - 1;
                                                const py = nm === 1 ? ny - 1 : ny;
                                                handleSyncAsistencia(`${py}-${String(pm).padStart(2, '0')}`);
                                            }}
                                            className="px-2 py-0.5 bg-white/20 hover:bg-white/40 rounded text-[8px] font-black text-white uppercase tracking-widest transition-all"
                                        >
                                            ← Cambiar a Mes Anterior
                                        </button>
                                        <span className="text-[10px] font-bold text-teal-100 uppercase tracking-widest">
                                            Origen: {period} 
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => handleSyncAsistencia(period)}
                                    title="Volver al periodo actual/recargar"
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all">
                                    <RefreshCw size={14} />
                                </button>
                                <button onClick={() => setShowSyncModal(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all"><X size={18} /></button>
                            </div>
                        </div>

                        {/* Info Banner */}
                        <div className="px-8 py-3 bg-teal-50 border-b border-teal-100 flex items-start gap-2 flex-shrink-0">
                            <ClipboardList size={14} className="text-teal-600 flex-shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-teal-700 leading-relaxed">
                                Se importarán los días trabajados reales y horas extra aprobadas desde el módulo de Asistencia.
                                Los valores de nómina se recalcularán automáticamente usando la asistencia real en lugar del cálculo estándar (30 días).
                                Las ausencias injustificadas se descuentan proporcional al sueldo.
                            </p>
                        </div>

                        {/* Table */}
                        <div className="overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">Días Actual</th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-teal-500 uppercase tracking-widest">
                                            <ArrowRight size={10} className="inline mr-1" />Días Asistencia
                                        </th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-indigo-500 uppercase tracking-widest">HE Aprobadas</th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-amber-500 uppercase tracking-widest">Ausencias</th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-orange-500 uppercase tracking-widest">Tardanzas</th>
                                        <th className="px-4 py-4 text-center text-[9px] font-black text-emerald-500 uppercase tracking-widest">Bono Asist.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {syncPreview.map(r => {
                                        const diasCambia = r.diasNuevo !== r.diasActual;
                                        return (
                                            <tr key={r.empId} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{r.nombre}</p>
                                                    <p className="text-[9px] text-slate-400 font-mono">{r.rut}</p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="text-[11px] font-black text-slate-500">{r.diasActual}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-[11px] font-black px-3 py-1 rounded-xl inline-block ${
                                                        diasCambia
                                                            ? r.diasNuevo < r.diasActual
                                                                ? 'bg-rose-50 text-rose-600 border border-rose-100'
                                                                : 'bg-teal-50 text-teal-600 border border-teal-100'
                                                            : 'text-slate-400'
                                                    }`}>{r.diasNuevo}</span>
                                                    {diasCambia && (
                                                        <span className={`block text-[8px] font-black mt-0.5 ${r.diasNuevo < r.diasActual ? 'text-rose-400' : 'text-teal-400'}`}>
                                                            {r.diasNuevo > r.diasActual ? '+' : ''}{r.diasNuevo - r.diasActual} días
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {r.heNuevo > 0
                                                        ? <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{r.heNuevo} hrs</span>
                                                        : <span className="text-[10px] text-slate-300">—</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {r.diasAusente > 0
                                                        ? <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">{r.diasAusente}</span>
                                                        : <span className="text-[10px] text-emerald-400 font-black">✓</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {r.diasTardanza > 0
                                                        ? <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{r.diasTardanza}</span>
                                                        : <span className="text-[10px] text-emerald-400 font-black">✓</span>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {r.calificaBono
                                                        ? <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-100">Califica</span>
                                                        : <span className="text-[9px] font-black text-rose-400 bg-rose-50 px-2 py-1 rounded-xl border border-rose-100">No califica</span>
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {syncPreview.length === 0 && (
                                        <tr><td colSpan="7" className="py-12 text-center text-slate-400 text-xs font-bold">
                                            No hay colaboradores con registros de asistencia en este período
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0 bg-slate-50/50">
                            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                <CheckCircle2 size={14} className="text-teal-500" />
                                <span>{syncPreview.filter(r => r.diasNuevo !== r.diasActual).length} colaboradores con días modificados</span>
                                <span>·</span>
                                <span>{syncPreview.filter(r => r.heNuevo > 0).length} con horas extra aprobadas</span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowSyncModal(false)}
                                    className="px-6 py-3 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleConfirmSync} disabled={syncPreview.length === 0}
                                    className="px-8 py-3 bg-teal-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-teal-700 shadow-lg shadow-teal-200 transition-all disabled:opacity-50 flex items-center gap-2 active:scale-95">
                                    <CalendarCheck size={14} /> Confirmar Sincronización
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
            {/* AUDIT PANEL DRAWER PREMIUM */}
            {showAuditPanel && (
                <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.1)] z-[120] animate-in slide-in-from-right duration-500 border-l border-slate-100 flex flex-col">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                                <Scale size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Comandos de Auditoría</h3>
                                <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-none">Motor de Integridad Nomina v4.0</p>
                            </div>
                        </div>
                        <button onClick={() => setShowAuditPanel(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={18} className="text-slate-400" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {auditResults.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                    <CheckCircle2 size={40} />
                                </div>
                                <p className="text-sm font-black text-slate-800 uppercase">Sin anomalías detectadas</p>
                                <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed px-10">Todos los colaboradores cumplen con la lógica de proporcionalidad y asistencia sincronizada.</p>
                            </div>
                        ) : (
                            auditResults.map((issue, idx) => {
                                const worker = processed.find(e => e.rut === issue.id);
                                return (
                                    <div key={idx} className={`p-5 rounded-[2rem] border transition-all hover:scale-[1.02] active:scale-95 cursor-pointer flex gap-4 ${
                                        issue.type === 'critical' ? 'bg-rose-50/50 border-rose-100 shadow-rose-50' :
                                        issue.type === 'warning' ? 'bg-amber-50/50 border-amber-100 shadow-amber-50' :
                                        'bg-indigo-50/50 border-indigo-100 shadow-indigo-50'
                                    }`} onClick={() => {
                                        setSearchTerm(worker?.fullName || issue.id);
                                        setShowAuditPanel(false);
                                    }}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                            issue.type === 'critical' ? 'bg-rose-500 text-white' :
                                            issue.type === 'warning' ? 'bg-amber-500 text-white' :
                                            'bg-indigo-500 text-white'
                                        }`}>
                                            {issue.type === 'critical' ? <AlertCircle size={18} /> : <ClipboardList size={18} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{issue.category}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-lg border uppercase ${
                                                    issue.type === 'critical' ? 'bg-rose-100/50 text-rose-600 border-rose-200' :
                                                    'bg-slate-100/50 text-slate-400 border-slate-200'
                                                }`}>{issue.type}</span>
                                            </div>
                                            <p className="text-[11px] font-black text-slate-800 uppercase leading-tight mb-2">{worker?.fullName || issue.id}</p>
                                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">{issue.msg}</p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <div className="p-8 bg-slate-900 text-white">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impacto Financiero</p>
                                <p className="text-xl font-black tabular-nums">{auditResults.filter(i => i.type === 'critical').length} alertas críticas</p>
                            </div>
                            <div className="p-3 bg-white/10 rounded-2xl"><Scale size={20} /></div>
                        </div>
                        <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase tracking-tighter">
                            El bloqueo de cierre de periodo se activa automáticamente ante discrepancias mayores al 15% del imponible global.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NominaRRHH;
