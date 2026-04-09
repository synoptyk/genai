import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown, Plus, Search, Filter, RefreshCw, Save, Trash2, 
  ChevronRight, LayoutGrid, List, SlidersHorizontal, CheckCircle2,
  AlertCircle, Loader2, DollarSign, Target, BarChart3, Clock, 
  Gift, Percent, Zap, Info, ShieldCheck, Briefcase, Building2,
  Calendar, CreditCard, Scale, Activity, ArrowRightLeft, FileText, Settings,
  Heart, TrendingUp, Users
} from 'lucide-react';
import { useAuth } from '../../../platforms/auth/AuthContext';
import { bonificadoresApi, proyectosApi, configApi } from '../../rrhh/rrhhApi';

/**
 * 👑 MAESTRO UNIFICADO DE BONIFICADORES (v5.0)
 * El motor de bonificaciones más potente y completo del mercado.
 * Fusión de Tipos de Bono (Legal) + Modelos de Bonificación (Cálculo).
 */

const fmt = (v) => `$${Math.round(v || 0).toLocaleString('es-CL')}`;

const CATEGORIES = {
  'INCENTIVO': { icon: Target, color: 'indigo', label: 'Incentivo' },
  'REMUNERACIÓN': { icon: CreditCard, color: 'emerald', label: 'Remuneración' },
  'REEMBOLSO': { icon: ArrowRightLeft, color: 'sky', label: 'Reembolso' },
  'BONO_LEGAL': { icon: Scale, color: 'amber', label: 'Bono Legal' },
  'BIENESTAR': { icon: Heart, color: 'rose', label: 'Bienestar' },
  'OTRO': { icon: Settings, color: 'slate', label: 'Otro' }
};

const STRATEGIES = {
  'FIJO': { label: 'Bono Fijo', icon: DollarSign, desc: 'Monto fijo periódico.' },
  'BAREMO_PUNTOS': { label: 'Baremo Producción', icon: BarChart3, desc: 'Basado en puntos TOA/Producción.' },
  'COMISION': { label: 'Comisión Ventas', icon: TrendingUp, desc: 'Porcentaje o escala sobre ventas.' },
  'META_KPI': { label: 'Meta / KPI', icon: Zap, desc: 'Incentivo por cumplimiento de metas.' },
  'ESCALA_ANTIGÜEDAD': { label: 'Antigüedad', icon: Clock, desc: 'Escala por años de servicio.' },
  'GRATIFICACION_VOLUNTARIA': { label: 'Gratif. Voluntaria', icon: Gift, desc: 'Adicional a la legal.' },
  'FORMULA_PERSONALIZADA': { label: 'Fórmula Pro', icon: Activity, desc: 'Cálculo algorítmico libre.' }
};

