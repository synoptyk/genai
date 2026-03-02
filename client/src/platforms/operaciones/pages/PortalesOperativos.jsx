import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../../config';
import { useAuth } from '../../auth/AuthContext';
import {
    Activity, Users, ShieldCheck, ShieldAlert,
    Search, Filter, MoreVertical, Edit3,
    Trash2, UserX, UserCheck, History,
    Calendar, Globe, Monitor, MapPin,
    ArrowUpRight, Loader2, AlertCircle,
    ChevronLeft, ChevronRight, X
} from 'lucide-react';

const PortalesOperativos = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    // Modal states
    const [historyModal, setHistoryModal] = useState({ open: false, user: null, logs: [] });
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resUsers, resStats] = await Promise.all([
                axios.get(`${API_URL}/api/auth/users`),
                axios.get(`${API_URL}/api/auth/stats/portales`)
            ]);
            setUsers(resUsers.data);
            setStats(resStats.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching portal management data:", err);
            setError("No se pudieron cargar los datos de gestión. Verifique sus permisos.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'Suspendido' ? 'Activo' : 'Suspendido';
        if (!window.confirm(`¿Está seguro de cambiar el estado de ${user.name} a ${newStatus}?`)) return;

        try {
            await axios.put(`${API_URL}/api/auth/users/${user._id}`, { status: newStatus });
            fetchData();
        } catch (err) {
            alert("Error al actualizar estado.");
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`¿ELIMINAR PERMANENTEMENTE a ${user.name}? Esta acción no se puede deshacer.`)) return;
        try {
            await axios.delete(`${API_URL}/api/auth/users/${user._id}`);
            fetchData();
        } catch (err) {
            alert("Error al eliminar usuario.");
        }
    };

    const viewHistory = async (user) => {
        setHistoryModal({ open: true, user, logs: [] });
        setLoadingHistory(true);
        try {
            const res = await axios.get(`${API_URL}/api/auth/users/${user._id}/history`);
            setHistoryModal(prev => ({ ...prev, logs: res.data }));
        } catch (err) {
            console.error("Error loading user history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.rut || '').includes(searchTerm) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
        return matchesSearch && matchesRole && matchesStatus;
    });

    if (loading && !stats) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Cargando Gestión de Portales...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-700">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none uppercase italic">
                        Portales <span className="text-indigo-600">Operativos</span>
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-[0.3em]">Gestión de Accesos, Auditoría y Control de Usuarios</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={fetchData} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
                        <Activity size={20} />
                    </button>
                    <div className="h-10 w-[1px] bg-slate-200 mx-2" />
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Usuarios</p>
                        <p className="text-xl font-black text-slate-800 leading-none">{stats?.total || 0}</p>
                    </div>
                </div>
            </div>

            {/* ERROR ALERT */}
            {error && (
                <div className="mb-8 p-6 bg-rose-50 border border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600 animate-in slide-in-from-top">
                    <AlertCircle size={24} />
                    <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                </div>
            )}

            {/* KPI GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <Users className="absolute -right-4 -bottom-4 text-indigo-50 opacity-10 group-hover:scale-110 transition-transform" size={120} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Usuarios Activos</p>
                    <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-slate-900 italic leading-none">{stats?.total - stats?.suspendidos}</p>
                        <span className="text-xs font-bold text-emerald-500 mb-1">Registrados</span>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <Activity className="absolute -right-4 -bottom-4 text-emerald-50 opacity-10 group-hover:scale-110 transition-transform" size={120} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Conexiones Hoy</p>
                    <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-emerald-600 italic leading-none">{stats?.activosHoy}</p>
                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase mb-1">
                            <ArrowUpRight size={12} /> Live
                        </div>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <ShieldAlert className="absolute -right-4 -bottom-4 text-rose-50 opacity-10 group-hover:scale-110 transition-transform" size={120} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Bloqueados / Suspendidos</p>
                    <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-rose-600 italic leading-none">{stats?.suspendidos}</p>
                        <span className="text-xs font-bold text-rose-400 mb-1 italic">Acceso Denegado</span>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <ShieldCheck className="absolute -right-4 -bottom-4 text-violet-50 opacity-10 group-hover:scale-110 transition-transform" size={120} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tasa de Adopción</p>
                    <div className="flex items-end gap-3">
                        <p className="text-5xl font-black text-violet-600 italic leading-none">{stats?.total ? Math.round((stats.activosHoy / stats.total) * 100) : 0}%</p>
                        <span className="text-xs font-bold text-slate-300 mb-1">Engagement</span>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT TABLE */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden mb-20 px-4">

                {/* FILTERS TOOLBAR */}
                <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="relative w-full lg:w-96">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por Nombre, RUT o Email..."
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-200 transition-all uppercase"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <Filter size={16} className="text-slate-400" />
                            <select
                                className="bg-transparent text-[10px] font-black uppercase text-slate-600 focus:outline-none cursor-pointer"
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            >
                                <option value="all">Todos los Roles</option>
                                <option value="ceo_genai">CEO Gen AI</option>
                                <option value="admin">Administrador</option>
                                <option value="supervisor_hse">Supervisor HSE</option>
                                <option value="user">Colaborador</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-3 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl">
                            <Globe size={16} className="text-slate-400" />
                            <select
                                className="bg-transparent text-[10px] font-black uppercase text-slate-600 focus:outline-none cursor-pointer"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Cualquier Estado</option>
                                <option value="Activo">Solo Activos</option>
                                <option value="Suspendido">Solo Suspendidos</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identidad & Usuario</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rol</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Punto de Acceso</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Última Conexión</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-8 py-20 text-center">
                                        <Users className="mx-auto text-slate-200 mb-4" size={48} />
                                        <p className="text-sm font-black text-slate-400 uppercase tracking-widest italic">No se encontraron usuarios con esos filtros</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u._id} className="hover:bg-slate-50/80 transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black relative overflow-hidden">
                                                    {u.avatar ? <img src={u.avatar} alt="Avatar" className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 uppercase italic leading-none">{u.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{u.email} · <span className="text-indigo-400">{u.rut || 'S/RUT'}</span></p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider 
                                                ${u.role === 'ceo_genai' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                    u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                                        u.role === 'supervisor_hse' ? 'bg-violet-100 text-violet-700 border border-violet-200' :
                                                            'bg-slate-100 text-slate-600'}`}>
                                                {u.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Monitor size={14} className="text-slate-300" />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{u.empresa?.nombre || 'Gen AI'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {u.ultimoAcceso ? (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-700 uppercase">{new Date(u.ultimoAcceso).toLocaleDateString()}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(u.ultimoAcceso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-300 uppercase italic italic">Sin Ingresos</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest
                                                ${u.status === 'Activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Activo' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                                                {u.status || 'Activo'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={() => viewHistory(u)}
                                                    className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm transition-all"
                                                    title="Ver Historial"
                                                >
                                                    <History size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(u)}
                                                    className={`p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm transition-all
                                                        ${u.status === 'Suspendido' ? 'text-emerald-500 hover:text-emerald-700' : 'text-rose-400 hover:text-rose-600'}`}
                                                    title={u.status === 'Suspendido' ? 'Reactivar' : 'Suspender'}
                                                >
                                                    {u.status === 'Suspendido' ? <UserCheck size={16} /> : <UserX size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-300 hover:text-rose-600 shadow-sm transition-all"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* FOOTER PAGINATION PLACEHOLDER */}
                <div className="p-8 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <p>Viendo {filteredUsers.length} de {users.length} usuarios</p>
                    <div className="flex gap-4">
                        <button className="flex items-center gap-2 opacity-50 cursor-not-allowed"><ChevronLeft size={14} /> Anterior</button>
                        <button className="flex items-center gap-2 hover:text-indigo-600 transition-all">Siguiente <ChevronRight size={14} /></button>
                    </div>
                </div>
            </div>

            {/* MODAL: USER HISTORY */}
            {historyModal.open && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 bg-gradient-to-br from-indigo-700 to-indigo-900 text-white flex justify-between items-start">
                            <div className="flex gap-6">
                                <div className="p-5 bg-white/10 rounded-[2rem] border border-white/10 backdrop-blur-sm">
                                    <History size={32} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight italic">Historial de Accesos</h2>
                                    <p className="text-[10px] font-bold text-indigo-300 mt-2 uppercase tracking-[0.2em]">{historyModal.user?.name} · {historyModal.user?.rut}</p>
                                </div>
                            </div>
                            <button onClick={() => setHistoryModal({ open: false, user: null, logs: [] })} className="p-4 bg-black/10 hover:bg-black/20 rounded-2xl transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {loadingHistory ? (
                                <div className="flex flex-col items-center gap-4 py-20">
                                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Recuperando registros...</p>
                                </div>
                            ) : historyModal.logs.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 rounded-[2.5rem]">
                                    <Globe className="mx-auto text-slate-200 mb-6" size={48} />
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Sin registros de conexión recientes</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historyModal.logs.map((log, i) => (
                                        <div key={i} className="flex items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-indigo-200 transition-all">
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-lg font-black text-slate-800 leading-none italic">{new Date(log.fecha).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{new Date(log.fecha).getFullYear()}</p>
                                                </div>
                                                <div className="h-10 w-[1px] bg-slate-200" />
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <MapPin size={12} className="text-indigo-400" />
                                                        <p className="text-[10px] font-black text-slate-800 uppercase tabular-nums tracking-widest">{log.ip || '0.0.0.0'}</p>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase max-w-xs truncate italic">{log.userAgent || 'Chrome / MacOS'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-indigo-600 italic">{new Date(log.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Time Entry</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-8 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setHistoryModal({ open: false, user: null, logs: [] })}
                                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PortalesOperativos;
