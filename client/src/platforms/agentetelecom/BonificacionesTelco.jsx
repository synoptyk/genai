import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Calculator, Zap, Target, 
  ChevronRight, CalendarDays, BarChart3, Settings
} from 'lucide-react';
import CierreBonos from './CierreBonos';
import ConfigLPU from './ConfigLPU';

/**
 * 🛰️ MÓDULO UNIFICADO: BONIFICACIONES TELCO (v1.0)
 * Fusiona la gestión de Metas/KPIs y la configuración de Puntos Baremo (LPU).
 */
const BonificacionesTelco = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determinar pestaña inicial basada en la URL o estado persistido
  const [activeTab, setActiveTab] = useState(() => {
    if (location.pathname.includes('config-lpu')) return 'lpu';
    return 'kpi';
  });

  // Sincronizar pestaña si cambian los props de navegación externa
  useEffect(() => {
    if (location.pathname.includes('config-lpu')) setActiveTab('lpu');
    else if (location.pathname.includes('cierre-bonos')) setActiveTab('kpi');
  }, [location.pathname]);

  const tabs = [
    { 
      id: 'kpi', 
      label: 'Cierre Meta / KPI', 
      icon: TrendingUp, 
      color: 'emerald',
      description: 'Gestión mensual de incentivos y cumplimiento'
    },
    { 
      id: 'lpu', 
      label: 'Configuración LPU', 
      icon: Calculator, 
      color: 'blue',
      description: 'Precios unitarios y puntos baremo'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* ── NAVEGACIÓN DE TABS (STICKY) ── */}
      <div className="sticky top-0 z-[40] bg-white/80 backdrop-blur-xl border-b border-slate-100 px-8 py-4 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg shadow-slate-200">
              <Zap className="text-white fill-white" size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Bonificaciones Telco</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">Motor de Incentivos & baremos</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-6 py-2.5 rounded-[1.1rem] transition-all duration-300 group
                    ${isActive 
                      ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200' 
                      : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${isActive ? (tab.id === 'kpi' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600') : 'bg-transparent text-slate-400'}`}>
                    <Icon size={16} strokeWidth={isActive ? 3 : 2} />
                  </div>
                  <div className="text-left">
                    <span className={`block text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-slate-900' : ''}`}>
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONTENIDO DINÁMICO ── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeTab === 'kpi' ? (
          <div className="p-0">
            <CierreBonos />
          </div>
        ) : (
          <div className="p-0">
            <ConfigLPU />
          </div>
        )}
      </div>

      {/* ── FOOTER DE CONTEXTO (OPCIONAL) ── */}
      <div className="max-w-[1600px] mx-auto px-8 py-10 opacity-30 pointer-events-none">
         <div className="flex items-center justify-between border-t border-slate-200 pt-6">
            <div className="flex items-center gap-4">
               <Settings size={14} className="text-slate-400" />
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unified Telco Engine v1.0 • Ecosistema GENAI360</span>
            </div>
         </div>
      </div>
    </div>
  );
};

export default BonificacionesTelco;
