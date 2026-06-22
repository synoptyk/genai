import React, { useState, useEffect } from 'react';
import { X, Car, Save, Tag, Calendar, MapPin, UserPlus, FileText, Banknote, ShieldCheck, Activity, UploadCloud, CheckCircle2 } from 'lucide-react';
import telecomApi from '../../telecomApi';
import { formatRut } from '../../../../utils/rutUtils';
import SearchableSelect from '../../../../components/SearchableSelect';

const getDisplayNombre = (persona) => {
  const fromNombre = String(persona?.nombre || '').trim();
  if (fromNombre) return fromNombre;
  const fromNames = `${persona?.nombres || ''} ${persona?.apellidos || ''}`.trim();
  if (fromNames) return fromNames;
  const fromFullName = String(persona?.fullName || persona?.name || '').trim();
  if (fromFullName) return fromFullName;
  const rut = formatRut(persona?.rut || persona?.rutRaw || '');
  return rut ? `RUT ${rut}` : 'Sin Nombre';
};

const initialForm = {
  patente: '', tipoVehiculo: 'Camioneta', marca: '', modelo: '', anio: new Date().getFullYear(),
  proveedor: '', proveedorId: '', rutProveedor: '', tipoContrato: 'Leasing',
  valor: '', moneda: 'CLP',
  estadoOperativo: 'Operativa', estadoLogistico: 'En Patio',
  zona: 'Metropolitana', asignadoA: '', estadoAsignacion: 'Sin Asignar',
  vencimientoRevisionTecnica: '',
  vencimientoPermisoCirculacion: '',
  docRevisionTecnica: '',
  docPermisoCirculacion: '',
  cuponElectronico: 'Sin Cupón',
  numeroCupon: ''
};

