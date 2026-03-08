import React, { useState, useEffect } from 'react';
import {
    Building2, Plus, Loader2,
    Settings, Briefcase, Landmark, ShieldCheck,
    Trash2, AlertCircle, Workflow, Image as ImageIcon, Save,
    History, X, BarChart3
} from 'lucide-react';
import { configApi } from '../rrhhApi';
import axios from 'axios';
import API_URL from '../../../config';

const ConfiguracionEmpresa = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('cecos');
    const [saving, setSaving] = useState(false);

    // Temp states for adding new items
    const [newCargo, setNewCargo] = useState({ nombre: '', categoria: 'Operativo' });
    const [newArea, setNewArea] = useState('');
    const [newDept, setNewDept] = useState('');
    const [newCeco, setNewCeco] = useState('');
    const [newSubCeco, setNewSubCeco] = useState('');
    const [newProjectType, setNewProjectType] = useState('');
    const [newApprover, setNewApprover] = useState({ name: '', email: '', position: '' });

    // Logo & Empresa States
    const [logoUrl, setLogoUrl] = useState('');
    const [savingEmpresa, setSavingEmpresa] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await configApi.get();
            setConfig(res.data);
            if (res.data.logo) setLogoUrl(res.data.logo);
        } catch (e) {
            console.error("Error fetching config:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (updatedConfig) => {
        setSaving(true);
        try {
            const res = await configApi.update(updatedConfig);
            setConfig(res.data);
        } catch (e) {
            console.error("Error updating config:", e);
            alert("Error al guardar cambios");
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoUrl(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateEmpresa = async () => {
        setSavingEmpresa(true);
        try {
            await configApi.update({ ...config, logo: logoUrl });
            alert("Identidad institucional actualizada con éxito");
        } catch (e) {
            console.error(e);
            alert("Error al actualizar identidad");
        } finally {
            setSavingEmpresa(false);
        }
    };

    // Active sub-item adding
    const [addingTo, setAddingTo] = useState({ type: '', index: -1 });

    const addItem = (field, value, resetFn) => {
        if (!value) return;
        if (typeof value === 'string' && !value.trim()) return;

        let updatedValue;
        if (field === 'cecos') updatedValue = { nombre: value, subCecos: [] };
        else if (field === 'areas') updatedValue = { nombre: value, departamentos: [] };
        else if (field === 'cargos') updatedValue = value; // value is already {nombre, categoria}
        else updatedValue = value;

        const updatedConfig = { ...config, [field]: [...(config[field] || []), updatedValue] };
        handleUpdate(updatedConfig);
        if (resetFn) resetFn(field === 'cargos' ? { nombre: '', categoria: 'Operativo' } : '');
    };

    const addSubItem = (field, index, subValue, subField, resetFn) => {
        if (!subValue || !subValue.trim()) return;
        const updatedList = [...config[field]];
        updatedList[index][subField] = [...(updatedList[index][subField] || []), subValue.trim().toUpperCase()];
        handleUpdate({ ...config, [field]: updatedList });
        resetFn('');
        setAddingTo({ type: '', index: -1 });
    };

    const removeSubItem = (field, index, subIndex, subField) => {
        const updatedList = [...config[field]];
        updatedList[index][subField] = updatedList[index][subField].filter((_, i) => i !== subIndex);
        handleUpdate({ ...config, [field]: updatedList });
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

    if (!config) return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
            <AlertCircle className="text-red-500" size={48} />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">Error cargando configuración</p>
            <button onClick={fetchConfig} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-xs font-black uppercase">Reintentar</button>
        </div>
    );

    const tabs = [
        { id: 'perfil', label: 'Perfil Institucional', icon: ImageIcon },
        { id: 'cecos', label: 'Centros de Costo', icon: Landmark },
        { id: 'proyectos', label: 'Tipos de Proyecto', icon: Workflow },
        { id: 'areas', label: 'Áreas', icon: Building2 },
        { id: 'cargos', label: 'Cargos', icon: Briefcase },
        { id: 'aprobaciones', label: 'Flujos de Aprobación', icon: ShieldCheck },
        { id: 'auditoria', label: 'Auditoría', icon: History },
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

                {/* PERFIL INSTITUCIONAL (LOGO) */}
                {activeTab === 'perfil' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Identidad Corporativa</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Personalice la plataforma y los correos enviados hacia sus clientes y empleados.</p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Form */}
                            <div className="flex-1 space-y-6 bg-slate-50/50 p-8 rounded-[2rem] border border-slate-100">
                                <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">Emblema de la Empresa</h3>

                                <div className="space-y-4">
                                    <div className="flex flex-col gap-4">
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest">Subir Imagen Corporativa</label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group">
                                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={savingEmpresa} />
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:text-indigo-600 group-hover:bg-white transition-all">
                                                        <ImageIcon size={24} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Click para subir foto</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-2">O pegar URL del Logo</label>
                                        <input
                                            type="url"
                                            placeholder="https://ejemplo.com/logo-empresa.png"
                                            className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 text-sm"
                                            value={logoUrl}
                                            onChange={e => setLogoUrl(e.target.value)}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium">Recomendable usar formato PNG con fondo transparente formato cuadrado o rectangular.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdateEmpresa}
                                    disabled={savingEmpresa}
                                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 w-full justify-center mt-4"
                                >
                                    {savingEmpresa ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    Guardar Identidad Institucional
                                </button>
                            </div>

                            {/* Preview */}
                            <div className="w-full lg:w-96 flex flex-col gap-4">
                                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[250px] relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Previsualización del Documento</span>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full text-center border-b border-slate-100 pb-2 mb-6">Apariencia en Correos y Citas</h3>

                                    {logoUrl ? (
                                        <img src={logoUrl} alt="Previsualización Logo" className="max-w-[200px] max-h-[120px] object-contain relative z-10" onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/200x120?text=Error+al+Cargar+Logo"; }} />
                                    ) : (
                                        <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300 relative z-10">
                                            <ImageIcon size={32} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* CARGOS */}
                {activeTab === 'cargos' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Diccionario de Cargos</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Defina los roles oficiales y su categoría organizacional</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                            <div className="lg:col-span-1 relative">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="NOMBRE DEL CARGO"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 uppercase italic"
                                    value={newCargo.nombre}
                                    onChange={e => setNewCargo({ ...newCargo, nombre: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <select
                                    className="w-full px-4 py-4 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 outline-none focus:border-indigo-500"
                                    value={newCargo.categoria}
                                    onChange={e => setNewCargo({ ...newCargo, categoria: e.target.value })}
                                >
                                    <option value="Operativo">Operativo</option>
                                    <option value="Administrativo">Administrativo</option>
                                    <option value="Gerencial">Gerencial</option>
                                    <option value="Otros">Otros</option>
                                </select>
                            </div>
                            <button
                                onClick={() => addItem('cargos', newCargo, setNewCargo)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-indigo-200 justify-center font-black italic"
                            >
                                <Plus size={16} /> Registrar Cargo
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar p-1">
                            {(config.cargos || []).map((cargo, idx) => (
                                <div key={idx} className="group flex flex-col bg-white border border-slate-100 p-6 rounded-[2rem] hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-100/30 transition-all relative">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter 
                                            ${cargo.categoria === 'Gerencial' ? 'bg-amber-100 text-amber-700' :
                                                cargo.categoria === 'Administrativo' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {cargo.categoria || 'Operativo'}
                                        </span>
                                        <button onClick={() => removeItem('cargos', idx)} className="text-slate-200 hover:text-red-500 transition-all p-1">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <span className="text-sm font-black text-slate-800 uppercase italic tracking-tight leading-none">{typeof cargo === 'string' ? cargo : cargo.nombre}</span>
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
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Estructura de Áreas & Departamentos</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Defina las unidades de negocio y sus dependencias</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-8 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                            <div className="flex-1 relative">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="NUEVA ÁREA (EJ: OPERACIONES)"
                                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-black text-slate-700 uppercase italic"
                                    value={newArea}
                                    onChange={e => setNewArea(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('areas', newArea, setNewArea)}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <Plus size={16} /> Crear Área Principal
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                            {(config.areas || []).map((area, idx) => (
                                <div key={idx} className="bg-white border border-slate-100 rounded-[2.5rem] p-8 hover:shadow-xl hover:shadow-slate-100 transition-all group border-l-4 border-l-indigo-500">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Building2 size={18} /></div>
                                            <h3 className="text-base font-black text-slate-800 uppercase italic tracking-tight">{typeof area === 'string' ? area : area.nombre}</h3>
                                        </div>
                                        <button onClick={() => removeItem('areas', idx)} className="text-slate-200 hover:text-red-500 transition-colors p-2">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                            <span>Departamentos Vinculados</span>
                                            <span className="bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full">{area.departamentos?.length || 0}</span>
                                        </div>

                                        {(area.departamentos || []).map((dept, dIdx) => (
                                            <div key={dIdx} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 group/item">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{dept}</span>
                                                <button onClick={() => removeSubItem('areas', idx, dIdx, 'departamentos')} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-all">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}

                                        {addingTo.type === 'area' && addingTo.index === idx ? (
                                            <div className="flex gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Nombre Departamento..."
                                                    className="flex-1 bg-white border border-indigo-200 p-3 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-100"
                                                    value={newDept}
                                                    onChange={e => setNewDept(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === 'Enter' && addSubItem('areas', idx, newDept, 'departamentos', setNewDept)}
                                                />
                                                <button
                                                    onClick={() => addSubItem('areas', idx, newDept, 'departamentos', setNewDept)}
                                                    className="bg-emerald-500 text-white p-3 rounded-xl hover:bg-emerald-600 transition-all"
                                                >
                                                    <Save size={14} />
                                                </button>
                                                <button onClick={() => setAddingTo({ type: '', index: -1 })} className="text-slate-400 p-2"><X size={16} /></button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAddingTo({ type: 'area', index: idx })}
                                                className="w-full py-3 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-400 hover:bg-indigo-50/50 transition-all mt-2"
                                            >
                                                + Añadir Sub-Departamento
                                            </button>
                                        )}
                                    </div>
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
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Centros de Costo & Sub-CECO</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Estructura financiera de imputación directa e indirecta</p>
                            </div>
                        </div>

                        <div className="flex gap-4 mb-10 bg-indigo-900 p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100">
                            <div className="flex-1 relative">
                                <Landmark className="absolute left-5 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
                                <input
                                    type="text"
                                    placeholder="CÓDIGO CECO PRINCIPAL (EJ: RRHH)"
                                    className="w-full pl-14 pr-4 py-5 bg-indigo-800/40 border border-indigo-500/30 rounded-2xl focus:border-white/50 outline-none font-black text-white placeholder-indigo-400 uppercase italic tracking-widest"
                                    value={newCeco}
                                    onChange={e => setNewCeco(e.target.value.toUpperCase())}
                                />
                            </div>
                            <button
                                onClick={() => addItem('cecos', newCeco, setNewCeco)}
                                disabled={saving}
                                className="bg-white text-indigo-900 px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 hover:scale-105 active:scale-95 shadow-lg shadow-black/10"
                            >
                                <Plus size={18} /> Registrar CECO
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                            {(config.cecos || []).map((ceco, idx) => (
                                <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-[3rem] p-10 hover:bg-white hover:shadow-2xl hover:shadow-slate-200/50 transition-all group relative border-t-8 border-t-indigo-600">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter tabular-nums">{typeof ceco === 'string' ? ceco : ceco.nombre}</h3>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Estructura de costos activa</p>
                                        </div>
                                        <button onClick={() => removeItem('cecos', idx)} className="p-3 bg-rose-50 text-rose-300 hover:text-rose-600 rounded-2xl transition-all">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Segmentación (Sub-CECO)</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase">{ceco.subCecos?.length || 0} Registros</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {(ceco.subCecos || []).map((sub, sIdx) => (
                                                <div key={sIdx} className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-slate-100 group/sub">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tighter italic">{sub}</span>
                                                    <button onClick={() => removeSubItem('cecos', idx, sIdx, 'subCecos')} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover/sub:opacity-100 transition-all font-black">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {addingTo.type === 'ceco' && addingTo.index === idx ? (
                                            <div className="flex gap-2 mt-6 animate-in zoom-in-95 duration-200">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="NUEVA SEGMENTACIÓN..."
                                                    className="flex-1 bg-white border-2 border-indigo-600 px-5 py-4 rounded-2xl text-xs font-black uppercase outline-none shadow-lg shadow-indigo-100"
                                                    value={newSubCeco}
                                                    onChange={e => setNewSubCeco(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === 'Enter' && addSubItem('cecos', idx, newSubCeco, 'subCecos', setNewSubCeco)}
                                                />
                                                <button
                                                    onClick={() => addSubItem('cecos', idx, newSubCeco, 'subCecos', setNewSubCeco)}
                                                    className="bg-indigo-600 text-white px-6 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                                >
                                                    <Plus size={20} />
                                                </button>
                                                <button onClick={() => setAddingTo({ type: '', index: -1 })} className="p-3 text-slate-400 bg-slate-100 rounded-2xl"><X size={20} /></button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAddingTo({ type: 'ceco', index: idx })}
                                                className="w-full py-5 bg-white border-2 border-dashed border-slate-200 rounded-3xl text-xs font-black text-slate-400 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all mt-4 italic"
                                            >
                                                + Vincular Sub-CECO
                                            </button>
                                        )}
                                    </div>
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
                                                        {(config.cargos || []).map(c => {
                                                            const nombre = typeof c === 'string' ? c : c.nombre;
                                                            return <option key={nombre} value={nombre}>{nombre}</option>;
                                                        })}
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

                {/* AUDITORÍA DE CAMBIOS */}
                {activeTab === 'auditoria' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historial de Cambios</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Registro de actualizaciones en la configuración organizacional</p>
                            </div>
                        </div>

                        <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                            {(config.history || []).length > 0 ? (
                                config.history.map((log, lIdx) => (
                                    <div key={lIdx} className="bg-white border border-slate-100 p-6 rounded-3xl flex items-start gap-4 hover:border-indigo-100 group transition-all">
                                        <div className="p-3 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl transition-all">
                                            <History size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{log.action}</h4>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 mt-1 font-medium">{log.description}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                                                </div>
                                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">Modificado por: {log.user}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                    <AlertCircle size={48} className="opacity-20 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-[0.2em]">No se registran cambios recientes</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfiguracionEmpresa;
