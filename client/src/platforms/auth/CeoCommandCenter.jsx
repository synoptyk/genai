import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Building2, Trash2, Edit3, X, Save, Loader2,
    Zap, BarChart3, Activity, CheckCircle2, AlertTriangle, LogOut,
    Eye as EyeIcon, EyeOff, Search, Crown, UserPlus, Settings, Home,
    Plus, Globe, Calendar, DollarSign,
    Lock, Unlock, Shield, ShieldAlert, ShieldCheck, Edit, PlusSquare
} from 'lucide-react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import InternationalInput from '../../components/InternationalInput';

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
    const [view, setView] = useState('companies');
    const [users, setUsers] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [modal, setModal] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null); // Remplaza selectedUser para ser genérico
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [alert, setAlert] = useState(null);

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'user',
        cargo: '', status: 'Activo',
        empresaRef: '', // ID de la empresa real
        permisosModulos: {
            rrhh: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            prevencion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            operaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            agentetelecom: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            comercial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
            finanzas: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
        }
    });

    const [empresaFormData, setEmpresaFormData] = useState({
        nombre: '', slug: '', rut: '', plan: 'starter', estado: 'Activo', modulosActivos: [],
        giroComercial: '', direccion: '', telefono: '', email: '', web: '', pais: 'CL', industria: '',
        representantesLegales: [], contactosComerciales: [],
        fechaInicioContrato: '', duracionMeses: '', fechaTerminoContrato: '',
        limiteUsuarios: 5, valorUsuarioUF: '', totalMensualUF: '',
        modoServicio: 'FULL_HR_360'
    });

    useEffect(() => {
        if (!empresaFormData.slug && empresaFormData.nombre) {
            setEmpresaFormData(prev => ({
                ...prev,
                slug: empresaFormData.nombre.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
            }));
        }
    }, [empresaFormData.nombre]);

    useEffect(() => {
        if (empresaFormData.fechaInicioContrato && empresaFormData.duracionMeses) {
            const start = new Date(empresaFormData.fechaInicioContrato);
            const end = new Date(start.setMonth(start.getMonth() + Number(empresaFormData.duracionMeses)));
            setEmpresaFormData(prev => ({
                ...prev,
                fechaTerminoContrato: end.toISOString().split('T')[0]
            }));
        }
    }, [empresaFormData.fechaInicioContrato, empresaFormData.duracionMeses]);

    useEffect(() => {
        if (empresaFormData.valorUsuarioUF && empresaFormData.limiteUsuarios) {
            const total = (Number(empresaFormData.valorUsuarioUF) * Number(empresaFormData.limiteUsuarios)).toFixed(2);
            setEmpresaFormData(prev => ({
                ...prev,
                totalMensualUF: total
            }));
        }
    }, [empresaFormData.valorUsuarioUF, empresaFormData.limiteUsuarios]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resUsers, resEmpresas] = await Promise.all([
                axios.get(`${API_BASE}/auth/users`, { headers: authHeader() }),
                axios.get(`${API_BASE}/empresas`, { headers: authHeader() })
            ]);
            setUsers(resUsers.data);
            setEmpresas(resEmpresas.data);
        } catch { showAlert('Error al cargar datos del sistema', 'error'); }
        finally { setLoading(false); }
    };

    const showAlert = (message, type = 'success') => {
        setAlert({ message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // --- USERS CRUD ---
    const openCreateUser = () => {
        setFormData({
            name: '', email: '', password: '', role: 'user', cargo: '', status: 'Activo', empresaRef: '',
            permisosModulos: {
                rrhh: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                prevencion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                operaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                agentetelecom: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                comercial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                finanzas: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
            }
        });
        setModal('createUser');
    };

    const openEditUser = (u) => {
        setSelectedItem(u);
        setFormData({
            name: u.name,
            email: u.email,
            password: '',
            role: u.role,
            cargo: u.cargo || '',
            status: u.status,
            empresaRef: u.empresaRef?._id || '',
            permisosModulos: u.permisosModulos || {
                rrhh: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                prevencion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                operaciones: { ver: false, crear: false, editar: false, suspending: false, eliminar: false },
                agentetelecom: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                comercial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
                finanzas: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
            }
        });
        setModal('editUser');
    };

    const handleCreateUser = async () => {
        if (!formData.password || formData.password.trim().length < 6) {
            showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/auth/register`, { ...formData, password: formData.password.trim() }, { headers: authHeader() });
            showAlert('Usuario creado exitosamente');
            setModal(null); fetchData();
        } catch (e) { showAlert(e.response?.data?.message || 'Error al crear usuario', 'error'); }
        finally { setSaving(false); }
    };

    const handleUpdateUser = async () => {
        setSaving(true);
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        try {
            await axios.put(`${API_BASE}/auth/users/${selectedItem._id}`, payload, { headers: authHeader() });
            showAlert('Usuario actualizado');
            setModal(null); fetchData();
        } catch { showAlert('Error al actualizar', 'error'); }
        finally { setSaving(false); }
    };

    const handleDeleteUser = async () => {
        setSaving(true);
        try {
            await axios.delete(`${API_BASE}/auth/users/${selectedItem._id}`, { headers: authHeader() });
            showAlert('Usuario eliminado');
            setModal(null); fetchData();
        } catch { showAlert('Error al eliminar', 'error'); }
        finally { setSaving(false); }
    };

    // --- EMPRESAS CRUD ---
    const openCreateEmpresa = () => {
        setEmpresaFormData({
            nombre: '', rut: '', plan: 'starter', estado: 'Activo', modulosActivos: [],
            giroComercial: '', direccion: '', telefono: '', email: '', web: '', pais: 'CL', industria: '',
            representantesLegales: [], contactosComerciales: [],
            fechaInicioContrato: '', duracionMeses: '', fechaTerminoContrato: '',
            limiteUsuarios: 5, valorUsuarioUF: '', totalMensualUF: '',
            modoServicio: 'FULL_HR_360'
        });
        setModal('createEmpresa');
    };

    const openEditEmpresa = (e) => {
        setSelectedItem(e);
        setEmpresaFormData({
            nombre: e.nombre || '',
            rut: e.rut || '',
            plan: e.plan || 'starter',
            estado: e.estado || 'Activo',
            modulosActivos: e.modulosActivos || [],
            giroComercial: e.giroComercial || '',
            direccion: e.direccion || '',
            telefono: e.telefono || '',
            email: e.email || '',
            web: e.web || '',
            pais: e.pais || 'CL',
            industria: e.industria || '',
            representantesLegales: e.representantesLegales || [],
            contactosComerciales: e.contactosComerciales || [],
            fechaInicioContrato: e.fechaInicioContrato ? new Date(e.fechaInicioContrato).toISOString().split('T')[0] : '',
            duracionMeses: e.duracionMeses || '',
            fechaTerminoContrato: e.fechaTerminoContrato ? new Date(e.fechaTerminoContrato).toISOString().split('T')[0] : '',
            limiteUsuarios: e.limiteUsuarios || 5,
            valorUsuarioUF: e.valorUsuarioUF || '',
            totalMensualUF: e.totalMensualUF || '',
            modoServicio: e.modoServicio || 'FULL_HR_360'
        });
        setModal('editEmpresa');
    };

    const handleCreateEmpresa = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/empresas`, empresaFormData, { headers: authHeader() });
            showAlert('Empresa creada exitosamente');
            setModal(null); fetchData();
        } catch (e) { showAlert(e.response?.data?.message || 'Error al crear empresa', 'error'); }
        finally { setSaving(false); }
    };

    const handleUpdateEmpresa = async () => {
        setSaving(true);
        try {
            await axios.put(`${API_BASE}/empresas/${selectedItem._id}`, empresaFormData, { headers: authHeader() });
            showAlert('Empresa actualizada');
            setModal(null); fetchData();
        } catch { showAlert('Error al actualizar empresa', 'error'); }
        finally { setSaving(false); }
    };

    const handleDeleteEmpresa = async () => {
        setSaving(true);
        try {
            await axios.delete(`${API_BASE}/empresas/${selectedItem._id}`, { headers: authHeader() });
            showAlert('Empresa eliminada');
            setModal(null); fetchData();
        } catch { showAlert('Error al eliminar empresa', 'error'); }
        finally { setSaving(false); }
    };

    const filteredUsers = users.filter(u => {
        const s = searchTerm.toLowerCase();
        const empresaName = u.empresaRef ? u.empresaRef.nombre : (u.empresa?.nombre || '');
        const matchSearch = u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || empresaName.toLowerCase().includes(s);
        return matchSearch && (filterRole ? u.role === filterRole : true);
    });

    const stats = [
        { label: 'Total Usuarios', value: users.length, icon: Users, color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
        { label: 'Empresas', value: new Set(users.map(u => u.empresa?.nombre)).size, icon: Building2, color: 'violet', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        { label: 'Activos', value: users.filter(u => u.status === 'Activo').length, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        { label: 'Suspendidos', value: users.filter(u => u.status === 'Suspendido').length, icon: AlertTriangle, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' }
    ];

    const navItems = [
        { id: 'companies', icon: Building2, label: 'Empresas Activas' },
        { id: 'users', icon: Users, label: 'Gestión de Usuarios' },
        { id: 'stats', icon: BarChart3, label: 'Estadísticas' },
        { id: 'settings', icon: Settings, label: 'Configuración' }
    ];

    // ── FORM MODAL ────────────────────────────────────────────────────────────
    const renderFormModal = (isCreate) => (
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
                                    value={formData[k] || ''}
                                    onChange={e => setFormData(p => ({ ...p, [k]: e.target.value }))}
                                    autoComplete="off"
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                />
                            </div>
                        ))}
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{isCreate ? 'Contraseña *' : 'Nueva Contraseña (vacío = sin cambios)'}</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={formData.password || ''}
                                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                                    autoComplete="new-password"
                                    className="w-full px-4 py-3 pr-12 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    placeholder="••••••••" required={isCreate}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                    {showPass ? <EyeOff size={16} /> : <EyeIcon size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest pt-2">Empresa & Accesos</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Empresa Asignada *</label>
                            <select
                                value={formData.empresaRef}
                                onChange={e => setFormData(p => ({ ...p, empresaRef: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all"
                                required
                            >
                                <option value="" disabled>Seleccione una empresa</option>
                                {empresas.map(emp => (
                                    <option key={emp._id} value={emp._id}>{emp.nombre} - {emp.rut || 'S/R'} ({emp.plan})</option>
                                ))}
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

                    <div className="pt-6 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Matriz de Permisos por Módulo</p>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5 italic">Define las capacidades granulares para cada área</p>
                            </div>
                            <div className="px-3 py-1 bg-slate-100 rounded-lg text-[8px] font-black text-slate-500 uppercase tracking-tighter shadow-sm border border-slate-200">Configuración Avanzada</div>
                        </div>

                        <div className="space-y-3">
                            {[
                                { id: 'rrhh', label: 'RRHH / Personas', icon: Users, color: 'indigo' },
                                { id: 'prevencion', label: 'Prevención HSE', icon: Shield, color: 'emerald' },
                                { id: 'operaciones', label: 'Operaciones', icon: Activity, color: 'amber' },
                                { id: 'agentetelecom', label: 'Agente Telecom', icon: Globe, color: 'sky' },
                                { id: 'comercial', label: 'Comercial', icon: DollarSign, color: 'violet' },
                                { id: 'finanzas', label: 'Finanzas', icon: BarChart3, color: 'rose' }
                            ].filter(m => {
                                // Filtrar solo los módulos activos de la empresa seleccionada
                                const emp = empresas.find(e => e._id === formData.empresaRef);
                                // Si no hay empresa seleccionada o la empresa no tiene definido el campo modulosActivos (compatibilidad), mostramos todo
                                if (!emp || !emp.modulosActivos || emp.modulosActivos.length === 0) return true;
                                return emp.modulosActivos.includes(m.id);
                            }).map(mod => (
                                <div key={mod.id} className="group bg-slate-50/50 border border-slate-200 rounded-2xl p-4 hover:border-indigo-200 hover:bg-white transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-[150px]">
                                            <div className={`p-2 bg-${mod.color}-50 text-${mod.color}-600 rounded-xl group-hover:scale-110 transition-transform`}>
                                                <mod.icon size={16} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tighter">{mod.label}</span>
                                        </div>

                                        <div className="grid grid-cols-5 gap-2 flex-1 max-w-2xl">
                                            {[
                                                { key: 'ver', label: 'Ver', icon: EyeIcon, activeColor: 'bg-sky-500', hoverColor: 'hover:bg-sky-50' },
                                                { key: 'crear', label: 'Crear', icon: PlusSquare, activeColor: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-50' },
                                                { key: 'editar', label: 'Editar', icon: Edit, activeColor: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-50' },
                                                { key: 'suspender', label: 'Bloquear', icon: Lock, activeColor: 'bg-amber-500', hoverColor: 'hover:bg-amber-50' },
                                                { key: 'eliminar', label: 'Eliminar', icon: Trash2, activeColor: 'bg-red-500', hoverColor: 'hover:bg-red-50' }
                                            ].map(cap => {
                                                const isActive = formData.permisosModulos[mod.id]?.[cap.key];
                                                return (
                                                    <button
                                                        key={cap.key}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = { ...formData.permisosModulos[mod.id] } || {};
                                                            setFormData(p => ({
                                                                ...p,
                                                                permisosModulos: {
                                                                    ...p.permisosModulos,
                                                                    [mod.id]: { ...current, [cap.key]: !isActive }
                                                                }
                                                            }));
                                                        }}
                                                        className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 transition-all ${isActive
                                                            ? `${cap.activeColor} border-transparent text-white shadow-md transform scale-105`
                                                            : `bg-white border-slate-100 text-slate-400 ${cap.hoverColor} hover:border-slate-200 hover:text-slate-600`
                                                            }`}
                                                    >
                                                        <cap.icon size={12} className={isActive ? 'animate-pulse' : ''} />
                                                        <span className="text-[8px] font-black uppercase tracking-tighter">{cap.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                        <button
                            onClick={isCreate ? handleCreateUser : handleUpdateUser}
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

    // ── FORM MODAL EMPRESA ────────────────────────────────────────────────────
    const renderFormModalEmpresa = (isCreate) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }`}</style>

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{isCreate ? 'Nueva Empresa' : 'Configurar Empresa'}</h3>
                        <div className="h-1.5 w-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full mt-2" />
                    </div>
                    <button onClick={() => setModal(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 text-slate-500 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-10">
                    {/* SECCIÓN 1: DATOS CORPORATIVOS */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Building2 size={18} /></div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]">Información Corporativa</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Razón Social / Nombre</label>
                                <input type="text" value={empresaFormData.nombre || ''} onChange={e => setEmpresaFormData(p => ({ ...p, nombre: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" required />
                            </div>
                            <InternationalInput
                                label="RUT de Empresa"
                                value={empresaFormData.rut || ''}
                                onChange={e => setEmpresaFormData(p => ({ ...p, rut: e.target.value }))}
                                selectedCountry={empresaFormData.pais}
                                onCountryChange={val => setEmpresaFormData(p => ({ ...p, pais: val }))}
                                placeholder="12.345.678-K"
                            />
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Giro Comercial</label>
                                <input type="text" value={empresaFormData.giroComercial || ''} onChange={e => setEmpresaFormData(p => ({ ...p, giroComercial: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Dirección Comercial</label>
                                <input type="text" value={empresaFormData.direccion || ''} onChange={e => setEmpresaFormData(p => ({ ...p, direccion: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Email General</label>
                                <input type="email" value={empresaFormData.email || ''} onChange={e => setEmpresaFormData(p => ({ ...p, email: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                            </div>
                            <InternationalInput
                                label="Teléfono"
                                value={empresaFormData.telefono || ''}
                                onChange={e => setEmpresaFormData(p => ({ ...p, telefono: e.target.value }))}
                                selectedCountry={empresaFormData.pais}
                                onCountryChange={val => setEmpresaFormData(p => ({ ...p, pais: val }))}
                                isPhone={true}
                            />
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Slug (Identificador)</label>
                                <input type="text" value={empresaFormData.slug || ''} onChange={e => setEmpresaFormData(p => ({ ...p, slug: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-500 text-sm font-semibold focus:outline-none" placeholder="auto-generado" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Industria</label>
                                <input type="text" value={empresaFormData.industria || ''} onChange={e => setEmpresaFormData(p => ({ ...p, industria: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Sitio Web</label>
                                <div className="relative">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input type="text" value={empresaFormData.web || ''} onChange={e => setEmpresaFormData(p => ({ ...p, web: e.target.value }))} className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" placeholder="https://..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN 2: REPRESENTANTES LEGALES */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-50 rounded-xl text-violet-600"><Users size={18} /></div>
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]">Representantes Legales</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEmpresaFormData(p => ({ ...p, representantesLegales: [...p.representantesLegales, { rut: '', nombre: '', email: '', telefono: '' }] }))}
                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> Agregar
                            </button>
                        </div>

                        <div className="space-y-4">
                            {empresaFormData.representantesLegales.length === 0 && (
                                <div className="py-8 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No hay representantes registrados</p>
                                </div>
                            )}
                            {empresaFormData.representantesLegales.map((rep, idx) => (
                                <div key={idx} className="bg-white border-2 border-slate-100 rounded-3xl p-6 relative group hover:border-indigo-100 transition-all">
                                    <button
                                        onClick={() => setEmpresaFormData(p => ({ ...p, representantesLegales: p.representantesLegales.filter((_, i) => i !== idx) }))}
                                        className="absolute -top-3 -right-3 p-2.5 bg-white border-2 border-slate-100 text-red-500 rounded-2xl hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RUT</label>
                                            <input type="text" value={rep.rut || ''} onChange={e => {
                                                const list = [...empresaFormData.representantesLegales];
                                                list[idx].rut = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, representantesLegales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" />
                                        </div>
                                        <div className="md:col-span-2 space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                                            <input type="text" value={rep.nombre || ''} onChange={e => {
                                                const list = [...empresaFormData.representantesLegales];
                                                list[idx].nombre = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, representantesLegales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email</label>
                                            <input type="email" value={rep.email || ''} onChange={e => {
                                                const list = [...empresaFormData.representantesLegales];
                                                list[idx].email = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, representantesLegales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN 3: CONTACTOS COMERCIALES */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-xl text-amber-600"><Search size={18} /></div>
                                <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]">Contactos Comerciales</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEmpresaFormData(p => ({ ...p, contactosComerciales: [...p.contactosComerciales, { nombre: '', email: '', telefono: '' }] }))}
                                className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all flex items-center gap-2"
                            >
                                <Plus size={14} /> Agregar
                            </button>
                        </div>

                        <div className="space-y-4">
                            {empresaFormData.contactosComerciales.length === 0 && (
                                <div className="py-8 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">No hay contactos comerciales registrados</p>
                                </div>
                            )}
                            {empresaFormData.contactosComerciales.map((c, idx) => (
                                <div key={idx} className="bg-white border-2 border-slate-100 rounded-3xl p-6 relative group hover:border-amber-100 transition-all">
                                    <button
                                        onClick={() => setEmpresaFormData(p => ({ ...p, contactosComerciales: p.contactosComerciales.filter((_, i) => i !== idx) }))}
                                        className="absolute -top-3 -right-3 p-2.5 bg-white border-2 border-slate-100 text-red-500 rounded-2xl hover:bg-red-50 hover:border-red-100 transition-all shadow-sm"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre</label>
                                            <input type="text" value={c.nombre || ''} onChange={e => {
                                                const list = [...empresaFormData.contactosComerciales];
                                                list[idx].nombre = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, contactosComerciales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email</label>
                                            <input type="email" value={c.email || ''} onChange={e => {
                                                const list = [...empresaFormData.contactosComerciales];
                                                list[idx].email = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, contactosComerciales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Teléfono</label>
                                            <input type="text" value={c.telefono || ''} onChange={e => {
                                                const list = [...empresaFormData.contactosComerciales];
                                                list[idx].telefono = e.target.value;
                                                setEmpresaFormData(p => ({ ...p, contactosComerciales: list }));
                                            }} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-400" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECCIÓN 4: CONTRATO */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Save size={18} /></div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-[0.2em]">Detalles de Contratación</p>
                        </div>

                        <div className="bg-slate-50 border-2 border-slate-200 rounded-[2.5rem] p-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Inicio de Contrato</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="date" value={empresaFormData.fechaInicioContrato || ''} onChange={e => setEmpresaFormData(p => ({ ...p, fechaInicioContrato: e.target.value }))} className="w-full pl-12 pr-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Duración (Meses)</label>
                                    <input type="number" value={empresaFormData.duracionMeses || ''} onChange={e => setEmpresaFormData(p => ({ ...p, duracionMeses: e.target.value }))} className="w-full px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all" placeholder="Ej: 12" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Término del Contrato</label>
                                    <input type="date" value={empresaFormData.fechaTerminoContrato || ''} disabled className="w-full px-5 py-3.5 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-500 text-sm font-black cursor-not-allowed" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Total Mensual (UF)</label>
                                    <input type="number" step="0.01" value={empresaFormData.totalMensualUF || ''} onChange={e => setEmpresaFormData(p => ({ ...p, totalMensualUF: e.target.value }))} className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-indigo-700 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all shadow-sm" />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Límite de Usuarios</label>
                                    <input type="number" value={empresaFormData.limiteUsuarios || 5} onChange={e => setEmpresaFormData(p => ({ ...p, limiteUsuarios: e.target.value }))} className="w-full px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-indigo-600 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Valor Usuario (UF)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input type="number" step="0.01" value={empresaFormData.valorUsuarioUF || ''} onChange={e => setEmpresaFormData(p => ({ ...p, valorUsuarioUF: e.target.value }))} className="w-full pl-12 pr-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Plan contratado</label>
                                    <select value={empresaFormData.plan} onChange={e => setEmpresaFormData(p => ({ ...p, plan: e.target.value }))} className="w-full px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all">
                                        <option value="starter">Starter</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">Módulos Contratados (Activos)</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {[
                                            { id: 'rrhh', label: 'RRHH' },
                                            { id: 'prevencion', label: 'Prevención HSE' },
                                            { id: 'operaciones', label: 'Operaciones' },
                                            { id: 'agentetelecom', label: 'Agente Telecom' },
                                            { id: 'comercial', label: 'Comercial' },
                                            { id: 'finanzas', label: 'Finanzas' }
                                        ].map(m => {
                                            const isActive = empresaFormData.modulosActivos.includes(m.id);
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = empresaFormData.modulosActivos;
                                                        const newVal = isActive
                                                            ? current.filter(id => id !== m.id)
                                                            : [...current, m.id];
                                                        setEmpresaFormData(p => ({ ...p, modulosActivos: newVal }));
                                                    }}
                                                    className={`py-3 px-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all flex items-center justify-between ${isActive
                                                        ? 'bg-indigo-600 border-transparent text-white shadow-md shadow-indigo-100'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                                        }`}
                                                >
                                                    {m.label}
                                                    {isActive && <CheckCircle2 size={12} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="md:col-span-3 space-y-4">
                                    <label className="block text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">Modo de Servicio & Estado</label>
                                    <div className="flex gap-4">
                                        <select value={empresaFormData.modoServicio} onChange={e => setEmpresaFormData(p => ({ ...p, modoServicio: e.target.value }))} className="flex-1 px-5 py-3.5 bg-indigo-50 border-2 border-indigo-100 rounded-2xl text-indigo-700 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all">
                                            <option value="FULL_HR_360">HR 360 (Integral)</option>
                                            <option value="RECRUITMENT_ONLY">AGENT (Solo Reclutamiento)</option>
                                        </select>
                                        <select value={empresaFormData.estado} onChange={e => setEmpresaFormData(p => ({ ...p, estado: e.target.value }))} className="flex-1 px-5 py-3.5 bg-emerald-50 border-2 border-emerald-100 rounded-2xl text-emerald-700 text-sm font-black focus:outline-none focus:border-indigo-400 transition-all">
                                            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-slate-100">
                        <button onClick={() => setModal(null)} className="flex-1 py-5 rounded-3xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
                        <button
                            onClick={isCreate ? handleCreateEmpresa : handleUpdateEmpresa}
                            disabled={saving}
                            className="flex-1 py-5 rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-indigo-200"
                        >
                            {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> {isCreate ? 'Generar Contrato' : 'Actualizar Contrato'}</>}
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
                        <button onClick={openCreateUser}
                            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                            <UserPlus size={16} /> Nuevo Usuario
                        </button>
                    )}
                    {view === 'companies' && (
                        <button onClick={openCreateEmpresa}
                            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                            <Building2 size={16} /> Nueva Empresa
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
                                                                <button onClick={() => openEditUser(u)} className="p-2.5 bg-indigo-50 hover:bg-indigo-600 rounded-xl text-indigo-600 hover:text-white transition-all">
                                                                    <Edit3 size={15} />
                                                                </button>
                                                                <button onClick={() => { setSelectedItem(u); setModal('deleteUser'); }} className="p-2.5 bg-red-50 hover:bg-red-600 rounded-xl text-red-500 hover:text-white transition-all">
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
                            {empresas.map((e, i) => {
                                const eUsers = users.filter(u => u.empresaRef?._id === e._id || u.empresa?.nombre === e.nombre);
                                const planColors = { starter: 'bg-slate-100 text-slate-600 border-slate-200', pro: 'bg-indigo-100 text-indigo-700 border-indigo-200', enterprise: 'bg-amber-100 text-amber-700 border-amber-200' };
                                const estadoColors = { Activo: 'bg-emerald-100 text-emerald-700', Inactivo: 'bg-slate-100 text-slate-500', Suspendido: 'bg-red-100 text-red-700' };

                                return (
                                    <div key={e._id} className="bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-indigo-200 hover:shadow-md transition-all relative group">
                                        <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => openEditEmpresa(e)} className="p-2 bg-indigo-50 hover:bg-indigo-600 rounded-xl text-indigo-600 hover:text-white transition-all">
                                                <Edit3 size={14} />
                                            </button>
                                            <button onClick={() => { setSelectedItem(e); setModal('deleteEmpresa'); }} className="p-2 bg-red-50 hover:bg-red-600 rounded-xl text-red-500 hover:text-white transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white text-xl font-black mb-5 shadow-lg shadow-indigo-200">
                                            {e.nombre?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <h3 className="text-base font-black text-slate-900 mb-1 pr-16 truncate">{e.nombre}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{e.rut || 'RUT no registrado'}</p>

                                        <div className="flex gap-2 mb-4">
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase border ${planColors[e.plan] || planColors.starter}`}>{e.plan}</span>
                                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${estadoColors[e.estado] || estadoColors.Inactivo}`}>{e.estado}</span>
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <Users size={12} /> {eUsers.length} usuarios
                                            </div>
                                            <span className="text-[9px] text-slate-300 font-black uppercase">{new Date(e.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                );
                            })}

                            {empresas.length === 0 && !loading && (
                                <div className="col-span-full py-20 text-center text-slate-400 font-black uppercase text-xs tracking-widest border-2 border-dashed border-slate-200 rounded-[2rem]">
                                    Aún no hay empresas registradas
                                </div>
                            )}
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
                                        <p className="text-2xl font-black text-indigo-700">{empresas.length}</p>
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
            {modal === 'createUser' && renderFormModal(true)}
            {modal === 'editUser' && renderFormModal(false)}
            {modal === 'createEmpresa' && renderFormModalEmpresa(true)}
            {modal === 'editEmpresa' && renderFormModalEmpresa(false)}

            {modal === 'deleteUser' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl text-center">
                        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] w-fit mx-auto mb-8">
                            <AlertTriangle size={40} className="text-red-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 mb-3">¿Eliminar Usuario?</h4>
                        <p className="text-slate-500 mb-8 text-sm"><span className="font-black text-slate-800">{selectedItem?.name}</span> será eliminado permanentemente del sistema.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                            <button onClick={handleDeleteUser} disabled={saving} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[11px] uppercase hover:bg-red-700 transition-all flex items-center justify-center disabled:opacity-60 gap-2 shadow-lg shadow-red-200">
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <><Trash2 size={16} /> Eliminar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modal === 'deleteEmpresa' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl text-center">
                        <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] w-fit mx-auto mb-8">
                            <AlertTriangle size={40} className="text-red-500" />
                        </div>
                        <h4 className="text-xl font-black text-slate-900 mb-3">¿Eliminar Empresa?</h4>
                        <p className="text-slate-500 mb-8 text-sm"><span className="font-black text-slate-800">{selectedItem?.nombre}</span> será eliminada permanentemente del sistema. No se eliminarán los usuarios asociados pero quedarán huérfanos.</p>
                        <div className="flex gap-4">
                            <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>
                            <button onClick={handleDeleteEmpresa} disabled={saving} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[11px] uppercase hover:bg-red-700 transition-all flex items-center justify-center disabled:opacity-60 gap-2 shadow-lg shadow-red-200">
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
