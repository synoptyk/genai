import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../auth/AuthContext';
import { Users, Search, Plus, Edit2, Shield, X, Save, AlertCircle, CheckCircle2, Eye, EyeOff, Activity, Globe, DollarSign, Settings, Download, Clock, Package, Lock } from 'lucide-react';
import { formatRut, validateRut } from '../../../utils/rutUtils';

import API_URL from '../../../config';

const API_BASE = `${API_URL}/api`;

const defaultPermisosModulos = {
    // ── ADMINISTRACIÓN ──────────────────────────────────────────────────────
    admin_resumen_ejecutivo:        { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_modelos_bonificacion:     { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_proyectos:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_conexiones:               { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_aprobaciones:             { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_historial:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_sii:                      { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_previred:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_pagos_bancarios:          { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_dashboard_tributario:     { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_aprobaciones_compras:     { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    admin_gestion_portales:         { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── RECURSOS HUMANOS ────────────────────────────────────────────────────
    rrhh_captura:                   { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_documental:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_activos:                   { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_nomina:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_laborales:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_vacaciones:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_asistencia:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rrhh_turnos:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── PREVENCIÓN HSE ──────────────────────────────────────────────────────
    prev_ast:                       { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_procedimientos:            { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_charlas:                   { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_inspecciones:              { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_acreditacion:              { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_accidentes:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_iper:                      { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_auditoria:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_dashboard:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    prev_historial:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── FLOTA & GPS ─────────────────────────────────────────────────────────
    flota_vehiculos:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    flota_gps:                      { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── OPERACIONES ─────────────────────────────────────────────────────────
    op_supervision:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    op_colaborador:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    op_portales:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    op_dotacion:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    op_mapa_calor:                  { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    op_designaciones:               { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── RENDIMIENTO PRODUCTIVO ──────────────────────────────────────────────
    rend_operativo:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rend_financiero:                { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    rend_tarifario:                 { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── LOGÍSTICA 360 ───────────────────────────────────────────────────────
    logistica_dashboard:            { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_configuracion:        { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_inventario:           { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_compras:              { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_proveedores:          { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_almacenes:            { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_movimientos:          { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_despachos:            { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    logistica_historial:            { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── CONFIGURACIONES ─────────────────────────────────────────────────────
    cfg_baremos:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    cfg_clientes:                   { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    cfg_empresa:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    cfg_personal:                   { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
    // ── SOCIAL GENAI 360 ────────────────────────────────────────────────────
    social_chat:                    { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
};

const GestorPersonal = () => {
    // 1. Hooks y Contexto Central
    const { user, authHeader, resetUserPin } = useAuth();

    // 2. Estados Atómicos
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]); // Nueva lista para el CEO
    const [actualCompanyLimit, setActualCompanyLimit] = useState(5);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modal, setModal] = useState(null); // null | 'create' | 'edit'
    const [selectedUser, setSelectedUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [alert, setAlert] = useState(null);

    const [formData, setFormData] = useState({
        name: '', email: '', corporateEmail: '', password: '', role: 'user', cargo: '', status: 'Activo',
        empresaRef: '',
        permisosModulos: defaultPermisosModulos,
        sendEmailCredentials: true
    });

    // 3. Efecto Único e Irrompible: Carga inicial de datos
    useEffect(() => {
        // Al montarse el componente, ProtectedRoute ya validó que existe sesión.
        // Hacemos el fetch de inmediato, sin condicionales frágiles.
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 4. Lógica de Red y Datos a Prueba de Fallos
    const fetchUsers = async () => {
        setLoading(true);
        const headers = authHeader();

        try {
            // 1. Fetch de Usuarios (Crítico)
            const resUsers = await axios.get(`${API_BASE}/auth/users`, { headers });
            if (Array.isArray(resUsers.data)) {
                setUsers(resUsers.data);
            } else {
                setUsers([]);
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            setUsers([]);
            showAlert('Error al cargar la lista de colaboradores', 'error');
        }

        try {
            // 2. Fetch de Límite (No crítico, fallback a 5 o al valor de sesión)
            const resEmpresa = await axios.get(`${API_BASE}/empresas/mi-empresa`, { headers });
            if (resEmpresa.data?.limiteUsuarios) {
                setActualCompanyLimit(resEmpresa.data.limiteUsuarios);
            }
        } catch (error) {
            const serverMsg = error.response?.data?.message || error.message;
            console.warn('Fallo en /mi-empresa:', serverMsg);
            
            // Fallback silencioso: Usar el valor del contexto si existe, si no 5.
            const fallback = user?.empresaRef?.limiteUsuarios || 5;
            setActualCompanyLimit(fallback);
        }

        // 3. Fetch de Empresas (Solo si es CEO)
        if (['ceo_genai', 'ceo'].includes(user?.role)) {
            try {
                const resComp = await axios.get(`${API_BASE}/empresas`, { headers });
                setCompanies(resComp.data);
            } catch (err) {
                console.warn('No se pudieron cargar las empresas para administración global');
            }
        }

        setLoading(false);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...formData };
            if (modal === 'edit' && !payload.password) delete payload.password;

            if (modal === 'create') {
                await axios.post(`${API_BASE}/auth/register`, payload, { headers: authHeader() });
                showAlert('Colaborador creado con éxito', 'success');
            } else {
                await axios.put(`${API_BASE}/auth/users/${selectedUser._id}`, payload, { headers: authHeader() });
                showAlert('Colaborador actualizado con éxito', 'success');
            }

            setModal(null);
            await fetchUsers(); // Refrescar tabla silenciosamente
        } catch (error) {
            console.error('Save User Error:', error);
            const msg = error.response?.data?.message || 'Error desconocido al guardar';
            showAlert(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    // 5. Utilidades UI
    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const openCreateUser = () => {
        setFormData({
            name: '', email: '', corporateEmail: '', password: '', role: 'user', cargo: '', status: 'Activo',
            empresaRef: user?.empresaRef?._id || user?.empresaRef || '',
            permisosModulos: defaultPermisosModulos, sendEmailCredentials: true
        });
        setModal('create');
    };

    const openEditUser = (u) => {
        setSelectedUser(u);
        setFormData({
            name: u.name || '',
            email: u.email || '',
            corporateEmail: u.corporateEmail || '',
            password: '',
            role: u.role || 'user',
            cargo: u.cargo || '',
            status: u.status || 'Activo',
            empresaRef: u.empresaRef?._id || u.empresaRef || '',
            permisosModulos: u.permisosModulos || defaultPermisosModulos,
            sendEmailCredentials: true
        });
        setModal('edit');
    };

    const togglePermission = (modId, capKey) => {
        setFormData(prev => {
            const currentMod = prev.permisosModulos[modId] || { ...defaultPermisosModulos[modId] };
            return {
                ...prev,
                permisosModulos: {
                    ...prev.permisosModulos,
                    [modId]: { ...currentMod, [capKey]: !currentMod[capKey] }
                }
            };
        });
    };

    const toggleModulePermissions = (modId) => {
        setFormData(prev => {
            const mod = prev.permisosModulos[modId] || {};
            const allSelected = mod.ver && mod.crear && mod.editar && mod.suspender && mod.eliminar;
            const newState = !allSelected;
            return {
                ...prev,
                permisosModulos: {
                    ...prev.permisosModulos,
                    [modId]: { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState }
                }
            };
        });
    };

    const toggleAllGlobalPermissions = () => {
        const activeModIds = Object.keys(defaultPermisosModulos);
        let allSelected = true;

        for (const mId of activeModIds) {
            const p = formData.permisosModulos?.[mId] || {};
            if (!(p.ver && p.crear && p.editar && p.suspender && p.eliminar)) {
                allSelected = false;
                break;
            }
        }

        const newState = !allSelected;
        const nextPerms = {};
        for (const mId of activeModIds) {
            nextPerms[mId] = { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState };
        }

        setFormData(prev => ({ ...prev, permisosModulos: nextPerms }));
    };

    // 6. Vista Derivada
    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isLimitReached = actualCompanyLimit && users.length >= actualCompanyLimit;

    // 7. Render Principal
    return (
        <div className="h-full bg-slate-50 relative flex flex-col p-6 overflow-hidden">
            {/* ALERT FLOTANTE PREMIUM */}
            {alert && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] min-w-[320px] flex items-center gap-4 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500
                    ${alert.type === 'error'
                        ? 'bg-red-500/90 text-white border-red-400/50 shadow-red-500/20'
                        : 'bg-emerald-500/90 text-white border-emerald-400/50 shadow-emerald-500/20'}`}>
                    <div className="bg-white/20 p-2 rounded-xl shadow-inner">
                        {alert.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-70">Sistema GenAI</span>
                        <span className="text-[12px] font-black uppercase tracking-wider mt-1">{alert.msg}</span>
                    </div>
                    <button onClick={() => setAlert(null)} className="ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={14} />
                    </button>
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
                                <span className={`text-lg font-black ${isLimitReached ? 'text-red-600' : 'text-slate-800'}`}>
                                    {users.length}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">/ {actualCompanyLimit}</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={openCreateUser}
                        disabled={isLimitReached}
                        className={`px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-[0.98]
                            ${isLimitReached
                                ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'}`}
                    >
                        <Plus size={16} /> Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* TABLA PRINCIPAL / LOADER */}
            <div className="flex-1 overflow-auto bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 hide-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <div className="w-10 h-10 border-4 border-slate-100 border-t-orange-500 rounded-full animate-spin" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Cargando Colaboradores...</span>
                    </div>
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
                                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empresa</th>
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
                                                {u.name?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{u.name}</div>
                                                <div className="text-[10px] font-bold text-slate-400">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${u.empresaRef ? 'text-slate-600' : 'text-orange-600'}`}>
                                                {u.empresaRef?.nombre || u.empresa?.nombre || '⚠️ SIN EMPRESA'}
                                            </span>
                                            {(!u.empresaRef || !u.empresaRef._id) && user.role === 'admin' && (
                                                <button 
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setFormData(prev => ({ ...prev, empresaRef: user.empresaRef?._id || user.empresaRef }));
                                                        handleSaveUser({ preventDefault: () => {}, target: { } });
                                                    }}
                                                    className="mt-1 text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter text-left"
                                                >
                                                    vincular a mi empresa
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest
                                            ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                                              u.role === 'gerencia' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                              u.role === 'jefatura' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                              u.role === 'auditor_empresa' ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                                              u.role === 'administrativo' ? 'bg-sky-100 text-sky-700 border border-sky-200' :
                                              u.role === 'supervisor_hse' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                              'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                            {u.role === 'admin' ? 'Admin Empresa' : 
                                             u.role === 'gerencia' ? 'Gerencia' :
                                             u.role === 'jefatura' ? 'Jefatura' :
                                             u.role === 'auditor_empresa' ? 'Auditor Empresa' :
                                             u.role === 'administrativo' ? 'Administrativo' : 
                                             u.role === 'supervisor_hse' ? 'Supervisor HSE' : 
                                             'Trabajador Terreno'}
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
                                        <button onClick={() => openEditUser(u)} className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm">
                                            <Edit2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* MODAL FORMULARIO */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setModal(null)} />
                    <div className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-500">
                        {/* Cabecera */}
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

                        {/* Cuerpo del Formulario */}
                        <div className="p-6 md:p-8 overflow-y-auto hide-scrollbar flex-1 bg-slate-50/50">
                            <form id="userForm" onSubmit={handleSaveUser} className="space-y-8">

                                {/* 1. Datos Personales */}
                                <div className="space-y-4">
                                    <label className="block text-[9px] font-black text-orange-600 uppercase tracking-widest ml-1">Identidad & Rol Oficial</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                                            <input type="text" required value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-800 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email LogIn (Gmail)</label>
                                            <input type="email" required value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] ml-1">Email Aprobación (Pertenencia)</label>
                                            <input type="email" value={formData.corporateEmail || ''} onChange={e => setFormData({ ...formData, corporateEmail: e.target.value })} className="w-full px-4 py-2 bg-indigo-50/30 border border-indigo-100 rounded-xl text-[11px] font-bold text-indigo-700 placeholder:text-indigo-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10" placeholder="opcional@empresa.com" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RUT (Opcional)</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={formData.rut || ''}
                                                    onChange={e => setFormData({ ...formData, rut: formatRut(e.target.value) })}
                                                    className={`w-full pl-4 pr-10 py-2 bg-white border ${formData.rut && !validateRut(formData.rut) ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-800'} rounded-xl text-[11px] font-bold focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10`}
                                                    placeholder="12.345.678-9"
                                                />
                                                {formData.rut && validateRut(formData.rut) && (
                                                    <CheckCircle2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                                                )}
                                                {formData.rut && !validateRut(formData.rut) && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                                                        <AlertCircle size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nivel del Sistema</label>
                                            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10">
                                                <option value="user">Trabajador (Portal Terreno)</option>
                                                <option value="supervisor_hse">Supervisor (Terreno + Web)</option>
                                                <option value="administrativo">Administrativo (Uso Web)</option>
                                                <option value="auditor_empresa">Auditor Empresa (Solo Lectura)</option>
                                                <option value="jefatura">Jefatura (Control Operativo)</option>
                                                <option value="gerencia">Gerencia (Estratégico)</option>
                                                <option value="admin">Admin Empresa (Total)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Asignación de Empresa</label>
                                            <select 
                                                value={formData.empresaRef} 
                                                onChange={e => setFormData({ ...formData, empresaRef: e.target.value })} 
                                                disabled={!['ceo_genai', 'ceo'].includes(user?.role)}
                                                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10 disabled:bg-slate-50 disabled:text-slate-400"
                                            >
                                                <option value="">-- Seleccionar Empresa --</option>
                                                {companies.map(c => (
                                                    <option key={c._id} value={c._id}>{c.nombre}</option>
                                                ))}
                                                {(!companies.length && user.empresaRef) && (
                                                    <option value={user.empresaRef?._id || user.empresaRef}>{user.empresa?.nombre}</option>
                                                )}
                                            </select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Cargo en Empresa</label>
                                            <input type="text" value={formData.cargo || ''} onChange={e => setFormData({ ...formData, cargo: e.target.value })} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10" placeholder="Ej: Especialista de Fibra Óptica" />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Seguridad */}
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
                                                className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-black tracking-widest text-slate-800 outline-none focus:border-orange-400"
                                                placeholder={modal === 'create' ? "Asignar Clave Segura" : "En blanco = Sin cambios"}
                                                required={modal === 'create'}
                                            />
                                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute bottom-2.5 right-3 text-slate-400 hover:text-orange-500">
                                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                                <input id="sendEmailCheckbox" type="checkbox" checked={formData.sendEmailCredentials !== false} onChange={e => setFormData(p => ({ ...p, sendEmailCredentials: e.target.checked }))} className="w-4 h-4 text-orange-600 rounded cursor-pointer" />
                                                <label htmlFor="sendEmailCheckbox" className="text-[10px] font-bold text-slate-600 cursor-pointer uppercase tracking-widest">Notificar credenciales por email</label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 w-full max-w-sm border border-slate-100 p-1 rounded-2xl bg-slate-50">
                                                {['Activo', 'Inactivo', 'Suspendido'].map(st => (
                                                    <button key={st} type="button" onClick={() => setFormData({ ...formData, status: st })} className={`py-2.5 rounded-xl text-[9px] font-black shadow-sm transition-all uppercase tracking-widest border-2
                                                        ${formData.status === st ? 'border-orange-500 bg-white text-orange-700' : 'border-transparent text-slate-400 hover:bg-white/50'}`}>
                                                        {st}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Matriz de Permisos */}
                                <div className="pt-8 border-t border-slate-100 mt-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                        <div>
                                            <p className="text-[12px] font-black text-indigo-700 uppercase tracking-[0.2em] flex items-center gap-2"><Shield size={16} /> Matriz de Permisos Global</p>
                                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Define acceso fino módulo por módulo</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={toggleAllGlobalPermissions}
                                            className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                        >
                                            <CheckCircle2 size={14} /> Otorgar / Revocar Todo
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {[
                                            {
                                                category: 'Administración', icon: Settings, color: 'indigo',
                                                modules: [
                                                    { id: 'admin_resumen_ejecutivo',    label: 'Resumen Ejecutivo (Dashboard)' },
                                                    { id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },
                                                    { id: 'admin_proyectos',            label: 'Proyectos & CECOs' },
                                                    { id: 'admin_conexiones',           label: 'Conexiones API' },
                                                    { id: 'admin_aprobaciones',         label: 'Aprobaciones RRHH' },
                                                    { id: 'admin_historial',            label: 'Historial Operativo' },
                                                    { id: 'admin_sii',                  label: 'Portal Tributario (SII)' },
                                                    { id: 'admin_previred',             label: 'Enlace Previred 360' },
                                                    { id: 'admin_pagos_bancarios',      label: 'Pagos Bancarios (Nómina)' },
                                                    { id: 'admin_dashboard_tributario', label: 'Dashboard Tributario' },
                                                    { id: 'admin_aprobaciones_compras', label: 'Aprobaciones de Compra' },
                                                    { id: 'admin_gestion_portales',     label: 'Gestión de Portales' },
                                                ]
                                            },
                                            {
                                                category: 'Recursos Humanos', icon: Users, color: 'violet',
                                                modules: [
                                                    { id: 'rrhh_captura',    label: 'Captura de Talento' },
                                                    { id: 'rrhh_documental', label: 'Gestión Documental' },
                                                    { id: 'rrhh_activos',    label: 'Personal Activo' },
                                                    { id: 'rrhh_nomina',     label: 'Nómina (Payroll)' },
                                                    { id: 'rrhh_laborales',  label: 'Relaciones Laborales' },
                                                    { id: 'rrhh_vacaciones', label: 'Vacaciones & Licencias' },
                                                    { id: 'rrhh_asistencia', label: 'Control Asistencia' },
                                                    { id: 'rrhh_turnos',     label: 'Programación de Turnos' },
                                                ]
                                            },
                                            {
                                                category: 'Prevención HSE', icon: Shield, color: 'rose',
                                                modules: [
                                                    { id: 'prev_ast',            label: 'Generación AST' },
                                                    { id: 'prev_procedimientos', label: 'Procedimientos & PTS' },
                                                    { id: 'prev_charlas',        label: 'Difusión & Charlas' },
                                                    { id: 'prev_inspecciones',   label: 'Cumplimiento Prev. (Inspecciones)' },
                                                    { id: 'prev_acreditacion',   label: 'Acreditación & PPE' },
                                                    { id: 'prev_accidentes',     label: 'Investigación Accidentes' },
                                                    { id: 'prev_iper',           label: 'Matriz IPER' },
                                                    { id: 'prev_auditoria',      label: 'Auditoría HSE' },
                                                    { id: 'prev_dashboard',      label: 'Dashboard HSE' },
                                                    { id: 'prev_historial',      label: 'Historial Preventivo' },
                                                ]
                                            },
                                            {
                                                category: 'Flota & GPS', icon: Globe, color: 'sky',
                                                modules: [
                                                    { id: 'flota_vehiculos', label: 'Flota de Vehículos' },
                                                    { id: 'flota_gps',       label: 'Monitor GPS en Vivo' },
                                                ]
                                            },
                                            {
                                                category: 'Operaciones', icon: Activity, color: 'blue',
                                                modules: [
                                                    { id: 'op_supervision',  label: 'Portal Supervisión' },
                                                    { id: 'op_colaborador',  label: 'Portal Colaborador' },
                                                    { id: 'op_portales',     label: 'Gestión de Portales' },
                                                    { id: 'op_dotacion',     label: 'Gestión Dotación' },
                                                    { id: 'op_mapa_calor',   label: 'Mapa de Calor' },
                                                    { id: 'op_designaciones',label: 'Designaciones' },
                                                ]
                                            },
                                            {
                                                category: 'Rendimiento Productivo', icon: DollarSign, color: 'emerald',
                                                modules: [
                                                    { id: 'rend_operativo',  label: 'Producción Operativa' },
                                                    { id: 'rend_financiero', label: 'Producción Financiera' },
                                                    { id: 'rend_tarifario',  label: 'Tarifario & Baremos' },
                                                ]
                                            },
                                            {
                                                category: 'Logística 360', icon: Package, color: 'sky',
                                                modules: [
                                                    { id: 'logistica_dashboard',     label: 'Dashboard Logístico' },
                                                    { id: 'logistica_configuracion', label: 'Configuración Maestra' },
                                                    { id: 'logistica_inventario',    label: 'Inventario & Activos' },
                                                    { id: 'logistica_compras',       label: 'Círculo de Compras' },
                                                    { id: 'logistica_proveedores',   label: 'Gestión de Proveedores' },
                                                    { id: 'logistica_almacenes',     label: 'Bodegas & Furgones' },
                                                    { id: 'logistica_movimientos',   label: 'Gestión Movimientos' },
                                                    { id: 'logistica_despachos',     label: 'Seguimiento Despachos' },
                                                    { id: 'logistica_historial',     label: 'Historial de Movimientos' },
                                                ]
                                            },
                                            {
                                                category: 'Configuraciones', icon: Settings, color: 'orange',
                                                modules: [
                                                    { id: 'cfg_baremos',  label: 'Baremos Base' },
                                                    { id: 'cfg_clientes', label: 'Tarifario Clientes' },
                                                    { id: 'cfg_empresa',  label: 'Config. Empresa' },
                                                    { id: 'cfg_personal', label: 'Gestión de Personal' },
                                                ]
                                            },
                                            {
                                                category: 'Social GenAI 360', icon: Globe, color: 'indigo',
                                                modules: [
                                                    { id: 'social_chat', label: 'Chat en Tiempo Real' },
                                                ]
                                            },
                                        ].map((cat, catIdx) => (
                                            <div key={catIdx} className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                                                <div className="flex items-center gap-3 mb-6">
                                                    <div className={`p-2.5 bg-${cat.color}-100 text-${cat.color}-600 rounded-xl`}>
                                                        <cat.icon size={18} />
                                                    </div>
                                                    <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{cat.category}</h3>
                                                </div>

                                                <div className="space-y-3">
                                                    {cat.modules.map(mod => (
                                                        <div key={mod.id} className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-orange-200 transition-all shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                                            <div className="min-w-[180px]">
                                                                <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{mod.label}</h4>
                                                                <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase">Ajustes de Lectura/Escritura</p>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {[
                                                                    { key: 'ver', label: 'VER', aColor: 'bg-sky-500', hColor: 'hover:bg-sky-50', tColor: 'text-sky-600' },
                                                                    { key: 'crear', label: 'CREAR', aColor: 'bg-emerald-500', hColor: 'hover:bg-emerald-50', tColor: 'text-emerald-600' },
                                                                    { key: 'editar', label: 'EDITAR', aColor: 'bg-indigo-500', hColor: 'hover:bg-indigo-50', tColor: 'text-indigo-600' },
                                                                    { key: 'suspender', label: 'BLOQ', aColor: 'bg-amber-500', hColor: 'hover:bg-amber-50', tColor: 'text-amber-600' },
                                                                    { key: 'eliminar', label: 'ELIM', aColor: 'bg-red-500', hColor: 'hover:bg-red-50', tColor: 'text-red-600' }
                                                                ].map(cap => {
                                                                    const isActive = formData.permisosModulos?.[mod.id]?.[cap.key];
                                                                    return (
                                                                        <button
                                                                            key={cap.key}
                                                                            type="button"
                                                                            onClick={() => togglePermission(mod.id, cap.key)}
                                                                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border-2 transition-all 
                                                                                ${isActive
                                                                                    ? `${cap.aColor} border-transparent text-white shadow-md transform scale-105`
                                                                                    : `bg-slate-50 border-slate-100 text-slate-400 ${cap.hColor} hover:${cap.tColor} hover:border-slate-200`}`}
                                                                        >
                                                                            {cap.label}
                                                                        </button>
                                                                    );
                                                                })}

                                                                <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden lg:block"></div>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleModulePermissions(mod.id)}
                                                                    className="px-4 py-2 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-500 hover:bg-slate-800 hover:text-white transition-all ml-auto xl:ml-0 shadow-sm"
                                                                >
                                                                    {(() => {
                                                                        const p = formData.permisosModulos?.[mod.id] || {};
                                                                        return (p.ver && p.crear && p.editar && p.suspender && p.eliminar) ? 'Ninguno' : 'Todos';
                                                                    })()}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Pie de Acciones */}
                        <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2.5rem] flex flex-col-reverse md:flex-row items-center justify-end gap-3 shrink-0">
                            <div className="flex-1 flex gap-2">
                                {modal === 'edit' && (user?.role === 'ceo_genai' || user?.role === 'ceo') && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (window.confirm('¿Estás seguro de reiniciar el PIN de este usuario? Podrá volver a entrar usando solo su contraseña.')) {
                                                try {
                                                    await resetUserPin(selectedUser._id);
                                                    setAlert({ type: 'success', message: 'PIN reiniciado con éxito' });
                                                } catch (e) {
                                                    setAlert({ type: 'error', message: 'Error al reiniciar PIN' });
                                                }
                                            }
                                        }}
                                        className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all flex items-center gap-2"
                                    >
                                        <Lock size={14} /> Reiniciar PIN
                                    </button>
                                )}
                            </div>
                            <button type="button" onClick={() => setModal(null)} className="w-full md:w-auto px-6 py-3.5 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancelar Opración</button>
                            <button form="userForm" type="submit" disabled={saving} className="w-full md:w-auto bg-orange-600 hover:bg-orange-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white px-10 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-orange-600/20 transition-all">
                                {saving ? <><Activity size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Completar Registro</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GestorPersonal;
