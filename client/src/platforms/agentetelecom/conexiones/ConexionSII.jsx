import React from 'react';
import {
    ShieldCheck, Calculator, Scale, Calendar,
    RefreshCcw, AlertCircle, Bookmark, CheckCircle2, XCircle,
    Wifi, WifiOff, BookOpen
} from 'lucide-react';
import { useIndicadores } from '../../../contexts/IndicadoresContext';

// Tramos Impuesto Único 2ª Categoría — Art. 43 N°1 Ley de la Renta
// Constantes legales: solo cambian por ley del Congreso.
// Lo que varía mensualmente es el valor de la UTM.
const TRAMOS = [
    { desde: 0, hasta: 13.5, tasa: 0.000, rebaja: 0.000, label: 'Exento' },
    { desde: 13.5, hasta: 30, tasa: 0.040, rebaja: 0.540 },
    { desde: 30, hasta: 50, tasa: 0.080, rebaja: 1.740 },
    { desde: 50, hasta: 70, tasa: 0.135, rebaja: 4.490 },
    { desde: 70, hasta: 90, tasa: 0.230, rebaja: 11.140 },
    { desde: 90, hasta: 120, tasa: 0.304, rebaja: 17.800 },
    { desde: 120, hasta: 310, tasa: 0.350, rebaja: 23.320 },
    { desde: 310, hasta: Infinity, tasa: 0.400, rebaja: 38.820 },
];

