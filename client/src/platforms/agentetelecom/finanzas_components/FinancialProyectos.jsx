
import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Target, Briefcase, Users, DollarSign } from 'lucide-react';
import { formatCLP } from '../utils/financialUtils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const FinancialProyectos = ({ clientProjects = [] }) => {
  const pieData = clientProjects.map((cp, i) => ({
    name: cp.proyecto || cp.cliente,
    value: Math.round(cp.clp || 0),
    color: COLORS[i % COLORS.length]
  }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Distribución por Ingresos</h2>
              <p className="text-xs text-slate-400 font-medium">Reparto del valor económico entre proyectos</p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCLP(v)} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {clientProjects.slice(0, 4).map((cp, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${COLORS[i % COLORS.length]}15`, color: COLORS[i % COLORS.length] }}>
                  <Briefcase size={18} />
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Ingreso Bruto</p>
                  <p className="text-lg font-black text-slate-800">{formatCLP(cp.clp)}</p>
                </div>
              </div>
              <h4 className="text-xs font-black text-slate-700 uppercase line-clamp-1">{cp.proyecto}</h4>
              <div className="mt-2 flex items-center gap-3">
                 <div className="flex items-center gap-1">
                    <Users size={10} className="text-slate-300" />
                    <span className="text-[9px] font-bold text-slate-400">{cp.techs} Techs</span>
                 </div>
                 <div className="text-[9px] font-black text-indigo-500 uppercase">{formatCLP(cp.avgFactDia)}/DÍA</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente / Proyecto</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Dotación</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Ingreso/Día</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Monto Bruto</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Meta Estimada</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">% Logro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clientProjects.map((cp, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-400 mb-0.5 tracking-wider uppercase">{cp.cliente}</span>
                    <span className="text-sm font-black text-slate-700 uppercase">{cp.proyecto}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-bold text-slate-500">{cp.techs}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-black text-slate-800">{formatCLP(cp.avgFactDia)}</span>
                </td>
                <td className="px-6 py-4 text-right font-black text-slate-700">{formatCLP(cp.clp)}</td>
                <td className="px-6 py-4 text-right font-black text-indigo-500">{formatCLP(cp.metaEsperada)}</td>
                <td className="px-6 py-4 text-right">
                   <div className={`text-xs font-black px-2 py-1 rounded-lg inline-block ${ (cp.clp / (cp.metaEsperada || 1)) >= 0.9 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {((cp.clp / (cp.metaEsperada || 1)) * 100).toFixed(1)}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancialProyectos;
