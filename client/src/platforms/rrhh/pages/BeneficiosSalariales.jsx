import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    TrendingUp, Users, Search, RefreshCw, Download, AlertCircle,
    ChevronDown, ChevronUp, Save, Plus, Trash2, DollarSign,
    Calendar, ShieldAlert, Info, Link as LinkIcon, FileText, CheckCircle2,
    XCircle, Clock, UploadCloud
} from 'lucide-react';
import { candidatosApi, proyectosApi, beneficiosApi } from '../rrhhApi';
import * as XLSX from 'xlsx';
import { useAuth } from '../../auth/AuthContext';
import BulkUploadModal from '../../../components/BulkUploadModal';
import { formatRut } from '../../../utils/rutUtils';

const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

const Tooltip = ({ children, content }) => (
    <div className="relative group/tooltip flex items-center">
        {children}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-48 p-2.5 bg-slate-800 text-slate-100 text-[10px] leading-relaxed rounded-xl shadow-2xl z-50 pointer-events-none font-medium">
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
        </div>
    </div>
);

const Beneficios = () => {
    const { user } = useAuth();
    const [empleados, setEmpleados] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [tiposBeneficio, setTiposBeneficio] = useState([]);
    const [transaccionesPeriodo, setTransaccionesPeriodo] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterStatus, setFilterStatus] = useState('Todos');
    
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(currentMonth);

    // editForm maps emp._id to an array of transaction objects
    const [editForm, setEditForm] = useState({});
    const [expandedId, setExpandedId] = useState(null);
    const [showAddMenu, setShowAddMenu] = useState(null);
    const [activeTab, setActiveTab] = useState('asignacion'); // 'asignacion' | 'gestor'
    const [showUploadModal, setShowUploadModal] = useState(false);

    const handleBulkUpload = async (data) => {
        try {
            const res = await beneficiosApi.uploadExcel(period, data);
            if (res.data?.errors?.length > 0) {
                return { errors: res.data.errors };
            }
            showAlert('Carga masiva completada con éxito');
            setShowUploadModal(false);
            fetchData();
        } catch (e) {
            return { errors: [e.response?.data?.message || 'Error al procesar el archivo Excel'] };
        }
    };

    const showAlert = (msg, type = 'success') => {
        setAlert({ msg, type });
        setTimeout(() => setAlert(null), 4000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [candRes, projRes, tiposRes, txRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
                beneficiosApi.getTipos(),
                beneficiosApi.getTransacciones(period)
            ]);
            setEmpleados(candRes.data || []);
            setProyectos(projRes.data || []);
            setTiposBeneficio(tiposRes.data || []);
            setTransaccionesPeriodo(txRes.data || []);
            
            // Map existing transactions to editForm
            const initialEdits = {};
            (candRes.data || []).forEach(emp => {
                const empTx = (txRes.data || []).filter(tx => tx.candidatoRef === emp._id);
                initialEdits[emp._id] = empTx.map(tx => ({
                    id: tx._id || crypto.randomUUID(), // use existing _id if present
                    tipoBeneficioRef: tx.tipoBeneficioRef._id || tx.tipoBeneficioRef,
                    monto: tx.monto || 0,
                    cantidad: tx.cantidad || 0,
                    modalidad: tx.modalidad || 'Totalidad',
                    numeroCuotasTotal: tx.numeroCuotasTotal || '',
                    cuotaActual: tx.cuotaActual || '',
                    fechasInasistencia: tx.fechasInasistencia || [],
                    fechaAtraso: tx.fechaAtraso || '',
                    respaldoUrl: tx.respaldoUrl || '',
                    nota: tx.nota || ''
                }));
            });
            setEditForm(initialEdits);

        } catch (e) {
            console.error('Error fetching beneficios data:', e);
            showAlert('Error al cargar datos legales de beneficios', 'error');
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        return empleados.filter(e => {
            if (['Finiquitado', 'De Baja', 'Retirado', 'Rechazado'].includes(e.status) || !e.contractStartDate) {
                return false;
            }
            const term = searchTerm.toLowerCase();
            const cleanSearch = searchTerm.replace(/[^0-9kK]/gi, '');
            const cleanRut = e.rut ? e.rut.replace(/[^0-9kK]/gi, '') : '';
            const matchSearch = !searchTerm || e.fullName?.toLowerCase().includes(term) || (cleanSearch && cleanRut.includes(cleanSearch));
            const mappedStatus = ['En Terreno', 'Listo Terreno', 'EN TERR', 'Contratado'].includes(e.status) ? 'Activo' : 
                                 ['Rechazado', 'Retirado', 'Finiquitado', 'Bajas/Inactivos', 'De Baja'].includes(e.status) ? 'De Baja' : 'Todos';
            const matchStatus = filterStatus === 'Todos' || mappedStatus === filterStatus || e.status === filterStatus;
            const proj = proyectos.find(p => p._id === (e.projectId?._id || e.projectId));
            const ceco = proj?.centroCosto || e.ceco || '';
            const matchCeco = !filterCeco || ceco === filterCeco;
            return matchSearch && matchStatus && matchCeco;
        });
    }, [empleados, searchTerm, filterStatus, filterCeco, period, proyectos]);

    const cecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    const getTotalBeneficios = (empId) => {
        const items = editForm[empId] || [];
        return items.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);
    };

    const addRetencion = (empId, tipoId) => {
        setEditForm(prev => {
            const list = prev[empId] || [];
            return {
                ...prev,
                [empId]: [...list, {
                    id: crypto.randomUUID(),
                    tipoBeneficioRef: tipoId,
                    monto: 0,
                    cantidad: 0,
                    modalidad: 'Totalidad',
                    numeroCuotasTotal: '',
                    cuotaActual: '',
                    fechasInasistencia: [],
                    fechaAtraso: '',
                    respaldoUrl: '',
                    nota: ''
                }]
            };
        });
        setShowAddMenu(null);
    };

    const removeRetencion = (empId, itemId) => {
        setEditForm(prev => {
            const list = prev[empId] || [];
            return {
                ...prev,
                [empId]: list.filter(item => item.id !== itemId)
            };
        });
    };

    const updateItem = (emp, itemId, field, value) => {
        setEditForm(prev => {
            const list = prev[emp._id] || [];
            return {
                ...prev,
                [emp._id]: list.map(item => {
                    if (item.id === itemId) {
                        const updated = { ...item, [field]: value };
                        
                        // Auto-calc triggers
                        const tipo = tiposBeneficio.find(t => t._id === item.tipoBeneficioRef);
                        const sueldoBase = Number(emp.sueldoBase) || 0;

                        if (tipo?.codigoDT === '4109') {
                            // Inasistencias: field == 'fechasInasistencia' updates cantidad and monto
                            if (field === 'fechasInasistencia') {
                                updated.cantidad = value.length;
                                updated.monto = Math.round((sueldoBase / 30) * updated.cantidad);
                            }
                        } else if (tipo?.codigoDT === '4108') {
                            // Atrasos: field == 'cantidad' updates monto
                            if (field === 'cantidad') {
                                updated.monto = Math.round((sueldoBase / 180) * (Number(value) || 0));
                            }
                        } else if (tipo?.unidadMedida === 'Días' && field === 'cantidad') {
                            updated.monto = Math.round((sueldoBase / 30) * (Number(value) || 0));
                        } else if (tipo?.unidadMedida === 'Horas' && field === 'cantidad') {
                            updated.monto = Math.round((sueldoBase / 180) * (Number(value) || 0));
                        }
                        return updated;
                    }
                    return item;
                })
            };
        });
    };

    const handleAddFechaInasistencia = (emp, itemId) => {
        updateItem(emp, itemId, 'fechasInasistencia', [...(editForm[emp._id].find(i => i.id === itemId).fechasInasistencia), '']);
    };

    const handleUpdateFechaInasistencia = (emp, itemId, index, val) => {
        const item = editForm[emp._id].find(i => i.id === itemId);
        const newFechas = [...item.fechasInasistencia];
        newFechas[index] = val;
        // Clean empty before setting
        updateItem(emp, itemId, 'fechasInasistencia', newFechas.filter(f => f !== ''));
    };
    
    const handleRemoveFechaInasistencia = (emp, itemId, index) => {
        const item = editForm[emp._id].find(i => i.id === itemId);
        const newFechas = [...item.fechasInasistencia];
        newFechas.splice(index, 1);
        updateItem(emp, itemId, 'fechasInasistencia', newFechas);
    };

    const handleSave = async (empId) => {
        setSaving(true);
        try {
            const list = editForm[empId] || [];
            // filter out items that have 0 amount and 0 quantity
            const transacciones = list.filter(t => Number(t.monto) > 0 || Number(t.cantidad) > 0);
            
            await beneficiosApi.saveTransacciones(empId, period, { transacciones });
            showAlert('Beneficios sincronizados correctamente (DT/LRE)');
            setExpandedId(null);
            fetchData();
        } catch (e) {
            showAlert('Error al procesar los beneficios', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleExport = () => {
        const rows = [];
        filtered.forEach(e => {
            const proj = proyectos.find(p => p._id === (e.projectId?._id || e.projectId));
            const list = editForm[e._id] || [];
            if (list.length === 0) {
                rows.push({
                    'RUT': e.rut, 'NOMBRE': e.fullName, 'CARGO': e.position, 'CECO': proj?.centroCosto || e.ceco || '', 'PERÍODO': period,
                    'SUELDO BASE': e.sueldoBase || 0, 'CÓDIGO DT': '', 'TIPO DESCUENTO': 'Sin Beneficios', 'MONTO': 0
                });
            } else {
                list.forEach(tx => {
                    const tipo = tiposBeneficio.find(t => t._id === tx.tipoBeneficioRef);
                    rows.push({
                        'RUT': e.rut, 'NOMBRE': e.fullName, 'CARGO': e.position, 'CECO': proj?.centroCosto || e.ceco || '', 'PERÍODO': period,
                        'SUELDO BASE': e.sueldoBase || 0,
                        'CÓDIGO DT': tipo?.codigoDT || '',
                        'TIPO DESCUENTO': tipo?.nombre || '',
                        'MONTO': Number(tx.monto) || 0,
                        'CANTIDAD': Number(tx.cantidad) || 0,
                        'MODALIDAD': tx.modalidad || '',
                        'N° CUOTA': tx.modalidad === 'Cuotas' ? `${tx.cuotaActual || ''}/${tx.numeroCuotasTotal || ''}` : '',
                        'JUSTIFICACIÓN': tx.nota || '',
                        'RESPALDO URL': tx.respaldoUrl || ''
                    });
                });
            }
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `LRE_Haberes_${period}`);
        XLSX.writeFile(wb, `Haberes_LRE_${period}.xlsx`);
    };

    const totalGeneral = filtered.reduce((sum, e) => sum + getTotalBeneficios(e._id), 0);
    const conBeneficios = filtered.filter(e => getTotalBeneficios(e._id) > 0).length;

    return (
        <div className="min-h-full bg-slate-50/50 p-6 pb-24">
            {alert && (
                <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-black uppercase tracking-wide animate-in slide-in-from-right ${alert.type === 'error' ? 'bg-sky-600' : 'bg-emerald-600'} text-white`}>
                    {alert.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                    {alert.msg}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-sky-500 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-sky-200 -rotate-3 hover:rotate-0 transition-transform">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                            Beneficios <span className="text-sky-500">&amp; Bonos</span>
                            <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-lg text-[10px] tracking-widest font-black border border-sky-200">PAYROLL READY</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                            Asignación de haberes · {filtered.length} colaboradores activos
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200" />
                    
                    <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-emerald-400 hover:text-emerald-600 transition-all shadow-sm">
                        <UploadCloud size={14} /> Importar
                    </button>
                    
                    <button onClick={handleExport} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-sky-400 hover:text-sky-600 transition-all shadow-sm">
                        <Download size={14} /> Exportar
                    </button>
                    <button onClick={fetchData} className="p-3 bg-sky-500 text-white rounded-2xl shadow-lg shadow-sky-100 hover:bg-sky-600 transition-all">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-white rounded-[2rem] p-2 w-max shadow-sm border border-slate-100 mb-8 mx-auto md:mx-0">
                <button
                    onClick={() => setActiveTab('asignacion')}
                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                        activeTab === 'asignacion' 
                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-200' 
                            : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    Asignación y Registro
                </button>
                <button
                    onClick={() => setActiveTab('gestor')}
                    className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                        activeTab === 'gestor' 
                            ? 'bg-sky-600 text-white shadow-lg shadow-sky-200' 
                            : 'text-slate-500 hover:bg-slate-50'
                    }`}
                >
                    Gestor de Aprobaciones
                </button>
            </div>

            {activeTab === 'asignacion' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                    { label: 'Total Haberes Período', value: fmt(totalGeneral), icon: DollarSign, color: 'rose' },
                    { label: 'Colaboradores con Beneficio', value: conBeneficios, icon: ShieldAlert, color: 'amber' },
                    { label: 'Dotación Período', value: filtered.length, icon: Users, color: 'slate' },
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

            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-6 flex flex-wrap items-center gap-4 shadow-xl">
                <div className="flex-1 min-w-[250px] relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input type="text" placeholder="Buscar por nombre o RUT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-100" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none">
                    <option value="Todos">Todos (Activos del Mes)</option>
                    <option value="Activo">Solo Activos / En Terreno</option>
                    <option value="De Baja">Desvinculados del Mes</option>
                </select>
                <select value={filterCeco} onChange={e => setFilterCeco(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none">
                    <option value="">Todos los CECO</option>
                    {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
                {loading ? (
                    <div className="py-32 text-center">
                        <RefreshCw className="animate-spin mx-auto text-sky-500 mb-4" size={40} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-32 text-center">
                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                        <p className="text-slate-400 font-bold">No se encontraron colaboradores</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map(emp => {
                            const total = getTotalBeneficios(emp._id);
                            const sueldoBase = Number(emp.sueldoBase) || 0;
                            const percBase = sueldoBase > 0 ? (total / sueldoBase) * 100 : 0;
                            const isOpen = expandedId === emp._id;
                            const superaMaxLegal = percBase > 45;
                            const items = editForm[emp._id] || [];
                            const proj = proyectos.find(p => p._id === (emp.projectId?._id || emp.projectId));

                            return (
                                <div key={emp._id} className="group">
                                    <button
                                        onClick={() => setExpandedId(isOpen ? null : emp._id)}
                                        className="w-full flex items-center gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors text-left"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 font-black text-sm flex-shrink-0">
                                            {emp.profilePic ? <img src={emp.profilePic} alt="" className="w-full h-full object-cover rounded-2xl" /> : (emp.fullName?.charAt(0).toUpperCase() || <User size={14} />)}
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[11px] font-black text-slate-900 uppercase truncate">{emp.fullName}</p>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest ${emp.status === 'Contratado' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{emp.status}</span>
                                                </div>
                                                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{formatRut(emp.rut)} · {proj?.centroCosto || emp.ceco || 'Sin CECO'}</p>
                                            </div>
                                            
                                            <div className="hidden md:block">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Inicio Contrato</p>
                                                <p className="text-[10px] font-black text-slate-700 uppercase">
                                                    {emp.contractStartDate ? new Date(emp.contractStartDate).toLocaleDateString('es-CL') : 'N/A'}
                                                </p>
                                            </div>

                                            <div className="hidden md:block">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Contrato Vigente</p>
                                                <p className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                                                    <CheckCircle2 size={12} className="text-emerald-500" /> VIGENTE
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            {total > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                        <div className={`h-full ${superaMaxLegal ? 'bg-sky-600' : 'bg-sky-400'}`} style={{ width: `${Math.min(percBase, 100)}%` }} />
                                                    </div>
                                                    <span className={`px-4 py-1.5 ${superaMaxLegal ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-700 border-slate-200'} border rounded-xl text-[10px] font-black`}>
                                                        {fmt(total)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="px-4 py-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl text-[10px] font-black">Sin Beneficios</span>
                                            )}
                                            {superaMaxLegal && !isOpen && (
                                                <Tooltip content="Alerta LRE: Supera el límite de haber recomendado (45% s/ Base).">
                                                    <ShieldAlert size={14} className="text-sky-500 animate-pulse" />
                                                </Tooltip>
                                            )}
                                            {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                        </div>
                                    </button>

                                    {isOpen && (
                                        <div className="px-8 pb-8 bg-slate-50 border-t border-slate-100 relative">
                                            <div className="mb-6 pt-4 flex items-center justify-between border-b border-slate-200 pb-3">
                                                <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
                                                    Registro Legal (Serie 2000)
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                    Sueldo Base: {fmt(sueldoBase)}
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-6">
                                                {items.length === 0 && (
                                                    <div className="text-center py-6 text-slate-400 font-bold text-sm bg-white border border-slate-100 border-dashed rounded-2xl">
                                                        No hay beneficios registrados en este periodo. Haz clic en el botón de abajo para agregar uno.
                                                    </div>
                                                )}

                                                {items.map((item, index) => {
                                                    const tipo = tiposBeneficio.find(t => t._id === item.tipoBeneficioRef);
                                                    if (!tipo) return null;

                                                    const pje = sueldoBase > 0 ? ((Number(item.monto) || 0) / sueldoBase) * 100 : 0;
                                                    const limite = tipo.limiteLegalPorcentaje || 0;
                                                    const excedido = limite > 0 && pje > limite;
                                                    const isAtraso = tipo.codigoDT === '4108';
                                                    const isInasistencia = tipo.codigoDT === '4109';

                                                    return (
                                                        <div key={item.id} className="relative bg-white p-5 rounded-3xl border border-slate-200 shadow-sm animate-in slide-in-from-top-2">
                                                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs font-black">
                                                                        {index + 1}
                                                                    </div>
                                                                    <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-mono border border-slate-200">
                                                                            {tipo.codigoDT}
                                                                        </span>
                                                                        {tipo.nombre}
                                                                        {tipo.descripcionLegal && (
                                                                            <Tooltip content={tipo.descripcionLegal}>
                                                                                <Info size={14} className="text-slate-400 cursor-help" />
                                                                            </Tooltip>
                                                                        )}
                                                                    </label>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {limite > 0 && (
                                                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest ${excedido ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                            Tope {limite}%
                                                                        </span>
                                                                    )}
                                                                    <button onClick={() => removeRetencion(emp._id, item.id)} className="p-1.5 text-slate-300 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                                                                
                                                                {/* DYNAMIC FIELD SECTION */}
                                                                <div className="lg:col-span-5 flex flex-col gap-4">
                                                                    {isInasistencia && (
                                                                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                                                                            <div className="flex items-center justify-between mb-2">
                                                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                                                    <Calendar size={12} /> Fechas Inasistencia ({item.fechasInasistencia?.length || 0} días)
                                                                                </span>
                                                                                <button onClick={() => handleAddFechaInasistencia(emp, item.id)} className="text-[9px] font-black text-sky-600 bg-sky-50 px-2 py-1 rounded hover:bg-sky-100 transition-colors">
                                                                                    + Añadir Día
                                                                                </button>
                                                                            </div>
                                                                            <div className="flex flex-col gap-2">
                                                                                {item.fechasInasistencia?.map((fecha, idx) => (
                                                                                    <div key={idx} className="flex items-center gap-2">
                                                                                        <input type="date" value={fecha} onChange={e => handleUpdateFechaInasistencia(emp, item.id, idx, e.target.value)} className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 py-1.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-200" />
                                                                                        <button onClick={() => handleRemoveFechaInasistencia(emp, item.id, idx)} className="text-slate-400 hover:text-sky-500"><Trash2 size={14} /></button>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {isAtraso && (
                                                                        <div className="flex gap-2">
                                                                            <div className="flex-1">
                                                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Fecha</span>
                                                                                <input type="date" value={item.fechaAtraso || ''} onChange={e => updateItem(emp, item.id, 'fechaAtraso', e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100" />
                                                                            </div>
                                                                            <div className="w-24">
                                                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Horas</span>
                                                                                <input type="number" step="0.5" min="0" value={item.cantidad || ''} onChange={e => updateItem(emp, item.id, 'cantidad', e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 text-center" placeholder="0" />
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {!isInasistencia && !isAtraso && (
                                                                        <div className="flex flex-col gap-3">
                                                                            <div>
                                                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Modalidad</span>
                                                                                <select value={item.modalidad} onChange={e => updateItem(emp, item.id, 'modalidad', e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100">
                                                                                    <option value="Totalidad">Beneficio en su Totalidad</option>
                                                                                    <option value="Cuotas">Beneficio en Cuotas</option>
                                                                                </select>
                                                                            </div>
                                                                            {item.modalidad === 'Cuotas' && (
                                                                                <div className="flex gap-2 bg-amber-50 p-2 rounded-xl border border-amber-100">
                                                                                    <div className="flex-1">
                                                                                        <span className="block text-[8px] font-black text-amber-700 uppercase tracking-widest mb-1 ml-1">Cuota N°</span>
                                                                                        <input type="number" min="1" value={item.cuotaActual || ''} onChange={e => updateItem(emp, item.id, 'cuotaActual', e.target.value)} className="w-full py-1.5 px-3 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 text-center" placeholder="Ej: 1" />
                                                                                    </div>
                                                                                    <div className="flex items-center pt-4 text-amber-500 font-black">/</div>
                                                                                    <div className="flex-1">
                                                                                        <span className="block text-[8px] font-black text-amber-700 uppercase tracking-widest mb-1 ml-1">Total</span>
                                                                                        <input type="number" min="1" value={item.numeroCuotasTotal || ''} onChange={e => updateItem(emp, item.id, 'numeroCuotasTotal', e.target.value)} className="w-full py-1.5 px-3 bg-white border border-amber-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-200 text-center" placeholder="Ej: 3" />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* MONTO & JUSTIFICATION */}
                                                                <div className="lg:col-span-7 flex flex-col gap-3">
                                                                    <div className="flex gap-3">
                                                                        <div className="w-1/3 relative">
                                                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Monto del Beneficio</span>
                                                                            <div className="relative">
                                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold pointer-events-none">$</span>
                                                                                <input type="number" min="0" value={item.monto || ''} onChange={e => updateItem(emp, item.id, 'monto', e.target.value)} className={`w-full py-2.5 pl-8 pr-3 bg-slate-50 border ${excedido ? 'border-sky-300 bg-sky-50/50' : 'border-slate-200'} rounded-xl text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all`} placeholder="0" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="w-2/3">
                                                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Describa el Motivo del Beneficio</span>
                                                                            <input type="text" value={item.nota || ''} onChange={e => updateItem(emp, item.id, 'nota', e.target.value)} className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-100" placeholder="Escriba aquí los detalles..." />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* ADD MENU */}
                                                <div className="relative mt-2">
                                                    <button onClick={() => setShowAddMenu(showAddMenu === emp._id ? null : emp._id)} className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-sky-300 bg-white hover:bg-sky-50 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black text-slate-500 hover:text-sky-600 uppercase tracking-widest transition-all">
                                                        <Plus size={16} /> Agregar Haber / Beneficio
                                                    </button>
                                                    
                                                    {showAddMenu === emp._id && (
                                                        <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 overflow-hidden animate-in slide-in-from-top-2">
                                                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 flex flex-col gap-1">
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest p-2">Selecciona un código LRE</div>
                                                                {tiposBeneficio.map(t => (
                                                                    <button key={t._id} onClick={() => addRetencion(emp._id, t._id)} className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-3">
                                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-mono border border-slate-200">{t.codigoDT}</span>
                                                                        <span className="text-xs font-black text-slate-700">{t.nombre}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 border-dashed">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Haberes (Serie 2000)</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl font-black text-sky-600">{fmt(total)}</span>
                                                        {superaMaxLegal && <span className="px-2 py-1 bg-sky-100 text-sky-700 text-[9px] font-black rounded-lg uppercase tracking-widest border border-sky-200 flex items-center gap-1"><ShieldAlert size={10} /> Alerta DT (&gt;45%)</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => setExpandedId(null)} className="px-5 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all">Cancelar</button>
                                                    <button onClick={() => handleSave(emp._id)} disabled={saving} className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-sky-200">
                                                        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Sincronizar LRE
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
                </>
            ) : (
                /* GESTOR DE APROBACIONES VIEW */
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {[
                            { label: 'Pendientes de Firma', value: transaccionesPeriodo.filter(t => t.estadoAprobacion === 'Pendiente').length, icon: Clock, color: 'amber' },
                            { label: 'Aprobados (Firmados)', value: transaccionesPeriodo.filter(t => t.estadoAprobacion === 'Aprobado').length, icon: CheckCircle2, color: 'emerald' },
                            { label: 'Rechazados', value: transaccionesPeriodo.filter(t => t.estadoAprobacion === 'Rechazado').length, icon: XCircle, color: 'rose' },
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

                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden p-8">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Detalle de Trámites ({period})</h2>
                        {transaccionesPeriodo.length === 0 ? (
                            <div className="text-center py-20">
                                <FileText className="mx-auto text-slate-200 mb-4" size={60} />
                                <p className="text-slate-400 font-bold">No hay transacciones registradas en este período</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-100">
                                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo Beneficio</th>
                                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto</th>
                                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Aprobación</th>
                                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones / Feedback</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {transaccionesPeriodo.map(tx => {
                                            const emp = empleados.find(e => e._id === tx.candidatoRef);
                                            const tipo = tx.tipoBeneficioRef; // Already populated from backend
                                            return (
                                                <tr key={tx._id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 pr-4">
                                                        <p className="text-xs font-black text-slate-800 uppercase">{emp?.fullName || 'Desconocido'}</p>
                                                        <p className="text-[10px] text-slate-400">{emp?.rut}</p>
                                                    </td>
                                                    <td className="py-4 pr-4">
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[9px] font-mono border border-slate-200 mr-2">{tipo?.codigoDT}</span>
                                                        <span className="text-xs font-bold text-slate-700">{tipo?.nombre}</span>
                                                    </td>
                                                    <td className="py-4 pr-4 text-xs font-black text-slate-700">{fmt(tx.monto)}</td>
                                                    <td className="py-4 pr-4">
                                                        {tx.estadoAprobacion === 'Pendiente' && <span className="flex w-max items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest"><Clock size={12}/> Pendiente</span>}
                                                        {tx.estadoAprobacion === 'Aprobado' && <span className="flex w-max items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={12}/> Aprobado</span>}
                                                        {tx.estadoAprobacion === 'Rechazado' && <span className="flex w-max items-center gap-1.5 px-3 py-1 bg-sky-100 text-sky-700 rounded-xl text-[10px] font-black uppercase tracking-widest"><XCircle size={12}/> Rechazado</span>}
                                                    </td>
                                                    <td className="py-4">
                                                        {tx.estadoAprobacion === 'Aprobado' && tx.respaldoUrl ? (
                                                            <a href={tx.respaldoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-colors">
                                                                <FileText size={12} /> Ver PDF
                                                            </a>
                                                        ) : tx.estadoAprobacion === 'Rechazado' ? (
                                                            <div className="text-[10px] text-sky-600 bg-sky-50 p-2 rounded-xl italic font-medium max-w-xs">
                                                                "{tx.motivoRechazo || 'Sin feedback'}"
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">Esperando acción...</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* BULK UPLOAD MODAL */}
            <BulkUploadModal 
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onUpload={handleBulkUpload}
                title="Carga Masiva de Beneficios"
                templateHeaders={['RUT', 'CÓDIGO TIPO BENEFICIO', 'MONTO']}
            />
        </div>
    );
};

export default Beneficios;
