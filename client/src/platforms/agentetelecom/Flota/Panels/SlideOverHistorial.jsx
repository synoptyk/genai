import React, { useState, useEffect } from 'react';
import { X, History, MapPin, User, CheckCircle2, AlertOctagon, Car, FileText } from 'lucide-react';
import telecomApi from '../../telecomApi';
import SlideOverDocumentoPdf from './SlideOverDocumentoPdf';

export default function SlideOverHistorial({ vehiculo, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docToShow, setDocToShow] = useState(null);

  useEffect(() => {
    Promise.all([
      telecomApi.get(`/vehiculos/${vehiculo._id}/historial`),
      telecomApi.get(`/vehiculos/${vehiculo._id}/siniestros`),
      telecomApi.get(`/vehiculos/${vehiculo._id}/checklists`)
    ]).then(([resH, resS, resC]) => {
      const hist = resH.data.map(h => ({ ...h, _source: 'historial' }));
      const sin = resS.data.map(s => ({ ...s, _tipoDoc: 'siniestro', fecha: s.fechaSiniestro, _source: 'siniestro' }));
      const chk = resC.data.map(c => ({ ...c, _tipoDoc: 'checklist', _source: 'checklist' }));
      
      // Match historial entries to checklists to avoid duplicates, or just use checklists for Assignments/Devolutions.
      // Since checklists are the rich version of historial entries for Assigments/Devolutions, 
      // let's just use Checklists + Siniestros for the timeline, and add Historial items that don't match a checklist.
      // A simple heuristic: if a checklist exists within 5 mins of an historial entry of the same type, ignore the historial entry.
      // Actually, to make it robust and simple:
      const combined = [...sin, ...chk].sort((a, b) => new Date(b.fecha || b.fechaSiniestro || b.createdAt) - new Date(a.fecha || a.fechaSiniestro || a.createdAt));
      
      setHistorial(combined);
    }).catch(console.error).finally(() => setLoading(false));
  }, [vehiculo._id]);

  const getIcon = (item) => {
    if (item._tipoDoc === 'siniestro') return <AlertOctagon size={16} className="text-red-500" />;
    if (item.tipo === 'Asignación' || item.tipo === 'Checklist Asignación') return <User size={16} className="text-blue-500" />;
    if (item.tipo === 'Devolución' || item.tipo === 'Checklist Devolución') return <CheckCircle2 size={16} className="text-emerald-500" />;
    return <History size={16} className="text-slate-500" />;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-md bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        <div className="p-8 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <History size={12} /> Timeline del Vehículo
            </div>
            <h2 className="text-2xl font-black tracking-tight">{vehiculo.patente}</h2>
            <p className="text-sm text-slate-400">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative">
          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div></div>
          ) : historial.length === 0 ? (
            <div className="text-center text-slate-400 py-10 font-bold text-sm">No hay registros en el historial.</div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-10">
              {historial.map((item, idx) => (
                <div key={idx} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute -left-[17px] top-1 h-8 w-8 rounded-full bg-white border-4 border-slate-50 flex items-center justify-center shadow-sm">
                    {getIcon(item)}
                  </div>
                  
                  {item._tipoDoc === 'siniestro' ? (
                    <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-red-600 uppercase tracking-widest px-2 py-1 bg-red-50 rounded-md">
                          Siniestro: {item.gravedad}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(item.fechaSiniestro || item.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium mb-3">{item.descripcion}</p>
                      
                      <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                          <User size={14} /> <span>Conductor: <span className="text-slate-800">{item.conductorNombre || item.tecnico?.nombre || 'Desconocido'}</span></span>
                        </div>
                        {item.lugar && (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                            <MapPin size={14} /> <span>Lugar: <span className="text-slate-800">{item.lugar}</span></span>
                          </div>
                        )}
                      </div>

                      {item.evaluacionIA && (
                        <div className="mb-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-4 rounded-xl border border-violet-100 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">🤖</span>
                            <h4 className="text-xs font-black text-violet-800 uppercase tracking-widest">Auditoría IA de Fraude</h4>
                          </div>
                          <p className="text-sm font-medium text-violet-900 mb-2">{item.evaluacionIA.analisis}</p>
                          <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-violet-100">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Nivel de Riesgo:</span>
                            <span className={`text-xs font-black px-2 py-1 rounded-md ${
                              item.evaluacionIA.nivelRiesgo === 'Alto' ? 'bg-red-100 text-red-700' : 
                              item.evaluacionIA.nivelRiesgo === 'Medio' ? 'bg-amber-100 text-amber-700' : 
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.evaluacionIA.nivelRiesgo}
                            </span>
                          </div>
                          {item.evaluacionIA.sugerenciasAccion?.length > 0 && (
                            <div className="mt-3">
                              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Acciones Sugeridas:</span>
                              <ul className="text-xs text-slate-700 list-disc pl-4 space-y-1">
                                {item.evaluacionIA.sugerenciasAccion.map((sug, i) => (
                                  <li key={i}>{sug}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={() => setDocToShow(item)} className="w-full py-2.5 bg-red-50 text-red-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                        <FileText size={16} /> Ver Documento Completo
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{item.tipo || 'Acta de Flota'}</span>
                        <span className="text-[10px] font-bold text-slate-400">{new Date(item.fecha || item.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {item.observacion && <p className="text-sm text-slate-600 mb-3">{item.observacion}</p>}
                      
                      <div className="flex flex-col gap-1.5 text-xs mb-4">
                        <div className="flex items-center gap-2 font-bold text-slate-500">
                          <User size={12} /> <span className="w-16">Conductor:</span> <span className="text-slate-800">{item.conductorNombre || item.tecnico?.nombre || item.tecnico?.nombres || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-slate-500">
                          <CheckCircle2 size={12} /> <span className="w-16">Supervisor:</span> <span className="text-slate-800">{item.quienReportaNombre || item.supervisor?.name || 'Sistema'}</span>
                        </div>
                        {item.kmActual && (
                          <div className="flex items-center gap-2 font-bold text-slate-500">
                            <Car size={12} /> <span className="w-16">KMs:</span> <span className="text-slate-800">{item.kmActual.toLocaleString()} km</span>
                          </div>
                        )}
                      </div>

                      <button onClick={() => setDocToShow(item)} className="w-full py-2.5 bg-blue-50 text-blue-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                        <FileText size={16} /> Ver Documento Completo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {docToShow && (
        <SlideOverDocumentoPdf 
          documento={docToShow} 
          vehiculo={vehiculo} 
          onClose={() => setDocToShow(null)} 
        />
      )}
    </div>
  );
}