const BonoMaestro = () => {
  const { user } = useAuth();
  const [bonificadores, setBonificadores] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [alert, setAlert] = useState(null);
  const [search, setSearch] = useState('');
  const [proyectos, setProyectos] = useState([]);
  const [companyConfig, setCompanyConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('CONFIG'); // CONFIG | PAYROLL | TARGETING
  const [viewMode, setViewMode] = useState('GRID'); // GRID | LIST

  const showAlert = (type, msg) => {
    setAlert({ type, msg });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [{ data: bons }, { data: projs }, { data: conf }] = await Promise.all([
        bonificadoresApi.getAll(),
        proyectosApi.getAll(),
        configApi.get()
      ]);
      setBonificadores(bons);
      setProyectos(projs);
      setCompanyConfig(conf);
      if (bons.length && !selectedId) setSelectedId(bons[0]._id);
    } catch (e) {
      console.error(e);
      showAlert('error', 'Error al sincronizar datos maestros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const selected = useMemo(() => bonificadores.find(b => b._id === selectedId), [bonificadores, selectedId]);

  const filtered = useMemo(() => bonificadores.filter(b => 
    b.nombre.toLowerCase().includes(search.toLowerCase()) || 
    b.strategy.toLowerCase().includes(search.toLowerCase())
  ), [bonificadores, search]);

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      await bonificadoresApi.update(selected._id, selected);
      showAlert('success', 'Bonificación guardada con éxito');
      fetchAll();
    } catch (e) {
      showAlert('error', 'Error al guardar cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('¿Deseas migrar y unificar todos tus modelos y tipos de bono antiguos al nuevo motor? Esta acción unificará la base de datos.')) return;
    setIsMigrating(true);
    try {
      await bonificadoresApi.migrateLegacy();
      showAlert('success', 'Sincronización masiva completada');
      fetchAll();
    } catch (e) {
      showAlert('error', 'Error durante la migración');
    } finally {
      setIsMigrating(false);
    }
  };

  const updateField = (path, value) => {
    setBonificadores(prev => prev.map(b => {
      if (b._id === selectedId) {
        const copy = { ...b };
        const parts = path.split('.');
        let current = copy;
        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = { ...current[parts[i]] };
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
        return copy;
      }
      return b;
    }));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh]">
      <Loader2 size={40} className="text-indigo-600 animate-spin mb-4" />
      <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Cargando Motor Unificado...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Alert Banner */}
      {alert && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-3xl shadow-2xl animate-in slide-in-from-right-4 duration-300 text-white text-[11px] font-black uppercase tracking-widest ${alert.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {alert.msg}
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-100 px-8 py-8 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-[1.25rem] shadow-xl shadow-indigo-600/20 flex items-center justify-center transform rotate-3">
              <Crown size={28} className="text-white fill-white/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Maestro de Bonificadores</h1>
                <span className="bg-indigo-100 text-indigo-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">v5.0 Pro</span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Motor Unificado de Incentivos · Gestión Legal DT · Cálculo Automático Payroll
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleMigrate}
              disabled={isMigrating}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95 disabled:opacity-50"
            >
              {isMigrating ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              Unificar Legado
            </button>
            <button className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">
              <Plus size={14} /> Crear Bono
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !selected}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-indigo-600/10 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
        
        {/* ── LEFT TRAY: LIST ── */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-sm">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 mb-6 focus-within:ring-2 ring-indigo-100 transition-all">
              <Search size={14} className="text-slate-400" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar bonificaciones..." 
                className="bg-transparent border-none focus:outline-none text-[11px] font-bold text-slate-700 w-full"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {filtered.map(b => {
                const strat = STRATEGIES[b.strategy] || STRATEGIES.FIJO;
                const StratIcon = strat.icon;
                const isSel = b._id === selectedId;
                return (
                  <button
                    key={b._id}
                    onClick={() => setSelectedId(b._id)}
                    className={`w-full text-left p-4 rounded-3xl border-2 transition-all flex items-center gap-4 ${isSel ? 'bg-slate-900 border-slate-900 shadow-2xl shadow-indigo-900/20 translate-x-2' : 'bg-slate-50 border-transparent hover:border-slate-200 hover:bg-white'}`}
                  >
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isSel ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                      <StratIcon size={18} className={isSel ? 'text-white' : 'text-indigo-600'} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isSel ? 'text-white' : 'text-slate-800'}`}>
                        {b.nombre}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${isSel ? 'text-slate-400' : 'text-slate-400'}`}>
                          {strat.label}
                        </span>
                        <div className={`w-1 h-1 rounded-full ${isSel ? 'bg-slate-600' : 'bg-slate-200'}`} />
                        <span className={`text-[8px] font-black uppercase tracking-tighter ${b.payroll?.tipo === 'IMPONIBLE' ? (isSel ? 'text-emerald-400' : 'text-emerald-600') : (isSel ? 'text-sky-400' : 'text-sky-600')}`}>
                          {b.payroll?.tipo}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
            <TrendingUp size={40} className="mb-4 opacity-50" />
            <h3 className="text-lg font-black tracking-tight leading-tight mb-2">Visión 360° de Compensaciones</h3>
            <p className="text-[10px] font-medium text-indigo-100/80 leading-relaxed mb-6">
              El motor unificado aplica las reglas de cálculo directamente en el cierre de período de RRHH, eliminando errores de doble carga.
            </p>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                <span>Bonos Activos</span>
                <span>{bonificadores.filter(b => b.activo).length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-80">
                <span>Impacto Payroll</span>
                <span>Alta</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MAIN EDITOR: TABS + PANELS ── */}
        <div className="lg:col-span-9 space-y-6">
          {!selected ? (
            <div className="bg-white border border-slate-100 rounded-[3rem] h-[60vh] flex flex-col items-center justify-center text-center p-12">
               <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                <SlidersHorizontal size={48} className="text-slate-200" />
               </div>
               <h2 className="text-xl font-black text-slate-800 tracking-tight mb-2">Selecciona un Bonificador</h2>
               <p className="text-slate-400 text-[11px] font-medium max-w-xs leading-relaxed uppercase tracking-widest">
                 Elije una configuración de la lista de la izquierda para editar sus reglas de cálculo y cumplimiento legal.
               </p>
            </div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm overflow-hidden relative">
                <div 
                  className="absolute top-0 right-0 w-64 h-64 opacity-[0.03] -mr-20 -mt-20 pointer-events-none"
                  style={{ color: selected.color || '#6366f1' }}
                >
                  <Crown size={256} className="fill-current" />
                </div>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
                  <div className="flex items-start gap-6">
                    <div 
                      className="w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl shrink-0"
                      style={{ backgroundColor: `${selected.color || '#6366f1'}15`, border: `2px solid ${selected.color || '#6366f1'}30` }}
                    >
                      {React.createElement(STRATEGIES[selected.strategy]?.icon || Settings, { size: 40, style: { color: selected.color || '#6366f1' } })}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full">
                          {selected.category || 'INCENTIVO'}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${selected.activo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${selected.activo ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {selected.activo ? 'Configuración Activa' : 'Borrador / Inactivo'}
                        </span>
                      </div>
                      <input 
                        value={selected.nombre}
                        onChange={e => updateField('nombre', e.target.value)}
                        placeholder="Nombre de la bonificación..."
                        className="text-4xl font-black text-slate-900 tracking-tighter bg-transparent border-none focus:outline-none focus:ring-0 w-full mb-3"
                      />
                      <textarea 
                        value={selected.description}
                        onChange={e => updateField('description', e.target.value)}
                        placeholder="Define el propósito y condiciones básicas de este bono..."
                        className="text-slate-400 text-sm font-medium bg-transparent border-none focus:outline-none focus:ring-0 w-full resize-none h-14 italic"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 shrink-0 min-w-[200px]">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Color del Tema</p>
                      <div className="flex gap-2">
                        {['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#f43f5e'].map(c => (
                          <button 
                            key={c} 
                            onClick={() => updateField('color', c)}
                            className={`w-6 h-6 rounded-full transition-transform ${selected.color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-200' : 'hover:scale-110'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 bg-slate-50 p-1.5 rounded-[2rem] border border-slate-100">
                  <button 
                    onClick={() => setActiveTab('CONFIG')}
                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'CONFIG' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                  >
                    1. Estrategia de Cálculo
                  </button>
                  <button 
                    onClick={() => setActiveTab('PAYROLL')}
                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'PAYROLL' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                  >
                    2. Configuración Payroll
                  </button>
                  <button 
                    onClick={() => setActiveTab('TARGETING')}
                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'TARGETING' ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
                  >
                    3. Aplicabilidad & Destinos
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm">
                
                {activeTab === 'CONFIG' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Settings size={20} />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Motor de Lógica</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                        {Object.entries(STRATEGIES).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => updateField('strategy', k)}
                            className={`flex items-start gap-4 p-5 rounded-[2rem] border-2 text-left transition-all ${selected.strategy === k ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                          >
                            <div className={`p-3 rounded-2xl shrink-0 ${selected.strategy === k ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                              <v.icon size={20} />
                            </div>
                            <div>
                              <p className={`text-[11px] font-black uppercase tracking-widest ${selected.strategy === k ? 'text-white' : 'text-slate-800'}`}>
                                {v.label}
                              </p>
                              <p className={`text-[9px] font-bold mt-1 ${selected.strategy === k ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {v.desc}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Render Strategy Editor */}
                      <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 min-h-[300px]">
                        {selected.strategy === 'FIJO' && (
                          <div className="space-y-6">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Monto Base Mensual (Bruto)</label>
                              <div className="flex items-center gap-4 bg-white border-2 border-slate-100 rounded-3xl px-8 py-6 focus-within:border-indigo-600 transition-all group">
                                <span className="text-3xl font-black text-slate-300 group-focus-within:text-indigo-600">$</span>
                                <input 
                                  value={selected.config?.monto || 0}
                                  onChange={e => updateField('config.monto', parseInt(e.target.value) || 0)}
                                  className="w-full text-5xl font-black text-slate-900 border-none focus:outline-none focus:ring-0 tabular-nums"
                                />
                              </div>
                              <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-1">
                                {fmt(selected.config?.monto)} Liquidados por período pagable.
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* ── ESTRATEGIA DE CÁLCULO DINÁMICA ── */}
                        {selected.strategy !== 'FIJO' && (
                          <div className="mt-8 pt-8 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-6">
                              <div>
                                <h4 className="text-[11px] font-black uppercase text-indigo-600 tracking-widest mb-1">Configuración del Algoritmo</h4>
                                <p className="text-[10px] text-slate-400">Define las reglas de cálculo para {STRATEGIES[selected.strategy]?.label}</p>
                              </div>
                            </div>

                            {/* BAERMO_PUNTOS EDITOR */}
                            {selected.strategy === 'BAREMO_PUNTOS' && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Puntos Excluidos (Cero)</label>
                                    <input 
                                      type="number"
                                      value={selected.config?.puntosExcluidos || 0}
                                      onChange={(e) => updateField('config.puntosExcluidos', parseFloat(e.target.value))}
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold outline-none focus:border-indigo-500"
                                      placeholder="Ej: 0-26 pts"
                                    />
                                  </div>
                                </div>

                                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                  <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Desde</th>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Hasta</th>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Valor $</th>
                                        <th className="p-3 w-10"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {(selected.config?.tramosBaremos || []).map((t, i) => (
                                        <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                          <td className="p-2">
                                            <input 
                                              type="number" value={t.desde} placeholder="Pts"
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.tramosBaremos || [])];
                                                newTramos[i].desde = parseFloat(e.target.value);
                                                updateField('config.tramosBaremos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                            />
                                          </td>
                                          <td className="p-2">
                                            <input 
                                              type="text" value={t.hasta} placeholder="Pts o 'Más'"
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.tramosBaremos || [])];
                                                newTramos[i].hasta = e.target.value === 'Más' ? 'Más' : parseFloat(e.target.value);
                                                updateField('config.tramosBaremos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                            />
                                          </td>
                                          <td className="p-2">
                                            <input 
                                              type="number" value={t.valor} placeholder="$ CLP"
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.tramosBaremos || [])];
                                                newTramos[i].valor = parseFloat(e.target.value);
                                                updateField('config.tramosBaremos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-black text-indigo-600 outline-none"
                                            />
                                          </td>
                                          <td className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                                            <button 
                                              onClick={() => {
                                                const newTramos = (selected.config.tramosBaremos || []).filter((_, idx) => idx !== i);
                                                updateField('config.tramosBaremos', newTramos);
                                              }}
                                              className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                            >
                                              <X size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <button 
                                    onClick={() => {
                                      const newTramos = [...(selected.config?.tramosBaremos || []), { desde: 0, hasta: '', valor: 0 }];
                                      updateField('config.tramosBaremos', newTramos);
                                    }}
                                    className="w-full py-4 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border-t border-slate-50 flex items-center justify-center gap-2"
                                  >
                                    <Plus size={14} /> Añadir Tramo de Baremo
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* COMISION EDITOR */}
                            {selected.strategy === 'COMISION' && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Base de Cálculo</label>
                                    <select 
                                      value={selected.config?.comision?.base || 'MONTO_VENTA'}
                                      onChange={(e) => updateField('config.comision.base', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                                    >
                                      <option value="MONTO_VENTA">Monto de Venta ($)</option>
                                      <option value="UNIDADES">Unidades Vendidas</option>
                                      <option value="PRODUCCION">Producción Bruta</option>
                                      <option value="RECAUDACION">Recaudación Efectiva</option>
                                    </select>
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo de Comisión</label>
                                    <select 
                                      value={selected.config?.comision?.tipo || 'PORCENTAJE'}
                                      onChange={(e) => updateField('config.comision.tipo', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                                    >
                                      <option value="PORCENTAJE">% Plano</option>
                                      <option value="ESCALA">Escala por Tramos</option>
                                    </select>
                                  </div>
                                </div>

                                {selected.config?.comision?.tipo === 'PORCENTAJE' ? (
                                  <div className="p-6 bg-gradient-to-br from-indigo-50/50 to-violet-50/50 border border-indigo-100 rounded-3xl">
                                    <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-3 text-center">Porcentaje de Comisión Directa</label>
                                    <div className="flex items-center justify-center gap-4">
                                      <input 
                                        type="number" step="0.01"
                                        value={selected.config?.comision?.porcentajePlano || 0}
                                        onChange={(e) => updateField('config.comision.porcentajePlano', parseFloat(e.target.value))}
                                        className="w-32 bg-white border-2 border-indigo-200 rounded-2xl py-4 px-6 text-2xl font-black text-indigo-600 text-center outline-none"
                                      />
                                      <span className="text-2xl font-black text-indigo-300">%</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                      <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                          <th className="p-3 text-[9px] font-black uppercase text-slate-400">Desde (Base)</th>
                                          <th className="p-3 text-[9px] font-black uppercase text-slate-400">Hasta (Base)</th>
                                          <th className="p-3 text-[9px] font-black uppercase text-slate-400">Comisión $ o %</th>
                                          <th className="p-3 w-10"></th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                        {(selected.config?.comision?.tramos || []).map((t, i) => (
                                          <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="p-2">
                                              <input 
                                                type="number" value={t.desde} 
                                                onChange={(e) => {
                                                  const newTramos = [...(selected.config.comision.tramos || [])];
                                                  newTramos[i].desde = parseFloat(e.target.value);
                                                  updateField('config.comision.tramos', newTramos);
                                                }}
                                                className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                              />
                                            </td>
                                            <td className="p-2">
                                              <input 
                                                type="text" value={t.hasta} 
                                                onChange={(e) => {
                                                  const newTramos = [...(selected.config.comision.tramos || [])];
                                                  newTramos[i].hasta = e.target.value === 'Más' ? 'Más' : parseFloat(e.target.value);
                                                  updateField('config.comision.tramos', newTramos);
                                                }}
                                                className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                              />
                                            </td>
                                            <td className="p-2">
                                              <input 
                                                type="number" value={t.valor} 
                                                onChange={(e) => {
                                                  const newTramos = [...(selected.config.comision.tramos || [])];
                                                  newTramos[i].valor = parseFloat(e.target.value);
                                                  updateField('config.comision.tramos', newTramos);
                                                }}
                                                className="w-full bg-transparent p-2 text-xs font-black text-indigo-600 outline-none"
                                              />
                                            </td>
                                            <td className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                                              <button 
                                                onClick={() => {
                                                  const newTramos = (selected.config.comision.tramos || []).filter((_, idx) => idx !== i);
                                                  updateField('config.comision.tramos', newTramos);
                                                }}
                                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                              >
                                                <X size={14} />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <button 
                                      onClick={() => {
                                        const existing = selected.config?.comision?.tramos || [];
                                        const newTramos = [...existing, { desde: 0, hasta: 'Más', valor: 0 }];
                                        updateField('config.comision.tramos', newTramos);
                                      }}
                                      className="w-full py-4 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border-t border-slate-50 flex items-center justify-center gap-2"
                                    >
                                      <Plus size={14} /> Añadir Escala de Comisión
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* META_KPI EDITOR */}
                            {selected.strategy === 'META_KPI' && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Meta Base Mensual</label>
                                    <input 
                                      type="number"
                                      value={selected.config?.metaKpi?.metaBase || 100}
                                      onChange={(e) => updateField('config.metaKpi.metaBase', parseFloat(e.target.value))}
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                                    />
                                  </div>
                                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unidad de Medida</label>
                                    <select 
                                      value={selected.config?.metaKpi?.unidad || 'PORCENTAJE'}
                                      onChange={(e) => updateField('config.metaKpi.unidad', e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold outline-none"
                                    >
                                      <option value="PORCENTAJE">Porcentaje (%)</option>
                                      <option value="PUNTOS">Puntos</option>
                                      <option value="UNIDADES">Unidades</option>
                                      <option value="CLP">Pesos ($)</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                                  <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                      <tr>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Desde ({selected.config?.metaKpi?.unidad})</th>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Hasta ({selected.config?.metaKpi?.unidad})</th>
                                        <th className="p-3 text-[9px] font-black uppercase text-slate-400">Premio $</th>
                                        <th className="p-3 w-10"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                      {(selected.config?.metaKpi?.tramos || []).map((t, i) => (
                                        <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                          <td className="p-2">
                                            <input 
                                              type="number" value={t.desde} 
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.metaKpi.tramos || [])];
                                                newTramos[i].desde = parseFloat(e.target.value);
                                                updateField('config.metaKpi.tramos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                            />
                                          </td>
                                          <td className="p-2">
                                            <input 
                                              type="text" value={t.hasta} 
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.metaKpi.tramos || [])];
                                                newTramos[i].hasta = e.target.value === 'Más' ? 'Más' : parseFloat(e.target.value);
                                                updateField('config.metaKpi.tramos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-bold outline-none"
                                            />
                                          </td>
                                          <td className="p-2">
                                            <input 
                                              type="number" value={t.monto} 
                                              onChange={(e) => {
                                                const newTramos = [...(selected.config.metaKpi.tramos || [])];
                                                newTramos[i].monto = parseFloat(e.target.value);
                                                updateField('config.metaKpi.tramos', newTramos);
                                              }}
                                              className="w-full bg-transparent p-2 text-xs font-black text-indigo-600 outline-none"
                                            />
                                          </td>
                                          <td className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                                            <button 
                                              onClick={() => {
                                                const newTramos = (selected.config.metaKpi.tramos || []).filter((_, idx) => idx !== i);
                                                updateField('config.metaKpi.tramos', newTramos);
                                              }}
                                              className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                            >
                                              <X size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <button 
                                    onClick={() => {
                                      const existing = selected.config?.metaKpi?.tramos || [];
                                      const newTramos = [...existing, { desde: 0, hasta: 'Más', monto: 0 }];
                                      updateField('config.metaKpi.tramos', newTramos);
                                    }}
                                    className="w-full py-4 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border-t border-slate-50 flex items-center justify-center gap-2"
                                  >
                                    <Plus size={14} /> Añadir Tramo de Meta
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* FALLBACK FOR OTHER STRATEGIES */}
                            {(['ESCALA_ANTIGÜEDAD', 'FORMULA_PERSONALIZADA'].includes(selected.strategy)) && (
                              <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
                                <Zap size={48} className="text-indigo-200 mb-4" />
                                <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Configuración Extendida de {STRATEGIES[selected.strategy]?.label}</p>
                                <p className="text-[9px] text-slate-400 mt-2">Personaliza tramos, baremos y multiplicadores específicos aquí.</p>
                                <button className="mt-4 px-6 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-400 uppercase hover:text-indigo-600 hover:border-indigo-100 transition-all">Abrir Editor Experto</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'PAYROLL' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <Building2 size={14} className="text-indigo-600" /> Clasificación Tributaria
                        </h4>
                        
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Imponibilidad (Chile DT)</label>
                            <div className="flex gap-2">
                              {['IMPONIBLE', 'NO_IMPONIBLE'].map(t => (
                                <button
                                  key={t}
                                  onClick={() => updateField('payroll.tipo', t)}
                                  className={`flex-1 py-4 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${selected.payroll?.tipo === t ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200'}`}
                                >
                                  {t.replace('_', ' ')}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Código LRE (DT)</label>
                            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 focus-within:bg-white transition-all">
                              <FileText size={18} className="text-slate-300" />
                              <input 
                                value={selected.payroll?.codigoDT}
                                onChange={e => updateField('payroll.codigoDT', e.target.value)}
                                placeholder="Ej: 1010, 1040, 2010..."
                                className="bg-transparent border-none focus:outline-none text-xl font-black text-slate-700 w-full tracking-tighter"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                          <ShieldCheck size={14} className="text-emerald-600" /> Soporte Legal & Avisos
                        </h4>
                        <div className="space-y-6">
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Sustento en Código del Trabajo</label>
                            <input 
                              value={selected.payroll?.baseLegal}
                              onChange={e => updateField('payroll.baseLegal', e.target.value)}
                              placeholder="Ej: Art. 42 letra a)..."
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-[11px] font-bold text-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Instrucciones / Observación DT</label>
                            <textarea 
                              value={selected.payroll?.observacionDT}
                              onChange={e => updateField('payroll.observacionDT', e.target.value)}
                              rows={4}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-[11px] font-medium text-slate-500 italic"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'TARGETING' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center gap-10">
                      <div className="w-48 h-48 bg-white rounded-full shadow-2xl flex items-center justify-center shrink-0 border-[10px] border-white ring-1 ring-indigo-200">
                        <Users size={64} className="text-indigo-600" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-indigo-900 tracking-tight mb-4 flex items-center gap-3">
                          Alcance Global
                        </h4>
                        <p className="text-indigo-700/60 text-sm font-medium leading-relaxed mb-6">
                          Define quiénes reciben esta bonificación. Puedes hacerlo de forma masiva para toda la empresa o segmentar por cargos y departamentos específicos.
                        </p>
                        <button 
                          onClick={() => updateField('targeting.todos', !selected.targeting?.todos)}
                          className={`px-8 py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all ${selected.targeting?.todos ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40' : 'bg-white text-indigo-600 border-2 border-indigo-200 hover:border-indigo-400'}`}
                        >
                          {selected.targeting?.todos ? 'Aplica a Toda la Empresa' : 'Personalizado por Segmento'}
                        </button>
                      </div>
                    </div>

                    {!selected.targeting?.todos && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
                            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center justify-between">
                              Filtrar por Cargos
                              <span className="text-[9px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{(selected.targeting?.cargos || []).length} seleccionados</span>
                            </h5>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                              {(companyConfig?.cargos || []).map(cargo => {
                                const cargoName = typeof cargo === 'object' ? cargo.nombre : cargo;
                                const isSel = (selected.targeting?.cargos || []).includes(cargoName);
                                return (
                                  <button
                                    key={cargoName}
                                    onClick={() => {
                                      const current = selected.targeting?.cargos || [];
                                      const next = isSel ? current.filter(c => c !== cargoName) : [...current, cargoName];
                                      updateField('targeting.cargos', next);
                                    }}
                                    className={`w-full text-left p-3 rounded-xl text-[10px] font-bold transition-all border ${isSel ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'}`}
                                  >
                                    {cargoName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
                            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center justify-between">
                              Filtrar por Proyectos
                              <span className="text-[9px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{(selected.targeting?.proyectos || []).length} seleccionados</span>
                            </h5>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                              {(proyectos || []).map(proj => {
                                const isSel = (selected.targeting?.proyectos || []).includes(proj._id);
                                return (
                                  <button
                                    key={proj._id}
                                    onClick={() => {
                                      const current = selected.targeting?.proyectos || [];
                                      const next = isSel ? current.filter(id => id !== proj._id) : [...current, proj._id];
                                      updateField('targeting.proyectos', next);
                                    }}
                                    className={`w-full text-left p-3 rounded-xl text-[10px] font-bold transition-all border ${isSel ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600 hover:border-slate-200'}`}
                                  >
                                    {proj.nombreProyecto}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                       </div>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BonoMaestro;
