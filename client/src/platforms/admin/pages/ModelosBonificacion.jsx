import React, { useState } from 'react';
import { ShieldAlert, Info, Plus, CalendarCheck, TrendingUp, HandCoins, CheckCircle2 } from 'lucide-react';

/* --- CATÁLOGO LEGAL DT (DIRECCIÓN DEL TRABAJO CHILE) --- */
const CATALOGO_DT = {
    fija: [
        { id: 'fija_antiguedad', nombre: 'Bono de Antigüedad', imponible: true, description: 'Compensación fija mensual por años de servicio en la empresa.' },
        { id: 'fija_responsabilidad', nombre: 'Asignación de Responsabilidad', imponible: true, description: 'Bono asociado al desempeño de cargos de jefatura o supervisión.' },
        { id: 'fija_titulo', nombre: 'Asignación de Título', imponible: true, description: 'Bono fijo por posesión de título profesional o técnico relevante al cargo.' },
        { id: 'fija_zona', nombre: 'Asignación de Zona', imponible: true, description: 'Compensación por desempeño de funciones en zonas extremas.' },
        { id: 'fija_aguinaldo', nombre: 'Aguinaldo (Pactado)', imponible: true, description: 'Monto fijo establecido en contrato o convenio colectivo (Ej: Fiestas Patrias, Navidad).' }
    ],
    variable: [
        { id: 'var_produccion', nombre: 'Bono de Producción o Metas', subCategoria: 'Metas', imponible: true, description: 'Remuneración asociada al cumplimiento de objetivos o KPIs de producción.' },
        { id: 'var_gestion', nombre: 'Bono de Gestión', subCategoria: 'Metas', imponible: true, description: 'Bono variable basado en la evaluación de desempeño y gestión anual/mensual.' },
        { id: 'var_trato', nombre: 'Bono a Trato / Especialidad', subCategoria: 'Puntos y Baremos', imponible: true, description: 'Pago determinado por unidad de obra, instalación o tarea completada (Baremos).' },
        { id: 'var_comision', nombre: 'Comisiones por Venta', subCategoria: 'Comisiones', imponible: true, description: 'Porcentaje o monto sobre el valor de ventas o cierre de negocios.' },
        { id: 'var_nocturno', nombre: 'Recargo Turno Nocturno', subCategoria: 'Puntos y Baremos', imponible: true, description: 'Recargo legal u opcional por labores realizadas entre las 22:00 y las 07:00 hrs.' }
    ],
    otras: [
        { id: 'otr_movilizacion', nombre: 'Asignación de Movilización', imponible: false, description: 'Compensación de gastos de traslado del domicilio al lugar de trabajo. (No Imponible - Art 41).' },
        { id: 'otr_colacion', nombre: 'Asignación de Colación', imponible: false, description: 'Compensación de gastos de alimentación durante la jornada. (No Imponible - Art 41).' },
        { id: 'otr_viatico', nombre: 'Viático', imponible: false, description: 'Cubrimiento de gastos de alojamiento y alimentación por labor fuera del lugar habitual. (No Imponible - Art 41).' },
        { id: 'otr_herramientas', nombre: 'Desgaste de Herramientas', imponible: false, description: 'Compensación por uso de herramientas propias del trabajador. (No Imponible - Art 41).' },
        { id: 'otr_caja', nombre: 'Pérdida de Caja', imponible: false, description: 'Asignación para cubrir eventuales faltantes de dinero en recaudadores/cajeros. (No Imponible - Art 41).' },
    ]
};

