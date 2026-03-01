import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  FileText, Upload, Download, Search, Plus, Trash2, Edit3,
  Save, X, Filter, BarChart3
} from 'lucide-react';

const Tarifario = () => {
  const [baremos, setBaremos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('TODOS');

  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    codigo: '', descripcion: '', puntos: '', precio: '', ambito: 'NACIONAL', grupo: '', cliente: '', mandante: '',
    tecnologia_voz: '', tecnologia_banda_ancha: '', tecnologia_tv: '', tecnologia_capacidad: ''
  });

  // Inline Editing State
  const [editingRowId, setEditingRowId] = useState(null);
  const [editRowData, setEditRowData] = useState({});

  const fileInputRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5001/api/baremos');
      setBaremos(res.data);
    } catch (error) {
      console.error("Error cargando tarifario:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`http://localhost:5001/api/baremos/${form._id}`, form);
        alert("Tarifa actualizada");
      } else {
        await axios.post('http://localhost:5001/api/baremos', form);
        alert("Nueva tarifa creada");
      }
      setModalOpen(false);
      fetchData();
    } catch (error) {
      alert("Error al guardar: " + error.message);
    }
  };

  const handleInlineSave = async () => {
    try {
      await axios.put(`http://localhost:5001/api/baremos/${editRowData._id}`, editRowData);
      setBaremos(prev => prev.map(item => item._id === editRowData._id ? editRowData : item));
      setEditingRowId(null);
    } catch (error) {
      alert("Error al guardar cambios: " + error.message);
    }
  };

  const startInlineEdit = (item) => {
    setEditingRowId(item._id);
    setEditRowData({ ...item });
  };

  const cancelInlineEdit = () => {
    setEditingRowId(null);
    setEditRowData({});
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de eliminar este ítem del tarifario?")) {
      await axios.delete(`http://localhost:5001/api/baremos/${id}`);
      fetchData();
    }
  };

  const handleReset = async () => {
    if (window.confirm("⚠️ ATENCIÓN: Se eliminarán TODAS las tarifas actuales para evitar duplicados. ¿Proceder con el reseteo total?")) {
      try {
        await axios.delete('http://localhost:5001/api/baremos/all/reset');
        alert("Tarifario reseteado con éxito. Ahora puedes cargar el nuevo Excel.");
        fetchData();
      } catch (error) {
        alert("Error al resetear: " + error.message);
      }
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setForm(item);
      setIsEditing(true);
    } else {
      setForm({
        codigo: '', descripcion: '', puntos: '', grupo: '', cliente: '', mandante: '', precio: 0, ambito: 'NACIONAL',
        tecnologia_voz: '', tecnologia_banda_ancha: '', tecnologia_tv: '', tecnologia_capacidad: ''
      });
      setIsEditing(false);
    }
    setModalOpen(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws);

        // DEBUG: Log first row to see exact column names
        if (data.length > 0) {
          console.log('📋 Columnas detectadas en Excel:', Object.keys(data[0]));
          console.log('📋 Primera fila de datos:', data[0]);
        }

        const cleanText = (val) => (val || '').toString().trim();
        const cleanNumber = (val) => {
          if (val === undefined || val === null || val === '') return 0;
          const str = val.toString().replace(/,/g, '.');
          return parseFloat(str) || 0;
        };

        const formattedData = data.map(row => ({
          codigo: cleanText(row['Codigo'] || row['CODIGO'] || row['codigo']),
          descripcion: cleanText(row['Descripcion'] || row['DESCRIPCION'] || row['descripcion']),
          puntos: cleanNumber(row['Puntos Baremos'] || row['Puntos'] || row['puntos']),
          precio: cleanNumber(row['Precio'] || 0),
          ambito: cleanText(row['Ambito'] || 'NACIONAL'),
          moneda: cleanText(row['Moneda'] || 'CLP'),
          grupo: cleanText(row['Grupo'] || row['GRUPO'] || 'GENERAL'),
          mandante: cleanText(row['Mandante Principal'] || row['Mandante'] || 'MOVISTAR'),
          tecnologia_voz: cleanText(row['Tecnologia Voz'] || row['TECNOLOGIA VOZ'] || row['Tecnología Voz'] || ''),
          tecnologia_banda_ancha: cleanText(row['Tecnologia Banda Ancha'] || row['TECNOLOGIA BANDA ANCHA'] || row['Tecnología Banda Ancha'] || ''),
          tecnologia_tv: cleanText(row['Tecnologia tv'] || row['TECNOLOGIA TV'] || row['Tecnología tv'] || row['Tecnología TV'] || row['Tecnologia TV'] || ''),
          tecnologia_capacidad: cleanText(row['Categoría de Capacidad'] || row['Categoria de Capacidad'] || row['Tecnologia de Capacidad'] || row['TECNOLOGIA DE CAPACIDAD'] || ''),
          cliente: cleanText(row['Cliente'] || row['CLIENTE'] || 'GENERICO')
        })).filter(item => item.codigo && item.descripcion);

        // Deduplicate locally to prevent bulkWrite race conditions
        const uniqueMap = new Map();
        formattedData.forEach(item => {
          const key = `${item.codigo}-${item.cliente}`;
          uniqueMap.set(key, item);
        });
        const finalPayload = Array.from(uniqueMap.values());

        await axios.post('http://localhost:5001/api/baremos/bulk', { baremos: finalPayload });
        alert(`Se cargaron ${finalPayload.length} tarifas exitosamente.`);
        fetchData();
      } catch (error) {
        console.error(error);
        const serverError = error.response?.data?.error || error.message;
        const detail = error.response?.data?.detailedError || '';
        alert(`Error al cargar: ${serverError}\n${detail}`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const uniqueClients = [...new Set(baremos.map(b => b.cliente))];

  const filteredData = baremos.filter(b => {
    const matchText =
      b.codigo.toString().toLowerCase().includes(filtro.toLowerCase()) ||
      b.descripcion.toLowerCase().includes(filtro.toLowerCase());
    const matchClient = filtroCliente === 'TODOS' || b.cliente === filtroCliente;
    return matchText && matchClient;
  });

  return (
    <div className="animate-in fade-in duration-500 pb-20 max-w-[100vw] overflow-x-hidden">

      <div className="flex flex-col lg:flex-row justify-between items-end gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black italic text-slate-800 tracking-tighter flex items-center gap-3">
            <FileText className="text-blue-600" size={36} />
            Maestro de <span className="text-blue-600">Tarifario</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-widest mt-2 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-500" />
            BASE DE DATOS DE BAREMOS & PRECIOS ({baremos.length} Ítems)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button
            onClick={() => fileInputRef.current.click()}
            className="group bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-5 py-3 rounded-xl font-bold text-xs uppercase flex justify-center items-center gap-2 transition-all"
          >
            <Upload size={16} /> Carga Masiva Excel
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .csv" onChange={handleFileUpload} />
          </button>
          <button
            onClick={handleReset}
            className="group bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 px-5 py-3 rounded-xl font-bold text-xs uppercase flex justify-center items-center gap-2 transition-all shadow-sm"
          >
            <Trash2 size={16} /> Reset Tarifario
          </button>
          <button
            onClick={() => openModal()}
            className="group bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex justify-center items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
          >
            <Plus size={18} /> Nueva Tarifa
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por código o descripción..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={16} className="text-slate-400" />
          <select
            className="w-full md:w-48 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 uppercase"
            value={filtroCliente}
            onChange={e => setFiltroCliente(e.target.value)}
          >
            <option value="TODOS">Todos los Clientes</option>
            {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
              <tr>
                <th className="p-4">Codigo</th>
                <th className="p-4">Descripcion</th>
                <th className="p-4 text-center">Puntos Baremos</th>
                <th className="p-4">Grupo</th>
                <th className="p-4 text-center">Tecnologia Voz</th>
                <th className="p-4 text-center">Tecnologia Banda Ancha</th>
                <th className="p-4 text-center">Tecnologia tv</th>
                <th className="p-4 text-center">Tecnologia de Capacidad</th>
                <th className="p-4">Cliente</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-600">
              {loading ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">Cargando catálogo...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-slate-400">No se encontraron tarifas.</td></tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item._id} className={`hover:bg-blue-50/50 transition-colors group ${editingRowId === item._id ? 'bg-blue-50' : ''}`}>
                    {editingRowId === item._id ? (
                      // --- ALTA EDICION (INLINE) ---
                      <>
                        <td className="p-4"><input className="w-full bg-white border border-blue-300 rounded px-2 py-1 font-mono text-xs uppercase" value={editRowData.codigo} onChange={e => setEditRowData({ ...editRowData, codigo: e.target.value })} /></td>
                        <td className="p-4"><input className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-xs" value={editRowData.descripcion} onChange={e => setEditRowData({ ...editRowData, descripcion: e.target.value })} /></td>
                        <td className="p-4"><input type="number" step="0.01" className="w-16 bg-white border border-blue-300 rounded px-2 py-1 text-center text-xs" value={editRowData.puntos} onChange={e => setEditRowData({ ...editRowData, puntos: parseFloat(e.target.value) })} /></td>
                        <td className="p-4"><input className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-xs uppercase" value={editRowData.grupo} onChange={e => setEditRowData({ ...editRowData, grupo: e.target.value })} /></td>
                        <td className="p-4"><input className="w-24 bg-white border border-blue-300 rounded px-1 py-1 text-center text-xs" value={editRowData.tecnologia_voz} onChange={e => setEditRowData({ ...editRowData, tecnologia_voz: e.target.value })} /></td>
                        <td className="p-4"><input className="w-24 bg-white border border-blue-300 rounded px-1 py-1 text-center text-xs" value={editRowData.tecnologia_banda_ancha} onChange={e => setEditRowData({ ...editRowData, tecnologia_banda_ancha: e.target.value })} /></td>
                        <td className="p-4"><input className="w-24 bg-white border border-blue-300 rounded px-1 py-1 text-center text-xs" value={editRowData.tecnologia_tv} onChange={e => setEditRowData({ ...editRowData, tecnologia_tv: e.target.value })} /></td>
                        <td className="p-4"><input className="w-24 bg-white border border-blue-300 rounded px-1 py-1 text-center text-xs" value={editRowData.tecnologia_capacidad} onChange={e => setEditRowData({ ...editRowData, tecnologia_capacidad: e.target.value })} /></td>
                        <td className="p-4"><input className="w-full bg-white border border-blue-300 rounded px-2 py-1 text-xs uppercase" value={editRowData.cliente} onChange={e => setEditRowData({ ...editRowData, cliente: e.target.value })} /></td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={handleInlineSave} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Save size={16} /></button>
                            <button onClick={cancelInlineEdit} className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300"><X size={16} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // --- VISTA NORMAL ---
                      <>
                        <td className="p-4 font-mono font-bold text-slate-800">{item.codigo}</td>
                        <td className="p-4 max-w-xs truncate" title={item.descripcion}>{item.descripcion}</td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-black">{item.puntos}</span>
                        </td>
                        <td className="p-4 text-slate-600 font-bold">{item.grupo}</td>
                        <td className="p-4 text-center text-slate-600 font-bold text-[10px]">{item.tecnologia_voz}</td>
                        <td className="p-4 text-center text-slate-600 font-bold text-[10px]">{item.tecnologia_banda_ancha}</td>
                        <td className="p-4 text-center text-slate-600 font-bold text-[10px]">{item.tecnologia_tv}</td>
                        <td className="p-4 text-center text-purple-600 font-bold text-[9px]">{item.tecnologia_capacidad}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-lg font-black text-[10px] ${item.cliente?.includes('ZENER') ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                            {item.cliente}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startInlineEdit(item)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg"><Edit3 size={16} /></button>
                            <button onClick={() => handleDelete(item._id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                {isEditing ? <Edit3 size={18} className="text-blue-500" /> : <Plus size={18} className="text-emerald-500" />}
                {isEditing ? 'Editar Tarifa' : 'Nueva Actividad'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Código</label>
                  <input required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Puntos Baremos</label>
                  <input type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500" value={form.puntos} onChange={e => setForm({ ...form, puntos: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Descripción</label>
                  <textarea required rows="2" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Grupo</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500 uppercase" value={form.grupo} onChange={e => setForm({ ...form, grupo: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mandante Principal</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500" value={form.mandante} onChange={e => setForm({ ...form, mandante: e.target.value })} placeholder="Ej: Movistar" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Cliente</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-blue-500" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} placeholder="Ej: Zener" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Tecnologia Voz</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none focus:border-blue-500" value={form.tecnologia_voz} onChange={e => setForm({ ...form, tecnologia_voz: e.target.value })} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Tecnologia Banda Ancha</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none focus:border-blue-500" value={form.tecnologia_banda_ancha} onChange={e => setForm({ ...form, tecnologia_banda_ancha: e.target.value })} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Tecnologia tv</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none focus:border-blue-500" value={form.tecnologia_tv} onChange={e => setForm({ ...form, tecnologia_tv: e.target.value })} />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Tecnologia de Capacidad</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-center text-xs font-bold outline-none focus:border-blue-500" value={form.tecnologia_capacidad} onChange={e => setForm({ ...form, tecnologia_capacidad: e.target.value })} />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase hover:bg-blue-500 shadow-lg shadow-blue-500/20">
                  Guardar Tarifa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Tarifario;
