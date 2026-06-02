import React from 'react';
import { X, Printer, Download, MapPin, User, Car, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { formatRut } from '../../../../utils/rutUtils';

export default function SlideOverDocumentoPdf({ documento, vehiculo, onClose }) {
  if (!documento || !vehiculo) return null;

  const isSiniestro = documento._tipoDoc === 'siniestro' || documento.hasOwnProperty('gravedad');
  
  const handlePrint = () => {
    window.print();
  };

  const renderSignature = (title, name, rut, signImage, date) => (
    <div className="flex flex-col items-center justify-end h-40 mt-8">
      {signImage ? (
        <img src={signImage} alt={`Firma de ${name}`} className="h-20 object-contain mb-2 border-b-2 border-slate-900 px-4" />
      ) : (
        <div className="h-20 w-48 border-b-2 border-slate-900 mb-2"></div>
      )}
      <p className="text-xs font-black uppercase text-slate-800">{name || 'Nombre'}</p>
      <p className="text-[10px] text-slate-500 uppercase">RUT: {rut || 'S/N'}</p>
      <p className="text-[10px] font-bold text-slate-400 mt-1">{title}</p>
      {date && <p className="text-[9px] text-slate-400 mt-0.5">{new Date(date).toLocaleString('es-ES')}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 sm:p-8 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto print:inset-auto">
      
      {/* TOOLBAR (Hidden when printing) */}
      <div className="fixed top-4 right-4 flex gap-3 print:hidden z-50">
        <button onClick={handlePrint} className="bg-blue-600 text-white px-5 py-3 rounded-full font-black text-sm uppercase tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95">
          <Printer size={18} /> Imprimir / PDF
        </button>
        <button onClick={onClose} className="bg-slate-800 text-white p-3 rounded-full shadow-xl hover:bg-slate-700 transition-transform hover:scale-105 active:scale-95">
          <X size={20} />
        </button>
      </div>

      {/* DOCUMENT SHEET (A4 Simulation) */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-2xl relative mx-auto print:shadow-none print:max-w-none print:w-full print:m-0">
        
        {/* HEADER */}
        <div className="p-8 border-b-4 border-slate-900 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
              {isSiniestro ? 'Reporte de Siniestro' : `Acta de ${documento.tipo || 'Checklist'}`}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
              Flota de Vehículos • Agente Telecom
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Documento</p>
            <p className="text-sm font-bold text-slate-800">{documento._id?.slice(-8).toUpperCase()}</p>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(documento.fecha || documento.fechaSiniestro || documento.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
            </p>
          </div>
        </div>

        {/* BODY */}
        <div className="p-8 space-y-8">
          
          {/* VEHICLE INFO */}
          <section>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Información del Vehículo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Patente</p>
                <p className="text-sm font-black text-slate-900">{vehiculo.patente}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Marca / Modelo</p>
                <p className="text-sm font-bold text-slate-800">{vehiculo.marca} {vehiculo.modelo}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Año</p>
                <p className="text-sm font-bold text-slate-800">{vehiculo.anio || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold">Kilometraje Reg.</p>
                <p className="text-sm font-bold text-slate-800">{documento.kmActual ? `${documento.kmActual.toLocaleString()} km` : 'No registrado'}</p>
              </div>
            </div>
          </section>

          {/* INVOLVED PERSONNEL */}
          <section>
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Personal Involucrado</h2>
            <div className="bg-slate-50 p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User size={14} className="text-blue-500" />
                  <p className="text-[10px] font-black text-slate-600 uppercase">Conductor Asignado</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{documento.conductorNombre || 'N/A'}</p>
                <p className="text-xs text-slate-500">RUT: {formatRut(documento.conductorRut || '')}</p>
                {documento.conductorCargo && <p className="text-xs text-slate-500">Cargo: {documento.conductorCargo}</p>}
                {documento.conductorCargo && <p className="text-xs text-slate-500">Cargo: {documento.conductorCargo}</p>}
                {documento.proyecto && <p className="text-xs text-slate-500">Proyecto: {documento.proyecto}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <p className="text-[10px] font-black text-slate-600 uppercase">Supervisor / Administrador</p>
                </div>
                <p className="text-sm font-bold text-slate-900">{documento.quienReportaNombre || 'N/A'}</p>
                <p className="text-xs text-slate-500">RUT: {formatRut(documento.quienReportaRut || '')}</p>
                {documento.quienReportaCargo && <p className="text-xs text-slate-500">Cargo: {documento.quienReportaCargo}</p>}
              </div>
            </div>
          </section>

          {/* RECEPTION CONTEXT (If Applicable) */}
          {documento.tipo === 'Recepción' && documento.origenRecepcion && (
            <section>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Contexto de la Recepción</h2>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[9px] text-amber-600 uppercase font-bold">Origen</p>
                  <p className="text-sm font-black text-amber-900 uppercase">{documento.origenRecepcion}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-600 uppercase font-bold">Motivo / Ref.</p>
                  <p className="text-sm font-bold text-amber-900">{documento.subMotivoRecepcion || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-600 uppercase font-bold">Detalles Extras</p>
                  <p className="text-sm font-bold text-amber-900">{documento.detallesRecepcion || 'Sin detalles adicionales'}</p>
                </div>
              </div>
            </section>
          )}

          {/* DYNAMIC CONTENT BASED ON TYPE */}
          {isSiniestro ? (
            <section>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                <ShieldAlert size={14} className="text-red-500" /> Detalles del Siniestro
              </h2>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 bg-red-50 p-4 rounded-xl border border-red-100">
                  <div>
                    <p className="text-[9px] text-red-500 uppercase font-bold">Gravedad</p>
                    <p className="text-base font-black text-red-700 uppercase">{documento.gravedad}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-red-500 uppercase font-bold">Fecha Siniestro</p>
                    <p className="text-sm font-bold text-red-900">
                      {documento.fechaSiniestro ? new Date(documento.fechaSiniestro).toLocaleDateString('es-ES') : 'N/A'} a las {documento.horaSiniestro || 'N/A'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] text-red-500 uppercase font-bold">Motivo Daño</p>
                    <p className="text-sm font-bold text-red-900">{documento.motivoDano} {documento.motivoDanoOtro && `- ${documento.motivoDanoOtro}`}</p>
                  </div>
                  {documento.tipoDano && (
                    <div className="col-span-2">
                      <p className="text-[9px] text-red-500 uppercase font-bold">Tipo de Daño</p>
                      <p className="text-sm font-bold text-red-900">{documento.tipoDano} {documento.tipoDanoOtro && `- ${documento.tipoDanoOtro}`}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-bold mb-1">Descripción de los hechos</p>
                  <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl">{documento.descripcion || 'Sin descripción'}</p>
                </div>
                
                {documento.lugar && (
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><MapPin size={10} /> Ubicación</p>
                    <p className="text-sm font-medium text-slate-700">{documento.lugar}</p>
                  </div>
                )}
                
                {documento.evaluacionIA && (
                  <div className="mt-6 bg-gradient-to-r from-violet-50 to-fuchsia-50 p-6 rounded-xl border border-violet-200">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🤖</span>
                      <h3 className="text-xs font-black text-violet-800 uppercase tracking-widest">Auditoría IA de Fraude</h3>
                    </div>
                    <p className="text-sm font-medium text-violet-900 mb-4">{documento.evaluacionIA.analisis}</p>
                    <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-violet-100 mb-4">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Nivel de Riesgo:</span>
                      <span className={`text-xs font-black px-3 py-1 rounded-md ${
                        documento.evaluacionIA.nivelRiesgo === 'Alto' ? 'bg-red-100 text-red-700' : 
                        documento.evaluacionIA.nivelRiesgo === 'Medio' ? 'bg-amber-100 text-amber-700' : 
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {documento.evaluacionIA.nivelRiesgo}
                      </span>
                    </div>
                    {documento.evaluacionIA.sugerenciasAccion?.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Acciones Sugeridas:</span>
                        <ul className="text-xs text-slate-700 list-disc pl-5 space-y-1">
                          {documento.evaluacionIA.sugerenciasAccion.map((sug, i) => (
                            <li key={i}>{sug}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section>
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">Revisión Vehicular</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-[9px] text-slate-500 uppercase font-bold mb-2">Nivel Combustible</p>
                  <p className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg inline-block">{documento.nivelCombustible || 'N/A'}</p>
                </div>
                <div className="col-span-2 md:col-span-3">
                  <p className="text-[9px] text-slate-500 uppercase font-bold mb-2">Observaciones</p>
                  <p className="text-sm font-medium text-slate-700 bg-slate-50 p-4 rounded-xl">{documento.observacion || 'Ninguna observación reportada.'}</p>
                </div>
              </div>

              {/* Toggles List */}
              {documento.itemsChecklist && Object.keys(documento.itemsChecklist).length > 0 && (
                <div className="mt-6">
                  <p className="text-[9px] text-slate-500 uppercase font-bold mb-3">Ítems de Revisión</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                    {Object.entries(documento.itemsChecklist).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center border-b border-slate-100 pb-1">
                        <span className="text-[11px] font-bold text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-[11px] font-black text-slate-800">{value ? '✓ B/E' : 'X M/E'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SIGNATURES */}
          <section className="pt-8 mt-12 border-t-2 border-dashed border-slate-200 break-inside-avoid">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-6">Firmas de Conformidad</h2>
            <div className="flex justify-around items-end gap-8">
              {renderSignature(
                'Firma Conductor / Entregador', 
                documento.conductorNombre || (documento.tipo === 'Recepción' && documento.origenRecepcion !== 'Trabajador' ? documento.quienReportaNombre : 'N/A'), 
                formatRut(documento.conductorRut || ''), 
                documento.firmaColaborador || documento.firmaConductor || documento.firmaInvolucrado,
                documento.fecha || documento.createdAt
              )}
              {documento.firmaSupervisor && renderSignature(
                'Firma Supervisor / Recepcionista', 
                documento.quienReportaNombre, 
                formatRut(documento.quienReportaRut || ''), 
                documento.firmaSupervisor,
                documento.fechaFirmaSupervisor || documento.fecha || documento.createdAt
              )}
            </div>
            {documento.geolocalizacionFirma && (
              <p className="text-[9px] text-center text-slate-400 mt-8 font-mono">
                Geolocalización: Lat {documento.geolocalizacionFirma.lat?.toFixed(6)}, Lng {documento.geolocalizacionFirma.lng?.toFixed(6)} | Precisión: {documento.geolocalizacionFirma.accuracy}m
              </p>
            )}
            <p className="text-[8px] text-center text-slate-300 mt-2">Documento generado por AgenteTelecom® Flota Control.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
