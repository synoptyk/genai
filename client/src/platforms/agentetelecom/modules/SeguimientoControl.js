import React, { useState } from 'react';
import { Map, Truck, BarChart2 } from 'lucide-react';

// --- SOLO DEJAMOS COMPONENTES DE FLOTA ---
import DashboardSeguimiento from '../DashboardSeguimiento';
import MonitorGps from '../MonitorGps';
import Flota from '../Flota';

const SeguimientoControl = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Resumen Global', icon: <BarChart2 size={18} /> },
    { id: 'gps', label: 'Monitor GPS Live', icon: <Map size={18} /> },
    { id: 'flota', label: 'Gestión de Flota', icon: <Truck size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardSeguimiento />;
      case 'gps': return <MonitorGps />;
      case 'flota': return <Flota />;
      default: return <DashboardSeguimiento />;
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="mb-6 flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Truck className="text-blue-600" /> Mi Flota & GPS
          </h2>
          <p className="text-slate-500 text-sm mt-1">Control de activos móviles y seguimiento satelital.</p>
        </div>
      </div>

      <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex gap-1 mb-6 w-fit mx-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
              ${activeTab === item.id
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-transparent rounded-2xl overflow-hidden relative">
        <div className="h-full w-full overflow-y-auto custom-scrollbar">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SeguimientoControl;