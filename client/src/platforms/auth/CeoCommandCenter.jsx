import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Building2, Shield, Trash2, Edit3, Plus, X, Save, Loader2,
    Zap, BarChart3, Activity, CheckCircle2, AlertTriangle, LogOut,
    Eye, EyeOff, Search, Crown, UserPlus, Settings, Home,
    TrendingUp, Globe, ChevronRight
} from 'lucide-react';
import { useAuth } from './AuthContext';
import axios from 'axios';

const ROLES = [
    { value: 'user', label: 'Usuario', color: 'slate' },
    { value: 'supervisor_hse', label: 'Supervisor HSE', color: 'amber' },
    { value: 'admin', label: 'Admin Empresa', color: 'indigo' },
    { value: 'ceo_genai', label: 'CEO Gen AI', color: 'amber' }
];

const ESTADOS = ['Activo', 'Inactivo', 'Suspendido'];

const roleBadge = {
    ceo_genai: 'bg-amber-100 text-amber-800 border border-amber-200',
    admin: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    supervisor_hse: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    user: 'bg-slate-100 text-slate-700 border border-slate-200'
};

const statusBadge = {
    Activo: 'bg-emerald-100 text-emerald-700',
    Inactivo: 'bg-slate-100 text-slate-500',
    Suspendido: 'bg-red-100 text-red-700'
};

