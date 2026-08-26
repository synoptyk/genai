import React, { useState, useRef } from 'react';
import { CalendarDays, Scale, CalendarRange, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react';
import ProgramacionTurnos from './ProgramacionTurnos';
import AsistenciaLegal from './AsistenciaLegal';
import CalendarioAsistencia from './CalendarioAsistencia';

const TABS = [
    {
        id: 'legal',
        label: 'Asistencia Legal (DT)',
        icon: Scale,
        activeColor: '#4f46e5',
        activeShadow: '#a5b4fc',
    },
    {
        id: 'turnos',
        label: 'Creación de Turnos',
        icon: CalendarRange,
        activeColor: '#f97316',
        activeShadow: '#fdba74',
    },
    {
        id: 'calendario',
        label: 'Calendario Mensual',
        icon: LayoutGrid,
        activeColor: '#0891b2',
        activeShadow: '#67e8f9',
    },
];

const ModuloAsistencia = () => {
    const [activeTab, setActiveTab] = useState('legal');
    const tabsRef = useRef(null);

    const currentIndex = TABS.findIndex(t => t.id === activeTab);

    const goLeft = () => {
        if (currentIndex > 0) setActiveTab(TABS[currentIndex - 1].id);
    };
    const goRight = () => {
        if (currentIndex < TABS.length - 1) setActiveTab(TABS[currentIndex + 1].id);
    };

    const activeTabObj = TABS[currentIndex];

    return (
        <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-500">
            {/* Header del Súper-Módulo */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-4 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none"></div>
                <div className="space-y-1 relative z-10 flex items-center gap-4">
                    <span className="bg-white/20 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap">
                        RRHH
                    </span>
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 m-0">
                        <CalendarDays size={20} />
                        Asistencia y Turnos
                    </h2>
                </div>
            </div>

            {/* ── Navegación con flechas ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'white',
                borderRadius: 24,
                padding: '6px 8px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                border: '1px solid #f1f5f9',
                width: 'fit-content',
            }}>
                {/* Flecha izquierda */}
                <button
                    onClick={goLeft}
                    disabled={currentIndex === 0}
                    style={{
                        background: currentIndex === 0 ? '#f8fafc' : '#e0e7ff',
                        color: currentIndex === 0 ? '#cbd5e1' : '#4f46e5',
                        border: 'none',
                        borderRadius: 12,
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                    }}
                    title="Pestaña anterior"
                >
                    <ChevronLeft size={16} />
                </button>

                {/* Pestañas */}
                <div ref={tabsRef} style={{ display: 'flex', gap: 4 }}>
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 18px',
                                    borderRadius: 18,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.8,
                                    transition: 'all 0.2s',
                                    background: isActive ? tab.activeColor : 'transparent',
                                    color: isActive ? 'white' : '#94a3b8',
                                    boxShadow: isActive ? `0 4px 12px ${tab.activeShadow}80` : 'none',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = '#f8fafc';
                                        e.currentTarget.style.color = '#475569';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#94a3b8';
                                    }
                                }}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Flecha derecha */}
                <button
                    onClick={goRight}
                    disabled={currentIndex === TABS.length - 1}
                    style={{
                        background: currentIndex === TABS.length - 1 ? '#f8fafc' : '#e0e7ff',
                        color: currentIndex === TABS.length - 1 ? '#cbd5e1' : '#4f46e5',
                        border: 'none',
                        borderRadius: 12,
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: currentIndex === TABS.length - 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0,
                    }}
                    title="Siguiente pestaña"
                >
                    <ChevronRight size={16} />
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
                {activeTab === 'calendario' && (
                    <div className="absolute inset-0 flex flex-col overflow-hidden">
                        <CalendarioAsistencia />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModuloAsistencia;
