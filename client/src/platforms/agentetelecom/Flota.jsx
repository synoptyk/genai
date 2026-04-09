import React, { useState, useEffect, useRef, useCallback } from 'react';
import telecomApi from './telecomApi';
import * as XLSX from 'xlsx';
import {
  Car, Truck, Save, Trash2, Tag,
  Upload, FileSpreadsheet, Download,
  Edit3, Search, LayoutGrid, List, X,
  UserPlus, UserMinus, Calendar, MapPin,
  ClipboardCheck, ClipboardList, History,
  CheckCircle2, AlertTriangle, Camera, Clock
} from 'lucide-react';
import FirmaAvanzada from '../../components/FirmaAvanzada';
import { useAuth } from '../auth/AuthContext';


// ─── Checklist Item Row ─────────────────────────────────────────────────────────
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

// ─── Checklist Modal ────────────────────────────────────────────────────────────
const ChecklistModal = ({ vehiculo, tecnicos, tipo, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1=meta, 2=items, 3=fotos/firma
  const [tecnicoId, setTecnicoId] = useState(vehiculo.asignadoA?._id || vehiculo.asignadoA || '');
  const [km, setKm] = useState('');
  const [combustible, setCombustible] = useState('1/2');
  const [proyecto, setProyecto] = useState('');
  const [lugar, setLugar] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [emailPersonal, setEmailPersonal] = useState('');
  const [firma, setFirma] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async () => {
    if (!tecnicoId) return alert('Selecciona un conductor.');
    if (!firma) return alert('Se requiere la firma del conductor.');
    setSaving(true);
    try {
      const res = await telecomApi.post(`/vehiculos/${vehiculo._id}/checklist`, {
        tecnicoId,
        tipo,
        checklist: {
          ...items,
          detallesItems: detalles,
          kilometraje: parseInt(km) || 0,
          combustible,
          proyecto,
          lugar,
          observaciones,
        },
        fotos: {},
        emailPersonal,
        firmaColaborador: firma?.imagenBase64 || firma
      });
      alert(`✅ Checklist registrado. Código: ${res.data.qrCodeId}`);
      onSuccess();
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
    }
  };

  const colortipo = tipo === 'Asignación' ? 'indigo' : 'slate';
  const issues = Object.values(items).filter(v => v !== 'OK').length;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        {/* Header */}
        <div className={`p-8 bg-${colortipo}-600 text-white flex items-center justify-between flex-shrink-0`}>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">{tipo}</div>
            <h2 className="text-2xl font-black tracking-tight">{vehiculo.patente}</h2>
            <p className="text-sm text-white/70">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-black/20 rounded-2xl hover:bg-black/30 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex border-b border-slate-100 flex-shrink-0">
          {['Datos', 'Inspección', 'Firma'].map((label, i) => (
            <button key={i} onClick={() => setStep(i + 1)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all
              ${step === i + 1 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Conductor</label>
                <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold">
                  <option value="">-- Seleccionar --</option>
                  {tecnicos.map(t => <option key={t._id} value={t._id}>{t.nombre} ({t.rut})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">KM Actual</label>
                  <input type="number" value={km} onChange={e => setKm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold" placeholder="Ej: 85420" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Combustible</label>
                  <select value={combustible} onChange={e => setCombustible(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold">
                    {['Reserva', '1/4', '1/2', '3/4', 'Lleno'].map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Proyecto / OT</label>
                <input type="text" value={proyecto} onChange={e => setProyecto(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold" placeholder="Ej: Proyecto Norte Q1" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Lugar de Entrega</label>
                <input type="text" value={lugar} onChange={e => setLugar(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold" placeholder="Ej: Bodega Central" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Email Personal Conductor (para notificación)</label>
                <input type="email" value={emailPersonal} onChange={e => setEmailPersonal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold" placeholder="conductor@empresa.cl" />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {issues > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span className="text-xs font-black text-amber-700">{issues} observación(es) detectada(s)</span>
                </div>
              )}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">🔌 Eléctrico / Exterior</p>
              {ITEMS_CONFIG.slice(0, 8).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-3">🔧 Interior / Motor / Seguridad</p>
              {ITEMS_CONFIG.slice(8, 16).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4 mb-3">📄 Documentos</p>
              {ITEMS_CONFIG.slice(16).map(item => (
                <ChecklistRow key={item.field} {...item} value={items[item.field]} detalle={detalles[item.field]} onChange={updateItem} onDetalleChange={updateDetalle} />
              ))}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 mt-4">Observaciones Generales</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none text-sm font-bold h-24 resize-none"
                  placeholder="Notas adicionales del vehículo..." />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <FirmaAvanzada
                label="Firma Digital del Conductor"
                onSave={(payload) => setFirma(payload)}
                colorAccent="indigo"
              />
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Al confirmar:</p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Se registrará en el historial del vehículo</li>
                  <li>Se enviará email al conductor, supervisor y admin</li>
                  <li>El estado logístico del vehículo se actualizará</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all">
              Atrás
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-indigo-700 transition-all">
              Siguiente →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
              <ClipboardCheck size={16} />
              {saving ? 'Guardando...' : `Confirmar ${tipo}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── History Modal ──────────────────────────────────────────────────────────────
const HistoryModal = ({ vehiculo, onClose }) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    telecomApi.get(`/vehiculos/${vehiculo._id}/historial`)
      .then(r => setHistorial(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [vehiculo._id]);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl z-[200] flex items-center justify-end">
      <div className="h-full w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-400">
        <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Historial de Asignaciones</div>
            <h2 className="text-xl font-black">{vehiculo.patente}</h2>
            <p className="text-sm text-slate-400">{vehiculo.marca} {vehiculo.modelo}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : historial.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <History size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase text-sm">Sin historial registrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historial.map((h, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${h.tipo === 'Asignación' ? 'bg-indigo-500' : h.tipo === 'Devolución' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {i < historial.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                  </div>
                  <div className="pb-6 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${h.tipo === 'Asignación' ? 'bg-indigo-50 text-indigo-700' : h.tipo === 'Devolución' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {h.tipo}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock size={10} /> {new Date(h.fecha).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-800">{h.tecnico?.nombre || 'N/A'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{h.tecnico?.rut}</p>
                    {h.observacion && <p className="text-xs text-slate-500 mt-1 italic">"{h.observacion}"</p>}
                    {h.kmRegistrado && <p className="text-[10px] text-slate-400 mt-1">KM: {h.kmRegistrado.toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Fleet Management ──────────────────────────────────────────────────────
const GestionFlota = () => {
  const { user } = useAuth();
  const [vehiculos, setVehiculos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState('manual');
  const [vista, setVista] = useState('list');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [editandoId, setEditandoId] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const fileInputRef = useRef(null);
  const [checklistModal, setChecklistModal] = useState(null); // { vehiculo, tipo }
  const [historyModal, setHistoryModal] = useState(null); // vehiculo

  const initialForm = {
    patente: '', marca: '', modelo: '', anio: new Date().getFullYear(),
    proveedor: '', tipoContrato: 'Leasing',
    valor: '', moneda: 'CLP',
    estadoOperativo: 'Operativa', estadoLogistico: 'En Terreno',
    tieneReemplazo: 'NO', patenteReemplazo: '', zona: 'Metropolitana', asignadoA: ''
  };
  const [form, setForm] = useState(initialForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const isSupervisor = user?.role?.toLowerCase() === 'supervisor';
      const tecEndpoint = isSupervisor ? `/tecnicos/supervisor/${user._id}` : '/tecnicos';

      const [resFlota, resTecnicos] = await Promise.all([
        telecomApi.get('/vehiculos'),
        telecomApi.get(tecEndpoint)
      ]);
      setVehiculos(resFlota.data);
      setTecnicos(resTecnicos.data);
    } catch (e) {
      console.error("Error loading fleet data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cargarEdicion = (v) => {
    setForm({
      patente: v.patente, marca: v.marca, modelo: v.modelo, anio: v.anio || '',
      proveedor: v.proveedor, tipoContrato: v.tipoContrato || 'Leasing',
      valor: v.valorLeasing || v.valor, moneda: v.moneda || 'CLP',
      estadoOperativo: v.estadoOperativo || 'Operativa',
      estadoLogistico: v.estadoLogistico || 'En Terreno',
      tieneReemplazo: v.tieneReemplazo || 'NO',
      patenteReemplazo: v.patenteReemplazo || '',
      zona: v.zona || 'Metropolitana',
      asignadoA: v.asignadoA ? (v.asignadoA._id || v.asignadoA) : ''
    });
    setEditandoId(v._id);
    setModo('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => { setForm(initialForm); setEditandoId(null); };

  const guardarVehiculo = async (e) => {
    e.preventDefault();
    if (!form.patente || !form.marca) return alert("Complete patente y marca.");
    const dataFinal = {
      ...form, valorLeasing: form.valor,
      patenteReemplazo: form.tieneReemplazo === 'SI' ? form.patenteReemplazo : '',
      asignadoA: form.asignadoA || null
    };
    if (editandoId) delete dataFinal.patente;
    try {
      if (editandoId) {
        await telecomApi.put(`/vehiculos/${editandoId}`, dataFinal);
      } else {
        await telecomApi.post('/vehiculos', dataFinal);
      }
      cancelarEdicion(); fetchData();
    } catch (e) {
      alert(`❌ Error: ${e.response?.data?.error || e.message}`);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este vehículo? Esta acción no se puede deshacer.")) return;
    try { await telecomApi.delete(`/vehiculos/${id}`); fetchData(); }
    catch { alert("Error al eliminar"); }
  };

  const descargarPlantilla = () => {
    const datosEjemplo = [{ Patente: "ABCD-10", Marca: "Peugeot", Modelo: "Partner", Año: 2024, Proveedor: "Mitta", Contrato: "Leasing", Valor_Mes: 12.5, Moneda: "UF", Estado: "Operativa", Logistica: "En Terreno", Zona: "RM", Reemplazo: "NO", Patente_Reemplazo: "", RUT_Conductor: "" }];
    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Flota");
    XLSX.writeFile(wb, "Plantilla_Carga_Flota.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const dataNorm = data.map(row => {
        const rutExcel = row["RUT_Conductor"] || row["rut"];
        const tec = rutExcel ? tecnicos.find(t => t.rut === rutExcel) : null;
        return {
          patente: row["Patente"], marca: row["Marca"], modelo: row["Modelo"],
          anio: row["Año"] || 2024, proveedor: row["Proveedor"],
          tipoContrato: row["Contrato"] || 'Leasing', valorLeasing: row["Valor_Mes"] || 0,
          moneda: row["Moneda"] || 'CLP', estadoOperativo: row["Estado"] || 'Operativa',
          estadoLogistico: row["Logistica"] || 'En Terreno', zona: row["Zona"] || 'RM',
          tieneReemplazo: row["Reemplazo"] || 'NO', patenteReemplazo: row["Patente_Reemplazo"] || '',
          asignadoA: tec ? tec._id : null
        };
      });
      setJsonInput(JSON.stringify(dataNorm, null, 2));
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const procesarCargaMasiva = async () => {
    if (!jsonInput) return alert("Sube un archivo Excel primero.");
    try {
      await telecomApi.post('/vehiculos/bulk', { flota: JSON.parse(jsonInput) });
      setJsonInput(''); setModo('manual'); fetchData();
    } catch { alert("Error procesando carga."); }
  };

  const vehiculosFiltrados = vehiculos.filter(v => {
    const texto = filtroTexto.toLowerCase();
    const matchTexto = v.patente.toLowerCase().includes(texto) ||
      v.marca.toLowerCase().includes(texto) || v.modelo.toLowerCase().includes(texto) ||
      (v.asignadoA?.nombre || '').toLowerCase().includes(texto);
    const matchEstado = filtroEstado === 'TODOS' || v.estadoOperativo === filtroEstado;
    return matchTexto && matchEstado;
  });

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full sm:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Buscar patente, conductor, marca..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-100 text-sm font-medium outline-none bg-white focus:border-blue-400 transition-all"
            value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setVista('list')} className={`p-2.5 rounded-xl transition-all ${vista === 'list' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><List size={18} /></button>
            <button onClick={() => setVista('grid')} className={`p-2.5 rounded-xl transition-all ${vista === 'grid' ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setModo('manual')} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${modo === 'manual' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Ficha</button>
            <button onClick={() => setModo('masiva')} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${modo === 'masiva' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Excel</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-[500px]">
        {/* Form */}
        <div className="xl:col-span-4 max-w-lg">
          <div className={`bg-white border transition-all duration-300 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 sticky top-6 ${modo === 'manual' ? (editandoId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-100') : 'border-emerald-100 ring-4 ring-emerald-50'}`}>
            <div className="flex items-center justify-between mb-8">
              <h3 className={`font-black text-xl flex items-center gap-2 ${modo === 'manual' ? (editandoId ? 'text-amber-500' : 'text-blue-600') : 'text-emerald-500'}`}>
                {modo === 'manual' ? (editandoId ? <><Edit3 size={24} /> Editar Ficha</> : <><Car size={24} /> Nueva Unidad</>) : <><FileSpreadsheet size={24} /> Carga Masiva</>}
              </h3>
              {editandoId && <button onClick={cancelarEdicion} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500"><X size={16} /></button>}
            </div>

            {modo === 'manual' ? (
              <form onSubmit={guardarVehiculo} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Patente</label>
                    <div className="relative">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input type="text" placeholder="AAAA-99" disabled={!!editandoId}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-3 font-black text-slate-700 outline-none focus:border-blue-500 uppercase text-sm"
                        value={form.patente} onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Año</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-3 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                        value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm" placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm" placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5"><UserPlus size={14} /> Responsable</label>
                  <select className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none text-sm appearance-none"
                    value={form.asignadoA} onChange={e => setForm({ ...form, asignadoA: e.target.value })}>
                    <option value="">-- DISPONIBLE (EN PATIO) --</option>
                    {tecnicos.map(t => <option key={t._id} value={t._id}>{t.nombre} ({t.rut})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Estado</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 font-bold text-slate-600 outline-none text-xs appearance-none"
                      value={form.estadoOperativo} onChange={e => setForm({ ...form, estadoOperativo: e.target.value })}>
                      <option value="Operativa">🟢 Operativa</option>
                      <option value="Siniestro">🔴 Siniestro</option>
                      <option value="Mantencion">🟠 Mantención</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Logística</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 font-bold text-slate-600 outline-none text-xs appearance-none"
                      value={form.estadoLogistico} onChange={e => setForm({ ...form, estadoLogistico: e.target.value })}>
                      <option value="En Terreno">🚀 En Terreno</option>
                      <option value="En Patio">🅿️ En Patio</option>
                      <option value="Por Entregar">📋 Por Entregar</option>
                      <option value="En Devolución">🔄 En Devolución</option>
                      <option value="Devuelto">🏁 Devuelto</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Zona</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 font-bold text-slate-600 outline-none focus:border-blue-500 text-sm"
                      value={form.zona} onChange={e => setForm({ ...form, zona: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">Valor Mes</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">$</span>
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-8 pr-3 font-bold text-slate-700 outline-none text-sm"
                        value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">Moneda</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-bold text-slate-600 outline-none text-sm appearance-none"
                      value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}>
                      <option value="CLP">Pesos ($)</option>
                      <option value="UF">UF</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  {editandoId && <button type="button" onClick={cancelarEdicion} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3.5 rounded-xl font-bold text-xs uppercase">Cancelar</button>}
                  <button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase text-white shadow-lg flex justify-center items-center gap-2 transition-all ${editandoId ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}>
                    <Save size={18} /> {editandoId ? 'Actualizar' : 'Guardar Ficha'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <input type="file" accept=".xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <div className="p-8 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-100 text-center flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-full shadow-sm text-emerald-500"><Upload size={32} /></div>
                  <p className="text-sm text-emerald-800 font-medium">Sube tu Excel con la flota</p>
                </div>
                <button onClick={() => fileInputRef.current.click()} className="w-full bg-white border border-slate-200 hover:border-emerald-400 py-4 rounded-xl font-bold text-slate-600 uppercase text-xs flex items-center justify-center gap-2">Seleccionar Archivo</button>
                <button onClick={descargarPlantilla} className="w-full text-slate-400 hover:text-blue-500 py-2 font-bold text-[10px] uppercase flex items-center justify-center gap-2"><Download size={14} /> Descargar Plantilla</button>
                <button onClick={procesarCargaMasiva} disabled={!jsonInput} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 py-4 rounded-xl font-black text-sm text-white uppercase shadow-lg shadow-emerald-200 disabled:opacity-50">Procesar Datos</button>
              </div>
            )}
          </div>
        </div>

        {/* Fleet Table */}
        <div className="xl:col-span-8 flex flex-col overflow-hidden">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Patente</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conductor</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unidad</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Estado</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Logística</th>
                    <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center sticky right-0 bg-slate-50">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {vehiculosFiltrados.map(v => (
                    <tr key={v._id} className="hover:bg-blue-50/40 transition-colors group">
                      <td className="p-4">
                        <span className="font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">{v.patente}</span>
                      </td>
                      <td className="p-4">
                        {v.asignadoA ? (
                          <div>
                            <p className="font-bold text-slate-800 uppercase text-[11px]">{v.asignadoA.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{v.asignadoA.rut}</p>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic flex items-center gap-1"><UserMinus size={12} /> Sin Asignar</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{v.modelo}</div>
                        <div className="text-[10px] text-slate-400">{v.marca} · {v.anio}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${v.estadoOperativo === 'Operativa' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {v.estadoOperativo}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="bg-white text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 uppercase">{v.estadoLogistico}</span>
                      </td>
                      <td className="p-4 sticky right-0 bg-white group-hover:bg-blue-50/40 border-l border-transparent group-hover:border-slate-100">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setChecklistModal({ vehiculo: v, tipo: 'Asignación' })}
                            title="Checklist de Asignación"
                            className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition-colors">
                            <ClipboardCheck size={15} />
                          </button>
                          <button onClick={() => setChecklistModal({ vehiculo: v, tipo: 'Devolución' })}
                            title="Checklist de Devolución"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors">
                            <ClipboardList size={15} />
                          </button>
                          <button onClick={() => setHistoryModal(v)}
                            title="Historial de Asignaciones"
                            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                            <History size={15} />
                          </button>
                          <button onClick={() => cargarEdicion(v)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                            <Edit3 size={15} />
                          </button>
                          <button onClick={() => eliminar(v._id)}
                            className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
              <p>{vehiculosFiltrados.length} de {vehiculos.length} unidades</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {checklistModal && (
        <ChecklistModal
          vehiculo={checklistModal.vehiculo}
          tipo={checklistModal.tipo}
          tecnicos={tecnicos}
          onClose={() => setChecklistModal(null)}
          onSuccess={() => { setChecklistModal(null); fetchData(); }}
        />
      )}
      {historyModal && (
        <HistoryModal vehiculo={historyModal} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
};

// ─── Page Wrapper ────────────────────────────────────────────────────────────────
const Flota = () => (
  <div className="h-full flex flex-col pt-4 pb-20 max-w-[100vw] overflow-x-hidden">
    <div className="flex items-center gap-4 px-1 mb-8">
      <div className="bg-sky-600 text-white p-2.5 rounded-xl shadow-lg shadow-sky-200">
        <Truck size={24} />
      </div>
      <div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">
          Flota de <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">Vehículos</span>
        </h1>
        <p className="text-slate-400 text-xs font-bold tracking-[0.2em] mt-1 uppercase">
          Gestión · Checklist · Firma Digital · Historial 360
        </p>
      </div>
    </div>
    <div className="flex-1">
      <GestionFlota />
    </div>
  </div>
);

export default Flota;