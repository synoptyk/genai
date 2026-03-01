import React, { useState } from 'react';
import {
    CheckCircle2, ChevronRight, Wifi, RefreshCcw, Clock,
    FileText, Landmark, ShieldCheck, Activity, Plug
} from 'lucide-react';
import ConexionBancoCentral from './conexiones/ConexionBancoCentral';
import ConexionSII from './conexiones/ConexionSII';
import ConexionPrevired from './conexiones/ConexionPrevired';
import { useIndicadores } from '../../contexts/IndicadoresContext';

// ─── Componente Interno: Conexión DT (MOCK UI) ────────────────────────────────
const ConexionDT = () => (
    <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Portal Dirección del Trabajo (MiDT)</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Sincronización directa para la carga masiva del <strong>Libro de Remuneraciones Electrónico (LRE)</strong>.
            Asegura el cumplimiento del Art. 62 bis del Código del Trabajo.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado LRE</p>
                <p className="text-xs font-black text-emerald-600 uppercase">Período Feb 2026 Generado</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Carga Masiva</p>
                <p className="text-xs font-black text-slate-700 uppercase italic">Archivo CSV Listo</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Certificado DT</p>
                <p className="text-xs font-black text-slate-700 uppercase">Vigente 2026</p>
            </div>
        </div>
        <button className="px-8 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-rose-100">
            Ir a Portal MiDT
        </button>
    </div>
);

const TABS = [
    {
        id: 'banco',
        label: 'Banco Central',
        icon: Landmark,
        color: 'indigo',
        desc: 'UF · UTM · Dólar · Euro · IPC · TPM',
        source: 'mindicador.cl',
        component: ConexionBancoCentral,
    },
    {
        id: 'sii',
        label: 'SII',
        icon: ShieldCheck,
        color: 'blue',
        desc: 'Tabla Impuesto Único 2ª Cat. · UTM en tiempo real',
        source: 'mindicador.cl / Art. 43 N°1',
        component: ConexionSII,
    },
    {
        id: 'previred',
        label: 'Previred',
        icon: Activity,
        color: 'emerald',
        desc: 'AFP · AFC · Topes · SIS · IMM · Fonasa',
        source: 'Sup. Pensiones 2026',
        component: ConexionPrevired,
    },
    {
        id: 'dt',
        label: 'DT Chile',
        icon: FileText,
        color: 'rose',
        desc: 'Libro de Remuneraciones Electrónico (LRE) · Portal MiDT',
        source: 'Dirección del Trabajo',
        component: ConexionDT,
    },
];

const COLOR = {
    indigo: { tab: 'bg-indigo-600 text-white shadow-indigo-200', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    blue: { tab: 'bg-blue-700 text-white shadow-blue-200', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
    emerald: { tab: 'bg-emerald-600 text-white shadow-emerald-200', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rose: { tab: 'bg-rose-600 text-white shadow-rose-200', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const Conexiones = () => {
    const [active, setActive] = useState('banco');
    const ActiveComponent = TABS.find(t => t.id === active)?.component || ConexionBancoCentral;
    const { ufValue, utmValue, usdValue, status, loading, lastSync, refetch } = useIndicadores();

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            {/* ── Header ── */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-3 rounded-2xl shadow-lg shadow-slate-400/20">
                        <Plug size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                            Conexiones <span className="text-indigo-600">&amp; Plataformas</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                            Sincronización con organismos oficiales del Estado de Chile
                        </p>
                    </div>
                </div>
                <button onClick={refetch} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-wider hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50 shadow-sm">
                    <RefreshCcw size={13} className={loading ? 'animate-spin text-indigo-500' : ''} />
                    {loading ? 'Sincronizando…' : 'Forzar Sync Global'}
                </button>
            </div>

            {/* ── Status Global Bar ── */}
            <div className={`flex items-center gap-4 px-5 py-3 rounded-2xl border mb-5 ${status === 'ok' ? 'bg-emerald-50 border-emerald-100' : status === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status === 'ok' ? 'bg-emerald-500 animate-pulse' : status === 'error' ? 'bg-red-500' : 'bg-amber-400 animate-pulse'}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${status === 'ok' ? 'text-emerald-700' : status === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                    {status === 'ok' ? 'Todos los sistemas conectados' : status === 'error' ? 'Error de conexión — usando valores en caché' : 'Conectando con Banco Central…'}
                </span>
                {status === 'ok' && (
                    <div className="flex items-center gap-4 ml-auto text-[9px] font-bold text-slate-500">
                        <span>UF: <strong className="text-slate-700">${(ufValue || 0).toLocaleString('es-CL')}</strong></span>
                        <span>UTM: <strong className="text-slate-700">${(utmValue || 0).toLocaleString('es-CL')}</strong></span>
                        {usdValue && <span>USD: <strong className="text-slate-700">${usdValue.toLocaleString('es-CL')}</strong></span>}
                        {lastSync && <span className="flex items-center gap-1"><Clock size={9} />{lastSync.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                )}
            </div>

            {/* ── Platform Cards ── */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {TABS.map(t => {
                    const c = COLOR[t.color];
                    const isActive = active === t.id;
                    return (
                        <button key={t.id} onClick={() => setActive(t.id)}
                            className={`text-left p-5 rounded-3xl border transition-all duration-200 group
                                ${isActive
                                    ? `bg-white border-slate-200 shadow-lg`
                                    : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md'}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2.5 rounded-2xl shadow-md ${isActive ? c.tab : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                    <t.icon size={18} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider">Live</span>
                                </div>
                            </div>
                            <p className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>{t.label}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-1">{t.desc}</p>
                            <div className="mt-3 flex items-center justify-between">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${c.pill}`}>
                                    <Wifi size={8} className="inline mr-1" />
                                    {t.source}
                                </span>
                                {isActive && <ChevronRight size={14} className="text-slate-400" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Active Module ── */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <ActiveComponent />
            </div>
        </div>
    );
};


export default Conexiones;