const ModelosBonificacion = () => {
    const [activeTab, setActiveTab] = useState('fija');
    const [customBonos, setCustomBonos] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // Custom Bono Form State
    const [cbNombre, setCbNombre] = useState('');
    const [cbTipo, setCbTipo] = useState('otras');
    const [cbImponible, setCbImponible] = useState(false);
    const [cbCategoria, setCbCategoria] = useState(''); // Only used for Variable
    const [cbDescripcion, setCbDescripcion] = useState('');

    const handleCreateCustom = (e) => {
        e.preventDefault();
        const newBono = {
            id: `usr_custom_${Date.now()}`,
            nombre: cbNombre,
            imponible: cbImponible,
            description: cbDescripcion,
            isCustom: true
        };

        if (cbTipo === 'variable') newBono.subCategoria = cbCategoria || 'General';

        setCustomBonos(prev => [...prev, { ...newBono, tipoList: cbTipo }]);
        setShowModal(false);
        // Reset form
        setCbNombre(''); setCbTipo('otras'); setCbImponible(false); setCbCategoria(''); setCbDescripcion('');
    };

    const deleteCustom = (id) => {
        setCustomBonos(prev => prev.filter(b => b.id !== id));
    };

    const getFullList = (tipo) => {
        const dtList = CATALOGO_DT[tipo];
        const customList = customBonos.filter(b => b.tipoList === tipo);
        return [...dtList, ...customList];
    };

    const TABS = [
        { id: 'fija', label: 'Bonificación Fija', icon: CalendarCheck, color: 'indigo', desc: 'Asignaciones recurrentes e invariables' },
        { id: 'variable', label: 'Bonificación Variable', icon: TrendingUp, color: 'emerald', desc: 'Metas, comisiones y producción (Baremos)' },
        { id: 'otras', label: 'Otras y Personalizadas', icon: HandCoins, color: 'amber', desc: 'Compensaciones de gastos e indemnizaciones' }
    ];

    const currentTabObj = TABS.find(t => t.id === activeTab);
    const renderList = getFullList(activeTab);

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* HERADER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Modelos de Bonificación</h1>
                    <p className="text-slate-500 font-medium text-sm mt-2 max-w-2xl">
                        Catálogo normativo de compensaciones basado en la Dirección del Trabajo (DT Chile).
                        Define la estructura salarial, imputabilidad de costos (baremos) y tributación (imponible vs no imponible).
                    </p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 transition-all"
                >
                    <Plus size={16} /> Crear Bono Personalizado
                </button>
            </div>

            {/* ART. 41 LEGAL ALERT */}
            <div className="bg-sky-50 border border-sky-100 rounded-[2rem] p-6 flex items-start gap-4">
                <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0 text-sky-600">
                    <Info size={20} />
                </div>
                <div>
                    <h3 className="text-xs font-black text-sky-900 uppercase tracking-widest mb-1">Malla Legal: Art. 41 Código del Trabajo</h3>
                    <p className="text-sm font-semibold text-sky-800 leading-relaxed">
                        Se entiende por remuneración (Imponible) todo pago que reciba el trabajador por sus servicios.
                        No constituyen remuneración (No Imponible) las asignaciones de movilización, colación, pérdida de caja, viáticos y herramientas.
                    </p>
                </div>
            </div>

            {/* TABS CONTROLS */}
            <div className="flex flex-wrap items-center gap-4 border-b-2 border-slate-100 pb-px">
                {TABS.map(t => {
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-3 pb-4 px-4 border-b-2 transition-all group ${isActive ? `border-${t.color}-600` : 'border-transparent hover:border-slate-300'}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? `bg-${t.color}-600 text-white shadow-md` : `bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600`}`}>
                                <t.icon size={16} />
                            </div>
                            <div className="text-left">
                                <p className={`text-sm font-black ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>{t.label}</p>
                                <p className={`text-[10px] uppercase font-bold tracking-widest hidden md:block ${isActive ? `text-${t.color}-500` : 'text-slate-400'}`}>{t.desc}</p>
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* TABS CONTENT */}
            <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm">

                <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 bg-${currentTabObj.color}-100 text-${currentTabObj.color}-600 rounded-xl`}>
                            <currentTabObj.icon size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Catálogo: {currentTabObj.label}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{currentTabObj.desc}</p>
                        </div>
                    </div>
                </div>

                {renderList.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[2rem]">
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Sin registros en esta categoría</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {renderList.map((bono) => (
                            <div key={bono.id} className={`bg-slate-50 border border-slate-200 rounded-3xl p-6 relative group transition-all hover:bg-white hover:border-${currentTabObj.color}-200 hover:shadow-md`}>
                                {bono.isCustom && (
                                    <span className="absolute -top-3 right-6 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md z-10">
                                        Personalizado
                                    </span>
                                )}
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-base font-black text-slate-900 leading-tight">{bono.nombre}</h3>
                                        {bono.subCategoria && (
                                            <p className={`text-[10px] font-bold text-${currentTabObj.color}-600 uppercase tracking-widest mt-1`}>{bono.subCategoria}</p>
                                        )}
                                    </div>
                                    <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border-2 flex-shrink-0 ${bono.imponible ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                                        <CheckCircle2 size={14} />
                                        {bono.imponible ? 'Imponible' : 'No Imponible'}
                                    </div>
                                </div>
                                <p className="text-sm font-semibold text-slate-500 leading-relaxed mb-4">{bono.description}</p>

                                <div className="border-t border-slate-200/60 pt-4 flex items-center justify-between">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                        {bono.isCustom ? 'Creado por Empresa' : 'Estándar Normativo DT'}
                                    </p>
                                    {bono.isCustom && (
                                        <button onClick={() => deleteCustom(bono.id)} className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest transition-colors py-1 px-2 hover:bg-red-50 rounded-lg">
                                            Eliminar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL CREAR BONO */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-10 w-full max-w-2xl shadow-2xl my-auto">
                        <div className="mb-8">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Crear Bono Personalizado</h3>
                            <p className="text-sm font-semibold text-slate-500 mt-1">Define las reglas de compensación para tu empresa.</p>
                        </div>

                        <form onSubmit={handleCreateCustom} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nombre de Bonificación *</label>
                                    <input type="text" value={cbNombre} onChange={e => setCbNombre(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold focus:outline-none focus:border-indigo-400 transition-all"
                                        placeholder="Ej: Bono Trimestral Especial" required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Clasificación *</label>
                                    <select value={cbTipo} onChange={e => setCbTipo(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold focus:outline-none focus:border-indigo-400 transition-all">
                                        <option value="fija">Fija (Recurrente)</option>
                                        <option value="variable">Variable (Metas / Baremos)</option>
                                        <option value="otras">Otras (Gastos / Extras)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tributación Legal *</label>
                                    <select value={cbImponible} onChange={e => setCbImponible(e.target.value === 'true')}
                                        className={`w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl text-sm font-bold focus:outline-none transition-all ${!cbImponible ? 'border-amber-200 text-amber-800 focus:border-amber-400' : 'border-slate-200 text-slate-900 focus:border-indigo-400'}`}>
                                        <option value="true">Es Imponible (Constituye Remuneración)</option>
                                        <option value="false">No Imponible (No Tributa AFP/Salud)</option>
                                    </select>
                                </div>

                                {cbTipo === 'variable' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sub Categoría *</label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Metas', 'Puntos y Baremos', 'Comisiones', 'General'].map(cat => (
                                                <button key={cat} type="button" onClick={() => setCbCategoria(cat)}
                                                    className={`px-4 py-2.5 rounded-xl border-2 text-[11px] font-black uppercase tracking-widest transition-all ${cbCategoria === cat ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción Funcional</label>
                                    <textarea value={cbDescripcion} onChange={e => setCbDescripcion(e.target.value)}
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-900 text-sm font-bold focus:outline-none focus:border-indigo-400 transition-all resize-none"
                                        rows="3" placeholder="Explica brevemente bajo qué condiciones se otorga este bono..."
                                    />
                                </div>
                            </div>

                            {/* WARNING LEGAL ALERT COMPONENT */}
                            {(!cbImponible && (cbTipo === 'variable' || cbCategoria === 'Metas' || cbCategoria === 'Puntos y Baremos' || cbCategoria === 'Comisiones')) && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-amber-100 p-2 rounded-xl text-amber-600 flex-shrink-0">
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Alerta de Cumplimiento Normativo (DT)</p>
                                        <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                            Los bonos No Imponibles no deben ser utilizados para encubrir pagos de producción, tratos (baremos), metas o comisiones.
                                            Su uso es exclusivo para compensación de gastos efectivos incurridos por el trabajador (Viáticos, Movilización, Colación, Pérdida de Caja, Herramientas).
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={!cbNombre || (cbTipo === 'variable' && !cbCategoria)} className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    Crear Bono
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelosBonificacion;
