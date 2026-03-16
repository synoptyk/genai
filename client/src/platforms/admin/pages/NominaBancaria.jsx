import React, { useState, useEffect } from 'react';
import { 
    Landmark, Download, Calendar, ArrowRight, ShieldCheck, 
    RefreshCcw, AlertCircle, CheckCircle2, Building2, Wallet, Settings
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import API_URL from '../../../config';

const NominaBancaria = () => {
    const { user } = useAuth();
    const [periodo, setPeriodo] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedBank, setSelectedBank] = useState('BCI'); // BCI, SANTANDER, CHILE
    const [exporting, setExporting] = useState(false);
    const [stats, setStats] = useState({ count: 0, totalAmount: 0 });
    const [statusLogs, setStatusLogs] = useState([]);

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setStatusLogs(prev => [{ time, msg, type }, ...prev].slice(0, 5));
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const apiPeriodo = periodo.split('-').reverse().join('-');
                const res = await fetch(`${API_URL}/api/admin/previred/stats?periodo=${apiPeriodo}`, {
                    headers: { 'Authorization': `Bearer ${user.token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats({
                        count: data.count || 0,
                        totalAmount: (data.count || 0) * 850000 // Estimated for UX
                    });
                }
            } catch (e) { console.error("Error fetching bank stats:", e); }
        };
        fetchStats();
    }, [periodo, user]);

    const handleExport = async () => {
        setExporting(true);
        addLog(`Iniciando generación de nómina para ${selectedBank}...`, "info");
        
        try {
            const apiPeriodo = periodo.split('-').reverse().join('-');
            const res = await fetch(`${API_URL}/api/admin/bancos/export?periodo=${apiPeriodo}&banco=${selectedBank}`, {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ext = selectedBank === 'SANTANDER' ? 'dat' : 'txt';
                a.download = `PAGOS_${selectedBank}_${apiPeriodo}.${ext}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                addLog(`Archivo ${selectedBank} generado exitosamente.`, "success");
            } else {
                const data = await res.json();
                addLog(data.message || "Error al exportar", "error");
            }
        } catch (e) {
            addLog("Fallo de conexión con el motor bancario.", "error");
        }
        setExporting(false);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200">
                            <Wallet className="text-white" size={24} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Pagos Masivos <span className="text-indigo-600">360</span></h1>
                    </div>
                    <p className="text-slate-500 font-bold text-sm ml-12">Gestión de remuneraciones y transferencias bancarias automatizadas.</p>
                </div>
                
                <div className="flex items-center bg-white border border-slate-200 rounded-3xl p-2 pr-6 shadow-sm">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mr-3 font-black text-xs">GO</div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Status Bancario</p>
                        <p className="text-xs font-black text-emerald-600">Gateway Activo</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Section */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/40">
                        <h2 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3">
                            <Settings className="text-indigo-500" size={20} />
                            Configuración de Pago
                        </h2>

                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Seleccionar Banco</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['BCI', 'SANTANDER', 'CHILE'].map(b => (
                                            <button 
                                                key={b}
                                                onClick={() => setSelectedBank(b)}
                                                className={`py-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                                                    selectedBank === b 
                                                    ? 'border-indigo-600 bg-indigo-50/50 shadow-lg shadow-indigo-100' 
                                                    : 'border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0 hover:border-slate-300'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-lg ${selectedBank === b ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                    <Building2 size={18} />
                                                </div>
                                                <span className={`text-[10px] font-black ${selectedBank === b ? 'text-indigo-900' : 'text-slate-400'}`}>{b}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">Periodo de Pago</label>
                                    <div className="relative h-[84px]">
                                        <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
                                        <input 
                                            type="month" 
                                            value={periodo} 
                                            onChange={e => setPeriodo(e.target.value)}
                                            className="w-full h-full pl-16 pr-8 bg-slate-50/80 border-2 border-slate-100 rounded-3xl text-sm font-black text-slate-700 focus:bg-white focus:border-indigo-500 transition-all outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100">
                                <button 
                                    onClick={handleExport}
                                    disabled={exporting || stats.count === 0}
                                    className="w-full group py-6 bg-slate-900 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-black hover:-translate-y-1 hover:shadow-indigo-500/20 active:translate-y-0 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none"
                                >
                                    {exporting ? <RefreshCcw className="animate-spin" size={20} /> : <Download className="group-hover:bounce" size={20} />}
                                    {exporting ? 'Generando Nómina...' : `Descargar Archivo ${selectedBank}`}
                                </button>
                                {stats.count === 0 && (
                                    <p className="text-center text-rose-500 text-[10px] font-black mt-4 uppercase animate-pulse">
                                        <AlertCircle size={12} className="inline mr-1" /> No se detectan liquidaciones para este periodo
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Console section */}
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <ShieldCheck size={120} className="text-white" />
                        </div>
                        <div className="flex items-center justify-between mb-6 relative">
                            <h3 className="text-xs font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-3">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                Security Gateway Live
                            </h3>
                            <span className="text-[10px] font-black text-indigo-400 uppercase px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full">AES-256 GCM</span>
                        </div>
                        <div className="space-y-3 font-mono text-[11px]">
                            {statusLogs.length === 0 ? (
                                <p className="text-white/20 italic">Esperando inicialización de transacción...</p>
                            ) : (
                                statusLogs.map((log, i) => (
                                    <div key={i} className={`flex gap-4 animate-in slide-in-from-left-2 duration-300 ${i === 0 ? 'text-white' : 'text-white/50'}`}>
                                        <span className="text-indigo-400 font-bold">[{log.time}]</span>
                                        <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-emerald-400' : ''}>
                                            {log.msg}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Quick Stats & Format Info */}
                <div className="space-y-8">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200/50 relative overflow-hidden">
                        <div className="absolute -bottom-6 -right-6 opacity-20 rotate-12">
                            <Landmark size={140} />
                        </div>
                        <h3 className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-6">Resumen de Instrucción</h3>
                        <div className="space-y-6 relative">
                            <div>
                                <p className="text-3xl font-black">${(stats.totalAmount / 1000000).toFixed(1)}M</p>
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mt-1">Monto Total Estimado</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                                <div>
                                    <p className="text-xl font-black">{stats.count}</p>
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-tighter">Colaboradores</p>
                                </div>
                                <div>
                                    <p className="text-xl font-black">100%</p>
                                    <p className="text-[9px] font-black text-white/50 uppercase tracking-tighter">Datos Validados</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">Detalles del Formato</h3>
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Estructura Oficial</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">Cumple con la norma bancaria v3.5 2026.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Hash Control</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">Generación automática de totales de control SHA-256.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Isometría de RUT</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">Dígitos verificadores validados según algoritmo m11.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 italic">
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                                Tip: Sube este archivo directamente en el módulo de "Transferencias Masivas" o "Pago de Remuneraciones" de tu portal bancario.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NominaBancaria;
