import React, { useState, useEffect } from 'react';
import { telecomApi as api } from '../telecomApi';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, AlertOctagon, Activity, Hammer, Target, Users, XCircle, Info } from 'lucide-react';

export default function GarantiasTab({ 
  dateFrom, dateTo, selectedZonas, selectedProyectos, selectedCategorias, selectedMonths, tecnicoFijo, selectedTecnicos, actividadFilter 
}) {
  const [data, setData] = useState([]);
  const [resumen, setResumen] = useState({ totalEvaluadas: 0, totalFallas: 0, porcentajeFalla: 0 });
  const [statsTipo, setStatsTipo] = useState({ altas: { eval: 0, fallas: 0, pct: 0 }, reparaciones: { eval: 0, fallas: 0, pct: 0 } });
  const [statsProyectos, setStatsProyectos] = useState([]);
  const [statsTecnicos, setStatsTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTecnicoFilter, setSelectedTecnicoFilter] = useState(null);
  const [selectedGarantia, setSelectedGarantia] = useState(null);

  useEffect(() => {
    fetchGarantias();
  }, [dateFrom, dateTo, selectedZonas, selectedProyectos, selectedCategorias, selectedMonths, tecnicoFijo, selectedTecnicos, actividadFilter]);

  const fetchGarantias = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        desde: dateFrom,
        hasta: dateTo
      });
      if (selectedZonas?.length > 0) params.append('zonas', selectedZonas.join(','));
      if (selectedProyectos?.length > 0) params.append('proyectos', selectedProyectos.join(','));
      if (selectedCategorias?.length > 0) params.append('categorias', selectedCategorias.join(','));
      if (selectedMonths?.length > 0) params.append('months', selectedMonths.join(','));
      if (tecnicoFijo) params.append('tecnicoId', tecnicoFijo);
      if (selectedTecnicos?.length > 0) params.append('tecnicos', selectedTecnicos.join(','));
      if (actividadFilter) params.append('actividad', actividadFilter);

      const res = await api.get(`/bot/garantias-stats?${params.toString()}`);
      if (res.data.success) {
        setData(res.data.data);
        setResumen(res.data.resumen);
        setStatsTipo(res.data.statsTipo || { altas: { eval: 0, fallas: 0, pct: 0 }, reparaciones: { eval: 0, fallas: 0, pct: 0 } });
        setStatsProyectos(res.data.statsProyectos || []);
        setStatsTecnicos(res.data.statsTecnicos || []);
      }
    } catch (err) {
      console.error('Error fetching garantias:', err);
      setError('Error al obtener datos de garantías');
    } finally {
      setLoading(false);
    }
  };

  const getFallaColor = (pct) => {
    if (pct === 0) return 'text-slate-400';
    if (pct < 3) return 'text-emerald-500';
    if (pct < 7) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & KPIS ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-indigo-600" />
            Análisis de Garantías (Calidad)
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Reingresos por reparación antes de 30 días de la actividad original.
          </p>
        </div>
        <button
          onClick={fetchGarantias}
          disabled={loading}
          className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle2 size={64} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Evaluadas</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-slate-800 tracking-tighter">
              {resumen.totalEvaluadas.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 mb-2">OTs</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <AlertOctagon size={64} className="text-rose-500" />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Fallas (Garantías)</p>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-black text-rose-600 tracking-tighter">
              {resumen.totalFallas.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-slate-400 mb-2">OTs</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldAlert size={64} className={getFallaColor(resumen.porcentajeFalla)} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">% Falla Calidad</p>
          <div className="flex items-end gap-2">
            <span className={`text-4xl font-black tracking-tighter ${getFallaColor(resumen.porcentajeFalla)}`}>
              {resumen.porcentajeFalla}%
            </span>
          </div>
        </div>
      </div>

      {/* ── AGRUPACIONES (TIPO Y PROYECTOS) ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Altas vs Reparaciones */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Activity size={16} className="text-indigo-500" />
            Por Tipo de Actividad
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">Altas/Rutinas</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-black ${getFallaColor(statsTipo.altas.pct)}`}>{statsTipo.altas.pct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">({statsTipo.altas.fallas}/{statsTipo.altas.eval})</span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-500">Reparaciones</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-black ${getFallaColor(statsTipo.reparaciones.pct)}`}>{statsTipo.reparaciones.pct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">({statsTipo.reparaciones.fallas}/{statsTipo.reparaciones.eval})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Proyectos */}
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Target size={16} className="text-teal-500" />
            Por Proyecto
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {statsProyectos.length === 0 ? (
               <div className="col-span-full text-xs text-slate-400">Sin datos de proyectos...</div>
            ) : (
               statsProyectos.slice(0, 6).map((proj, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3 flex flex-col justify-between border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-600 truncate" title={proj.proyecto}>{proj.proyecto}</span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className={`text-lg font-black ${getFallaColor(proj.porcentaje)}`}>{proj.porcentaje}%</span>
                      <span className="text-[9px] text-slate-400">{proj.fallas} fallas</span>
                    </div>
                  </div>
               ))
            )}
          </div>
        </div>
      </div>

      {/* ── RANKING DE TÉCNICOS ──────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            Ranking de Calidad por Técnico
          </h3>
          <span className="text-xs text-slate-400 font-medium">Técnicos ordenados por mayor tasa de falla</span>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-100">
              <tr>
                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</th>
                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Evaluadas</th>
                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fallas (Altas)</th>
                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Fallas (Rep)</th>
                <th className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">% Falla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {statsTecnicos.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-center text-xs text-slate-400">Cargando...</td></tr>
              ) : (
                statsTecnicos.map((tec, idx) => {
                  const isSelected = selectedTecnicoFilter === tec.id;
                  return (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedTecnicoFilter(isSelected ? null : tec.id)}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/80 hover:bg-indigo-100/80' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="p-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{tec.nombre}</span>
                        <div className="flex items-center gap-1">
                           <span className="text-[10px] font-medium text-slate-400">ID: {tec.id}</span>
                           <span className="text-[10px] text-slate-300">•</span>
                           <span className="text-[10px] font-medium text-slate-500 truncate max-w-[120px]" title={tec.proyecto}>{tec.proyecto}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs font-bold text-slate-500">{tec.evaluadas}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs font-bold text-rose-500">{tec.fallasAltas}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs font-bold text-rose-500">{tec.fallasReparaciones}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className={`text-sm font-black ${getFallaColor(tec.porcentaje)}`}>{tec.porcentaje}%</span>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABLA DE DETALLES ──────────────────────────────────────── */}
      <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Detalle de Reingresos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad Original</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico Origen</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-rose-50/50">Reparación (Falla)</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-rose-50/50">Técnico Reparador</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(() => {
                const filteredData = selectedTecnicoFilter 
                  ? data.filter(d => String(d.actividadInicial?.tecnicoId || '').includes(String(selectedTecnicoFilter)))
                  : data;
                
                if (loading && data.length === 0) {
                  return (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400 text-sm font-medium">
                        Analizando 30 días de historial...
                      </td>
                    </tr>
                  );
                }
                
                if (filteredData.length === 0) {
                  return (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400 text-sm font-medium">
                        No hay reingresos que mostrar para este filtro.
                      </td>
                    </tr>
                  );
                }

                return filteredData.map((item, idx) => (
                  <tr 
                    key={idx} 
                    onClick={() => setSelectedGarantia(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* ORIGINAL */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-800">{item.actividadInicial.orden}</span>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase">
                          {new Date(item.actividadInicial.fecha).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={item.actividadInicial.direccion}>
                          {item.actividadInicial.direccion}
                        </span>
                        <span className="text-[10px] font-medium text-slate-600 truncate max-w-[200px]">
                          {item.actividadInicial.cliente}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-700">{item.actividadInicial.tecnicoNombre}</span>
                        <span className="text-[10px] font-medium text-slate-400">ID: {item.actividadInicial.tecnicoId}</span>
                        <span className="text-[10px] font-medium text-slate-500 truncate max-w-[150px]">
                          {item.actividadInicial.proyecto}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded inline-flex w-max mt-1">
                          {item.actividadInicial.tipo}
                        </span>
                      </div>
                    </td>
                    
                    {/* FALLA */}
                    <td className="p-4 bg-rose-50/30">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-rose-700">{item.falla.orden}</span>
                        <span className="text-[10px] font-semibold text-rose-500/80 uppercase">
                          {new Date(item.falla.fecha).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]" title={item.falla.direccion}>
                          {item.falla.direccion}
                        </span>
                        <span className="text-[10px] font-medium text-slate-600 truncate max-w-[200px]">
                          {item.falla.cliente}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 bg-rose-50/30">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-700">{item.falla.tecnicoNombre}</span>
                        <span className="text-[10px] font-medium text-slate-400">ID: {item.falla.tecnicoId}</span>
                        <span className="text-[10px] font-medium text-slate-500 truncate max-w-[150px]">
                          {item.falla.proyecto}
                        </span>
                      </div>
                    </td>
                    
                    {/* TIEMPO */}
                    <td className="p-4 text-right align-middle">
                      <div className="inline-flex flex-col items-end">
                        <span className="text-sm font-black text-rose-600">{item.falla.diasTranscurridos}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Días</span>
                      </div>
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL DETALLE DE REINGRESO ────────────────────────────────── */}
      {selectedGarantia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="bg-slate-50/50 p-8 border-b border-slate-100 flex justify-between items-start shrink-0">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 flex items-center gap-1">
                    <AlertTriangle size={12} /> Reingreso Evaluado
                  </span>
                  <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100">
                    Garantía: {selectedGarantia.falla.diasTranscurridos} Días
                  </span>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Detalle de Actividades</h3>
              </div>
              <button onClick={() => setSelectedGarantia(null)} className="p-3 hover:bg-white hover:shadow-xl rounded-full transition-all border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600">
                <XCircle size={32} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* COLUMNA ORIGINAL */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={60}/></div>
                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Actividad Original
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Orden</p>
                        <p className="text-sm font-bold text-slate-800">{selectedGarantia.actividadInicial.orden}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</p>
                          <p className="text-xs font-bold text-slate-700">{new Date(selectedGarantia.actividadInicial.fecha).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tipo</p>
                          <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-0.5">{selectedGarantia.actividadInicial.tipo}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Técnico Origen</p>
                        <p className="text-sm font-bold text-slate-800">{selectedGarantia.actividadInicial.tecnicoNombre}</p>
                        <p className="text-xs text-slate-500">ID: {selectedGarantia.actividadInicial.tecnicoId} • {selectedGarantia.actividadInicial.proyecto}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                        <p className="text-xs font-bold text-slate-700">{selectedGarantia.actividadInicial.cliente}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{selectedGarantia.actividadInicial.direccion}, {selectedGarantia.actividadInicial.comuna}</p>
                      </div>
                      
                      <div className="bg-slate-50 rounded-2xl p-4 mt-2 border border-slate-100 space-y-3">
                        <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Info size={12}/> Detalles de Cierre</h5>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Cierres Secundarios STD</p>
                          <p className="text-[10px] font-medium text-slate-700 mt-0.5">{selectedGarantia.actividadInicial.cierresStd || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Cierres Secundarios TV</p>
                          <p className="text-[10px] font-medium text-slate-700 mt-0.5">{selectedGarantia.actividadInicial.cierresTv || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Observaciones</p>
                          <p className="text-[10px] font-medium text-slate-700 italic mt-0.5">{selectedGarantia.actividadInicial.observaciones || "Sin observaciones"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMNA FALLA */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5"><Hammer size={60}/></div>
                    <h4 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Reparación (Reingreso)
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Orden</p>
                        <p className="text-sm font-bold text-slate-800">{selectedGarantia.falla.orden}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</p>
                          <p className="text-xs font-bold text-slate-700">{new Date(selectedGarantia.falla.fecha).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Motivo Reparación</p>
                          <p className="text-[10px] font-bold text-rose-700 mt-0.5 leading-tight">{selectedGarantia.falla.motivoReparacion || "No especificado"}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Técnico Reparador</p>
                        <p className="text-sm font-bold text-slate-800">{selectedGarantia.falla.tecnicoNombre}</p>
                        <p className="text-xs text-slate-500">ID: {selectedGarantia.falla.tecnicoId} • {selectedGarantia.falla.proyecto}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</p>
                        <p className="text-xs font-bold text-slate-700">{selectedGarantia.falla.cliente}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{selectedGarantia.falla.direccion}</p>
                      </div>
                      
                      <div className="bg-rose-50/50 rounded-2xl p-4 mt-2 border border-rose-100 space-y-3">
                        <h5 className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5"><Info size={12}/> Detalles de Cierre Falla</h5>
                        <div>
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-wider">Cierres Secundarios STD</p>
                          <p className="text-[10px] font-medium text-slate-700 mt-0.5">{selectedGarantia.falla.cierresStd || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-wider">Cierres Secundarios TV</p>
                          <p className="text-[10px] font-medium text-slate-700 mt-0.5">{selectedGarantia.falla.cierresTv || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-rose-400 uppercase tracking-wider">Observaciones</p>
                          <p className="text-[10px] font-medium text-slate-700 italic mt-0.5">{selectedGarantia.falla.observaciones || "Sin observaciones"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
