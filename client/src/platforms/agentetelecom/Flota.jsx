import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Car, Truck, Coins, Save, Trash2, Tag,
  Upload, FileSpreadsheet, Download, AlertCircle, FileText,
  Wrench, Edit3, Search, LayoutGrid, List, Filter, X, ArrowRightLeft,
  UserPlus, UserMinus, Calendar, MapPin, ClipboardCheck,
  Map, Activity, ChevronRight, Briefcase
} from 'lucide-react';



// =============================================================================
// SUB-COMPONENT: FLEET MANAGEMENT (CRUD, TABLES, FORMS)
// =============================================================================
const GestionFlota = () => {
  // --- DATA STATES ---
  const [vehiculos, setVehiculos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI STATES ---
  const [modo, setModo] = useState('manual');
  const [vista, setVista] = useState('list');
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // --- EDITING STATES ---
  const [editandoId, setEditandoId] = useState(null);
  const [jsonInput, setJsonInput] = useState('');
  const fileInputRef = useRef(null);

  // Master Form
  const initialForm = {
    patente: '', marca: '', modelo: '', anio: new Date().getFullYear(),
    proveedor: '', tipoContrato: 'Leasing',
    valor: '', moneda: 'CLP',
    estadoOperativo: 'Operativa',
    estadoLogistico: 'En Terreno',
    tieneReemplazo: 'NO', patenteReemplazo: '',
    zona: 'Metropolitana',
    asignadoA: '' // Technician ID
  };

  const [form, setForm] = useState(initialForm);

  // --- FETCH DATA ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resFlota, resTecnicos] = await Promise.all([
        axios.get('http://localhost:5001/api/vehiculos'),
        axios.get('http://localhost:5001/api/tecnicos')
      ]);
      setVehiculos(resFlota.data);
      setTecnicos(resTecnicos.data);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- FORM MANAGEMENT ---
  const cargarEdicion = (vehiculo) => {
    // Extract driver ID if it exists
    const conductorId = vehiculo.asignadoA ? (vehiculo.asignadoA._id || vehiculo.asignadoA) : '';

    setForm({
      patente: vehiculo.patente,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anio: vehiculo.anio || '',
      proveedor: vehiculo.proveedor,
      tipoContrato: vehiculo.tipoContrato || 'Leasing',
      valor: vehiculo.valorLeasing || vehiculo.valor,
      moneda: vehiculo.moneda || 'CLP',
      estadoOperativo: vehiculo.estadoOperativo || 'Operativa',
      estadoLogistico: vehiculo.estadoLogistico || 'En Terreno',
      tieneReemplazo: vehiculo.tieneReemplazo || 'NO',
      patenteReemplazo: vehiculo.patenteReemplazo || '',
      zona: vehiculo.zona || 'Metropolitana',
      asignadoA: conductorId
    });
    setEditandoId(vehiculo._id);
    setModo('manual');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setForm(initialForm);
    setEditandoId(null);
  };

  // --- SAVE LOGIC ---
  const guardarVehiculo = async (e) => {
    e.preventDefault();
    if (!form.patente || !form.marca) return alert("Complete basic data (License Plate, Brand)");

    const dataFinal = {
      ...form,
      valorLeasing: form.valor,
      patenteReemplazo: form.tieneReemplazo === 'SI' ? form.patenteReemplazo : '',
      asignadoA: form.asignadoA && form.asignadoA !== '' ? form.asignadoA : null
    };

    if (editandoId) {
      delete dataFinal.patente; // Protect license plate on edit
    }

    try {
      if (editandoId) {
        // UPDATE (PUT)
        await axios.put(`http://localhost:5001/api/vehiculos/${editandoId}`, dataFinal);
        alert("✅ Ficha actualizada correctamente");
      } else {
        // CREATE (POST)
        await axios.post('http://localhost:5001/api/vehiculos', dataFinal);
        alert("✅ Nuevo vehículo registrado");
      }
      cancelarEdicion();
      fetchData();
    } catch (e) {
      console.error("Detailed error:", e);
      const msg = e.response?.data?.message || e.message || "Unknown error";
      alert(`❌ Server Error: ${msg}`);
    }
  };

  const eliminar = async (id) => {
    if (window.confirm("ATENCIÓN: Eliminar este vehículo romperá la asignación actual.\n¿Confirmar eliminación?")) {
      try {
        await axios.delete(`http://localhost:5001/api/vehiculos/${id}`);
        fetchData();
      } catch (e) { alert("Error al eliminar"); }
    }
  };

  // --- BULK LOGIC ---
  const descargarPlantilla = () => {
    const datosEjemplo = [{ Patente: "ABCD-10", Marca: "Peugeot", Modelo: "Partner", Año: 2024, Proveedor: "Mitta", Contrato: "Leasing", Valor_Mes: 12.5, Moneda: "UF", Estado: "Operativa", Logistica: "En Terreno", Zona: "Santiago Centro", Reemplazo: "NO", Patente_Reemplazo: "", RUT_Conductor: "12345678-9" }];
    const ws = XLSX.utils.json_to_sheet(datosEjemplo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Flota");
    XLSX.writeFile(wb, "Plantilla_Carga_Flota.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const dataNormalizada = data.map(row => {
        const rutExcel = row["RUT_Conductor"] || row["rut"];
        const tecnicoEncontrado = rutExcel ? tecnicos.find(t => t.rut === rutExcel) : null;
        return {
          patente: row["Patente"] || row["patente"],
          marca: row["Marca"] || row["marca"],
          modelo: row["Modelo"] || row["modelo"],
          anio: row["Año"] || row["anio"] || 2024,
          proveedor: row["Proveedor"] || row["proveedor"],
          tipoContrato: row["Contrato"] || row["tipo"] || 'Leasing',
          valorLeasing: row["Valor_Mes"] || row["valor"] || 0,
          moneda: row["Moneda"] || row["moneda"] || 'CLP',
          estadoOperativo: row["Estado"] || 'Operativa',
          estadoLogistico: row["Logistica"] || 'En Terreno',
          zona: row["Zona"] || 'RM',
          tieneReemplazo: row["Reemplazo"] || 'NO',
          patenteReemplazo: row["Patente_Reemplazo"] || '',
          asignadoA: tecnicoEncontrado ? tecnicoEncontrado._id : null
        };
      });
      setJsonInput(JSON.stringify(dataNormalizada, null, 2));
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const procesarCargaMasiva = async () => {
    try {
      if (!jsonInput) return alert("Sube un archivo Excel primero.");
      const payload = JSON.parse(jsonInput);
      await axios.post('http://localhost:5001/api/vehiculos/bulk', { flota: payload });
      alert("Carga Masiva Exitosa");
      setJsonInput('');
      setModo('manual');
      fetchData();
    } catch (e) { alert("Error procesando carga."); }
  };

  const vehiculosFiltrados = vehiculos.filter(v => {
    const texto = filtroTexto.toLowerCase();
    const matchTexto =
      v.patente.toLowerCase().includes(texto) ||
      v.marca.toLowerCase().includes(texto) ||
      v.modelo.toLowerCase().includes(texto) ||
      (v.asignadoA?.nombre || '').toLowerCase().includes(texto);

    const matchEstado = filtroEstado === 'TODOS' || v.estadoOperativo === filtroEstado;
    return matchTexto && matchEstado;
  });

  // --- RENDER TABLE ---
  const RenderTabla = () => (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Patente</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Conductor Asignado</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Proveedor</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Unidad</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Año</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Estado</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">Logística</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Costo</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Contrato</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Zona</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center sticky right-0 bg-slate-50">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
            {vehiculosFiltrados.map(v => {
              const valorMes = parseFloat(v.valorLeasing || v.valor || 0);
              return (
                <tr key={v._id} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="p-4">
                    <span className="font-black text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">{v.patente}</span>
                  </td>
                  <td className="p-4">
                    {v.asignadoA ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 uppercase text-[11px]">{v.asignadoA.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-mono tracking-wide">{v.asignadoA.rut}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic flex items-center gap-1"><UserMinus size={12} /> Sin Asignar</span>
                    )}
                  </td>
                  <td className="p-4 font-medium">{v.proveedor}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-700">{v.modelo}</div>
                    <div className="text-[10px] text-slate-400">{v.marca}</div>
                  </td>
                  <td className="p-4 font-mono text-center text-slate-500">{v.anio}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase border ${v.estadoOperativo === 'Operativa'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                      {v.estadoOperativo}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-white text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 uppercase shadow-sm">{v.estadoLogistico}</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="font-mono font-bold text-slate-700">{valorMes.toLocaleString()}</div>
                    <div className="text-[9px] font-bold text-slate-400">{v.moneda}</div>
                  </td>
                  <td className="p-4 uppercase text-[10px] font-bold text-slate-500">{v.tipoContrato}</td>
                  <td className="p-4 uppercase text-[10px] font-medium">{v.zona}</td>
                  <td className="p-4 flex justify-center gap-2 sticky right-0 bg-white group-hover:bg-blue-50/40 border-l border-transparent group-hover:border-slate-100">
                    <button onClick={() => cargarEdicion(v)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Editar"><Edit3 size={15} /></button>
                    <button onClick={() => eliminar(v._id)} className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        {/* SEARCH BAR */}
        <div className="relative w-full sm:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Buscar por Patente, Conductor, Marca..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border-2 border-slate-100 text-sm font-medium outline-none bg-white text-slate-600 focus:border-blue-500/50 focus:shadow-lg focus:shadow-blue-100 transition-all placeholder:text-slate-300"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
          />
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3">
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setVista('list')} className={`p-2.5 rounded-xl transition-all ${vista === 'list' ? 'bg-slate-100 text-blue-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}><List size={18} /></button>
            <button onClick={() => setVista('grid')} className={`p-2.5 rounded-xl transition-all ${vista === 'grid' ? 'bg-slate-100 text-blue-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18} /></button>
          </div>
          <div className="flex bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
            <button onClick={() => setModo('manual')} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${modo === 'manual' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>Ficha</button>
            <button onClick={() => setModo('masiva')} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${modo === 'masiva' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:bg-slate-50'}`}>Excel</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1 min-h-[500px]">
        {/* COLUMN 1: FORM (4 cols) */}
        <div className="xl:col-span-4 max-w-lg">
          <div className={`bg-white border transition-all duration-300 rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden h-fit sticky top-6 ${modo === 'manual' ? (editandoId ? 'border-amber-200 ring-4 ring-amber-50' : 'border-slate-100') : 'border-emerald-100 ring-4 ring-emerald-50'}`}>

            {/* Header Card */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  {modo === 'manual' ? (editandoId ? 'Editando Registro' : 'Nuevo Ingreso') : 'Importación de Datos'}
                </span>
                <h3 className={`font-black text-xl flex items-center gap-2 ${modo === 'manual' ? (editandoId ? 'text-amber-500' : 'text-blue-600') : 'text-emerald-500'}`}>
                  {modo === 'manual' ? (editandoId ? <><Edit3 size={24} /> Editar Ficha</> : <><Car size={24} /> Nueva Unidad</>) : <><FileSpreadsheet size={24} /> Carga Masiva</>}
                </h3>
              </div>
              {editandoId && <button onClick={cancelarEdicion} className="bg-slate-100 hover:bg-slate-200 p-2 rounded-full text-slate-500 transition-colors"><X size={16} /></button>}
            </div>

            {modo === 'manual' ? (
              <form onSubmit={guardarVehiculo} className="space-y-5 animate-in fade-in">

                {/* Patente & Año Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Patente</label>
                    <div className="relative group">
                      <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                      <input
                        type="text"
                        placeholder="AAAA-99"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-3 font-black text-slate-700 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none uppercase text-sm transition-all placeholder:font-normal placeholder:text-slate-300"
                        value={form.patente}
                        onChange={e => setForm({ ...form, patente: e.target.value.toUpperCase() })}
                        disabled={!!editandoId}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Año</label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-3 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm transition-all" value={form.anio} onChange={e => setForm({ ...form, anio: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Marca & Modelo */}
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm transition-all" placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} />
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm transition-all" placeholder="Modelo" value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} />
                </div>

                {/* Driver Assignment */}
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 group hover:border-indigo-200 transition-colors">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5"><UserPlus size={14} /> Asignación de Responsable</label>
                  <select className="w-full bg-white border border-indigo-100 rounded-xl py-3 px-4 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 text-sm appearance-none cursor-pointer hover:border-indigo-300 transition-all" value={form.asignadoA} onChange={e => setForm({ ...form, asignadoA: e.target.value })}>
                    <option value="">-- VEHÍCULO DISPONIBLE (EN PATIO) --</option>
                    {tecnicos.map(tec => <option key={tec._id} value={tec._id}>{tec.nombre} ({tec.rut})</option>)}
                  </select>
                </div>

                {/* Status & Logic */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Estado</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-xs appearance-none" value={form.estadoOperativo} onChange={e => setForm({ ...form, estadoOperativo: e.target.value })}>
                      <option value="Operativa">🟢 Operativa</option><option value="Siniestro">🔴 Siniestro</option><option value="Mantencion">🟠 Mantención</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Logística</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-xs appearance-none" value={form.estadoLogistico} onChange={e => setForm({ ...form, estadoLogistico: e.target.value })}>
                      <option value="En Terreno">🚀 En Terreno</option><option value="En Patio">🅿️ En Patio</option><option value="Por Entregar">📋 Por Entregar</option><option value="En Devolución">🔄 En Devolución</option><option value="Devuelto">🏁 Devuelto</option>
                    </select>
                  </div>
                </div>

                {/* Zone */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 ml-1">Zona Designada</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm transition-all" value={form.zona} onChange={e => setForm({ ...form, zona: e.target.value })} />
                  </div>
                </div>

                {/* Replacement */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex gap-3 items-center">
                  <select className="w-1/3 bg-white border border-slate-200 rounded-lg py-2 px-3 font-bold text-slate-600 text-xs outline-none" value={form.tieneReemplazo} onChange={e => setForm({ ...form, tieneReemplazo: e.target.value })}>
                    <option value="NO">No Reemplazo</option><option value="SI">Sí Reemplazo</option>
                  </select>
                  {form.tieneReemplazo === 'SI' && (
                    <input className="flex-1 bg-white border border-blue-200 rounded-lg py-2 px-3 font-black text-blue-700 text-xs uppercase animate-in fade-in" placeholder="PATENTE REEMPLAZO" value={form.patenteReemplazo} onChange={e => setForm({ ...form, patenteReemplazo: e.target.value.toUpperCase() })} />
                  )}
                </div>

                {/* Financials */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">Valor Mes</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">$</span>
                      <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-8 pr-3 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 text-sm transition-all" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5 ml-1">Moneda</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-sm appearance-none" value={form.moneda} onChange={e => setForm({ ...form, moneda: e.target.value })}>
                      <option value="CLP">Pesos ($)</option><option value="UF">UF</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-3">
                  {editandoId && <button type="button" onClick={cancelarEdicion} className="flex-1 bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 py-3.5 rounded-xl font-bold text-xs uppercase transition-colors">Cancelar</button>}
                  <button type="submit" className={`flex-1 py-3.5 rounded-xl font-black text-xs uppercase text-white shadow-lg shadow-blue-200 flex justify-center items-center gap-2 transition-all transform active:scale-95 ${editandoId ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}>
                    <Save size={18} /> {editandoId ? 'Actualizar Ficha' : 'Guardar Ficha'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col space-y-6 animate-in fade-in py-4">
                <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <div className="p-8 bg-emerald-50/50 rounded-2xl border-2 border-dashed border-emerald-100/70 text-center flex flex-col items-center gap-4 hover:bg-emerald-50 transition-colors">
                  <div className="bg-white p-4 rounded-full shadow-sm text-emerald-500"><Upload size={32} /></div>
                  <p className="text-sm text-emerald-800 font-medium">Arrastra tu Excel aquí o haz clic para subir.</p>
                </div>
                <button onClick={() => fileInputRef.current.click()} className="w-full bg-white border border-slate-200 hover:border-emerald-400 py-4 rounded-xl font-bold text-slate-600 hover:text-emerald-600 transition-all uppercase text-xs flex items-center justify-center gap-2 shadow-sm">Seleccionar Archivo</button>
                <button onClick={descargarPlantilla} className="w-full text-slate-400 hover:text-blue-500 py-2 font-bold text-[10px] uppercase flex items-center justify-center gap-2"> <Download size={14} /> Descargar Plantilla Modelo</button>
                <button onClick={procesarCargaMasiva} disabled={!jsonInput} className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-4 rounded-xl font-black text-sm text-white uppercase shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:shadow-none transition-all">Procesar Datos</button>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: FLEET LIST (8 cols) */}
        <div className="xl:col-span-8 flex flex-col h-full overflow-hidden">
          {vista === 'list' ? <RenderTabla /> : (
            <div className="overflow-y-auto flex-1 p-2 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehiculosFiltrados.map(v => (
                  <div key={v._id} className="group bg-white border border-slate-100 p-6 rounded-[1.5rem] flex flex-col hover:border-blue-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 shadow-sm border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Truck size={20} /></div>
                        <div>
                          <span className="bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider">{v.patente}</span>
                          <h4 className="font-bold text-slate-700 text-sm mt-1">{v.marca} {v.modelo}</h4>
                        </div>
                      </div>
                      <button onClick={() => cargarEdicion(v)} className="text-slate-300 hover:text-blue-500 transition-colors p-1"><Edit3 size={16} /></button>
                    </div>

                    {/* Details */}
                    <div className="text-xs text-slate-500 space-y-2 mb-4 bg-slate-50/50 p-3 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Conductor</span>
                        <span className="font-bold text-slate-700 uppercase">{v.asignadoA?.nombre || 'Sin Asignar'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Estado</span>
                        <span className={`font-bold ${v.estadoOperativo === 'Operativa' ? 'text-emerald-600' : 'text-rose-500'}`}>{v.estadoOperativo}</span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-auto">
                      <span className="bg-white border border-slate-200 text-slate-500 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase shadow-sm">{v.estadoLogistico}</span>
                      <span className="font-mono text-emerald-600 font-black text-sm">{v.moneda === 'UF' ? 'UF ' : '$'}{(v.valorLeasing || v.valor).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT — Solo Gestión de Flota (GPS vive en /monitor-gps)
// =============================================================================
const Flota = () => {
  return (
    <div className="h-full flex flex-col pt-4 pb-20 max-w-[100vw] overflow-x-hidden">

      {/* HEADER */}
      <div className="flex items-center gap-4 px-1 mb-8">
        <div className="bg-sky-600 text-white p-2.5 rounded-xl shadow-lg shadow-sky-200">
          <Truck size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            Flota de <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">Vehículos</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold tracking-[0.2em] mt-1 uppercase">
            Gestión y Control de Activos Vehiculares
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1">
        <GestionFlota />
      </div>
    </div>
  );
};

export default Flota;