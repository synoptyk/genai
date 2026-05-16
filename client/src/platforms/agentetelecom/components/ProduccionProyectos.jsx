
import React from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Target, Briefcase, Users, TrendingUp } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

const ProduccionProyectos = ({ clientProjects = [] }) => {
  const pieData = clientProjects.map((cp, i) => ({
    name: cp.proyecto || cp.cliente,
    value: Math.round(cp.pts || 0),
    color: COLORS[i % COLORS.length]
  }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Proyect Distribution Pie */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Distribución por Proyecto</h2>
              <p className="text-xs text-slate-400 font-medium">Reparto de puntos totales entre proyectos activos</p>
            </div>
            <div className="p-3 rounded-2xl bg-violet-50 text-violet-600">
              <Target size={20} />
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 800 }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {clientProjects.slice(0, 4).map((cp, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${COLORS[i % COLORS.length]}15`, color: COLORS[i % COLORS.length] }}>
                  <Briefcase size={18} />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Puntos Reales</p>
                    <p className="text-lg font-black text-slate-800">{Math.round(cp.pts).toLocaleString('es-CL')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none">Meta Esperada</p>
                    <p className="text-lg font-black text-indigo-600">{Math.round(cp.metaEsperada || 0).toLocaleString('es-CL')}</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase line-clamp-1 mb-1">{cp.proyecto}</h4>
                <div className="flex items-center gap-3">
                   <div className="flex items-center gap-1">
                      <Users size={10} className="text-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400">{cp.techs} Techs</span>
                   </div>
                   <div className="flex items-center gap-1">
                      <TrendingUp size={10} className="text-slate-300" />
                      <span className="text-[9px] font-bold text-slate-400">{cp.avgPerDay} P/D</span>
                   </div>
                </div>
              </div>
            </div>
          ))}
          {clientProjects.length === 0 && <div className="col-span-2 flex items-center justify-center text-slate-300 italic text-sm">No hay proyectos para mostrar</div>}
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente / Proyecto</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Dotación</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Días Prod.</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Prod/Día</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Meta Esperada</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Puntos Totales</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">% Carga</th>
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
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black">
                    <Users size={12} />
                    {cp.techs}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-bold text-slate-500">{cp.days} días</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-black text-slate-800">{(cp.avgPerDay || 0).toFixed(1)}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-black text-indigo-500">{Math.round(cp.metaEsperada || 0).toLocaleString('es-CL')}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-black text-slate-700">{Math.round(cp.pts).toLocaleString('es-CL')}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className={`text-xs font-black px-2 py-1 rounded-lg inline-block ${ (cp.pts / (cp.metaEsperada || 1)) >= 0.9 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {((cp.pts / (cp.metaEsperada || 1)) * 100).toFixed(1)}%
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

export default ProduccionProyectos;
