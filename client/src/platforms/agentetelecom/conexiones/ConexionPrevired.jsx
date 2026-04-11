import React from 'react';
import {
    ShieldCheck, TrendingUp, Scale, Activity,
    RefreshCcw, AlertCircle, Bookmark, HeartPulse,
    Users, Building, DollarSign,
    Wifi, WifiOff
} from 'lucide-react';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

// Tasa FONASA legal
const FONASA_RATE = 7.00;

// Tasas AFC — constantes legales (Ley 19.728)
const AFC_RATES = {
    trabajador_indefinido: 0.60,
    empleador_indefinido: 2.40,
    trabajador_fijo: 3.00,
    empleador_fijo: 3.00,
};

// Comisiones AFP 2026
const AFP_2026 = {
    'CAPITAL': { comision: 1.44, total: 11.44 },
    'CUPRUM': { comision: 1.44, total: 11.44 },
    'HABITAT': { comision: 1.27, total: 11.27 },
    'PLANVITAL': { comision: 1.16, total: 11.16 },
    'PROVIDA': { comision: 1.45, total: 11.45 },
    'MODELO': { comision: 0.58, total: 10.58 },
    'UNO': { comision: 0.46, total: 10.46 },
};

const TOPE_AFP_UF = 89.9;
const TOPE_AFC_UF = 135.1;
const SIS_RATE = 1.54;

const IndicatorCard = ({ title, value, unit, valueCLP, icon: Icon, color, footer }) => {
    const colors = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', icon: 'bg-indigo-600' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', icon: 'bg-emerald-600' },
        rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', icon: 'bg-rose-600' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', icon: 'bg-amber-500' },
    };
    const c = colors[color] || colors.indigo;
    return (
        <div className={`${c.bg} rounded-3xl p-5 border ${c.border} hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden shadow-sm`}>
            <div className="flex items-center gap-3 mb-3">
                <div className={`${c.icon} p-2 rounded-xl`}><Icon size={16} className="text-white" /></div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{title}</p>
            </div>
            <div className="flex items-baseline gap-1">
                <p className="text-2xl font-black text-slate-900">{value}</p>
                {unit && <p className="text-xs font-bold text-slate-400">{unit}</p>}
            </div>
            {valueCLP && <p className="text-[9px] font-bold text-slate-500 mt-0.5">≈ {valueCLP} CLP</p>}
            <p className={`text-[8px] font-black uppercase tracking-widest mt-3 ${c.text}`}>{footer}</p>
        </div>
    );
};

