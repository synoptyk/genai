import React, { useState, useEffect } from 'react';
import {
    Users, Landmark, RefreshCw, Search, Building2, MapPin, 
    Calculator, DollarSign, TrendingUp, UserCheck, UserX,
    Filter, Download, ChevronRight, Briefcase, Plus, AlertCircle,
    ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import { formatRut } from '../../../utils/rutUtils';
import * as XLSX from 'xlsx';

// ── REUSABLE TIPOS_BONOS (Must match Proyectos.jsx and CapturaTalento.jsx) ──
const TIPOS_BONOS = [
    { type: 'Sueldo Base',                       codigoDT: '1010', isImponible: true,  category: 'BASE' },
    { type: 'Sobresueldo (Horas Extra)',          codigoDT: '1020', isImponible: true,  category: 'BASE' },
    { type: 'Gratificación Legal (Mensual)',     codigoDT: '1050', isImponible: true,  category: 'GRATIFICACIÓN' },
    { type: 'Comisiones y Ventas',                  codigoDT: '1030', isImponible: true,  category: 'VARIABLE' },
    { type: 'Bono de Metas / Productividad',    codigoDT: '1030', isImponible: true,  category: 'VARIABLE' },
    { type: 'Bono de Asistencia Plena',            codigoDT: '1041', isImponible: true,  category: 'ASISTENCIA' },
    { type: 'Asignación de Colación',            codigoDT: '2030', isImponible: false, category: 'NO IMPONIBLE' },
    { type: 'Asignación de Movilización',        codigoDT: '2020', isImponible: false, category: 'NO IMPONIBLE' },
    { type: 'Viático / Terreno',                 codigoDT: '2010', isImponible: false, category: 'NO IMPONIBLE' },
];

const RemuCentral = () => {
    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterStatus, setFilterStatus] = useState('Activo'); // Default to active personnel

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Fetch all candidates to include Exited (Finiquitado/Retirado)
            const [candRes, projRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
            ]);
            
            const allCands = candRes.data || [];
            const projs = projRes.data || [];
            
            const processed = allCands.map(emp => {
                const proj = projs.find(p => p._id === (emp.projectId?._id || emp.projectId));
                
                // Remuneration structure from candidate record (centralized by Projects)
                const base = emp.sueldoBase || 0;
                const bonuses = emp.bonuses || [];
                
                const totalImponibles = bonuses
                    .filter(b => b.isImponible)
                    .reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
                
                const totalNoImponibles = bonuses
                    .filter(b => !b.isImponible)
                    .reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
                
                const totalHaberes = base + totalImponibles + totalNoImponibles;

                return {
                    ...emp,
                    projectName: proj?.nombreProyecto || 'N/A',
                    ceco: proj?.centroCosto || emp.ceco || 'N/A',
                    totalImponibles,
                    totalNoImponibles,
                    totalHaberes,
                    base
                };
            });
            
            setEmployees(processed);
            setProyectos(projs);
        } catch (e) {
            console.error('Error fetching RemuCentral data:', e);
        } finally {
            setLoading(false);
        }
    };

    const cecos = [...new Set(employees.map(e => e.ceco).filter(c => c && c !== 'N/A'))];

    const filtered = employees.filter(e => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
            e.fullName?.toLowerCase().includes(term) || 
            e.rut?.includes(term) || 
            e.position?.toLowerCase().includes(term);
        
        const matchesCeco = !filterCeco || e.ceco === filterCeco;
        const matchesStatus = filterStatus === 'Todos' || 
            (filterStatus === 'Activo' && e.status === 'Contratado') || 
            (filterStatus === 'Fis/Ret' && ['Finiquitado', 'Retirado'].includes(e.status));
            
        return matchesSearch && matchesCeco && matchesStatus;
    });

    const exportToExcel = () => {
        const data = filtered.map(e => ({
            'NOMBRE COMPLETO': e.fullName,
            'RUT': formatRut(e.rut),
            'CARGO': e.position,
            'ESTADO': e.status,
            'PROYECTO': e.projectName,
            'CECO': e.ceco,
            'SUELDO BASE': e.base,
            'TOT. IMPONIBLES (BONOS)': e.totalImponibles,
            'TOT. NO IMPONIBLES': e.totalNoImponibles,
            'TOTAL HABERES CONFIG.': e.totalHaberes
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Remu_Central");
        XLSX.writeFile(wb, `Remuneraciones_Central_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Stats
    const stats = {
        totalConfig: filtered.reduce((acc, e) => acc + e.totalHaberes, 0),
        avgBase: filtered.length ? filtered.reduce((acc, e) => acc + e.base, 0) / filtered.length : 0,
        activeCount: employees.filter(e => e.status === 'Contratado').length,
        exitedCount: employees.filter(e => ['Finiquitado', 'Retirado'].includes(e.status)).length
    };

    const formatMoney = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

    return (
        <div className="min-h-full bg-slate-50/30 p-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-200 -rotate-3 hover:rotate-0 transition-transform">
                        <Calculator size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Remu <span className="text-emerald-600">Central</span></h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                            Control Transversal de Remuneraciones · {filtered.length} Colaboradores
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                        <Download size={14} /> Exportar Data
                    </button>
                    <button onClick={fetchAll} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={80} className="text-emerald-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Presupuesto Configurado</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(stats.totalConfig)}</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-2 uppercase tracking-tight flex items-center gap-1">
                        <TrendingUp size={10} /> Total Haberes (Mensual)
                    </p>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Landmark size={80} className="text-indigo-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Promedio Sueldo Base</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{formatMoney(stats.avgBase)}</p>
                    <p className="text-[9px] text-indigo-600 font-bold mt-2 uppercase tracking-tight flex items-center gap-1">
                        <Layers size={10} /> Sueldo Base Promedio
                    </p>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><UserCheck size={80} className="text-emerald-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Personal Activo</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.activeCount}</p>
                    <p className="text-[9px] text-emerald-600 font-bold mt-2 uppercase tracking-tight">Colaboradores Contratados</p>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><UserX size={80} className="text-rose-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fuera / Finiquitados</p>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">{stats.exitedCount}</p>
                    <p className="text-[9px] text-rose-600 font-bold mt-2 uppercase tracking-tight">Finiquitos & Retiros</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-10 flex flex-wrap items-center gap-6 shadow-2xl shadow-slate-200/50">
                <div className="flex-1 min-w-[300px] relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Nombre, RUT o Cargo..." 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['Todos', 'Activo', 'Fis/Ret'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <select 
                        className="pl-5 pr-10 py-4 bg-slate-100 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                        value={filterCeco}
                        onChange={e => setFilterCeco(e.target.value)}
                    >
                        <option value="">TODOS LOS CECO</option>
                        {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden relative">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-8 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/4">Colaborador / Identidad</th>
                                <th className="px-6 py-8 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Posición & Proyecto</th>
                                <th className="px-6 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sueldo Base</th>
                                <th className="px-6 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Bonos Imponibles</th>
                                <th className="px-6 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No Imponibles</th>
                                <th className="px-8 py-8 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Haberes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="py-32 text-center">
                                        <RefreshCw className="animate-spin mx-auto text-emerald-500 mb-4" size={40} />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Matriz Remuneraciones...</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-32 text-center">
                                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                                        <p className="text-slate-400 font-bold">No se encontraron registros de remuneración</p>
                                    </td>
                                </tr>
                            ) : filtered.map(emp => (
                                <tr key={emp._id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                                                {emp.fullName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-slate-900 uppercase truncate">
                                                    {emp.fullName}
                                                    {emp.status !== 'Contratado' && (
                                                        <span className="ml-2 px-2 py-0.5 bg-rose-50 text-rose-600 text-[8px] rounded-full border border-rose-100 inline-block align-middle mb-0.5">EXITED</span>
                                                    )}
                                                </p>
                                                <p className="text-[9px] font-mono text-slate-400 mt-1">{formatRut(emp.rut)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-700 uppercase">
                                                <Briefcase size={10} className="text-indigo-500" /> {emp.position}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase">
                                                <Building2 size={10} /> {emp.projectName} / <Landmark size={10} /> {emp.ceco}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-right font-black text-slate-900 text-xs">
                                        {formatMoney(emp.base)}
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-black text-slate-600 text-xs">{formatMoney(emp.totalImponibles)}</span>
                                            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">IMPONIBLE</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="font-black text-slate-600 text-xs">{formatMoney(emp.totalNoImponibles)}</span>
                                            <span className="text-[8px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">ASIGNACIONES</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200 group-hover:bg-emerald-600 group-hover:shadow-emerald-200 transition-all">
                                            <DollarSign size={12} className="text-emerald-400" />
                                            <span className="text-sm font-black tracking-tighter">{formatMoney(emp.totalHaberes)}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Legend / Info Footer */}
            <div className="mt-8 flex items-center justify-between px-8 text-slate-400">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" /> Remuneración Activa
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-rose-500" /> Datos Históricos (Post-Finiquito)
                    </div>
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest italic opacity-60 flex items-center gap-2">
                    <AlertCircle size={10} /> Los valores mostrados corresponden a la configuración contractual maestra
                </div>
            </div>
        </div>
    );
};

export default RemuCentral;
