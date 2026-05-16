
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Activity, ClipboardList, DollarSign } from 'lucide-react';
import { formatCLP } from '../utils/financialUtils';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const FinancialActividades = ({ lpuActivities = [] }) => {
  const topActivities = useMemo(() => {
    return [...lpuActivities]
      .sort((a, b) => b.totalCLP - a.totalCLP)
      .slice(0, 15);
  }, [lpuActivities]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Valorización por Actividad</h2>
            <p className="text-xs text-slate-400 font-medium">Top 15 actividades que generan mayor facturación bruta</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <DollarSign size={20} />
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={topActivities} layout="vertical" margin={{ left: 40, right: 60 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="desc" type="category" axisLine={false} tickLine={false} width={150} tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b', textTransform: 'uppercase' }} />
              <Tooltip formatter={(v) => formatCLP(v)} />
              <Bar dataKey="totalCLP" radius={[0, 8, 8, 0]} barSize={24}>
                {topActivities.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <ClipboardList className="text-slate-400" size={18} />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Detalle Financiero LPU</h3>
           </div>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código / Descripción</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Unidades</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Tarifa Ref.</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Monto Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lpuActivities.map((act, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-400 mb-0.5 uppercase tracking-wider">{act.code}</span>
                      <span className="text-xs font-black text-slate-700 uppercase">{act.desc}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-slate-500">{act.count}</td>
                  <td className="px-6 py-4 text-center text-xs font-black text-slate-400">{formatCLP((act.totalCLP || 0) / (act.count || 1))}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-800">{formatCLP(act.totalCLP)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FinancialActividades;
