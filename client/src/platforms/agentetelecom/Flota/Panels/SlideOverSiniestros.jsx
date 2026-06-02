import React, { useState, useEffect } from 'react';
import { X, AlertOctagon, Camera, Search, User, MapPin, Info, Car, FileText, Crosshair, MapPinned } from 'lucide-react';
import telecomApi from '../../telecomApi';
import { formatRut, cleanRut } from '../../../../utils/rutUtils';
import SignatureCanvas from 'react-signature-canvas';

export default function SlideOverSiniestros({ vehiculo, tecnicos, onClose, onSuccess }) {
  const [form, setForm] = useState({
    // Sección 1
    conductorRut: '', conductorNombre: '', conductorCargo: '', conductorProyecto: '', tecnicoId: '',
    // Sección 2
    fechaSiniestro: new Date().toISOString().slice(0, 10), horaSiniestro: '', region: '', comuna: '', calle: '', numero: '', referencia: '',
    // Sección 3
    motivoDano: 'Otro', motivoEspecifico: '', 
    terceroRut: '', terceroNombre: '', terceroPatente: '', terceroResponsabilidad: 'No definida',
    // Sección 4
    // Sección 4
    gravedad: '', tipoDano: '', danoEspecifico: '', descripcion: '',
    // Sección 7
    quienReportaTipo: 'Involucrado', quienReportaRut: '', quienReportaNombre: '', quienReportaCargo: ''
  });

  const [saving, setSaving] = useState(false);
  const [fotosGenerales, setFotosGenerales] = useState([]); // max 4
  const [fotoLicenciaFrontal, setFotoLicenciaFrontal] = useState(null);
  const [fotoLicenciaPosterior, setFotoLicenciaPosterior] = useState(null);
  const [fotosTercero, setFotosTercero] = useState([]);
  
  const [ubicacionGeo, setUbicacionGeo] = useState(null);
  const sigCanvas = React.useRef(null);

  // Auto-fill conductor details if assigned
  useEffect(() => {
    if (vehiculo.asignadoA) {
      const tec = tecnicos.find(t => t._id === (vehiculo.asignadoA._id || vehiculo.asignadoA));
      if (tec) {
        setForm(f => ({
          ...f,
          tecnicoId: tec._id,
          conductorRut: formatRut(tec.rut || tec.rutRaw || ''),
          conductorNombre: tec.nombre || tec.nombres || '',
          conductorCargo: tec.cargo || '',
          conductorProyecto: tec.proyecto || '',
          conductorEmail: tec.email || ''
        }));
      }
    }
  }, [vehiculo, tecnicos]);

  const handleRutSearch = (e) => {
    const rawRut = e.target.value;
    const clean = cleanRut(rawRut);
    const fRut = formatRut(clean);
    
    // Search in tecnicos
    const tec = tecnicos.find(t => cleanRut(t.rut || t.rutRaw || '') === clean);
    setForm(f => ({
      ...f,
      conductorRut: fRut,
      tecnicoId: tec ? tec._id : '',
      conductorNombre: tec ? (tec.nombre || tec.nombres || '') : f.conductorNombre,
      conductorCargo: tec ? (tec.cargo || '') : f.conductorCargo,
      conductorProyecto: tec ? (tec.proyecto || '') : f.conductorProyecto,
      conductorEmail: tec ? (tec.email || '') : f.conductorEmail
    }));
  };

  const handleReportadorRutSearch = (e) => {
    const rawRut = e.target.value;
    const clean = cleanRut(rawRut);
    const fRut = formatRut(clean);
    
    const tec = tecnicos.find(t => cleanRut(t.rut || t.rutRaw || '') === clean);
    setForm(f => ({
      ...f,
      quienReportaRut: fRut,
      quienReportaTecnicoId: tec ? tec._id : '',
      quienReportaNombre: tec ? (tec.nombre || tec.nombres || '') : f.quienReportaNombre,
      quienReportaCargo: tec ? (tec.cargo || '') : f.quienReportaCargo
    }));
  };

  const handleBase64Convert = (files, callback, limit = 4, currentCount = 0) => {
    const validFiles = Array.from(files).slice(0, limit - currentCount);
    if (validFiles.length === 0) return;
    
    const promises = validFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(base64Files => callback(base64Files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descripcion || !form.fechaSiniestro || !form.gravedad || !form.motivoDano) {
      return alert("Complete los campos obligatorios (*).");
    }
    
    setSaving(true);
    const firmaData = sigCanvas.current && !sigCanvas.current.isEmpty() ? sigCanvas.current.toDataURL('image/png') : null;

    try {
      const res = await telecomApi.post(`/vehiculos/${vehiculo._id}/siniestro`, {
        ...form,
        fotos: fotosGenerales,
        fotoLicenciaFrontal,
        fotoLicenciaPosterior,
        fotosTercero: fotosTercero,
        firmaColaborador: firmaData,
        ubicacionGeo
      });
      alert(`✅ Siniestro reportado correctamente.`);
      onSuccess(res.data);
    } catch (error) {
      alert(`❌ Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        
        {/* Header */}
        <div className="p-6 bg-red-600 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-red-200 mb-1 flex items-center gap-1">
              <AlertOctagon size={12} /> Formulario Siniestro
            </div>
            <h2 className="text-2xl font-black tracking-tight">{vehiculo.patente}</h2>
            <p className="text-sm text-red-100">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-black/20 rounded-full hover:bg-black/30 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <form id="siniestro-form" onSubmit={handleSubmit} className="space-y-8">
            
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
              <AlertOctagon className="text-red-500 mt-0.5" size={20} />
              <div>
                <p className="text-xs font-black text-red-800">El vehículo será bloqueado operativamente.</p>
                <p className="text-xs text-red-700 mt-1">
                  Por favor, completa la mayor cantidad de información posible. Los campos marcados con (*) son obligatorios.
                </p>
              </div>
            </div>

            {/* GEO BUTTON */}
            {!ubicacionGeo ? (
              <button type="button" 
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => setUbicacionGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date() }),
                      (err) => alert("No se pudo obtener la ubicación. Verifique los permisos del navegador.")
                    );
                  }
                }}
                className="w-full flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
                <Crosshair size={18} /> Obtener Coordenadas Actuales (Requerido para Firma)
              </button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-bold">
                <MapPinned size={18} /> 
                <span>Ubicación registrada: {ubicacionGeo.lat.toFixed(6)}, {ubicacionGeo.lng.toFixed(6)} (Precisión: {Math.round(ubicacionGeo.accuracy)}m)</span>
              </div>
            )}

            {/* SECCIÓN 1: CONDUCTOR */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <User size={16} className="text-blue-500" /> Sección 1: Conductor del Vehículo
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">RUT del Conductor *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" required placeholder="Ej: 12.345.678-9"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none text-sm font-bold focus:border-red-500"
                      value={form.conductorRut} onChange={handleRutSearch} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Digita el RUT para autocompletar si es un técnico registrado.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre Completo *</label>
                    <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500 read-only:bg-slate-100 read-only:text-slate-500"
                      value={form.conductorNombre} onChange={e => setForm({...form, conductorNombre: e.target.value})} readOnly={!!form.tecnicoId} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cargo *</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500 read-only:bg-slate-100 read-only:text-slate-500"
                      value={form.conductorCargo} onChange={e => setForm({...form, conductorCargo: e.target.value})} readOnly={!!form.tecnicoId} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Proyecto asociado</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500 read-only:bg-slate-100 read-only:text-slate-500"
                      value={form.conductorProyecto} onChange={e => setForm({...form, conductorProyecto: e.target.value})} readOnly={!!form.tecnicoId} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email Personal (Para copia)</label>
                    <input type="email" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500 read-only:bg-slate-100 read-only:text-slate-500"
                      placeholder="conductor@empresa.cl"
                      value={form.conductorEmail} onChange={e => setForm({...form, conductorEmail: e.target.value})} readOnly={!!form.tecnicoId} />
                  </div>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: LUGAR Y TIEMPO */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <MapPin size={16} className="text-emerald-500" /> Sección 2: Cuándo y Dónde
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fecha *</label>
                  <input type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.fechaSiniestro} onChange={e => setForm({...form, fechaSiniestro: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hora *</label>
                  <input type="time" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.horaSiniestro} onChange={e => setForm({...form, horaSiniestro: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Región *</label>
                  <input type="text" required placeholder="Ej: Región Metropolitana" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.region} onChange={e => setForm({...form, region: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Comuna *</label>
                  <input type="text" required placeholder="Ej: Providencia" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.comuna} onChange={e => setForm({...form, comuna: e.target.value})} />
                </div>
                <div className="md:col-span-2 flex gap-4">
                  <div className="flex-[3]">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Calle / Avenida *</label>
                    <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                      value={form.calle} onChange={e => setForm({...form, calle: e.target.value})} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número</label>
                    <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                      value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Referencia de Dirección</label>
                  <input type="text" placeholder="Ej: Esquina con Tobalaba, frente al banco" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} />
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: MOTIVO */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Info size={16} className="text-amber-500" /> Sección 3: Motivo del Daño
              </h3>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Motivo Principal *</label>
                <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                  value={form.motivoDano} onChange={e => setForm({...form, motivoDano: e.target.value})}>
                  <option value="">-- Selecciona --</option>
                  <option value="Colisión con tercero">💥 Colisión con tercero</option>
                  <option value="Colisión con objeto">🧱 Colisión con objeto fijo</option>
                  <option value="Robo">🦹 Robo / Vandalismo</option>
                  <option value="Otro">❓ Otro</option>
                </select>
              </div>

              {form.motivoDano === 'Otro' && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Especifique el Motivo *</label>
                  <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.motivoEspecifico} onChange={e => setForm({...form, motivoEspecifico: e.target.value})} />
                </div>
              )}

              {form.motivoDano === 'Colisión con tercero' && (
                <div className="mt-6 p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-2"><Car size={14} /> Información del Tercero Involucrado</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">RUT Tercero *</label>
                      <input type="text" required placeholder="Ej: 11.222.333-4" className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-amber-500"
                        value={form.terceroRut} onChange={e => setForm({...form, terceroRut: formatRut(e.target.value)})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">Patente Vehículo Tercero *</label>
                      <input type="text" required className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-amber-500 uppercase"
                        value={form.terceroPatente} onChange={e => setForm({...form, terceroPatente: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">Nombre Completo Tercero *</label>
                      <input type="text" required className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-amber-500"
                        value={form.terceroNombre} onChange={e => setForm({...form, terceroNombre: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">¿De quién es la responsabilidad? *</label>
                      <select required className="w-full bg-white border border-amber-300 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-amber-500"
                        value={form.terceroResponsabilidad} onChange={e => setForm({...form, terceroResponsabilidad: e.target.value})}>
                        <option value="No definida">No definida / En evaluación</option>
                        <option value="Nuestra">Nuestra (Vehículo Flota)</option>
                        <option value="Del Tercero">Del Tercero Involucrado</option>
                        <option value="Compartida">Compartida</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 mt-2">
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">Fotos (Carnet y Daños Tercero) - Máx 4</label>
                      <label className="flex items-center justify-center w-full h-12 border-2 border-dashed border-amber-400 rounded-xl bg-white hover:bg-amber-100 cursor-pointer transition-colors">
                        <Camera size={18} className="text-amber-600 mr-2" />
                        <span className="text-xs font-bold text-amber-700">Capturar Fotos Tercero</span>
                        <input type="file" accept="image/*" capture="environment" multiple className="hidden" 
                          onChange={(e) => handleBase64Convert(e.target.files, (newFotos) => setFotosTercero(prev => [...prev, ...newFotos]), 4, fotosTercero.length)} />
                      </label>
                      
                      {fotosTercero.length > 0 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto">
                          {fotosTercero.map((foto, idx) => (
                            <div key={idx} className="relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-amber-300">
                              <img src={foto} alt={`Tercero ${idx}`} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setFotosTercero(fotosTercero.filter((_, i) => i !== idx))} className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5"><X size={10} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SECCIÓN 4: GRAVEDAD Y TIPO DE DAÑO */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <AlertOctagon size={16} className="text-red-500" /> Sección 4: Daños del Vehículo
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Gravedad *</label>
                  <select required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.gravedad} onChange={e => setForm({...form, gravedad: e.target.value})}>
                    <option value="">-- Selecciona Gravedad --</option>
                    <option value="Leve">🟡 Leve (Topón/Raya)</option>
                    <option value="Moderado">🟠 Moderado (Daño visible)</option>
                    <option value="Grave">🔴 Grave (No manejable)</option>
                    <option value="Pérdida Total">💀 Pérdida Total</option>
                  </select>
                </div>

                {form.gravedad && (
                  <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Tipo de Daño *</label>
                      <select required className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-red-500"
                        value={form.tipoDano} onChange={e => setForm({...form, tipoDano: e.target.value})}>
                        <option value="">-- Tipo --</option>
                        <option value="Carrocería">Carrocería (Abolladuras, rayas)</option>
                        <option value="Cristales">Cristales (Parabrisas, ventanas)</option>
                        <option value="Accesorio">Accesorio (Espejos, luces, parachoques)</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>
                    {form.tipoDano && (
                      <div className="animate-in fade-in">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Especifique Pieza o Daño *</label>
                        <input type="text" required placeholder="Ej: Foco delantero izquierdo roto" className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none text-sm font-bold focus:border-red-500"
                          value={form.danoEspecifico} onChange={e => setForm({...form, danoEspecifico: e.target.value})} />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Relato / Descripción de los hechos *</label>
                  <textarea required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500 h-24 resize-none" placeholder="Relato detallado de cómo ocurrieron los hechos..."
                    value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} />
                </div>
              </div>
            </section>

            {/* SECCIÓN 5 y 6: EVIDENCIA FOTOGRÁFICA */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <Camera size={16} className="text-indigo-500" /> Sección 5 y 6: Evidencia
              </h3>
              
              <div className="space-y-6">
                {/* Licencia */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Licencia (Frontal)</label>
                    {!fotoLicenciaFrontal ? (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                        <FileText size={20} className="mb-1 text-indigo-400" />
                        <span className="text-[10px] font-bold text-indigo-700">Capturar Frontal</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden" 
                          onChange={(e) => handleBase64Convert(e.target.files, (res) => setFotoLicenciaFrontal(res[0]), 1, 0)} />
                      </label>
                    ) : (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-indigo-200">
                        <img src={fotoLicenciaFrontal} alt="Licencia Frontal" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setFotoLicenciaFrontal(null)} className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Licencia (Posterior)</label>
                    {!fotoLicenciaPosterior ? (
                      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                        <FileText size={20} className="mb-1 text-indigo-400" />
                        <span className="text-[10px] font-bold text-indigo-700">Capturar Posterior</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden" 
                          onChange={(e) => handleBase64Convert(e.target.files, (res) => setFotoLicenciaPosterior(res[0]), 1, 0)} />
                      </label>
                    ) : (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-indigo-200">
                        <img src={fotoLicenciaPosterior} alt="Licencia Posterior" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setFotoLicenciaPosterior(null)} className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidencia Vehiculo */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex justify-between">
                    <span>Fotos del Vehículo y Sitio del Suceso *</span>
                    <span className="text-slate-500">{fotosGenerales.length} / 4 Fotos</span>
                  </label>
                  {fotosGenerales.length < 4 && (
                    <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 cursor-pointer transition-colors mb-3">
                      <Camera size={24} className="mb-1 text-slate-400" />
                      <p className="text-xs font-bold text-slate-600">Abrir Cámara</p>
                      <input type="file" accept="image/*" capture="environment" multiple className="hidden" 
                        onChange={(e) => handleBase64Convert(e.target.files, (newFotos) => setFotosGenerales(prev => [...prev, ...newFotos]), 4, fotosGenerales.length)} />
                    </label>
                  )}
                  
                  {fotosGenerales.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {fotosGenerales.map((foto, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                          <img src={foto} alt={`Evidencia ${idx}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setFotosGenerales(fotosGenerales.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1 shadow-sm hover:bg-red-600">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* SECCIÓN 7: QUIÉN REPORTA */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                <User size={16} className="text-blue-500" /> Sección 7: ¿Quién realiza este reporte?
              </h3>
              <div className="space-y-4">
                <div>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-red-500"
                    value={form.quienReportaTipo} onChange={e => setForm({...form, quienReportaTipo: e.target.value})}>
                    <option value="Involucrado">El Involucrado / Conductor</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Administrador de Flota">Administrador de Flota</option>
                  </select>
                </div>

                {form.quienReportaTipo !== 'Involucrado' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest block mb-2">RUT del Reportador *</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
                        <input type="text" required placeholder="Ej: 12.345.678-9"
                          className="w-full bg-white border border-blue-200 rounded-xl py-3 pl-10 pr-4 outline-none text-sm font-bold focus:border-blue-500"
                          value={form.quienReportaRut} onChange={handleReportadorRutSearch} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest block mb-2">Nombre Completo *</label>
                      <input type="text" required className="w-full bg-white border border-blue-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500 read-only:bg-slate-100 read-only:text-slate-500"
                        value={form.quienReportaNombre} onChange={e => setForm({...form, quienReportaNombre: e.target.value})} readOnly={!!form.quienReportaTecnicoId} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest block mb-2">Cargo *</label>
                      <input type="text" required className="w-full bg-white border border-blue-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500 read-only:bg-slate-100 read-only:text-slate-500"
                        value={form.quienReportaCargo} onChange={e => setForm({...form, quienReportaCargo: e.target.value})} readOnly={!!form.quienReportaTecnicoId} />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* SECCIÓN 8: FIRMA */}
            <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 mb-4 border-b border-slate-100 pb-2">Sección 8: Declaración y Firma</h3>
              <p className="text-xs text-slate-500 mb-4">
                Declaro que la información proporcionada es fidedigna. Entiendo que ocultar o falsificar información constituye una falta grave.
              </p>
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none h-48 mb-2">
                <SignatureCanvas 
                  ref={sigCanvas}
                  canvasProps={{ className: 'w-full h-full' }}
                  backgroundColor="rgb(248 250 252)"
                />
              </div>
              <div className="flex justify-between items-center">
                <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline uppercase tracking-widest">
                  Limpiar Firma
                </button>
                {!ubicacionGeo && <span className="text-xs text-red-500 font-bold flex items-center gap-1"><AlertOctagon size={14}/> Requiere Geo-Posición</span>}
              </div>
            </section>

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <button type="button" onClick={onClose} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-all">
            Cancelar
          </button>
          <button type="submit" form="siniestro-form" disabled={saving || fotosGenerales.length === 0 || !ubicacionGeo} 
            className="flex-1 py-4 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 shadow-xl shadow-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
            <AlertOctagon size={18} />
            {saving ? 'Procesando Reporte...' : 'Declarar Siniestro y Bloquear'}
          </button>
        </div>
      </div>
    </div>
  );
}
