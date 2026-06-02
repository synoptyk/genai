import React, { useState } from 'react';
import { X, ClipboardCheck, AlertTriangle, Search, User, FileText, Camera, Banknote } from 'lucide-react';
import telecomApi from '../../telecomApi';
import FirmaAvanzada from '../../../../components/FirmaAvanzada';
import { formatRut, cleanRut } from '../../../../utils/rutUtils';

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

const ChecklistRow = ({ label, field, value, detalle, onChange, onDetalleChange }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${value !== 'OK' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
    <span className="flex-1 text-xs font-bold text-slate-700 uppercase tracking-tight">{label}</span>
    <select
      value={value} onChange={(e) => onChange(field, e.target.value)}
      className="text-[10px] font-black bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
    >
      <option value="OK">✅ OK</option>
      <option value="Observación">⚠️ Observación</option>
      <option value="Malo">❌ Malo</option>
    </select>
    {value !== 'OK' && (
      <input
        type="text" placeholder="Detalle..."
        value={detalle || ''} onChange={(e) => onDetalleChange(field, e.target.value)}
        className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 outline-none flex-1 min-w-0"
      />
    )}
  </div>
);

export default function SlideOverChecklist({ vehiculo, tecnicos, tipo, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [maxStepAllowed, setMaxStepAllowed] = useState(1);
  const [tecnicoId, setTecnicoId] = useState(vehiculo.asignadoA?._id || vehiculo.asignadoA || '');
  const [conductorRut, setConductorRut] = useState(vehiculo.asignadoA?.rut || '');
  const [conductorNombre, setConductorNombre] = useState(vehiculo.asignadoA?.nombre || '');
  const [conductorCargo, setConductorCargo] = useState(vehiculo.asignadoA?.cargo || '');
  
  const [fechaAsignacion, setFechaAsignacion] = useState(new Date().toISOString().split('T')[0]);
  
  const [quienReportaTipo, setQuienReportaTipo] = useState('Conductor Asignado');
  const [quienReportaRut, setQuienReportaRut] = useState('');
  const [quienReportaNombre, setQuienReportaNombre] = useState('');
  const [quienReportaCargo, setQuienReportaCargo] = useState('');
  const [quienReportaTecnicoId, setQuienReportaTecnicoId] = useState('');

  const [km, setKm] = useState('');
  const [combustible, setCombustible] = useState('1/2');
  const [cuponElectronico, setCuponElectronico] = useState(vehiculo?.cuponElectronico || 'Sin Cupón');
  const [numeroCupon, setNumeroCupon] = useState(vehiculo?.numeroCupon || '');
  const [proyecto, setProyecto] = useState('');
  const [lugar, setLugar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [emailPersonal, setEmailPersonal] = useState('');
  
  const [fotos, setFotos] = useState({ frontal: null, trasera: null, lateralIzq: null, lateralDer: null, tablero: null, adicionales: [] });
  const [firma, setFirma] = useState(null);
  const [saving, setSaving] = useState(false);

  // Módulo Recepción
  const [origenRecepcion, setOrigenRecepcion] = useState('Trabajador');
  const [subMotivoRecepcion, setSubMotivoRecepcion] = useState('');
  const [detallesRecepcion, setDetallesRecepcion] = useState('');

  const initItems = {
    lucesPrincipales: 'OK', lucesIntermitentes: 'OK', lucesReversa: 'OK',
    limpiaParabrisas: 'OK', espejoIzq: 'OK', vidriosLaterales: 'OK',
    carroceria: 'OK', taponesLlantas: 'OK', bocina: 'OK', cinturones: 'OK',
    calefaccion: 'OK', nivelAceite: 'OK', nivelRefrigerante: 'OK',
    nivelLiquidoFrenos: 'OK', estadoBateria: 'OK', chalecoReflectante: 'OK',
    docPadron: 'OK', docSoap: 'OK', docInspeccionTec: 'OK'
  };
  const [items, setItems] = useState(initItems);
  const [detalles, setDetalles] = useState({});

  const updateItem = (field, val) => setItems(prev => ({ ...prev, [field]: val }));
  const updateDetalle = (field, val) => setDetalles(prev => ({ ...prev, [field]: val }));

  const handleRutSearch = (e) => {
    const rawRut = e.target.value;
    const clean = cleanRut(rawRut);
    const fRut = formatRut(clean);
    
    const tec = tecnicos.find(t => cleanRut(t.rut || t.rutRaw || '') === clean);
    setConductorRut(fRut);
    setTecnicoId(tec ? tec._id : '');
    setConductorNombre(tec ? (tec.nombre || tec.nombres || '') : conductorNombre);
    setConductorCargo(tec ? (tec.cargo || '') : conductorCargo);
    setProyecto(tec && tec.proyecto ? tec.proyecto : proyecto);
    setLugar(tec && tec.sede ? tec.sede : lugar);
    setEmailPersonal(tec && tec.email ? tec.email : emailPersonal);
  };

  const handleReportadorRutSearch = (e) => {
    const rawRut = e.target.value;
    const clean = cleanRut(rawRut);
    const fRut = formatRut(clean);
    
    const tec = tecnicos.find(t => cleanRut(t.rut || t.rutRaw || '') === clean);
    setQuienReportaRut(fRut);
    setQuienReportaTecnicoId(tec ? tec._id : '');
    setQuienReportaNombre(tec ? (tec.nombre || tec.nombres || '') : quienReportaNombre);
    setQuienReportaCargo(tec ? (tec.cargo || '') : quienReportaCargo);
  };

  const handleBase64Convert = (files, callback, limit = 1, currentCount = 0) => {
    const validFiles = Array.from(files).slice(0, limit - currentCount);
    if (validFiles.length === 0) return;

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => callback(reader.result);
      reader.readAsDataURL(file);
    });
  };

  const ITEMS_CONFIG = [
    { label: 'Luces principales', field: 'lucesPrincipales' },
    { label: 'Luces intermitentes', field: 'lucesIntermitentes' },
    { label: 'Luces reversa', field: 'lucesReversa' },
    { label: 'Limpiaparabrisas', field: 'limpiaParabrisas' },
    { label: 'Espejos', field: 'espejoIzq' },
    { label: 'Vidrios laterales', field: 'vidriosLaterales' },
    { label: 'Carrocería', field: 'carroceria' },
    { label: 'Neumáticos / tapones', field: 'taponesLlantas' },
    { label: 'Bocina', field: 'bocina' },
    { label: 'Cinturones', field: 'cinturones' },
    { label: 'A/C y calefacción', field: 'calefaccion' },
    { label: 'Nivel aceite', field: 'nivelAceite' },
    { label: 'Nivel refrigerante', field: 'nivelRefrigerante' },
    { label: 'Líquido frenos', field: 'nivelLiquidoFrenos' },
    { label: 'Batería', field: 'estadoBateria' },
    { label: 'Chaleco reflectante', field: 'chalecoReflectante' },
    { label: 'Permiso de circulación', field: 'docPadron' },
    { label: 'SOAP', field: 'docSoap' },
    { label: 'Revisión técnica', field: 'docInspeccionTec' },
  ];

  const handleSaveGenerales = async () => {
    if (!tecnicoId) return alert('Selecciona un conductor.');
    setSaving(true);
    try {
      await telecomApi.put(`/vehiculos/${vehiculo._id}`, {
        asignadoA: tecnicoId,
        estadoAsignacion: 'Asignación Pendiente',
        observacionAsignacion: `Pre-asignación registrada desde Checklist Paso 1`
      });
      alert('Datos generales guardados correctamente. (Asignación Pendiente)');
      onSuccess();
    } catch (e) {
      alert('Error al guardar datos generales: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!tecnicoId) return alert('Selecciona un conductor.');
    if (!firma) return alert('Se requiere la firma del conductor.');
    setSaving(true);
    try {
      const res = await telecomApi.post(`/vehiculos/${vehiculo._id}/checklist`, {
        tecnicoId,
        conductorRut,
        conductorNombre,
        conductorCargo,
        fechaAsignacion,
        quienReportaTipo,
        quienReportaRut,
        quienReportaNombre,
        quienReportaCargo,
        tipo,
        checklist: {
          ...items,
          detallesItems: detalles,
          kilometraje: parseInt(km) || 0,
          combustible,
          cuponElectronico,
          numeroCupon,
          proyecto,
          lugar,
          observaciones,
        },
        fotos,
        emailPersonal,
        firmaColaborador: firma?.imagenBase64 || firma,
        origenRecepcion: tipo === 'Recepción' ? origenRecepcion : undefined,
        subMotivoRecepcion: tipo === 'Recepción' ? subMotivoRecepcion : undefined,
        detallesRecepcion: tipo === 'Recepción' ? detallesRecepcion : undefined
      });
      alert(`✅ Checklist registrado. Código: ${res.data.qrCodeId}`);
      onSuccess(res.data.documento);
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const colortipo = tipo === 'Asignación' ? 'indigo' : (tipo === 'Recepción' ? 'amber' : 'emerald');
  const issues = Object.values(items).filter(v => v !== 'OK').length;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        <div className={`p-8 bg-${colortipo}-600 text-white flex items-center justify-between flex-shrink-0`}>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{tipo}</div>
            <h2 className="text-2xl font-black tracking-tight">{vehiculo.patente}</h2>
            <p className="text-sm text-white/70">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-black/20 rounded-full hover:bg-black/30 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 flex-shrink-0 bg-slate-50">
          {['Datos Generales', 'Inspección', 'Evidencia', 'Firma'].map((label, i) => {
            const stepNum = i + 1;
            const isAllowed = stepNum <= maxStepAllowed;
            return (
              <button key={i} onClick={() => isAllowed && setStep(stepNum)} disabled={!isAllowed}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all
                ${step === stepNum ? `text-${colortipo}-600 border-b-2 border-${colortipo}-600 bg-white` : (isAllowed ? 'text-slate-500 hover:text-slate-800' : 'text-slate-300 opacity-50 cursor-not-allowed')}`}>
                {stepNum}. {label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              
              {tipo === 'Recepción' && (
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 mb-6">
                  <div className="border-b border-amber-200 pb-2 mb-4 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" /> 
                    <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest">Contexto de la Recepción</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">¿De dónde viene el vehículo? *</label>
                      <select className="w-full bg-white border border-amber-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-amber-500"
                        value={origenRecepcion} onChange={e => setOrigenRecepcion(e.target.value)}>
                        <option value="Trabajador">De un Trabajador / Conductor</option>
                        <option value="Taller">De un Taller (Terminó Mantención)</option>
                        <option value="Proveedor">De Proveedor (Leasing/Rent a Car)</option>
                        <option value="Otro">Otro Origen</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">Motivo / Estado Específico *</label>
                      {origenRecepcion === 'Trabajador' ? (
                        <select className="w-full bg-white border border-amber-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-amber-500"
                          value={subMotivoRecepcion} onChange={e => setSubMotivoRecepcion(e.target.value)}>
                          <option value="">Seleccione motivo...</option>
                          <option value="Finiquito / Despido">Finiquito / Término de Contrato</option>
                          <option value="Vacaciones">Vacaciones</option>
                          <option value="Licencia Médica">Licencia Médica</option>
                          <option value="Cambio de Vehículo">Cambio de Vehículo</option>
                          <option value="Otro">Otro Motivo</option>
                        </select>
                      ) : (
                        <input type="text" placeholder="Ej: Mantención 10k o N° Contrato..." 
                          className="w-full bg-white border border-amber-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-amber-500"
                          value={subMotivoRecepcion} onChange={e => setSubMotivoRecepcion(e.target.value)} />
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-amber-700 uppercase tracking-widest block mb-2">Detalles Adicionales de Recepción (Opcional)</label>
                      <input type="text" placeholder="Ej: Entregado con retraso, o costo de taller $150.000..." 
                        className="w-full bg-white border border-amber-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-amber-500"
                        value={detallesRecepcion} onChange={e => setDetallesRecepcion(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-200">
                <div className="md:col-span-2 border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                  <User size={16} className={`text-${colortipo}-500`} /> 
                  <h3 className="text-sm font-black text-slate-800">{tipo === 'Recepción' && origenRecepcion !== 'Trabajador' ? 'Datos de Quien Entrega' : 'Conductor Asignado'}</h3>
                </div>
                <div className="md:col-span-1">
                  <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>RUT del Conductor *</label>
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-${colortipo}-400`} size={16} />
                    <input type="text" required placeholder="Ej: 12.345.678-9"
                      className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none text-sm font-bold focus:border-${colortipo}-500`}
                      value={conductorRut} onChange={handleRutSearch} />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Nombre Completo *</label>
                  <input type="text" required className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500 read-only:bg-slate-100 read-only:text-slate-500`}
                    value={conductorNombre} onChange={e => setConductorNombre(e.target.value)} readOnly={!!tecnicoId} />
                </div>
                <div className="md:col-span-1">
                  <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Cargo *</label>
                  <input type="text" required className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500 read-only:bg-slate-100 read-only:text-slate-500`}
                    value={conductorCargo} onChange={e => setConductorCargo(e.target.value)} readOnly={!!tecnicoId} />
                </div>
                <div className="md:col-span-1">
                  <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Proyecto / OT</label>
                  <input type="text" className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500 read-only:bg-slate-100 read-only:text-slate-500`}
                    value={proyecto} onChange={e => setProyecto(e.target.value)} placeholder="Ej: Proyecto Norte Q1" readOnly={!!tecnicoId} />
                </div>
                <div className="md:col-span-2">
                  <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Fecha de {tipo} *</label>
                  <input type="date" required className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500`}
                    value={fechaAsignacion} onChange={e => setFechaAsignacion(e.target.value)} />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200">
                <div className="border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                  <ClipboardCheck size={16} className={`text-${colortipo}-500`} /> 
                  <h3 className="text-sm font-black text-slate-800">¿Quién realiza este checklist?</h3>
                </div>
                <div>
                  <select className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500`}
                    value={quienReportaTipo} onChange={e => setQuienReportaTipo(e.target.value)}>
                    <option value="Conductor Asignado">El Mismo Conductor Asignado</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Administrador de Flota">Administrador de Flota</option>
                  </select>
                </div>

                {quienReportaTipo !== 'Conductor Asignado' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="md:col-span-2">
                      <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>RUT del Reportador *</label>
                      <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-${colortipo}-400`} size={16} />
                        <input type="text" required placeholder="Ej: 12.345.678-9"
                          className={`w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 outline-none text-sm font-bold focus:border-${colortipo}-500`}
                          value={quienReportaRut} onChange={handleReportadorRutSearch} />
                      </div>
                    </div>
                    <div>
                      <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Nombre Completo *</label>
                      <input type="text" required className={`w-full bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500 read-only:bg-slate-100 read-only:text-slate-500`}
                        value={quienReportaNombre} onChange={e => setQuienReportaNombre(e.target.value)} readOnly={!!quienReportaTecnicoId} />
                    </div>
                    <div>
                      <label className={`text-[10px] font-black text-${colortipo}-700 uppercase tracking-widest block mb-2`}>Cargo *</label>
                      <input type="text" required className={`w-full bg-white border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-${colortipo}-500 read-only:bg-slate-100 read-only:text-slate-500`}
                        value={quienReportaCargo} onChange={e => setQuienReportaCargo(e.target.value)} readOnly={!!quienReportaTecnicoId} />
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">KM Actual</label>
                  <input type="number" value={km} onChange={e => setKm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500" placeholder="Ej: 85420" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nivel de Combustible</label>
                  <select value={combustible} onChange={e => setCombustible(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500">
                    {['Reserva', '1/4', '1/2', '3/4', 'Lleno'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 bg-white p-5 rounded-2xl border border-slate-200">
                <div className="col-span-2 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Banknote size={16} className={`text-${colortipo}-500`} /> 
                  <h3 className="text-sm font-black text-slate-800">Cupón de Combustible</h3>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Cupón Electrónico</label>
                  <select value={cuponElectronico} onChange={e => setCuponElectronico(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500">
                    <option value="Sin Cupón">Sin Cupón</option>
                    <option value="Cupón Titular">Cupón Titular</option>
                    <option value="Cupón Reemplazo">Cupón Reemplazo</option>
                  </select>
                </div>
                {cuponElectronico !== 'Sin Cupón' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nº de Cupón *</label>
                    <input type="text" value={numeroCupon} onChange={e => setNumeroCupon(e.target.value)} required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500" placeholder="Ej: 987654321" />
                  </div>
                ) : (
                  <div></div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Lugar de {tipo}</label>
                  <input type="text" value={lugar} onChange={e => setLugar(e.target.value)} readOnly={!!tecnicoId && tipo !== 'Recepción'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500 read-only:bg-slate-100 read-only:text-slate-500" placeholder="Ej: Bodega Central o Sede..." />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email Personal Conductor</label>
                  <input type="email" value={emailPersonal} onChange={e => setEmailPersonal(e.target.value)} readOnly={!!tecnicoId}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold focus:border-blue-500 read-only:bg-slate-100 read-only:text-slate-500" placeholder="conductor@empresa.cl" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
              {issues > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-amber-700">{issues} observación(es) detectada(s)</span>
                </div>
              )}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 bg-slate-50 p-2 rounded-lg">🔌 Eléctrico / Exterior</p>
              {ITEMS_CONFIG.slice(0, 8).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-6 mb-3 bg-slate-50 p-2 rounded-lg">🔧 Interior / Motor / Seguridad</p>
              {ITEMS_CONFIG.slice(8, 16).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-6 mb-3 bg-slate-50 p-2 rounded-lg">📄 Documentos</p>
              {ITEMS_CONFIG.slice(16).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <div className="mt-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mt-4">Observaciones Generales</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold h-24 resize-none focus:border-blue-500"
                  placeholder="Notas adicionales del vehículo..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-xs font-black text-amber-700">Evidencias Fotográficas Requeridas. </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'frontal', label: 'Frontal', required: true },
                  { id: 'trasera', label: 'Trasera', required: true },
                  { id: 'lateralIzq', label: 'Lateral Izquierdo', required: true },
                  { id: 'lateralDer', label: 'Lateral Derecho', required: true },
                  { id: 'tablero', label: 'Tablero / KM', required: true }
                ].map(fotoReq => (
                  <div key={fotoReq.id}>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{fotoReq.label}</label>
                    {!fotos[fotoReq.id] ? (
                      <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-${colortipo}-200 rounded-xl bg-${colortipo}-50 hover:bg-${colortipo}-100 cursor-pointer transition-colors`}>
                        <Camera size={20} className={`mb-1 text-${colortipo}-400`} />
                        <span className={`text-[10px] font-bold text-${colortipo}-700`}>Capturar Foto</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden" 
                          onChange={(e) => handleBase64Convert(e.target.files, (res) => setFotos(f => ({...f, [fotoReq.id]: res})), 1, 0)} />
                      </label>
                    ) : (
                      <div className={`relative w-full h-24 rounded-xl overflow-hidden border border-${colortipo}-200`}>
                        <img src={fotos[fotoReq.id]} alt={fotoReq.label} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setFotos(f => ({...f, [fotoReq.id]: null}))} className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1"><X size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <FirmaAvanzada
                label="Firma Digital del Conductor"
                onSave={(payload) => setFirma(payload)}
                colorAccent={colortipo}
              />
              <div className={`p-4 bg-${colortipo}-50 border border-${colortipo}-100 rounded-2xl`}>
                <p className={`text-[10px] font-black text-${colortipo}-600 uppercase tracking-widest mb-1`}>Al confirmar:</p>
                <ul className={`text-xs text-${colortipo}-700 space-y-1 list-disc list-inside`}>
                  <li>Se registrará en el historial del vehículo y quedará inmutable.</li>
                  <li>Se enviará un comprobante por email al conductor y supervisor.</li>
                  <li>Se actualizará el estado operativo/logístico de la unidad.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-white">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-all">
              Atrás
            </button>
          )}
          {step < 4 ? (
            <div className="flex-1 flex gap-2">
              {step === 1 && (
                <button onClick={handleSaveGenerales} disabled={saving}
                  className={`flex-1 py-4 bg-white text-${colortipo}-600 border-2 border-${colortipo}-600 rounded-xl font-black text-[10px] uppercase hover:bg-${colortipo}-50 transition-all disabled:opacity-50`}>
                  {saving ? 'Guardando...' : 'Guardar Pre-Asignación'}
                </button>
              )}
              <button onClick={() => {
                if (step === 1) {
                  if (tipo === 'Recepción' && (!origenRecepcion || !subMotivoRecepcion)) return alert('Complete los campos obligatorios de la recepción.');
                  if (!conductorRut || !conductorNombre) return alert('Seleccione y confirme al conductor.');
                  if (!fechaAsignacion) return alert('La fecha es obligatoria.');
                }
                if (step === 2) {
                  if (!km) return alert('Ingrese el kilometraje actual.');
                }
                if (step === 3) {
                  if (!fotos.frontal || !fotos.trasera || !fotos.lateralIzq || !fotos.lateralDer || !fotos.tablero) {
                    return alert('Debe capturar todas las evidencias fotográficas requeridas.');
                  }
                }
                setStep(s => s + 1);
                setMaxStepAllowed(prev => Math.max(prev, step + 1));
              }}
                className={`flex-1 py-4 bg-${colortipo}-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-${colortipo}-700 shadow-lg shadow-${colortipo}-200 transition-all`}>
                Siguiente Paso
              </button>
            </div>
          ) : (
            <button onClick={handleSubmit} disabled={saving || !fotos.frontal || !fotos.trasera || !fotos.lateralIzq || !fotos.lateralDer || !fotos.tablero}
              className={`flex-1 py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase hover:bg-emerald-600 shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50`}>
              <ClipboardCheck size={18} />
              {saving ? 'Guardando Registro...' : `Confirmar y Procesar`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
