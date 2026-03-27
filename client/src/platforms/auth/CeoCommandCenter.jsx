import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Building2, Trash2, Edit3, X, Save, Loader2,
    Zap, BarChart3, Activity, CheckCircle2, AlertTriangle, LogOut,
    Eye as EyeIcon, EyeOff, Search, Crown, UserPlus, Settings, Home,
    Plus, Globe, Calendar, DollarSign, Clock, Sliders,
    Lock, Unlock, Shield, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import InternationalInput from '../../components/InternationalInput';
import { formatRut, validateRut } from '../../utils/rutUtils';

const ROLES = [
    { value: 'user', label: 'Trabajador Terreno', color: 'slate' },
    { value: 'supervisor_hse', label: 'Supervisor HSE', color: 'amber' },
    { value: 'administrativo', label: 'Administrativo (Oficina)', color: 'sky' },
    { value: 'auditor_empresa', label: 'Auditor Empresa', color: 'slate' },
    { value: 'jefatura', label: 'Jefatura', color: 'blue' },
    { value: 'gerencia', label: 'Gerencia', color: 'purple' },
    { value: 'admin', label: 'Admin Empresa', color: 'indigo' },
    { value: 'ceo_genai', label: 'CEO Gen AI', color: 'amber' }
];

const ESTADOS = ['Activo', 'Inactivo', 'Suspendido'];

