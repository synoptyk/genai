import React, { useState, useEffect } from 'react';
import API_URL from '../../../config';

import axios from 'axios';
import {
  RefreshCw,
  MapPin,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const Produccion = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resumen, setResumen] = useState({ total: 0, puntos: 0, activos: 0 });

  // 1. FUNCIÓN PARA CARGAR DATOS DESDE TU MONGODB
  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Ajusta la URL si tu puerto es diferente
      const respuesta = await axios.get(`${API_URL}/api/produccion`);
      const datos = respuesta.data;

      setData(datos);

      // Calcular Resumen Rápido
      const totalPuntos = datos.reduce((acc, curr) => acc + (curr.puntos || 1), 0); // Asumiendo 1 pto si no viene
      const unicos = new Set(datos.map(d => d.nombre)).size;

      setResumen({
        total: datos.length,
        puntos: totalPuntos,
        activos: unicos
      });

    } catch (error) {
      console.error("Error conectando con el servidor:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. AUTO-REFRESH Y CARGA INICIAL
  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 30000); // Refresca cada 30s automáticamente
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-1">

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Actividades Hoy</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1">{resumen.total}</h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Puntos Estimados</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1">{resumen.puntos}</h3>
          </div>
          <div className="p-3 bg-green-50 rounded-xl text-green-600">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Técnicos Activos</p>
            <h3 className="text-3xl font-black text-slate-800 mt-1">{resumen.activos}</h3>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <User size={24} />
          </div>
        </div>
      </div>

      {/* TABLA DE PRODUCCIÓN EN VIVO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
        {/* Header Tabla */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Registro en Vivo (TOA)
          </h3>
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="text-slate-500 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Cuerpo Tabla Scrollable */}
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hora/Fecha</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Técnico</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Orden / ID</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actividad</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">GPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.length > 0 ? (
                data.map((row) => (
                  <tr key={row.ordenId} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Calendar size={14} className="text-slate-400" />
                        {new Date(row.fecha).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-700 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black">
                          {row.nombre.substring(0, 2)}
                        </div>
                        {row.nombre}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold border border-blue-100">
                        {row.ordenId}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-600 font-medium max-w-[250px] truncate" title={row.actividad}>
                        {row.actividad}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {row.latitud ? (
                        <a
                          href={`https://www.google.com/maps?q=${row.latitud},${row.longitud}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        >
                          <MapPin size={14} /> Ver Mapa
                        </a>
                      ) : (
                        <span className="text-slate-300 flex items-center justify-center gap-1 text-xs">
                          <AlertCircle size={14} /> N/A
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <RefreshCw size={24} className="text-slate-300" />
                      </div>
                      <p>Esperando datos del Agente TOA...</p>
                      <p className="text-xs text-slate-300">Ejecuta 'npm run agentetelecom' en tu terminal</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Produccion;