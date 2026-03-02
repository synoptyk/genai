import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Home, ArrowLeft, ShieldAlert } from 'lucide-react';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
            {/* Fondo decorativo */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-600 rounded-full blur-[100px] animate-pulse" />
            </div>

            <div className="relative z-10 max-w-md w-full">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-[2rem] shadow-2xl shadow-indigo-500/20 mb-10 transform hover:scale-110 transition-transform duration-500">
                    <Zap size={44} className="text-white fill-white" />
                </div>

                <div className="space-y-4 mb-12">
                    <h1 className="text-8xl font-black text-white tracking-tighter">404</h1>
                    <div className="h-1.5 w-20 bg-gradient-to-r from-indigo-500 to-violet-500 mx-auto rounded-full mb-6" />
                    <h2 className="text-2xl font-black text-slate-100 uppercase tracking-widest">¿Te has perdido?</h2>
                    <p className="text-slate-400 font-medium leading-relaxed">
                        La página que buscas no existe o ha sido movida.
                        Verifica la URL o regresa al centro de operaciones.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-slate-700"
                    >
                        <ArrowLeft size={16} /> Volver atrás
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="flex-1 flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Home size={16} /> Ir al Inicio
                    </button>
                </div>

                <div className="mt-16 flex items-center justify-center gap-2 text-slate-500">
                    <ShieldAlert size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Gen AI Security System</span>
                </div>
            </div>

            <p className="absolute bottom-8 text-[10px] text-slate-600 font-bold uppercase tracking-[0.4em]">
                Synoptyk Enterprise · 2026
            </p>
        </div>
    );
};

export default NotFound;
