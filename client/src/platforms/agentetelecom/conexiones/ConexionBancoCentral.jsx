import React from 'react';
import {
    Landmark, TrendingUp, TrendingDown, Calendar, Activity,
    RefreshCcw, BarChart3, Clock, AlertCircle,
    Wifi, WifiOff
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

const COLOR_MAP = {
    indigo: { bg: 'bg-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-600', stop: '#4f46e5' },
    rose: { bg: 'bg-rose-600', light: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', stop: '#e11d48' },
    emerald: { bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', stop: '#10b981' },
    amber: { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', stop: '#f59e0b' },
};

// Mini spark generated from the current value ± noise
const mkSpark = (valor) => Array.from({ length: 7 }, (_, i) => ({
    d: i, v: valor * (1 + (Math.sin(i * 1.3) * 0.008))
}));

const IndicatorCard = ({ title, codigo, valor, fecha, prefix = '$', color = 'indigo' }) => {
    const c = COLOR_MAP[color];
    const spark = mkSpark(valor);
    return (
        <div className={`bg-white rounded-3xl p-6 border ${c.border} hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-lg`}>
            {/* glow blob */}
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full opacity-10 blur-2xl ${c.bg} group-hover:scale-150 transition-transform duration-500`} />
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{codigo}</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{title}</p>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-slate-900 tabular-nums">{prefix}{(valor || 0).toLocaleString('es-CL')}</p>
                    <p className="text-[9px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-1">
                        <Calendar size={9} /> {fecha ? new Date(fecha).toLocaleDateString('es-CL') : '—'}
                    </p>
                </div>
            </div>
            <div className="h-20 min-h-[80px] opacity-70 group-hover:opacity-100 transition-opacity mt-2">
                <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                    <AreaChart data={spark}>
                        <defs>
                            <linearGradient id={`g-${codigo}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={c.stop} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={c.stop} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="v" stroke={c.stop} strokeWidth={2} fill={`url(#g-${codigo})`} dot={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const ConexionBancoCentral = () => {
    const { indicadores, status, loading, lastSync, refetch } = useIndicadores();
    const { uf, utm, dolar, euro, ipc, tpm, libraCobre } = indicadores;
    const ind = {
        uf, utm, dolar, euro, ipc, tpm, libra_cobre: libraCobre,
        fecha: uf?.fecha,
    };

    return (
        <div className="space-y-6">
            {/* Status bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="flex items-center gap-4 z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <Activity size={28} className="text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase tracking-tight">Banco Central de Chile</h3>
                        <p className="text-slate-300 text-xs mt-0.5">API pública · mindicador.cl · Auto-sync cada 2h</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 z-10">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider ${status === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : status === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'bg-white/10 border-white/20 text-white/60'}`}>
                        {status === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {status === 'ok' ? 'Conectado' : status === 'error' ? 'Error' : 'Conectando…'}
                    </div>
                    {lastSync && <p className="text-[9px] text-slate-400 flex items-center gap-1"><Clock size={9} />{lastSync.toLocaleTimeString('es-CL')}</p>}
                    <button onClick={refetch} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                        <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Sync…' : 'Forzar Sync'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center animate-pulse">
                        <Landmark size={28} className="text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando con Banco Central…</p>
                </div>
            ) : status === 'error' ? (
                <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-3xl p-6">
                    <AlertCircle size={24} className="text-red-500 flex-shrink-0" />
                    <div>
                        <p className="font-black text-red-700">Sin conexión con mindicador.cl</p>
                        <p className="text-xs text-red-500 mt-0.5">Verifica conexión a internet o intenta nuevamente.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Indicadores principales */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                        <IndicatorCard title="Unidad de Fomento" codigo={ind?.uf?.codigo || 'UF'} valor={ind?.uf?.valor} fecha={ind?.uf?.fecha} color="indigo" />
                        <IndicatorCard title="Unidad Tributaria Mensual" codigo={ind?.utm?.codigo || 'UTM'} valor={ind?.utm?.valor} fecha={ind?.utm?.fecha} color="rose" />
                        <IndicatorCard title="Dólar Observado" codigo={ind?.dolar?.codigo || 'USD'} valor={ind?.dolar?.valor} fecha={ind?.dolar?.fecha} color="emerald" />
                        <IndicatorCard title="Euro" codigo={ind?.euro?.codigo || 'EUR'} valor={ind?.euro?.valor} fecha={ind?.euro?.fecha} prefix="€" color="amber" />
                    </div>

                    {/* Indicadores macro */}
                    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                            <BarChart3 size={18} className="text-slate-400" />
                            <h3 className="text-sm font-black uppercase text-slate-700 tracking-widest">Macroeconomía & Variables</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: ind?.tpm?.nombre || 'Tasa Política Monetaria', val: `${ind?.tpm?.valor || '—'}%`, sub: 'Anual · Banco Central', icon: Activity },
                                { label: ind?.ipc?.nombre || 'IPC Mensual', val: `${ind?.ipc?.valor || '—'}%`, sub: 'Índice Precios Consumidor', icon: TrendingUp },
                                { label: ind?.libra_cobre?.nombre || 'Libra de Cobre', val: `US$${ind?.libra_cobre?.valor || '—'}`, sub: 'Precio spot mercado', icon: TrendingDown },
                            ].map((item) => (
                                <div key={item.label} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <item.icon size={18} className="text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                                        <p className="text-2xl font-black text-slate-900 mt-0.5">{item.val}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1">{item.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[9px] font-bold text-amber-700 leading-relaxed">
                                Datos obtenidos desde la API pública <strong>mindicador.cl</strong> en tiempo real.
                                Los valores de UF y UTM alimentan directamente el motor de cálculo de Nómina, Finiquitos y Cotizaciones de Gen AI.
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ConexionBancoCentral;
