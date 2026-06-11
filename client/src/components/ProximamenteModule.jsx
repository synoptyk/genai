import React, { useState } from 'react';
import { BRAND } from '../branding/brand';

export default function ProximamenteModule({ moduleName, permissionKey }) {
  const [subscribed, setSubscribed] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 transition-colors duration-300">
      <div className="w-full max-w-lg bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 shadow-2xl rounded-[2.5rem] p-8 sm:p-12 text-center transition-all duration-300 hover:shadow-indigo-500/10">
        
        {/* Animated Badge Icon */}
        <div className="inline-flex items-center justify-center p-6 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-3xl mb-8 relative">
          <div className="absolute inset-0 bg-indigo-500/20 rounded-3xl animate-ping scale-75 opacity-75" />
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 animate-pulse">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-3">
          {moduleName || 'Módulo'}
        </h2>
        
        {/* Subtitle */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-[9px] font-black uppercase tracking-wider mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          En Desarrollo Activo
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 max-w-sm mx-auto">
          Estamos construyendo este módulo para integrarlo a la gestión 360 de <strong>{BRAND.companyName}</strong>. Estará disponible en la próxima actualización de la plataforma.
        </p>

        {/* Feature Preview List */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 mb-8 text-left space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Métricas Avanzadas e Inteligencia Activa</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Exportación Inteligente y Reportes PDF/XLSX</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Integración 360 y Trazabilidad Multi-Sede</span>
          </div>
        </div>

        {/* Subscription Form */}
        {subscribed ? (
          <div className="flex flex-col items-center justify-center p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 transition-all duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 animate-bounce">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-xs font-black uppercase tracking-wider">¡Suscrito con Éxito!</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">Te avisaremos cuando este módulo esté listo para producción.</p>
          </div>
        ) : (
          <form onSubmit={handleSubscribe} className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left mb-1 ml-1">¿Quieres probarlo antes?</p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Ingresa tu email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Avisar
              </button>
            </div>
          </form>
        )}

        {/* Small Note */}
        {permissionKey && (
          <div className="mt-6 flex items-center gap-1.5 justify-center text-[9px] text-slate-400 dark:text-slate-500 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Permiso requerido: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded font-mono font-bold">{permissionKey}</code></span>
          </div>
        )}

      </div>
    </div>
  );
}
