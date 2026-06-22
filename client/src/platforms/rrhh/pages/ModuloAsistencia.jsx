import React, { useState } from 'react';
import { CalendarDays, Scale, CalendarRange, Clock } from 'lucide-react';
import ProgramacionTurnos from './ProgramacionTurnos';
import AsistenciaLegal from './AsistenciaLegal';

const ModuloAsistencia = () => {
    const [activeTab, setActiveTab] = useState('legal'); // 'legal' or 'turnos'

    return (
        <div className="w-full h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header del Súper-Módulo */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-[2.5rem] p-8 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none"></div>
                <div className="space-y-2 relative z-10">
                    <span className="bg-white/20 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Recursos Humanos</span>
                    <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                        <CalendarDays size={32} />
                        Asistencia y Turnos
                    </h2>
                    <p className="text-blue-100 text-xs font-bold uppercase tracking-wider italic">
                        Cumplimiento Normativo (DT) y Gestión de Horarios
                    </p>
                </div>
            </div>

            {/* Navegación de Submódulos */}
            <div className="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 flex gap-2 w-fit">
                <button
                    onClick={() => setActiveTab('legal')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === 'legal'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                            : 'bg-transparent text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    <Scale size={16} /> Asistencia Legal (DT)
                </button>
                <button
                    onClick={() => setActiveTab('turnos')}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                        activeTab === 'turnos'
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                            : 'bg-transparent text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    <CalendarRange size={16} /> Creación de Turnos
                </button>
            </div>

            {/* Contenido Dinámico */}
            <div className="flex-1 min-h-0 bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden relative">
                {activeTab === 'legal' && <AsistenciaLegal />}
                {activeTab === 'turnos' && (
                    <div className="absolute inset-0 overflow-y-auto">
                        <ProgramacionTurnos />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModuloAsistencia;
