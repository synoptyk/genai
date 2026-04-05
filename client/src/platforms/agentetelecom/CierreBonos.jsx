import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  CalendarCheck, Activity, Award, TrendingUp, ShieldCheck, 
  Download, Filter, Search, Printer, Trophy, Target, Zap, Clock, Info,
  CheckCircle2, AlertCircle, RefreshCw, Save, ChevronRight, Loader2,
  Lock, Unlock
} from 'lucide-react';
import { telecomApi as api } from './telecomApi';
import { useAuth } from '../auth/AuthContext';
import * as XLSX from 'xlsx';

const CLP = (v) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

const CierreBonos = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [model, setModel] = useState(null);
  const [techs, setTechs] = useState([]);
  const [stats, setStats] = useState(null);
  const [existingClosure, setExistingClosure] = useState(null);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // ── FETCH DATA ──
  const fetchBonusContext = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check for existing closure (API returns array)
      const closureRes = await api.get(`/admin/bonos/closure/${year}/${month}`);
      const closures = closureRes.data;
      const closure = Array.isArray(closures) && closures.length > 0 ? closures[0] : null;
      setExistingClosure(closure);

      // 2. Get active bonus model
      const modelRes = await api.get('/admin/bonos/active');
      const activeModel = modelRes.data;
      setModel(activeModel);

      if (closure && closure.calculos?.length > 0) {
        // Use consolidated data
        setTechs(closure.calculos.map(c => ({
            ...c,
            name: c.nombre,
            ptsTotal: c.puntos,
            idRecursoToa: c.tecnicoId
        })));
      } else {
        // Fetch fresh production stats
        const daysInMonth = new Date(year, month, 0).getDate();
        const desde = `${year}-${String(month).padStart(2, '0')}-01`;
        const hasta = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        
        const statsRes = await api.get('/bot/produccion-stats', { params: { desde, hasta, estado: 'Completado' } });
        setStats(statsRes.data);
        
        // Transform stats to working techs with random (editable) quality
        if (statsRes.data?.tecnicos) {
            const transformed = statsRes.data.tecnicos.map(t => {
                const pts = t.ptsTotal || 0;
                
                let multiplier = 0;
                let baremoBonus = 0;
                let rrBonus = 0;
                let aiBonus = 0;

                let tramoLogrado = 'S/M';
                
                // Calculate Baremos Bonus only if model exists
                if (activeModel && activeModel.tramosBaremos) {
                    const tier = activeModel.tramosBaremos.find(tr => {
                        const hString = String(tr.hasta).trim().toLowerCase();
                        const isMax = hString === 'más' || hString === 'mas' || hString === 'mas+' || hString === '';
                        const limitMax = isMax ? 999999 : parseFloat(tr.hasta);
                        const limitMin = parseFloat(tr.desde) || 0;
                        const currentPts = parseFloat(pts) || 0;
                        return currentPts >= limitMin && currentPts <= limitMax;
                    });
                    multiplier = tier ? parseFloat(tier.valor) : 0;
                    baremoBonus = (parseFloat(pts) || 0) * multiplier;
                    
                    if (tier) {
                        const limitVisual = String(tier.hasta).trim().toLowerCase() === 'más' || String(tier.hasta).trim().toLowerCase() === 'mas' ? '∞' : tier.hasta;
                        tramoLogrado = `${tier.desde} a ${limitVisual} pts`;
                    }
                }

                // Real Backend Data for RR
                const rrFails = t.rrFails || 0;
                const rrOrdersCount = t.rrOrdersCount || 0;
                const rrRealPercent = t.rrRealPercent || 0;
                
                // Use actual computed % rounded to 2 decimals
                const rrValue = Math.round(rrRealPercent * 100) / 100;
                
                // Simulated AI default (user will edit)
                const techSeed = t.name.length;
                const aiValue = 1.0 + (techSeed % 3);

                if (activeModel && t.orders > 0 && rrOrdersCount > 0) {
                    const rawRR = calculateTierBonus(rrValue, activeModel.tramosRR);
                    const rawAI = calculateTierBonus(aiValue, activeModel.tramosAI);

                    // Calculation of Proportional Bonus based on Days Worked vs Expected Month Days
                    const expectedDays = statsRes.data?.metaConfig?.diasLaboralesMes || 22;
                    const daysWorked = t.activeDays || 1;
                    const proportionalFactor = Math.max(0, Math.min(1, daysWorked / expectedDays));

                    rrBonus = Math.round(rawRR * proportionalFactor);
                    aiBonus = Math.round(rawAI * proportionalFactor);
                }

                return {
                    ...t,
                    multiplier,
                    baremoBonus,
                    tramoLogrado,
                    rrFails,
                    rrOrdersCount,
                    rrValue,
                    aiValue,
                    rrBonus,
                    aiBonus
                };
            });
            setTechs(transformed);
        }
      }
    } catch (err) {
      console.error('Error fetching closure data:', err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchBonusContext();
  }, [fetchBonusContext]);

  const calculateTierBonus = (val, tramos) => {
    if (!tramos || tramos.length === 0) return 0;
    
    // Evaluate all rules that match the current metric
    const matchingTiers = tramos.filter(t => {
        if (t.operator === '<') return val < t.limit;
        if (t.operator === '>') return val > t.limit;
        return val >= t.desde && val <= t.hasta;
    });

    if (matchingTiers.length === 0) return 0;

    // Graceful recovery: If the user accidentally created overlapping rules (e.g. <6.5 paying 0 and <5 paying 65000),
    // we award the highest valid matching value instead of locking onto the first accidental 0 rule.
    return Math.max(...matchingTiers.map(t => t.valor || 0));
  };

  // ── HANDLERS ──
  const updateTechQuality = (idx, field, rawValue) => {
    if (existingClosure) return; // Locked
    const val = parseFloat(rawValue) || 0;
    setTechs(prev => prev.map((t, i) => {
        if (i !== idx) return t;
        const newTech = { ...t, [field]: val };

        const expectedDays = stats?.metaConfig?.diasLaboralesMes || 22;
        const daysWorked = t.activeDays || 1;
        const proportionalFactor = (t.orders > 0 && t.rrOrdersCount > 0) ? Math.max(0, Math.min(1, daysWorked / expectedDays)) : 0;

        // Recalculate component bonuses
        if (field === 'rrValue') newTech.rrBonus = Math.round(calculateTierBonus(val, model.tramosRR) * proportionalFactor);
        if (field === 'aiValue') newTech.aiBonus = Math.round(calculateTierBonus(val, model.tramosAI) * proportionalFactor);
        return newTech;
    }));
  };

  const handleConsolidate = async () => {
    if (!model || techs.length === 0) return;
    setIsConsolidating(true);
    try {
        const payload = {
            mes: month,
            anio: year,
            modeloId: model._id,
            calculos: techs.map(t => ({
                tecnicoId: t.idRecursoToa || t._id,
                nombre: t.name,
                puntos: t.ptsTotal,
                multiplier: t.multiplier,
                baremoBonus: t.baremoBonus,
                rrValue: t.rrValue,
                rrBonus: t.rrBonus,
                aiValue: t.aiValue,
                aiBonus: t.aiBonus,
                totalBonus: t.baremoBonus + t.rrBonus + t.aiBonus
            })),
            totales: totals
        };
        await api.post('/admin/bonos/consolidate', payload);
        alert('Cierre mensual consolidado con éxito.');
        fetchBonusContext();
    } catch (err) {
        alert('Error al consolidar el bono.');
    } finally {
        setIsConsolidating(false);
    }
  };

  const handleReopen = async () => {
    if (!window.confirm('¿Estás seguro de re-abrir este mes? Esto desbloqueará los métricas y ocultará los datos de bonos en nómina hasta que vuelvas a cerrar.')) return;
    try {
        await api.delete(`/admin/bonos/closure/${year}/${month}`);
        fetchBonusContext();
    } catch (err) {
        alert('Error al re-abrir el mes');
    }
  };

  const handleExportTable = () => {
    if (filteredTechs.length === 0) return;
    
    // Create an array of objects to guarantee Excel recognizes purely atomic values (numbers vs strings)
    const exportData = filteredTechs.map(t => ({
      'ID Recurso': t.idRecursoToa || t.idRecurso || 'N/A',
      'RUT': t.rut || 'N/A',
      'Operario': t.name,
      'Días Trabajados': t.activeDays || 0,
      'Órdenes': t.orders || 0,
      'Pts Mes': t.ptsTotal || 0,
      'Bono Baremo': t.baremoBonus || 0,
      'RR Fallos': t.rrFails || 0,
      'RR Total': t.rrOrdersCount || 0,
      'RR %': t.rrValue || 0,
      'Bono RR': t.rrBonus || 0,
      'AI %': t.aiValue || 0,
      'Bono AI': t.aiBonus || 0,
      'Monto Total Bono': (t.baremoBonus || 0) + (t.rrBonus || 0) + (t.aiBonus || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Bonos Mensuales`);
    
    // Write out natively as Excel (.xlsx) file
    XLSX.writeFile(workbook, `Cierre_Bonos_M${month}_${year}.xlsx`);
  };

  const handleExportDB = () => {
    // Determine raw URL for the bot endpoint since api.get intercepts raw streams
    const baseURL = api.defaults.baseURL || 'http://localhost:5003/api';
    const daysInMonth = new Date(year, month, 0).getDate();
    const desde = `${year}-${String(month).padStart(2, '0')}-01`;
    const hasta = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    window.location.href = `${baseURL}/bot/export-toa?desde=${desde}&hasta=${hasta}&estado=Completado`;
  };

  const filteredTechs = useMemo(() => {
    return techs.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [techs, searchTerm]);

  const totals = useMemo(() => {
    return filteredTechs.reduce((acc, t) => ({
      pts: acc.pts + (t.ptsTotal || 0),
      baremo: acc.baremo + (t.baremoBonus || 0),
      rr: acc.rr + (t.rrBonus || 0),
      ai: acc.ai + (t.aiBonus || 0),
      total: acc.total + (t.baremoBonus + t.rrBonus + t.aiBonus)
    }), { pts: 0, baremo: 0, rr: 0, ai: 0, total: 0 });
  }, [filteredTechs]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Calculando Bonos...</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      {/* ── HEADER ── */}
      <div className="max-w-[1600px] mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-xl shadow-lg ${existingClosure ? 'bg-slate-800 shadow-slate-200' : 'bg-emerald-500 shadow-emerald-100'}`}>
                {existingClosure ? <Lock className="w-5 h-5 text-white" /> : <CalendarCheck className="w-5 h-5 text-white" />}
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Cierre de Bonos</h1>
              {existingClosure && (
                  <span className="px-4 py-1 bg-slate-100 text-slate-500 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest ml-2">Cerrado</span>
              )}
            </div>
            <p className="text-slate-500 font-medium text-sm">
                Compensación variable basada en modelo {model?.nombre || 'General'}.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="bg-transparent px-4 py-2 text-sm font-black text-slate-700 outline-none cursor-pointer">
                   {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                      <option key={i+1} value={i+1}>{m}</option>
                   ))}
                </select>
                <div className="w-px h-6 bg-slate-100" />
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="bg-transparent px-4 py-2 text-sm font-black text-slate-700 outline-none cursor-pointer">
                   {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                   ))}
                </select>
             </div>
             <button onClick={fetchBonusContext} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm">
                <RefreshCw size={20} />
             </button>
             {!existingClosure ? (
                <button 
                  onClick={handleConsolidate}
                  disabled={isConsolidating}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 disabled:opacity-50"
                >
                   {isConsolidating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                   Confirmar Cierre
                </button>
             ) : (
                <button 
                  onClick={handleReopen}
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-white hover:text-red-500 transition-all border border-slate-200 active:scale-95 shadow-sm"
                >
                   <Unlock size={16} />
                   Re-abrir Mes
                </button>
             )}
             <div className="flex gap-2">
                 <button onClick={handleExportDB} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 active:scale-95">
                    <Download size={16} /> BD TOA
                 </button>
                 <button onClick={handleExportTable} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95">
                    <Download size={16} /> Exportar Tabla
                 </button>
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard icon={Target} label="Puntos Totales" value={totals.pts.toLocaleString('es-CL')} sub="Producción Real" color="indigo" />
          <StatCard icon={Zap} label="Incentivo Baremo" value={CLP(totals.baremo)} sub="Por cumplimiento Baremo" color="emerald" />
          <StatCard icon={ShieldCheck} label="Bonific. Calidad" value={CLP(totals.rr + totals.ai)} sub="Meta RR + AI" color="blue" />
          <StatCard icon={Award} label="Total Pagar" value={CLP(totals.total)} sub={`${techs.length} Operarios`} color="purple" />
      </div>

      {existingClosure && techs.length === 0 && (
        <div className="max-w-[1600px] mx-auto mb-6 flex items-start gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-800">Cierre sin datos</p>
            <p className="text-xs text-amber-600 mt-0.5">Este mes fue cerrado sin datos de cálculo (probablemente por un error previo). Haz clic en <strong>Re-abrir Mes</strong> para eliminar el cierre vacío y recalcular desde producción.</p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-sm">
          <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Filtrar por técnico..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-semibold focus:outline-none"
                  />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                  <Info className="w-3.5 h-3.5" />
                  Editando Valores de Calidad Manualmente
              </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="bg-slate-50/50">
                          <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-24">ID Recurso</th>
                          <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-32">RUT</th>
                          <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Operario</th>
                          <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Pts Mes</th>
                          <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Bono Baremo</th>
                          <th className="px-8 py-5 text-[9px] font-black text-emerald-600 uppercase tracking-widest border-b border-slate-100 text-center">DAT <span className="opacity-50 mx-1">|</span> RR% <span className="opacity-50 mx-1">|</span> BONO</th>
                          <th className="px-8 py-5 text-[9px] font-black text-blue-600 uppercase tracking-widest border-b border-slate-100 text-center">AI (Auditoría)</th>
                          <th className="px-8 py-5 text-[9px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 text-right">Monto Bono</th>
                          <th className="px-4 py-5 border-b border-slate-100"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredTechs.map((t, idx) => (
                          <tr key={`${t.idRecursoToa || 'tech'}-${idx}`} className="group hover:bg-slate-50 transition-colors">
                              <td className="px-8 py-6 font-bold text-[11px] text-slate-400 uppercase tracking-widest">
                                  {t.idRecurso || t.idRecursoToa || 'N/A'}
                              </td>
                              <td className="px-8 py-6 font-bold text-[11px] text-slate-500 uppercase tracking-widest">
                                  {t.rut || 'N/A'}
                              </td>
                              <td className="px-8 py-6">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500 uppercase shadow-inner border border-slate-200">
                                          {t.name.trim().substring(0, 2)}
                                      </div>
                                      <span className="text-sm font-black text-slate-800 tracking-tight">{t.name}</span>
                                  </div>
                              </td>
                              <td className="px-8 py-6 text-center">
                                  <div className="flex flex-col items-center">
                                      <span className="font-black text-slate-700 tabular-nums text-sm">{t.ptsTotal?.toLocaleString('es-CL')}</span>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 whitespace-nowrap">
                                          [{t.tramoLogrado}]
                                      </span>
                                  </div>
                              </td>
                              <td className="px-8 py-6 text-right">
                                  <div className="flex flex-col items-end">
                                      <span className="text-sm font-black text-indigo-600">{CLP(t.baremoBonus)}</span>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                          Pto: {CLP(t.multiplier)}
                                      </span>
                                  </div>
                              </td>
                              <td className="px-8 py-6">
                                  <div className="flex flex-col items-center gap-1.5">
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.rrFails || 0} / {t.rrOrdersCount || 0}</span>
                                      <div className="flex items-center gap-1 bg-white border border-emerald-200 shadow-sm rounded-lg px-2 py-0.5 transition-all focus-within:border-emerald-400">
                                          <input 
                                            type="number" step="0.1" value={t.rrValue} 
                                            onChange={(e) => updateTechQuality(techs.indexOf(t), 'rrValue', e.target.value)}
                                            disabled={!!existingClosure}
                                            className="w-12 bg-transparent text-center font-black text-[12px] text-emerald-600 outline-none disabled:text-slate-400" 
                                          />
                                          <span className="text-[10px] font-black text-emerald-400">%</span>
                                      </div>
                                      {t.rrBonus > 0 ? (
                                           <span className="text-[10px] font-black text-emerald-600 mt-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{CLP(t.rrBonus)}</span>
                                      ) : (
                                           <span className="text-[8px] font-black text-slate-300 tracking-widest uppercase">SIN BONO</span>
                                      )}
                                  </div>
                              </td>
                              <td className="px-8 py-6">
                                  <div className="flex flex-col items-center gap-1">
                                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                                          <input 
                                            type="number" step="0.1" value={t.aiValue} 
                                            onChange={(e) => updateTechQuality(techs.indexOf(t), 'aiValue', e.target.value)}
                                            disabled={!!existingClosure}
                                            className="w-10 bg-transparent text-center font-black text-[11px] text-blue-600 outline-none disabled:text-slate-400" 
                                          />
                                      </div>
                                      {t.aiBonus > 0 && <span className="text-[10px] font-black text-blue-500">{CLP(t.aiBonus)}</span>}
                                  </div>
                              </td>
                              <td className="px-8 py-6 text-right font-black text-slate-900 tabular-nums">
                                  {CLP(t.baremoBonus + t.rrBonus + t.aiBonus)}
                              </td>
                              <td className="px-4 py-6 text-right">
                                  <ChevronRight size={18} className="text-slate-200" />
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => {
  const themes = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className={`p-3 rounded-2xl border ${themes[color]}`}>
          <Icon size={20} />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
        </div>
      </div>
      <div className="pt-3 border-t border-slate-50">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
      </div>
    </div>
  );
};

export default CierreBonos;
