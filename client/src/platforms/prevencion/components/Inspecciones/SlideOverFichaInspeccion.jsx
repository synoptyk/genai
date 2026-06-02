import React, { useState } from 'react';
import { X, ClipboardList, CheckCircle2, XCircle, FileText, User, Truck, ShieldCheck, HardHat, Camera, AlertTriangle, Printer, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { inspeccionesApi } from '../../prevencionApi';

const FichaSection = ({ title, icon: Icon, children, accent = "slate" }) => {
    const accents = {
        slate: 'bg-slate-100 text-slate-600',
        rose: 'bg-rose-100 text-rose-600',
        blue: 'bg-blue-100 text-blue-600',
        orange: 'bg-orange-100 text-orange-600'
    };
    return (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${accents[accent]}`}>
                    <Icon size={20} />
                </div>
                <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">{title}</h4>
            </div>
            {children}
        </div>
    );
};

const DataField = ({ label, value }) => (
    <div className="space-y-1.5 text-left">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
        <div className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-[11px] uppercase text-slate-700 break-words">
            {value || 'NO INDICADO'}
        </div>
    </div>
);

const SlideOverFichaInspeccion = ({ isOpen, onClose, inspeccion, onStatusChange }) => {
    const [updating, setUpdating] = useState(false);

    if (!isOpen || !inspeccion) return null;

    const accent = inspeccion.tipo === 'cumplimiento-prevencion' ? 'rose' : inspeccion.tipo === 'epp' ? 'orange' : 'blue';
    const IconoPrincipal = inspeccion.tipo === 'cumplimiento-prevencion' ? ShieldCheck : inspeccion.tipo === 'epp' ? HardHat : Truck;

    const handlePrint = () => {
        window.print();
    };

    const handleUpdateStatus = async (nuevoEstado) => {
        setUpdating(true);
        try {
            await inspeccionesApi.update(inspeccion._id, { estado: nuevoEstado });
            if (onStatusChange) onStatusChange();
            onClose();
        } catch (e) {
            console.error('Error updating:', e);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm transition-opacity FichaModal">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .FichaModal, .FichaModal * { visibility: visible; }
                    .FichaModal { position: absolute; left: 0; top: 0; width: 100%; max-width: 100%; background: white !important; display: block; overflow: visible; box-shadow: none; border: none; }
                    .no-print { display: none !important; }
                    .print-break-inside-avoid { break-inside: avoid; }
                }
            `}</style>
            <div className="w-full max-w-4xl bg-slate-50 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative">
                
                {/* HEADER */}
                <div className="bg-white px-8 py-6 border-b border-slate-100 sticky top-0 z-20 flex items-center justify-between shadow-sm no-print">
                    <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-2xl ${accent === 'rose' ? 'bg-rose-100 text-rose-600' : accent === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            <IconoPrincipal size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">
                                Ficha de Inspección
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">ID: {inspeccion._id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all font-black text-[10px] uppercase">
                            <Printer size={14} /> Imprimir PDF
                        </button>
                        <button onClick={onClose} className="p-3 bg-slate-50 hover:bg-slate-200 rounded-full transition-all text-slate-400">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-8 pb-32 print-content bg-white min-h-screen">
                    
                    {/* ENCABEZADO IMPRESIÓN */}
                    <div className="hidden pb-8 border-b border-slate-200 mb-8" style={{ display: 'none' /* Will override in print maybe, or just keep it simple */ }}>
                        <h1 className="text-3xl font-black text-slate-900 uppercase">INFORME DE INSPECCIÓN</h1>
                        <p className="text-sm font-bold text-slate-500">ID: {inspeccion._id}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[['Estado', inspeccion.estado || 'En Revisión'], ['Resultado', inspeccion.resultado], ['Fecha', new Date(inspeccion.createdAt).toLocaleString()], ['Tipo', inspeccion.tipo.replace('-', ' ')]].map(([l, v]) => (
                            <div key={l} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l}</p>
                                <p className={`text-[12px] font-black uppercase mt-1 ${v === 'No Conforme' || v === 'Rechazado' ? 'text-rose-600' : v === 'Conforme' || v === 'Aprobado' ? 'text-emerald-600' : 'text-slate-700'}`}>{v}</p>
                            </div>
                        ))}
                    </div>

                    <FichaSection title="Identificación" icon={User} accent={accent}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <DataField label="Trabajador / Conductor" value={inspeccion.nombreTrabajador} />
                            <DataField label="RUT" value={inspeccion.rutTrabajador} />
                            <DataField label="Empresa" value={inspeccion.empresa} />
                            <DataField label="OT / Proyecto" value={inspeccion.ot} />
                            <DataField label="Lugar de Inspección" value={inspeccion.lugarInspeccion} />
                            <DataField label="GPS Capturado" value={inspeccion.gps} />
                        </div>
                    </FichaSection>

                    {inspeccion.tipo === 'vehicular' && inspeccion.vehicular && (
                        <FichaSection title="Datos del Vehículo" icon={Truck} accent="blue">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <DataField label="Patente" value={inspeccion.vehicular.patente} />
                                <DataField label="Kilometraje" value={inspeccion.vehicular.kilometraje} />
                                <DataField label="Nivel de Combustible" value={inspeccion.vehicular.nivelCombustible} />
                            </div>
                        </FichaSection>
                    )}

                    <div className="print-break-inside-avoid">
                        <FichaSection title="Checklist Evaluado" icon={ClipboardList} accent={accent}>
                            {inspeccion.tipo === 'cumplimiento-prevencion' && inspeccion.cumplimiento && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                        <span className="text-[11px] font-black text-slate-700 uppercase">Posee AST Vigente</span>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${inspeccion.cumplimiento.tieneAst ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{inspeccion.cumplimiento.tieneAst ? 'CUMPLE' : 'NO CUMPLE'}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                        <span className="text-[11px] font-black text-slate-700 uppercase">Posee PTS Asignado</span>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${inspeccion.cumplimiento.tienePts ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{inspeccion.cumplimiento.tienePts ? 'CUMPLE' : 'NO CUMPLE'}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                        <span className="text-[11px] font-black text-slate-700 uppercase">Porta EPP Requerido</span>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${inspeccion.cumplimiento.tieneEpp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{inspeccion.cumplimiento.tieneEpp ? 'CUMPLE' : 'NO CUMPLE'}</span>
                                    </div>
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                                        <span className="text-[11px] font-black text-slate-700 uppercase">Inducción Realizada</span>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${inspeccion.cumplimiento.inductionRealizada ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{inspeccion.cumplimiento.inductionRealizada ? 'CUMPLE' : 'NO CUMPLE'}</span>
                                    </div>
                                    {inspeccion.cumplimiento.observacionesCumplimiento && (
                                        <div className="p-4 bg-slate-50 rounded-2xl mt-4">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observaciones Específicas</p>
                                            <p className="text-[11px] font-bold text-slate-700 uppercase">{inspeccion.cumplimiento.observacionesCumplimiento}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {inspeccion.tipo === 'epp' && inspeccion.itemsEpp && (
                                <div className="space-y-3">
                                    {inspeccion.itemsEpp.map((item, i) => (
                                        <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${!item.tiene ? 'bg-rose-50 border-rose-100' : item.condicion === 'Malo' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex-shrink-0">
                                                {item.tiene ? (item.condicion === 'Malo' ? <AlertTriangle size={18} className="text-amber-500" /> : <CheckCircle2 size={18} className="text-emerald-500" />) : <XCircle size={18} className="text-rose-500" />}
                                            </div>
                                            <span className="flex-1 text-[11px] font-black uppercase text-slate-700">{item.nombre}</span>
                                            <div className="flex gap-2">
                                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${item.tiene ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.tiene ? 'SI TIENE' : 'NO TIENE'}</span>
                                                {item.tiene && (
                                                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${item.condicion === 'Bueno' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>ESTADO: {item.condicion}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {inspeccion.tipo === 'vehicular' && inspeccion.vehicular?.checklist && (
                                <div className="space-y-3">
                                    {inspeccion.vehicular.checklist.map((item, i) => (
                                        <div key={i} className={`flex items-center gap-4 p-4 rounded-xl border ${item.estado === 'Malo' ? 'bg-rose-50 border-rose-100' : item.estado === 'Regular' ? 'bg-amber-50 border-amber-100' : item.estado === 'N/A' ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                            <span className="flex-1 text-[11px] font-black uppercase text-slate-700">{item.item} <span className="text-[8px] text-slate-400">({item.categoria})</span></span>
                                            <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${item.estado === 'Malo' ? 'bg-rose-100 text-rose-700' : item.estado === 'Regular' ? 'bg-amber-100 text-amber-700' : item.estado === 'N/A' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                                                {item.estado}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </FichaSection>
                    </div>

                    <div className="print-break-inside-avoid">
                        <FichaSection title="Evidencia y Observaciones Generales" icon={Camera} accent="slate">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[100px]">
                                <p className="text-[11px] font-bold text-slate-700 uppercase whitespace-pre-wrap">{inspeccion.observaciones || 'SIN OBSERVACIONES REGISTRADAS.'}</p>
                            </div>
                            {inspeccion.fotoEvidencia && inspeccion.fotoEvidencia.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                    {inspeccion.fotoEvidencia.map((foto, idx) => (
                                        <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-slate-200">
                                            <img src={foto} alt={`evidencia-${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </FichaSection>
                    </div>

                    <div className="print-break-inside-avoid">
                        <FichaSection title="Firmas" icon={CheckCircle2} accent="slate">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Inspector HSE</p>
                                    {inspeccion.inspector?.firma ? (
                                        <div className="bg-white p-4 rounded-2xl shadow-sm inline-block">
                                            <img src={inspeccion.inspector.firma} alt="Firma Inspector" className="h-24 object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400">Sin firma</div>
                                    )}
                                    <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase">{inspeccion.inspector?.nombre || inspeccion.creadoPor}</p>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">{inspeccion.inspector?.rut || 'RUT NO REGISTRADO'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trabajador / Conductor</p>
                                    {inspeccion.firmaColaborador?.firma ? (
                                        <div className="bg-white p-4 rounded-2xl shadow-sm inline-block">
                                            <img src={inspeccion.firmaColaborador.firma} alt="Firma Trabajador" className="h-24 object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400">Sin firma (Pendiente regularización)</div>
                                    )}
                                    <div>
                                        <p className="text-[11px] font-black text-slate-900 uppercase">{inspeccion.nombreTrabajador}</p>
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">{inspeccion.rutTrabajador}</p>
                                    </div>
                                </div>
                            </div>
                        </FichaSection>
                    </div>
                </div>

                {/* BOTTOM FIXED BAR - ACCIONES */}
                {inspeccion.estado === 'En Revisión' && (
                    <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white border-t border-slate-100 p-6 flex justify-between gap-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] no-print">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center">Acciones de Jefatura / Prevención</p>
                        <div className="flex gap-4">
                            <button onClick={() => handleUpdateStatus('Rechazado')} disabled={updating} className="px-8 py-3.5 rounded-full border border-rose-200 text-rose-600 bg-rose-50 font-black text-[10px] uppercase hover:bg-rose-100 hover:border-rose-300 transition-all flex items-center gap-2">
                                {updating ? <Loader2 className="animate-spin" size={14} /> : <ThumbsDown size={14} />} Rechazar
                            </button>
                            <button onClick={() => handleUpdateStatus('Aprobado')} disabled={updating} className="px-10 py-3.5 bg-emerald-500 text-white rounded-full font-black uppercase tracking-[0.1em] text-[10px] hover:bg-emerald-600 transition-all shadow-xl flex items-center gap-2">
                                {updating ? <Loader2 className="animate-spin" size={14} /> : <ThumbsUp size={14} />} Aprobar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SlideOverFichaInspeccion;
