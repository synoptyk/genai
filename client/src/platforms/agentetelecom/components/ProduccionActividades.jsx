
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Activity, ClipboardList, Layers, Star } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];

const ProduccionActividades = ({ lpuActivities = [] }) => {
  const topActivities = useMemo(() => {
    return [...lpuActivities]
      .sort((a, b) => b.totalPts - a.totalPts)
      .slice(0, 15);
  }, [lpuActivities]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Distribution Chart */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Top Actividades (Por Puntos)</h2>
            <p className="text-xs text-slate-400 font-medium">Principales códigos LPU que generan producción en el periodo</p>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <Activity size={20} />
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={topActivities} 
              layout="vertical"
              margin={{ left: 40, right: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="desc" 
                type="category" 
                axisLine={false} 
                tickLine={false} 
                width={150}
                tick={{ fontSize: 9, fontWeight: 800, fill: '#64748b', textTransform: 'uppercase' }} 
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 800 }}
                labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 700 }}
              />
              <Bar 
                dataKey="totalPts" 
                radius={[0, 8, 8, 0]} 
                barSize={24}
                animationDuration={1500}
              >
                {topActivities.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full List Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <ClipboardList className="text-slate-400" size={18} />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Desglose Detallado de Baremos</h3>
           </div>
           <span className="text-[10px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase">
              {lpuActivities.length} Actividades Detectadas
           </span>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código / Descripción</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Unidades</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pts / Uni</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Puntos Totales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lpuActivities.map((act, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-400 mb-0.5 tracking-wider">{act.code || 'N/A'}</span>
                      <span className="text-xs font-black text-slate-700 uppercase group-hover:text-indigo-600 transition-colors">{act.desc}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-slate-500">{act.count}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-black text-slate-400">{((act.totalPts || 0) / (act.count || 1)).toFixed(2)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center px-4 py-1.5 rounded-xl bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                      <span className="text-sm font-black text-slate-800 group-hover:text-indigo-700">{Math.round(act.totalPts).toLocaleString('es-CL')}</span>
                    </div>
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

export default ProduccionActividades;
