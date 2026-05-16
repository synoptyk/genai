
import React from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { Calendar, TrendingUp, Target, DollarSign } from 'lucide-react';
import { formatCLP } from '../utils/financialUtils';

const FinancialSemanal = ({ calendar = {} }) => {
  const chartData = Object.entries(calendar)
    .map(([date, data]) => ({
      date,
      clp: Math.round(data.clp || 0),
      orders: data.orders
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyDataMap = {};
  chartData.forEach(d => {
    const dt = new Date(d.date);
    const weekNo = getWeekNumber(dt);
    const year = dt.getFullYear();
    const key = `${year}-W${weekNo}`;
    if (!weeklyDataMap[key]) weeklyDataMap[key] = { week: key, clp: 0, orders: 0, days: 0 };
    weeklyDataMap[key].clp += d.clp;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ingreso Total</p>
              <h3 className="text-xl font-black text-slate-800">{formatCLP(chartData.reduce((s, d) => s + d.clp, 0))}</h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Target size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Órdenes Totales</p>
              <h3 className="text-xl font-black text-slate-800">{chartData.reduce((s, d) => s + d.orders, 0)} <span className="text-xs text-slate-400 font-bold">REQ</span></h3>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Semanal</p>
              <h3 className="text-xl font-black text-slate-800">{weeklyChartData.length > 0 ? formatCLP(weeklyChartData.reduce((s, w) => s + w.clp, 0) / weeklyChartData.length) : '$0'}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-8">Evolución Financiera Semanal</h2>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={weeklyChartData}>
              <defs>
                <linearGradient id="colorClp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
              <Tooltip formatter={(v) => formatCLP(v)} />
              <Area type="monotone" dataKey="clp" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorClp)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FinancialSemanal;