const TaxRow = ({ t, utmValue, idx }) => {
    const desdeCLP = Math.round(t.desde * utmValue).toLocaleString('es-CL');
    const hastaCLP = t.hasta === Infinity ? null : Math.round(t.hasta * utmValue).toLocaleString('es-CL');
    const isExento = t.tasa === 0;
    return (
        <div className={`p-4 rounded-2xl border transition-all hover:shadow-md ${isExento ? 'bg-emerald-50 border-emerald-100' : idx % 2 === 0 ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100'}`}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tramo {idx + 1}</p>
                    <p className="text-xs font-bold text-slate-600 mt-0.5">
                        {t.desde} – {t.hasta === Infinity ? '∞' : t.hasta} UTM
                    </p>
                    {utmValue > 0 && (
                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                            ${desdeCLP} – {hastaCLP ? `$${hastaCLP}` : 'Sin límite'}
                        </p>
                    )}
                </div>
                <p className={`text-xl font-black ${isExento ? 'text-emerald-600' : 'text-indigo-700'}`}>
                    {t.label || `${(t.tasa * 100).toFixed(1)}%`}
                </p>
            </div>
            <div className="pt-2.5 border-t border-slate-100 flex justify-between">
                <div>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">A Rebajar</p>
                    <p className="text-[10px] font-black text-slate-700">{t.rebaja.toFixed(3)} UTM</p>
                </div>
                {utmValue > 0 && (
                    <div className="text-right">
                        <p className="text-[7px] font-bold text-slate-400 uppercase">En CLP</p>
                        <p className="text-[10px] font-black text-slate-700">${Math.round(t.rebaja * utmValue).toLocaleString('es-CL')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ConexionSII = () => {
    const { indicadores, status, loading, refetch } = useIndicadores();
    const utmData = indicadores.utm;
    const utm = utmData?.valor || 0;
    const uta = utm * 12;

    const getTodayStr = () => {
        const n = new Date();
        return `${String(n.getDate()).padStart(2, '0')}-${String(n.getMonth() + 1).padStart(2, '0')}-${n.getFullYear()}`;
    };

    return (
        <div className="space-y-6">
            {/* Header status */}
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
                <div className="flex items-center gap-4 z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <ShieldCheck size={28} className="text-blue-300" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg uppercase tracking-tight">SII — Serv. Impuestos Internos</h3>
                        <p className="text-slate-300 text-xs mt-0.5">Tabla IUSC · UTM en tiempo real · Art. 43 N°1 Ley de la Renta</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 z-10">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider ${status === 'ok' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-red-500/20 border-red-500/30 text-red-300'}`}>
                        {status === 'ok' ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {status === 'ok' ? `UTM al día ${getTodayStr()}` : 'Error conexión'}
                    </div>
                    <button onClick={refetch} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
                        <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} /> {loading ? 'Sync…' : 'Forzar Sync'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center animate-pulse">
                        <ShieldCheck size={28} className="text-blue-400" />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando UTM vigente…</p>
                </div>
            ) : (
                <>
                    {/* UTM / UTA Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl col-span-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-300 mb-2">UTM Vigente (Mensual)</p>
                            <p className="text-4xl font-black tabular-nums">${utm.toLocaleString('es-CL')}</p>
                            <p className="text-[9px] font-bold text-blue-400 mt-4 flex items-center gap-2">
                                <Calendar size={11} />
                                {utmData?.fecha ? new Date(utmData.fecha).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }) : 'Fuente: mindicador.cl'}
                            </p>
                        </div>
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                            <Bookmark className="absolute -right-4 -bottom-4 w-24 h-24 text-slate-50" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">UTA (Anual = 12 UTM)</p>
                            <p className="text-4xl font-black text-slate-900 tabular-nums">${uta.toLocaleString('es-CL')}</p>
                            <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-widest">Base cálculo renta anual</p>
                        </div>
                        <div className={`rounded-3xl p-6 border shadow-sm ${status === 'ok' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                            <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>Estado Conexión</p>
                            <div className="flex items-center gap-3">
                                {status === 'ok' ? <CheckCircle2 size={28} className="text-emerald-500" /> : <XCircle size={28} className="text-red-500" />}
                                <p className={`text-2xl font-black uppercase ${status === 'ok' ? 'text-emerald-900' : 'text-red-900'}`}>{status === 'ok' ? 'Online' : 'Error'}</p>
                            </div>
                            <p className={`text-[9px] font-black mt-4 uppercase tracking-widest ${status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {status === 'ok' ? 'mindicador.cl → SII OK' : 'Usando valores en caché'}
                            </p>
                        </div>
                    </div>

                    {/* Tabla IUSC */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Calculator size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-tight">Tabla Impuesto Único — 2ª Categoría</h3>
                                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">Art. 43 N°1 Ley de la Renta · Tramos en UTM convertidos a CLP en tiempo real</p>
                                </div>
                            </div>
                            <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl text-right">
                                <p className="text-[8px] font-black uppercase tracking-widest opacity-70">UTM hoy</p>
                                <p className="text-lg font-black tabular-nums">${utm.toLocaleString('es-CL')}</p>
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            {TRAMOS.map((t, i) => <TaxRow key={i} t={t} utmValue={utm} idx={i} />)}
                        </div>
                        <div className="px-6 pb-6">
                            <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                <AlertCircle size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold text-blue-800 leading-relaxed">
                                    Los <strong>factores y rebajas</strong> son constantes de ley (Art. 43 N°1) y no cambian por API.
                                    Lo que se actualiza en tiempo real es el <strong>valor de la UTM</strong>, que transforma estos tramos en pesos exactos para cada mes.
                                    GENAI360 obtiene la UTM por fecha exacta desde mindicador.cl para que el cálculo del Impuesto Único sea milimétrico.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Cumplimiento */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                            <Scale className="absolute -right-6 -bottom-6 w-32 h-32 text-white/5" />
                            <h4 className="font-black uppercase mb-4 flex items-center gap-2 text-sm"><Scale size={16} className="text-blue-400" /> Cumplimiento SII</h4>
                            <ul className="space-y-3 z-10 relative">
                                {['Calce perfecto con Libro de Remuneraciones Electrónico (LRE)', 'Reportabilidad de retenciones (Formulario 29)', 'Preparado para Declaración Jurada 1887 (rentas del trabajo)'].map(item => (
                                    <li key={item} className="flex items-start gap-2.5 text-xs font-bold text-slate-300">
                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" /> {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                            <h4 className="font-black uppercase mb-4 text-slate-900 flex items-center gap-2 text-sm"><BookOpen size={16} className="text-indigo-600" /> Glosario Técnico</h4>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Impuesto Único 2ª Categoría</p>
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed mt-0.5">Grava rentas del trabajo dependiente. Base = Bruto Imponible − Cotizaciones Previsionales.</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">UTM vs UTA</p>
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed mt-0.5">UTM se actualiza cada mes. UTA (Anual) = 12 UTM del año en curso.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ConexionSII;
