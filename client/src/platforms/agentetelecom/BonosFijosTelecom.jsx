import React, { useState, useEffect } from 'react';
import { DollarSign, Search, Filter, Loader2, Save, FileSpreadsheet, Activity } from 'lucide-react';
import { telecomApi as api } from './telecomApi';

const BonosFijosTelecom = () => {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    
    const [loading, setLoading] = useState(false);
    const [fijosModels, setFijosModels] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [bonuses, setBonuses] = useState({}); // { workerId_modelId: amount }
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Get active models and filter BONO_FIJO
            const modelRes = await api.get('/admin/bonos/active');
            const activeModels = Array.isArray(modelRes.data) ? modelRes.data : [modelRes.data];
            const fijos = activeModels.filter(m => m && m.tipo === 'BONO_FIJO');
            setFijosModels(fijos);

            // 2. Get workers for this month
            const workersRes = await api.get(`/rrhh/candidatos/remuneraciones/fijos?year=${year}&month=${month}`);
            const fetchedWorkers = workersRes.data || [];
            setWorkers(fetchedWorkers);

            // 3. Pre-fill bonuses dict
            const initialBonuses = {};
            fetchedWorkers.forEach(w => {
                fijos.forEach(m => {
                    const key = `${w._id}_${m._id}`;
                    // Default amount based on the model. If it has a fixed amount, use it.
                    const defaultAmount = m.bonoFijo?.monto || 0;
                    initialBonuses[key] = defaultAmount;
                });
            });
            setBonuses(initialBonuses);

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, [month, year]);

    const handleBonusChange = (workerId, modelId, value) => {
        setBonuses(prev => ({
            ...prev,
            [`${workerId}_${modelId}`]: parseFloat(value) || 0
        }));
    };

    const isFiniquitadoDelMes = (worker) => {
        if (worker.status !== 'Finiquitado') return false;
        if (!worker.hiring?.endDate) return false;
        const endDate = new Date(worker.hiring.endDate);
        return endDate.getMonth() + 1 === month && endDate.getFullYear() === year;
    };

    const filteredWorkers = workers.filter(w => {
        const term = searchTerm.toLowerCase();
        return (w.rut?.toLowerCase().includes(term) || w.fullName?.toLowerCase().includes(term));
    });

    return (
        <div className="max-w-[1400px] mx-auto px-6 pt-6 animate-in slide-in-from-right duration-500 pb-32">
            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl shadow-lg bg-emerald-500 shadow-emerald-100">
                            <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Bonos Fijos Telecom</h1>
                    </div>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                        Asignación de Bonos Fijos configurados en Modelos de Bonificación
                    </p>
                </div>

                {/* ── FILTROS FECHA ── */}
                <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1">Mes</label>
                        <select 
                            className="bg-slate-50 border-none text-sm font-semibold text-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            value={month} 
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            disabled={loading}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('es', { month: 'long' }).toUpperCase()}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1">Año</label>
                        <select 
                            className="bg-slate-50 border-none text-sm font-semibold text-slate-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            value={year} 
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            disabled={loading}
                        >
                            {[...Array(5)].map((_, i) => {
                                const y = today.getFullYear() - i;
                                return <option key={y} value={y}>{y}</option>;
                            })}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Cruzando trabajadores y modelos fijos...</p>
                </div>
            ) : fijosModels.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-12 text-center">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Activity size={40} strokeWidth={2} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No hay Bonos Fijos Activos</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                        Actualmente no hay ningún modelo de tipo "BONO_FIJO" activado en el Módulo de Modelos de Bonificación.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar por RUT o Nombre..."
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                                <FileSpreadsheet className="w-4 h-4" /> Exportar
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200">
                                <Save className="w-4 h-4" /> Guardar Cambios
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Trabajador</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">ID TOA</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Estado</th>
                                    {fijosModels.map(m => (
                                        <th key={m._id} className="px-6 py-4 text-[10px] font-black text-emerald-600 uppercase tracking-wider text-right bg-emerald-50/30">
                                            {m.nombre}
                                        </th>
                                    ))}
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Total Fijo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredWorkers.map(w => {
                                    const isFiniquitado = isFiniquitadoDelMes(w);
                                    let rowTotal = 0;
                                    
                                    return (
                                        <tr key={w._id} className={`hover:bg-slate-50/50 transition-colors ${isFiniquitado ? 'bg-orange-50/30' : ''}`}>
                                            <td className="px-6 py-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-black text-slate-800 tracking-tight block leading-tight">{w.fullName}</span>
                                                        {isFiniquitado && (
                                                            <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-700 uppercase tracking-widest">
                                                                Finiquito del Mes
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block font-mono">
                                                        RUT: {w.rut}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{w.idRecursoToa || 'N/A'}</span>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                                    w.status === 'Contratado' ? 'bg-emerald-100 text-emerald-700' :
                                                    w.status === 'Activo en Terreno' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {w.status}
                                                </span>
                                            </td>
                                            {fijosModels.map(m => {
                                                const key = `${w._id}_${m._id}`;
                                                const val = bonuses[key] ?? 0;
                                                rowTotal += val;
                                                return (
                                                    <td key={key} className="px-6 py-3 text-right bg-emerald-50/10">
                                                        <div className="relative inline-block w-28">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                                                            <input 
                                                                type="number"
                                                                value={val}
                                                                onChange={(e) => handleBonusChange(w._id, m._id, e.target.value)}
                                                                className={`w-full pl-6 pr-3 py-1.5 text-right text-sm font-bold rounded-lg border ${
                                                                    isFiniquitado ? 'border-orange-200 bg-orange-50 text-orange-900 focus:ring-orange-500/20' : 
                                                                    'border-slate-200 bg-white text-slate-700 focus:ring-emerald-500/20'
                                                                } focus:outline-none focus:ring-2`}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-3 text-right">
                                                <span className="text-sm font-black text-emerald-600">
                                                    ${Math.round(rowTotal).toLocaleString('es-CL')}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredWorkers.length === 0 && (
                                    <tr>
                                        <td colSpan={5 + fijosModels.length} className="px-6 py-8 text-center text-slate-500">
                                            No se encontraron trabajadores que coincidan con la búsqueda o filtros.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BonosFijosTelecom;
