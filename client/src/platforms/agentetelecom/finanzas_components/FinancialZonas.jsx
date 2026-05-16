
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { MapPin, Globe, Building, DollarSign } from 'lucide-react';
import { formatCLP } from '../utils/financialUtils';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

const FinancialZonas = ({ cities = {} }) => {
  const cityData = Object.entries(cities)
    .map(([name, data]) => ({
      name: name || 'Otras Zonas',
      clp: Math.round(data?.clp || 0),
      orders: data.orders
    }))
    .sort((a, b) => b.clp - a.clp);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
              <MapPin size={20} />
            </div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Ranking Regional</h2>
          </div>
          <div className="space-y-4">
            {cityData.slice(0, 8).map((city, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-black text-slate-700 uppercase">{city.name}</span>
                    <span className="text-[10px] font-black text-blue-600">{formatCLP(city.clp)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${(city.clp / (cityData[0]?.clp || 1)) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Distribución Geográfica (Monto)</h2>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={cityData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8', textTransform: 'uppercase' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => formatCLP(v)} />
                <Bar dataKey="clp" radius={[8, 8, 0, 0]} barSize={32}>
                  {cityData.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ciudad / Zona</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Total Órdenes</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Ingreso/Órden</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Monto Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {cityData.map((city, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <Globe size={16} className="text-blue-500" />
                  <span className="text-sm font-black text-slate-700 uppercase">{city.name}</span>
                </td>
                <td className="px-6 py-4 text-center text-sm font-bold text-slate-500">{city.orders}</td>
                <td className="px-6 py-4 text-center text-xs font-black text-slate-400">{formatCLP(city.clp / (city.orders || 1))}</td>
                <td className="px-6 py-4 text-right font-black text-blue-700">{formatCLP(city.clp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FinancialZonas;
