import React, { useState } from 'react';
import telecomApi from './telecomApi';
import {
  Download, FileSpreadsheet, FileText, Search, Table,
  Calendar, User, Filter, Loader2, AlertCircle
} from 'lucide-react';

const Historial = () => {
  const [filtros, setFiltros] = useState({ tecnicoId: '', inicio: '', fin: '' });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Búsqueda Real en MongoDB
  const buscar = async () => {
    setLoading(true);
    try {
      const q = `?tecnicoId=${filtros.tecnicoId}&fechaInicio=${filtros.inicio}&fechaFin=${filtros.fin}`;
      const res = await telecomApi.get(`/historial${q}`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Exportación a CSV Real (Excel)
  const exportarCSV = () => {
    if (data.length === 0) return alert("No hay datos para exportar");

    const headers = ["Fecha", "ID Tecnico", "Nombre", "Actividad", "Puntos", "Ingreso ($)"];
    const rows = data.map(row => [
      new Date(row.fecha).toLocaleDateString(),
      row.tecnicoId,
      row.nombre,
      `"${row.actividad}"`, // Comillas para evitar errores con comas en descripción
      row.puntos,
      row.ingreso || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Produccion_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto pb-10">

      {/* HEADER & FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-black italic text-slate-800 flex items-center gap-3">
            <Filter className="text-blue-600" size={32} />
            Auditoría & <span className="text-blue-600">Reportes</span>
          </h1>
          <p className="text-slate-500 text-xs font-bold tracking-widest mt-2">
            CONSULTA HISTÓRICA Y EXPORTACIÓN DE DATA
          </p>
        </div>

        {/* Barra de Búsqueda (Estilo Claro) */}
        <div className="flex flex-col md:flex-row gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 w-full lg:w-auto">
          <div className="relative group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="ID Técnico (Opcional)"
              className="bg-slate-50 w-full md:w-48 text-xs py-3 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-700 font-bold outline-none transition-all"
              onChange={e => setFiltros({ ...filtros, tecnicoId: e.target.value })}
            />
          </div>

          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="date"
              className="bg-slate-50 w-full md:w-40 text-xs py-3 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:bg-white text-slate-700 font-bold outline-none transition-all"
              onChange={e => setFiltros({ ...filtros, inicio: e.target.value })}
            />
          </div>

          <button
            onClick={buscar}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl text-white transition-all shadow-md shadow-blue-500/30 flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </div>
      </div>

      {/* TARJETAS DE ACCIÓN (Estilo SaaS Light) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Card PDF */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 hover:border-blue-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText size={100} className="text-blue-600" />
          </div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600">
              <FileText size={32} />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Zenith Report (PDF)</h3>
          <p className="text-slate-500 text-xs font-medium mb-6 leading-relaxed">
            Genera un reporte oficial formato corporativo con certificación de horarios y firma digital para presentación ejecutiva.
          </p>
          <button className="w-full bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase tracking-widest cursor-not-allowed flex justify-center items-center gap-2 border border-slate-200">
            <Download size={14} /> Próximamente
          </button>
        </div>

        {/* Card Excel */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 hover:border-emerald-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileSpreadsheet size={100} className="text-emerald-600" />
          </div>
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <FileSpreadsheet size={32} />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Data Cruda (Excel)</h3>
          <p className="text-slate-500 text-xs font-medium mb-6 leading-relaxed">
            Exportación directa a formato CSV compatible con Excel para conciliación de pagos, tablas dinámicas y auditoría.
          </p>
          <button
            onClick={exportarCSV}
            className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2 transition-transform hover:scale-[1.02]"
          >
            <Download size={14} /> Descargar CSV
          </button>
        </div>

      </div>

      {/* TABLA DE RESULTADOS (Estilo Claro) */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col min-h-[400px]">

        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Table size={18} className="text-blue-500" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Resultados de Búsqueda</span>
          </div>
          {data.length > 0 && (
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold">
              {data.length} Registros
            </span>
          )}
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Técnico</th>
                <th className="px-6 py-4">Actividad</th>
                <th className="px-6 py-4 text-right">Puntos</th>
                <th className="px-6 py-4 text-right">Ingreso ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={32} />
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Buscando Registros...</span>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-20 text-center opacity-50">
                    <AlertCircle className="mx-auto text-slate-300 mb-2" size={40} />
                    <span className="text-slate-400 font-bold">No se encontraron resultados</span>
                    <p className="text-[10px] text-slate-400 mt-1">Intenta ajustar los filtros de fecha o ID</p>
                  </td>
                </tr>
              ) : data.map((row, k) => (
                <tr key={k} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-slate-500">{new Date(row.fecha).toLocaleDateString('es-CL')}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{row.nombre}</span>
                    <span className="block text-[9px] text-slate-400 font-mono">{row.tecnicoId}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={row.actividad}>
                    {row.actividad}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded border border-slate-200">
                      {row.puntos}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">
                    $ {(row.ingreso || 0).toLocaleString('es-CL')}
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

export default Historial;