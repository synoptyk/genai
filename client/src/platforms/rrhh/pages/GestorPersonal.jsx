import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../auth/AuthContext';
import { Users, Search, Plus, Edit2, Shield, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatRut, validateRut } from '../../../utils/rutUtils';

const API_BASE = process.env.REACT_APP_API_URL || 'https://genai-backend-kdab.onrender.com/api';

const GestorPersonal = () => {
    const { user, authHeader } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modal, setModal] = useState(null); // 'create', 'edit'
    const [selectedUser, setSelectedUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [alert, setAlert] = useState(null);

    const defaultPermisosModulos = {
        // 1. Administración
        admin_proyectos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_conexiones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_aprobaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 2. Recursos Humanos
        rrhh_captura: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_documental: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_activos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_nomina: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_laborales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_vacaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_asistencia: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_turnos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 3. Prevención HSE
        prev_ast: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_procedimientos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_charlas: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_inspecciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_acreditacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_accidentes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_iper: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_auditoria: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_dashboard: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        prev_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 4. Flota & GPS
        flota_vehiculos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        flota_gps: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 5. Operaciones
        op_supervision: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        op_colaborador: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        op_portales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 6. Rendimiento Productivo
        rend_operativo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rend_financiero: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rend_tarifario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 7. Configuraciones
        cfg_baremos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_clientes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_empresa: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_personal: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
    };

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'user', cargo: '', status: 'Activo',
        permisosModulos: defaultPermisosModulos,
        sendEmailCredentials: true
    });

    useEffect(() => {
        if (user && (user.token || authHeader().Authorization)) {
            fetchUsers();
        } else if (user) {
            setLoading(false); // Si hay usuario pero sin token válido, no te quedes cargando
        }
    }, [user]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/auth/users`, { headers: authHeader() });
            // Asegurar que es un array para no romper el .filter() del render
            if (Array.isArray(res.data)) {
                setUsers(res.data);
            } else {
                console.error("La API no devolvió un array de usuarios:", res.data);
                setUsers([]);
                showAlert('Respuesta inválida del servidor', 'error');
            }
        } catch (error) {
            console.error(error);
            showAlert('Error al cargar personal', 'error');
        } finally {
            setLoading(false);
        }
    };

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const openCreateUser = () => {
        setFormData({
            name: '', email: '', password: '', role: 'user', cargo: '', status: 'Activo',
            permisosModulos: defaultPermisosModulos, sendEmailCredentials: true
        });
        setModal('create');
    };

    const openEditUser = (u) => {
        setSelectedUser(u);
        setFormData({
            name: u.name || '',
            email: u.email || '',
            password: '', // Blank
            role: u.role || 'user',
            cargo: u.cargo || '',
            status: u.status || 'Activo',
            permisosModulos: u.permisosModulos || defaultPermisosModulos,
            sendEmailCredentials: true
        });
        setModal('edit');
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...formData };
            if (modal === 'edit' && !payload.password) delete payload.password; // Do not update password if blank

            if (modal === 'create') {
                await axios.post(`${API_BASE}/auth/register`, payload, { headers: authHeader() });
                showAlert('Personal registrado correctamente');
            } else {
                await axios.put(`${API_BASE}/auth/users/${selectedUser._id}`, payload, { headers: authHeader() });
                showAlert('Personal actualizado correctamente');
            }
            setModal(null);
            fetchUsers();
        } catch (error) {
            showAlert(error.response?.data?.message || 'Error guardando usuario', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Derived variables: filtered rows
    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-full bg-slate-50 relative flex flex-col p-6 overflow-hidden">
            {/* ALERT */}
            {alert && (
                <div className={`fixed top-6 right-6 z-[100] min-w-[300px] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-10 duration-500
                    ${alert.type === 'error' ? 'bg-red-600 text-white shadow-red-600/20' : 'bg-emerald-600 text-white shadow-emerald-600/20'}`}>
                    {alert.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <span className="text-[11px] font-black uppercase tracking-widest">{alert.msg}</span>
                </div>
            )}

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-orange-600 text-white p-2.5 rounded-xl shadow-lg shadow-orange-600/20">
                            <Users size={20} />
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestión de Personal</h1>
                    </div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ajustes & Accesos de Colaboradores</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar Colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-700 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all shadow-sm"
                        />
                    </div>

                    {/* INDICADOR DE CUOTA */}
                    {user?.empresaRef && (
                        <div className="hidden lg:flex flex-col items-end px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Usuarios Activos</span>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-lg font-black ${users.length >= (user.empresaRef.limiteUsuarios || 5) ? 'text-red-600' : 'text-slate-800'}`}>
                                    {users.length}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">/ {user.empresaRef.limiteUsuarios || 5}</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={openCreateUser}
                        disabled={users.length >= (user?.empresaRef?.limiteUsuarios || 5)}
                        className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-[0.98]
                            ${users.length >= (user?.empresaRef?.limiteUsuarios || 5)
                                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'}`}
                    >
                        <Plus size={16} /> Alta
                    </button>
                </div>
            </div>

            {/* MAIN LIST */}
            <div className="flex-1 overflow-auto bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 hide-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">Cargando personal...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
                        <Users size={48} className="opacity-20 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest text-center">No se encontraron colaboradores</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 sticky top-0 backdrop-blur-md z-10 border-b border-slate-200">
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[250px]">Colaborador</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map(u => (
                                <tr key={u._id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-600 font-black shadow-inner border border-white">
                                                {u.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{u.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                                            ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                                u.role === 'administrativo' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                                                    u.role === 'supervisor_hse' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                                        'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                            {u.role === 'user' ? 'Trabajador Terreno' : u.role === 'administrativo' ? 'Administrativo' : u.role === 'supervisor_hse' ? 'Supervisor HSE' : 'Admin Empresa'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{u.cargo || 'No Definido'}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border
                                            ${u.status === 'Activo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                u.status === 'Inactivo' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                                    'bg-red-50 text-red-600 border-red-100'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Activo' ? 'bg-emerald-500' : u.status === 'Inactivo' ? 'bg-slate-400' : 'bg-red-500'}`} />
                                            {u.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openEditUser(u)} className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm">
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* USER FORM MODAL */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModal(null)} />
                    <div className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                                    {modal === 'create' ? 'Nuevo Colaborador' : 'Editar Colaborador'}
                                </h2>
                                <p className="text-[10px] font-black text-orange-500 mt-1 uppercase tracking-[0.2em]">Configuración de Accesos & Seguridad</p>
                            </div>
                            <button onClick={() => setModal(null)} className="p-2.5 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-2xl transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar flex-1 bg-slate-50/50">
                            <form id="userForm" onSubmit={handleSaveUser} className="space-y-8">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <label className="block text-[9px] font-black text-orange-600 uppercase tracking-widest ml-1">Identidad & Rol</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                                            <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Acceso</label>
                                            <input type="email" required value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RUT (Opcional)</label>
                                            <input type="text" value={formData.rut || ''} onChange={e => setFormData({ ...formData, rut: formatRut(e.target.value) })} className={`w-full px-4 py-2 bg-white border ${formData.rut && !validateRut(formData.rut) ? 'border-red-400 bg-red-50 text-red-600 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 text-slate-800 focus:border-orange-400 focus:ring-orange-500/10'} rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2`} placeholder="Ej: 12.345.678-9" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Rol de Plataforma</label>
                                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-700 outline-none">
                                                <option value="user">Trabajador Terreno (Portal Colab.)</option>
                                                <option value="supervisor_hse">Supervisor HSE (Terreno + PC)</option>
                                                <option value="administrativo">Administrativo (Uso Continuo PC)</option>
                                                <option value="admin">Administrador Empresa (Maestro)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Cargo Oficial</label>
                                            <input type="text" value={formData.cargo || ''} onChange={e => setFormData({ ...formData, cargo: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-800 outline-none" placeholder="Ej: Ingeniero Terreno" />
                                        </div>
                                    </div>
                                </div>

                                {/* Security Info */}
                                <div className="p-5 bg-white border border-slate-200 rounded-[2rem] shadow-sm">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                                            <Shield size={14} />
                                        </div>
                                        <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Seguridad de Acceso</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-6 items-center">
                                        <div className="space-y-1 relative max-w-sm">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Contraseña {modal === 'edit' && '(Opcional)'}</label>
                                            <input
                                                type={showPass ? 'text' : 'password'}
                                                value={formData.password || ''}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black tracking-widest text-slate-800 outline-none"
                                                placeholder={modal === 'create' ? "Asignar Contraseña Segura" : "Dejar en blanco para mantener actual"}
                                                required={modal === 'create'}
                                            />
                                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute bottom-2.5 right-3 text-slate-400 hover:text-slate-600">
                                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <input id="sendEmailCheckbox" type="checkbox" checked={formData.sendEmailCredentials !== false} onChange={e => setFormData(p => ({ ...p, sendEmailCredentials: e.target.checked }))} className="w-4 h-4 text-orange-600 rounded cursor-pointer" />
                                                <label htmlFor="sendEmailCheckbox" className="text-[10px] font-bold text-slate-600 cursor-pointer uppercase tracking-widest">Enviar credenciales por correo electrónico asignado</label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
                                                {['Activo', 'Inactivo', 'Suspendido'].map(st => (
                                                    <button key={st} type="button" onClick={() => setFormData({ ...formData, status: st })} className={`py-2 rounded-xl text-[9px] font-black shadow-sm transition-all uppercase tracking-widest border-2
                                                        ${formData.status === st ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-transparent bg-slate-50 text-slate-500'}`}>
                                                        {st}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Permissions Matrix */}
                                <div className="pt-8 border-t border-slate-100 mt-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                        <div>
                                            <p className="text-[12px] font-black text-indigo-700 uppercase tracking-[0.2em] flex items-center gap-2"><Shield size={16} /> Matriz de Permisos por Módulo</p>
                                            <p className="text-[10px] text-slate-500 font-bold mt-1 italic">Define las capacidades granulares para cada área</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const activeModIds = [
                                                    { id: 'admin_proyectos' }, { id: 'admin_conexiones' }, { id: 'admin_aprobaciones' }, { id: 'admin_historial' },
                                                    { id: 'rrhh_captura' }, { id: 'rrhh_documental' }, { id: 'rrhh_activos' }, { id: 'rrhh_nomina' }, { id: 'rrhh_laborales' }, { id: 'rrhh_vacaciones' }, { id: 'rrhh_asistencia' }, { id: 'rrhh_turnos' },
                                                    { id: 'prev_ast' }, { id: 'prev_procedimientos' }, { id: 'prev_charlas' }, { id: 'prev_inspecciones' }, { id: 'prev_acreditacion' }, { id: 'prev_accidentes' }, { id: 'prev_iper' }, { id: 'prev_auditoria' }, { id: 'prev_dashboard' }, { id: 'prev_historial' },
                                                    { id: 'flota_vehiculos' }, { id: 'flota_gps' },
                                                    { id: 'op_supervision' }, { id: 'op_colaborador' }, { id: 'op_portales' },
                                                    { id: 'rend_operativo' }, { id: 'rend_financiero' }, { id: 'rend_tarifario' },
                                                    { id: 'cfg_baremos' }, { id: 'cfg_clientes' }, { id: 'cfg_empresa' }, { id: 'cfg_personal' }
                                                ].map(m => m.id);

                                                let allSelected = true;
                                                for (const mId of activeModIds) {
                                                    const p = formData.permisosModulos?.[mId] || {};
                                                    if (!(p.ver && p.crear && p.editar && p.suspender && p.eliminar)) { allSelected = false; break; }
                                                }
                                                const newState = !allSelected;
                                                const nextPerms = { ...formData.permisosModulos };
                                                for (const mId of activeModIds) {
                                                    nextPerms[mId] = { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState };
                                                }
                                                setFormData(prev => ({ ...prev, permisosModulos: nextPerms }));
                                            }}
                                            className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={14} /> Seleccionar Todo General
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            {
                                                category: 'Administración', icon: Settings, color: 'indigo',
                                                modules: [
                                                    { id: 'admin_proyectos', label: 'Proyectos' },
                                                    { id: 'admin_conexiones', label: 'Conexiones API' },
                                                    { id: 'admin_aprobaciones', label: 'Aprobaciones' },
                                                    { id: 'admin_historial', label: 'Historial Operativo' }
                                                ]
                                            },
                                            {
                                                category: 'Recursos Humanos', icon: Users, color: 'violet',
                                                modules: [
                                                    { id: 'rrhh_captura', label: 'Captura de Talento' },
                                                    { id: 'rrhh_documental', label: 'Gestión Documental' },
                                                    { id: 'rrhh_activos', label: 'Personal Activo' },
                                                    { id: 'rrhh_nomina', label: 'Nómina (Payroll)' },
                                                    { id: 'rrhh_laborales', label: 'Relaciones Laborales' },
                                                    { id: 'rrhh_vacaciones', label: 'Vacaciones & Licencias' },
                                                    { id: 'rrhh_asistencia', label: 'Control Asistencia' },
                                                    { id: 'rrhh_turnos', label: 'Prog. de Turnos' }
                                                ]
                                            },
                                            {
                                                category: 'Prevención HSE', icon: Shield, color: 'rose',
                                                modules: [
                                                    { id: 'prev_ast', label: 'Generación AST' },
                                                    { id: 'prev_procedimientos', label: 'Procedimientos & PTS' },
                                                    { id: 'prev_charlas', label: 'Difusión & Charlas' },
                                                    { id: 'prev_inspecciones', label: 'Cumplimiento Prev.' },
                                                    { id: 'prev_acreditacion', label: 'Acreditación & PPE' },
                                                    { id: 'prev_accidentes', label: 'Investigación Accidentes' },
                                                    { id: 'prev_iper', label: 'Matriz IPER' },
                                                    { id: 'prev_auditoria', label: 'Auditoría HSE' },
                                                    { id: 'prev_dashboard', label: 'Dashboard HSE' },
                                                    { id: 'prev_historial', label: 'Historial Prev.' }
                                                ]
                                            },
                                            {
                                                category: 'Flota & GPS', icon: Globe, color: 'sky',
                                                modules: [
                                                    { id: 'flota_vehiculos', label: 'Flota de Vehículos' },
                                                    { id: 'flota_gps', label: 'Monitor GPS' }
                                                ]
                                            },
                                            {
                                                category: 'Operaciones', icon: Activity, color: 'blue',
                                                modules: [
                                                    { id: 'op_supervision', label: 'Portal Supervisión' },
                                                    { id: 'op_colaborador', label: 'Portal Colaborador' },
                                                    { id: 'op_portales', label: 'Gestión de Portales' }
                                                ]
                                            },
                                            {
                                                category: 'Rendimiento Productivo', icon: DollarSign, color: 'emerald',
                                                modules: [
                                                    { id: 'rend_operativo', label: 'Producción Operativa' },
                                                    { id: 'rend_financiero', label: 'Producción Financiera' },
                                                    { id: 'rend_tarifario', label: 'Tarifario & Baremos' }
                                                ]
                                            },
                                            {
                                                category: 'Configuraciones', icon: Settings, color: 'orange',
                                                modules: [
                                                    { id: 'cfg_baremos', label: 'Baremos Base' },
                                                    { id: 'cfg_clientes', label: 'Tarifario Clientes' },
                                                    { id: 'cfg_empresa', label: 'Config. Empresa' },
                                                    { id: 'cfg_personal', label: 'Gestión de Personal' }
                                                ]
                                            }
                                        ].map((cat, catIdx) => {
                                            const activeModules = cat.modules;

                                            return (
                                                <div key={catIdx} className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className={`p-2.5 bg-${cat.color}-100 text-${cat.color}-600 rounded-xl`}>
                                                            <cat.icon size={18} />
                                                        </div>
                                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{cat.category}</h3>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {activeModules.map(mod => (
                                                            <div key={mod.id} className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-orange-200 transition-all group shadow-sm">
                                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                                    <div className="min-w-[150px]">
                                                                        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider group-hover:text-orange-600 transition-colors">{mod.label}</h4>
                                                                        <p className="text-[8px] text-slate-400 font-bold mt-0.5">Permisos específicos</p>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {[
                                                                            { key: 'ver', label: 'VER', activeColor: 'bg-sky-500', hoverColor: 'hover:bg-sky-50', textHover: 'hover:text-sky-600' },
                                                                            { key: 'crear', label: 'CREAR', activeColor: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-50', textHover: 'hover:text-emerald-600' },
                                                                            { key: 'editar', label: 'EDITAR', activeColor: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-50', textHover: 'hover:text-indigo-600' },
                                                                            { key: 'suspender', label: 'BLOQ', activeColor: 'bg-amber-500', hoverColor: 'hover:bg-amber-50', textHover: 'hover:text-amber-600' },
                                                                            { key: 'eliminar', label: 'ELIM', activeColor: 'bg-red-500', hoverColor: 'hover:bg-red-50', textHover: 'hover:text-red-600' }
                                                                        ].map(cap => {
                                                                            const isActive = formData.permisosModulos?.[mod.id]?.[cap.key];
                                                                            return (
                                                                                <button
                                                                                    key={cap.key}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const current = { ...(formData.permisosModulos?.[mod.id] || defaultPermisosModulos[mod.id]) };
                                                                                        setFormData(p => ({
                                                                                            ...p,
                                                                                            permisosModulos: {
                                                                                                ...p.permisosModulos,
                                                                                                [mod.id]: { ...current, [cap.key]: !isActive }
                                                                                            }
                                                                                        }));
                                                                                    }}
                                                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 transition-all ${isActive
                                                                                        ? `${cap.activeColor} border-transparent text-white shadow-md transform scale-105`
                                                                                        : `bg-slate-50 border-slate-100 text-slate-400 ${cap.hoverColor} ${cap.textHover} hover:border-slate-200`
                                                                                        }`}
                                                                                >
                                                                                    <span className="text-[9px] font-black uppercase tracking-tighter">{cap.label}</span>
                                                                                </button>
                                                                            );
                                                                        })}

                                                                        <div className="h-6 w-[1px] bg-slate-100 mx-1 hidden lg:block"></div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const p = formData.permisosModulos?.[mod.id] || {};
                                                                                const allSelected = p.ver && p.crear && p.editar && p.suspender && p.eliminar;
                                                                                const newState = !allSelected;
                                                                                setFormData(prev => ({
                                                                                    ...prev,
                                                                                    permisosModulos: {
                                                                                        ...prev.permisosModulos,
                                                                                        [mod.id]: { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState }
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            className="px-3 py-2 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-orange-600 hover:text-white hover:shadow-md transition-all ml-auto lg:ml-0"
                                                                        >
                                                                            {(() => {
                                                                                const p = formData.permisosModulos?.[mod.id] || {};
                                                                                return (p.ver && p.crear && p.editar && p.suspender && p.eliminar) ? 'Ninguno' : 'Todos';
                                                                            })()}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] flex items-center justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setModal(null)} className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancelar</button>
                            <button form="userForm" type="submit" disabled={saving} className="bg-orange-600 hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-orange-600/20 transition-all">
                                {saving ? <><Activity size={16} className="animate-spin" /> Procesando...</> : <><Save size={16} /> Completar Registro</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestorPersonal;
