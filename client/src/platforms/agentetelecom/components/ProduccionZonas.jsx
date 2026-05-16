
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { MapPin, Navigation, Globe, Building } from 'lucide-react';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

const ProduccionZonas = ({ cities = {} }) => {
  const cityData = Object.entries(cities)
    .map(([name, data]) => ({
      name: name || 'Otras Zonas',
      pts: Math.round(data?.pts || 0),
      orders: data.orders
    }))
    .sort((a, b) => b.pts - a.pts);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* City Ranking List */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Zonas Activas</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{cityData.length} ciudades detectadas</p>
            </div>
          </div>

          <div className="space-y-4">
            {cityData.slice(0, 8).map((city, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-black text-slate-700 uppercase">{city.name}</span>
                    <span className="text-[10px] font-black text-blue-600">{city.pts.toLocaleString('es-CL')} PTS</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                      style={{ width: `${(city.pts / (cityData[0]?.pts || 1)) * 100}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bar Chart Visual */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Distribución Geográfica</h2>
              <p className="text-xs text-slate-400 font-medium">Volumen de producción por zona operativa</p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                 <Building size={14} className="text-slate-400" />
                 <span className="text-[10px] font-black text-slate-600 uppercase">Sedes Operativas</span>
              </div>
            </div>
          </div>

          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8', textTransform: 'uppercase' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 800 }}
                  labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px', fontWeight: 700 }}
                />
                <Bar 
                  dataKey="pts" 
                  radius={[8, 8, 0, 0]} 
                  barSize={32}
                  animationDuration={1500}
                >
                  {cityData.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stats Summary Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ciudad / Zona</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Total Órdenes</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pts Promedio</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Puntos Totales</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {cityData.map((city, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-blue-500">
                      <Globe size={16} />
                    </div>
                    <span className="text-sm font-black text-slate-700 uppercase">{city.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-sm font-bold text-slate-500">{city.orders}</span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="text-xs font-black text-slate-400">{(city.pts / (city.orders || 1)).toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center px-4 py-1.5 rounded-xl bg-blue-50 text-blue-700">
                    <span className="text-sm font-black">{city.pts.toLocaleString('es-CL')}</span>
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

export default ProduccionZonas;
