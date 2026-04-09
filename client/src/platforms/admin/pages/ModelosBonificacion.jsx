import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Plus, TrendingUp, Award, Zap, Trash2, Save,
  ChevronRight, Settings, Loader2, Clock, Scale,
  DollarSign, BarChart3, Users, X, Check, Search,
  Info, Gift, Percent, RefreshCw, AlertCircle,
  CheckCircle2, Target, SlidersHorizontal, CalendarCheck, Truck
} from 'lucide-react';
import { telecomApi as api } from '../../agentetelecom/telecomApi';
import { bonosConfigApi } from '../../rrhh/rrhhApi';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (v) => `$${Math.round(v || 0).toLocaleString('es-CL')}`;

// ─── Tipos de Modelo ─────────────────────────────────────────────────────────
const TIPOS_MODELO = {
  BAREMO_PUNTOS: {
    label: 'Baremo Producción',
    shortLabel: 'Baremo',
    desc: 'Bonificación por puntos de producción + métricas de calidad (RR/AI). Ideal para Telco/TOA.',
    icon: BarChart3,
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-300',
  },
  BONO_FIJO: {
    label: 'Bono Fijo',
    shortLabel: 'Fijo',
    desc: 'Monto fijo periódico por cargo o condición. Mensual, trimestral o anual.',
    icon: DollarSign,
    bgClass: 'bg-emerald-100',
    textClass: 'text-emerald-700',
    borderClass: 'border-emerald-300',
  },
  COMISION: {
    label: 'Comisión / Ventas',
    shortLabel: 'Comisión',
    desc: 'Comisión porcentual o escalonada sobre monto de venta, unidades o recaudación.',
    icon: TrendingUp,
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-700',
    borderClass: 'border-amber-300',
  },
  META_KPI: {
    label: 'Meta / KPI',
    shortLabel: 'KPI',
    desc: 'Bono por nivel de logro de metas (%). Tramos de cumplimiento → monto de bono.',
    icon: Target,
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    borderClass: 'border-violet-300',
  },
  ESCALA_ANTIGUEDAD: {
    label: 'Escala Antigüedad',
    shortLabel: 'Antigüedad',
    desc: 'Bono proporcional a los años de servicio. Monto fijo o % del sueldo.',
    icon: Clock,
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-700',
    borderClass: 'border-teal-300',
  },
  GRATIFICACION_VOLUNTARIA: {
    label: 'Gratificación Voluntaria',
    shortLabel: 'Gratif.',
    desc: 'Gratificación voluntaria adicional a la legal. % del sueldo o monto fijo.',
    icon: Gift,
    bgClass: 'bg-rose-100',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-300',
  },
  HABER_ASISTENCIA: {
    label: 'Bono Asistencia / Puntualidad',
    shortLabel: 'Asistencia',
    desc: 'Incentivo por cumplimiento de jornada, días trabajados o puntualidad perfecta.',
    icon: CalendarCheck,
    bgClass: 'bg-sky-100',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-300',
  },
  SUBSIDIO_MOVILIZACION: {
    label: 'Movilización / Colación',
    shortLabel: 'Asignación',
    desc: 'Subsidios no imponibles fijos o por día asistido. Ideal para gastos operacionales.',
    icon: Truck,
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
  },
  FORMULA_PERSONALIZADA: {
    label: 'Fórmula Personalizada',
    shortLabel: 'Fórmula',
    desc: 'Motor avanzado: Crea tu propia lógica de cálculo usando variables y operadores.',
    icon: SlidersHorizontal,
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-300',
  },
};

const INDUSTRIAS = ['TODOS', 'TELCO', 'CONSTRUCCION', 'RETAIL', 'SERVICIOS', 'MANUFACTURA', 'SALUD'];
const FRECUENCIAS = ['MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'UNICO'];
const COLORES = ['indigo', 'emerald', 'amber', 'violet', 'teal', 'rose', 'slate', 'sky'];
const COLOR_PILL = {
  indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  violet: 'bg-violet-500', teal: 'bg-teal-500', rose: 'bg-rose-500',
  slate: 'bg-slate-500', sky: 'bg-sky-500',
};

const blankModel = (tipo = 'BAREMO_PUNTOS') => ({
  nombre: '', description: '', tipo,
  industria: tipo === 'BAREMO_PUNTOS' ? 'TELCO' : 'TODOS',
  color: TIPOS_MODELO[tipo]?.bgClass?.replace('bg-', '').replace('-100', '') || 'indigo',
  activo: true,
  aplicaA: { todos: true, cargos: [], sectores: [] },
  tramosBaremos: [{ desde: 0, hasta: 95, valor: 0 }, { desde: 96, hasta: 'Más', valor: 50000 }],
  puntosExcluidos: 0, tramosRR: [], tramosAI: [],
  bonoFijo: { monto: 0, frecuencia: 'MENSUAL', condiciones: '', proporcionalDias: false },
  comision: { base: 'MONTO_VENTA', tipo: 'PORCENTAJE', porcentajePlano: 5, tramos: [{ desde: 0, hasta: 'Sin tope', valor: 3 }] },
  metaKpi: { metaBase: 100, unidad: 'PORCENTAJE', tramos: [{ desde: 80, hasta: 89, monto: 50000 }, { desde: 90, hasta: 99, monto: 80000 }, { desde: 100, hasta: 'Sin tope', monto: 120000 }] },
  escalaAntiguedad: { tipoValor: 'MONTO_FIJO', tramos: [{ aniosDesde: 1, aniosHasta: 3, valor: 30000 }, { aniosDesde: 4, aniosHasta: 'Sin tope', valor: 60000 }] },
  gratificacion: { tipoValor: 'MONTO_FIJO', valor: 0, base: 'SUELDO_BASE', frecuencia: 'MENSUAL' },
  tipoBonoRef: null,
});

// ─── TipoBadge ────────────────────────────────────────────────────────────────
const TipoBadge = ({ tipo, size = 'sm' }) => {
  const t = TIPOS_MODELO[tipo];
  if (!t) return null;
  const Icon = t.icon;
  const sm = size === 'sm';
  return (
    <span className={`inline-flex items-center gap-1 ${t.bgClass} ${t.textClass} font-black uppercase tracking-wider rounded-full ${sm ? 'text-[7px] px-2 py-0.5' : 'text-[9px] px-3 py-1'}`}>
      <Icon size={sm ? 8 : 10} />{t.shortLabel}
    </span>
  );
};

// ─── TagInput ─────────────────────────────────────────────────────────────────
const TagInput = ({ tags = [], onAdd, onRemove, placeholder }) => {
  const [val, setVal] = useState('');
  const add = () => { const v = val.trim(); if (v && !tags.includes(v)) { onAdd(v); setVal(''); } };
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl min-h-[44px]">
      {tags.map(t => (
        <span key={t} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-[9px] font-black px-2.5 py-1 rounded-full">
          {t}<button onClick={() => onRemove(t)} className="text-slate-400 hover:text-rose-500 ml-0.5"><X size={8} /></button>
        </span>
      ))}
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] bg-transparent text-[10px] font-bold text-slate-700 focus:outline-none placeholder:text-slate-300" />
      {val && <button onClick={add} className="text-emerald-600 hover:text-emerald-700"><Plus size={12} /></button>}
    </div>
  );
};

