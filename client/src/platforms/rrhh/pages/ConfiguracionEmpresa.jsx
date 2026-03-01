import React, { useState, useEffect } from 'react';
import {
    Building2, Users, Plus, Save, Loader2,
    Settings, Briefcase, Landmark, ShieldCheck,
    Trash2, ChevronRight, CheckCircle2, AlertCircle, Workflow
} from 'lucide-react';
import { configApi } from '../rrhhApi';

const ConfiguracionEmpresa = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cecos');
    const [saving, setSaving] = useState(false);

    // Temp states for adding new items
    const [newCargo, setNewCargo] = useState('');
    const [newArea, setNewArea] = useState('');
    const [newCeco, setNewCeco] = useState('');
    const [newProjectType, setNewProjectType] = useState('');

    // Approver temp states
    const [newApprover, setNewApprover] = useState({ name: '', email: '', position: '' });

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await configApi.get();
            setConfig(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleUpdate = async (updatedData) => {
        setSaving(true);
        try {
            const res = await configApi.update(updatedData || config);
            setConfig(res.data);
            alert("Configuración actualizada correctamente");
        } catch (e) {
            alert("Error al actualizar");
        } finally { setSaving(false); }
    };

    const addItem = (field, value, resetFn) => {
        if (!value) return;
        // Basic validation for simple strings
        if (typeof value === 'string' && !value.trim()) return;
        // Validation for Area object
        if (field === 'areas' && !value.name.trim()) return;

        const updatedConfig = { ...config, [field]: [...config[field], value] };
        handleUpdate(updatedConfig);
        resetFn('');
    };

    const removeItem = (field, index) => {
        const updatedList = config[field].filter((_, i) => i !== index);
        handleUpdate({ ...config, [field]: updatedList });
    };

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-indigo-500" size={48} />
        </div>
    );

    const tabs = [
        { id: 'cecos', label: 'Centros de Costo', icon: Landmark },
        { id: 'proyectos', label: 'Tipos de Proyecto', icon: Workflow },
        { id: 'areas', label: 'Áreas', icon: Building2 },
        { id: 'cargos', label: 'Cargos', icon: Briefcase },
        { id: 'aprobaciones', label: 'Flujos de Aprobación', icon: ShieldCheck },
    ];

    return (
        <div className="min-h-full bg-slate-50/50 p-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-800 text-white p-3 rounded-2xl shadow-lg shadow-slate-200">
                        <Settings size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configuración <span className="text-indigo-600">Empresa</span></h1>
                        <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">Estructura organizacional y flujos de aprobación</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-3xl border border-slate-200 shadow-sm w-fit">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
                                ${activeTab === tab.id
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 p-10 min-h-[600px] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 to-violet-600"></div>

                {/* CARGOS */}
                {activeTab === 'cargos' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Diccionario de Cargos</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Defina los roles oficiales autorizados en la compañía</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="flex-1 relative">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="NUEVO CARGO (EJ: TÉCNICO NIVEL 1)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-black text-slate-700 uppercase"
                                    value={newCargo}
                                    onChange={e => setNewCargo(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('cargos', newCargo, setNewCargo)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <Plus size={16} /> Registrar Cargo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {(config.cargos || []).map((cargo, idx) => (
                                <div key={idx} className="group flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all">
                                    <span className="text-[11px] font-black text-slate-700 uppercase">{cargo}</span>
                                    <button onClick={() => removeItem('cargos', idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ÁREAS */}
                {activeTab === 'areas' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Estructura de Áreas</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Defina los departamentos y unidades operativas</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="flex-1 relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="NUEVA ÁREA (EJ: LOGÍSTICA)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 uppercase"
                                    value={newArea}
                                    onChange={e => setNewArea(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('areas', newArea, setNewArea)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <Plus size={16} /> Registrar Área
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {(config.areas || []).map((area, idx) => (
                                <div key={idx} className="group flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all">
                                    <span className="text-[11px] font-black text-slate-700 uppercase">{area}</span>
                                    <button onClick={() => removeItem('areas', idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CECOs */}
                {activeTab === 'cecos' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Centros de Costo (CECO)</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Gestione los códigos financieros de imputación por unidad</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="flex-1 relative">
                                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="CÓDIGO CECO (EJ: OPS-2024)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 uppercase"
                                    value={newCeco}
                                    onChange={e => setNewCeco(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('cecos', newCeco, setNewCeco)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2"
                            >
                                <Plus size={16} /> Registrar CECO
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                            {(config.cecos || []).map((ceco, idx) => (
                                <div key={idx} className="group flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-indigo-200 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{ceco}</span>
                                    </div>
                                    <button onClick={() => removeItem('cecos', idx)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PROYECTOS (TYPES) */}
                {activeTab === 'proyectos' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Tipos de Proyecto</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Clasificación operativa de los frentes de trabajo</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="flex-1 relative">
                                <Workflow className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="EJ: MANTENIMIENTO PREVENTIVO"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 uppercase"
                                    value={newProjectType}
                                    onChange={e => setNewProjectType(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('projectTypes', newProjectType, setNewProjectType)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2"
                            >
                                <Plus size={16} /> Registrar Tipo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(config.projectTypes || []).map((type, idx) => (
                                <div key={idx} className="bg-slate-50/50 border border-slate-100 p-6 rounded-[2rem] hover:bg-white hover:shadow-xl hover:shadow-indigo-100/30 transition-all group relative">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-500"><Workflow size={20} /></div>
                                        <div>
                                            <div className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">{type}</div>
                                            <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Clasificación Activa</div>
                                        </div>
                                    </div>
                                    <button onClick={() => removeItem('projectTypes', idx)} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* FLUJOS DE APROBACIÓN */}
                {activeTab === 'aprobaciones' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Jerarquía de Aprobaciones</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Defina la cadena de mando para validaciones críticas</p>
                            </div>
                        </div>

                        <div className="space-y-10">
                            {['Ingreso', 'Salida', 'Vacaciones', 'Permiso'].map((module) => {
                                const workflow = config.approvalWorkflows?.find(w => w.module === module) || { module, approvers: [] };
                                return (
                                    <div key={module} className="bg-slate-50/50 border border-slate-100 rounded-[2.5rem] p-10 hover:bg-white transition-all group/wf">
                                        <div className="flex items-center gap-6 mb-8">
                                            <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-lg shadow-indigo-100">
                                                <ShieldCheck size={28} />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">Flujo de {module}</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Configuración de aprobadores y validadores oficiales</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                            {/* Formulario Nuevo Aprobador */}
                                            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                    <Plus size={14} className="text-indigo-500" /> Añadir Aprobador al Flujo
                                                </h4>
                                                <div className="space-y-4">
                                                    <input
                                                        type="text"
                                                        placeholder="NOMBRE COMPLETO"
                                                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        value={newApprover.name}
                                                        onChange={e => setNewApprover({ ...newApprover, name: e.target.value.toUpperCase() })}
                                                    />
                                                    <input
                                                        type="email"
                                                        placeholder="CORREO ELECTRÓNICO"
                                                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        value={newApprover.email}
                                                        onChange={e => setNewApprover({ ...newApprover, email: e.target.value.toLowerCase() })}
                                                    />
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl text-xs font-bold uppercase outline-none"
                                                        value={newApprover.position}
                                                        onChange={e => setNewApprover({ ...newApprover, position: e.target.value })}
                                                    >
                                                        <option value="">SELECCIONAR CARGO</option>
                                                        {(config.cargos || []).map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            if (!newApprover.name || !newApprover.email || !newApprover.position) return alert("Complete todos los campos");
                                                            const updatedWorkflow = { ...workflow, approvers: [...workflow.approvers, { ...newApprover, id: Date.now() }] };
                                                            const otherWorkflows = (config.approvalWorkflows || []).filter(w => w.module !== module);
                                                            handleUpdate({ ...config, approvalWorkflows: [...otherWorkflows, updatedWorkflow] });
                                                            setNewApprover({ name: '', email: '', position: '' });
                                                        }}
                                                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all"
                                                    >
                                                        Registrar en Cadena
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Lista de Aprobadores Actuales */}
                                            <div className="space-y-3">
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Secuencia de Aprobación</h4>
                                                {(workflow.approvers || []).length > 0 ? (
                                                    workflow.approvers.map((approver, index) => (
                                                        <div key={approver.id || index} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all shadow-sm">
                                                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{index + 1}</div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-black text-slate-800 uppercase truncate">{approver.name}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{approver.position} • {approver.email}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const updatedApprovers = workflow.approvers.filter((_, i) => i !== index);
                                                                    const otherWorkflows = config.approvalWorkflows.filter(w => w.module !== module);
                                                                    handleUpdate({ ...config, approvalWorkflows: [...otherWorkflows, { ...workflow, approvers: updatedApprovers }] });
                                                                }}
                                                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2rem] p-10 text-slate-300">
                                                        <AlertCircle size={32} className="opacity-20 mb-2" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-center">Sin aprobadores configurados</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfiguracionEmpresa;
