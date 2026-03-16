import React, { useState, useEffect } from 'react';
import API_URL from '../../config';

import { telecomApi as api } from './telecomApi';
import * as XLSX from 'xlsx';
import {
    Activity, Search, FileSpreadsheet,
    TrendingUp, TrendingDown,
    Clock, X, Calendar, User, Database, MapPin, Download, ChevronLeft, ChevronRight,
    Layers, Wrench
} from 'lucide-react';

const Produccion = () => {
    // --- ESTADOS ---
    const [dataRaw, setDataRaw] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({
        totalOrdenes: 0,
        porEstado: {},
        porAgencia: {},
        porTecnico: [],
        porActividad: [],
        porCategoria: {},
        porTipoTrabajo: {},
        mixTecnologico: {},
        diario: {}
    });
    const [, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [activeFilter, setActiveFilter] = useState('TODOS'); // TODOS | PROVISION | REPARACION
    const [busqueda, setBusqueda] = useState('');

    // --- INTERACTIVIDAD 2.0 ---
    const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-M-D'
    const [selectedTechnician, setSelectedTechnician] = useState(null); // string (nombre)

    // --- 1. CARGA DE DATOS ---
    const fetchData = async () => {
        try {
            setLoading(true);
            const resHistorial = await api.get('/produccion');
            const raw = resHistorial.data;
            setDataRaw(raw);
            setLastUpdate(new Date());
        } catch (error) {
            console.error("Error cargando datos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (dataRaw.length > 0) {
            let filteredData = dataRaw;
            // 1. Filter by Dashboard Mode (Provision/Reparacion)
            if (activeFilter !== 'TODOS') {
                filteredData = dataRaw.filter(d => {
                    const idPeticion = d["Número de Petición"] || d.ordenId || '';
                    const isRepair = idPeticion.toString().toUpperCase().startsWith('INC');
                    if (activeFilter === 'REPARACION') return isRepair;
                    if (activeFilter === 'PROVISION') return !isRepair;
                    return true;
                });
            }
            // 2. Filter by Status (Completed Only) - Handled inside procesarInteligencia but good to pre-filter
            // filteredData = filteredData.filter(d => d.Estado === 'Completado' || d.estado === 'Completado');

            procesarInteligencia(filteredData);
        }
    }, [dataRaw, activeFilter]);

    // --- 2. MOTOR DE INTELIGENCIA OPERATIVA (AVG + STRICT FILTER + GRANULAR) ---
    const procesarInteligencia = (datos) => {
        // 1. Strict Filter: Solo Completados
        const completados = datos.filter(d => (d.Estado === 'Completado' || d.estado === 'Completado'));

        const stats = {
            totalOrdenes: 0,
            provision: 0,
            reparacion: 0,
            rutina: 0,
            porEstado: {},
            porAgencia: {},
            porTecnico: {},
            porActividad: {},
            porCategoria: {},
            porTipoTrabajo: {},
            mixTecnologico: {},
            diario: {}
        };

        // Helper to update stats
        const updateStat = (obj, key, isRep, isRut) => {
            if (!obj[key]) obj[key] = { total: 0, provision: 0, reparacion: 0, rutina: 0 };
            const entry = obj[key];
            entry.total++;
            if (isRep) entry.reparacion++;
            else if (isRut) entry.rutina++;
            else entry.provision++;
        };

        // Auxiliary maps for averages
        const techDaysMap = {}; // { techName: Set(allDates) }
        const techProvDaysMap = {}; // { techName: Set(provDates) }
        const techRepDaysMap = {}; // { techName: Set(repDates) }
        const techRutDaysMap = {}; // { techName: Set(rutDates) }

        completados.forEach(d => {
            const idPeticion = d["Número de Petición"] || d.ordenId || '';
            const actividad = d.Actividad || d.actividad || 'GENERICA';

            // Detect Categories
            // isRepair: Starts with INC or Type contains 'Reclamo'
            const isRepair = (idPeticion.toString().toUpperCase().startsWith('INC')) ||
                (actividad.toString().toUpperCase().includes('RECLAMO'));

            // isRoutine: Actividad IS 'Rutina'
            const isRoutine = (actividad === 'Rutina');

            stats.totalOrdenes++;
            if (isRepair) stats.reparacion++;
            else if (isRoutine) stats.rutina = (stats.rutina || 0) + 1;
            else stats.provision++;

            const tipoTrabajo = isRepair ? 'Reparación' : (isRoutine ? 'Rutina' : 'Provisión');
            updateStat(stats.porTipoTrabajo, tipoTrabajo, isRepair, isRoutine);

            const estado = d.Estado || d.estado || 'SIN ESTADO';
            updateStat(stats.porEstado, estado, isRepair, isRoutine);

            const agencia = d.Agencia || d.agencia || 'SIN AGENCIA';
            updateStat(stats.porAgencia, agencia, isRepair, isRoutine);

            const tecnico = d.Recurso || d.nombreBruto || 'SIN ASIGNAR';
            updateStat(stats.porTecnico, tecnico, isRepair, isRoutine);

            // FIX TOP ACTIVIDADES
            if (actividad && actividad !== 'GENERICA') {
                updateStat(stats.porActividad, actividad, isRepair, isRoutine);
            }

            const cat = d["Categoría de Capacidad"] || d.categoria || 'SIN CATEGORIA';
            updateStat(stats.porCategoria, cat, isRepair, isRoutine);

            // Mix Tecnológico
            const hasVoice = !!d["Tecnologia Voz"];
            const hasBA = !!d["Tecnologia Banda Ancha"];
            const hasTV = !!d["Tecnologia TV"];
            let mix = '';
            if (hasVoice && hasBA && hasTV) mix = "TRIO";
            else if (hasVoice && hasBA) mix = "DUO TF+INT";
            else if (hasBA && hasTV) mix = "DUO INT+TV";
            else if (hasVoice) mix = "TELEFONIA";
            else if (hasBA) mix = "INTERNET";
            else if (hasTV) mix = "TV TOA";
            if (mix) updateStat(stats.mixTecnologico, mix, isRepair, isRoutine);

            // Diario & Averages Logic
            if (d.fecha) {
                const dateObj = new Date(d.fecha);
                const day = dateObj.getUTCDate();
                const month = dateObj.getUTCMonth();
                const year = dateObj.getUTCFullYear();
                const dateKey = `${year}-${month}-${day}`;

                if (!stats.diario[dateKey]) {
                    stats.diario[dateKey] = {
                        date: dateObj,
                        total: 0,
                        provision: 0,
                        reparacion: 0,
                        rutina: 0,
                        techs: new Set()
                    };
                }
                stats.diario[dateKey].total++;
                if (isRepair) stats.diario[dateKey].reparacion++;
                else if (isRoutine) stats.diario[dateKey].rutina++;
                else stats.diario[dateKey].provision++;

                stats.diario[dateKey].techs.add(tecnico);

                // Track active days per tech
                if (!techDaysMap[tecnico]) techDaysMap[tecnico] = new Set();
                techDaysMap[tecnico].add(dateKey);

                if (isRepair) {
                    if (!techRepDaysMap[tecnico]) techRepDaysMap[tecnico] = new Set();
                    techRepDaysMap[tecnico].add(dateKey);
                } else if (isRoutine) {
                    if (!techRutDaysMap[tecnico]) techRutDaysMap[tecnico] = new Set(); // Need to init map outside
                    techRutDaysMap[tecnico].add(dateKey);
                } else {
                    if (!techProvDaysMap[tecnico]) techProvDaysMap[tecnico] = new Set();
                    techProvDaysMap[tecnico].add(dateKey);
                }
            }
        });

        // Finalize Daily Averages
        Object.keys(stats.diario).forEach(k => {
            const dayStat = stats.diario[k];
            dayStat.activeTechs = dayStat.techs.size;
            dayStat.average = dayStat.activeTechs > 0 ? (dayStat.total / dayStat.activeTechs).toFixed(2) : 0;

            // Granular Daily Averages for Heatmap
            dayStat.avgProv = dayStat.activeTechs > 0 ? (dayStat.provision / dayStat.activeTechs).toFixed(2) : 0;
            dayStat.avgRep = dayStat.activeTechs > 0 ? (dayStat.reparacion / dayStat.activeTechs).toFixed(2) : 0;
            dayStat.avgRut = dayStat.activeTechs > 0 ? ((dayStat.rutina || 0) / dayStat.activeTechs).toFixed(2) : 0;
        });

        // Finalize Tech Rankings with GRANULAR Averages
        const rankedTechs = Object.entries(stats.porTecnico)
            .map(([name, counts]) => {
                const activeDays = techDaysMap[name] ? techDaysMap[name].size : 1; // Avoid div 0

                // Average Calculation (User Request #3)
                // Promedio Provision = Total Provision / Dias Activos Provision (o Dias Totales?) 
                // Usually "Daily Average" implies "Total / Active Days".
                // But if tech did 0 provision, avg is 0.

                const average = (counts.total / activeDays).toFixed(2);
                const avgProv = activeDays > 0 ? (counts.provision / activeDays).toFixed(2) : 0; // Using Total Active Days for consistent denominator? 
                // User said "Promedio Provision". If I worked 20 days, and did 100 provisions, my avg is 5.
                // If I used "activeProvDays", and I did 100 provisions in 1 day, avg is 100.
                // Standard is usually Total Active Days.

                const avgRep = activeDays > 0 ? (counts.reparacion / activeDays).toFixed(2) : 0;
                const avgRut = activeDays > 0 ? ((counts.rutina || 0) / activeDays).toFixed(2) : 0;

                // "Promedio Reparacion + Rutina"
                const avgRepRut = activeDays > 0 ? ((counts.reparacion + (counts.rutina || 0)) / activeDays).toFixed(2) : 0;

                // Efficiency: Total / Active Days (already 'average')
                // Or maybe points based? 1 pt prov, X pt rep? 
                // User just wrote "Efficiency". I will use 'average' as efficiency metric for now.

                return {
                    name,
                    ...counts,
                    activeDays,
                    average,
                    avgProv,
                    avgRep,
                    avgRut,
                    avgRepRut
                };
            })
            .sort((a, b) => b.total - a.total);

        stats.porTecnico = rankedTechs;

        const toRanking = (obj) => Object.entries(obj)
            .map(([name, counts]) => ({ name, ...counts }))
            .sort((a, b) => b.total - a.total);
        stats.porActividad = toRanking(stats.porActividad);

        setDashboardStats(stats);
    };

    // --- HELPERS PARA INTERACTIVIDAD ---
    const getDayDetails = (dateKey) => {
        if (!dateKey) return null;
        const [y, m, d] = dateKey.split('-').map(Number);

        // Filter raw data for this specific UTC date
        const dayData = dataRaw.filter(row => {
            if (!row.fecha) return false;
            const rowDate = new Date(row.fecha);
            return rowDate.getUTCFullYear() === y &&
                rowDate.getUTCMonth() === m &&
                rowDate.getUTCDate() === d &&
                (row.Estado === 'Completado' || row.estado === 'Completado');
        });

        // Compute rankings for this day
        const techMap = {};
        const actMap = {};

        dayData.forEach(row => {
            const idPeticion = row["Número de Petición"] || row.ordenId || '';
            const actividad = row.Actividad || row.actividad || 'GENERICA';

            const isRepair = (idPeticion.toString().toUpperCase().startsWith('INC')) ||
                (actividad.toString().toUpperCase().includes('RECLAMO'));
            const isRoutine = (actividad === 'Rutina');

            const tech = row.Recurso || row.nombreBruto || 'SIN ASIGNAR';

            // Update Tech Map
            if (!techMap[tech]) techMap[tech] = { total: 0, provision: 0, reparacion: 0, rutina: 0 };
            techMap[tech].total++;
            if (isRepair) techMap[tech].reparacion++;
            else if (isRoutine) techMap[tech].rutina++;
            else techMap[tech].provision++;

            // Update Activity Map
            if (!actMap[actividad]) actMap[actividad] = { total: 0, provision: 0, reparacion: 0, rutina: 0 };
            actMap[actividad].total++;
            if (isRepair) actMap[actividad].reparacion++;
            else if (isRoutine) actMap[actividad].rutina++;
            else actMap[actividad].provision++;
        });

        const toRanking = (obj) => Object.entries(obj)
            .map(([name, counts]) => ({
                name,
                ...counts,
                average: counts.total,      // En vista diaria, promedio = total (1 día)
                avgProv: counts.provision,
                avgRep: counts.reparacion,
                avgRut: counts.rutina,
                avgRepRut: counts.reparacion + (counts.rutina || 0),
                efficiency: (counts.total >= 4) ? '🔥' : ((counts.total >= 2) ? '✅' : '⚠️')
            }))
            .sort((a, b) => b.total - a.total);

        return {
            total: dayData.length,
            technicians: toRanking(techMap),
            activities: toRanking(actMap)
        };
    };

    const getTechnicianDetails = (techName) => {
        if (!techName) return null;
        // Strict Filter Applied
        const techData = dataRaw.filter(row =>
            (row.Recurso === techName || row.nombreBruto === techName) &&
            (row.Estado === 'Completado' || row.estado === 'Completado')
        );

        const actMap = {};
        const stateMap = {};
        const dailyEvolution = {}; // { dateKey: { total, provision, reparacion, rutina } }

        techData.forEach(row => {
            const idPeticion = row["Número de Petición"] || row.ordenId || '';
            const actividad = row.Actividad || row.actividad || 'GENERICA';

            const isRepair = (idPeticion.toString().toUpperCase().startsWith('INC')) ||
                (actividad.toString().toUpperCase().includes('RECLAMO'));
            const isRoutine = (actividad === 'Rutina');

            // Activity Map
            if (!actMap[actividad]) actMap[actividad] = { total: 0, provision: 0, reparacion: 0, rutina: 0 };
            actMap[actividad].total++;
            if (isRepair) actMap[actividad].reparacion++;
            else if (isRoutine) actMap[actividad].rutina++;
            else actMap[actividad].provision++;

            // State Map
            const st = row.Estado || row.estado || 'SIN ESTADO';
            if (!stateMap[st]) stateMap[st] = { total: 0, provision: 0, reparacion: 0 };
            stateMap[st].total++;
            if (isRepair) stateMap[st].reparacion++; else stateMap[st].provision++;

            // Evolution by Day
            if (row.fecha) {
                const dObj = new Date(row.fecha);
                const k = `${dObj.getUTCFullYear()}-${dObj.getUTCMonth()}-${dObj.getUTCDate()}`;
                if (!dailyEvolution[k]) dailyEvolution[k] = { date: row.fecha, total: 0, provision: 0, reparacion: 0, rutina: 0 };
                dailyEvolution[k].total++;
                if (isRepair) dailyEvolution[k].reparacion++;
                else if (isRoutine) dailyEvolution[k].rutina++;
                else dailyEvolution[k].provision++;
            }
        });

        const toRanking = (obj) => Object.entries(obj)
            .map(([name, counts]) => ({ name, ...counts }))
            .sort((a, b) => b.total - a.total);

        // Sort evolution by date
        const evolutionSorted = Object.entries(dailyEvolution)
            .map(([k, v]) => ({ key: k, ...v }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate specific stats
        const provTotal = techData.filter(d => {
            const idPeticion = d["Número de Petición"] || d.ordenId || '';
            const actividad = d.Actividad || d.actividad || 'GENERICA';
            const isRepair = (idPeticion.toString().toUpperCase().startsWith('INC')) || (actividad.toString().toUpperCase().includes('RECLAMO'));
            const isRoutine = (actividad === 'Rutina');
            return !isRepair && !isRoutine;
        }).length;

        const repTotal = techData.filter(d => {
            const idPeticion = d["Número de Petición"] || d.ordenId || '';
            const actividad = d.Actividad || d.actividad || 'GENERICA';
            return (idPeticion.toString().toUpperCase().startsWith('INC')) || (actividad.toString().toUpperCase().includes('RECLAMO'));
        }).length;

        const rutTotal = techData.filter(d => (d.Actividad === 'Rutina' || d.actividad === 'Rutina')).length;

        const activeDaysTotal = evolutionSorted.length;
        const activeDaysProv = evolutionSorted.filter(d => d.provision > 0).length;
        const activeDaysRep = evolutionSorted.filter(d => d.reparacion > 0).length;
        const activeDaysRut = evolutionSorted.filter(d => d.rutina > 0).length;

        return {
            total: techData.length,
            activities: toRanking(actMap),
            states: toRanking(stateMap),
            evolution: evolutionSorted,
            provTotal,
            repTotal,
            rutTotal,
            activeDaysTotal,
            activeDaysProv,
            activeDaysRep,
            activeDaysRut,
            avgTotal: activeDaysTotal > 0 ? (techData.length / activeDaysTotal).toFixed(2) : 0,
            avgProv: activeDaysProv > 0 ? (provTotal / activeDaysProv).toFixed(2) : 0,
            avgRep: activeDaysRep > 0 ? (repTotal / activeDaysRep).toFixed(2) : 0,
            avgRut: activeDaysRut > 0 ? (rutTotal / activeDaysRut).toFixed(2) : 0,
            avgRepRut: activeDaysTotal > 0 ? ((repTotal + rutTotal) / activeDaysTotal).toFixed(2) : 0
        };
    };


    // --- 3. EXPORTAR ---
    const dynamicKeys = React.useMemo(() => {
        if (!dataRaw || dataRaw.length === 0) return [];
        const allKeys = new Set();
        dataRaw.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
        const ignored = ['_id', '__v', 'tecnicoId', 'createdAt', 'updatedAt', 'nombre', 'actividad', 'ordenId', 'fecha', 'puntos', 'latitud', 'longitud', 'clienteAsociado', 'ingreso', 'origen', 'nombreBruto', 'datosRaw', 'categoriaRendimiento', 'meta', 'proyeccion', 'cumplimiento'];
        const preferredOrder = ["Actividad", "Recurso", "Ventana de servicio", "Ventana de Llegada", "Número de Petición", "Numero orden", "Send day before confirmation alert", "Direccion Polar X", "Direccion Polar Y", "Puntos", "Número", "Departamento/Block/Casa", "Agencia", "Comuna", "Direccion", "Intervalo de tiempo", "Ciudad", "Nombre", "RUT del cliente", "Telefono", "Telefono Contacto 1", "Telefono Contacto 2", "Telefono Contacto 3", "Telefono Contacto 4", "Correo electronico", "Subtipo de Actividad", "Tipo Trabajo", "Tiempo de Viaje", "Duración de la actividad", "Estado", "Habilidad", "Zona Trabajo", "Planta de asignacion", "Armario", "OLT", "Fecha de Emisión/Reclamo", "Fecha", "SLA Inicio", "SLA Fin", "Codigo TICA", "Segmento del cliente", "Categoría de Capacidad", "Tecnologia Voz", "Tecnologia Banda Ancha", "Tecnologia TV", "Tipo de Acceso", "Pre-trabajo", "Usuario", "CCN"];
        return Array.from(allKeys).filter(k => !ignored.includes(k)).sort((a, b) => {
            const idxA = preferredOrder.indexOf(a);
            const idxB = preferredOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [dataRaw]);

    const handleDownload = () => {
        if (!dataRaw || dataRaw.length === 0) return;
        const dataToExport = dataRaw.map(row => {
            const cleanRow = {};
            cleanRow["Fecha Extracción"] = new Date(row.fecha).toLocaleDateString("es-CL", { timeZone: "UTC" });
            dynamicKeys.forEach(key => cleanRow[key] = row[key] || '');
            return cleanRow;
        });
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Produccion_TOA_Raw");
        XLSX.writeFile(wb, `Produccion_TOA_Strict_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // --- COMPONENTES UI MEJORADOS (GLASSMORPHISM + INTERACTIVIDAD) ---

    // 1. StatCard (Enhanced with Breakdown)
    const StatCard = ({ title, value, icon: Icon, color, subtext, breakdown }) => (
        <div className={`relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-${color}-500/10 hover:shadow-${color}-500/20 transition-all group flex-1 min-w-[280px]`}>
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-125 transition-all text-${color}-600`}>
                <Icon size={80} />
            </div>
            <div className="relative z-10">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${color}-50 text-${color}-600 text-[10px] font-black uppercase tracking-widest mb-2`}>
                    <Icon size={12} /> {title}
                </div>
                <div className="text-5xl font-black text-slate-800 tracking-tight mt-2 mb-1">
                    {value.toLocaleString()}
                </div>
                {subtext && <div className="text-xs font-bold text-slate-400 pl-1 mb-3">{subtext}</div>}

                {breakdown && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                        <div className="flex-1 bg-blue-50/50 rounded-lg p-1 flex flex-col items-center">
                            <span className="text-[8px] font-black text-blue-400 uppercase">Prov</span>
                            <span className="text-[10px] font-bold text-blue-700">{breakdown.provision}</span>
                        </div>
                        <div className="flex-1 bg-orange-50/50 rounded-lg p-1 flex flex-col items-center">
                            <span className="text-[8px] font-black text-orange-400 uppercase">Rep</span>
                            <span className="text-[10px] font-bold text-orange-700">{breakdown.reparacion}</span>
                        </div>
                        <div className="flex-1 bg-purple-50/50 rounded-lg p-1 flex flex-col items-center">
                            <span className="text-[8px] font-black text-purple-400 uppercase">Rut</span>
                            <span className="text-[10px] font-bold text-purple-700">{breakdown.rutina || 0}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );


    // 2. Distribution Card (Clickeable? No pedido, pero % sí)
    const DistributionCard = ({ title, data, icon: Icon, color, onClickItem }) => {
        let items = [];
        if (Array.isArray(data)) items = data;
        else items = Object.entries(data).map(([label, values]) => ({ name: label, ...values })).sort((a, b) => b.total - a.total);

        const totalGlobal = items.reduce((acc, curr) => acc + curr.total, 0);
        const topItems = items.slice(0, 6);

        return (
            <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-3xl shadow-lg flex flex-col flex-1 min-h-[380px] overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <div className={`px-6 py-4 border-b border-slate-100/50 bg-gradient-to-r from-white to-${color}-50/30 flex justify-between items-center`}>
                    <span className={`text-${color}-600 font-black text-xs uppercase tracking-widest flex items-center gap-2`}>
                        <Icon size={16} /> {title}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-bold shadow-sm border border-slate-200">
                        {totalGlobal} Total
                    </span>
                </div>
                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                    {topItems.map((item, idx) => {
                        const percent = totalGlobal > 0 ? Math.round((item.total / totalGlobal) * 100) : 0;
                        return (
                            <div key={item.name} className="group cursor-default" onClick={() => onClickItem && onClickItem(item)}>
                                <div className="flex justify-between items-end mb-1.5">
                                    <span className="font-bold text-slate-700 text-xs truncate max-w-[180px]" title={item.name}>{item.name}</span>
                                    <div className="text-right">
                                        <span className="font-black text-slate-800 text-sm">{item.total}</span>
                                        <span className="text-[10px] text-slate-400 font-bold ml-1">({percent}%)</span>
                                    </div>
                                </div>
                                <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-slate-100 shadow-inner ring-1 ring-slate-200">
                                    <div className="h-full bg-blue-500 relative group-hover:brightness-110 transition-all" style={{ width: `${(item.provision / item.total) * 100}%` }} title={`Prov: ${item.provision}`}></div>
                                    <div className="h-full bg-orange-500 relative group-hover:brightness-110 transition-all" style={{ width: `${(item.reparacion / item.total) * 100}%` }} title={`Rep: ${item.reparacion}`}></div>
                                </div>
                                <div className="flex justify-between text-[9px] text-slate-400 mt-1 px-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                    <span className="text-blue-500 font-bold">P: {item.provision}</span>
                                    <span className="text-orange-500 font-bold">R: {item.reparacion}</span>
                                </div>
                            </div>
                        );
                    })}
                    {topItems.length === 0 && <div className="text-center text-slate-300 text-sm py-10 italic">Sin datos</div>}
                </div>
            </div>
        );
    };

    // 3. Ranking Card (Enhanced with Details)
    const RankingCard = ({ title, data, icon: Icon, color, onItemClick }) => {
        let items = [];
        if (Array.isArray(data)) items = data;
        else items = Object.entries(data).map(([label, values]) => ({ name: label, ...values })).sort((a, b) => b.total - a.total);

        // Check if Tech View based on title or specific props
        // Treating 'actividad' also as detailed view to show Totals columns instead of Averages (which are 0)
        const isTechView = title.toLowerCase().includes('técnico') ||
            title.toLowerCase().includes('actividad') ||
            (items.length > 0 && (items[0].efficiency !== undefined || items[0].avgRepRut !== undefined));

        return (
            <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-3xl shadow-2xl flex flex-col flex-1 min-h-[500px] overflow-hidden hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1">
                <div className={`px-6 py-5 border-b border-white/20 bg-gradient-to-r from-${color}-50/80 to-transparent flex justify-between items-center`}>
                    <span className={`text-${color}-800 font-extrabold text-sm uppercase tracking-widest flex items-center gap-2`}>
                        <div className={`p-2 bg-${color}-100 rounded-lg shadow-inner`}>
                            <Icon size={18} />
                        </div>
                        {title}
                    </span>
                    <span className="text-[10px] bg-white/80 backdrop-blur text-slate-500 px-3 py-1 rounded-full font-bold border border-white/50 shadow-sm">
                        Top {items.length}
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/30 p-2">
                    <table className="w-full text-left text-xs border-separate border-spacing-y-1">
                        <thead className="text-slate-400 font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-2 text-center">#</th>
                                <th className="px-3 py-2">Nombre</th>
                                {isTechView ? (
                                    <>
                                        <th className="px-2 text-center text-blue-600">Tot Prov</th>
                                        <th className="px-2 text-center text-orange-600">Tot Rep</th>
                                        <th className="px-2 text-center text-purple-600">Tot Rut</th>
                                        <th className="px-2 text-center text-blue-400">Prom Prov</th>
                                        <th className="px-2 text-center text-orange-400">Prom Rep+Rut</th>
                                        <th className="px-3 text-center">Eficiencia</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-3 text-center">Prom Total</th>
                                        <th className="px-3 text-center text-blue-500">Prom Prov</th>
                                        <th className="px-3 text-center text-orange-500">Prom Rep</th>
                                        <th className="px-3 text-center">Status</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => {
                                const rank = idx + 1;
                                let medalBase = "bg-slate-100 text-slate-500";
                                if (rank === 1) medalBase = "bg-yellow-300 text-yellow-900 shadow-yellow-200 shadow-md";
                                if (rank === 2) medalBase = "bg-slate-300 text-slate-800 shadow-slate-300 shadow-md";
                                if (rank === 3) medalBase = "bg-orange-300 text-orange-900 shadow-orange-200 shadow-md";

                                // Metrics
                                const avg = parseFloat(item.average || 0);
                                const avgProv = parseFloat(item.avgProv || 0);
                                const avgRep = parseFloat(item.avgRep || 0);
                                const avgRepRut = parseFloat(item.avgRepRut || 0);
                                const isGood = avg >= 2;

                                return (
                                    <tr
                                        key={idx}
                                        onClick={() => onItemClick && onItemClick(item.name)}
                                        className={`group cursor-pointer transition-all hover:scale-[1.01]`}
                                    >
                                        <td className={`px-2 py-3 text-center rounded-l-xl bg-white/60 group-hover:bg-white border-y border-l border-white/40 group-hover:border-${color}-200`}>
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${medalBase}`}>
                                                {rank}
                                            </span>
                                        </td>
                                        <td className={`px-3 py-3 font-bold text-slate-700 bg-white/60 group-hover:bg-white border-y border-white/40 group-hover:border-${color}-200 truncate max-w-[140px]`} title={item.name}>
                                            {item.name}
                                        </td>

                                        {isTechView ? (
                                            <>
                                                {/* Totals */}
                                                <td className="px-2 py-3 text-center bg-blue-50/50 group-hover:bg-blue-50 border-y border-white/40 font-bold text-blue-700">
                                                    {item.provision || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-orange-50/50 group-hover:bg-orange-50 border-y border-white/40 font-bold text-orange-700">
                                                    {item.reparacion || 0}
                                                </td>
                                                <td className="px-2 py-3 text-center bg-purple-50/50 group-hover:bg-purple-50 border-y border-white/40 font-bold text-purple-700">
                                                    {item.rutina || 0}
                                                </td>

                                                {/* Averages */}
                                                <td className="px-2 py-3 text-center bg-white/60 group-hover:bg-white border-y border-white/40">
                                                    <span className="text-xs font-bold text-slate-600">{avgProv}</span>
                                                </td>
                                                <td className="px-2 py-3 text-center bg-white/60 group-hover:bg-white border-y border-white/40">
                                                    <span className="text-xs font-bold text-slate-600">{avgRepRut}</span>
                                                </td>

                                                {/* Efficiency */}
                                                <td className={`px-2 py-3 text-center rounded-r-xl bg-white/60 group-hover:bg-white border-y border-r border-white/40 group-hover:border-${color}-200`}>
                                                    <span className="text-base">{item.efficiency || (isGood ? '✅' : '⚠️')}</span>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                {/* Standard View */}
                                                <td className={`px-3 py-3 text-center bg-white/60 group-hover:bg-white border-y border-white/40 group-hover:border-${color}-200`}>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-sm font-black text-slate-800">{avg}</span>
                                                        <span className="text-[9px] text-slate-400">Total: {item.total}</span>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3 text-center bg-blue-50/50 group-hover:bg-blue-50 border-y border-white/40">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs font-bold text-blue-700">{avgProv}</span>
                                                        <div className="w-12 h-1 bg-blue-200 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${Math.min(avgProv * 20, 100)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-3 text-center bg-orange-50/50 group-hover:bg-orange-50 border-y border-white/40">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-xs font-bold text-orange-700">{avgRep}</span>
                                                        <div className="w-12 h-1 bg-orange-200 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-orange-500" style={{ width: `${Math.min(avgRep * 20, 100)}%` }}></div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className={`px-2 py-3 text-center rounded-r-xl bg-white/60 group-hover:bg-white border-y border-r border-white/40 group-hover:border-${color}-200`}>
                                                    <span className={`text-lg ${isGood ? 'grayscale-0' : 'grayscale opacity-50'}`}>
                                                        {isGood ? '👍' : '👎'}
                                                    </span>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // 4. Calendar HeatMap (Market-Leading Gradient + Granular Badges)
    const CalendarHeatMap = () => {
        const [currentDate, setCurrentDate] = useState(new Date());
        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

        const generateWeeks = () => {
            const weeks = [];
            let currentWeek = [];
            for (let i = 0; i < startDay; i++) currentWeek.push(null);
            for (let i = 1; i <= totalDays; i++) {
                currentWeek.push(i);
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }
            return weeks;
        };

        const getWeekStats = (weekDays) => {
            let total = 0, prov = 0, rep = 0, rut = 0;
            weekDays.forEach(day => {
                if (!day) return;
                const key = `${year}-${month}-${day}`;
                const stat = dashboardStats.diario[key];
                if (stat) {
                    total += stat.total;
                    prov += stat.provision;
                    rep += stat.reparacion;
                    rut += (stat.rutina || 0);
                }
            });
            return { total, prov, rep, rut };
        };

        const getColorStyles = (stats, isSelected) => {
            if (isSelected) return "bg-slate-800 text-white shadow-2xl scale-105 z-20 ring-4 ring-blue-500/50";
            if (!stats) return "bg-white/40 border-slate-100 hover:bg-white hover:shadow-lg";
            // Simple color scale based on total activity
            if (stats.total >= 40) return "bg-emerald-50 border-emerald-200/60 hover:shadow-emerald-500/20";
            if (stats.total >= 20) return "bg-blue-50 border-blue-200/60 hover:shadow-blue-500/20";
            return "bg-slate-50 border-slate-200 hover:shadow-md";
        };

        const weeks = generateWeeks();

        return (
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-2xl flex flex-col w-full overflow-hidden mb-8 transition-all hover:shadow-3xl">
                <div className="flex justify-between items-center p-6 border-b border-white/40 bg-gradient-to-r from-white via-slate-50/50 to-white">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-white rounded-2xl shadow-xl shadow-slate-200/50 text-blue-600">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h3 className="text-slate-800 font-black text-xl tracking-tight">Mapa de Productividad</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Evolución Diaria & Semanal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-2xl p-1 shadow-inner border border-slate-100">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-blue-600"><ChevronLeft size={18} /></button>
                        <span className="text-xs font-black text-slate-700 w-32 text-center uppercase tracking-widest">{monthNames[month]} {year}</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-blue-600"><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-b from-transparent to-slate-50/30 overflow-x-auto">
                    {/* Header Row */}
                    <div className="grid grid-cols-8 gap-3 mb-3 min-w-[1000px]">
                        {dayNames.map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{d}</div>)}
                        <div className="text-center text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">RESUMEN SEMANA</div>
                    </div>

                    {/* Weeks */}
                    <div className="space-y-4 min-w-[1000px]">
                        {weeks.map((week, wIdx) => {
                            const wStats = getWeekStats(week);
                            return (
                                <div key={wIdx} className="grid grid-cols-8 gap-4">
                                    {week.map((day, dIdx) => {
                                        const key = `${year}-${month}-${day}`;
                                        const stat = dashboardStats.diario[key];
                                        const isSelected = selectedDate === key;

                                        return (
                                            <div
                                                key={dIdx}
                                                onClick={() => day && setSelectedDate(selectedDate === key ? null : key)}
                                                className={`relative min-h-[80px] p-1.5 flex flex-col justify-between rounded-2xl border transition-all duration-300 cursor-pointer group ${day ? getColorStyles(stat, isSelected) : 'invisible'}`}
                                            >
                                                {day && (
                                                    <>
                                                        <div className="flex justify-between items-start">
                                                            <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'}`}>{day}</span>
                                                        </div>

                                                        {stat ? (
                                                            <div className="flex flex-col gap-2 mt-1">
                                                                {/* BIG NUMBER TOTAL */}
                                                                <div className="text-center">
                                                                    <span className={`text-xl font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>{stat.total}</span>
                                                                    <p className={`text-[8px] uppercase tracking-widest font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>Actividades</p>
                                                                </div>

                                                                {/* PLACEHOLDER BAREMOS */}
                                                                <div className={`text-center py-0.5 rounded ${isSelected ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                                    <span className={`text-[9px] font-bold uppercase ${isSelected ? 'text-white/60' : 'text-slate-400'}`}>Pts: --</span>
                                                                </div>

                                                                {/* Granular Breakdown */}
                                                                <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100/50">
                                                                    <div className="text-center">
                                                                        <span className={`block text-[6px] font-bold uppercase ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>Prov</span>
                                                                        <span className={`block text-xs font-black ${isSelected ? 'text-white' : 'text-blue-600'}`}>{stat.provision}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className={`block text-[6px] font-bold uppercase ${isSelected ? 'text-orange-200' : 'text-orange-400'}`}>Rep</span>
                                                                        <span className={`block text-xs font-black ${isSelected ? 'text-white' : 'text-orange-600'}`}>{stat.reparacion}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className={`block text-[6px] font-bold uppercase ${isSelected ? 'text-purple-200' : 'text-purple-400'}`}>Rut</span>
                                                                        <span className={`block text-xs font-black ${isSelected ? 'text-white' : 'text-purple-600'}`}>{stat.rutina || 0}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex-1 flex items-center justify-center">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* WEEK SUMMARY CELL */}
                                    <div className="relative min-h-[80px] p-2 flex flex-col justify-center rounded-2xl bg-slate-800 text-white shadow-xl ring-1 ring-white/20">
                                        <div className="absolute top-2 right-2 opacity-10"><Calendar size={40} /></div>
                                        <div className="relative z-10 text-center space-y-3">
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Semana</span>
                                                <div className="text-2xl font-black text-white">{wStats.total}</div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                                                <div className="bg-white/10 p-1 rounded">
                                                    <div className="text-blue-300">P</div>
                                                    <div>{wStats.prov}</div>
                                                </div>
                                                <div className="bg-white/10 p-1 rounded">
                                                    <div className="text-orange-300">R</div>
                                                    <div>{wStats.rep}</div>
                                                </div>
                                                <div className="bg-white/10 p-1 rounded">
                                                    <div className="text-purple-300">Rut</div>
                                                    <div>{wStats.rut}</div>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-1 rounded text-center">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Pts Baremos</span>
                                                <div className="text-xs font-black text-amber-400">--</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MONTHLY FOOTER */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-t border-slate-700">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Resumen Mensual</span>
                    <div className="flex gap-8">
                        <div className="text-right">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Actividades</span>
                            <span className="text-2xl font-black text-white">
                                {weeks.reduce((acc, week) => acc + getWeekStats(week).total, 0)}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Total Puntos Baremos</span>
                            <span className="text-2xl font-black text-amber-400">--</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 5. Tech Operation HeatMap (Active Techs per Day) - COMPACT & COMPLETE
    const TechOperationHeatmap = () => {
        const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const totalDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

        const generateWeeks = () => {
            const weeks = [];
            let currentWeek = [];
            for (let i = 0; i < startDay; i++) currentWeek.push(null);
            for (let i = 1; i <= totalDays; i++) {
                currentWeek.push(i);
                if (currentWeek.length === 7) {
                    weeks.push(currentWeek);
                    currentWeek = [];
                }
            }
            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) currentWeek.push(null);
                weeks.push(currentWeek);
            }
            return weeks;
        };

        const getTechColor = (count) => {
            if (!count) return "bg-slate-50 border-slate-100 text-slate-300";
            if (count >= 15) return "bg-emerald-100 border-emerald-300 text-emerald-700 shadow-sm";
            if (count >= 8) return "bg-amber-100 border-amber-300 text-amber-700 shadow-sm";
            return "bg-rose-100 border-rose-300 text-rose-700 shadow-sm";
        };

        const getWeekAvg = (week) => {
            let sum = 0;
            let count = 0;
            week.forEach(day => {
                if (!day) return;
                const key = `${year}-${month}-${day}`;
                const stat = dashboardStats.diario[key];
                if (stat && stat.activeTechs > 0) {
                    sum += stat.activeTechs;
                    count++;
                }
            });
            return count > 0 ? Math.round(sum / count) : 0;
        };

        const weeks = generateWeeks();

        return (
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[32px] shadow-2xl flex flex-col w-full overflow-hidden mb-8 transition-all hover:shadow-3xl">
                <div className="flex justify-between items-center p-4 border-b border-white/40 bg-gradient-to-r from-white via-slate-50/50 to-white">
                    <div className="flex items-center gap-6">
                        <div className="p-3 bg-white rounded-2xl shadow-xl shadow-slate-200/50 text-indigo-600">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="text-slate-800 font-black text-xl tracking-tight">Dotación Operativa</h3>
                            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Técnicos Activos por Día</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-2xl p-1 shadow-inner border border-slate-100">
                        <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-indigo-600"><ChevronLeft size={18} /></button>
                        <span className="text-xs font-black text-slate-700 w-32 text-center uppercase tracking-widest">{monthNames[month]} {year}</span>
                        <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400 hover:text-indigo-600"><ChevronRight size={18} /></button>
                    </div>
                </div>

                <div className="p-4 bg-gradient-to-b from-transparent to-slate-50/30 overflow-x-auto">
                    <div className="grid grid-cols-8 gap-2 mb-2 min-w-[800px]">
                        {dayNames.map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{d}</div>)}
                        <div className="text-center text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">PROM SEMANA</div>
                    </div>

                    <div className="space-y-2 min-w-[800px]">
                        {weeks.map((week, wIdx) => {
                            const weekAvg = getWeekAvg(week);
                            return (
                                <div key={wIdx} className="grid grid-cols-8 gap-2">
                                    {week.map((day, dIdx) => {
                                        const key = `${year}-${month}-${day}`;
                                        const stat = dashboardStats.diario[key];
                                        const count = stat ? stat.activeTechs : 0;

                                        return (
                                            <div key={dIdx} className={`relative min-h-[60px] p-1 flex flex-col items-center justify-center rounded-xl border transition-all duration-300 ${day ? getTechColor(count) : 'invisible'}`}>
                                                {day && (
                                                    <>
                                                        <span className="absolute top-1 left-2 text-[8px] font-bold opacity-40">{day}</span>
                                                        {count > 0 ? (
                                                            <div className="text-center mt-1">
                                                                <span className="text-xl font-black tracking-tight">{count}</span>
                                                                <p className="text-[6px] uppercase font-bold opacity-70">Tecs</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300">-</span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {/* COLUMN 8: Weekly Avg */}
                                    <div className="relative min-h-[60px] p-1 flex flex-col justify-center rounded-xl bg-slate-800 text-white shadow-lg ring-1 ring-white/10">
                                        <div className="text-center">
                                            <div className="text-xl font-black text-white">{weekAvg}</div>
                                            <span className="text-[6px] font-bold text-indigo-200 uppercase tracking-widest">Prom</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* MONTHLY FOOTER */}
                <div className="px-6 py-3 bg-slate-900 text-white flex justify-between items-center border-t border-slate-700">
                    <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Resumen Dotación Mensual</span>
                    <div className="flex gap-6">
                        <div className="text-right flex items-center gap-3">
                            <span className="block text-[9px] font-bold text-slate-500 uppercase">Promedio Mensual</span>
                            <span className="text-xl font-black text-emerald-400 bg-emerald-400/10 px-3 py-0.5 rounded-lg border border-emerald-400/20">
                                {monthlyStats.monthlyAvgTechs} <span className="text-[10px] text-emerald-600 ml-1">Tecs/Día</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- RENDERIZADO PRINCIPAL ---



    // --- STATE MANAGEMENT ---
    const [currentDate, setCurrentDate] = useState(new Date()); // Global Month State

    // Helper: Get Month/Year
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // --- MONTHLY STATS CALCULATION ---
    const calculateMonthlyStats = () => {
        let totalOrdenes = 0;
        let totalProv = 0;
        let totalRep = 0;
        let totalRut = 0;
        let daysWithActivity = new Set();
        let totalTechs = new Set();
        let activeTechsSum = 0;
        let validDaysCount = 0;

        // Iterate all daily stats
        Object.values(dashboardStats.diario || {}).forEach(dayStat => {
            const d = new Date(dayStat.date); // Ensure date object
            if (d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth) {
                totalOrdenes += dayStat.total;
                totalProv += dayStat.provision;
                totalRep += dayStat.reparacion;
                totalRut += (dayStat.rutina || 0);
                daysWithActivity.add(dayStat.date.toISOString().split('T')[0]);

                dayStat.techs.forEach(t => totalTechs.add(t));

                if (dayStat.activeTechs > 0) {
                    activeTechsSum += dayStat.activeTechs;
                    validDaysCount++;
                }
            }
        });

        const operatingDays = daysWithActivity.size;
        const dailyAvg = operatingDays > 0 ? Math.round(totalOrdenes / operatingDays) : 0;
        const avgProv = operatingDays > 0 ? Math.round(totalProv / operatingDays) : 0;
        const avgRep = operatingDays > 0 ? Math.round(totalRep / operatingDays) : 0;
        const avgRut = operatingDays > 0 ? Math.round(totalRut / operatingDays) : 0;

        // Baremos Placeholder (Total = Ordenes * AvgPoints? Or just sum if we had points)
        // For now, let's assume 1 order = 1 point roughly, or just 0 if strict.
        const totalBaremos = 0;

        // Tech Ops
        const monthlyAvgTechs = validDaysCount > 0 ? Math.round(activeTechsSum / validDaysCount) : 0;

        return {
            totalOrdenes,
            totalProv,
            totalRep,
            totalRut,
            operatingDays,
            dailyAvg,
            avgProv,
            avgRep,
            avgRut,
            totalBaremos,
            monthlyAvgTechs
        };
    };

    const monthlyStats = calculateMonthlyStats();

    // --- RENDERIZADO PRINCIPAL ---

    // Calcular Datos para Paneles
    const dayDetails = selectedDate ? getDayDetails(selectedDate) : null;
    const techDetails = selectedTechnician ? getTechnicianDetails(selectedTechnician) : null;

    return (
        <div className="animate-in fade-in duration-700 max-w-[1920px] mx-auto pb-20 px-4 md:px-8 pt-6 bg-slate-50/50 min-h-screen font-sans">

            {/* HEADER PRO */}
            <div className="flex flex-col xl:flex-row justify-between items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black italic text-slate-800 flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/30">
                            <Activity size={32} />
                        </div>
                        <span>Central <span className="text-blue-600">Operativa</span></span>
                    </h1>
                    <div className="flex items-center gap-4 mt-3 ml-2">
                        <span className="text-xs font-bold bg-white text-slate-500 px-3 py-1.5 rounded-lg flex items-center gap-2 border border-slate-200 shadow-sm">
                            <Clock size={12} className="text-emerald-500" />
                            Actualizado: {lastUpdate ? lastUpdate.toLocaleTimeString() : '...'}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">
                            {/* Showing Filter Mode */}
                            Filtro: {activeFilter}
                        </span>
                    </div>
                </div>

                <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                    <button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all hover:scale-105">
                        <Download size={16} /> Exportar Excel
                    </button>
                    <div className="relative w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar Cliente, ID, Rut..." className="w-full bg-slate-50 border-none rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* TABS DE FILTRO (PILL DESIGN) */}
            <div className="flex justify-center mb-10">
                <div className="bg-white p-1.5 rounded-2xl shadow-lg shadow-slate-200/50 inline-flex gap-2 border border-slate-100">
                    {['TODOS', 'PROVISION', 'REPARACION'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeFilter === filter
                                ? 'bg-slate-800 text-white shadow-md transform scale-105'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* SECCIÓN 1: KPIS PRINCIPALES (TOP LEVEL) */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard
                    title="Ordenes Completadas"
                    value={monthlyStats.totalOrdenes}
                    icon={FileSpreadsheet}
                    color="blue"
                    subtext="Total Mensual"
                    breakdown={{ provision: monthlyStats.totalProv, reparacion: monthlyStats.totalRep, rutina: monthlyStats.totalRut }}
                    extraMetric={{ label: "Pts Baremos", value: monthlyStats.totalBaremos, color: "text-amber-500" }}
                />
                <StatCard
                    title="Días Operativos"
                    value={monthlyStats.operatingDays}
                    icon={Calendar}
                    color="emerald"
                    subtext="Días con Actividad"
                />
                <StatCard
                    title="Promedio Diario"
                    value={monthlyStats.dailyAvg}
                    icon={TrendingUp}
                    color="violet"
                    subtext="Ordenes / Día"
                    breakdown={{ provision: monthlyStats.avgProv, reparacion: monthlyStats.avgRep, rutina: monthlyStats.avgRut }}
                />
            </div>

            {/* SECCIÓN 2: CALENDARIO DE ACTIVIDAD (HEATMAP) */}
            <CalendarHeatMap />

            {/* SECCIÓN 3: DOTACIÓN OPERATIVA (NUEVO) */}
            <TechOperationHeatmap />

            {/* SECCIÓN 4: DETALLE DE DÍA (EXPANDABLE) */}
            {
                selectedDate && dayDetails && (
                    <div className="mb-10 animate-in slide-in-from-top-10 duration-500 fade-in">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-1 shadow-2xl shadow-slate-900/20">
                            <div className="bg-slate-50 rounded-[22px] p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                        <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg shadow-blue-500/30">
                                            <Calendar size={24} />
                                        </div>
                                        Detalle del Día: <span className="text-blue-600 uppercase tracking-tight">{selectedDate}</span>
                                    </h3>
                                    <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <RankingCard
                                        title={`Técnicos (${dayDetails.technicians.length})`}
                                        data={dayDetails.technicians}
                                        icon={User}
                                        color="blue"
                                        onItemClick={setSelectedTechnician} // Drill down further
                                    />
                                    <RankingCard
                                        title={`Actividades (${dayDetails.activities.length})`}
                                        data={dayDetails.activities}
                                        icon={Activity}
                                        color="indigo"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SECCIÓN 5: DISTRIBUCIONES (UNIFORM GRID) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                <DistributionCard title="Mix Productos" data={dashboardStats.mixTecnologico} icon={Database} color="rose" />
                <DistributionCard title="Tipo de Trabajo" data={dashboardStats.porTipoTrabajo} icon={TrendingDown} color="orange" />
                <DistributionCard title="Por Agencia" data={dashboardStats.porAgencia} icon={MapPin} color="indigo" />
                <DistributionCard title="Por Estado" data={dashboardStats.porEstado} icon={Activity} color="emerald" />
            </div>

            {/* SECCIÓN 5: RANKINGS GLOBALES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <RankingCard
                    title="Ranking General de Técnicos"
                    data={dashboardStats.porTecnico}
                    icon={User}
                    color="blue"
                    onItemClick={setSelectedTechnician}
                />
                <RankingCard
                    title="Top Actividades Global"
                    data={dashboardStats.porActividad}
                    icon={Layers}
                    color="purple"
                />
            </div>

            {/* MODAL DE TÉCNICO V2 (DETALLADO + EVOLUCIÓN) */}
            {
                selectedTechnician && techDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white/95 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                            {/* HEADER MODAL */}
                            <div className="p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="relative">
                                        <div className="h-20 w-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner border border-blue-100">
                                            <User size={40} />
                                        </div>
                                        <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-lg text-xs font-black border-2 border-white shadow-sm ${parseFloat(techDetails.avgTotal) >= 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {parseFloat(techDetails.avgTotal) >= 2 ? '👍 MB' : '👎 BAJO'}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{selectedTechnician}</h2>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-slate-400 font-bold uppercase text-xs tracking-wider">Perfil Operativo</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                            <span className="text-blue-500 font-bold text-xs">{techDetails.activeDaysTotal} Días Activos</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedTechnician(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar bg-slate-50/50 p-8">
                                {/* KPI GRID */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col items-center relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800"></div>
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total General</span>
                                        <div className="text-4xl font-black text-slate-800 mb-1 group-hover:scale-110 transition-transform">{techDetails.total}</div>
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                                            <TrendingUp size={12} className="text-slate-600" />
                                            <span className="text-xs font-bold text-slate-600">{techDetails.avgTotal} / día</span>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/60 shadow-lg shadow-blue-500/5 flex flex-col items-center relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest mb-1">Provisión</span>
                                        <div className="text-4xl font-black text-blue-900 mb-1 group-hover:scale-110 transition-transform">{techDetails.provTotal}</div>
                                        <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded-lg border border-blue-100">
                                            <Activity size={12} className="text-blue-500" />
                                            <span className="text-xs font-bold text-blue-600">{techDetails.avgProv} / día</span>
                                        </div>
                                        <span className="text-[10px] text-blue-300 font-bold mt-1">{techDetails.activeDaysProv} Días Act</span>
                                    </div>

                                    <div className="bg-orange-50/50 p-5 rounded-2xl border border-orange-100/60 shadow-lg shadow-orange-500/5 flex flex-col items-center relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                                        <span className="text-xs font-black text-orange-400 uppercase tracking-widest mb-1">Reparación</span>
                                        <div className="text-4xl font-black text-orange-900 mb-1 group-hover:scale-110 transition-transform">{techDetails.repTotal}</div>
                                        <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded-lg border border-orange-100">
                                            <Wrench size={12} className="text-orange-500" />
                                            <span className="text-xs font-bold text-orange-600">{techDetails.avgRep} / día</span>
                                        </div>
                                        <span className="text-[10px] text-orange-300 font-bold mt-1">{techDetails.activeDaysRep} Días Act</span>
                                    </div>
                                </div>

                                {/* EVOLUTION & DISTRIBUTION */}
                                <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[400px]">
                                    {/* EVOLUCIÓN DIARIA */}
                                    <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                            <h3 className="font-black text-slate-700 flex items-center gap-2">
                                                <Calendar size={18} className="text-slate-400" /> Evolución Diaria
                                            </h3>
                                            <span className="text-[10px] font-bold bg-slate-200 text-slate-500 px-2 py-1 rounded">{techDetails.evolution.length} Reg</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                                            <table className="w-full text-left text-xs">
                                                <thead className="text-slate-400 font-bold uppercase tracking-wider sticky top-0 bg-white z-10">
                                                    <tr>
                                                        <th className="px-4 py-2">Fecha</th>
                                                        <th className="px-4 py-2 text-center text-blue-500">Prov</th>
                                                        <th className="px-4 py-2 text-center text-orange-500">Rep</th>
                                                        <th className="px-4 py-2 text-right">Total</th>
                                                        <th className="px-4 py-2 text-center">Eficiencia</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {techDetails.evolution.map((day, idx) => {
                                                        const dateObj = new Date(day.date);
                                                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                                        const efficiency = day.total >= 4 ? '🔥' : (day.total >= 2 ? '✅' : '⚠️');
                                                        return (
                                                            <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isWeekend ? 'bg-slate-50/30' : ''}`}>
                                                                <td className="px-4 py-3 font-bold text-slate-600">
                                                                    {dateObj.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: 'short' })}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {day.provision > 0 ? <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{day.provision}</span> : <span className="text-slate-200">-</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    {day.reparacion > 0 ? <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">{day.reparacion}</span> : <span className="text-slate-200">-</span>}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-black text-slate-800">{day.total}</td>
                                                                <td className="px-4 py-3 text-center text-base">{efficiency}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* ACTIVIDADES & ESTADOS (STACKED) */}
                                    <div className="w-full lg:w-80 flex flex-col gap-6">
                                        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden flex-1 flex flex-col">
                                            <div className="p-4 border-b border-slate-100 font-black text-slate-700 text-xs uppercase text-center bg-slate-50/50">Top Actividades</div>
                                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                                {techDetails.activities.slice(0, 8).map((act, i) => (
                                                    <div key={i} className="flex justify-between items-center mb-3 last:mb-0">
                                                        <div className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={act.name}>{act.name}</div>
                                                        <div className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-1.5 rounded">{act.total}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden flex-1 flex flex-col">
                                            <div className="p-4 border-b border-slate-100 font-black text-slate-700 text-xs uppercase text-center bg-slate-50/50">Estados Cierre</div>
                                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                                {techDetails.states.map((st, i) => (
                                                    <div key={i} className="flex justify-between items-center mb-3 last:mb-0">
                                                        <div className="text-[10px] font-bold text-slate-600 truncate max-w-[180px]" title={st.name}>{st.name}</div>
                                                        <div className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-1.5 rounded">{st.total}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* TABLA DATA RAW (ABAJO) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden opacity-80 hover:opacity-100 transition-opacity">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <h4 className="font-black text-slate-600 text-xs uppercase tracking-widest">Base de Datos Fuente</h4>
                    <span className="text-[10px] bg-white border px-2 py-1 rounded text-slate-400 flex items-center gap-1"><Database size={10} /> {dataRaw.length} rows</span>
                </div>
                <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase bg-slate-50 border-b w-24 sticky left-0 z-20">Fecha</th>
                                {dynamicKeys.map(key => (
                                    <th key={key} className="p-3 text-[10px] font-black text-slate-400 uppercase bg-slate-50 border-b whitespace-nowrap">{key}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {dataRaw
                                .filter(t => JSON.stringify(t).toLowerCase().includes(busqueda.toLowerCase()))
                                .slice(0, 50)
                                .map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors text-[10px] text-slate-500">
                                        <td className="p-2 border-r border-slate-100 sticky left-0 bg-white font-bold">{new Date(row.fecha).toLocaleDateString()}</td>
                                        {dynamicKeys.map(key => (
                                            <td key={key} className="p-2 border-r border-slate-50 whitespace-nowrap overflow-hidden max-w-[150px] truncate">
                                                {row[key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div >
    );
};

export default Produccion;