export default function SlideOverFicha({ vehiculo, tecnicos, onClose, onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const isEditing = !!vehiculo;

  useEffect(() => {
    telecomApi.get('/flota/proveedores')
      .then(res => setProveedores(res.data))
      .catch(err => console.error("Error fetching proveedores:", err));
  }, []);

  useEffect(() => {
    if (vehiculo) {
      setForm({
        patente: vehiculo.patente, 
        tipoVehiculo: vehiculo.tipoVehiculo || 'Camioneta',
        marca: vehiculo.marca, 
        modelo: vehiculo.modelo, 
        anio: vehiculo.anio || new Date().getFullYear(),
        proveedor: vehiculo.proveedor || '', 
        proveedorId: vehiculo.proveedorId ? (vehiculo.proveedorId._id || vehiculo.proveedorId) : '',
        rutProveedor: vehiculo.rutProveedor || '',
        tipoContrato: vehiculo.tipoContrato || 'Leasing',
        valor: vehiculo.valorLeasing || vehiculo.valor || '', 
        moneda: vehiculo.moneda || 'CLP',
        estadoOperativo: vehiculo.estadoOperativo || 'Operativa',
        estadoLogistico: vehiculo.estadoLogistico || 'En Patio',
        zona: vehiculo.zona || 'Metropolitana',
        asignadoA: vehiculo.asignadoA ? (vehiculo.asignadoA._id || vehiculo.asignadoA) : '',
        estadoAsignacion: vehiculo.estadoAsignacion || 'Sin Asignar',
        vencimientoRevisionTecnica: vehiculo.vencimientoRevisionTecnica ? vehiculo.vencimientoRevisionTecnica.split('T')[0] : '',
        vencimientoPermisoCirculacion: vehiculo.vencimientoPermisoCirculacion ? vehiculo.vencimientoPermisoCirculacion.split('T')[0] : '',
        docRevisionTecnica: vehiculo.docRevisionTecnica || '',
        docPermisoCirculacion: vehiculo.docPermisoCirculacion || '',
        cuponElectronico: vehiculo.cuponElectronico || 'Sin Cupón',
        numeroCupon: vehiculo.numeroCupon || ''
      });
    } else {
      setForm(initialForm);
    }
  }, [vehiculo]);

  const handleBase64Convert = (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patente || !form.marca) return alert("Complete patente y marca.");
    
    setSaving(true);
    const dataFinal = {
      ...form, 
      valorLeasing: form.valor,
      asignadoA: form.asignadoA || null,
      proveedorId: form.proveedorId || null
    };
    if (isEditing) delete dataFinal.patente; // No permitir cambiar patente en edición
    
    try {
      if (isEditing) {
        await telecomApi.put(`/vehiculos/${vehiculo._id}`, dataFinal);
      } else {
        await telecomApi.post('/vehiculos', dataFinal);
      }
      onSuccess();
    } catch (e) {
      alert(`❌ Error: ${e.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const statusColor = form.estadoOperativo === 'Operativa' ? 'emerald' : (form.estadoOperativo === 'Mantencion' ? 'amber' : 'red');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex justify-end">
      <div className="w-full max-w-xl bg-slate-50 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* HEADER PREMIUM */}
        <div className={`p-8 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 relative overflow-hidden`}>
          <div className="absolute -right-10 -top-10 opacity-10">
            <Car size={150} />
          </div>
          <div className="relative z-10">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {isEditing ? 'FICHA DE VEHÍCULO' : 'ALTA DE NUEVA UNIDAD'}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <div className="bg-white text-slate-900 px-3 py-1 rounded border-2 border-slate-300 font-mono font-black tracking-widest text-xl shadow-inner">
                  {form.patente || 'S/P'}
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{form.marca} {form.modelo}</h2>
                  <p className="text-xs text-slate-400">{form.tipoVehiculo} • {form.anio}</p>
                </div>
              </div>
            ) : (
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <Car className="text-blue-400" /> Registro Inicial
              </h2>
            )}
          </div>
          <button onClick={onClose} className="relative z-10 p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <form id="ficha-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* CARD 1: IDENTIFICACIÓN */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Tag size={16} className="text-blue-500" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">1. Identificación</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patente *</label>
                  <input type="text" placeholder="AAAA-99" disabled={isEditing} required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-black text-slate-700 outline-none focus:border-blue-500 uppercase text-sm disabled:opacity-60 disabled:bg-slate-100 font-mono tracking-widest"
                    value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Vehículo</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                    value={form.tipoVehiculo} onChange={e => setForm({ ...form, tipoVehiculo: e.target.value })}>
                    <option value="Camioneta">Camioneta</option>
                    <option value="Furgón">Furgón</option>
                    <option value="Auto">Automóvil</option>
                    <option value="SUV">SUV</option>
                    <option value="Maquinaria">Maquinaria</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Marca *</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm" 
                    placeholder="Peugeot" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modelo *</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm" 
                    placeholder="Partner" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Año de Fabricación</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="number" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                      value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: ESTADO Y LOGÍSTICA */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Activity size={16} className={`text-${statusColor}-500`} />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">2. Estado y Operación</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Condición Mecánica</label>
                  <select className={`w-full bg-${statusColor}-50 border border-${statusColor}-200 rounded-xl py-3 px-3 font-black text-${statusColor}-700 outline-none text-xs`}
                    value={form.estadoOperativo} onChange={e => setForm({ ...form, estadoOperativo: e.target.value })}>
                    <option value="Operativa">🟢 Operativa (Buen Estado)</option>
                    <option value="Mantencion">🟠 En Mantención</option>
                    <option value="Siniestro">🔴 Siniestrado / Dañado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Ubicación Logística</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 font-bold text-slate-600 outline-none focus:border-blue-500 text-xs"
                    value={form.estadoLogistico} onChange={e => setForm({ ...form, estadoLogistico: e.target.value })}>
                    <option value="En Terreno">🚀 En Terreno</option>
                    <option value="En Patio">🅿️ En Patio (Disponible)</option>
                    <option value="Taller">🔧 En Taller Externo</option>
                    <option value="Por Entregar">📋 Por Entregar</option>
                    <option value="Devuelto">🏁 Devuelto al Proveedor</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Zona Geográfica</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                    value={form.zona} onChange={e => setForm({ ...form, zona: e.target.value })} placeholder="Ej: RM Norte, Biobío..." />
                </div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><UserPlus size={14} /> Responsable Asignado</span>
                  {form.estadoAsignacion === 'Asignación Completa' && (
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[9px]">Asignación Completa</span>
                  )}
                  {form.estadoAsignacion === 'Asignación Pendiente' && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px]">Asignación Pendiente</span>
                  )}
                </label>
                <SearchableSelect
                  options={[
                    { value: '', label: '-- DISPONIBLE / SIN ASIGNAR --' },
                    ...tecnicos.map(t => ({ value: t._id, label: getDisplayNombre(t) }))
                  ]}
                  value={form.asignadoA} 
                  onChange={newVal => {
                    setForm({ 
                      ...form, 
                      asignadoA: newVal, 
                      estadoAsignacion: newVal ? (form.estadoAsignacion === 'Asignación Completa' ? 'Asignación Completa' : 'Asignación Pendiente') : 'Sin Asignar' 
                    });
                  }}
                  placeholder="Buscar responsable..."
                />
                <p className="text-[9px] text-indigo-400 mt-2 flex items-center gap-1">
                  * La asignación completa se gestiona vía Checklist formal. Esta opción permite reservas o pre-asignaciones rápidas.
                </p>
              </div>
            </div>

            {/* CARD 3: DOCUMENTACIÓN LEGAL */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <ShieldCheck size={16} className="text-emerald-500" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">3. Documentación Legal</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Revisión Técnica</label>
                  <div className="space-y-3">
                    <input type="date" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                      value={form.vencimientoRevisionTecnica} onChange={e => setForm({ ...form, vencimientoRevisionTecnica: e.target.value })} />
                    
                    {!form.docRevisionTecnica ? (
                      <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200 border-dashed">
                        <UploadCloud size={16} />
                        <span className="text-[10px] font-bold uppercase">Subir Documento</span>
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleBase64Convert(e, 'docRevisionTecnica')} />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 py-2.5 px-3 rounded-lg border border-emerald-200">
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase"><CheckCircle2 size={16} /> Doc. Cargado</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, docRevisionTecnica: '' }))} className="text-red-500 hover:text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Permiso de Circulación</label>
                  <div className="space-y-3">
                    <input type="date" className="w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                      value={form.vencimientoPermisoCirculacion} onChange={e => setForm({ ...form, vencimientoPermisoCirculacion: e.target.value })} />
                    
                    {!form.docPermisoCirculacion ? (
                      <label className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200 border-dashed">
                        <UploadCloud size={16} />
                        <span className="text-[10px] font-bold uppercase">Subir Documento</span>
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => handleBase64Convert(e, 'docPermisoCirculacion')} />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-emerald-50 text-emerald-700 py-2.5 px-3 rounded-lg border border-emerald-200">
                        <span className="flex items-center gap-2 text-[10px] font-bold uppercase"><CheckCircle2 size={16} /> Doc. Cargado</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, docPermisoCirculacion: '' }))} className="text-red-500 hover:text-red-700">
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: CONTRATO Y FINANZAS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Banknote size={16} className="text-purple-500" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">4. Contrato y Financiamiento</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cupón Electrónico de Combustible</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-purple-500 text-sm"
                    value={form.cuponElectronico} onChange={e => setForm({ ...form, cuponElectronico: e.target.value })}>
                    <option value="Sin Cupón">Sin Cupón</option>
                    <option value="Cupón Titular">Cupón Titular</option>
                    <option value="Cupón Reemplazo">Cupón Reemplazo</option>
                  </select>
                </div>
                {form.cuponElectronico === 'Cupón Reemplazo' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Número de Cupón *</label>
                    <input type="text" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-purple-500 text-sm"
                      value={form.numeroCupon} onChange={e => setForm({ ...form, numeroCupon: e.target.value })} placeholder="Ej: 987654321" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Tenencia</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-purple-500 text-sm"
                    value={form.tipoContrato} onChange={e => setForm({ ...form, tipoContrato: e.target.value })}>
                    <option value="Leasing">Leasing Operativo</option>
                    <option value="Arriendo">Arriendo Diario/Mensual</option>
                    <option value="Propio">Vehículo Propio</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Proveedor / Leasing</label>
                  <SearchableSelect
                  options={[
                    { value: '', label: 'Seleccione Proveedor...' },
                    ...proveedores.map(p => ({ value: p._id, label: p.nombre }))
                  ]}
                    value={form.proveedorId} 
                    onChange={selId => {
                      if (!selId) {
                         setForm({ ...form, proveedorId: '', proveedor: '', rutProveedor: '', valor: '', moneda: 'CLP' });
                         return;
                      }
                      const sel = proveedores.find(p => p._id === selId);
                      setForm({ 
                        ...form, 
                        proveedorId: sel?._id || '', 
                        proveedor: sel?.nombre || '', 
                        rutProveedor: sel?.rut || '',
                        moneda: sel?.valores?.monedas?.rentaBase || 'CLP',
                        valor: sel?.valores?.rentaBase || ''
                      });
                    }}
                    placeholder="Buscar proveedor..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">RUT Proveedor</label>
                  <input type="text" readOnly className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-500 outline-none cursor-not-allowed text-sm"
                    value={form.rutProveedor} placeholder="Auto-completado" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Moneda de Pago</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-purple-500 text-sm"
                    value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}>
                    <option value="CLP">Pesos Chilenos (CLP)</option>
                    <option value="UF">UF</option>
                    <option value="USD">Dólares (US$)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Costo Mensual / Tarifa</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">{form.moneda === 'UF' ? 'UF' : form.moneda === 'USD' ? 'US$' : '$'}</span>
                    <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 font-bold text-slate-700 outline-none focus:border-purple-500 text-sm"
                      value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="Ej: 350000" />
                  </div>
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-slate-200 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
            <button type="submit" form="ficha-form" disabled={saving} className={`flex-[2] py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50 ${isEditing ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
              <Save size={18} /> {saving ? 'Guardando Registro...' : (isEditing ? 'Actualizar Ficha' : 'Dar de Alta Vehículo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
