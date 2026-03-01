import React, { useState } from 'react';
import PrevASTForm from './PrevASTForm';
import PrevHseConsole from './PrevHseConsole';
import { ShieldAlert, Terminal } from 'lucide-react';

const PrevOperatividad = () => {
    const [view, setView] = useState('console'); // 'console' | 'standalone_ast'

    return (
        <div className="min-h-screen bg-white">
            <div className="fixed top-6 right-10 z-[60] flex gap-2">
                <button
                    onClick={() => setView('console')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'console' ? 'bg-slate-900 text-white shadow-xl translate-x-0' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                >
                    <ShieldAlert size={16} /> Panel HSE
                </button>
                <button
                    onClick={() => setView('standalone_ast')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${view === 'standalone_ast' ? 'bg-rose-600 text-white shadow-xl' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
                >
                    <Terminal size={16} /> Link de AST (Terreno)
                </button>
            </div>

            {view === 'console' ? <PrevHseConsole /> : <PrevASTForm />}
        </div>
    );
};

export default PrevOperatividad;
