import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldAlert, Info, Plus, CalendarCheck, TrendingUp, HandCoins, 
  CheckCircle2, Award, Zap, Target, Trash2, Save, FileEdit, 
  ChevronRight, LayoutDashboard, Settings, Filter, Star, Loader2, Clock, Scale
} from 'lucide-react';
import { telecomApi as api } from '../../agentetelecom/telecomApi';
import { bonosConfigApi } from '../../rrhh/rrhhApi';

/* --- HELPERS --- */
const CLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

const PCT = (v) => (v || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

/* --- INITIAL MODEL DATA (FROM IMAGE) --- */
const INITIAL_MODELS = [
  {
    id: 'standard_2026',
    nombre: 'Modelo Estándar Operativo',
    description: 'Baremos y Calidad base para técnicos de terreno Q1-2026.',
    color: 'indigo',
    tramosBaremos: [
      { desde: 0, hasta: 95, valor: 0 },
      { desde: 96, hasta: 126, valor: 475 },
      { desde: 127, hasta: 147, valor: 950 },
      { desde: 148, hasta: 163, valor: 2660 },
      { desde: 164, hasta: 'Más', valor: 3040 },
    ],
    tramosRR: [
      { operator: '>', limit: 6.50, valor: 0, label: 'Deficiente' },
      { desde: 6.01, hasta: 6.50, valor: 20000, label: 'Promedio' },
      { desde: 5.01, hasta: 6.00, valor: 40000, label: 'Bueno' },
      { operator: '<', limit: 5.01, valor: 65000, label: 'Excelente' },
    ],
    tramosAI: [
      { operator: '>', limit: 2.82, valor: 0, label: 'Fuera de Rango' },
      { desde: 2.01, hasta: 2.82, valor: 20000, label: 'Estandar' },
      { desde: 1.51, hasta: 2.00, valor: 40000, label: 'Destacado' },
      { operator: '<', limit: 1.51, valor: 65000, label: 'Elite' },
    ]
  }
];

const ModelosBonificacion = () => {
  const [models, setModels] = useState([]);
  const [tiposBono, setTiposBono] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    try {
      const [{ data: modelsRes }, { data: configRes }] = await Promise.all([
        api.get('/admin/bonos'),
        bonosConfigApi.getAll()
      ]);
      setTiposBono(configRes || []);
      if (modelsRes.length > 0) {
        setModels(modelsRes);
        setSelectedId(modelsRes[0]._id || modelsRes[0].id);
      } else {
        setModels(INITIAL_MODELS);
        setSelectedId(INITIAL_MODELS[0].id);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setModels(INITIAL_MODELS);
      setSelectedId(INITIAL_MODELS[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const activeModel = useMemo(() => models.find(m => (m._id || m.id) === selectedId), [models, selectedId]);

  const handleSave = async () => {
    if (!activeModel) return;
    setIsSaving(true);
    try {
      const isNew = !activeModel._id;
      if (isNew) {
        const { data } = await api.post('/admin/bonos', activeModel);
        setModels(prev => prev.map(m => m.id === selectedId ? data : m));
        setSelectedId(data._id);
        alert('Modelo creado con éxito');
      } else {
        await api.put(`/admin/bonos/${activeModel._id}`, activeModel);
        alert('Modelo actualizado con éxito');
      }
    } catch (err) {
      console.error('Error saving model:', err);
      alert('Error al guardar el modelo');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (modelId) => {
    try {
        const m = models.find(x => (x._id || x.id) === modelId);
        if (!m) return;
        // In a real app, only one can be active. For now just toggle this one.
        await api.put(`/admin/bonos/${m._id}`, { ...m, activo: !m.activo });
        setModels(prev => prev.map(x => (x._id || x.id) === modelId ? { ...x, activo: !x.activo } : x));
    } catch (err) { alert('Error updating status'); }
  }

  // Handler for range updates
  const updateTramo = (tableKey, index, field, value) => {
    setModels(prev => prev.map(m => {
      if ((m._id || m.id) !== selectedId) return m;
      if (tableKey === null) return { ...m, [field]: value };
      const newTable = [...m[tableKey]];
      newTable[index] = { ...newTable[index], [field]: value };
      return { ...m, [tableKey]: newTable };
    }));
  };

  const addRow = (tableKey) => {
    setModels(prev => prev.map(m => {
      if ((m._id || m.id) !== selectedId) return m;
      const newItem = tableKey === 'tramosBaremos' 
        ? { desde: 0, hasta: 0, valor: 0 } 
        : { operator: 'Entre', desde: 0, hasta: 0, valor: 0 };
      return { ...m, [tableKey]: [...m[tableKey], newItem] };
    }));
  };

  const removeRow = (tableKey, index) => {
    setModels(prev => prev.map(m => {
      if ((m._id || m.id) !== selectedId) return m;
      return { ...m, [tableKey]: m[tableKey].filter((_, i) => i !== index) };
    }));
  };

  const createNewModel = () => {
    const newId = `model_${Date.now()}`;
    const newModel = { ...INITIAL_MODELS[0], id: newId, nombre: 'Nuevo Modelo Personalizado', description: 'Copia del modelo estándar.' };
    setModels([...models, newModel]);
    setSelectedId(newId);
    setIsEditing(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      {/* ── HEADER ── */}
      <div className="max-w-[1600px] mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
                <Award className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Modelos de Bonificación</h1>
            </div>
            <p className="text-slate-500 font-medium text-sm max-w-2xl">
              Diseña y personaliza las reglas de incentivos por producción y métricas de calidad. 
              Configura tramos dinámicos para automatizar el cálculo de bonos variables.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={createNewModel}
              className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95"
            >
              <Plus size={16} /> Nuevo Modelo
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-900 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ── SIDEBAR: MODEL LIST ── */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white/70 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mis Modelos</h3>
              <Filter className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-3">
              {models.map(m => (
                <button
                  key={m._id || m.id}
                  onClick={() => setSelectedId(m._id || m.id)}
                  className={`w-full text-left p-5 rounded-3xl border-2 transition-all group relative overflow-hidden ${selectedId === (m._id || m.id) ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-50 border-transparent hover:border-indigo-100 hover:bg-white'}`}
                >
                  {m.activo && (
                    <div className="absolute top-0 right-0 p-3">
                      <Star className="w-4 h-4 text-white/50 fill-white/20" />
                    </div>
                  )}
                  <p className={`text-xs font-black uppercase tracking-tight mb-1 ${selectedId === (m._id || m.id) ? 'text-white' : 'text-slate-900'}`}>{m.nombre}</p>
                  <p className={`text-[10px] font-bold leading-relaxed ${selectedId === (m._id || m.id) ? 'text-indigo-100' : 'text-slate-400'}`}>{m.activo ? 'Modelo Activo' : 'Borrador'}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6">
            <div className="flex gap-3 items-start">
              <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Malla Legal DT</p>
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                  Asegúrese de que los bonos variables (Baremos/Metas) sean correctamente informados como imponibles en el libro de remuneraciones.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── MAIN AREA: EDITOR ── */}
        <div className="lg:col-span-9 space-y-8">
          
          {/* MODEL INFO CARD */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex-1">
                   <div className="flex items-center gap-3 mb-2">
                     <FileEdit className="w-6 h-6 text-indigo-600" />
                     <input 
                       value={activeModel.nombre} 
                       onChange={(e) => updateTramo(null, null, 'nombre', e.target.value)}
                       className="text-2xl font-black text-indigo-900 tracking-tight bg-transparent border-b-2 border-dotted border-indigo-200 focus:border-indigo-500 focus:outline-none w-full"
                     />
                   </div>
                   <textarea 
                     value={activeModel.description}
                     onChange={(e) => updateTramo(null, null, 'description', e.target.value)}
                     className="text-sm font-semibold text-slate-500 bg-transparent w-full resize-none focus:outline-none"
                     rows="2"
                   />
                </div>
                <div className="flex flex-col items-end gap-3">
                   <div 
                      onClick={() => toggleActive(activeModel._id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl border shadow-sm transition-all cursor-pointer hover:scale-105 ${activeModel.activo ? 'bg-emerald-50 text-emerald-600 border-emerald-100 animate-in fade-in zoom-in duration-500' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                   >
                      {activeModel.activo ? <Target className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      <span className="text-[11px] font-black uppercase tracking-widest">
                         {activeModel.activo ? 'Activo para Producción' : 'Click para Activar'}
                      </span>
                   </div>
                   
                   {/* SELECCION DE TIPO DE BONO (DT) */}
                   <div className="relative group/sel">
                      <div className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-[2rem] shadow-sm group-hover/sel:border-indigo-500 transition-all">
                        <Scale className="w-4 h-4 text-indigo-600" />
                        <select 
                          value={activeModel.tipoBonoRef || ''}
                          onChange={(e) => updateTramo(null, null, 'tipoBonoRef', e.target.value)}
                          className="bg-transparent text-[11px] font-black text-slate-600 uppercase tracking-tight focus:outline-none cursor-pointer pr-4"
                        >
                          <option value="">Vínculo Legal DT [No Seleccionado]</option>
                          {tiposBono.map(t => (
                            <option key={t._id} value={t._id}>
                              {t.nombre} ({t.tipo === 'IMPONIBLE' ? 'Rem.' : 'Indem.'})
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      {activeModel.tipoBonoRef && (
                        <div className="mt-2 flex items-center gap-2 px-4 py-1.5 bg-indigo-50/50 rounded-full border border-indigo-100 animate-in slide-in-from-top-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                           <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter italic">
                             {tiposBono.find(tx => tx._id === activeModel.tipoBonoRef)?.nombre} se reflejará en Nómina LRE
                           </span>
                        </div>
                      )}
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 gap-12">
                
                {/* 1. TRAMOS BAREMOS */}
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Tramos de Puntos Baremos</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compensación por unidad de producción realizada</p>
                      </div>
                    </div>
                    <button onClick={() => addRow('tramosBaremos')} className="p-2 hover:bg-slate-50 rounded-xl text-indigo-600 transition-colors">
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-inner bg-slate-50/30">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-slate-100">
                          <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Desde (Pts)</th>
                          <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Hasta (Pts)</th>
                          <th className="px-8 py-4 text-[9px] font-black text-indigo-600 uppercase tracking-widest text-right">Valor PB (CLP)</th>
                          <th className="px-4 py-4 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeModel.tramosBaremos.map((t, idx) => (
                          <tr key={idx} className="group hover:bg-white transition-colors">
                            <td className="px-8 py-5">
                               <input type="number" value={t.desde} onChange={(e) => updateTramo('tramosBaremos', idx, 'desde', parseInt(e.target.value))}
                                 className="w-24 bg-transparent font-black text-slate-800 focus:outline-none focus:text-indigo-600 leading-none text-lg tabular-nums" />
                            </td>
                            <td className="px-8 py-5 text-center">
                               <input type="text" value={t.hasta} onChange={(e) => updateTramo('tramosBaremos', idx, 'hasta', e.target.value)}
                                 className="w-24 bg-transparent font-black text-slate-800 text-center focus:outline-none focus:text-indigo-600 leading-none text-lg tabular-nums" />
                            </td>
                            <td className="px-8 py-5 text-right font-black text-emerald-600 text-lg tabular-nums">
                               <div className="flex items-center justify-end gap-1">
                                  <span>$</span>
                                  <input type="number" value={t.valor} onChange={(e) => updateTramo('tramosBaremos', idx, 'valor', parseInt(e.target.value))}
                                    className="bg-transparent text-right focus:outline-none focus:text-indigo-600 w-32" />
                               </div>
                            </td>
                            <td className="px-4 py-5">
                               <button onClick={() => removeRow('tramosBaremos', idx)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                 <Trash2 size={16} />
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* 2. CALIDAD RR */}
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                          <TrendingUp size={20} />
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Calidad RR</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bono por tasa de reincidencia</p>
                        </div>
                      </div>
                      <button onClick={() => addRow('tramosRR')} className="p-2 hover:bg-slate-50 rounded-xl text-emerald-600 transition-colors">
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="bg-emerald-50/20 border border-emerald-100 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/50 border-b border-emerald-100">
                            <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Rango / Operador</th>
                            <th className="px-6 py-4 text-[8px] font-black text-emerald-600 uppercase tracking-widest text-right">Monto</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100/50">
                          {activeModel.tramosRR.map((t, idx) => (
                            <tr key={idx} className="group hover:bg-white/40 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-2">
                                    {!t.operator ? (
                                      <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-black text-slate-700 tabular-nums">
                                        <input type="number" step="0.01" value={t.desde} onChange={(e) => updateTramo('tramosRR', idx, 'desde', parseFloat(e.target.value))}
                                          className="w-10 bg-transparent focus:outline-none" />
                                        <span className="text-slate-300 mx-1">/</span>
                                        <input type="number" step="0.01" value={t.hasta} onChange={(e) => updateTramo('tramosRR', idx, 'hasta', parseFloat(e.target.value))}
                                          className="w-10 bg-transparent focus:outline-none" />
                                        <span>%</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 text-[11px] font-black text-slate-700">
                                        <select 
                                          value={t.operator} 
                                          onChange={(e) => updateTramo('tramosRR', idx, 'operator', e.target.value)}
                                          className="text-emerald-500 bg-transparent font-black cursor-pointer focus:outline-none"
                                        >
                                          <option value=">">&gt;</option>
                                          <option value="<">&lt;</option>
                                        </select>
                                        <input type="number" step="0.01" value={t.limit} onChange={(e) => updateTramo('tramosRR', idx, 'limit', parseFloat(e.target.value))}
                                          className="w-12 bg-transparent focus:outline-none tabular-nums" />
                                        <span>%</span>
                                      </div>
                                    )}
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-right font-black text-emerald-700 tabular-nums">
                                 <input type="number" value={t.valor} onChange={(e) => updateTramo('tramosRR', idx, 'valor', parseInt(e.target.value))}
                                   className="bg-transparent text-right focus:outline-none focus:text-indigo-600 w-24" />
                              </td>
                              <td className="pr-4">
                                 <button onClick={() => removeRow('tramosRR', idx)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                   <Trash2 size={12} />
                                 </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* 3. CALIDAD AI */}
                  <section>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                          <Settings size={20} />
                        </div>
                        <div>
                          <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Calidad AI</h2>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bono por índice de auditoría</p>
                        </div>
                      </div>
                      <button onClick={() => addRow('tramosAI')} className="p-2 hover:bg-slate-50 rounded-xl text-blue-600 transition-colors">
                        <Plus size={20} />
                      </button>
                    </div>

                    <div className="bg-blue-50/20 border border-blue-100 rounded-3xl overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/50 border-b border-blue-100">
                            <th className="px-6 py-4 text-[8px] font-black text-slate-400 uppercase tracking-widest">Rango / Operador</th>
                            <th className="px-6 py-4 text-[8px] font-black text-blue-600 uppercase tracking-widest text-right">Monto</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100/50">
                          {activeModel.tramosAI.map((t, idx) => (
                            <tr key={idx} className="group hover:bg-white/40 transition-colors">
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-2">
                                    {!t.operator ? (
                                      <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-[11px] font-black text-slate-700 tabular-nums">
                                        <input type="number" step="0.01" value={t.desde} onChange={(e) => updateTramo('tramosAI', idx, 'desde', parseFloat(e.target.value))}
                                          className="w-10 bg-transparent focus:outline-none" />
                                        <span className="text-slate-300 mx-1">/</span>
                                        <input type="number" step="0.01" value={t.hasta} onChange={(e) => updateTramo('tramosAI', idx, 'hasta', parseFloat(e.target.value))}
                                          className="w-10 bg-transparent focus:outline-none" />
                                        <span>%</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-blue-100 text-[11px] font-black text-slate-700">
                                        <select 
                                          value={t.operator} 
                                          onChange={(e) => updateTramo('tramosAI', idx, 'operator', e.target.value)}
                                          className="text-blue-500 bg-transparent font-black cursor-pointer focus:outline-none"
                                        >
                                          <option value=">">&gt;</option>
                                          <option value="<">&lt;</option>
                                        </select>
                                        <input type="number" step="0.01" value={t.limit} onChange={(e) => updateTramo('tramosAI', idx, 'limit', parseFloat(e.target.value))}
                                          className="w-12 bg-transparent focus:outline-none tabular-nums" />
                                        <span>%</span>
                                      </div>
                                    )}
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-right font-black text-blue-700 tabular-nums">
                                 <input type="number" value={t.valor} onChange={(e) => updateTramo('tramosAI', idx, 'valor', parseInt(e.target.value))}
                                   className="bg-transparent text-right focus:outline-none focus:text-indigo-600 w-24" />
                              </td>
                              <td className="pr-4">
                                 <button onClick={() => removeRow('tramosAI', idx)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                   <Trash2 size={12} />
                                 </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                </div>

             </div>
          </div>

          {/* HELP COMPONENT */}
          <div className="bg-indigo-900 border border-indigo-800 rounded-[3rem] p-10 overflow-hidden relative group">
             <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] group-hover:bg-indigo-400/30 transition-all duration-1000" />
             <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                <div className="p-5 bg-white/10 backdrop-blur-md rounded-3xl border border-white/10">
                   <Target className="w-12 h-12 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                   <h3 className="text-2xl font-black text-white tracking-tight mb-2">Simulación de Bonificación</h3>
                   <p className="text-indigo-200 text-sm font-medium leading-relaxed mb-6">
                     Utiliza los modelos creados para simular el impacto en el gasto de nómina antes de activarlos. 
                     Puedes asignar modelos específicos por Cliente, Proyecto o incluso a nivel de Técnico individual.
                   </p>
                   <button className="px-8 py-3.5 bg-white text-indigo-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:shadow-2xl hover:shadow-indigo-500/20 hover:-translate-y-0.5 transition-all">
                     Iniciar Simulador <ChevronRight className="inline w-4 h-4 ml-2" />
                   </button>
                </div>
             </div>
          </div>

        </div>

      </div>
      )}
    </div>
  );
};

export default ModelosBonificacion;
