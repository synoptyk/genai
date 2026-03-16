import React from 'react';
import { 
    ShoppingCart, 
    Truck, 
    Calendar, 
    User, 
    ShieldCheck, 
    FileText,
    MapPin,
    Hash,
    Building2,
    CheckCircle2,
    XCircle,
    Clock
} from 'lucide-react';

const PurchaseDocumentView = ({ data, type = 'SC', onClose }) => {
    if (!data) return null;

    const isOC = type === 'OC';
    const statusColors = {
        'Pendiente': 'bg-amber-50 text-amber-600 border-amber-100',
        'Aprobada': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Cotizando': 'bg-indigo-50 text-indigo-600 border-indigo-100',
        'Ordenada': 'bg-sky-50 text-sky-600 border-sky-100',
        'Rechazada': 'bg-rose-50 text-rose-600 border-rose-100',
        'Finalizada': 'bg-slate-50 text-slate-600 border-slate-100'
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header Section */}
                <div className={`p-8 ${isOC ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'} flex items-start justify-between relative`}>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
                                {isOC ? <Truck size={24} /> : <ShoppingCart size={24} />}
                            </div>
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">
                                    {isOC ? 'Orden de Compra' : 'Solicitud de Compra'}
                                </h2>
                                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">
                                    {isOC ? 'Documento Mercantil de Adquisición' : 'Requerimiento Interno de Materiales'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Código</p>
                            <p className="text-xl font-black font-mono">{isOC ? data.codigoOC : data.codigoSC}</p>
                        </div>
                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusColors[data.status] || 'bg-white/20 text-white border-transparent'}`}>
                            {data.status}
                        </span>
                    </div>

                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="p-10 space-y-10 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Metadata Grid */}
                    <div className="grid grid-cols-3 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <User size={12} className="text-indigo-500" /> Emisor / Solicitante
                            </h3>
                            <div>
                                <p className="text-sm font-black text-slate-800">{data.solicitante?.name || data.datosSolicitante?.nombre}</p>
                                <p className="text-[11px] font-bold text-slate-500">{data.datosSolicitante?.cargo || 'Personal Autorizado'}</p>
                                <p className="text-[11px] font-medium text-slate-400 mt-1">{data.solicitante?.email}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Calendar size={12} className="text-indigo-500" /> Tiempos & Control
                            </h3>
                            <div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase">Emisión: <span className="text-slate-800 font-black">{new Date(data.createdAt).toLocaleDateString()}</span></p>
                                <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">Prioridad: <span className={`font-black ${data.prioridad === 'Urgente' ? 'text-rose-600' : 'text-slate-800'}`}>{data.prioridad}</span></p>
                                {data.fechaAprobacion && (
                                    <p className="text-[11px] font-bold text-slate-500 uppercase mt-1">Aprobado: <span className="text-emerald-600 font-black">{new Date(data.fechaAprobacion).toLocaleDateString()}</span></p>
                                )}
                            </div>
                        </div>

                        {data.proveedorSeleccionado && (
                            <div className="space-y-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Building2 size={12} className="text-indigo-500" /> Proveedor Validado
                                </h3>
                                <div>
                                    <p className="text-sm font-black text-slate-800">{data.proveedorSeleccionado.nombre}</p>
                                    <p className="text-[11px] font-bold text-slate-500">{data.proveedorSeleccionado.rut}</p>
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Validado Gen AI</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Detalle de Materiales</h3>
                            {isOC && <span className="text-[12px] font-black text-slate-900 uppercase">Totales Netos (CLP)</span>}
                        </div>
                        <div className="rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Item #</th>
                                        <th className="px-6 py-4">Descripción / Producto</th>
                                        <th className="px-6 py-4 text-center">Cant.</th>
                                        {isOC && (
                                            <>
                                                <th className="px-6 py-4 text-right">Unitario</th>
                                                <th className="px-6 py-4 text-right">Total</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data.items?.map((item, idx) => (
                                        <tr key={idx} className="text-xs group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-5 font-bold text-slate-400">{(idx + 1).toString().padStart(2, '0')}</td>
                                            <td className="px-6 py-5">
                                                <p className="font-black text-slate-800">
                                                    {item.productoRef?.nombre || 'Producto no especificado'} 
                                                    <span className="text-indigo-600 ml-2">[{item.productoRef?.sku}]</span>
                                                </p>
                                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.modelo || 'Modelo General'} {item.serie ? `· S/N: ${item.serie}` : ''}</p>
                                            </td>
                                            <td className="px-6 py-5 text-center font-black text-slate-800">{item.cantidadAutorizada || item.cantidadSolicitada || item.cantidad}</td>
                                            {isOC && (
                                                <>
                                                    <td className="px-6 py-5 text-right font-bold text-slate-600">$ {item.precioUnitario?.toLocaleString()}</td>
                                                    <td className="px-6 py-5 text-right font-black text-indigo-600">$ {(item.subtotal || (item.cantidad * item.precioUnitario))?.toLocaleString()}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                {isOC && (
                                    <tfoot className="bg-slate-900 text-white">
                                        <tr>
                                            <td colSpan="4" className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-white/40">Subtotal Neto</td>
                                            <td className="px-6 py-3 text-right font-black">$ {data.subtotalNeto?.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-t border-white/5">
                                            <td colSpan="4" className="px-6 py-3 text-right text-[9px] font-black uppercase tracking-widest text-white/40">IVA (19%)</td>
                                            <td className="px-6 py-3 text-right font-black">$ {data.iva?.toLocaleString()}</td>
                                        </tr>
                                        <tr className="border-t border-white/10">
                                            <td colSpan="4" className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-white/60">Total Orden de Compra</td>
                                            <td className="px-6 py-5 text-right text-xl font-black text-emerald-400">$ {data.total?.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Bottom Info */}
                    <div className="grid grid-cols-2 gap-8 pt-6">
                        <div className="space-y-3">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText size={12} className="text-indigo-500" /> Observaciones & Justificación
                            </h3>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic text-[11px] font-bold text-slate-600 leading-relaxed">
                                {data.motivo || data.observaciones || "Sin observaciones adicionales registradas en el sistema."}
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center border-l border-slate-100 space-y-4">
                            <div className="text-center">
                                <div className="w-32 h-1 bg-slate-200 mx-auto mb-2 rounded-full" />
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Validación Digital Automática</p>
                                <p className="text-[8px] font-bold text-emerald-500 uppercase mt-1">Sello de Integridad Logística</p>
                            </div>
                            <div className="opacity-10 grayscale select-none flex flex-col items-center">
                                <img src="/logo.png" alt="Gen AI" className="h-4" onError={(e) => e.target.style.display='none'} />
                                <span className="text-[20px] font-black text-slate-900 tracking-tighter mt-1 italic">GEN AI</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-slate-50 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-3">
                            {[1,2,3].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                                    <User size={14} />
                                </div>
                            ))}
                        </div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auditoría: Validado por Sistema & Gerencia</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
                            onClick={() => window.print()}
                        >
                            <FileText size={14} /> Imprimir PDF
                        </button>
                        <button 
                            onClick={onClose}
                            className={`px-8 py-3 ${isOC ? 'bg-slate-900' : 'bg-indigo-600'} text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95`}
                        >
                            Cerrar Vista
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseDocumentView;
