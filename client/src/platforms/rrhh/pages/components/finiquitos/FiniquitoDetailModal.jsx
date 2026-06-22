import React from 'react';
import { X, Edit2, FileText, Download, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { formatRut } from '../../../../../utils/rutUtils';

const FiniquitoDetailModal = ({
    show,
    onClose,
    onEdit,
    onUpload,
    generateFiniquitoPdf,
    legalFile,
    setLegalFile,
    uploading,
    formatDateUTC
}) => {
    if (!show || !show.finiquitoDetalle) return null;

    const fd = show.finiquitoDetalle;
    const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Ficha de Finiquito</h3>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">{show.fullName} • {formatRut(show.rut)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Stepper Workflow */}
                <div className="px-6 py-5 border-b border-slate-100 flex justify-center bg-white">
                    <div className="flex items-center justify-between w-full max-w-3xl relative">
                        {/* 1. Registro */}
                        <div className="flex flex-col items-center z-10 w-24">
                            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-100">
                                ✓
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-700 mt-2">Registro</span>
                            <span className="text-[9px] font-bold text-slate-400">Completado</span>
                        </div>

                        {/* Line 1->2 */}
                        <div className={`absolute top-4 left-12 right-[66%] h-1 ${
                            (fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? 'bg-emerald-500' : 'bg-violet-300'
                        }`} />

                        {/* 2. Firma */}
                        <div className="flex flex-col items-center z-10 w-24">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-colors ${
                                (fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo')
                                    ? 'bg-emerald-500 text-white shadow-emerald-100'
                                    : 'bg-violet-500 text-white shadow-violet-200 ring-4 ring-violet-50'
                            }`}>
                                {(fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? '✓' : '2'}
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-700 mt-2">Firma</span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {fd.procesadoEn === 'Modulo' ? 'Módulo Interno' : 'Pendiente'}
                            </span>
                        </div>

                        {/* Line 2->3 */}
                        <div className={`absolute top-4 left-[33%] right-[33%] h-1 ${
                            (fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} />

                        {/* 3. Notaría */}
                        <div className={`flex flex-col items-center z-10 w-24 ${fd.procesadoEn === 'Modulo' ? 'opacity-40' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-colors ${
                                fd.procesadoEn === 'Modulo' ? 'bg-slate-200 text-slate-500'
                                : fd.notariaEstado === 'Firmado' ? 'bg-emerald-500 text-white shadow-emerald-100'
                                : fd.notariaEstado === 'En Notaria' ? 'bg-violet-500 text-white shadow-violet-200 ring-4 ring-violet-50'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                                {fd.procesadoEn === 'Modulo' ? '—' : (fd.notariaEstado === 'Firmado' ? '✓' : '3')}
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-700 mt-2">Notaría</span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {fd.procesadoEn === 'Modulo' ? 'No Aplica' : (fd.notariaEstado || 'Pendiente')}
                            </span>
                        </div>

                        {/* Line 3->4 */}
                        <div className={`absolute top-4 left-[66%] right-12 h-1 ${
                            (fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? 'bg-emerald-500' : 'bg-slate-200'
                        }`} />

                        {/* 4. Legalizado */}
                        <div className="flex flex-col items-center z-10 w-24">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-colors ${
                                (fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo')
                                    ? 'bg-emerald-500 text-white shadow-emerald-100'
                                    : 'bg-slate-200 text-slate-500'
                            }`}>
                                {(fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? '✓' : '4'}
                            </div>
                            <span className="text-[10px] font-black uppercase text-slate-700 mt-2">Legalizado</span>
                            <span className="text-[9px] font-bold text-slate-400">
                                {(fd.notariaEstado === 'Firmado' || fd.procesadoEn === 'Modulo') ? 'Completado' : 'Pendiente'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="p-6 bg-slate-50/50 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {fd.warnings?.length > 0 && (
                        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1.5 text-xs font-bold text-amber-800">
                            {fd.warnings.map((w, idx) => (
                                <div key={idx} className="flex gap-2 items-start">
                                    <span className="text-amber-500">•</span>
                                    <span>{w}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Section 1: Resumen General */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-3 border-b border-slate-100 pb-2">Resumen General</h4>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Neto a Pagar:</span>
                                    <span className="font-black text-emerald-600 text-sm">{fmt(fd.netoFiniquito)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Fecha Egreso:</span>
                                    <span className="font-bold text-slate-800">{formatDateUTC(fd.fechaEgreso)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Causal:</span>
                                    <span className="font-bold text-slate-800 truncate max-w-[120px]" title={fd.causalTermino}>{fd.causalTermino}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Antigüedad:</span>
                                    <span className="font-bold text-slate-800">{fd.aniosServicioCalculados || 0} años</span>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Indemnizaciones & Vacaciones */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-600 mb-3 border-b border-slate-100 pb-2">Haberes</h4>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Años de Servicio:</span>
                                    <span className="font-bold text-slate-800">{fmt(fd.montoIndemnizacionAnos)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Aviso Previo:</span>
                                    <span className="font-bold text-slate-800">{fmt(fd.montoIndemnizacionAviso)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Feriado Proporcional:</span>
                                    <span className="font-bold text-slate-800">{fmt(fd.montoFeriadoProporcional)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Otros / Aguinaldos:</span>
                                    <span className="font-bold text-slate-800">{fmt(fd.aguinaldosOtros)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Descuentos */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-3 border-b border-slate-100 pb-2">Descuentos Principales</h4>
                            <div className="space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Aporte AFC Empleador:</span>
                                    <span className="font-bold text-rose-600">-{fmt(fd.descuentoAFC)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Préstamos Empresa:</span>
                                    <span className="font-bold text-rose-600">-{fmt(fd.descuentoPrestamoEmpresa)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Caja Compensación:</span>
                                    <span className="font-bold text-rose-600">-{fmt(fd.descuentoPrestamoCaja)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="font-bold text-slate-500">Otros Descuentos:</span>
                                    <span className="font-bold text-rose-600">-{fmt((fd.otrosDescuentos || 0) + (fd.descuentoEquiposNoDevueltos || 0))}</span>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Notaría details if applicable */}
                        {fd.procesadoEn === 'Notaria' && (
                            <div className="lg:col-span-3 bg-violet-50/50 border border-violet-100 rounded-2xl p-4 flex flex-wrap gap-4 text-xs">
                                <div className="min-w-[120px]">
                                    <span className="block text-slate-400 font-bold uppercase text-[9px] mb-0.5">Lugar</span>
                                    <span className="font-black text-violet-700">🏛️ Notaría</span>
                                </div>
                                <div className="min-w-[150px]">
                                    <span className="block text-slate-400 font-bold uppercase text-[9px] mb-0.5">Nombre Notaría</span>
                                    <span className="font-bold text-slate-800">{fd.notariaNombre || 'No especificada'}</span>
                                </div>
                                <div className="min-w-[120px]">
                                    <span className="block text-slate-400 font-bold uppercase text-[9px] mb-0.5">Fecha Firma</span>
                                    <span className="font-bold text-slate-800">{fd.notariaFechaFirma ? formatDateUTC(fd.notariaFechaFirma) : 'Pendiente'}</span>
                                </div>
                                <div>
                                    <span className="block text-slate-400 font-bold uppercase text-[9px] mb-0.5">Gastos (Por: {fd.notariaPagadoPor})</span>
                                    <span className="font-bold text-slate-800">{fmt(fd.notariaGastos)}</span>
                                </div>
                            </div>
                        )}
                        
                        {fd.observacionesReservas && (
                            <div className="lg:col-span-3 text-xs bg-slate-100 rounded-xl p-3 border border-slate-200">
                                <span className="font-bold text-slate-700 uppercase tracking-widest text-[9px]">Observaciones / Reservas:</span>
                                <p className="mt-1 font-medium text-slate-600">{fd.observacionesReservas}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => onEdit(show)}
                            className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <Edit2 size={14} /> Editar
                        </button>
                        <button
                            onClick={() => generateFiniquitoPdf(show)}
                            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md shadow-violet-200"
                        >
                            <FileText size={14} /> Descargar Acta
                        </button>
                        <a
                            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(show, null, 2))}`}
                            download={`finiquito-${show.rut || show._id}.json`}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
                        >
                            <Download size={14} /> Exportar JSON
                        </a>
                    </div>

                    {/* Upload legal file area */}
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                        <label className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 cursor-pointer transition-all shadow-sm">
                            <Upload size={14} />
                            <span className="truncate max-w-[150px]">{legalFile ? legalFile.name : 'Subir Acta Firmada'}</span>
                            <input
                                type="file"
                                className="hidden"
                                onChange={e => setLegalFile(e.target.files[0] || null)}
                                accept=".pdf,image/*"
                            />
                        </label>
                        {legalFile && (
                            <button
                                onClick={() => onUpload(show._id)}
                                disabled={uploading}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50"
                            >
                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                Confirmar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FiniquitoDetailModal;
