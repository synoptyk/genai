import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldAlert, Search, Plus, Loader2,
    XCircle, FileText
} from 'lucide-react';
import { candidatosApi } from '../rrhhApi';

const RelacionesLaborales = () => {
    const [employees, setEmployees] = useState([]);
    const [activeTab, setActiveTab] = useState('disciplinary');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newAction, setNewAction] = useState({
        candidateId: '',
        type: 'Amonestación Escrita',
        reason: '',
        date: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await candidatosApi.getAll();
            setEmployees(res.data.filter(e => e.status === 'Contratado'));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            if (activeTab === 'disciplinary') {
                await candidatosApi.addAmonestacion(newAction.candidateId, newAction);
            } else {
                await candidatosApi.addFelicitacion(newAction.candidateId, newAction);
            }
            setIsModalOpen(false);
            fetchData();
        } catch (e) {
            alert('Error al registrar');
        }
    };

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-20">
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-rose-600 text-white p-3 rounded-2xl shadow-lg shadow-rose-200">
                    <ShieldAlert size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Relaciones <span className="text-rose-600">Laborales</span></h1>
                    <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Gestión de disciplina y méritos del personal</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between mb-8">
                <div className="flex p-1 bg-slate-50 rounded-2xl">
                    <button
                        onClick={() => setActiveTab('disciplinary')}
                        className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'disciplinary' ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400 hover:text-rose-600'}`}
                    >
                        Amonestaciones
                    </button>
                    <button
                        onClick={() => setActiveTab('commendations')}
                        className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'commendations' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-emerald-600'}`}
                    >
                        Felicitaciones
                    </button>
                </div>
                <div className="flex items-center gap-4 pr-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg ${activeTab === 'disciplinary' ? 'bg-rose-600 shadow-rose-100 hover:bg-rose-700' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'}`}
                    >
                        <Plus size={16} /> Nuevo Registro
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo / Categoría</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Motivo</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="5" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-rose-500" /></td></tr>
                        ) : employees.map(e => {
                            const records = activeTab === 'disciplinary' ? e.amonestaciones : e.felicitaciones;
                            if (!records || records.length === 0) return null;
                            return records.map((r, i) => (
                                <tr key={`${e._id}-${i}`} className="hover:bg-slate-50 transition-all">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-600">{e.fullName.charAt(0)}</div>
                                            <div>
                                                <p className="text-sm font-black text-slate-900 uppercase">{e.fullName}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{e.rut}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeTab === 'disciplinary' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                            {r.type || r.category || 'N/A'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <p className="text-xs font-bold text-slate-600 max-w-xs truncate">{r.reason}</p>
                                    </td>
                                    <td className="px-8 py-6 text-xs font-bold text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                                    <td className="px-8 py-6 text-right">
                                        <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><FileText size={18} /></button>
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className={`p-8 text-white flex items-center justify-between ${activeTab === 'disciplinary' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight">Nuevo Registro</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mt-1">{activeTab === 'disciplinary' ? 'Amonestación' : 'Reconocimiento'}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/10 rounded-xl"><XCircle size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Colaborador</label>
                                <select
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none"
                                    required
                                    value={newAction.candidateId}
                                    onChange={e => setNewAction({ ...newAction, candidateId: e.target.value })}
                                >
                                    <option value="">Seleccionar...</option>
                                    {employees.map(e => <option key={e._id} value={e._id}>{e.fullName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoría</label>
                                    <select
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none"
                                        value={newAction.type}
                                        onChange={e => setNewAction({ ...newAction, type: e.target.value })}
                                    >
                                        {activeTab === 'disciplinary' ? (
                                            <>
                                                <option value="Amonestación Verbal">Amonestación Verbal</option>
                                                <option value="Amonestación Escrita">Amonestación Escrita</option>
                                                <option value="Multa">Multa</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Valores">Valores Corporativos</option>
                                                <option value="Productividad">Productividad</option>
                                                <option value="Seguridad">Seguridad (HSE)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fecha</label>
                                    <input
                                        type="date"
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none"
                                        value={newAction.date}
                                        onChange={e => setNewAction({ ...newAction, date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Justificación</label>
                                <textarea
                                    className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none"
                                    rows="4"
                                    required
                                    placeholder="Detalle los hechos..."
                                    value={newAction.reason}
                                    onChange={e => setNewAction({ ...newAction, reason: e.target.value })}
                                />
                            </div>
                            <button className={`w-full py-5 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-xl transition-all ${activeTab === 'disciplinary' ? 'bg-rose-600 shadow-rose-100 hover:bg-rose-700' : 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700'}`}>
                                Confirmar Registro
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RelacionesLaborales;