const roleBadge = {
    ceo_genai: 'bg-amber-100 text-amber-800 border border-amber-200',
    admin: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    gerencia: 'bg-purple-100 text-purple-800 border border-purple-200',
    jefatura: 'bg-blue-100 text-blue-800 border border-blue-200',
    auditor_empresa: 'bg-slate-100 text-slate-800 border border-slate-200',
    administrativo: 'bg-sky-100 text-sky-800 border border-sky-200',
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
    const { user, logout, authHeader, API_BASE, auditCompany, setAuditCompany } = useAuth();
    const [view, setView] = useState('users');
    const [users, setUsers] = useState([]);
    const [empresas, setEmpresas] = useState([]);
    const [timeTrackers, setTimeTrackers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [modal, setModal] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null); // Remplaza selectedUser para ser genérico
    const [saving, setSaving] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [alert, setAlert] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    const defaultPermisosModulos = {
        // 1. Administración
        admin_resumen_ejecutivo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_modelos_bonificacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_proyectos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_conexiones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_aprobaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_sii: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_previred: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_pagos_bancarios: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_dashboard_tributario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_aprobaciones_compras: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_gestion_portales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_mis_clientes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        admin_gestion_gastos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 2. Recursos Humanos
        rrhh_captura: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_documental: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_activos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_nomina: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_laborales: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_vacaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_asistencia: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_turnos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_seguridad_ppe: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_contratos_anexos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rrhh_finiquitos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

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
        op_dotacion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        op_mapa_calor: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        op_designaciones: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        op_gastos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 6. Rendimiento Productivo
        rend_operativo: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rend_financiero: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        rend_tarifario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 7. Logística 360
        logistica_dashboard: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_configuracion: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_inventario: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_compras: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_proveedores: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_almacenes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_movimientos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_despachos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_historial: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        logistica_auditorias: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },

        // 8. Configuraciones & Social
        social_chat: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        comunic_video: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_baremos: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_clientes: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_empresa: { ver: false, crear: false, editar: false, suspender: false, eliminar: false },
        cfg_personal: { ver: false, crear: false, editar: false, suspender: false, eliminar: false }
    };

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'user',
        cargo: '', status: 'Activo',
        empresaRef: '', // ID de la empresa real
        permisosModulos: defaultPermisosModulos,
        sendEmailCredentials: true
    });

    const [empresaFormData, setEmpresaFormData] = useState({
        nombre: '', slug: '', rut: '', plan: 'starter', estado: 'Activo', permisosModulos: defaultPermisosModulos,
        giroComercial: '', direccion: '', telefono: '', email: '', web: '', pais: 'CL', industria: '',
        representantesLegales: [], contactosComerciales: [],
        fechaInicioContrato: '', duracionMeses: '', fechaTerminoContrato: '',
        limiteUsuarios: 5, valorUsuarioUF: '', totalMensualUF: '',
        modoServicio: 'FULL_HR_360',
        // --- ADMIN MAESTRO DE LA EMPRESA ---
        adminNombre: '', adminEmail: '', adminRut: '', adminPassword: ''
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
            const reqs = [
                axios.get(`${API_BASE}/auth/users`, { headers: authHeader() }),
                axios.get(`${API_BASE}/rrhh/time-tracker/diario`, { headers: authHeader() })
            ];

            // Solo el CEO puede ver y editar todas las empresas
            if (['ceo_genai', 'ceo'].includes(user?.role)) {
                reqs.push(axios.get(`${API_BASE}/empresas`, { headers: authHeader() }));
            }

            const [resUsers, resTrackers, resEmpresas] = await Promise.all(reqs);
            setUsers(resUsers.data);
            setTimeTrackers(resTrackers.data);
            if (resEmpresas) {
                setEmpresas(resEmpresas.data);
            }
        } catch { showAlert('Error al cargar datos del sistema', 'error'); }
        finally { setLoading(false); }
    };

    const showAlert = (message, type = 'success') => {
        setAlert({ msg: message, type });
        setTimeout(() => setAlert(null), 4000);
    };

    // --- USERS CRUD ---
    const openCreateUser = () => {
        const isAdmin = !['ceo_genai', 'ceo'].includes(user?.role);
        setFormData({
            name: '', email: '', password: '', rut: '', role: 'user', cargo: '', status: 'Activo',
            empresaRef: isAdmin ? user?.empresaRef?._id : '',
            permisosModulos: defaultPermisosModulos,
            sendEmailCredentials: true
        });
        setModal('createUser');
    };

    const openEditUser = (u) => {
        setSelectedItem(u);
        setFormData({
            name: u.name,
            email: u.email,
            password: '',
            rut: u.rut || '',
            role: u.role,
            cargo: u.cargo || '',
            status: u.status,
            empresaRef: u.empresaRef?._id || '',
            permisosModulos: u.permisosModulos || defaultPermisosModulos
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
        setConfirmModal({
            title: '¿Eliminar Usuario?',
            message: `Esta acción eliminará permanentemente a "${selectedItem.name}". Los registros históricos asociados podrían verse afectados.`,
            action: async () => {
                setConfirmModal(null);
                setSaving(true);
                try {
                    await axios.delete(`${API_BASE}/auth/users/${selectedItem._id}`, { headers: authHeader() });
                    showAlert('Usuario eliminado');
                    setModal(null); fetchData();
                } catch { showAlert('Error al eliminar', 'error'); }
                finally { setSaving(false); }
            }
        });
    };

    const handleResendCredentials = (u) => {
        setSelectedItem(u);
        setFormData(prev => ({ ...prev, password: '' })); // Limpiar password temporal
        setModal('changePassword');
    };

    const submitResendCredentials = async () => {
        if (!formData.password || formData.password.trim().length < 6) {
            showAlert('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        setSaving(true);
        try {
            await axios.post(`${API_BASE}/auth/users/${selectedItem._id}/resend-credentials`,
                { password: formData.password.trim() },
                { headers: authHeader() }
            );
            showAlert('Credenciales enviadas correctamente');
            setModal(null);
        } catch (e) {
            showAlert(e.response?.data?.message || 'Error al enviar', 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- EMPRESAS CRUD ---
    const openCreateEmpresa = () => {
        setEmpresaFormData({
            nombre: '', rut: '', plan: 'starter', estado: 'Activo', permisosModulos: defaultPermisosModulos,
            giroComercial: '', direccion: '', telefono: '', email: '', web: '', pais: 'CL', industria: '',
            representantesLegales: [], contactosComerciales: [],
            fechaInicioContrato: '', duracionMeses: '', fechaTerminoContrato: '',
            limiteUsuarios: 5, valorUsuarioUF: '', totalMensualUF: '',
            modoServicio: 'FULL_HR_360',
            adminNombre: '', adminEmail: '', adminRut: '', adminPassword: ''
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
            permisosModulos: e.permisosModulos || defaultPermisosModulos,
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
            modoServicio: e.modoServicio || 'FULL_HR_360',
            adminNombre: '', adminEmail: '', adminRut: '', adminPassword: ''
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
        { label: 'Empresas', value: empresas.length, icon: Building2, color: 'violet', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        { label: 'Activos', value: users.filter(u => u.status === 'Activo').length, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        { label: 'Suspendidos', value: users.filter(u => u.status === 'Suspendido').length, icon: AlertTriangle, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' }
    ];

    const navItems = [
        { id: 'users', icon: Users, label: 'Gestión de Usuarios' },
        ...(['ceo_genai', 'ceo'].includes(user?.role) ? [{ id: 'companies', icon: Building2, label: 'Empresas Activas' }] : []),
        { id: 'time', icon: Clock, label: 'Gestión de Tiempos' },
        { id: 'stats', icon: BarChart3, label: 'Estadísticas' },
        ...(['ceo_genai', 'ceo'].includes(user?.role) ? [{ id: 'settings', icon: Settings, label: 'Configuración' }] : [])
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[['name', 'Nombre Completo', 'col-span-2'], ['email', 'Email Corporativo', ''], ['rut', 'RUT (Opcional)', ''], ['cargo', 'Cargo', 'col-span-2']].map(([k, l, cls]) => (
                            <div key={k} className={cls}>
                                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{l}</label>
                                <input
                                    type={k === 'email' ? 'email' : 'text'}
                                    value={formData[k] || ''}
                                    onChange={e => setFormData(p => ({ ...p, [k]: k === 'rut' ? formatRut(e.target.value) : e.target.value }))}
                                    autoComplete="off"
                                    className={`w-full px-4 py-3 bg-slate-50 border-2 ${k === 'rut' && formData[k] && !validateRut(formData[k]) ? 'border-red-400 bg-red-50 text-red-600 focus:border-red-500' : 'border-slate-200 text-slate-900 focus:border-indigo-400'} rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-400 focus:bg-white transition-all`}
                                />
                                {k === 'rut' && formData[k] && !validateRut(formData[k]) && <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase tracking-tighter">RUT Inválido</p>}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Empresa Asignada *</label>
                            {['ceo_genai', 'ceo'].includes(user?.role) ? (
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
                            ) : (
                                <input
                                    type="text"
                                    value={user?.empresaRef?.nombre || 'Mi Empresa'}
                                    disabled
                                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-200 rounded-2xl text-slate-500 text-sm font-semibold cursor-not-allowed"
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Rol del Sistema</label>
                            <select value={formData.role} onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-400 transition-all">
                                {ROLES.filter(r => ['ceo_genai', 'ceo'].includes(user?.role) ? true : !['ceo_genai', 'ceo'].includes(r.value)).map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
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

                    <div className="pt-8 border-t border-slate-100 mt-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                            <div>
                                <p className="text-[12px] font-black text-indigo-700 uppercase tracking-[0.2em] flex items-center gap-2"><Shield size={16} /> Matriz de Permisos por Módulo</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-1 italic">Define las capacidades granulares para cada área</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const activeModIds = Object.keys(defaultPermisosModulos);

                                    let allSelected = true;
                                    for (const mId of activeModIds) {
                                        const p = formData.permisosModulos[mId] || {};
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
                                        { id: 'admin_resumen_ejecutivo', label: 'Resumen Ejecutivo' },
                                        { id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },
                                        { id: 'admin_proyectos', label: 'Proyectos & CECOs' },
                                        { id: 'admin_conexiones', label: 'Conexiones API' },
                                        { id: 'admin_aprobaciones', label: 'Aprobaciones RRHH' },
                                        { id: 'admin_sii', label: 'Portal Tributario (SII)' },
                                        { id: 'admin_previred', label: 'Enlace Previred 360' },
                                        { id: 'admin_pagos_bancarios', label: 'Pagos Bancarios (Nómina)' },
                                        { id: 'admin_dashboard_tributario', label: 'Dashboard Tributario' },
                                        { id: 'admin_aprobaciones_compras', label: 'Aprobaciones de Compra' },
                                        { id: 'admin_gestion_portales', label: 'Gestión de Portales' },
                                        { id: 'admin_mis_clientes', label: 'Mis Clientes' },
                                        { id: 'admin_gestion_gastos', label: 'Gestión Rinde Gastos (Admin)' },
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
                                        { id: 'rrhh_turnos', label: 'Prog. de Turnos' },
                                        { id: 'rrhh_seguridad_ppe', label: 'Seguridad & PPE' },
                                        { id: 'rrhh_contratos_anexos', label: 'Contratos y Anexos' },
                                        { id: 'rrhh_finiquitos', label: 'Gestión de Finiquitos' }
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
                                        { id: 'op_portales', label: 'Gestión de Portales' },
                                        { id: 'op_dotacion', label: 'Gestión Dotación' },
                                        { id: 'op_mapa_calor', label: 'Mapa de Calor' },
                                        { id: 'op_designaciones', label: 'Designaciones' },
                                        { id: 'op_gastos', label: 'Rinde Gastos (Usuario)' }
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
                                    category: 'Logística 360', icon: Zap, color: 'amber',
                                    modules: [
                                        { id: 'logistica_dashboard', label: 'Dashboard Logístico' },
                                        { id: 'logistica_configuracion', label: 'Configuración Maestra' },
                                        { id: 'logistica_inventario', label: 'Inventario & Activos' },
                                        { id: 'logistica_compras', label: 'Círculo de Compras' },
                                        { id: 'logistica_proveedores', label: 'Gestión de Proveedores' },
                                        { id: 'logistica_almacenes', label: 'Bodegas & Furgones' },
                                        { id: 'logistica_movimientos', label: 'Gestión Movimientos' },
                                        { id: 'logistica_despachos', label: 'Seguimiento Despachos' },
                                        { id: 'logistica_historial', label: 'Historial Movimientos' },
                                        { id: 'logistica_auditorias', label: 'Auditorías Logísticas' }
                                    ]
                                },
                                {
                                    category: 'Configuraciones & Social', icon: Settings, color: 'orange',
                                    modules: [
                                        { id: 'social_chat', label: 'Chat 360 (Social)' },
                                        { id: 'comunic_video', label: 'Video Llamadas' },
                                        { id: 'cfg_baremos', label: 'Baremos Base' },
                                        { id: 'cfg_clientes', label: 'Tarifario Clientes' },
                                        { id: 'cfg_empresa', label: 'Config. Empresa' },
                                        { id: 'cfg_personal', label: 'Gestión de Personal' }
                                    ]
                                }
                            ].map((cat, catIdx) => {
                                const activeModules = cat.modules;

                                if (activeModules.length === 0) return null;

                                return (
                                    <div key={catIdx} className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className={`p-2.5 bg-${cat.color}-100 text-${cat.color}-600 rounded-xl`}>
                                                <cat.icon size={18} />
                                            </div>
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{cat.category}</h3>
                                        </div>

                                        <div className="space-y-3">
                                            {activeModules.map(mod => (
                                                <div key={mod.id} className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-indigo-200 transition-all group shadow-sm">
                                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                        <div className="min-w-[150px]">
                                                            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">{mod.label}</h4>
                                                            <p className="text-[8px] text-slate-400 font-bold mt-0.5">Permisos específicos</p>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {[
                                                                { key: 'ver', label: 'VER', icon: EyeIcon, color: 'sky' },
                                                                { key: 'crear', label: 'CREAR', icon: Plus, color: 'emerald' },
                                                                { key: 'editar', label: 'EDITAR', icon: Edit3, color: 'indigo' },
                                                                { key: 'suspender', label: 'BLOQ', icon: Lock, color: 'amber' },
                                                                { key: 'eliminar', label: 'ELIM', icon: Trash2, color: 'red' }
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
                                                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 transition-all ${isActive
                                                                            ? `bg-${cap.color}-500 border-${cap.color}-500 text-white shadow-sm`
                                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                                                            }`}
                                                                    >
                                                                        <cap.icon size={11} />
                                                                        <span className="text-[8px] font-black">{cap.label}</span>
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
                                                                className="px-3 py-1.5 rounded-xl text-[8px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all ml-auto lg:ml-0"
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

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setModal(null)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase hover:bg-slate-50 transition-all">Cancelar</button>

                        {!isCreate && (
                            <button
                                type="button"
                                onClick={() => handleResendCredentials(selectedItem)}
                                className="px-6 py-4 rounded-2xl bg-amber-50 border-2 border-amber-100 text-amber-700 font-black text-[11px] uppercase hover:bg-amber-100 transition-all flex items-center gap-2"
                            >
                                <ShieldAlert size={18} /> Reenviar Credenciales
                            </button>
                        )}

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
                            <div className="space-y-2">
                                <InternationalInput
                                    label="RUT de Empresa"
                                    value={empresaFormData.rut || ''}
                                    onChange={e => setEmpresaFormData(p => ({ ...p, rut: formatRut(e.target.value) }))}
                                    selectedCountry={empresaFormData.pais}
                                    onCountryChange={val => setEmpresaFormData(p => ({ ...p, pais: val }))}
                                    placeholder="12.345.678-K"
                                />
                                {empresaFormData.rut && !validateRut(empresaFormData.rut) && (
                                    <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase tracking-tighter">RUT Inválido</p>
                                )}
                            </div>
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
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">RUT</label>
                                            <input type="text" value={rep.rut || ''} onChange={e => {
                                                const newReps = [...empresaFormData.representantesLegales];
                                                newReps[idx].rut = formatRut(e.target.value);
                                                setEmpresaFormData(p => ({ ...p, representantesLegales: newReps }));
                                            }} className={`w-full px-4 py-2 bg-white border ${rep.rut && !validateRut(rep.rut) ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200'} rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400`} placeholder="12.345.678-9" />
                                            {rep.rut && !validateRut(rep.rut) && <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase tracking-tighter">RUT Inválido</p>}
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

                                {isCreate && (
                                    <div className="md:col-span-3 space-y-4 pt-6 border-t border-slate-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><Crown size={14} /></div>
                                            <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest">Creación del Administrador Maestro</label>
                                        </div>
                                        <p className="text-[9px] text-slate-500 font-bold -mt-3 mb-4 italic">Se le enviarán las credenciales automáticamente y replicará los permisos base.</p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Nombre Administrador *</label>
                                                <input type="text" value={empresaFormData.adminNombre || ''} onChange={e => setEmpresaFormData(p => ({ ...p, adminNombre: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" required={isCreate} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Email Administrador *</label>
                                                <input type="email" value={empresaFormData.adminEmail || ''} onChange={e => setEmpresaFormData(p => ({ ...p, adminEmail: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" required={isCreate} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">RUT Administrador (Opcional)</label>
                                                <input type="text" value={empresaFormData.adminRut || ''} onChange={e => setEmpresaFormData(p => ({ ...p, adminRut: formatRut(e.target.value) }))} className={`w-full px-4 py-2.5 bg-slate-50 border ${empresaFormData.adminRut && !validateRut(empresaFormData.adminRut) ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200'} rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400`} placeholder="12.345.678-9" />
                                                {empresaFormData.adminRut && !validateRut(empresaFormData.adminRut) && <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase tracking-tighter">RUT Inválido</p>}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Contraseña Temporal *</label>
                                                <div className="relative">
                                                    <input type={showPass ? 'text' : 'password'} value={empresaFormData.adminPassword || ''} onChange={e => setEmpresaFormData(p => ({ ...p, adminPassword: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-400" required={isCreate} minLength={6} placeholder="Mínimo 6 caracteres" />
                                                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600">
                                                        {showPass ? <EyeOff size={14} /> : <EyeIcon size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const activeModIds = [
                                            'admin_resumen_ejecutivo', 'admin_modelos_bonificacion', 'admin_proyectos', 'admin_conexiones', 'admin_aprobaciones', 'admin_sii', 'admin_historial',
                                            'rrhh_captura', 'rrhh_documental', 'rrhh_activos', 'rrhh_nomina', 'rrhh_laborales', 'rrhh_vacaciones', 'rrhh_asistencia', 'rrhh_turnos',
                                            'prev_ast', 'prev_procedimientos', 'prev_charlas', 'prev_inspecciones', 'prev_acreditacion', 'prev_accidentes', 'prev_iper', 'prev_auditoria', 'prev_dashboard', 'prev_historial',
                                            'flota_vehiculos', 'flota_gps',
                                            'op_supervision', 'op_colaborador', 'op_portales', 'op_dotacion', 'op_mapa_calor', 'op_designaciones',
                                            'rend_operativo', 'rend_financiero', 'rend_tarifario',
                                            'cfg_baremos', 'cfg_clientes', 'cfg_empresa', 'cfg_personal'
                                        ];

                                        let allSelected = true;
                                        for (const mId of activeModIds) {
                                            const p = empresaFormData.permisosModulos?.[mId] || {};
                                            if (!(p.ver && p.crear && p.editar && p.suspender && p.eliminar)) { allSelected = false; break; }
                                        }
                                        const newState = !allSelected;
                                        const nextPerms = { ...(empresaFormData.permisosModulos || {}) };
                                        for (const mId of activeModIds) {
                                            nextPerms[mId] = { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState };
                                        }
                                        setEmpresaFormData(prev => ({ ...prev, permisosModulos: nextPerms }));
                                    }}
                                    className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                >
                                    <CheckCircle2 size={14} /> Seleccionar Todo General
                                </button>
                            </div>

                            <div className="space-y-8">
                                {[
                                    {
                                        category: 'Administración', icon: Settings, color: 'indigo',
                                        modules: [
                                            { id: 'admin_resumen_ejecutivo', label: 'Resumen Ejecutivo' },
                                            { id: 'admin_modelos_bonificacion', label: 'Modelos Bonificación' },
                                            { id: 'admin_proyectos', label: 'Proyectos & CECOs' },
                                            { id: 'admin_conexiones', label: 'Conexiones API' },
                                            { id: 'admin_aprobaciones', label: 'Aprobaciones RRHH' },
                                            { id: 'admin_sii', label: 'Portal Tributario (SII)' },
                                            { id: 'admin_historial', label: 'Historial Operativo' }
                                        ]
                                    },
                                    {
                                        category: 'Recursos Humanos', icon: Users, color: 'violet',
                                        modules: [
                                            { id: 'rrhh_captura', label: 'Captura de Talento' },
                                            { id: 'rrhh_documental', label: 'Gestión Documental' },
                                            { id: 'rrhh_activos', label: 'Nómina General' },
                                            { id: 'rrhh_nomina', label: 'Pago de Nómina' },
                                            { id: 'rrhh_laborales', label: 'Relaciones Laborales' },
                                            { id: 'rrhh_vacaciones', label: 'Vacaciones & Licencias' },
                                            { id: 'rrhh_asistencia', label: 'Asistencia y Turnos' },
                                            { id: 'rrhh_turnos', label: 'Planificación Horaria' }
                                        ]
                                    },
                                    {
                                        category: 'Prevención HSE', icon: ShieldCheck, color: 'rose',
                                        modules: [
                                            { id: 'prev_ast', label: 'Generación AST' },
                                            { id: 'prev_procedimientos', label: 'Procedimientos & PTS' },
                                            { id: 'prev_charlas', label: 'Difusión & Charlas' },
                                            { id: 'prev_inspecciones', label: 'Inspecciones' },
                                            { id: 'prev_acreditacion', label: 'Acreditación & PPE' },
                                            { id: 'prev_accidentes', label: 'Investigación Accidentes' },
                                            { id: 'prev_iper', label: 'Matriz IPER' },
                                            { id: 'prev_auditoria', label: 'Auditoría HSE' },
                                            { id: 'prev_dashboard', label: 'Dashboard HSE' },
                                            { id: 'prev_historial', label: 'Historial Prevención' }
                                        ]
                                    },
                                    {
                                        category: 'Flota & GPS', icon: Globe, color: 'sky',
                                        modules: [
                                            { id: 'flota_vehiculos', label: 'Gestión Vehículos' },
                                            { id: 'flota_gps', label: 'Monitor GPS' }
                                        ]
                                    },
                                    {
                                        category: 'Operaciones', icon: Activity, color: 'blue',
                                        modules: [
                                            { id: 'op_supervision', label: 'Portal Supervisión' },
                                            { id: 'op_colaborador', label: 'Portal Colaborador' },
                                            { id: 'op_portales', label: 'Gestión de Portales' },
                                            { id: 'op_dotacion', label: 'Gestión Dotación' },
                                            { id: 'op_mapa_calor', label: 'Mapa de Calor' },
                                            { id: 'op_designaciones', label: 'Designaciones' }
                                        ]
                                    },
                                    {
                                        category: 'Rendimiento & Finanzas', icon: DollarSign, color: 'emerald',
                                        modules: [
                                            { id: 'rend_operativo', label: 'Producción Operativa' },
                                            { id: 'rend_financiero', label: 'Producción Financiera' },
                                            { id: 'rend_tarifario', label: 'Tarifario & Baremos' }
                                        ]
                                    },
                                    {
                                        category: 'Comercial & Venta', icon: Zap, color: 'amber',
                                        modules: [
                                            { id: 'comercial_cotizador', label: 'Cotizador Comercial' },
                                            { id: 'comercial_crm', label: 'CRM Ventas' }
                                        ]
                                    },
                                    {
                                        category: 'Configuraciones', icon: Sliders, color: 'orange',
                                        modules: [
                                            { id: 'cfg_baremos', label: 'Maestro Baremos' },
                                            { id: 'cfg_clientes', label: 'Tarifario Clientes' },
                                            { id: 'cfg_empresa', label: 'Config. Empresa' },
                                            { id: 'cfg_personal', label: 'Gestión de Personal' }
                                        ]
                                    }
                                ].map((cat, catIdx) => (
                                    <div key={catIdx} className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className={`p-2.5 bg-${cat.color}-100 text-${cat.color}-600 rounded-xl`}>
                                                <cat.icon size={18} />
                                            </div>
                                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{cat.category}</h3>
                                        </div>

                                        <div className="space-y-3">
                                            {cat.modules.map(mod => (
                                                <div key={mod.id} className="bg-white rounded-2xl p-4 border border-slate-100 hover:border-indigo-200 transition-all group shadow-sm">
                                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                        <div className="min-w-[200px]">
                                                            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">{mod.label}</h4>
                                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">Permisos granulares</p>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {[
                                                                { key: 'ver', label: 'VER', icon: EyeIcon, color: 'sky' },
                                                                { key: 'crear', label: 'CREAR', icon: Plus, color: 'emerald' },
                                                                { key: 'editar', label: 'EDITAR', icon: Edit3, color: 'indigo' },
                                                                { key: 'suspender', label: 'BLOQ', icon: Lock, color: 'amber' },
                                                                { key: 'eliminar', label: 'ELIM', icon: Trash2, color: 'red' }
                                                            ].map(cap => {
                                                                const isActive = empresaFormData.permisosModulos?.[mod.id]?.[cap.key];
                                                                return (
                                                                    <button
                                                                        key={cap.key}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const current = { ...(empresaFormData.permisosModulos?.[mod.id] || defaultPermisosModulos[mod.id]) };
                                                                            setEmpresaFormData(p => ({
                                                                                ...p,
                                                                                permisosModulos: {
                                                                                    ...p.permisosModulos,
                                                                                    [mod.id]: { ...current, [cap.key]: !isActive }
                                                                                }
                                                                            }));
                                                                        }}
                                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all ${isActive
                                                                            ? `bg-${cap.color}-500 border-${cap.color}-500 text-white shadow-sm`
                                                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                                                            }`}
                                                                    >
                                                                        <cap.icon size={12} />
                                                                        <span className="text-[9px] font-black">{cap.label}</span>
                                                                    </button>
                                                                );
                                                            })}

                                                            <div className="h-6 w-[1px] bg-slate-100 mx-2 hidden lg:block"></div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const p = empresaFormData.permisosModulos?.[mod.id] || {};
                                                                    const allSelected = p.ver && p.crear && p.editar && p.suspender && p.eliminar;
                                                                    const newState = !allSelected;
                                                                    setEmpresaFormData(prev => ({
                                                                        ...prev,
                                                                        permisosModulos: {
                                                                            ...prev.permisosModulos,
                                                                            [mod.id]: { ver: newState, crear: newState, editar: newState, suspender: newState, eliminar: newState }
                                                                        }
                                                                    }));
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all ml-auto lg:ml-0"
                                                            >
                                                                {(() => {
                                                                    const p = empresaFormData.permisosModulos?.[mod.id] || {};
                                                                    return (p.ver && p.crear && p.editar && p.suspender && p.eliminar) ? 'Ninguno' : 'Todos';
                                                                })()}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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

                    {/* MODO AUDITORÍA INDICATOR */}
                    {auditCompany && (
                        <div className="mt-4 bg-indigo-600 border border-indigo-500 rounded-2xl px-4 py-3 shadow-xl shadow-indigo-200 animate-pulse">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-[8px] font-black text-indigo-100 uppercase tracking-[0.2em]">Auditando:</p>
                                    <p className="text-[10px] font-black text-white truncate max-w-[120px]">{auditCompany.nombre}</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setAuditCompany(null);
                                        showAlert('Saliendo de modo auditoría', 'success');
                                    }}
                                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-all"
                                    title="Salir de auditoría"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    )}
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
                    {(view === 'companies' || view === 'empresas') && (
                        <button onClick={openCreateEmpresa}
                            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-8 py-3.5 rounded-2xl font-black text-[11px] uppercase hover:opacity-90 transition-all shadow-lg shadow-indigo-200">
                            <Building2 size={16} /> Nueva Empresa
                        </button>
                    )}
                </header>

                <div className="p-10 flex-1">

                    {/* STATS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
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
                                                                <button onClick={() => handleResendCredentials(u)} title="Reenviar Credenciales" className="p-2.5 bg-amber-50 hover:bg-amber-600 rounded-xl text-amber-600 hover:text-white transition-all">
                                                                    <ShieldAlert size={15} />
                                                                </button>
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

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mb-5">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                <Users size={12} /> {eUsers.length} usuarios
                                            </div>
                                            <span className="text-[9px] text-slate-300 font-black uppercase">{new Date(e.createdAt).toLocaleDateString()}</span>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setAuditCompany(e);
                                                showAlert(`Ingresando a gestión de ${e.nombre}`, 'success');
                                                navigate('/gestion-personal'); // O el módulo que prefieras
                                            }}
                                            className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Shield size={14} /> Ingresar a Gestión
                                        </button>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    {/* ── VIEW: GESTIÓN DE TIEMPOS ── */}
                    {view === 'time' && (
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-sm min-h-[500px]">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl"><Clock size={24} /></div>
                                        Tiempo Activo Diario
                                    </h2>
                                    <p className="text-sm font-bold text-slate-400 mt-1">Horas trabajadas hoy por el personal Administrativo</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-[2rem] border border-slate-100 bg-slate-50/50">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-100/50">
                                            <th className="p-6 text-[10px] font-black text-slate-500 tracking-widest uppercase">Colaborador Administrativo</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 tracking-widest uppercase">Cargo</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 tracking-widest uppercase text-center">Estado Sesión</th>
                                            <th className="p-6 text-[10px] font-black text-slate-500 tracking-widest uppercase whitespace-nowrap">Tiempo Contabilizado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {timeTrackers.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="p-10 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">
                                                    No hay registros de tiempo activo el día de hoy
                                                </td>
                                            </tr>
                                        ) : (
                                            timeTrackers.map(t => {
                                                const u = t.userRef;
                                                const horas = Math.floor(t.segundosTrabajados / 3600);
                                                const minutos = Math.floor((t.segundosTrabajados % 3600) / 60);

                                                return (
                                                    <tr key={t._id} className="hover:bg-white transition-colors group">
                                                        <td className="p-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shadow-sm group-hover:scale-110 transition-transform">
                                                                    {u?.name?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-black text-slate-800">{u?.name || 'Desconocido'}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{u?.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-6">
                                                            <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                                                {u?.cargo || 'Sin Cargo'}
                                                            </span>
                                                        </td>
                                                        <td className="p-6 text-center">
                                                            <span className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-sm inline-flex items-center gap-1.5 ${u?.isOnline ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${u?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                                {u.role === 'admin' ? 'Admin' : 
                                                     u.role === 'gerencia' ? 'Gerencia' :
                                                     u.role === 'jefatura' ? 'Jefatura' :
                                                     u.role === 'auditor_empresa' ? 'Auditor' :
                                                     u.role === 'administrativo' ? 'Staff' : 'Worker'}
                                                            </span>
                                                        </td>
                                                        <td className="p-6 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <div className="flex text-2xl font-black text-indigo-600 font-mono tracking-tighter">
                                                                    {String(horas).padStart(2, '0')}<span className="text-indigo-300 mx-1">:</span>{String(minutos).padStart(2, '0')}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">H : M</span>
                                                                    <span className="text-[8px] font-bold text-slate-300 mt-1">Última act. {new Date(t.ultimaActividad).toLocaleTimeString()}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL: CAMBIO DE CONTRASEÑA PREMIUM ─────────────────────────── */}
            {modal === 'changePassword' && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md transition-all duration-300">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl relative overflow-hidden group">
                        {/* Decoración superior */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600" />

                        <div className="flex justify-between items-start mb-10">
                            <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100">
                                <ShieldAlert size={32} className="text-amber-600" />
                            </div>
                            <button
                                onClick={() => setModal(null)}
                                className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="text-center mb-10">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Seguridad de Acceso</h3>
                            <p className="text-sm font-bold text-slate-400 leading-relaxed uppercase tracking-wide">
                                Actualizar credenciales para:<br />
                                <span className="text-indigo-600">{selectedItem?.name}</span>
                            </p>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Lock size={12} /> Nueva Contraseña Temporal
                                </label>
                                <div className="relative group/input">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={formData.password}
                                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full pl-6 pr-14 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-black text-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                                        placeholder="········"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors p-2"
                                    >
                                        {showPass ? <EyeOff size={22} /> : <EyeIcon size={22} />}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 px-2">
                                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${formData.password.length >= 6 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${formData.password.length >= 8 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                    <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${formData.password.length >= 10 ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                                </div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter text-right italic">
                                    {formData.password.length < 6 ? 'Mínimo 6 caracteres' : 'Contraseña válida'}
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setModal(null)}
                                    className="flex-1 py-5 rounded-2xl border-2 border-slate-100 text-slate-400 font-black text-[11px] uppercase hover:bg-slate-50 transition-all tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitResendCredentials}
                                    disabled={saving || formData.password.length < 6}
                                    className="flex-1 py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-[11px] uppercase hover:opacity-90 transition-all flex items-center justify-center gap-3 disabled:opacity-30 shadow-xl shadow-amber-200 tracking-widest"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={20} /> : <><ShieldCheck size={18} /> Enviar Mail</>}
                                </button>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-slate-50 text-center">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                                El usuario recibirá los nuevos datos en su correo personal
                            </p>
                        </div>
                    </div>
                </div>
            )}

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

            {/* ALERT FLOTANTE PREMIUM */}
            {alert && (
                <div className={`fixed top-8 left-1/2 -translate-x-1/2 z-[200] min-w-[320px] flex items-center gap-4 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500
                    ${alert.type === 'error'
                        ? 'bg-red-500/90 text-white border-red-400/50 shadow-red-500/20'
                        : 'bg-emerald-500/90 text-white border-emerald-400/50 shadow-emerald-500/20'}`}>
                    <div className="bg-white/20 p-2 rounded-xl shadow-inner">
                        {alert.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-70">Sistema GenAI</span>
                        <span className="text-[12px] font-black uppercase tracking-wider mt-1">{alert.msg}</span>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMACIÓN PREMIUM */}
            {confirmModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[210] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <AlertTriangle size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3 uppercase">{confirmModal.title}</h3>
                            <p className="text-slate-500 text-xs font-bold leading-relaxed px-4">{confirmModal.message}</p>
                        </div>
                        <div className="px-10 pb-10 flex gap-3">
                            <button onClick={() => setConfirmModal(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                                Cancelar
                            </button>
                            <button onClick={confirmModal.action}
                                className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CeoCommandCenter;
