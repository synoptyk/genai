/**
 * DEPRECADO (11/04/2026) — Este archivo se ha fusionado con el Dashboard 360
 * 
 * La funcionalidad de Historial Operativo ahora forma parte integral del
 * Dashboard 360 unificado ubicado en:
 *   src/platforms/agentetelecom/DashboardEjecutivo.jsx
 * 
 * Todas las características están disponibles en la sección 5:
 * "Capital Humano & Historial Operativo"
 * 
 * Features integradas:
 * ✓ Estadísticas globales de reclutamiento (total, en proceso, contratados, finiquitados, rechazados)
 * ✓ Embudo de reclutamiento visual
 * ✓ Tabla filtrable de personas con búsqueda, CECO, proyecto, ordenamiento
 * ✓ Modal de detalle con timeline de operaciones
 * ✓ Sistema de notas de auditoría integrado
 * ✓ Gestión de talento y dotación
 * 
 * Ruta optimizada: /dashboard
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';

const HistorialRRHH = () => {
  React.useEffect(() => {
    // Auto-redirecciona después de 2 segundos
    const timer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl p-8 w-full max-w-xl border-2 border-violet-100 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-amber-100 rounded-2xl">
            <AlertCircle size={28} className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Módulo Fusionado ✨</h1>
            <p className="text-sm text-slate-500 mt-1">Historial Operativo integrado al Dashboard</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 mb-6 border border-slate-100">
          <p className="text-slate-700 font-bold mb-3">✅ Acción completada:</p>
          <p className="text-slate-600 text-sm leading-relaxed">
            El <strong>Historial Operativo</strong> se ha integrado completamente con el <strong>Dashboard 360</strong> ofreciendo una visión 360° unificada de toda la operación.
          </p>
          <p className="text-slate-600 text-sm leading-relaxed mt-3 font-semibold">
            El nuevo dashboard incluye:
          </p>
          <ul className="text-slate-600 text-sm space-y-1.5 mt-3 ml-4">
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> Análisis financiero & rentabilidad</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> Rankings de técnicos con metas</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> Gestión de flota y HSE</li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> <strong>Capital Humano con historial operativo completo</strong></li>
            <li className="flex items-start gap-2"><span className="text-emerald-600 font-black">✓</span> Timeline de personas + notas + auditoría</li>
          </ul>
        </div>

        <button
          onClick={() => window.location.href = '/dashboard'}
          className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
          ☆ Abrir Dashboard 360
        </button>

        <p className="text-[10px] text-slate-400 text-center mt-6 uppercase tracking-widest font-black">
          Redirigiendo automáticamente en 2 segundos... · /dashboard
        </p>
      </div>
    </div>
  );
};

export default HistorialRRHH;
