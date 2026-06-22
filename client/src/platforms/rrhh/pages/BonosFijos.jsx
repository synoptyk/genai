import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    TrendingDown, Users, Search, RefreshCw, ChevronDown, ChevronUp, AlertCircle,
    DollarSign, ShieldCheck, CheckCircle2, Award, Calendar
} from 'lucide-react';
import { candidatosApi, proyectosApi, descuentosApi, bonosConfigApi, bonosApi, modelosBonificacionApi } from '../rrhhApi';
import { useAuth } from '../../auth/AuthContext';

const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

const BonosFijos = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [empleados, setEmpleados] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [descuentos, setDescuentos] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closures, setClosures] = useState([]);
    const [modelosBono, setModelosBono] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(currentMonth);
    const [expandedId, setExpandedId] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month] = period.split('-');
            const [candRes, projRes, txRes, configRes, closRes, modRes] = await Promise.all([
                candidatosApi.getAll({ status: 'Activo,Contratado,ACTIVO,En Terreno,Listo Terreno,Licencia Médica' }),
                proyectosApi.getAll(),
                descuentosApi.getTransacciones(period),
                bonosConfigApi.getAll(),
                bonosApi.getClosure(year, month).catch(() => ({ data: [] })),
                modelosBonificacionApi.getAll().catch(() => ({ data: [] }))
            ]);
            setEmpleados(candRes.data || []);
            setProyectos(projRes.data || []);
            setDescuentos(txRes.data || []);
            setBonosConfig(configRes.data || []);
            setClosures(closRes.data || []);
            setModelosBono(modRes.data || []);
        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const cecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    // Lógica para determinar el Bono Fijo y sus deducciones por inasistencia
    const procesarBonosFijos = useMemo(() => {
        const result = [];
        
        empleados.forEach(emp => {
            if (['Finiquitado', 'De Baja', 'Retirado'].includes(emp.status)) return;
            
            const projId = emp.projectId?._id || emp.projectId;
            const proj = proyectos.find(p => p._id === projId);
            if (!proj || !proj.dotacion) return;

            // Extraer las inasistencias y atrasos (LRE 4109 y 4108)
            const empDescuentos = descuentos.filter(tx => tx.candidatoRef === emp._id);
            const diasInasistencia = empDescuentos.filter(tx => tx.tipoDescuentoRef?.codigoDT === '4109').reduce((s, tx) => s + (tx.cantidad || 0), 0);
            const horasAtraso = empDescuentos.filter(tx => tx.tipoDescuentoRef?.codigoDT === '4108').reduce((s, tx) => s + (tx.cantidad || 0), 0);

            // Calcular monto para cada bono fijo
            let totalOriginal = 0;
            let totalPagar = 0;
            const detalles = [];

            // 1. Determinar Modelos de Bonificación Aplicables (Tipo BONO_FIJO)
            const modelosActivos = modelosBono.filter(m => m.activo && m.tipo === 'BONO_FIJO');
            const modelosAplicables = modelosActivos.filter(m => {
                if (m.aplicaA?.todos) return true;
                if (m.aplicaA?.cargos && m.aplicaA.cargos.length > 0) {
                    const normalizedCargo = (emp.position || '').toUpperCase().trim();
                    return m.aplicaA.cargos.map(c => (c || '').toUpperCase().trim()).includes(normalizedCargo);
                }
                return false;
            });

            // 2. Procesar Bonos Fijos configurados en Proyecto (Matriz de Dotación)
            // REGLA: Si hay Modelos de Bonificación aplicables para este cargo, el modelo
            // reemplaza COMPLETAMENTE los bonos del proyecto — nunca coexisten.
            const dot = proj.dotacion.find(d => d.cargo === emp.position);
            const bonosFijosProyecto = dot && dot.bonos ? dot.bonos.filter(b => b.modality === 'Fijo') : [];
            
            // Solo procesar bonos del proyecto si NO hay ningún modelo aplicable
            if (modelosAplicables.length === 0) bonosFijosProyecto.forEach(bf => {
                const bonoRefId = bf.bonoRef?._id || bf.bonoRef;

                const config = bonosConfig.find(c => c._id === bonoRefId);
                const montoBase = bf.monto || config?.config?.monto || 0;
                let montoCalculado = montoBase;

                // Aplicar proporcionalidad si corresponde
                let descuentoAplicado = 0;
                if (config?.payroll?.pagoProporcional && (diasInasistencia > 0 || horasAtraso > 0)) {
                    const descuentoPorDia = montoBase / 30;
                    const descuentoPorHora = montoBase / 180;
                    
                    descuentoAplicado = Math.round((descuentoPorDia * diasInasistencia) + (descuentoPorHora * horasAtraso));
                    montoCalculado = Math.max(0, montoBase - descuentoAplicado);
                }

                totalOriginal += montoBase;
                totalPagar += montoCalculado;
                
                detalles.push({
                    config,
                    montoBase,
                    montoCalculado,
                    descuentoAplicado,
                    nombreBono: bf.description || config?.nombre || 'Bono Fijo (Proyecto)',
                    codigoDT: config?.payroll?.codigoDT || '1040',
                    origen: 'proyecto'
                });
            });

            // 3. Procesar Modelos de Bonificación Aplicables
            modelosAplicables.forEach(mod => {
                const montoBase = mod.bonoFijo?.monto || 0;
                let montoCalculado = montoBase;
                let descuentoAplicado = 0;

                if (mod.bonoFijo?.proporcionalDias && (diasInasistencia > 0 || horasAtraso > 0)) {
                    const descuentoPorDia = montoBase / 30;
                    const descuentoPorHora = montoBase / 180;
                    
                    descuentoAplicado = Math.round((descuentoPorDia * diasInasistencia) + (descuentoPorHora * horasAtraso));
                    montoCalculado = Math.max(0, montoBase - descuentoAplicado);
                }

                totalOriginal += montoBase;
                totalPagar += montoCalculado;

                // En los Modelos, si tiene tipoBonoRef, lo usamos para el código DT, sino fallback a 1040
                const configAsociado = mod.tipoBonoRef ? bonosConfig.find(c => c._id === (mod.tipoBonoRef?._id || mod.tipoBonoRef)) : null;

                detalles.push({
                    config: configAsociado,
                    montoBase,
                    montoCalculado,
                    descuentoAplicado,
                    nombreBono: mod.nombre || 'Bono Fijo (Modelo)',
                    codigoDT: configAsociado?.payroll?.codigoDT || '1040',
                    origen: 'modelo',
                    idModelo: mod._id
                });
            });

            if (detalles.length === 0) return;

            const term = searchTerm.toLowerCase();
            const matchSearch = !searchTerm || emp.fullName?.toLowerCase().includes(term) || emp.rut?.includes(term);
            const ceco = proj.centroCosto || emp.ceco || '';
            const matchCeco = !filterCeco || ceco === filterCeco;

            if (matchSearch && matchCeco) {
                result.push({
                    emp,
                    proj,
                    diasInasistencia,
                    horasAtraso,
                    totalOriginal,
                    totalPagar,
                    detalles
                });
            }
        });

        return result;
    }, [empleados, proyectos, descuentos, bonosConfig, modelosBono, searchTerm, filterCeco]);

    const totalGeneral = procesarBonosFijos.reduce((sum, item) => sum + item.totalPagar, 0);

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans w-full overflow-x-hidden relative">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                            Bonos Fijos Asignados
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-widest rounded-full font-bold">LRE Inteligente</span>
                        </h1>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            Auditoría de Bonos Fijos por Proyecto
                        </p>
                    </div>
                    
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 w-full md:w-auto">
                        <Calendar size={16} className="text-slate-400 ml-2" />
                        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-2" />
                        <button onClick={fetchData} className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <DollarSign size={80} className="text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total a Pagar</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{fmt(totalGeneral)}</p>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ShieldCheck size={80} className="text-blue-600" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Impactados por Faltas</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{procesarBonosFijos.filter(x => x.totalOriginal > x.totalPagar).length}</p>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Users size={80} className="text-slate-600" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Colaboradores Aplican</p>
                        <p className="text-3xl font-black text-slate-900 tracking-tighter">{procesarBonosFijos.length}</p>
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-6 flex flex-wrap items-center gap-4 shadow-xl">
                    <div className="flex-1 min-w-[250px] relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input type="text" placeholder="Buscar por nombre o RUT..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" />
                    </div>
                    <select value={filterCeco} onChange={e => setFilterCeco(e.target.value)} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none">
                        <option value="">Todos los CECO</option>
                        {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden">
                    {loading ? (
                        <div className="py-32 text-center">
                            <RefreshCw className="animate-spin mx-auto text-emerald-500 mb-4" size={40} />
                        </div>
                    ) : procesarBonosFijos.length === 0 ? (
                        <div className="py-32 text-center">
                            <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                            <p className="text-slate-400 font-bold">No hay bonos fijos configurados para este mes</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {procesarBonosFijos.map(item => {
                                const isOpen = expandedId === item.emp._id;
                                const tieneDescuentos = item.diasInasistencia > 0 || item.horasAtraso > 0;

                                return (
                                    <div key={item.emp._id} className="group">
                                        <button onClick={() => setExpandedId(isOpen ? null : item.emp._id)} className="w-full flex items-center gap-4 px-8 py-5 hover:bg-slate-50/80 transition-colors text-left">
                                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-black text-sm flex-shrink-0">
                                                {item.emp.fullName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight block leading-tight">{item.emp.fullName}</span>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block font-mono">{item.emp.rut} · {item.emp.position} · {item.proj?.centroCosto}</p>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                                {tieneDescuentos ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] font-bold text-rose-500 line-through">{fmt(item.totalOriginal)}</span>
                                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-black">
                                                            {fmt(item.totalPagar)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="px-3 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-black">
                                                        {fmt(item.totalPagar)}
                                                    </span>
                                                )}
                                                
                                                {tieneDescuentos && !isOpen && (
                                                    <AlertCircle size={14} className="text-amber-500" />
                                                )}
                                                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                            </div>
                                        </button>

                                        {isOpen && (
                                            <div className="px-8 pb-8 bg-slate-50 border-t border-slate-100 relative">
                                                <div className="mb-6 pt-4 border-b border-slate-200 pb-3 flex justify-between items-end">
                                                    <div>
                                                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Detalle del Bono Fijo</h3>
                                                        {tieneDescuentos && (
                                                            <p className="text-[10px] font-bold text-rose-500 mt-1">Se detectaron {item.diasInasistencia} faltas y {item.horasAtraso} hrs de atraso en el mes</p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-4">
                                                    {item.detalles.map((det, idx) => {
                                                        const isProyecto = det.origen === 'proyecto';
                                                        const isModelo = det.origen === 'modelo';
                                                        
                                                        const handleGoToSource = () => {
                                                            if (isProyecto && item.proj?._id) {
                                                                navigate(`/proyectos?editProyecto=${item.proj._id}`);
                                                            } else if (isModelo && det.idModelo) {
                                                                navigate(`/administracion/modelos-bonificacion?editModelo=${det.idModelo}`);
                                                            }
                                                        };

                                                        return (
                                                            <div 
                                                                key={idx} 
                                                                onClick={handleGoToSource}
                                                                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all group/item"
                                                                title={`Clic para ir a configurar este ${isProyecto ? 'Proyecto' : 'Modelo de Bonificación'}`}
                                                            >
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <p className="text-[11px] font-black text-slate-800 uppercase group-hover/item:text-emerald-600 transition-colors">
                                                                            {det.nombreBono}
                                                                        </p>
                                                                        <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                            Origen: {isProyecto ? 'Proyecto' : 'Modelo'}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block">[LRE-{det.codigoDT}]</span>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-right">
                                                                    {det.descuentoAplicado > 0 && (
                                                                        <div className="text-[9px] font-bold text-rose-500">
                                                                            - {fmt(det.descuentoAplicado)} (Proporcional)
                                                                        </div>
                                                                    )}
                                                                    <div className="text-[12px] font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-xl group-hover/item:bg-emerald-50 group-hover/item:text-emerald-700 transition-colors">
                                                                        {fmt(det.montoCalculado)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BonosFijos;
