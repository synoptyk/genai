import React, { useState } from 'react';
import { X, AlertCircle, Edit2, FileText, Download, Upload, CheckCircle, Loader2 } from 'lucide-react';
import { generateFiniquitoPdf } from '../../utils/pdfGenerators';
import * as candidatosApi from '../../api/candidatosApi';

const formatDateUTC = (dateVal) => {
    if (!dateVal) return '';
    try {
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return '';
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return \`\${day}/\${month}/\${year}\`;
    } catch (e) {
        return '';
    }
};

export default function FiniquitoDetailModal({
    isOpen,
    showDetail,
    onClose,
    onEdit,
    onSuccess // Triggered after successful file upload
}) {
    const [legalFile, setLegalFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    if (!isOpen || !showDetail) return null;

    const handleUpload = async () => {
        if (!legalFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('document', legalFile);
            formData.append('docType', 'Acta Finiquito Legalizado');
            await candidatosApi.uploadDocument(showDetail._id, formData);
            alert('Documento subido con éxito');
            setLegalFile(null);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Error subiendo acta:', err);
            alert('Error al subir el documento. Revisa la consola para más detalles.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-lg font-black uppercase text-slate-800">Ficha de finiquito — {showDetail.fullName}</h3>
                    <button onClick={onClose} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Stepper Workflow */}
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-center">
                        <div className="flex items-center justify-between w-full max-w-3xl">
                            {/* Step 1: Registro */}
                            <div className="flex items-center flex-1">
                                <div className="flex flex-col items-center relative">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-emerald-100">✓</div>
                                    <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Registro</span>
                                    <span className="text-[8px] font-bold text-slate-400">Borrador</span>
                                </div>
                                <div className="flex-1 h-1 bg-emerald-500 mx-2 -mt-4"></div>
                            </div>

                            {/* Step 2: Firma / Procesamiento */}
                            <div className="flex items-center flex-1">
                                <div className="flex flex-col items-center relative">
                                    <div className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md \${
                                        (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                            ? 'bg-emerald-500 text-white shadow-emerald-100'
                                            : 'bg-violet-500 text-white shadow-violet-100 animate-pulse'
                                    }\`}>
                                        {(showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo') ? '✓' : '2'}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Firma</span>
                                    <span className="text-[8px] font-bold text-slate-400">
                                        {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'Módulo Interno' : 'Firma Pendiente'}
                                    </span>
                                </div>
                                <div className={\`flex-1 h-1 mx-2 -mt-4 \${
                                    (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                        ? 'bg-emerald-500'
                                        : showDetail.finiquitoDetalle?.procesadoEn === 'Notaria'
                                        ? 'bg-violet-300'
                                        : 'bg-slate-200'
                                }\`}></div>
                            </div>

                            {/* Step 3: En Notaría */}
                            <div className={\`flex items-center flex-1 \${showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'opacity-40' : ''}\`}>
                                <div className="flex flex-col items-center relative">
                                    <div className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md \${
                                        showDetail.finiquitoDetalle?.procesadoEn === 'Modulo'
                                            ? 'bg-slate-200 text-slate-400'
                                            : showDetail.finiquitoDetalle?.notariaEstado === 'Firmado'
                                            ? 'bg-emerald-500 text-white shadow-emerald-100'
                                            : showDetail.finiquitoDetalle?.notariaEstado === 'En Notaria'
                                            ? 'bg-violet-500 text-white shadow-violet-100 animate-pulse'
                                            : 'bg-slate-200 text-slate-500'
                                    }\`}>
                                        {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'N/A' : (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' ? '✓' : '3')}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Notaría</span>
                                    <span className="text-[8px] font-bold text-slate-400">
                                        {showDetail.finiquitoDetalle?.procesadoEn === 'Modulo' ? 'No aplica' : (showDetail.finiquitoDetalle?.notariaEstado || 'Pendiente')}
                                    </span>
                                </div>
                                <div className={\`flex-1 h-1 mx-2 -mt-4 \${
                                    showDetail.finiquitoDetalle?.procesadoEn === 'Modulo'
                                        ? 'bg-slate-200'
                                        : showDetail.finiquitoDetalle?.notariaEstado === 'Firmado'
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-250'
                                }\`}></div>
                            </div>

                            {/* Step 4: Legalizado / Terminado */}
                            <div className="flex items-center">
                                <div className="flex flex-col items-center relative">
                                    <div className={\`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md \${
                                        (showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo')
                                            ? 'bg-emerald-500 text-white shadow-emerald-100'
                                            : 'bg-slate-200 text-slate-500'
                                    }\`}>
                                        {(showDetail.finiquitoDetalle?.notariaEstado === 'Firmado' || showDetail.finiquitoDetalle?.procesadoEn === 'Modulo') ? '✓' : '4'}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-slate-600 mt-1">Legalizado</span>
                                    <span className="text-[8px] font-bold text-slate-400">Terminado</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {showDetail.finiquitoDetalle?.warnings && showDetail.finiquitoDetalle.warnings.length > 0 && (
                            <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-amber-800">
                                <div className="flex items-center gap-1.5 font-black uppercase text-amber-700 tracking-wider">
                                    <AlertCircle size={14} className="text-amber-500" /> Advertencias de Cumplimiento Legal (DT Chile)
                                </div>
                                <ul className="list-disc pl-4 space-y-1 font-medium">
                                    {showDetail.finiquitoDetalle.warnings.map((w, idx) => (
                                        <li key={idx}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="space-y-3">
                            <p className="text-xs font-black uppercase text-slate-400 font-bold tracking-wider">Datos Laborales</p>
                            <div className="space-y-1 text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p><span className="font-bold text-slate-500">Cargo:</span> <span className="font-black text-slate-700">{showDetail.position || 'N/A'}</span></p>
                                <p><span className="font-bold text-slate-500">Contrato:</span> <span className="font-black text-slate-700 uppercase">{showDetail.contractType || 'No definido'}</span></p>
                                <p><span className="font-bold text-slate-500">Ingreso:</span> <span className="font-black text-slate-700">{showDetail.contractStartDate ? formatDateUTC(showDetail.contractStartDate) : 'N/A'}</span></p>
                                <p><span className="font-bold text-slate-500">Finiquito:</span> <span className="font-black text-slate-700">{showDetail.fechaFiniquito ? formatDateUTC(showDetail.fechaFiniquito) : 'N/A'}</span></p>
                                <p><span className="font-bold text-slate-500">Motivo:</span> <span className="font-black text-slate-700">{showDetail.finiquitoMotivo || 'N/A'}</span></p>
                                <p><span className="font-bold text-slate-500">Proyecto:</span> <span className="font-black text-slate-700">{showDetail.projectName || showDetail.projectId?.nombreProyecto || 'N/A'}</span></p>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-black uppercase text-slate-400 mb-2 font-bold tracking-wider">Documentos asociados</p>
                            <div className="space-y-2">
                                {(showDetail.documents || [])
                                    .filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal'))
                                    .map((doc, i) => (
                                        <div key={i} className="rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                                            <span className="text-xs font-bold uppercase text-slate-600">{doc.docType}</span>
                                            <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600 hover:underline">Ver</a>
                                        </div>
                                    ))}
                                {(!showDetail.documents || showDetail.documents.filter(d => d.docType?.toLowerCase().includes('finiquito') || d.docType?.toLowerCase().includes('legal')).length === 0) && (
                                    <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center font-bold">No hay documentos cargados.</p>
                                )}
                            </div>
                        </div>

                        {showDetail.finiquitoDetalle && (
                            <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                                <p className="text-xs font-black uppercase text-slate-400 mb-3 font-bold tracking-wider">Liquidación Detallada del Finiquito</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold border-b border-slate-200 pb-1 uppercase tracking-wider">Haberes e Indemnizaciones</p>
                                        <div className="text-xs space-y-1.5 mt-2 font-medium text-slate-600">
                                            <p className="flex justify-between"><span>Años de Servicio ({showDetail.finiquitoDetalle.aniosServicioCalculados || 0} años):</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.montoIndemnizacionAnos || 0).toLocaleString('es-CL')}</span></p>
                                            <p className="flex justify-between"><span>Falta de Aviso Previo:</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.montoIndemnizacionAviso || 0).toLocaleString('es-CL')}</span></p>
                                            <p className="flex justify-between"><span>Feriado Proporcional ({showDetail.finiquitoDetalle.diasVacacionesCorridosCalculados || 0} días):</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.montoFeriadoProporcional || 0).toLocaleString('es-CL')}</span></p>
                                            {showDetail.finiquitoDetalle.pagarDiasProporcionales && (showDetail.finiquitoDetalle.diasTrabajadosMes > 0) && (
                                                <>
                                                    <p className="flex justify-between"><span>Sueldo Proporcional ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.montoSueldoProporcional || 0).toLocaleString('es-CL')}</span></p>
                                                    {(showDetail.finiquitoDetalle.montoGratificacionProporcional || 0) > 0 && (
                                                        <p className="flex justify-between"><span>Gratif. Proporcional ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.montoGratificacionProporcional || 0).toLocaleString('es-CL')}</span></p>
                                                    )}
                                                    {((showDetail.finiquitoDetalle.montoColacionProporcional || 0) + (showDetail.finiquitoDetalle.montoMovilizacionProporcional || 0)) > 0 && (
                                                        <p className="flex justify-between"><span>Asig. Proporcionales ({showDetail.finiquitoDetalle.diasTrabajadosMes}d):</span> <span className="font-bold text-slate-800">\${((showDetail.finiquitoDetalle.montoColacionProporcional || 0) + (showDetail.finiquitoDetalle.montoMovilizacionProporcional || 0)).toLocaleString('es-CL')}</span></p>
                                                    )}
                                                </>
                                            )}
                                            {(showDetail.finiquitoDetalle.indemnizacionVoluntaria || 0) > 0 && (
                                                <p className="flex justify-between text-emerald-700"><span>Indemnización Voluntaria:</span> <span className="font-bold text-emerald-800">\${(showDetail.finiquitoDetalle.indemnizacionVoluntaria).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.aguinaldosOtros || 0) > 0 && (
                                                <p className="flex justify-between text-emerald-700"><span>Aguinaldos/Bonos Pendientes:</span> <span className="font-bold text-emerald-800">\${(showDetail.finiquitoDetalle.aguinaldosOtros).toLocaleString('es-CL')}</span></p>
                                            )}
                                            <p className="flex justify-between"><span>Otros Haberes:</span> <span className="font-bold text-slate-800">\${(showDetail.finiquitoDetalle.otrosHaberes || 0).toLocaleString('es-CL')}</span></p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold border-b border-slate-200 pb-1 uppercase tracking-wider">Descuentos</p>
                                        <div className="text-xs space-y-1.5 mt-2 font-medium text-slate-600">
                                            <p className="flex justify-between text-red-600"><span>Cotización AFC Empleador:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoAFC || 0).toLocaleString('es-CL')}</span></p>
                                            {showDetail.finiquitoDetalle.descuentoAnticipos > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Anticipos de Sueldo:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoAnticipos).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {showDetail.finiquitoDetalle.descuentoPrestamoCaja > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Préstamo Caja Compensación:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoPrestamoCaja).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {showDetail.finiquitoDetalle.descuentoPrestamoEmpresa > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Préstamo Interno Empresa:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoPrestamoEmpresa).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.descuentoAfpProporcional || 0) > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Cotiz. AFP Proporcional:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoAfpProporcional).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.descuentoSaludProporcional || 0) > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Cotiz. Salud Proporcional:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoSaludProporcional).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.descuentoAfcProporcional || 0) > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Cotiz. AFC Proporcional:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoAfcProporcional).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.descuentoSeguroColectivo || 0) > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Seguro Colectivo:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoSeguroColectivo).toLocaleString('es-CL')}</span></p>
                                            )}
                                            {(showDetail.finiquitoDetalle.descuentoEquiposNoDevueltos || 0) > 0 && (
                                                <p className="flex justify-between text-red-600"><span>Equipos/Heras. No Devueltos:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.descuentoEquiposNoDevueltos).toLocaleString('es-CL')}</span></p>
                                            )}
                                            <p className="flex justify-between text-red-600"><span>Otros Descuentos:</span> <span className="font-bold">-\${(showDetail.finiquitoDetalle.otrosDescuentos || 0).toLocaleString('es-CL')}</span></p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col justify-between border border-slate-850">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Neto a Pagar</p>
                                            <p className="text-2xl font-black mt-1 text-emerald-400">\${(showDetail.finiquitoDetalle.netoFiniquito || 0).toLocaleString('es-CL')}</p>
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-2 border-t border-slate-800 pt-2 block truncate">
                                            Causal: {showDetail.finiquitoDetalle.causalTermino?.substring(0, 32)}...
                                        </div>
                                    </div>
                                    {showDetail.finiquitoDetalle.observacionesReservas && (
                                        <div className="md:col-span-3 text-xs border-t border-slate-200 pt-2 text-slate-600 font-medium">
                                            <span className="font-bold text-slate-700">Observaciones / Reservas:</span> {showDetail.finiquitoDetalle.observacionesReservas}
                                        </div>
                                    )}
                                    {showDetail.finiquitoDetalle.procesadoEn === 'Notaria' ? (
                                        <div className="md:col-span-3 text-xs border-t border-slate-200 pt-3 mt-1 grid grid-cols-2 md:grid-cols-4 gap-3 bg-violet-50/40 p-3 rounded-xl border border-violet-100/50">
                                            <div>
                                                <span className="block text-slate-400 font-bold uppercase text-[9px]">Lugar de Procesamiento</span>
                                                <span className="font-black text-violet-700">🏛️ Notario Público</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400 font-bold uppercase text-[9px]">Nombre Notaría</span>
                                                <span className="font-black text-slate-700">{showDetail.finiquitoDetalle.notariaNombre || 'No especificada'}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400 font-bold uppercase text-[9px]">Fecha de Firma</span>
                                                <span className="font-black text-slate-700">
                                                    {showDetail.finiquitoDetalle.notariaFechaFirma 
                                                        ? formatDateUTC(showDetail.finiquitoDetalle.notariaFechaFirma) 
                                                        : 'Pendiente'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-400 font-bold uppercase text-[9px]">Gastos Notaría</span>
                                                <span className="font-black text-slate-700">
                                                    \${(showDetail.finiquitoDetalle.notariaGastos || 0).toLocaleString('es-CL')} 
                                                    <span className="text-[9px] font-bold text-slate-400 ml-1">({showDetail.finiquitoDetalle.notariaPagadoPor})</span>
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="md:col-span-3 text-xs border-t border-slate-200 pt-3 mt-1 grid grid-cols-1 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                                            <div>
                                                <span className="block text-slate-400 font-bold uppercase text-[9px]">Lugar de Procesamiento</span>
                                                <span className="font-black text-slate-600">📁 Módulo Interno (GenAI)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-auto">
                    {/* Acciones principales */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => {
                                onEdit(showDetail);
                            }}
                            className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-amber-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-amber-500/10"
                        >
                            <Edit2 size={14} /> Editar Parámetros
                        </button>
                        <button
                            onClick={() => generateFiniquitoPdf(showDetail)}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-blue-600/10"
                        >
                            <FileText size={14} /> Generar Acta PDF
                        </button>
                        <a
                            href={\`data:application/json;charset=utf-8,\${encodeURIComponent(JSON.stringify(showDetail, null, 2))}\`}
                            download={\`finiquito-\${showDetail.rut || showDetail._id}.json\`}
                            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                        >
                            <Download size={14} /> Exportar JSON
                        </a>
                    </div>

                    {/* Carga de Documento */}
                    <div className="flex items-center gap-2">
                        <label className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2 cursor-pointer transition-all shadow-sm">
                            <Upload size={14} className="text-slate-500" />
                            {legalFile ? \`Acta: \${legalFile.name.substring(0, 15)}\${legalFile.name.length > 15 ? '...' : ''}\` : 'Seleccionar Acta Firmada'}
                            <input
                                type="file"
                                className="hidden"
                                onChange={e => setLegalFile(e.target.files[0] || null)}
                                accept=".pdf,image/*"
                            />
                        </label>
                        {legalFile && (
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shadow-emerald-600/10 animate-in fade-in slide-in-from-left-2 duration-300"
                            >
                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                {uploading ? 'Subiendo...' : 'Confirmar y Subir'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
