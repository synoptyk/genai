import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingDown, Users, Search, RefreshCw, Download, AlertCircle,
    ChevronDown, ChevronUp, Save, X, Plus, Trash2, DollarSign,
    Filter, Calendar, Building2, CheckCircle2
} from 'lucide-react';
import { candidatosApi, proyectosApi } from '../rrhhApi';
import * as XLSX from 'xlsx';
import { useAuth } from '../../auth/AuthContext';

const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

const TIPOS_DESCUENTO = [
    { key: 'anticipo', label: 'Anticipo Sueldo', color: 'rose' },
    { key: 'cuotaSindical', label: 'Cuota Sindical', color: 'violet' },
    { key: 'prestamo', label: 'Préstamo Empresa', color: 'amber' },
    { key: 'multaAtraso', label: 'Multa por Atraso', color: 'orange' },
    { key: 'perdidaMaterial', label: 'Pérdida / Daño Material', color: 'rose' },
    { key: 'otros', label: 'Otros Descuentos', color: 'slate' },
];

const Descuentos = () => {
    const { user } = useAuth();
    const [empleados, setEmpleados] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterStatus, setFilterStatus] = useState('Contratado');
    const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));

    const [descuentos, setDescuentos] = useState({});
    const [expandedId, setExpandedId] = useState(null);

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [candRes, projRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
            ]);
            const cands = candRes.data || [];
            const projs = projRes.data || [];
            setEmpleados(cands);
            setProyectos(projs);

            // Inicializar descuentos con valores vacíos
            const init = {};
            cands.forEach(e => {
                init[e._id] = TIPOS_DESCUENTO.reduce((acc, t) => {
                    acc[t.key] = e[`desc_${t.key}`] || 0;
                    return acc;
                }, { nota: '' });
            });
            setDescuentos(prev => ({ ...init, ...prev }));
        } catch (e) {
            console.error('Error fetching descuentos:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = empleados.filter(e => {
        const term = searchTerm.toLowerCase();
        const matchSearch = !searchTerm ||
            e.fullName?.toLowerCase().includes(term) ||
            e.rut?.includes(term);
        const matchStatus = filterStatus === 'Todos' || e.status === filterStatus;
        const proj = proyectos.find(p => p._id === (e.projectId?._id || e.projectId));
        const ceco = proj?.centroCosto || e.ceco || '';
        const matchCeco = !filterCeco || ceco === filterCeco;
        return matchSearch && matchStatus && matchCeco;
    });

    const cecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    const getTotalDescuentos = (id) => {
        const d = descuentos[id] || {};
        return TIPOS_DESCUENTO.reduce((sum, t) => sum + (Number(d[t.key]) || 0), 0);
    };

    const handleChange = (empId, key, value) => {
        setDescuentos(prev => ({
            ...prev,
            [empId]: { ...(prev[empId] || {}), [key]: Number(value) || 0 }
        }));
    };

    const handleSave = async (empId) => {
        setSaving(true);
        try {
            const d = descuentos[empId] || {};
            await candidatosApi.update(empId, {
                ...TIPOS_DESCUENTO.reduce((acc, t) => {
                    acc[`desc_${t.key}`] = Number(d[t.key]) || 0;
                    return acc;
                }, {}),
                desc_nota: d.nota || '',
                desc_periodo: period,
            });
            showAlert('Descuentos guardados correctamente');
            setExpandedId(null);
        } catch (e) {
            showAlert('Error al guardar descuentos', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const rows = filtered.map(e => {
            const d = descuentos[e._id] || {};
            const proj = proyectos.find(p => p._id === (e.projectId?._id || e.projectId));
            return {
                'RUT': e.rut,
                'NOMBRE': e.fullName,
                'CARGO': e.position,
                'CECO': proj?.centroCosto || e.ceco || '',
                'PERÍODO': period,
                ...TIPOS_DESCUENTO.reduce((acc, t) => {
                    acc[t.label.toUpperCase()] = Number(d[t.key]) || 0;
                    return acc;
                }, {}),
                'TOTAL DESCUENTOS': getTotalDescuentos(e._id),
                'NOTA': d.nota || '',
            };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Descuentos_${period}`);
        XLSX.writeFile(wb, `Descuentos_Otros_${period}.xlsx`);
    };

    const totalGeneral = filtered.reduce((sum, e) => sum + getTotalDescuentos(e._id), 0);
    const conDescuentos = filtered.filter(e => getTotalDescuentos(e._id) > 0).length;

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-24">
            {/* Alert */}
            {alert && (
                <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-black uppercase tracking-wide animate-in slide-in-from-right ${alert.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>
                    {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    {alert.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-rose-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-rose-200 -rotate-3 hover:rotate-0 transition-transform">
                        <TrendingDown size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            Descuentos <span className="text-rose-600">&amp; Otros</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                            Gestión de descuentos adicionales · {filtered.length} colaboradores
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={period}
                        onChange={e => setPeriod(e.target.value)}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    />
                    <button onClick={handleExport} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-rose-400 hover:text-rose-600 transition-all shadow-sm">
                        <Download size={14} /> Exportar
                    </button>
                    <button onClick={fetchData} className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                    { label: 'Total Descuentos Período', value: fmt(totalGeneral), icon: DollarSign, color: 'rose' },
                    { label: 'Colaboradores con Descuento', value: conDescuentos, icon: Users, color: 'amber' },
                    { label: 'Total Colaboradores', value: filtered.length, icon: Building2, color: 'slate' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 relative overflow-hidden group">
                        <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity`}>
                            <Icon size={80} className={`text-${color}-600`} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-6 flex flex-wrap items-center gap-4 shadow-xl">
                <div className="flex-1 min-w-[250px] relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o RUT..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-100"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none"
                >
                    <option value="Contratado">Contratados</option>
                    <option value="Todos">Todos</option>
                </select>
                <select
                    value={filterCeco}
                    onChange={e => setFilterCeco(e.target.value)}
                    className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none"
                >
                    <option value="">Todos los CECO</option>
                    {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
                {loading ? (
                    <div className="py-32 text-center">
                        <RefreshCw className="animate-spin mx-auto text-rose-500 mb-4" size={40} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando descuentos...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-32 text-center">
                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                        <p className="text-slate-400 font-bold">No se encontraron colaboradores</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map(emp => {
                            const total = getTotalDescuentos(emp._id);
                            const isOpen = expandedId === emp._id;
                            const proj = proyectos.find(p => p._id === (emp.projectId?._id || emp.projectId));
                            return (
                                <div key={emp._id} className="group">
                                    {/* Row */}
                                    <button
                                        onClick={() => setExpandedId(isOpen ? null : emp._id)}
                                        className="w-full flex items-center gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 font-black text-sm flex-shrink-0">
                                            {emp.fullName?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-black text-slate-900 uppercase truncate">{emp.fullName}</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                {emp.position} · {proj?.centroCosto || emp.ceco || 'Sin CECO'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {total > 0 ? (
                                                <span className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black">
                                                    {fmt(total)}
                                                </span>
                                            ) : (
                                                <span className="px-4 py-1.5 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black">
                                                    Sin descuentos
                                                </span>
                                            )}
                                            {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </div>
                                    </button>

                                    {/* Expanded panel */}
                                    {isOpen && (
                                        <div className="px-8 pb-6 bg-slate-50/50 border-t border-slate-100">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                                {TIPOS_DESCUENTO.map(tipo => (
                                                    <div key={tipo.key}>
                                                        <label className={`block text-[9px] font-black text-${tipo.color}-600 uppercase tracking-wider mb-1.5 ml-1`}>
                                                            {tipo.label}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={descuentos[emp._id]?.[tipo.key] || 0}
                                                            onChange={e => handleChange(emp._id, tipo.key, e.target.value)}
                                                            className="w-full py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-100 transition-all"
                                                        />
                                                    </div>
                                                ))}
                                                <div className="col-span-2 md:col-span-3">
                                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                                                        Nota / Observación
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Descripción del descuento..."
                                                        value={descuentos[emp._id]?.nota || ''}
                                                        onChange={e => setDescuentos(prev => ({
                                                            ...prev,
                                                            [emp._id]: { ...(prev[emp._id] || {}), nota: e.target.value }
                                                        }))}
                                                        className="w-full py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-100 transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total:</span>
                                                    <span className="text-lg font-black text-rose-600">{fmt(getTotalDescuentos(emp._id))}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setExpandedId(null)}
                                                        className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                                                    >
                                                        <X size={12} className="inline mr-1" />Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => handleSave(emp._id)}
                                                        disabled={saving}
                                                        className="px-6 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50"
                                                    >
                                                        <Save size={12} className="inline mr-1" />Guardar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Descuentos;
