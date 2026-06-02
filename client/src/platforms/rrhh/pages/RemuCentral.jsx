import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Landmark, RefreshCw, Search, Building2,
    Calculator, DollarSign, TrendingUp, UserCheck, UserX,
    Download, ChevronDown, ChevronUp, Briefcase, AlertCircle, Calendar
} from 'lucide-react';
import { candidatosApi, proyectosApi, descuentosApi, bonosConfigApi, bonosApi, beneficiosApi, modelosBonificacionApi } from '../rrhhApi';
import { formatRut } from '../../../utils/rutUtils';
import * as XLSX from 'xlsx';

const fmt = (n) => `$${Math.round(n || 0).toLocaleString('es-CL')}`;

const RemuCentral = () => {
    const [employees, setEmployees] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [descuentos, setDescuentos] = useState([]);
    const [beneficios, setBeneficios] = useState([]);
    const [bonosConfig, setBonosConfig] = useState([]);
    const [closures, setClosures] = useState([]);
    const [modelosBono, setModelosBono] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCeco, setFilterCeco] = useState('');
    const [filterStatus, setFilterStatus] = useState('Activo'); // Default to active personnel

    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(currentMonth);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [year, month] = period.split('-');
            const [candRes, projRes, txRes, configRes, closRes, benRes, modRes] = await Promise.all([
                candidatosApi.getAll(),
                proyectosApi.getAll(),
                descuentosApi.getTransacciones(period).catch(() => ({ data: [] })),
                bonosConfigApi.getAll(),
                bonosApi.getClosure(year, month).catch(() => ({ data: [] })),
                beneficiosApi.getTransacciones(period).catch(() => ({ data: [] })),
                modelosBonificacionApi.getAll().catch(() => ({ data: [] }))
            ]);
            
            setEmployees(candRes.data || []);
            setProyectos(projRes.data || []);
            setDescuentos(txRes.data || []);
            setBonosConfig(configRes.data || []);
            setClosures(closRes.data || []);
            setBeneficios(benRes.data || []);
            setModelosBono(modRes.data || []);
        } catch (e) {
            console.error('Error fetching RemuCentral data:', e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const cecos = [...new Set(proyectos.map(p => p.centroCosto).filter(Boolean))];

    // Master Consolidation Algorithm - DYNAMIC PIVOT
    const { consolidado, uniqueColumns } = useMemo(() => {
        const result = [];
        const uniqueFijos = new Map();
        const uniqueVariables = new Map();
        const uniqueDescuentos = new Map();
        const uniqueBeneficios = new Map();
        
        employees.forEach(emp => {
            // Filtrar finiquitados según el periodo
            if (emp.status === 'Finiquitado' || emp.status === 'De Baja' || emp.status === 'Retirado') {
                if (emp.fechaFiniquito) {
                    const fQ = new Date(emp.fechaFiniquito);
                    const pDate = new Date(`${period}-01T00:00:00`);
                    // Solo mostrarlos en el mes que fueron finiquitados
                    if (fQ.getMonth() !== pDate.getMonth() || fQ.getFullYear() !== pDate.getFullYear()) {
                        return; // Excluir
                    }
                } else {
                    return; // Si no tiene fecha, lo ocultamos de nóminas actuales
                }
            }

            const term = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || 
                emp.fullName?.toLowerCase().includes(term) || 
                emp.rut?.includes(term) || 
                emp.position?.toLowerCase().includes(term);
            
            const projId = emp.projectId?._id || emp.projectId;
            const proj = proyectos.find(p => p._id === projId);
            const ceco = proj?.centroCosto || emp.ceco || 'N/A';
            const matchesCeco = !filterCeco || ceco === filterCeco;
            
            const matchesStatus = filterStatus === 'Todos' || 
                (filterStatus === 'Activo' && emp.status === 'Contratado') || 
                (filterStatus === 'Fis/Ret' && ['Finiquitado', 'Retirado', 'De Baja'].includes(emp.status));

            if (!matchesSearch || !matchesCeco || !matchesStatus) return;

            const sueldoBase = Number(emp.sueldoBase) || 0;
            
            // Colecciones para este empleado
            const eFijos = {};
            const eVariables = {};
            const eDescuentos = {};
            const eBeneficios = {};

            // 1. Descuentos y Faltas
            const empDescuentos = descuentos.filter(tx => tx.candidatoRef === emp._id);
            let diasInasistencia = 0;
            let horasAtraso = 0;

            empDescuentos.forEach(tx => {
                const dtCode = tx.tipoDescuentoRef?.codigoDT || 'DESC';
                const nombre = tx.tipoDescuentoRef?.nombre || 'Descuento Múltiple';
                const monto = tx.monto || 0;

                if (dtCode === '4109') diasInasistencia += (tx.cantidad || 0);
                if (dtCode === '4108') horasAtraso += (tx.cantidad || 0);

                const colKey = `${nombre} [LRE ${dtCode}]`;
                uniqueDescuentos.set(colKey, dtCode);
                eDescuentos[colKey] = (eDescuentos[colKey] || 0) + monto;
            });

            // 1.5 Beneficios Salariales
            const empBeneficios = beneficios.filter(tx => tx.candidatoRef === emp._id);
            empBeneficios.forEach(tx => {
                const dtCode = tx.tipoBeneficioRef?.codigoDT || 'BEN';
                const nombre = tx.tipoBeneficioRef?.nombre || 'Beneficio Múltiple';
                const monto = tx.monto || 0;

                const colKey = `${nombre} [LRE ${dtCode}]`;
                uniqueBeneficios.set(colKey, dtCode);
                eBeneficios[colKey] = (eBeneficios[colKey] || 0) + monto;
            });

            // 2. Bonos Fijos
            // Determinar Modelos de Bonificación Aplicables (Tipo BONO_FIJO)
            const modelosActivos = modelosBono.filter(m => m.activo && m.tipo === 'BONO_FIJO');
            const modelosAplicables = modelosActivos.filter(m => {
                if (m.aplicaA?.todos) return true;
                if (m.aplicaA?.cargos && m.aplicaA.cargos.length > 0) {
                    const normalizedCargo = (emp.position || '').toUpperCase().trim();
                    return m.aplicaA.cargos.map(c => (c || '').toUpperCase().trim()).includes(normalizedCargo);
                }
                return false;
            });

            if (proj?.dotacion) {
                const dot = proj.dotacion.find(d => d.cargo === emp.position);
                if (dot?.bonos) {
                    const bonosFijos = dot.bonos.filter(b => b.modality === 'Fijo');
                    bonosFijos.forEach(bf => {
                        const bonoRefId = bf.bonoRef?._id || bf.bonoRef;
                        
                        // Si este bono ya está cubierto por un Modelo de Bonificación, lo omitimos para evitar duplicidad
                        const isCoveredByModel = modelosAplicables.some(mod => 
                            bonoRefId === mod._id || 
                            bonoRefId === mod.tipoBonoRef?._id || 
                            bonoRefId === mod.tipoBonoRef
                        );
                        if (isCoveredByModel) return;

                        const config = bonosConfig.find(c => c._id === bonoRefId);
                        const montoBase = bf.monto || config?.config?.monto || 0;
                        let montoCalculado = montoBase;

                        if (config?.payroll?.pagoProporcional && (diasInasistencia > 0 || horasAtraso > 0)) {
                            const descDia = montoBase / 30;
                            const descHora = montoBase / 180;
                            const descApp = Math.round((descDia * diasInasistencia) + (descHora * horasAtraso));
                            montoCalculado = Math.max(0, montoBase - descApp);
                        }
                        
                        const dtCode = config?.payroll?.codigoDT || '1040';
                        const nombre = bf.description || config?.nombre || 'Bono Fijo';
                        const colKey = `${nombre} [LRE ${dtCode}]`;
                        
                        uniqueFijos.set(colKey, dtCode);
                        eFijos[colKey] = (eFijos[colKey] || 0) + montoCalculado;
                    });
                }
            }

            // Procesar los Modelos de Bonificación Aplicables (Tipo BONO_FIJO)
            modelosAplicables.forEach(mod => {
                const montoBase = mod.bonoFijo?.monto || 0;
                let montoCalculado = montoBase;

                if (mod.bonoFijo?.proporcionalDias && (diasInasistencia > 0 || horasAtraso > 0)) {
                    const descDia = montoBase / 30;
                    const descHora = montoBase / 180;
                    const descApp = Math.round((descDia * diasInasistencia) + (descHora * horasAtraso));
                    montoCalculado = Math.max(0, montoBase - descApp);
                }

                // En los Modelos, si tiene tipoBonoRef, lo usamos para el código DT, sino fallback a 1040
                const configAsociado = mod.tipoBonoRef ? bonosConfig.find(c => c._id === (mod.tipoBonoRef?._id || mod.tipoBonoRef)) : null;
                const dtCode = configAsociado?.payroll?.codigoDT || '1040';
                const nombre = mod.nombre || 'Bono Fijo';
                const colKey = `${nombre} [LRE ${dtCode}]`;

                uniqueFijos.set(colKey, dtCode);
                eFijos[colKey] = (eFijos[colKey] || 0) + montoCalculado;
            });

            // 3. Bonos Variables
            closures.forEach(cl => {
                if (cl.status !== 'CERRADO') return;
                const txs = cl.transacciones || [];
                const empTxs = txs.filter(t => t.beneficiario?.rut === emp.rut || t.beneficiario?.tecnicoRef === emp.idRecursoToa);
                empTxs.forEach(tx => {
                    const monto = tx.monto || 0;
                    const dtCode = tx.legalOverride?.codigoDT || '1030';
                    const nombre = tx.legalOverride?.concepto || 'Bono Variable';
                    const colKey = `${nombre} [LRE ${dtCode}]`;
                    
                    uniqueVariables.set(colKey, dtCode);
                    eVariables[colKey] = (eVariables[colKey] || 0) + monto;
                });
            });

            const totalFijos = Object.values(eFijos).reduce((a, b) => a + b, 0);
            const totalVariables = Object.values(eVariables).reduce((a, b) => a + b, 0);
            const totalBeneficios = Object.values(eBeneficios).reduce((a, b) => a + b, 0);
            const totalDescuentosCalc = Object.values(eDescuentos).reduce((a, b) => a + b, 0);

            const totalHaberes = sueldoBase + totalFijos + totalVariables + totalBeneficios;
            const totalBrutoPreliminar = totalHaberes - totalDescuentosCalc;

            result.push({
                emp,
                projectName: proj?.nombreProyecto || 'N/A',
                ceco,
                sueldoBase,
                fijos: eFijos,
                variables: eVariables,
                beneficios: eBeneficios,
                descuentos: eDescuentos,
                totalHaberes,
                totalBrutoPreliminar
            });
        });

        return {
            consolidado: result.sort((a, b) => b.totalHaberes - a.totalHaberes),
            uniqueColumns: {
                fijos: Array.from(uniqueFijos.keys()).sort(),
                variables: Array.from(uniqueVariables.keys()).sort(),
                beneficios: Array.from(uniqueBeneficios.keys()).sort(),
                descuentos: Array.from(uniqueDescuentos.keys()).sort()
            }
        };
    }, [employees, proyectos, descuentos, beneficios, bonosConfig, closures, modelosBono, searchTerm, filterCeco, filterStatus, period]);

    const exportToExcel = () => {
        const data = consolidado.map(c => {
            const row = {
                'NOMBRE COMPLETO': c.emp.fullName,
                'RUT': formatRut(c.emp.rut),
                'CARGO': c.emp.position,
                'ESTADO': c.emp.status,
                'PROYECTO': c.projectName,
                'CECO': c.ceco,
                'SUELDO BASE': c.sueldoBase,
            };

            uniqueColumns.fijos.forEach(col => row[col] = c.fijos[col] || 0);
            uniqueColumns.variables.forEach(col => row[col] = c.variables[col] || 0);
            uniqueColumns.beneficios.forEach(col => row[col] = c.beneficios[col] || 0);
            row['TOTAL HABERES'] = c.totalHaberes;
            
            uniqueColumns.descuentos.forEach(col => row[col] = c.descuentos[col] || 0);
            row['NETO PRELIMINAR (BRUTO)'] = c.totalBrutoPreliminar;

            return row;
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Consolidado_${period}`);
        XLSX.writeFile(wb, `Remu_Central_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const stats = {
        totalHaberes: consolidado.reduce((acc, c) => acc + c.totalHaberes, 0),
        activeCount: consolidado.filter(c => c.emp.status === 'Contratado').length,
    };

    return (
        <div className="min-h-full bg-slate-50/50 p-4 md:p-8 pb-32">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-200 -rotate-3 hover:rotate-0 transition-transform">
                        <Calculator size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">
                            Remu <span className="text-emerald-600">Central</span>
                        </h1>
                        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                            Matriz Pre-Nómina Dinámica · {consolidado.length} Resultados
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mr-2">
                        <Calendar size={16} className="text-slate-400 ml-2" />
                        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="bg-transparent text-sm font-black text-slate-700 focus:outline-none pr-2" />
                    </div>
                    <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-black text-[10px] uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                        <Download size={14} /> Exportar Data
                    </button>
                    <button onClick={fetchData} className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[2.5rem] p-6 mb-8 flex flex-wrap items-center gap-6 shadow-xl">
                <div className="flex-1 min-w-[300px] relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Nombre, RUT o Cargo..." 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                        {['Todos', 'Activo', 'Fis/Ret'].map(s => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <select 
                        className="pl-5 pr-10 py-4 bg-slate-100 border-none rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 focus:ring-4 focus:ring-indigo-50 appearance-none cursor-pointer"
                        value={filterCeco}
                        onChange={e => setFilterCeco(e.target.value)}
                    >
                        <option value="">TODOS LOS CECO</option>
                        {cecos.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Pivot Matrix Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl relative">
                {loading ? (
                    <div className="py-32 text-center">
                        <RefreshCw className="animate-spin mx-auto text-emerald-500 mb-4" size={40} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Matriz Dinámica...</p>
                    </div>
                ) : consolidado.length === 0 ? (
                    <div className="py-32 text-center">
                        <AlertCircle className="mx-auto text-slate-200 mb-4" size={60} />
                        <p className="text-slate-400 font-bold">No se encontraron registros de pre-nómina para {period}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-[2rem] custom-scrollbar">
                        <table className="w-full border-collapse text-left whitespace-nowrap min-w-max">
                            <thead>
                                {/* Super Headers */}
                                <tr className="bg-slate-900 border-b border-slate-800">
                                    <th colSpan="2" className="px-6 py-4 text-[10px] font-black text-slate-100 uppercase tracking-[0.2em] sticky left-0 bg-slate-900 z-20 border-r border-slate-800">Datos Base</th>
                                    
                                    {uniqueColumns.fijos.length > 0 && (
                                        <th colSpan={uniqueColumns.fijos.length} className="px-6 py-4 text-[10px] font-black text-emerald-300 uppercase tracking-[0.2em] text-center border-r border-slate-800 bg-emerald-950/50">Bonos Fijos</th>
                                    )}
                                    
                                    {uniqueColumns.variables.length > 0 && (
                                        <th colSpan={uniqueColumns.variables.length} className="px-6 py-4 text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] text-center border-r border-slate-800 bg-indigo-950/50">Bonos Variables</th>
                                    )}
                                    
                                    {uniqueColumns.beneficios.length > 0 && (
                                        <th colSpan={uniqueColumns.beneficios.length} className="px-6 py-4 text-[10px] font-black text-sky-300 uppercase tracking-[0.2em] text-center border-r border-slate-800 bg-sky-950/50">Beneficios Salariales</th>
                                    )}
                                    
                                    {uniqueColumns.descuentos.length > 0 && (
                                        <th colSpan={uniqueColumns.descuentos.length} className="px-6 py-4 text-[10px] font-black text-rose-300 uppercase tracking-[0.2em] text-center border-r border-slate-800 bg-rose-950/50">Descuentos & Otros</th>
                                    )}
                                    
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-100 uppercase tracking-[0.2em] text-center">Totales</th>
                                </tr>
                                {/* Dynamic Columns */}
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 border-r border-slate-200 w-[250px]">Colaborador</th>
                                    <th className="px-6 py-4 text-right text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Sueldo Base</th>
                                    
                                    {/* Fijos */}
                                    {uniqueColumns.fijos.map(col => (
                                        <th key={col} className="px-6 py-4 text-right text-[9px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50/50 border-r border-emerald-100">{col}</th>
                                    ))}
                                    
                                    {/* Variables */}
                                    {uniqueColumns.variables.map(col => (
                                        <th key={col} className="px-6 py-4 text-right text-[9px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/50 border-r border-indigo-100">{col}</th>
                                    ))}
                                    
                                    {/* Beneficios */}
                                    {uniqueColumns.beneficios.map(col => (
                                        <th key={col} className="px-6 py-4 text-right text-[9px] font-bold text-sky-700 uppercase tracking-wider bg-sky-50/50 border-r border-sky-100">{col}</th>
                                    ))}
                                    
                                    {/* Descuentos */}
                                    {uniqueColumns.descuentos.map(col => (
                                        <th key={col} className="px-6 py-4 text-right text-[9px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50/50 border-r border-rose-100">{col}</th>
                                    ))}
                                    
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-800 uppercase tracking-widest bg-slate-100">Neto Pre.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {consolidado.map(c => (
                                    <tr key={c.emp._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${c.emp.status === 'Contratado' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-600'}`}>
                                                    {c.emp.fullName?.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[150px]">{c.emp.fullName}</p>
                                                        {c.emp.status !== 'Contratado' && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[8px] rounded-full font-bold">BAJA</span>}
                                                    </div>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase truncate">{c.emp.position}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-slate-700 text-xs tabular-nums border-r border-slate-100">{fmt(c.sueldoBase)}</td>
                                        
                                        {/* Fijos */}
                                        {uniqueColumns.fijos.map(col => (
                                            <td key={col} className="px-6 py-4 text-right font-black text-emerald-700 text-xs tabular-nums bg-emerald-50/20 border-r border-emerald-50">
                                                {c.fijos[col] ? fmt(c.fijos[col]) : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                        ))}

                                        {/* Variables */}
                                        {uniqueColumns.variables.map(col => (
                                            <td key={col} className="px-6 py-4 text-right font-black text-indigo-700 text-xs tabular-nums bg-indigo-50/20 border-r border-indigo-50">
                                                {c.variables[col] ? fmt(c.variables[col]) : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                        ))}

                                        {/* Beneficios */}
                                        {uniqueColumns.beneficios.map(col => (
                                            <td key={col} className="px-6 py-4 text-right font-black text-sky-700 text-xs tabular-nums bg-sky-50/20 border-r border-sky-50">
                                                {c.beneficios[col] ? fmt(c.beneficios[col]) : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                        ))}

                                        {/* Descuentos */}
                                        {uniqueColumns.descuentos.map(col => (
                                            <td key={col} className="px-6 py-4 text-right font-black text-rose-700 text-xs tabular-nums bg-rose-50/20 border-r border-rose-50">
                                                {c.descuentos[col] ? `-${fmt(c.descuentos[col])}` : <span className="text-slate-300 font-normal">-</span>}
                                            </td>
                                        ))}

                                        <td className="px-6 py-4 text-right bg-slate-50 border-l border-slate-200">
                                            <span className="text-xs font-black text-slate-900 tabular-nums bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                                {fmt(c.totalBrutoPreliminar)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {/* Legend / Info Footer */}
            <div className="mt-8 flex items-center justify-between px-8 text-slate-400">
                <div className="text-[9px] font-black uppercase tracking-widest italic flex items-center gap-2">
                    <AlertCircle size={12} className="text-amber-500" /> Matriz Dinámica: Las columnas se autogeneran según los códigos LRE presentes en el periodo seleccionado.
                </div>
            </div>
        </div>
    );
};

export default RemuCentral;
