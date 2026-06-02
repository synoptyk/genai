import React, { useState, useEffect } from 'react';
import { telecomApi as api } from '../../agentetelecom/telecomApi';
import ProduccionAgenda from '../../agentetelecom/components/ProduccionAgenda';
import { Calendar, RefreshCw } from 'lucide-react';

export default function AgendaColaboradorTab({ dateFrom, dateTo, tecnicoFijo, selectedMonths }) {
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAgenda = async () => {
    if (!tecnicoFijo) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        desde: dateFrom,
        hasta: dateTo,
        tecnicos: tecnicoFijo,
        estado: 'todos'
      });
      if (selectedMonths?.length > 0) params.append('months', selectedMonths.join(','));

      const res = await api.get(`/bot/produccion-stats?${params.toString()}`);
      if (res.data && res.data.tecnicos) {
        setTecnicos(res.data.tecnicos);
      }
    } catch (err) {
      console.error('Error fetching agenda:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgenda();
  }, [dateFrom, dateTo, tecnicoFijo, selectedMonths]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Calendar size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-widest">Mi Agenda KPI</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tiempos y Productividad</p>
          </div>
        </div>
        <button
          onClick={fetchAgenda}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 border border-slate-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {loading && tecnicos.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
          Analizando datos de agenda...
        </div>
      ) : (
        <div className="-mx-4 sm:mx-0">
          <ProduccionAgenda 
            tecnicos={tecnicos}
            dateFrom={dateFrom}
            selectedMonths={selectedMonths}
          />
        </div>
      )}
    </div>
  );
}