// ─── ConfigBaremo ─────────────────────────────────────────────────────────────
const ConfigBaremo = ({ model, onChange }) => {
  const upB = (i, f, v) => { const t = [...model.tramosBaremos]; t[i] = { ...t[i], [f]: v }; onChange({ tramosBaremos: t }); };
  const upRR = (i, f, v) => { const t = [...(model.tramosRR || [])]; t[i] = { ...t[i], [f]: v }; onChange({ tramosRR: t }); };
  const upAI = (i, f, v) => { const t = [...(model.tramosAI || [])]; t[i] = { ...t[i], [f]: v }; onChange({ tramosAI: t }); };

  return (
    <div className="space-y-8">
      {/* Puntos excluidos */}
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
        <Info size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex-1">Puntos No Calculables (se restan antes de aplicar tramo)</span>
        <input type="number" value={model.puntosExcluidos || 0}
          onChange={e => onChange({ puntosExcluidos: parseInt(e.target.value) || 0 })}
          className="w-20 text-center bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-sm font-black text-amber-900 focus:outline-none" />
        <span className="text-[9px] text-amber-600 font-bold">pts</span>
      </div>

      {/* Tramos Baremo */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center"><Zap size={15} className="text-indigo-600" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Tramos Baremo Producción</p>
              <p className="text-[8px] text-slate-400 font-bold uppercase">CLP por rango de puntos producidos</p>
            </div>
          </div>
          <button onClick={() => onChange({ tramosBaremos: [...model.tramosBaremos, { desde: 0, hasta: 0, valor: 0 }] })}
            className="p-2 bg-white border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors"><Plus size={14} /></button>
        </div>
        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Desde (Pts)</th>
                <th className="px-5 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Hasta (Pts)</th>
                <th className="px-5 py-3 text-[8px] font-black text-indigo-500 uppercase tracking-widest text-right">Valor CLP</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {model.tramosBaremos.map((t, i) => (
                <tr key={i} className="group hover:bg-slate-50/60">
                  <td className="px-5 py-3"><input type="number" value={t.desde} onChange={e => upB(i, 'desde', parseInt(e.target.value))} className="w-20 bg-transparent font-black text-slate-800 focus:outline-none text-sm tabular-nums" /></td>
                  <td className="px-5 py-3 text-center"><input type="text" value={t.hasta} onChange={e => upB(i, 'hasta', e.target.value)} className="w-20 bg-transparent font-black text-slate-800 text-center focus:outline-none text-sm tabular-nums" /></td>
                  <td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-1 text-emerald-600 font-black text-sm"><span>$</span><input type="number" value={t.valor} onChange={e => upB(i, 'valor', parseInt(e.target.value))} className="bg-transparent text-right focus:outline-none w-28 tabular-nums" /></div></td>
                  <td className="px-3"><button onClick={() => onChange({ tramosBaremos: model.tramosBaremos.filter((_, j) => j !== i) })} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RR + AI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { key: 'RR', label: 'Calidad RR', sub: 'Tasa de reincidencia', color: 'emerald', data: model.tramosRR || [], up: upRR, add: () => onChange({ tramosRR: [...(model.tramosRR || []), { operator: 'Entre', desde: 0, hasta: 0, valor: 0 }] }), remove: (i) => onChange({ tramosRR: (model.tramosRR || []).filter((_, j) => j !== i) }) },
          { key: 'AI', label: 'Calidad AI', sub: 'Índice de auditoría', color: 'blue', data: model.tramosAI || [], up: upAI, add: () => onChange({ tramosAI: [...(model.tramosAI || []), { operator: 'Entre', desde: 0, hasta: 0, valor: 0 }] }), remove: (i) => onChange({ tramosAI: (model.tramosAI || []).filter((_, j) => j !== i) }) },
        ].map(({ key, label, sub, color, data, up, add, remove }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 bg-${color}-50 rounded-xl flex items-center justify-center`}>
                  {key === 'RR' ? <TrendingUp size={14} className={`text-${color}-600`} /> : <Settings size={14} className={`text-${color}-600`} />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{label}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">{sub}</p>
                </div>
              </div>
              <button onClick={add} className={`p-1.5 bg-white border border-${color}-100 rounded-xl text-${color}-600 hover:bg-${color}-50`}><Plus size={12} /></button>
            </div>
            <div className={`border border-${color}-100 rounded-2xl overflow-hidden`}>
              <table className="w-full text-left">
                <thead className={`bg-${color}-50/40 border-b border-${color}-100`}>
                  <tr>
                    <th className="px-4 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Operador / Rango</th>
                    <th className={`px-4 py-2.5 text-[8px] font-black text-${color}-600 uppercase tracking-widest text-right`}>CLP</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-${color}-50`}>
                  {data.map((t, i) => (
                    <tr key={i} className={`group hover:bg-${color}-50/20`}>
                      <td className="px-4 py-2.5">
                        <div className={`flex items-center gap-1.5 bg-white border border-${color}-100 rounded-lg px-2 py-1 text-[10px] font-black text-slate-700`}>
                          <select value={t.operator || 'Entre'} onChange={e => up(i, 'operator', e.target.value)} className={`text-${color}-600 bg-transparent font-black focus:outline-none text-[10px]`}>
                            <option value="Entre">Entre</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                          </select>
                          {(t.operator === 'Entre' || !t.operator) ? (
                            <><input type="number" step="0.01" value={t.desde || 0} onChange={e => up(i, 'desde', parseFloat(e.target.value))} className="w-10 bg-transparent focus:outline-none tabular-nums" />
                            <span className="text-slate-300">/</span>
                            <input type="number" step="0.01" value={t.hasta || 0} onChange={e => up(i, 'hasta', parseFloat(e.target.value))} className="w-10 bg-transparent focus:outline-none tabular-nums" /></>
                          ) : (
                            <input type="number" step="0.01" value={t.limit || 0} onChange={e => up(i, 'limit', parseFloat(e.target.value))} className="w-14 bg-transparent focus:outline-none tabular-nums" />
                          )}
                          <span className="text-slate-400">%</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right font-black text-${color}-700 tabular-nums text-sm`}>
                        <input type="number" value={t.valor || 0} onChange={e => up(i, 'valor', parseInt(e.target.value))} className="w-20 bg-transparent text-right focus:outline-none" />
                      </td>
                      <td className="px-2 py-2.5"><button onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 size={10} /></button></td>
                    </tr>
                  ))}
                  {!data.length && <tr><td colSpan="3" className="px-4 py-5 text-center text-[9px] text-slate-400 italic">Sin tramos — clic en + para agregar</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ConfigBonoFijo ───────────────────────────────────────────────────────────
const ConfigBonoFijo = ({ model, onChange }) => {
  const bf = model.bonoFijo || {};
  const set = (f, v) => onChange({ bonoFijo: { ...bf, [f]: v } });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Monto del Bono (CLP)</label>
          <div className="flex items-center gap-2 bg-white border-2 border-emerald-100 focus-within:border-emerald-400 rounded-2xl px-4 py-3 transition-colors">
            <span className="text-emerald-600 font-black text-sm">$</span>
            <input type="number" value={bf.monto || 0} onChange={e => set('monto', parseInt(e.target.value) || 0)}
              className="flex-1 bg-transparent font-black text-slate-800 text-lg focus:outline-none tabular-nums" />
          </div>
          <p className="text-[8px] text-emerald-700 font-bold mt-1.5 pl-1">{fmt(bf.monto || 0)} por período</p>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Frecuencia de Pago</label>
          <select value={bf.frecuencia || 'MENSUAL'} onChange={e => set('frecuencia', e.target.value)}
            className="w-full bg-white border-2 border-slate-100 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
            {FRECUENCIAS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Condiciones / Observaciones</label>
        <textarea value={bf.condiciones || ''} onChange={e => set('condiciones', e.target.value)} rows={3}
          placeholder="Ej: Aplica a trabajadores con contrato indefinido y más de 3 meses de antigüedad..."
          className="w-full bg-white border-2 border-slate-100 focus:border-emerald-400 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none resize-none transition-colors" />
      </div>
      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex-1">
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Proporcional a días trabajados</p>
          <p className="text-[9px] text-slate-400 font-medium mt-0.5">Si el trabajador no completa el mes, el bono se paga proporcional</p>
        </div>
        <button onClick={() => set('proporcionalDias', !bf.proporcionalDias)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${bf.proporcionalDias ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {bf.proporcionalDias ? <><Check size={10} /> Sí</> : 'No'}
        </button>
      </div>
    </div>
  );
};

// ─── ConfigComision ───────────────────────────────────────────────────────────
const ConfigComision = ({ model, onChange }) => {
  const com = model.comision || {};
  const set = (f, v) => onChange({ comision: { ...com, [f]: v } });
  const upT = (i, f, v) => { const t = [...(com.tramos || [])]; t[i] = { ...t[i], [f]: v }; set('tramos', t); };
  const BASES = { MONTO_VENTA: 'Monto de Venta (CLP)', UNIDADES: 'Unidades Producidas', PRODUCCION: 'Producción / Obras', RECAUDACION: 'Monto Recaudado' };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Base de Comisión</label>
          <select value={com.base || 'MONTO_VENTA'} onChange={e => set('base', e.target.value)}
            className="w-full bg-white border-2 border-slate-100 focus:border-amber-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
            {Object.entries(BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Cálculo</label>
          <select value={com.tipo || 'PORCENTAJE'} onChange={e => set('tipo', e.target.value)}
            className="w-full bg-white border-2 border-slate-100 focus:border-amber-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
            <option value="PORCENTAJE">Porcentaje plano (%)</option>
            <option value="ESCALA">Escala por tramos</option>
          </select>
        </div>
      </div>
      {com.tipo === 'PORCENTAJE' ? (
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Porcentaje de Comisión</label>
          <div className="flex items-center gap-3 bg-white border-2 border-amber-100 focus-within:border-amber-400 rounded-2xl px-4 py-3 w-48">
            <input type="number" step="0.1" value={com.porcentajePlano || 0} onChange={e => set('porcentajePlano', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent font-black text-amber-700 text-xl focus:outline-none tabular-nums" />
            <Percent size={16} className="text-amber-500" />
          </div>
          <p className="text-[8px] text-amber-600 font-bold mt-1.5 pl-1">{com.porcentajePlano || 0}% sobre {BASES[com.base || 'MONTO_VENTA']}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Tramos de Comisión</p>
              <p className="text-[9px] text-slate-400 font-bold">% de comisión por rango de base</p>
            </div>
            <button onClick={() => set('tramos', [...(com.tramos || []), { desde: 0, hasta: 'Sin tope', valor: 0 }])}
              className="p-2 bg-white border border-amber-100 rounded-xl text-amber-600 hover:bg-amber-50"><Plus size={14} /></button>
          </div>
          <div className="border border-amber-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-amber-50/50 border-b border-amber-100">
                <tr>
                  <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Desde</th>
                  <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Hasta</th>
                  <th className="px-5 py-2.5 text-[8px] font-black text-amber-600 uppercase tracking-widest text-right">% Comisión</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {(com.tramos || []).map((t, i) => (
                  <tr key={i} className="group hover:bg-amber-50/20">
                    <td className="px-5 py-3"><input type="number" value={t.desde} onChange={e => upT(i, 'desde', parseInt(e.target.value))} className="w-24 bg-transparent font-black text-slate-800 focus:outline-none text-sm tabular-nums" /></td>
                    <td className="px-5 py-3"><input type="text" value={t.hasta} onChange={e => upT(i, 'hasta', e.target.value)} className="w-24 bg-transparent font-black text-slate-800 focus:outline-none text-sm tabular-nums" /></td>
                    <td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-1 text-amber-600 font-black text-sm"><input type="number" step="0.1" value={t.valor} onChange={e => upT(i, 'valor', parseFloat(e.target.value))} className="bg-transparent text-right focus:outline-none w-16 tabular-nums" /><span>%</span></div></td>
                    <td className="px-3"><button onClick={() => set('tramos', (com.tramos || []).filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ConfigMetaKpi ────────────────────────────────────────────────────────────
const ConfigMetaKpi = ({ model, onChange }) => {
  const mk = model.metaKpi || {};
  const set = (f, v) => onChange({ metaKpi: { ...mk, [f]: v } });
  const upT = (i, f, v) => { const t = [...(mk.tramos || [])]; t[i] = { ...t[i], [f]: v }; set('tramos', t); };
  const UNIDADES = { PORCENTAJE: 'Porcentaje (%)', PUNTOS: 'Puntos', UNIDADES: 'Unidades', CLP: 'Monto CLP' };
  const unidSuffix = { PORCENTAJE: '%', PUNTOS: 'pts', UNIDADES: 'uds', CLP: '$' };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Meta Base (= 100% logro)</label>
          <div className="flex items-center gap-2 bg-white border-2 border-violet-100 focus-within:border-violet-400 rounded-2xl px-4 py-3">
            <input type="number" value={mk.metaBase || 100} onChange={e => set('metaBase', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent font-black text-violet-700 text-lg focus:outline-none tabular-nums" />
            <span className="text-violet-400 font-black text-sm">{unidSuffix[mk.unidad || 'PORCENTAJE']}</span>
          </div>
          <p className="text-[8px] text-violet-600 font-bold mt-1.5 pl-1">Valor que representa el 100% de cumplimiento</p>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Unidad de Medición</label>
          <select value={mk.unidad || 'PORCENTAJE'} onChange={e => set('unidad', e.target.value)}
            className="w-full bg-white border-2 border-slate-100 focus:border-violet-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
            {Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Tramos de Logro → Bono CLP</p>
            <p className="text-[9px] text-slate-400 font-bold">Ej: 80%-89% → $50.000 / 90%-99% → $80.000 / 100%+ → $120.000</p>
          </div>
          <button onClick={() => set('tramos', [...(mk.tramos || []), { desde: 100, hasta: 'Sin tope', monto: 0 }])}
            className="p-2 bg-white border border-violet-100 rounded-xl text-violet-600 hover:bg-violet-50"><Plus size={14} /></button>
        </div>
        <div className="border border-violet-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-violet-50/50 border-b border-violet-100">
              <tr>
                <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Logro Desde (%)</th>
                <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Logro Hasta (%)</th>
                <th className="px-5 py-2.5 text-[8px] font-black text-violet-600 uppercase tracking-widest text-right">Bono (CLP)</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-violet-50">
              {(mk.tramos || []).map((t, i) => (
                <tr key={i} className="group hover:bg-violet-50/20">
                  <td className="px-5 py-3"><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><input type="number" value={t.desde} onChange={e => upT(i, 'desde', parseFloat(e.target.value))} className="w-16 bg-transparent focus:outline-none tabular-nums" /><span className="text-slate-400 text-xs">%</span></div></td>
                  <td className="px-5 py-3"><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><input type="text" value={t.hasta} onChange={e => upT(i, 'hasta', e.target.value)} className="w-20 bg-transparent focus:outline-none tabular-nums" /><span className="text-slate-400 text-xs">%</span></div></td>
                  <td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-1 text-violet-700 font-black text-sm"><span>$</span><input type="number" value={t.monto} onChange={e => upT(i, 'monto', parseInt(e.target.value))} className="bg-transparent text-right focus:outline-none w-28 tabular-nums" /></div></td>
                  <td className="px-3"><button onClick={() => set('tramos', (mk.tramos || []).filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── ConfigEscalaAntiguedad ───────────────────────────────────────────────────
const ConfigEscalaAntiguedad = ({ model, onChange }) => {
  const ea = model.escalaAntiguedad || {};
  const set = (f, v) => onChange({ escalaAntiguedad: { ...ea, [f]: v } });
  const upT = (i, f, v) => { const t = [...(ea.tramos || [])]; t[i] = { ...t[i], [f]: v }; set('tramos', t); };
  const esPct = ea.tipoValor === 'PORCENTAJE_SUELDO';
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Valor</label>
        <div className="flex gap-3">
          {[['MONTO_FIJO', 'Monto Fijo (CLP)'], ['PORCENTAJE_SUELDO', '% del Sueldo Base']].map(([k, v]) => (
            <button key={k} onClick={() => set('tipoValor', k)}
              className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${ea.tipoValor === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500 border-slate-100 hover:border-teal-200'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Tramos por Años de Servicio</p>
            <p className="text-[9px] text-slate-400 font-bold">Valor en {esPct ? '% del sueldo base' : 'CLP'} por antigüedad</p>
          </div>
          <button onClick={() => set('tramos', [...(ea.tramos || []), { aniosDesde: 1, aniosHasta: 'Sin tope', valor: 0 }])}
            className="p-2 bg-white border border-teal-100 rounded-xl text-teal-600 hover:bg-teal-50"><Plus size={14} /></button>
        </div>
        <div className="border border-teal-100 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-teal-50/50 border-b border-teal-100">
              <tr>
                <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Años Desde</th>
                <th className="px-5 py-2.5 text-[8px] font-black text-slate-400 uppercase tracking-widest">Años Hasta</th>
                <th className="px-5 py-2.5 text-[8px] font-black text-teal-600 uppercase tracking-widest text-right">{esPct ? '% Sueldo' : 'CLP'}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50">
              {(ea.tramos || []).map((t, i) => (
                <tr key={i} className="group hover:bg-teal-50/20">
                  <td className="px-5 py-3"><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><input type="number" value={t.aniosDesde} onChange={e => upT(i, 'aniosDesde', parseInt(e.target.value))} className="w-14 bg-transparent focus:outline-none tabular-nums" /><span className="text-slate-400 text-xs">años</span></div></td>
                  <td className="px-5 py-3"><div className="flex items-center gap-1 font-black text-slate-800 text-sm"><input type="text" value={t.aniosHasta} onChange={e => upT(i, 'aniosHasta', e.target.value)} className="w-20 bg-transparent focus:outline-none tabular-nums" /><span className="text-slate-400 text-xs">años</span></div></td>
                  <td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-1 text-teal-700 font-black text-sm">{!esPct && <span>$</span>}<input type="number" step={esPct ? '0.1' : '1'} value={t.valor} onChange={e => upT(i, 'valor', parseFloat(e.target.value))} className="bg-transparent text-right focus:outline-none w-24 tabular-nums" />{esPct && <span>%</span>}</div></td>
                  <td className="px-3"><button onClick={() => set('tramos', (ea.tramos || []).filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── ConfigGratificacion ──────────────────────────────────────────────────────
const ConfigGratificacion = ({ model, onChange }) => {
  const gr = model.gratificacion || {};
  const set = (f, v) => onChange({ gratificacion: { ...gr, [f]: v } });
  const esPct = gr.tipoValor === 'PORCENTAJE_SUELDO';
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Tipo de Pago</label>
        <div className="flex gap-3">
          {[['MONTO_FIJO', 'Monto Fijo (CLP)'], ['PORCENTAJE_SUELDO', '% del Sueldo']].map(([k, v]) => (
            <button key={k} onClick={() => set('tipoValor', k)}
              className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${gr.tipoValor === k ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-100 hover:border-rose-200'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{esPct ? 'Porcentaje (%)' : 'Monto (CLP)'}</label>
          <div className="flex items-center gap-2 bg-white border-2 border-rose-100 focus-within:border-rose-400 rounded-2xl px-4 py-3">
            {!esPct && <span className="text-rose-600 font-black text-sm">$</span>}
            <input type="number" step={esPct ? '0.1' : '1'} value={gr.valor || 0} onChange={e => set('valor', parseFloat(e.target.value) || 0)}
              className="flex-1 bg-transparent font-black text-rose-700 text-lg focus:outline-none tabular-nums" />
            {esPct && <Percent size={16} className="text-rose-400" />}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Base de Cálculo</label>
          <select value={gr.base || 'SUELDO_BASE'} onChange={e => set('base', e.target.value)}
            className="w-full bg-white border-2 border-slate-100 focus:border-rose-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
            <option value="SUELDO_BASE">Sueldo Base</option>
            <option value="SUELDO_IMPONIBLE">Sueldo Imponible</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Frecuencia</label>
        <select value={gr.frecuencia || 'MENSUAL'} onChange={e => set('frecuencia', e.target.value)}
          className="w-full bg-white border-2 border-slate-100 focus:border-rose-400 rounded-2xl px-4 py-3 text-sm font-black text-slate-700 focus:outline-none cursor-pointer">
          {FRECUENCIAS.filter(f => f !== 'BIMESTRAL' && f !== 'UNICO').map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
    </div>
  );
};

// ─── ConfigFormula ────────────────────────────────────────────────────────────
const ConfigFormula = ({ model, onChange }) => {
  const f = model.formula || { expression: '' };
  return (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
        <div className="flex gap-4">
          <div className="p-3 bg-white rounded-xl shadow-sm"><SlidersHorizontal className="text-orange-600" size={20} /></div>
          <div>
            <p className="text-[11px] font-black text-orange-800 uppercase tracking-widest mb-1">Editor de Fórmulas Avanzado</p>
            <p className="text-[10px] font-medium text-orange-700 leading-relaxed">
              Crea lógicas complejas combinando variables. <br/>
              Variables disponibles: <code>produccion</code>, <code>asistencia</code>, <code>antiguedad</code>, <code>sueldo_base</code>.
            </p>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Expresión Matemática (JavaScript)</label>
        <input 
          value={f.expression} 
          onChange={e => onChange({ formula: { ...f, expression: e.target.value } })}
          placeholder="Ej: (produccion * 0.1) + (asistencia === 100 ? 50000 : 0)"
          className="w-full bg-slate-900 text-emerald-400 font-mono text-sm p-5 rounded-2xl border-2 border-slate-800 focus:border-orange-400 focus:outline-none shadow-inner"
        />
        <div className="flex flex-wrap gap-2 mt-4">
          {['+', '-', '*', '/', '?', ':', '>', '<', '=='].map(op => (
            <button key={op} onClick={() => onChange({ formula: { ...f, expression: (f.expression || '') + ' ' + op + ' ' } })}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all">
              {op}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const ModelosBonificacion = () => {
  const [models, setModels] = useState([]);
  const [tiposBono, setTiposBono] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('TODOS');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTipo, setNewTipo] = useState('BAREMO_PUNTOS');
  const [newNombre, setNewNombre] = useState('');

  const flash = (type, msg) => { setAlertMsg({ type, msg }); setTimeout(() => setAlertMsg(null), 3500); };

  const fetchModels = async () => {
    setLoading(true);
    try {
      const [{ data: mr }, { data: cr }] = await Promise.all([api.get('/admin/bonos'), bonosConfigApi.getAll()]);
      setTiposBono(cr || []);
      setModels(mr || []);
      if (mr?.length) setSelectedId(mr[0]._id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchModels(); }, []);

  const selected = useMemo(() => models.find(m => (m._id || m.id) === selectedId), [models, selectedId]);

  const filtered = useMemo(() => models.filter(m => {
    const s = !search || m.nombre?.toLowerCase().includes(search.toLowerCase());
    const t = filterTipo === 'TODOS' || (m.tipo || 'BAREMO_PUNTOS') === filterTipo;
    return s && t;
  }), [models, search, filterTipo]);

  const updateField = useCallback((patch) => {
    setModels(prev => prev.map(m => (m._id || m.id) === selectedId ? { ...m, ...patch } : m));
  }, [selectedId]);

  const handleSave = async () => {
    if (!selected?.nombre?.trim()) { flash('error', 'El modelo requiere un nombre'); return; }
    setIsSaving(true);
    try {
      if (!selected._id) {
        const { data } = await api.post('/admin/bonos', selected);
        setModels(prev => prev.map(m => m.id === selectedId ? data : m));
        setSelectedId(data._id);
        flash('success', 'Modelo creado');
      } else {
        const { data } = await api.put(`/admin/bonos/${selected._id}`, selected);
        setModels(prev => prev.map(m => m._id === selected._id ? data : m));
        flash('success', 'Modelo actualizado');
      }
    } catch (e) { flash('error', 'Error: ' + (e.response?.data?.error || e.message)); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!selected._id) { setModels(p => p.filter(m => m.id !== selectedId)); setSelectedId(models.find(m => m.id !== selectedId)?._id || null); return; }
    if (!window.confirm(`¿Eliminar "${selected.nombre}"?`)) return;
    try {
      await api.delete(`/admin/bonos/${selected._id}`);
      const rest = models.filter(m => m._id !== selected._id);
      setModels(rest);
      setSelectedId(rest[0]?._id || null);
      flash('success', 'Modelo eliminado');
    } catch { flash('error', 'Error al eliminar'); }
  };

  const toggleActive = async () => {
    if (!selected?._id) return;
    try {
      await api.put(`/admin/bonos/${selected._id}`, { ...selected, activo: !selected.activo });
      setModels(p => p.map(m => m._id === selected._id ? { ...m, activo: !m.activo } : m));
    } catch { flash('error', 'Error'); }
  };

  const handleCreate = () => {
    if (!newNombre.trim()) return;
    const id = `draft_${Date.now()}`;
    setModels(p => [...p, { ...blankModel(newTipo), id, nombre: newNombre.trim() }]);
    setSelectedId(id);
    setShowNewModal(false);
    setNewNombre('');
    setNewTipo('BAREMO_PUNTOS');
  };

  const renderConfig = () => {
    if (!selected) return null;
    const tipo = selected.tipo || 'BAREMO_PUNTOS';
    const props = { model: selected, onChange: updateField };
    switch (tipo) {
      case 'BAREMO_PUNTOS':           return <ConfigBaremo {...props} />;
      case 'BONO_FIJO':              return <ConfigBonoFijo {...props} />;
      case 'COMISION':               return <ConfigComision {...props} />;
      case 'META_KPI':               return <ConfigMetaKpi {...props} />;
      case 'ESCALA_ANTIGUEDAD':      return <ConfigEscalaAntiguedad {...props} />;
      case 'GRATIFICACION_VOLUNTARIA': return <ConfigGratificacion {...props} />;
      case 'HABER_ASISTENCIA':        return <ConfigBonoFijo {...props} />;
      case 'SUBSIDIO_MOVILIZACION':   return <ConfigBonoFijo {...props} />;
      case 'FORMULA_PERSONALIZADA':   return <ConfigFormula {...props} />;
      default: return null;
    }
  };

  const ti = TIPOS_MODELO[selected?.tipo || 'BAREMO_PUNTOS'] || TIPOS_MODELO.BAREMO_PUNTOS;
  const TipoIcon = ti.icon;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Alert */}
      {alertMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white text-[11px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 duration-300 ${alertMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {alertMsg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {alertMsg.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-8 pb-6 border-b border-slate-100 bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-100">
                <SlidersHorizontal className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Modelos de Bonificación</h1>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
              Baremos · Comisiones · KPI/Metas · Antigüedad · Bonos Fijos · Gratificaciones
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchModels} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 transition-all">
              <RefreshCw size={14} />
            </button>
            <button onClick={() => { setShowNewModal(true); setNewNombre(''); setNewTipo('BAREMO_PUNTOS'); }}
              className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 active:scale-95 transition-all">
              <Plus size={14} /> Nuevo Modelo
            </button>
            <button onClick={handleSave} disabled={isSaving || !selected}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-900 shadow-lg active:scale-95 disabled:opacity-40 transition-all">
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Left: Lista ── */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2">
                <Search size={12} className="text-slate-400 flex-shrink-0" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar modelo..."
                  className="flex-1 bg-transparent text-[10px] font-bold text-slate-700 focus:outline-none placeholder:text-slate-300" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['TODOS', ...Object.keys(TIPOS_MODELO)].map(t => (
                  <button key={t} onClick={() => setFilterTipo(t)}
                    className={`text-[7px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${filterTipo === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>
                    {t === 'TODOS' ? 'Todos' : TIPOS_MODELO[t].shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] p-4 shadow-sm">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 px-1">{filtered.length} modelo{filtered.length !== 1 ? 's' : ''}</p>
              <div className="space-y-2">
                {!filtered.length && <p className="text-center text-[10px] text-slate-400 italic py-8">Sin modelos — crea uno</p>}
                {filtered.map(m => {
                  const tid = m.tipo || 'BAREMO_PUNTOS';
                  const ti2 = TIPOS_MODELO[tid] || TIPOS_MODELO.BAREMO_PUNTOS;
                  const TI = ti2.icon;
                  const sel = (m._id || m.id) === selectedId;
                  return (
                    <button key={m._id || m.id} onClick={() => setSelectedId(m._id || m.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${sel ? 'bg-slate-900 border-slate-900 shadow-lg' : 'bg-slate-50 border-transparent hover:border-slate-200 hover:bg-white'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`p-1.5 rounded-lg flex-shrink-0 ${sel ? 'bg-white/10' : ti2.bgClass}`}>
                            <TI size={11} className={sel ? 'text-white' : ti2.textClass} />
                          </div>
                          <div className="min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-tight truncate ${sel ? 'text-white' : 'text-slate-800'}`}>{m.nombre}</p>
                            <p className={`text-[8px] font-bold mt-0.5 ${sel ? 'text-slate-300' : 'text-slate-400'}`}>{ti2.shortLabel}{m.industria && m.industria !== 'TODOS' ? ` · ${m.industria}` : ''}</p>
                          </div>
                        </div>
                        {m.activo && <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${sel ? 'bg-emerald-400' : 'bg-emerald-500'} animate-pulse`} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-5">
              <div className="flex gap-3 items-start">
                <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-1">Malla Legal DT</p>
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed">Vincula cada modelo a un Tipo de Bono DT para informarlo correctamente en el LRE.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Editor ── */}
          <div className="lg:col-span-9">
            {!selected ? (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="p-4 bg-slate-50 rounded-3xl inline-block mb-4"><Award size={24} className="text-slate-300" /></div>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Selecciona o crea un modelo</p>
                  <button onClick={() => setShowNewModal(true)} className="mt-4 flex items-center gap-2 mx-auto bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all">
                    <Plus size={13} /> Nuevo Modelo
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Card: Identificación */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-7 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-5 mb-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`p-3 ${ti.bgClass} rounded-2xl flex-shrink-0`}><TipoIcon size={20} className={ti.textClass} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <TipoBadge tipo={selected.tipo || 'BAREMO_PUNTOS'} size="md" />
                          {selected.activo && <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">● Activo</span>}
                          {!selected._id && <span className="text-[7px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Sin guardar</span>}
                        </div>
                        <input value={selected.nombre || ''} onChange={e => updateField({ nombre: e.target.value })}
                          placeholder="Nombre del modelo..."
                          className="text-xl font-black text-slate-900 tracking-tight bg-transparent border-b-2 border-dotted border-slate-200 focus:border-indigo-400 focus:outline-none w-full" />
                        <textarea value={selected.description || ''} onChange={e => updateField({ description: e.target.value })} rows={2}
                          placeholder="Descripción del modelo..."
                          className="mt-2 text-sm font-medium text-slate-500 bg-transparent w-full resize-none focus:outline-none placeholder:text-slate-300" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={toggleActive}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all ${selected.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                        {selected.activo ? <><CheckCircle2 size={11} /> Activo</> : <><Clock size={11} /> Inactivo</>}
                      </button>
                      <button onClick={handleDelete} className="p-2.5 bg-rose-50 border border-rose-100 text-rose-400 hover:text-rose-600 hover:border-rose-300 rounded-2xl transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5 border-t border-slate-100">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Industria</label>
                      <select value={selected.industria || 'TODOS'} onChange={e => updateField({ industria: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 focus:outline-none focus:border-indigo-300 cursor-pointer">
                        {INDUSTRIAS.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Color</label>
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {COLORES.map(c => (
                          <button key={c} onClick={() => updateField({ color: c })}
                            className={`w-5 h-5 rounded-full ${COLOR_PILL[c]} transition-all ${selected.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'opacity-50 hover:opacity-100'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Vínculo Legal DT — Nómina LRE</label>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 focus-within:border-indigo-300 rounded-xl px-3 py-2">
                        <Scale size={12} className="text-indigo-500 flex-shrink-0" />
                        <select value={selected.tipoBonoRef || ''} onChange={e => updateField({ tipoBonoRef: e.target.value })}
                          className="flex-1 bg-transparent text-[10px] font-black text-slate-600 focus:outline-none cursor-pointer">
                          <option value="">Sin vínculo DT</option>
                          {tiposBono.map(t => <option key={t._id} value={t._id}>{t.nombre} ({t.codigoDT}) — {t.tipo}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card: Aplicabilidad */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center"><Users size={14} className="text-slate-600" /></div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Aplicabilidad</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Define a qué cargos y sectores aplica este modelo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex-1">Aplica a todos los cargos</p>
                    <button onClick={() => updateField({ aplicaA: { ...(selected.aplicaA || {}), todos: !(selected.aplicaA?.todos) } })}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${selected.aplicaA?.todos ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                      {selected.aplicaA?.todos ? <><Check size={10} /> Sí</> : 'No'}
                    </button>
                  </div>
                  {!selected.aplicaA?.todos && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Cargos (Enter para agregar)</label>
                        <TagInput tags={selected.aplicaA?.cargos || []}
                          onAdd={v => updateField({ aplicaA: { ...selected.aplicaA, cargos: [...(selected.aplicaA?.cargos || []), v] } })}
                          onRemove={v => updateField({ aplicaA: { ...selected.aplicaA, cargos: (selected.aplicaA?.cargos || []).filter(x => x !== v) } })}
                          placeholder="Ej: Técnico Terreno" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Sectores / Áreas (Enter para agregar)</label>
                        <TagInput tags={selected.aplicaA?.sectores || []}
                          onAdd={v => updateField({ aplicaA: { ...selected.aplicaA, sectores: [...(selected.aplicaA?.sectores || []), v] } })}
                          onRemove={v => updateField({ aplicaA: { ...selected.aplicaA, sectores: (selected.aplicaA?.sectores || []).filter(x => x !== v) } })}
                          placeholder="Ej: Operaciones" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Card: Configuración de Cálculo */}
                <div className="bg-white border border-slate-200 rounded-[2.5rem] p-7 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-8 h-8 ${ti.bgClass} rounded-xl flex items-center justify-center`}><TipoIcon size={14} className={ti.textClass} /></div>
                    <div>
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Configuración de Cálculo — {ti.label}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{ti.desc}</p>
                    </div>
                  </div>
                  {renderConfig()}
                </div>

                {/* Banner bottom */}
                <div className="bg-indigo-900 rounded-[2.5rem] p-8 relative overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="p-4 bg-white/10 rounded-3xl border border-white/10"><Target className="w-10 h-10 text-white" /></div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-black text-white tracking-tight mb-1">Simulación de Impacto Nómina</h3>
                      <p className="text-indigo-200 text-sm font-medium">Simula el costo total en nómina antes de activar este modelo. Asigna modelos distintos por proyecto, cliente o cargo.</p>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:shadow-2xl hover:-translate-y-0.5 transition-all">
                      Simular <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Nuevo Modelo */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 px-8 py-7 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-1">Nuevo Modelo</p>
                <h2 className="text-xl font-black text-white tracking-tight">¿Qué tipo de bonificación?</h2>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(TIPOS_MODELO).map(([key, ti2]) => {
                  const TI2 = ti2.icon;
                  const sel2 = newTipo === key;
                  return (
                    <button key={key} onClick={() => setNewTipo(key)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${sel2 ? `${ti2.borderClass} ${ti2.bgClass}` : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}>
                      <div className={`p-2 rounded-xl inline-flex mb-2 ${sel2 ? 'bg-white/60' : 'bg-white'}`}><TI2 size={14} className={sel2 ? ti2.textClass : 'text-slate-400'} /></div>
                      <p className={`text-[10px] font-black uppercase tracking-tight ${sel2 ? ti2.textClass : 'text-slate-700'}`}>{ti2.label}</p>
                      <p className={`text-[8px] font-medium mt-0.5 leading-tight ${sel2 ? 'opacity-80 ' + ti2.textClass : 'text-slate-400'}`}>{ti2.desc.split('.')[0]}</p>
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Nombre del Modelo</label>
                <input value={newNombre} onChange={e => setNewNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="Ej: Comisión Ventas Retail Q1-2026"
                  className="w-full bg-slate-50 border-2 border-slate-100 focus:border-indigo-400 rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-800 focus:outline-none transition-colors" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowNewModal(false)} className="flex-1 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-100">Cancelar</button>
                <button onClick={handleCreate} disabled={!newNombre.trim()}
                  className="flex-1 py-3 bg-slate-900 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-indigo-900 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                  Crear Modelo <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelosBonificacion;
