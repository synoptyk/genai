
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { Calendar, TrendingUp, Users, Target } from 'lucide-react';

const ProduccionSemanal = ({ calendar = {}, clientProjects = [] }) => {
  // 1. Preparar datos para el gráfico de barras (evolución diaria/semanal)
  const chartData = Object.entries(calendar)
    .map(([date, data]) => ({
      date,
      pts: Math.round(data.pts * 10) / 10,
      orders: data.orders
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Agrupar por semana (ISO Week styleish)
  const weeklyDataMap = {};
  chartData.forEach(d => {
    const dt = new Date(d.date);
    const week = getWeekNumber(dt);
    const year = dt.getFullYear();
    const key = `${year}-W${week}`;
    if (!weeklyDataMap[key]) weeklyDataMap[key] = { week: key, pts: 0, orders: 0, days: 0 };
    weeklyDataMap[key].pts += d.pts;
    weeklyDataMap[key].orders += d.orders;
    weeklyDataMap[key].days += 1;
  });

  const weeklyChartData = Object.values(weeklyDataMap).sort((a, b) => a.week.localeCompare(b.week));

  function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Producción Total</p>
              <h3 className="text-2xl font-black text-slate-800">
                {chartData.reduce((s, d) => s + d.pts, 0).toFixed(1)} <span className="text-xs text-slate-400 font-bold">PTS</span>
              </h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Target size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Órdenes Totales</p>
              <h3 className="text-2xl font-black text-slate-800">
                {chartData.reduce((s, d) => s + d.orders, 0)} <span className="text-xs text-slate-400 font-bold">REQ</span>
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Semanal</p>
              <h3 className="text-2xl font-black text-slate-800">
                {weeklyChartData.length > 0 
                  ? (weeklyChartData.reduce((s, w) => s + w.pts, 0) / weeklyChartData.length).toFixed(1)
                  : '0.0'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Rendimiento Semanal</h2>
            <p className="text-xs text-slate-400 font-medium">Evolución de puntos baremados por semana de producción</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
              <span className="text-[10px] font-black text-slate-600 uppercase">Puntos</span>
            </div>
          </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyChartData}>
              <defs>
                <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="week" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                itemStyle={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}
                labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 700 }}
              />
              <Area 
                type="monotone" 
                dataKey="pts" 
                stroke="#6366f1" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#colorPts)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Semana</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Días Trabajados</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Puntos</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Órdenes</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Prom. Diario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {weeklyChartData.map((w, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-black text-slate-700">{w.week}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-bold text-slate-500">{w.days} días</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-black text-indigo-600">{w.pts.toFixed(1)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-bold text-slate-500">{w.orders}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black">
                    {(w.pts / w.days).toFixed(1)} PTS/DÍA
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

export default ProduccionSemanal;