const CeoCommandCenter = () => {
    const navigate = useNavigate();
    const { user, logout, authHeader, API_BASE } = useAuth();
    const [view, setView] = useState('users');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [modal, setModal] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [alert, setAlert] = useState(null);

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'user',
        cargo: '', status: 'Activo',
        empresa: { nombre: '', rut: '', plan: 'starter' }
    });

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/auth/users`, { headers: authHeader() });
            setUsers(res.data);
        } catch { showAlert('Error al cargar usuarios', 'error'); }
        finally { setLoading(false); }
    };

    const showAlert = (message, type = 'success') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const openCreate = () => {
        setFormData({ name: '', email: '', password: '', role: 'user', cargo: '', status: 'Activo', empresa: { nombre: '', rut: '', plan: 'starter' } });
        setModal('create');
    };

    const openEdit = (u) => {
        setSelectedUser(u);
        setFormData({ name: u.name, email: u.email, password: '', role: u.role, cargo: u.cargo || '', status: u.status, empresa: u.empresa || { nombre: '', rut: '', plan: 'starter' } });
        setModal('edit');
    };

    const handleCreate = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/auth/register`, formData, { headers: authHeader() });
            showAlert('Usuario creado exitosamente');
            setModal(null); fetchUsers();
        } catch (e) { showAlert(e.response?.data?.message || 'Error al crear usuario', 'error'); }
        finally { setSaving(false); }
    };

    const handleUpdate = async () => {
        setSaving(true);
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        try {
            await axios.put(`${API_BASE}/auth/users/${selectedUser._id}`, payload, { headers: authHeader() });
            showAlert('Usuario actualizado');
            setModal(null); fetchUsers();
        } catch { showAlert('Error al actualizar', 'error'); }
        finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            await axios.delete(`${API_BASE}/auth/users/${selectedUser._id}`, { headers: authHeader() });
            showAlert('Usuario eliminado');
            setModal(null); fetchUsers();
        } catch { showAlert('Error al eliminar', 'error'); }
        finally { setSaving(false); }
    };

    const filteredUsers = users.filter(u => {
        const s = searchTerm.toLowerCase();
        const matchSearch = u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.empresa?.nombre?.toLowerCase().includes(s);
        return matchSearch && (filterRole ? u.role === filterRole : true);
    });

    const stats = [
        { label: 'Total Usuarios', value: users.length, icon: Users, color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
        { label: 'Empresas', value: new Set(users.map(u => u.empresa?.nombre)).size, icon: Building2, color: 'violet', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        { label: 'Activos', value: users.filter(u => u.status === 'Activo').length, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        { label: 'Suspendidos', value: users.filter(u => u.status === 'Suspendido').length, icon: AlertTriangle, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' }
    ];

    const navItems = [
        { id: 'users', icon: Users, label: 'Gestión de Usuarios' },
        { id: 'companies', icon: Building2, label: 'Empresas Activas' },
        { id: 'stats', icon: BarChart3, label: 'Estadísticas' },
        { id: 'settings', icon: Settings, label: 'Configuración' }
    ];

    // ── FORM MODAL ────────────────────────────────────────────────────────────
    const FormModal = ({ isCreate }) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">{isCreate ? 'Nuevo Usuario' : 'Editar Usuario'}</h3>
                        <div className="h-1 w-10 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-2" />
                    </div>
                    <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-5">
                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Datos Personales</p>
                    <div className="grid grid-cols-2 gap-4">
                        {[['name', 'Nombre Completo', 'col-span-2'], ['email', 'Email Corporativo', ''], ['cargo', 'Cargo', '']].map(([k, l, cls]) => (
                            <div key={k} className={cls}>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{l}</label>
                                <input
                                    type={k === 'email' ? 'email' : 'text'}
                                    value={formData[k]}
                                    onChange={e => setFormData(p => ({ ...p, [k]: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{isCreate ? 'Contraseña *' : 'Nueva Contraseña (vacío = sin cambios)'}</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                                    className="w-full px-4 py-3 pr-12 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    placeholder="••••••••" required={isCreate}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest pt-2">Empresa</p>
                    <div className="grid grid-cols-2 gap-4">
                        {[['nombre', 'Nombre Empresa'], ['rut', 'RUT Empresa']].map(([k, l]) => (
                            <div key={k}>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{l}</label>
                                <input
                                    type="text" value={formData.empresa[k] || ''}
                                    onChange={e => setFormData(p => ({ ...p, empresa: { ...p.empresa, [k]: e.target.value } }))}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Plan</label>
                            <select value={formData.empresa.plan} onChange={e => setFormData(p => ({ ...p, empresa: { ...p.empresa, plan: e.target.value } }))}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all">
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Rol del Sistema</label>
                            <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all">
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Estado</label>
                            <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all">
                                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                        <button
                            onClick={isCreate ? handleCreate : handleUpdate}
                            disabled={saving}
                            className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-[11px] uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-lg shadow-indigo-200"
                        >
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {isCreate ? 'Crear Usuario' : 'Guardar Cambios'}</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans antialiased">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); body{font-family:'Inter',sans-serif;}`}</style>

            {/* ── SIDEBAR ────────────────────────────────────────────── */}
            <aside className="fixed left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 flex flex-col z-50 shadow-sm">
                {/* Logo */}
                <div className="p-8 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200">
                            <Zap size={20} className="fill-white text-white" />
                        </div>
                        <div>
                            <span className="text-xl font-black text-slate-900 tracking-tight">GEN<span className="text-indigo-600">AI</span></span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em] block -mt-0.5">Enterprise Platform</p>
                        </div>
                    </div>
                    {/* CEO badge */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg">
                                <Crown size={16} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-slate-800">{user?.name}</p>
                                <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">CEO · God Mode</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-5 space-y-2">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all ${view === item.id
                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 border border-transparent hover:border-indigo-100'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 space-y-2">
                    <button onClick={() => navigate('/prevencion/dashboard')}
                        className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-transparent hover:border-indigo-100">
                        <Activity size={16} /> Ir a la Plataforma
                    </button>
                    <button onClick={() => navigate('/')}
                        className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase text-slate-400 hover:bg-slate-50 transition-all">
                        <Home size={16} /> Página Principal
                    </button>
                    <button onClick={() => { logout(); navigate('/'); }}
                        className="w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-red-50 border border-red-100 text-red-500 font-black text-[11px] uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-all">
                        <LogOut size={16} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* ── MAIN ───────────────────────────────────────────────── */}
            <div className="ml-72 min-h-screen flex flex-col">

                {/* Header */}
                <header className="bg-white border-b border-slate-100 px-10 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Crown size={14} className="text-amber-600" />
                            </div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                {view === 'users' ? 'Gestión de Usuarios' : view === 'companies' ? 'Empresas Activas' : view === 'stats' ? 'Estadísticas' : 'Configuración'}
                            </h1>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-10">Gen AI · CEO Command Center</p>
                    </div>
                    {view === 'users' && (
                        <button onClick={openCreate}
                            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                            <UserPlus size={16} /> Nuevo Usuario
                        </button>
                    )}
                </header>

                <div className="p-10 flex-1">

                    {/* STATS */}
                    <div className="grid grid-cols-4 gap-5 mb-10">
                        {stats.map((s, i) => (
                            <div key={i} className={`bg-white border ${s.border} rounded-[2rem] p-7 shadow-sm`}>
                                <div className={`w-12 h-12 ${s.bg} rounded-2xl flex items-center justify-center mb-5`}>
                                    <s.icon size={22} className={s.text} />
                                </div>
                                <p className="text-3xl font-black text-slate-900 mb-1">{s.value}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* ── VIEW: USERS ── */}
                    {view === 'users' && (
                        <>
                            {/* Filters */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" placeholder="Buscar por nombre, email o empresa..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                                <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
                                    className="px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 text-sm font-bold focus:outline-none focus:border-indigo-400 transition-all">
                                    <option value="">Todos los Roles</option>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>

                            {/* Table */}
                            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                                {loading ? (
                                    <div className="p-32 flex items-center justify-center">
                                        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-100 bg-slate-50/80">
                                                    {['Usuario', 'Email', 'Empresa', 'Rol', 'Estado', 'Creado', 'Acciones'].map(h => (
                                                        <th key={h} className="px-6 py-4 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {filteredUsers.map(u => (
                                                    <tr key={u._id} className="hover:bg-indigo-50/30 transition-all">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm">
                                                                    {u.name?.charAt(0)?.toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-900 font-black text-sm">{u.name}</p>
                                                                    <p className="text-slate-400 text-[10px] font-bold uppercase">{u.cargo || 'Sin cargo'}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-500 text-sm font-semibold">{u.email}</td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-slate-800 text-sm font-black">{u.empresa?.nombre || 'N/A'}</p>
                                                            <span className="text-[9px] font-black text-indigo-500 uppercase">{u.empresa?.plan || 'starter'}</span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${roleBadge[u.role] || roleBadge.user}`}>
                                                                {ROLES.find(r => r.value === u.role)?.label || u.role}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${statusBadge[u.status]}`}>
                                                                {u.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-slate-400 text-sm font-semibold">
                                                            {new Date(u.createdAt).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => openEdit(u)} className="p-2.5 bg-indigo-50 hover:bg-indigo-600 rounded-xl text-indigo-600 hover:text-white transition-all">
                                                                    <Edit3 size={15} />
                                                                </button>
                                                                <button onClick={() => { setSelectedUser(u); setModal('delete'); }} className="p-2.5 bg-red-50 hover:bg-red-600 rounded-xl text-red-500 hover:text-white transition-all">
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {filteredUsers.length === 0 && (
                                            <div className="py-20 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                                                Sin usuarios que coincidan con la búsqueda
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── VIEW: COMPANIES ── */}
                    {view === 'companies' && (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[...new Map(users.map(u => [u.empresa?.nombre, u.empresa])).values()].filter(Boolean).map((e, i) => {
                                const eUsers = users.filter(u => u.empresa?.nombre === e.nombre);
                                const planColors = { starter: 'bg-slate-100 text-slate-600', pro: 'bg-indigo-100 text-indigo-700', enterprise: 'bg-amber-100 text-amber-700' };
                                return (
                                    <div key={i} className="bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-indigo-200 hover:shadow-md transition-all">
                                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white text-xl font-black mb-5 shadow-lg shadow-indigo-200">
                                            {e.nombre?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 mb-1">{e.nombre}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{e.rut || 'RUT no registrado'}</p>
                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${planColors[e.plan] || planColors.starter}`}>{e.plan}</span>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <Users size={12} /> {eUsers.length} usuarios
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── VIEW: STATS ── */}
                    {view === 'stats' && (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
                                <h3 className="text-base font-black text-slate-900 mb-8 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center"><Users size={16} className="text-indigo-600" /></div>
                                    Distribución por Rol
                                </h3>
                                {ROLES.map(r => {
                                    const count = users.filter(u => u.role === r.value).length;
                                    const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                                    return (
                                        <div key={r.value} className="mb-5">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-[11px] font-bold text-slate-600">{r.label}</span>
                                                <span className="text-[11px] font-black text-indigo-600">{count} ({pct}%)</span>
                                            </div>
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all duration-700" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
                                <h3 className="text-base font-black text-slate-900 mb-8 flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center"><Activity size={16} className="text-emerald-600" /></div>
                                    Estado del Sistema
                                </h3>
                                {[
                                    ['Activo', users.filter(u => u.status === 'Activo').length, 'from-emerald-500 to-teal-500'],
                                    ['Inactivo', users.filter(u => u.status === 'Inactivo').length, 'from-slate-400 to-slate-500'],
                                    ['Suspendido', users.filter(u => u.status === 'Suspendido').length, 'from-red-500 to-rose-500']
                                ].map(([s, count, grad]) => {
                                    const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                                    return (
                                        <div key={s} className="mb-5">
                                            <div className="flex justify-between mb-2">
                                                <span className="text-[11px] font-bold text-slate-600">{s}</span>
                                                <span className="text-[11px] font-black text-slate-700">{count} ({pct}%)</span>
                                            </div>
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center">
                                        <p className="text-2xl font-black text-indigo-700">{new Set(users.map(u => u.empresa?.nombre)).size}</p>
                                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mt-1">Empresas</p>
                                    </div>
                                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
                                        <p className="text-2xl font-black text-amber-700">{users.length}</p>
                                        <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-1">Total Usuarios</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── VIEW: SETTINGS ── */}
                    {view === 'settings' && (
                        <div className="max-w-xl">
                            <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm">
                                <h3 className="text-base font-black text-slate-900 mb-6">Configuración del Sistema</h3>
                                <div className="space-y-4">
                                    {[
                                        ['Versión de la Plataforma', 'Gen AI v8.0 Enterprise'],
                                        ['Base de Datos', 'MongoDB Atlas · Conectado'],
                                        ['Autenticación', 'JWT + Token Versioning'],
                                        ['Seguridad', 'SSL 256bit · Activo']
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex items-center justify-between py-4 border-b border-slate-50">
                                            <span className="text-sm font-bold text-slate-500">{k}</span>
                                            <span className="text-sm font-black text-slate-800">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODALS ─────────────────────────────────────────────── */}
            {modal === 'create' && <FormModal isCreate={true} />}
            {modal === 'edit' && <FormModal isCreate={false} />}
            {modal === 'delete' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl text-center">
                        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] w-fit mx-auto mb-8">
                            <AlertTriangle size={40} className="text-red-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 mb-3">¿Eliminar Usuario?</h4>
                        <p className="text-slate-500 mb-8 text-sm"><span className="font-black text-slate-800">{selectedUser?.name}</span> será eliminado permanentemente del sistema.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                            <button onClick={handleDelete} disabled={saving} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[11px] uppercase hover:bg-red-700 transition-all flex items-center justify-center disabled:opacity-60 gap-2 shadow-lg shadow-red-200">
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={16} /> Eliminar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TOAST ALERT ────────────────────────────────────────── */}
            {alert && (
                <div className={`fixed bottom-8 right-8 z-[200] px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-wide shadow-xl flex items-center gap-3 transition-all ${alert.type === 'error'
                        ? 'bg-red-600 text-white shadow-red-200'
                        : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-200'
                    }`}>
                    {alert.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    {alert.message}
                </div>
            )}
        </div>
    );
};

export default CeoCommandCenter;
