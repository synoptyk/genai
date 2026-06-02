import React, { useState } from 'react';
import { X, ShieldCheck, GraduationCap, AlertTriangle, FileText, Printer, User, MapPin, CheckCircle2, Loader2, ThumbsUp, ThumbsDown, Camera } from 'lucide-react';
import { astApi } from '../prevencionApi';

const FichaSection = ({ title, icon: Icon, children, accent = "slate" }) => {
    const accents = {
        slate: 'bg-slate-100 text-slate-600',
        rose: 'bg-rose-100 text-rose-600',
        indigo: 'bg-indigo-100 text-indigo-600',
        emerald: 'bg-emerald-100 text-emerald-600'
    };
    return (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${accents[accent] || accents.slate}`}>
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
        <div className="w-full px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 font-bold text-[11px] uppercase text-slate-700 break-words whitespace-pre-wrap">
            {value || 'NO INDICADO'}
        </div>
    </div>
);

const SlideOverFichaEvento = ({ isOpen, onClose, evento, onStatusChange, showActions = false }) => {
    const [updating, setUpdating] = useState(false);

    if (!isOpen || !evento) return null;

    // Normalizamos el evento, ya que puede venir de Historial (ev.id, ev.tipo, ev.titulo, ...) 
    // o venir crudo de HseAudit (ast._id, ot, empresa...)
    
    const isRawAST = evento.ot !== undefined; // Si viene crudo de AST
    const tipo = isRawAST ? 'AST' : evento.tipo;
    const rawData = isRawAST ? evento : (evento.rawData || evento);

    const accent = tipo === 'AST' ? 'indigo' : tipo === 'Charla' ? 'emerald' : 'rose';
    const IconoPrincipal = tipo === 'AST' ? ShieldCheck : tipo === 'Charla' ? GraduationCap : AlertTriangle;

    const handlePrint = () => window.print();

    const handleUpdateStatus = async (nuevoEstado) => {
        if (!isRawAST && tipo !== 'AST') return; // Por ahora solo aprobamos ASTs
        setUpdating(true);
        try {
            await astApi.update(rawData._id || rawData.id, { estado: nuevoEstado, fechaAprobacion: new Date() });
            if (onStatusChange) onStatusChange();
            onClose();
        } catch (e) {
            console.error('Error updating status:', e);
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
                        <div className={`p-4 rounded-2xl ${accent === 'indigo' ? 'bg-indigo-100 text-indigo-600' : accent === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            <IconoPrincipal size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter">
                                Expediente {tipo}
                            </h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">ID: {rawData._id || rawData.id}</p>
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
                    <div className="hidden pb-8 border-b border-slate-200 mb-8" style={{ display: 'none' }}>
                        <h1 className="text-3xl font-black text-slate-900 uppercase">REPORTE {tipo}</h1>
                        <p className="text-sm font-bold text-slate-500">ID: {rawData._id || rawData.id}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        {[['Estado', rawData.estado || 'Finalizado'], ['Fecha', new Date(rawData.createdAt || rawData.fecha || Date.now()).toLocaleString()], ['Empresa', rawData.empresa || 'GENAI360'], ['OT / Proyecto', rawData.ot || rawData.proyecto || 'General']].map(([l, v]) => (
                            <div key={l} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{l}</p>
                                <p className={`text-[12px] font-black uppercase mt-1 ${v === 'En Revisión' ? 'text-amber-600' : v === 'Rechazado' ? 'text-rose-600' : 'text-slate-700'}`}>{v}</p>
                            </div>
                        ))}
                    </div>

                    {/* VISTA AST */}
                    {tipo === 'AST' && (
                        <>
                            <FichaSection title="Identificación del Trabajador" icon={User} accent="indigo">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <DataField label="Trabajador" value={rawData.nombreTrabajador} />
                                    <DataField label="RUT" value={rawData.rutTrabajador} />
                                    <DataField label="Cargo" value={rawData.cargoTrabajador} />
                                    <DataField label="Email" value={rawData.emailTrabajador} />
                                    <DataField label="Comuna / Lugar" value={`${rawData.comuna || ''} ${rawData.calle || ''} ${rawData.numero || ''}`.trim()} />
                                    <DataField label="Coordenadas GPS" value={rawData.gps} />
                                </div>
                            </FichaSection>

                            <FichaSection title="Análisis de Seguridad" icon={ShieldCheck} accent="indigo">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Riesgos Identificados</p>
                                        <div className="flex flex-col gap-2">
                                            {(rawData.riesgosSeleccionados || []).map((r, i) => (
                                                <div key={i} className="px-4 py-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-3">
                                                    <AlertTriangle size={14} /> {r}
                                                </div>
                                            ))}
                                            {(!rawData.riesgosSeleccionados || rawData.riesgosSeleccionados.length === 0) && <span className="text-xs text-slate-400 font-bold uppercase">Sin riesgos especificados</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">EPP Verificado</p>
                                        <div className="flex flex-col gap-2">
                                            {(rawData.eppVerificado || []).map((e, i) => (
                                                <div key={i} className="px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase flex items-center gap-3">
                                                    <CheckCircle2 size={14} /> {e}
                                                </div>
                                            ))}
                                            {(!rawData.eppVerificado || rawData.eppVerificado.length === 0) && <span className="text-xs text-slate-400 font-bold uppercase">Sin EPP especificado</span>}
                                        </div>
                                    </div>
                                </div>
                                {rawData.controlMedidas && (
                                    <div className="mt-6">
                                        <DataField label="Medidas de Control Adicionales" value={rawData.controlMedidas} />
                                    </div>
                                )}
                            </FichaSection>

                            {rawData.fotos && rawData.fotos.length > 0 && (
                                <FichaSection title="Evidencia Fotográfica" icon={Camera} accent="slate">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                                        {rawData.fotos.map((foto, idx) => (
                                            <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-slate-200">
                                                <img src={foto} alt={`evidencia-${idx}`} className="w-full h-full object-cover" />
                                            </div>
                                        ))}
                                    </div>
                                </FichaSection>
                            )}

                            <div className="print-break-inside-avoid">
                                <FichaSection title="Firmas" icon={CheckCircle2} accent="slate">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Aprobación HSE</p>
                                            {rawData.estado === 'Aprobado' ? (
                                                <div className="bg-emerald-50 text-emerald-600 px-6 py-3 rounded-2xl border border-emerald-200 mt-4 flex items-center gap-2">
                                                    <CheckCircle2 size={16} /> <span className="text-[10px] font-black uppercase">Aprobado / Visado</span>
                                                </div>
                                            ) : (
                                                <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400">Sin firma / En Revisión</div>
                                            )}
                                        </div>
                                        <div className="space-y-4 text-center p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Firma Colaborador</p>
                                            {rawData.firmaColaborador ? (
                                                <div className="bg-white p-4 rounded-2xl shadow-sm inline-block">
                                                    <img src={rawData.firmaColaborador} alt="Firma Trabajador" className="h-24 object-contain" />
                                                </div>
                                            ) : (
                                                <div className="h-24 flex items-center justify-center text-[10px] font-bold text-slate-400">Sin firma manual</div>
                                            )}
                                            <div>
                                                <p className="text-[11px] font-black text-slate-900 uppercase">{rawData.nombreTrabajador}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase">{rawData.rutTrabajador}</p>
                                            </div>
                                        </div>
                                    </div>
                                </FichaSection>
                            </div>
                        </>
                    )}

                    {/* TODO: Add sections for Charla and Incidente when needed */}
                    {tipo !== 'AST' && (
                        <div className="text-center p-12 text-slate-400 font-black text-xs uppercase tracking-widest bg-slate-50 rounded-3xl border border-slate-100">
                            <IconoPrincipal size={48} className="mx-auto mb-4 opacity-50" />
                            Vista detallada de {tipo} disponible.
                            <br />
                            <span className="text-[10px] font-bold mt-2">ID: {rawData.id} | Responsable: {rawData.responsable}</span>
                        </div>
                    )}
                </div>

                {/* BOTTOM FIXED BAR - ACCIONES */}
                {showActions && rawData.estado === 'En Revisión' && tipo === 'AST' && (
                    <div className="fixed bottom-0 right-0 w-full max-w-4xl bg-white border-t border-slate-100 p-6 flex justify-between gap-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] no-print">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center">Auditoría / Validación HSE</p>
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

export default SlideOverFichaEvento;
