import React, { useState, useEffect } from 'react';
import { Network, RefreshCw, BarChart3, Loader2, PieChart as PieChartIcon, CheckCircle2, XCircle, AlertCircle, X, Search, Download, Activity, MapPin, Layers } from 'lucide-react';
import { telecomApi as api } from '../telecomApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
  ComposedChart, Line
} from 'recharts';

export default function AnalisisAsignacionTab({ tecnicos = [] }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [activeDrilldown, setActiveDrilldown] = useState(null);
  const [drilldownSearch, setDrilldownSearch] = useState('');
  const [summary, setSummary] = useState({
    total: 0,
    completadas: 0,
    canceladas: 0,
    pendientes: 0,
    efectividad: 0
  });
  
  // Independent date filters
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchData = async () => {
    if (!tecnicos || tecnicos.length === 0) return;
    
    setLoading(true);
    try {
      const params = {
        desde: dateFrom,
        hasta: dateTo,
        estado: 'todos' // Force fetch all states
      };
      
      const res = await api.get('/bot/produccion-raw', { params });
      if (res.data && res.data.rows) {
        processRawData(res.data.rows);
      } else {
        setData({ chartData: [], tableData: [], allStates: [], activityData: [] });
      }
    } catch (error) {
      console.error("Error fetching analisis asignacion raw:", error);
    } finally {
      setLoading(false);
    }
  };

  const processRawData = (rows) => {
    // 1. Filtrar filas solo a los técnicos actuales de la vista (con ceros a la izquierda homogeneizados)
    const techSetValid = new Set();
    const techProjectMap = {};

    tecnicos.forEach(t => {
      const proj = t.proyecto || t.projectName || 'Sin Proyecto';
      const idsToCheck = [t.idRecursoToa, t.idRecurso, t.rut];
      idsToCheck.forEach(id => {
        if (!id) return;
        const val = String(id).trim();
        techSetValid.add(val);
        techSetValid.add(val.replace(/^0+/, ''));
        techProjectMap[val] = proj;
        techProjectMap[val.replace(/^0+/, '')] = proj;
      });
    });

    const getProjectForTech = (recursoId) => {
      if (!recursoId) return 'Sin Proyecto';
      const val = String(recursoId).trim();
      if (techProjectMap[val]) return techProjectMap[val];
      const cleanVal = val.replace(/^0+/, '');
      if (techProjectMap[cleanVal]) return techProjectMap[cleanVal];
      return 'Sin Proyecto';
    };

    const filteredRows = rows.filter(row => {
      const rowId = String(row['RECURSO'] || '').trim();
      if (!rowId) return false;
      return techSetValid.has(rowId) || techSetValid.has(rowId.replace(/^0+/, ''));
    });
    setRawRows(filteredRows);

    // 2. Agrupar la información y calcular resúmenes
    let chartDataMap = {};
    let tableDataMap = {};
    let activityMap = {};
    const stateSet = new Set();

    // Calcular KPIs de órdenes únicas globales para evitar duplicidad entre días
    const processedUniqueOrders = {};

    filteredRows.forEach(row => {
      const pet = String(row['N° Petición'] || row['Número_de_Petición'] || row['Número de Petición'] || row['peticion'] || '').trim();
      const fallbackId = String(row['ordenId'] || row['_id'] || '').trim();
      const uniqueKey = pet && pet.length > 2 ? pet : fallbackId;

      let stateLabel = String(row['Estado'] || 'Sin Estado').trim();
      stateLabel = stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1).toLowerCase();

      const visits = Number(row['Visitas'] || 1);
      const comuna = String(row['Ciudad'] || 'Sin Comuna').trim().toUpperCase();
      const baremo = Number(row['Pts Total'] || 0);
      const recurso = String(row['RECURSO'] || '').trim();

      if (!processedUniqueOrders[uniqueKey]) {
        processedUniqueOrders[uniqueKey] = {
          state: stateLabel,
          visits: visits,
          comuna: comuna,
          baremo: baremo,
          recurso: recurso
        };
      } else {
        // Priorizar estado: Completado > Iniciado/Pendiente > otros
        const currentPrio = (state) => {
          const s = String(state || '').toLowerCase();
          if (s.includes('complet') || s.includes('finaliz')) return 1;
          if (s.includes('inici') || s.includes('pendien')) return 2;
          return 3;
        };
        if (currentPrio(stateLabel) < currentPrio(processedUniqueOrders[uniqueKey].state)) {
          processedUniqueOrders[uniqueKey].state = stateLabel;
          processedUniqueOrders[uniqueKey].recurso = recurso;
        }
        if (visits > processedUniqueOrders[uniqueKey].visits) {
          processedUniqueOrders[uniqueKey].visits = visits;
        }
        if (baremo > processedUniqueOrders[uniqueKey].baremo) {
          processedUniqueOrders[uniqueKey].baremo = baremo;
        }
      }
    });

    let total = 0;
    let completadas = 0;
    let canceladas = 0;
    let pendientes = 0;

    // Rellenar resúmenes globales y de reincidencia
    const globalStatesMap = {};
    const gestionesDist = {
      '1 Gestión': { name: '1 Gestión', Completado: 0, Cancelado: 0, Pendiente: 0, totalBaremo: 0, count: 0 },
      '2 Gestiones': { name: '2 Gestiones', Completado: 0, Cancelado: 0, Pendiente: 0, totalBaremo: 0, count: 0 },
      '3 Gestiones': { name: '3 Gestiones', Completado: 0, Cancelado: 0, Pendiente: 0, totalBaremo: 0, count: 0 },
      '4+ Gestiones': { name: '4+ Gestiones', Completado: 0, Cancelado: 0, Pendiente: 0, totalBaremo: 0, count: 0 }
    };
    const projectMap = {};

    Object.values(processedUniqueOrders).forEach(order => {
      total++;
      const stateLabel = order.state;
      let stateCategory = 'Pendiente';
      if (stateLabel.includes('Completad') || stateLabel.includes('Finalizad')) {
        completadas++;
        stateCategory = 'Completado';
      } else if (stateLabel.includes('Cancelad') || stateLabel.includes('No realizad') || stateLabel.includes('Suspendid')) {
        canceladas++;
        stateCategory = 'Cancelado';
      } else {
        pendientes++;
      }

      // a) Distribución global de estados
      globalStatesMap[stateLabel] = (globalStatesMap[stateLabel] || 0) + 1;

      // b) Distribución de gestiones/visitas con desglose de estados y baremo
      let bucketKey = '1 Gestión';
      if (order.visits === 2) bucketKey = '2 Gestiones';
      else if (order.visits === 3) bucketKey = '3 Gestiones';
      else if (order.visits >= 4) bucketKey = '4+ Gestiones';

      gestionesDist[bucketKey][stateCategory] += 1;
      gestionesDist[bucketKey].totalBaremo += order.baremo || 0;
      gestionesDist[bucketKey].count += 1;

      // c) Distribución por proyecto
      const proj = getProjectForTech(order.recurso);
      if (!projectMap[proj]) {
        projectMap[proj] = { name: proj, total: 0, gestiones: 0, completed: 0 };
      }
      projectMap[proj].total += 1;
      projectMap[proj].gestiones += order.visits;
      if (stateCategory === 'Completado') {
        projectMap[proj].completed += 1;
      }
    });

    filteredRows.forEach(row => {
      let stateLabel = String(row['Estado'] || 'Sin Estado').trim();
      stateLabel = stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1).toLowerCase();
      stateSet.add(stateLabel);

      const dateStr = row['Fecha'] || 'Sin Fecha';
      let sortKey = dateStr;
      if (dateStr.includes('-') && dateStr.split('-')[0].length <= 2) {
         const [d, m, y] = dateStr.split('-');
         sortKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      } else if (dateStr.includes('/') && dateStr.split('/')[0].length <= 2) {
         const [d, m, y] = dateStr.split('/');
         sortKey = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      // Chart Data (Evolution)
      if (!chartDataMap[sortKey]) chartDataMap[sortKey] = { date: sortKey, displayDate: dateStr, total: 0, dummyTotal: 0 };
      chartDataMap[sortKey][stateLabel] = (chartDataMap[sortKey][stateLabel] || 0) + 1;
      chartDataMap[sortKey].total += 1;

      // Table Data (Techs)
      const techId = row['RECURSO'] || 'Desconocido';
      const techName = row['Técnico'] || techId;
      if (!tableDataMap[techId]) tableDataMap[techId] = { idRecurso: techId, name: techName, total: 0, states: {} };
      tableDataMap[techId].states[stateLabel] = (tableDataMap[techId].states[stateLabel] || 0) + 1;
      tableDataMap[techId].total += 1;

      // Activity Data
      let actLabel = row['Subtipo Actividad'] || row['Tipo Trabajo'] || row['LPU Base'] || 'No Definida';
      if (actLabel.length > 25) actLabel = actLabel.substring(0, 25) + '...';
      if (!activityMap[actLabel]) activityMap[actLabel] = { name: actLabel, total: 0 };
      activityMap[actLabel][stateLabel] = (activityMap[actLabel][stateLabel] || 0) + 1;
      activityMap[actLabel].total += 1;
    });

    const chartData = Object.values(chartDataMap).sort((a, b) => a.date.localeCompare(b.date));
    const tableDataList = Object.values(tableDataMap).sort((a, b) => b.total - a.total);
    const activityDataList = Object.values(activityMap).sort((a, b) => b.total - a.total);
    const allStates = Array.from(stateSet).sort();

    const globalStatesData = Object.entries(globalStatesMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const gestionesDistData = Object.values(gestionesDist).map(bucket => ({
      name: bucket.name,
      Completado: bucket.Completado,
      Cancelado: bucket.Cancelado,
      Pendiente: bucket.Pendiente,
      total: bucket.count,
      avgBaremo: bucket.count > 0 ? Number((bucket.totalBaremo / bucket.count).toFixed(2)) : 0
    }));
    const projectData = Object.values(projectMap)
      .map(p => ({
        ...p,
        effectiveness: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0
      }))
      .sort((a, b) => b.gestiones - a.gestiones);

    const scatterData = tableDataList.map(t => {
      const completed = t.states['Completado'] || t.states['Completada'] || t.states['Finalizado'] || t.states['Finalizada'] || 0;
      const totalOrders = t.total || 1;
      const eff = Math.round((completed / totalOrders) * 100);
      
      const techRows = filteredRows.filter(r => {
        const rowId = String(r['RECURSO'] || '').trim();
        const tid = String(t.idRecurso).trim();
        return rowId === tid || rowId.replace(/^0+/, '') === tid.replace(/^0+/, '');
      });
      const totalBaremo = techRows.reduce((acc, r) => acc + Number(r['Pts Total'] || 0), 0);
      const avgBaremo = techRows.length > 0 ? Number((totalBaremo / techRows.length).toFixed(2)) : 0;

      return {
        name: t.name,
        id: t.idRecurso,
        x: totalOrders,
        y: eff,
        z: avgBaremo,
        avgBaremo
      };
    });

    const efectividad = total > 0 ? ((completadas / total) * 100).toFixed(1) : 0;
    setSummary({ total, completadas, canceladas, pendientes, efectividad });

    setData({
      chartData,
      tableData: tableDataList,
      activityData: activityDataList,
      allStates,
      globalStatesData,
      gestionesDistData,
      projectData,
      scatterData
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, tecnicos]);

  const COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
  const getStateColor = (stateStr, index) => {
    const s = stateStr.toLowerCase();
    if (s.includes('completad') || s.includes('finalizad')) return '#10b981'; 
    if (s.includes('pendient') || s.includes('iniciad')) return '#f59e0b'; 
    if (s.includes('cancelad') || s.includes('no realizad') || s.includes('suspendid')) return '#ef4444'; 
    return COLORS[index % COLORS.length];
  };

  const renderCustomizedLabel = (props) => {
    const { x, y, width, height, value, index } = props;
    if (!value || value === 0) return null;
    
    // Obtener el total del día de forma segura usando el index
    const dayData = data?.chartData?.[index];
    const total = dayData?.total || 1;
    const pct = ((value / total) * 100).toFixed(0);
    
    if (height < 18) return null; // No mostrar si es demasiado pequeña la barra
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#fff" fontSize={9} fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
        {value} ({pct}%)
      </text>
    );
  };

  const renderDailyTotalLabel = (props) => {
    const { x, y, width, value } = props;
    if (value === undefined || value === null || value === 0) return null;
    return (
      <text x={x + width / 2} y={y - 8} fill="#475569" fontSize={10} fontWeight="extrabold" textAnchor="middle">
        Total: {value}
      </text>
    );
  };

  const handleChartClick = (state) => {
    const normalizeToYMD = (dateStr) => {
      if (!dateStr || typeof dateStr !== 'string') return '';
      const cleanStr = dateStr.trim();
      if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (d.length === 4) return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
        }
      }
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts;
          if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          if (d.length === 4) return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
        }
      }
      return cleanStr;
    };

    let clickedDisplayDate = null;
    let clickedDateYMD = null;

    if (state && state.activePayload && state.activePayload.length > 0) {
      const payload = state.activePayload[0].payload;
      clickedDisplayDate = payload.displayDate;
      clickedDateYMD = payload.date;
    }
    else if (state && state.activeLabel) {
      clickedDisplayDate = state.activeLabel;
      const found = data?.chartData?.find(d => d.displayDate === state.activeLabel);
      if (found) clickedDateYMD = found.date;
    }
    else if (state && state.displayDate) {
      clickedDisplayDate = state.displayDate;
      clickedDateYMD = state.date;
    }

    if (clickedDateYMD || clickedDisplayDate) {
      const dayOrders = rawRows.filter(row => {
        if (clickedDateYMD) {
          const rowYMD = row.Fecha ? normalizeToYMD(row.Fecha) : '';
          if (rowYMD === clickedDateYMD) return true;
        }
        return row.Fecha === clickedDisplayDate;
      });
      setSelectedDay({ date: clickedDisplayDate || clickedDateYMD, orders: dayOrders });
      setDrawerSearch('');
      setExpandedRows({});
    }
  };

  const triggerDrilldown = (type, name, title) => {
    let drilldownOrders = [];
    if (type === 'proyecto') {
      const techProjectMap = {};
      tecnicos.forEach(t => {
        const proj = t.proyecto || t.projectName || 'Sin Proyecto';
        const idsToCheck = [t.idRecursoToa, t.idRecurso, t.rut];
        idsToCheck.forEach(id => {
          if (!id) return;
          const val = String(id).trim();
          techProjectMap[val] = proj;
          techProjectMap[val.replace(/^0+/, '')] = proj;
        });
      });

      const getProjectForTech = (recursoId) => {
        if (!recursoId) return 'Sin Proyecto';
        const val = String(recursoId).trim();
        if (techProjectMap[val]) return techProjectMap[val];
        const cleanVal = val.replace(/^0+/, '');
        if (techProjectMap[cleanVal]) return techProjectMap[cleanVal];
        return 'Sin Proyecto';
      };

      drilldownOrders = rawRows.filter(r => getProjectForTech(r['RECURSO']) === name);
    } else if (type === 'comuna') {
      drilldownOrders = rawRows.filter(r => String(r['Ciudad'] || 'Sin Comuna').trim().toUpperCase() === name.toUpperCase());
    } else if (type === 'actividad') {
      drilldownOrders = rawRows.filter(r => {
        let actLabel = r['Subtipo Actividad'] || r['Tipo Trabajo'] || r['LPU Base'] || 'No Definida';
        if (actLabel.length > 25) actLabel = actLabel.substring(0, 25) + '...';
        return actLabel === name;
      });
    } else if (type === 'visitas') {
      const visitsNum = name === '4+ Gestiones' ? 4 : parseInt(name);
      drilldownOrders = rawRows.filter(r => {
        const v = Number(r['Visitas'] || 1);
        return visitsNum === 4 ? v >= 4 : v === visitsNum;
      });
    } else if (type === 'tecnico') {
      drilldownOrders = rawRows.filter(r => {
        const rowId = String(r['RECURSO'] || '').trim();
        const tid = String(name).trim();
        return rowId === tid || rowId.replace(/^0+/, '') === tid.replace(/^0+/, '') || String(r['Técnico']).toLowerCase() === String(name).toLowerCase();
      });
    } else if (type === 'estado') {
      drilldownOrders = rawRows.filter(r => {
        let stateLabel = String(r['Estado'] || 'Sin Estado').trim();
        stateLabel = stateLabel.charAt(0).toUpperCase() + stateLabel.slice(1).toLowerCase();
        return stateLabel === name;
      });
    }

    // Calcular KPIs específicos
    const uniqueOrders = {};
    drilldownOrders.forEach(row => {
      const pet = String(row['N° Petición'] || row['Número_de_Petición'] || row['Número de Petición'] || row['peticion'] || '').trim();
      const fallbackId = String(row['ordenId'] || row['_id'] || '').trim();
      const uniqueKey = pet && pet.length > 2 ? pet : fallbackId;
      const stateLabel = String(row['Estado'] || 'Sin Estado').trim();
      const visits = Number(row['Visitas'] || 1);
      const baremo = Number(row['Pts Total'] || 0);

      if (!uniqueOrders[uniqueKey]) {
        uniqueOrders[uniqueKey] = { state: stateLabel, visits, baremo };
      } else {
        const currentPrio = (state) => {
          const s = String(state || '').toLowerCase();
          if (s.includes('complet') || s.includes('finaliz')) return 1;
          if (s.includes('inici') || s.includes('pendien')) return 2;
          return 3;
        };
        if (currentPrio(stateLabel) < currentPrio(uniqueOrders[uniqueKey].state)) {
          uniqueOrders[uniqueKey].state = stateLabel;
        }
        if (visits > uniqueOrders[uniqueKey].visits) uniqueOrders[uniqueKey].visits = visits;
        if (baremo > uniqueOrders[uniqueKey].baremo) uniqueOrders[uniqueKey].baremo = baremo;
      }
    });

    const uniqueList = Object.values(uniqueOrders);
    const total = uniqueList.length;
    const completadas = uniqueList.filter(o => o.state.toLowerCase().includes('complet') || o.state.toLowerCase().includes('finaliz')).length;
    const canceladas = uniqueList.filter(o => o.state.toLowerCase().includes('cancel') || o.state.toLowerCase().includes('no realiz') || o.state.toLowerCase().includes('suspend')).length;
    const pendientes = total - completadas - canceladas;
    const efectividad = total > 0 ? Math.round((completadas / total) * 100) : 0;
    const avgBaremo = total > 0 ? Number((uniqueList.reduce((acc, o) => acc + o.baremo, 0) / total).toFixed(2)) : 0;
    const avgVisits = total > 0 ? Number((uniqueList.reduce((acc, o) => acc + o.visits, 0) / total).toFixed(2)) : 1;
    const resolution1st = total > 0 ? Math.round((uniqueList.filter(o => o.visits === 1).length / total) * 100) : 0;

    const volumePct = summary.total > 0 ? Math.min(100, Math.round((total / summary.total) * 100 * 5)) : 0;
    const complexityPct = Math.min(100, Math.round((avgBaremo / 4.5) * 100));
    const operationalEfficiency = total > 0 ? Math.round(((total - canceladas) / total) * 100) : 0;

    const radarData = [
      { subject: 'Volumen Rel.', value: volumePct, fullMark: 100 },
      { subject: 'Efectividad %', value: efectividad, fullMark: 100 },
      { subject: 'Complejidad %', value: complexityPct, fullMark: 100 },
      { subject: 'Resolución 1ª', value: resolution1st, fullMark: 100 },
      { subject: 'Eficiencia Op.', value: operationalEfficiency, fullMark: 100 }
    ];

    setActiveDrilldown({
      type,
      name,
      title,
      total,
      completadas,
      canceladas,
      pendientes,
      efectividad,
      avgBaremo,
      avgVisits,
      radarData,
      orders: drilldownOrders
    });
    setDrilldownSearch('');
    setExpandedRows({});
  };

  const toggleRowExpanded = (petId) => {
    if (!petId) return;
    setExpandedRows(prev => ({
      ...prev,
      [petId]: !prev[petId]
    }));
  };

  const exportDrawerCSV = () => {
    if (!selectedDay) return;
    const headers = ['Fecha', 'N° Petición', 'Técnico', 'RECURSO', 'Ciudad', 'Subtipo Actividad', 'Estado', 'Pts Total'];
    const csvRows = [headers.join(',')];
    
    selectedDay.orders.forEach(o => {
      const values = [
        o.Fecha || '',
        `"${o['N° Petición'] || ''}"`,
        `"${o['Técnico'] || ''}"`,
        `"${o['RECURSO'] || ''}"`,
        `"${o['Ciudad'] || ''}"`,
        `"${o['Subtipo Actividad'] || ''}"`,
        `"${o['Estado'] || ''}"`,
        o['Pts Total'] ?? ''
      ];
      csvRows.push(values.join(','));
    });
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ordenes_${selectedDay.date.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredDrawerOrders = selectedDay ? selectedDay.orders.filter(order => {
    const query = drawerSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      String(order['N° Petición'] || '').toLowerCase().includes(query) ||
      String(order['Técnico'] || '').toLowerCase().includes(query) ||
      String(order['Ciudad'] || '').toLowerCase().includes(query) ||
      String(order['Subtipo Actividad'] || '').toLowerCase().includes(query) ||
      String(order['Estado'] || '').toLowerCase().includes(query)
    );
  }) : [];

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2.5 rounded-xl">
            <Network size={24} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Análisis Avanzado de Asignación</h2>
            <p className="text-sm text-slate-500 font-medium">Volumen crudo directo de base de datos</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Desde</label>
            <input 
              type="date" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-semibold text-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Hasta</label>
            <input 
              type="date" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white border border-slate-200 text-sm font-semibold text-slate-700 px-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {/* Tarjetas Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Asignadas</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{summary.total}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Órdenes Totales</p>
          </div>
          <div className="bg-slate-50 text-slate-500 p-3 rounded-xl">
             <BarChart3 size={20} />
          </div>
        </div>
        {/* Completadas */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completadas</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {summary.completadas}
            </h3>
            <p className="text-[10px] text-emerald-500 font-bold uppercase mt-1">
              {summary.total > 0 ? ((summary.completadas / summary.total) * 100).toFixed(0) : 0}% del total
            </p>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
             <CheckCircle2 size={20} />
          </div>
        </div>
        {/* Canceladas */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Realizadas</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">
              {summary.canceladas}
            </h3>
            <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">
              {summary.total > 0 ? ((summary.canceladas / summary.total) * 100).toFixed(0) : 0}% del total
            </p>
          </div>
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl">
             <XCircle size={20} />
          </div>
        </div>
        {/* Pendientes */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pendientes</p>
            <h3 className="text-2xl font-black text-amber-500 mt-1">
              {summary.pendientes}
            </h3>
            <p className="text-[10px] text-amber-500 font-bold uppercase mt-1">
              {summary.total > 0 ? ((summary.pendientes / summary.total) * 100).toFixed(0) : 0}% del total
            </p>
          </div>
          <div className="bg-amber-50 text-amber-500 p-3 rounded-xl">
             <AlertCircle size={20} />
          </div>
        </div>
        {/* Eficiencia */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Efectividad</p>
            <h3 className="text-2xl font-black text-indigo-600 mt-1">
              {summary.efectividad}%
            </h3>
            <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Tasa de Cierre</p>
          </div>
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl">
             <Network size={20} />
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 size={40} className="text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Extrayendo datos de la base...</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          
          {/* Chart Section (100% width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-500" />
                Evolución Diaria de Estados
              </h3>
            </div>
            <div className="h-[400px]">
              {data.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={data.chartData} 
                    margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                    onClick={handleChartClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="displayDate" tick={{fontSize: 12, fill: '#64748b'}} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                      formatter={(value, name, props) => [`${value} (${((value / props.payload.total) * 100).toFixed(0)}%)`, name]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    {data.allStates.map((stateLabel, idx) => (
                      <Bar 
                        key={stateLabel} 
                        dataKey={stateLabel} 
                        stackId="a" 
                        fill={getStateColor(stateLabel, idx)} 
                        radius={idx === data.allStates.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        minPointSize={3}
                        onClick={handleChartClick}
                        style={{ cursor: 'pointer' }}
                      >
                         <LabelList dataKey={stateLabel} content={renderCustomizedLabel} />
                      </Bar>
                    ))}
                    {/* Dummy bar to render the daily total on top of each stack */}
                    <Bar 
                      dataKey="dummyTotal" 
                      stackId="a" 
                      fill="transparent" 
                      opacity={0}
                      onClick={handleChartClick}
                      style={{ cursor: 'pointer' }}
                    >
                      <LabelList dataKey="total" content={renderDailyTotalLabel} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                  No hay datos para las fechas seleccionadas
                </div>
              )}
            </div>
          </div>

          {/* Composed Chart: Distribución y Complejidad de Gestiones por Orden (100% width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <BarChart3 size={18} className="text-indigo-500" />
                  Distribución y Calidad Operacional de Gestiones por Orden
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wider">
                  Desglose de estados finales y promedio de baremo según el número de visitas acumuladas (Hacer clic en barra para ver detalle).
                </p>
              </div>
            </div>
            <div className="h-[350px]">
              {data.gestionesDistData && data.gestionesDistData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart 
                    data={data.gestionesDistData} 
                    margin={{ top: 20, right: -5, left: -20, bottom: 0 }}
                    onClick={(state) => {
                      if (state && state.activePayload && state.activePayload.length > 0) {
                        const name = state.activePayload[0].payload.name;
                        triggerDrilldown('visitas', name, `Gestiones: ${name}`);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Cantidad de Órdenes', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Baremo Promedio (pts)', angle: 90, position: 'insideRight', offset: 10, fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                      formatter={(value, name, props) => {
                        if (name === "avgBaremo") return [`${value} pts`, "Baremo Promedio"];
                        return [`${value} órdenes (${((value / props.payload.total) * 100).toFixed(0)}%)`, name];
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="Completado" stackId="gest" fill="#10b981" />
                    <Bar yAxisId="left" dataKey="Cancelado" stackId="gest" fill="#ef4444" />
                    <Bar yAxisId="left" dataKey="Pendiente" stackId="gest" fill="#f59e0b" />
                    <Line yAxisId="right" type="monotone" dataKey="avgBaremo" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 8 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-medium">
                  No hay datos para las fechas seleccionadas
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Grid: Activities Pie Chart & Performance Scatter Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Activity Chart Section (Tipos de Actividad) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">
                  <PieChartIcon size={18} className="text-indigo-500" />
                  Tipos de Actividad
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mb-4 uppercase tracking-wider">
                  Volumen de tareas clasificadas por subtipo (Hacer clic para abrir detalle).
                </p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="h-[240px] w-full md:w-1/2">
                  {data.activityData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.activityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="total"
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          onClick={(entry) => triggerDrilldown('actividad', entry.name, `Actividad: ${entry.name}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          {data.activityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value, name, props) => [`${value} (${((value / summary.total) * 100).toFixed(0)}%)`, props.payload.name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-medium text-xs">
                       No hay datos de actividades
                    </div>
                  )}
                </div>
                
                <div className="w-full md:w-1/2 space-y-1.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Distribución por volumen</p>
                  {data.activityData.map((act, idx) => (
                    <div 
                      key={act.name} 
                      className="flex items-center justify-between text-[11px] py-1 hover:bg-slate-50 rounded px-1.5 transition-colors cursor-pointer"
                      onClick={() => triggerDrilldown('actividad', act.name, `Actividad: ${act.name}`)}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-slate-600 font-bold truncate" title={act.name}>{act.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-800 ml-1">
                        {act.total} <span className="text-slate-400 font-medium ml-0.5">({((act.total / summary.total) * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Scatter Chart (Matriz de Desempeño Técnico) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">
                  <Activity size={18} className="text-indigo-500" />
                  Matriz de Desempeño Técnico
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mb-4 uppercase tracking-wider">
                  Comparativa de Especialistas. Eje X: Volumen. Eje Y: Efectividad. Tamaño: Complejidad (Baremo).
                </p>
              </div>
              <div className="h-[240px] w-full">
                {data.scatterData && data.scatterData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" dataKey="x" name="Órdenes Asignadas" unit=" ord" tick={{fontSize: 9}} label={{ value: 'Volumen (Órdenes)', position: 'insideBottom', offset: -5, fontSize: 8, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <YAxis type="number" dataKey="y" name="Efectividad" unit="%" domain={[0, 100]} tick={{fontSize: 9}} label={{ value: 'Efectividad (%)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 8, fontWeight: 'bold', fill: '#94a3b8' }} />
                      <ZAxis type="number" dataKey="z" range={[60, 350]} name="Baremo Promedio" />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                        formatter={(value, name, props) => {
                          if (name === "Efectividad") return [`${value}%`, name];
                          if (name === "Órdenes Asignadas") return [`${value} órdenes`, name];
                          if (name === "Baremo Promedio") return [`${value} pts`, name];
                          return [value, name];
                        }}
                      />
                      <Scatter name="Técnicos" data={data.scatterData} onClick={(node) => triggerDrilldown('tecnico', node.name, `Especialista: ${node.name}`)}>
                        {data.scatterData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.y >= 80 ? '#10b981' : entry.y >= 50 ? '#f59e0b' : '#ef4444'} 
                            style={{ cursor: 'pointer' }} 
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 font-medium text-xs">
                     No hay datos de rendimiento de técnicos
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-4 text-[9px] font-black uppercase text-slate-400 mt-2">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>Alto (&gt;=80%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>Medio (50-79%)</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>Bajo (&lt;50%)</span>
              </div>
            </div>

          </div>

          {/* New Dashboard Grid for Advanced Summaries (Two Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Global States of Unique Orders */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">
                  <PieChartIcon size={16} className="text-indigo-500" />
                  Estado Global de Órdenes Únicas
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mb-4 uppercase tracking-wider">
                  Consolidado del estado final real de cada petición física (Hacer clic en sector para ver detalle).
                </p>
              </div>
              <div className="h-[220px]">
                {data.globalStatesData && data.globalStatesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.globalStatesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        onClick={(entry) => triggerDrilldown('estado', entry.name, `Estado: ${entry.name}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        {data.globalStatesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getStateColor(entry.name, index)} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value) => [`${value} órdenes`, 'Cantidad']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Sin datos
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-1.5 max-h-[100px] overflow-y-auto pr-1 custom-scrollbar">
                {data.globalStatesData && data.globalStatesData.map((st, idx) => (
                  <div 
                    key={st.name} 
                    className="flex items-center justify-between text-xs py-0.5 hover:bg-slate-50 rounded px-1.5 transition-colors cursor-pointer"
                    onClick={() => triggerDrilldown('estado', st.name, `Estado: ${st.name}`)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getStateColor(st.name, idx) }}></span>
                      <span className="text-slate-600 font-bold truncate">{st.name}</span>
                    </div>
                    <span className="font-extrabold text-slate-800">
                      {st.value} <span className="text-slate-400 font-medium ml-1">({((st.value / summary.total) * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Carga de Gestiones por Proyecto */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-2">
                  <Layers size={16} className="text-indigo-500" />
                  Carga de Gestiones por Proyecto
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mb-4 uppercase tracking-wider">
                  Proyectos con mayor volumen de visitas totales acumuladas (Hacer clic en barra para ver detalle).
                </p>
              </div>
              <div className="h-[220px]">
                {data.projectData && data.projectData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={data.projectData} 
                      layout="y" 
                      margin={{ top: 5, right: 15, left: 15, bottom: 5 }}
                      onClick={(state) => {
                        if (state && state.activePayload && state.activePayload.length > 0) {
                          const name = state.activePayload[0].payload.name;
                          triggerDrilldown('proyecto', name, `Proyecto: ${name}`);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" tick={{fontSize: 9, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 8, fill: '#64748b', fontWeight: 'bold'}} axisLine={false} tickLine={false} width={100} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value, name, props) => {
                          const { total, effectiveness } = props.payload;
                          return [`${value} visitas (${total} órdenes, ${effectiveness}% efectividad)`, 'Gestiones'];
                        }}
                      />
                      <Bar dataKey="gestiones" fill="#10b981" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="gestiones" position="right" fill="#475569" fontSize={9} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Sin datos
                  </div>
                )}
              </div>
              <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-bold text-center uppercase tracking-wider">
                Distribución Operativa por Proyecto
              </div>
            </div>
          </div>


          {/* Table Section (Full width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Desglose Total por Especialista</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-wider">
                    <th className="p-4 whitespace-nowrap">Especialista</th>
                    <th className="p-4 text-center whitespace-nowrap border-r border-slate-100">Total Asignadas</th>
                    {data.allStates.map(st => (
                      <th key={st} className="p-4 text-center whitespace-nowrap">{st}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tableData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            {row.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{row.name}</p>
                            <p className="text-xs text-slate-500 font-medium">ID: {row.idRecurso}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center border-r border-slate-100">
                        <span className="inline-flex items-center justify-center bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-sm font-black">
                          {row.total}
                        </span>
                      </td>
                      {data.allStates.map(st => {
                        const count = row.states[st] || 0;
                        return (
                          <td key={st} className="p-4 text-center">
                            <span className={`text-sm font-bold ${count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                              {count}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {data.tableData.length === 0 && (
                    <tr>
                      <td colSpan={data.allStates.length + 2} className="p-8 text-center text-slate-500 font-medium">
                        No se encontraron datos para los técnicos y fechas seleccionadas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : null}

      {/* Detail Slide-over Panel */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setSelectedDay(null)}
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-4xl transform transition-transform duration-300 ease-out">
                <div className="flex h-full flex-col bg-white shadow-2xl border-l border-slate-100">
                  
                  {/* Header */}
                  <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Detalle de Asignaciones</h2>
                      <p className="text-xs font-bold text-slate-500 mt-1 uppercase">Día: {selectedDay.date} — {selectedDay.orders.length} órdenes</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={exportDrawerCSV}
                        className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-colors"
                        title="Exportar a Excel/CSV"
                      >
                        <Download size={14} />
                        Exportar
                      </button>
                      <button 
                        onClick={() => setSelectedDay(null)}
                        className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 p-2 rounded-xl transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Search bar & Stats pills */}
                  <div className="p-5 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-white">
                    <div className="relative flex-1 min-w-[240px]">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                        <Search size={16} />
                      </span>
                      <input 
                        type="text"
                        placeholder="Buscar por N° petición, técnico, comuna, actividad..."
                        value={drawerSearch}
                        onChange={(e) => setDrawerSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    
                    {/* Tiny stats breakdown */}
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">
                        Completadas: {selectedDay.orders.filter(o => {
                          const s = String(o.Estado || '').toLowerCase();
                          return s.includes('completad') || s.includes('finalizad');
                        }).length}
                      </span>
                      <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md">
                        Canceladas/Sus: {selectedDay.orders.filter(o => {
                          const s = String(o.Estado || '').toLowerCase();
                          return s.includes('cancelad') || s.includes('no realizad') || s.includes('suspendid');
                        }).length}
                      </span>
                      <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded-md">
                        Pendientes: {selectedDay.orders.filter(o => {
                          const s = String(o.Estado || '').toLowerCase();
                          return !s.includes('completad') && !s.includes('finalizad') && !s.includes('cancelad') && !s.includes('no realizad') && !s.includes('suspendid');
                        }).length}
                      </span>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20">
                    {filteredDrawerOrders.length > 0 ? (
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                            <th className="p-4 whitespace-nowrap">N° Petición</th>
                            <th className="p-4 whitespace-nowrap">Técnico</th>
                            <th className="p-4 whitespace-nowrap">Comuna</th>
                            <th className="p-4 whitespace-nowrap">Actividad</th>
                            <th className="p-4 text-center whitespace-nowrap">Estado</th>
                            <th className="p-4 text-right whitespace-nowrap">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredDrawerOrders.map((o, idx) => {
                            const petId = o['N° Petición'] || '';
                            const isExpanded = !!expandedRows[petId];
                            const visitsCount = o.Visitas || 1;

                            return (
                              <React.Fragment key={idx}>
                                <tr 
                                  className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                  onClick={() => toggleRowExpanded(petId)}
                                >
                                  <td className="p-4 font-extrabold text-indigo-600 whitespace-nowrap">
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-slate-400 select-none">
                                          {isExpanded ? '▼' : '▶'}
                                        </span>
                                        {o['N° Petición'] || '—'}
                                      </div>
                                      {o.RUT && (
                                        <span className="text-[10px] text-slate-400 font-semibold pl-4">
                                          RUT: {o.RUT}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div>
                                      <p className="font-bold text-slate-800">{o['Técnico'] || '—'}</p>
                                      <p className="text-[10px] text-slate-400 font-semibold">ID: {o['RECURSO'] || '—'}</p>
                                      {o.Cliente && (
                                        <p className="text-[10px] text-indigo-500 font-semibold truncate max-w-[200px]" title={o.Cliente}>
                                          Cli: {o.Cliente}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 whitespace-nowrap">
                                    <div>
                                      <p className="text-slate-600 font-bold">{o['Ciudad'] || '—'}</p>
                                      {o.Dirección && (
                                        <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[180px]" title={o.Dirección}>
                                          {o.Dirección}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex flex-col gap-1">
                                      <p className="text-slate-500 font-medium max-w-[200px] truncate" title={o['Subtipo Actividad']}>
                                        {o['Subtipo Actividad'] || '—'}
                                      </p>
                                      {/* Visitas badge */}
                                      <div className="flex">
                                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                          visitsCount > 1 
                                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                            : 'bg-slate-50 text-slate-500'
                                        }`}>
                                          {visitsCount} {visitsCount === 1 ? 'gestión' : 'gestiones (ver)'}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                      String(o.Estado || '').toLowerCase().includes('completad') || String(o.Estado || '').toLowerCase().includes('finalizad')
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : String(o.Estado || '').toLowerCase().includes('pendient') || String(o.Estado || '').toLowerCase().includes('iniciad')
                                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                                    }`}>
                                      {o.Estado || '—'}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right font-black text-slate-800 whitespace-nowrap">{o['Pts Total'] ?? '—'}</td>
                                </tr>
                                
                                {/* Expanded visits timeline */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/70">
                                    <td colSpan={6} className="p-4">
                                      <div className="bg-white p-4 rounded-xl border border-slate-100/80 shadow-inner space-y-3">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                            Historial de Gestiones en TOA
                                          </p>
                                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                                            Total: {visitsCount} {visitsCount === 1 ? 'visita' : 'visitas'}
                                          </span>
                                        </div>
                                        
                                        {o.HistorialVisitas && o.HistorialVisitas.length > 0 ? (
                                          <div className="relative border-l-2 border-indigo-100 ml-2 pl-4 space-y-4 py-1">
                                            {o.HistorialVisitas.map((v, i) => (
                                              <div key={i} className="relative">
                                                {/* Bullet point */}
                                                <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-white ${
                                                  v.estado.toLowerCase().includes('complet')
                                                    ? 'bg-emerald-500'
                                                    : v.estado.toLowerCase().includes('inici') || v.estado.toLowerCase().includes('pendien')
                                                      ? 'bg-amber-500'
                                                      : 'bg-rose-500'
                                                }`}></span>
                                                <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 space-y-2">
                                                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                                    <div className="flex items-center gap-2">
                                                      <span className="font-extrabold text-slate-800">{v.fecha}</span>
                                                      <span className="text-slate-300 font-medium">|</span>
                                                      <span className="text-slate-600 font-bold">Orden: {v.orden || o['N° Petición']}</span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                      v.estado.toLowerCase().includes('complet')
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                        : v.estado.toLowerCase().includes('inici') || v.estado.toLowerCase().includes('pendien')
                                                          ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                                                    }`}>
                                                      {v.estado}
                                                    </span>
                                                  </div>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100/60">
                                                    {v.tecnico && (
                                                      <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">Técnico:</span>{' '}
                                                        <span className="text-slate-700 font-bold">{v.tecnico}</span>
                                                      </div>
                                                    )}
                                                    {v.nombre && (
                                                      <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">Cliente:</span>{' '}
                                                        <span className="text-slate-700 font-bold">{v.nombre}</span>
                                                      </div>
                                                    )}
                                                    {v.rut && (
                                                      <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">RUT:</span>{' '}
                                                        <span className="text-slate-700 font-bold">{v.rut}</span>
                                                      </div>
                                                    )}
                                                    {v.direccion && (
                                                      <div className="md:col-span-2">
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">Dirección:</span>{' '}
                                                        <span className="text-slate-700 font-bold">{v.direccion}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-slate-400 italic font-medium pl-2">
                                            No se registran visitas previas en base de datos.
                                          </p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400 font-medium">
                        {drawerSearch ? 'No se encontraron órdenes que coincidan con la búsqueda' : 'No hay órdenes asignadas en este día'}
                      </div>
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>Fin del reporte de asignaciones</span>
                    <span>Generado dinámicamente</span>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Advanced Drill-down Modal */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-[60] overflow-hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden flex items-center justify-center p-4 sm:p-6 md:p-10">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
              onClick={() => setActiveDrilldown(null)}
            ></div>

            {/* Modal Container */}
            <div className="relative pointer-events-auto w-full max-w-5xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden transform transition-all duration-300">
              
              {/* Header */}
              <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Activity size={20} className="text-indigo-400 animate-pulse" />
                    Drill-down: {activeDrilldown.title}
                  </h2>
                  <p className="text-xs text-indigo-200 mt-1 uppercase font-bold">
                    Análisis detallado de {activeDrilldown.total} órdenes únicas encontradas
                  </p>
                </div>
                <button 
                  onClick={() => setActiveDrilldown(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition-colors border border-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-50/50 space-y-6">
                
                {/* KPI Cards & Radar Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left: KPIs Grid (7 cols) */}
                  <div className="lg:col-span-7 grid grid-cols-2 gap-4">
                    {/* KPI 1: Total */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100/80 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Órdenes Únicas</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-800">{activeDrilldown.total}</span>
                        <span className="text-xs text-slate-400 font-bold">físicas</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Volumen en el rango</span>
                    </div>

                    {/* KPI 2: Efectividad */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100/80 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efectividad Neta</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-600">{activeDrilldown.efectividad}%</span>
                        <span className="text-xs text-emerald-500 font-bold">de cierre</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold mt-2 uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {activeDrilldown.completadas} Completadas
                      </div>
                    </div>

                    {/* KPI 3: Promedio Visitas */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100/80 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promedio Visitas</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-indigo-600">{activeDrilldown.avgVisits}</span>
                        <span className="text-xs text-indigo-400 font-bold">visitas/ord</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Índice de reincidencia</span>
                    </div>

                    {/* KPI 4: Complejidad Baremo */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100/80 flex flex-col justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complejidad Promedio</span>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-amber-500">{activeDrilldown.avgBaremo}</span>
                        <span className="text-xs text-amber-500 font-bold">pts baremo</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold mt-2 uppercase">Carga técnica por orden</span>
                    </div>
                  </div>

                  {/* Right: Radar Chart (5 cols) */}
                  <div className="lg:col-span-5 bg-white p-5 rounded-2xl shadow-sm border border-slate-100/80 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 self-start">Huella Operativa</span>
                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={activeDrilldown.radarData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#475569', fontWeight: 'bold' }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                          <Radar name={activeDrilldown.name} dataKey="value" stroke="#6366f1" fill="#818cf8" fillOpacity={0.4} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* Search Bar for Drill-down Orders */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                  <div className="relative flex-1 min-w-[240px]">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                      <Search size={16} />
                    </span>
                    <input 
                      type="text"
                      placeholder="Filtrar órdenes dentro de esta categoría por Nº petición, técnico, comuna, dirección, RUT..."
                      value={drilldownSearch}
                      onChange={(e) => setDrilldownSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Orders List Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        <th className="p-4 whitespace-nowrap">N° Petición</th>
                        <th className="p-4 whitespace-nowrap">Técnico</th>
                        <th className="p-4 whitespace-nowrap">Comuna</th>
                        <th className="p-4 whitespace-nowrap">Actividad</th>
                        <th className="p-4 text-center whitespace-nowrap">Estado</th>
                        <th className="p-4 text-right whitespace-nowrap">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {activeDrilldown.orders
                        .filter(o => {
                          const query = drilldownSearch.toLowerCase().trim();
                          if (!query) return true;
                          return (
                            String(o['N° Petición'] || '').toLowerCase().includes(query) ||
                            String(o['Técnico'] || '').toLowerCase().includes(query) ||
                            String(o['Ciudad'] || '').toLowerCase().includes(query) ||
                            String(o['Subtipo Actividad'] || '').toLowerCase().includes(query) ||
                            String(o['Estado'] || '').toLowerCase().includes(query) ||
                            String(o['Dirección'] || '').toLowerCase().includes(query) ||
                            String(o['RUT'] || '').toLowerCase().includes(query)
                          );
                        })
                        .map((o, idx) => {
                          const petId = o['N° Petición'] || '';
                          const isExpanded = !!expandedRows[petId];
                          const visitsCount = o.Visitas || 1;

                          return (
                            <React.Fragment key={idx}>
                              <tr 
                                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                                onClick={() => toggleRowExpanded(petId)}
                              >
                                <td className="p-4 font-extrabold text-indigo-600 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-slate-400 select-none">
                                        {isExpanded ? '▼' : '▶'}
                                      </span>
                                      {o['N° Petición'] || '—'}
                                    </div>
                                    {o.RUT && (
                                      <span className="text-[10px] text-slate-400 font-semibold pl-4">
                                        RUT: {o.RUT}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div>
                                    <p className="font-bold text-slate-800">{o['Técnico'] || '—'}</p>
                                    <p className="text-[10px] text-slate-400 font-semibold">ID: {o['RECURSO'] || '—'}</p>
                                    {o.Cliente && (
                                      <p className="text-[10px] text-indigo-500 font-semibold truncate max-w-[200px]" title={o.Cliente}>
                                        Cli: {o.Cliente}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4 whitespace-nowrap">
                                  <div>
                                    <p className="text-slate-600 font-bold">{o['Ciudad'] || '—'}</p>
                                    {o.Dirección && (
                                      <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[180px]" title={o.Dirección}>
                                        {o.Dirección}
                                      </p>
                                    )}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <p className="text-slate-500 font-medium max-w-[200px] truncate" title={o['Subtipo Actividad']}>
                                      {o['Subtipo Actividad'] || '—'}
                                    </p>
                                    <div className="flex">
                                      <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                        visitsCount > 1 
                                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                                          : 'bg-slate-50 text-slate-500'
                                      }`}>
                                        {visitsCount} {visitsCount === 1 ? 'gestión' : 'gestiones (ver)'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    String(o.Estado || '').toLowerCase().includes('completad') || String(o.Estado || '').toLowerCase().includes('finalizad')
                                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                      : String(o.Estado || '').toLowerCase().includes('pendient') || String(o.Estado || '').toLowerCase().includes('iniciad')
                                        ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                        : 'bg-rose-50 text-rose-600 border border-rose-100'
                                  }`}>
                                    {o.Estado || '—'}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-black text-slate-800 whitespace-nowrap">{o['Pts Total'] ?? '—'}</td>
                              </tr>
                              
                              {/* Expanded timeline inside modal */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70">
                                  <td colSpan={6} className="p-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-100/80 shadow-inner space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                                          Historial de Gestiones en TOA
                                        </p>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                                          Total: {visitsCount} {visitsCount === 1 ? 'visita' : 'visitas'}
                                        </span>
                                      </div>
                                      
                                      {o.HistorialVisitas && o.HistorialVisitas.length > 0 ? (
                                        <div className="relative border-l-2 border-indigo-100 ml-2 pl-4 space-y-4 py-1">
                                          {o.HistorialVisitas.map((v, i) => (
                                            <div key={i} className="relative">
                                              <span className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border border-white ${
                                                v.estado.toLowerCase().includes('complet') ? 'bg-emerald-500' : v.estado.toLowerCase().includes('inici') || v.estado.toLowerCase().includes('pendien') ? 'bg-amber-500' : 'bg-rose-500'
                                              }`}></span>
                                              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/80 space-y-2">
                                                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-slate-800">{v.fecha}</span>
                                                    <span className="text-slate-300 font-medium">|</span>
                                                    <span className="text-slate-600 font-bold">Orden: {v.orden || o['N° Petición']}</span>
                                                  </div>
                                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    v.estado.toLowerCase().includes('complet') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : v.estado.toLowerCase().includes('inici') || v.estado.toLowerCase().includes('pendien') ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                                                  }`}>
                                                    {v.estado}
                                                  </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100/60">
                                                  {v.tecnico && (
                                                    <div>
                                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Técnico:</span> <span className="text-slate-700 font-bold">{v.tecnico}</span>
                                                    </div>
                                                  )}
                                                  {v.nombre && (
                                                    <div>
                                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Cliente:</span> <span className="text-slate-700 font-bold">{v.nombre}</span>
                                                    </div>
                                                  )}
                                                  {v.rut && (
                                                    <div>
                                                      <span className="text-slate-400 font-bold uppercase text-[9px]">RUT:</span> <span className="text-slate-700 font-bold">{v.rut}</span>
                                                    </div>
                                                  )}
                                                  {v.direccion && (
                                                    <div className="md:col-span-2">
                                                      <span className="text-slate-400 font-bold uppercase text-[9px]">Dirección:</span> <span className="text-slate-700 font-bold">{v.direccion}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400 italic font-medium pl-2">
                                          No se registran visitas previas en base de datos.
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-900 text-slate-400 flex items-center justify-between text-[10px] font-bold uppercase border-t border-slate-800">
                <span>Análisis de drill-down</span>
                <span>Sincronizado con base de datos</span>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