const ConexionPrevired = () => {
    const { ufValue: uf, status, loading, refetch } = useIndicadores();

    const topeAfpCLP = uf ? Math.round(TOPE_AFP_UF * uf).toLocaleString('es-CL') : '—';
    const topeAfcCLP = uf ? Math.round(TOPE_AFC_UF * uf).toLocaleString('es-CL') : '—';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-900 to-teal-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="flex items-center gap-4 z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <ShieldCheck size={28} className="text-emerald-300" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase tracking-tight">Previred — Indicadores Previsionales</h3>
                        <p className="text-slate-300 text-xs mt-0.5">AFP · AFC · SIS · Topes · IMM — Vigentes 2026</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 z-10">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider ${status === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border-red-500/30 text-red-300'}`}>
                        {status === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {status === 'ok' ? `UF: $${(uf || 0).toLocaleString('es-CL')}` : 'Error conexión'}
                    </div>
                    <button onClick={refetch} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                        <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Sync…' : 'Forzar Sync'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center animate-pulse">
                        <ShieldCheck size={28} className="text-emerald-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando indicadores previsionales…</p>
                </div>
            ) : (
                <>
                    {/* Topes y parámetros clave */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                        <IndicatorCard title="Tope Imponible AFP/Salud" value={TOPE_AFP_UF} unit="UF" valueCLP={`$${topeAfpCLP}`} icon={TrendingUp} color="indigo" footer="Sup. Pensiones 2026" />
                        <IndicatorCard title="Tope Imponible AFC" value={TOPE_AFC_UF} unit="UF" valueCLP={`$${topeAfcCLP}`} icon={Scale} color="emerald" footer="AFC Chile 2026" />
                        <IndicatorCard title="SIS (Seg. Invalidez)" value={`${SIS_RATE}%`} unit="" icon={HeartPulse} color="rose" footer="Cargo empleador · Ene 2026" />
                        <IndicatorCard title="Ingreso Mínimo Mensual" value="$539.000" unit="" icon={DollarSign} color="amber" footer="Ley N°21.751 vigente 2026" />
                    </div>

                    {/* Tabla AFP */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Building size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-tight">Tasas AFP Vigentes 2026</h3>
                                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">10% legal + comisión de cada administradora (Sup. de Pensiones)</p>
                                </div>
                            </div>
                            <div className={`px-5 py-3 rounded-2xl border flex items-center gap-2 ${status === 'ok' ? 'bg-white border-slate-100' : 'bg-amber-50 border-amber-200'}`}>
                                <div className={`w-2 h-2 rounded-full ${status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                    {status === 'ok' ? 'Vigentes Feb 2026' : 'Sin conexión — fallback'}
                                </p>
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                            {Object.entries(AFP_2026).map(([name, d]) => (
                                <div key={name} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-indigo-400 truncate">AFP {name}</p>
                                    <div className="flex items-baseline gap-0.5">
                                        <p className="text-xl font-black text-slate-900">{d.total}%</p>
                                        <p className="text-[9px] font-bold text-slate-400">Tot.</p>
                                    </div>
                                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-1">
                                        <div>
                                            <p className="text-[7px] text-slate-400 uppercase font-bold">Legal</p>
                                            <p className="text-[9px] font-black text-slate-600">10.00%</p>
                                        </div>
                                        <div>
                                            <p className="text-[7px] text-slate-400 uppercase font-bold">Comis.</p>
                                            <p className="text-[9px] font-black text-indigo-600">{d.comision}%</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* AFC + Salud + Nota */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                            <Users className="absolute -right-6 -bottom-6 w-32 h-32 text-white/5" />
                            <h4 className="font-black uppercase text-sm mb-4 flex items-center gap-2">
                                <Activity size={16} className="text-emerald-400" /> Otros Aportes Legales
                            </h4>
                            <div className="space-y-3 relative z-10">
                                {[
                                    { label: 'FONASA', sub: 'Cotización Legal (Art. 84)', val: `${FONASA_RATE}%` },
                                    { label: 'Mutualidad (ACHS/IST)', sub: 'Tasa base — Cargo Empleador (D.S. N°67)', val: '0.90%' },
                                    { label: 'AFC Empleador — Indefinido', sub: 'Aporte Ley 19.728', val: `${AFC_RATES.empleador_indefinido}%` },
                                    { label: 'AFC Trabajador — Indefinido', sub: 'Descuento Ley 19.728', val: `${AFC_RATES.trabajador_indefinido}%` },
                                    { label: 'AFC Total — Plazo Fijo', sub: 'Cargo trabajador (sin aporte empleador)', val: `${AFC_RATES.trabajador_fijo}%` },
                                ].map(item => (
                                    <div key={item.label} className="flex justify-between items-start border-b border-white/10 pb-2.5">
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{item.label}</p>
                                            <p className="text-[10px] font-bold text-slate-300 mt-0.5">{item.sub}</p>
                                        </div>
                                        <p className="text-lg font-black">{item.val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                                    <AlertCircle size={18} className="text-amber-500" />
                                </div>
                                <h4 className="font-black uppercase text-slate-900 text-sm">Nota de Cumplimiento</h4>
                            </div>
                            <p className="text-xs text-slate-600 font-bold leading-relaxed mb-4">
                                Los indicadores mostrados son los mismos que GENAI360 utiliza para la generación del Libro de Remuneraciones y el cálculo de cotizaciones previsionales.
                            </p>
                            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-xs text-indigo-700 leading-relaxed mb-4">
                                <strong>Nota Técnica:</strong> Topes AFP/AFC, SIS y tasas son constantes anuales — no existen APIs diarias que los entreguen.
                                Lo que se actualiza en tiempo real es la <strong>UF</strong>, que convierte los topes de UF → CLP exactos para cada período.
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
                                <Bookmark size={18} />
                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-widest opacity-70">Certificación</p>
                                    <p className="text-[10px] font-black uppercase">Algoritmo validado según Previred 2026</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ConexionPrevired;
