import React, { useState, useEffect, useMemo } from 'react';
import telecomApi from '../telecomApi';
import { useAuth } from '../../auth/AuthContext';
import { Car, Truck, Search, Plus, MapPin, Wrench, AlertOctagon, Download, ClipboardCheck, ClipboardList, Clock, AlertTriangle, UserPlus, CheckCircle2, UploadCloud, Edit3, Trash2, Map as MapIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatRut, cleanRut } from '../../../utils/rutUtils';
import { useCheckPermission } from '../../../hooks/useCheckPermission';

// Import Slide-overs
import SlideOverFicha from './Panels/SlideOverFicha';
import SlideOverChecklist from './Panels/SlideOverChecklist';
import SlideOverSiniestros from './Panels/SlideOverSiniestros';
import SlideOverHistorial from './Panels/SlideOverHistorial';
import SlideOverCargaMasiva from './Panels/SlideOverCargaMasiva';
import SlideOverDocumentoPdf from './Panels/SlideOverDocumentoPdf';

// Función inteligente para normalizar y formatear patentes (chilenas)
const formatPatente = (p) => {
    if (!p) return '';
    const clean = String(p).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return clean.replace(/([A-Z]+)([0-9]+)/, '$1-$2');
};

export default function FlotaDashboard() {
  const { user } = useAuth();
  const { hasPermission } = useCheckPermission();
  const [vehiculos, setVehiculos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ufValue, setUfValue] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCard, setFilterCard] = useState(null);
  const [distFilter, setDistFilter] = useState({ category: null, value: null });
  const [columnFilters, setColumnFilters] = useState({ patente: '', vehiculo: '', contrato: '', conductor: '', estado: '', logistica: '', cupon: '', reemplazo: '' });
  const [selectedIds, setSelectedIds] = useState([]);

  const [activePanel, setActivePanel] = useState(null); // 'ficha', 'checklist', 'siniestro', 'historial', 'documento'
  const [selectedVehiculo, setSelectedVehiculo] = useState(null);
  const [selectedDocumento, setSelectedDocumento] = useState(null);
  const [checklistTipo, setChecklistTipo] = useState('Asignación');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resV, resT, resUf] = await Promise.all([
        telecomApi.get('/vehiculos'),
        telecomApi.get('/tecnicos/responsables-flota'),
        fetch('https://mindicador.cl/api/uf').then(res => res.json()).catch(() => null)
      ]);
      const vehiculosFormateados = resV.data.map(v => ({
        ...v,
        patente: formatPatente(v.patente)
      }));
      setVehiculos(vehiculosFormateados);
      setTecnicos(resT.data);
      if (resUf && resUf.serie && resUf.serie.length > 0) {
        setUfValue(resUf.serie[0].valor);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // KPIs
  const kpis = useMemo(() => {
    return {
      total: vehiculos.length,
      operativos: vehiculos.filter(v => v.estadoOperativo === 'Operativa').length,
      siniestros: vehiculos.filter(v => v.estadoOperativo === 'Siniestro').length,
      mantencion: vehiculos.filter(v => v.estadoOperativo === 'Mantencion').length,
      enTerreno: vehiculos.filter(v => v.estadoLogistico === 'En Terreno').length,
      enPatio: vehiculos.filter(v => v.estadoLogistico === 'En Patio').length
    };
  }, [vehiculos]);

  // Diccionario global de técnicos para mapeos
  const tecnicoDict = useMemo(() => new Map(tecnicos.map(t => [t.rutRaw || cleanRut(t.rut || ''), t])), [tecnicos]);

  // Distribución de asignaciones y flota
  const asignacionesStats = useMemo(() => {
    const stats = {
      cargos: {},
      estados: {},
      proyectos: {},
      clientes: {},
      proveedores: {}
    };

    vehiculos.forEach(v => {
      const proveedor = v.proveedor || 'Sin Proveedor';
      stats.proveedores[proveedor] = (stats.proveedores[proveedor] || 0) + 1;

      if (!v.asignadoA) return;
      const cRut = cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || '');
      const t = tecnicoDict.get(cRut);
      if (!t) return;

      const cargo = t.cargo || 'Sin Cargo';
      const estado = t.estadoCaptura || 'Desconocido';
      const proyecto = t.proyecto || 'Sin Proyecto';
      const cliente = t.cliente || 'Sin Cliente';

      const updateStat = (category, key) => {
        if (!stats[category][key]) {
          stats[category][key] = { total: 0, provs: {} };
        }
        stats[category][key].total += 1;
        stats[category][key].provs[proveedor] = (stats[category][key].provs[proveedor] || 0) + 1;
      };

      updateStat('cargos', cargo);
      updateStat('estados', estado);
      updateStat('proyectos', proyecto);
      updateStat('clientes', cliente);
    });

    const sortAndFormat = (obj) => {
      return Object.entries(obj)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([key, data]) => {
          const provsArray = Object.entries(data.provs)
            .sort((a, b) => b[1] - a[1])
            .map(([prov, count]) => ({ prov, count }));
          return [key, data.total, provsArray];
        });
    };

    const sortObj = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
      cargos: sortAndFormat(stats.cargos),
      estados: sortAndFormat(stats.estados),
      proyectos: sortAndFormat(stats.proyectos),
      clientes: sortAndFormat(stats.clientes),
      proveedores: sortObj(stats.proveedores)
    };
  }, [vehiculos, tecnicos]);

  // Filtering
  const filteredVehiculos = useMemo(() => {
    let result = vehiculos;

    if (filterCard) {
      if (filterCard === 'Operativos') result = result.filter(v => v.estadoOperativo === 'Operativa');
      else if (filterCard === 'Siniestros') result = result.filter(v => v.estadoOperativo === 'Siniestro');
      else if (filterCard === 'Mantencion') result = result.filter(v => v.estadoOperativo === 'Mantencion');
      else if (filterCard === 'En Terreno') result = result.filter(v => v.estadoLogistico === 'En Terreno');
      else if (filterCard === 'En Patio') result = result.filter(v => v.estadoLogistico === 'En Patio');
    }

    if (distFilter.category && distFilter.value) {
      result = result.filter(v => {
        if (distFilter.category === 'proveedores') {
          return (v.proveedor || 'Sin Proveedor') === distFilter.value;
        }

        if (!v.asignadoA) return false;
        const cRut = cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || '');
        const t = tecnicoDict.get(cRut);
        if (!t) return false;

        if (distFilter.category === 'clientes') return (t.cliente || 'Sin Cliente') === distFilter.value;
        if (distFilter.category === 'proyectos') return (t.proyecto || 'Sin Proyecto') === distFilter.value;
        if (distFilter.category === 'cargos') return (t.cargo || 'Sin Cargo') === distFilter.value;
        if (distFilter.category === 'estados') return (t.estadoCaptura || 'Desconocido') === distFilter.value;
        
        return true;
      });
    }

    if (Object.values(columnFilters).some(val => val !== '')) {
      result = result.filter(v => {
        const cPatente = (v.patente || '').toLowerCase();
        const cVehiculo = `${v.marca || ''} ${v.modelo || ''} ${v.anio || ''}`.toLowerCase();
        const cContrato = `${v.proveedor || ''} ${v.tipoContrato || ''}`.toLowerCase();
        
        let cConductor = '';
        if (v.asignadoA) {
          const t = tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''));
          cConductor = `${v.asignadoA.nombre || ''} ${t?.proyecto || ''} ${t?.zona || ''}`.toLowerCase();
        }
        
        const cEstado = (v.estadoOperativo || '').toLowerCase();
        const cLogistica = (v.estadoLogistico || '').toLowerCase();
        const cCupon = (v.cuponElectronico || 'Sin Cupón').toLowerCase();
        const cReemplazo = v.tieneReemplazo === 'SI' ? 'reemplazo' : 'titular';

        return (
          (!columnFilters.patente || cPatente.includes(columnFilters.patente.toLowerCase())) &&
          (!columnFilters.vehiculo || cVehiculo.includes(columnFilters.vehiculo.toLowerCase())) &&
          (!columnFilters.contrato || cContrato.includes(columnFilters.contrato.toLowerCase())) &&
          (!columnFilters.conductor || cConductor.includes(columnFilters.conductor.toLowerCase())) &&
          (!columnFilters.estado || cEstado === columnFilters.estado.toLowerCase()) &&
          (!columnFilters.logistica || cLogistica === columnFilters.logistica.toLowerCase()) &&
          (!columnFilters.cupon || cCupon === columnFilters.cupon.toLowerCase()) &&
          (!columnFilters.reemplazo || cReemplazo === columnFilters.reemplazo)
        );
      });
    }

    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    const cleanQ = q.replace(/[^a-z0-9]/g, ''); // Para búsqueda inteligente de patentes
    
    return result.filter(v => {
      const cleanPat = (v.patente || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanPat.includes(cleanQ) || 
        v.marca?.toLowerCase().includes(q) || 
        v.modelo?.toLowerCase().includes(q) ||
        v.asignadoA?.nombre?.toLowerCase().includes(q) ||
        v.asignadoA?.rut?.toLowerCase().includes(q)
    });
  }, [vehiculos, searchQuery, filterCard, distFilter, tecnicoDict, columnFilters]);

  // Export to Excel
  const handleExport = () => {
    const data = vehiculos.map(v => {
      const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
      const valorCLP = isUF ? (ufValue ? Math.round(v.valor * ufValue) : 'Pendiente UF') : (v.valor || 0);
      return {
        Patente: v.patente || '',
        Marca: v.marca || '',
        Modelo: v.modelo || '',
        Año: v.anio || '',
        Proveedor: v.proveedor || '',
        'Tipo Contrato': v.tipoContrato || '',
        Moneda: isUF ? 'UF' : 'CLP',
        'Valor Original': v.valor || 0,
        'Costo Mensual (CLP)': valorCLP,
        'Cupón Electrónico': v.cuponElectronico || 'Sin Cupón',
      'Número de Cupón': v.numeroCupon || '',
      'Estado Operativo': v.estadoOperativo || '',
      'Ubicación Logística': v.estadoLogistico || '',
      Zona: v.zona || 'Metropolitana',
      'Tiene Reemplazo': v.tieneReemplazo || 'NO',
      'Patente Reemplazo': v.patenteReemplazo || '',
      'Conductor Asignado (Nombre)': v.asignadoA?.nombre || v.asignadoA?.nombres || 'Sin Asignar',
      'RUT Conductor': formatRut(v.asignadoA?.rut || v.asignadoA?.rutRaw || '') || 'Sin Asignar',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Flota");
    XLSX.writeFile(wb, `Flota_Vehiculos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Actions
  const openFicha = (vehiculo = null) => {
    setSelectedVehiculo(vehiculo);
    setActivePanel('ficha');
  };

  const openChecklist = (vehiculo, tipo) => {
    setSelectedVehiculo(vehiculo);
    setChecklistTipo(tipo);
    setActivePanel('checklist');
  };

  const openSiniestro = (vehiculo) => {
    setSelectedVehiculo(vehiculo);
    setActivePanel('siniestro');
  };

  const openHistorial = (vehiculo) => {
    setSelectedVehiculo(vehiculo);
    setActivePanel('historial');
  };

  const closePanel = () => {
    setActivePanel(null);
    setSelectedVehiculo(null);
    setSelectedDocumento(null);
  };

  const deleteVehiculo = async (id, patente) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el vehículo ${patente} permanentemente?`)) return;
    try {
      await telecomApi.delete(`/vehiculos/${id}`);
      fetchData();
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    } catch (e) {
      alert(`Error al eliminar: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar ${selectedIds.length} vehículos seleccionados permanentemente?`)) return;
    try {
      await telecomApi.post('/vehiculos/bulk-delete', { ids: selectedIds });
      setSelectedIds([]);
      fetchData();
    } catch (e) {
      alert(`Error en la eliminación masiva: ${e.response?.data?.error || e.message}`);
    }
  };

  const handleSuccess = (documentoGenerado = null) => {
    fetchData(); // Refresh data after any successful action
    if (documentoGenerado) {
      // Si el submit retornó un documento, lo mostramos para PDF
      setSelectedDocumento(documentoGenerado);
      setActivePanel('documento');
    } else {
      closePanel();
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredVehiculos.map(v => v._id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Status Colors
  const getOpColor = (status) => {
    if (status === 'Operativa') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'Siniestro') return 'bg-red-100 text-red-700 border-red-200';
    if (status === 'Mantencion') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getLogColor = (status) => {
    if (status === 'En Terreno') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'En Patio') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (status === 'Taller') return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="p-6 md:p-10 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-200/50 text-white">
              <Truck size={28} />
            </div>
            Centro de Comando Flota
          </h1>
          <p className="text-slate-500 font-medium mt-2 text-sm">Gestión integral de vehículos, asignaciones y siniestros en tiempo real.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
            <Download size={18} className="text-slate-400" /> Exportar Excel
          </button>
          <button onClick={() => setActivePanel('carga')} className="px-5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2">
            <UploadCloud size={18} className="text-emerald-500" /> Carga Masiva
          </button>
          <button onClick={() => openFicha(null)} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2">
            <Plus size={20} /> Nuevo Vehículo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div onClick={() => setFilterCard(null)} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === null ? 'border-slate-800 ring-2 ring-slate-400 shadow-md scale-[1.02]' : 'border-slate-200 shadow-sm'} bg-gradient-to-br from-slate-800 to-slate-900 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Truck size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.total}</span>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1 z-10">Total Parque</span>
        </div>
        <div onClick={() => setFilterCard('Operativos')} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === 'Operativos' ? 'border-emerald-500 ring-2 ring-emerald-300 shadow-md scale-[1.02]' : 'border-emerald-100 shadow-sm'} bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle2 size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.operativos}</span>
          <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest mt-1 z-10">Operativos</span>
        </div>
        <div onClick={() => setFilterCard('En Terreno')} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === 'En Terreno' ? 'border-blue-500 ring-2 ring-blue-300 shadow-md scale-[1.02]' : 'border-blue-100 shadow-sm'} bg-gradient-to-br from-blue-400 to-blue-600 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><MapPin size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.enTerreno}</span>
          <span className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-1 z-10">En Terreno</span>
        </div>
        <div onClick={() => setFilterCard('En Patio')} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === 'En Patio' ? 'border-indigo-500 ring-2 ring-indigo-300 shadow-md scale-[1.02]' : 'border-indigo-100 shadow-sm'} bg-gradient-to-br from-indigo-400 to-indigo-600 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><MapIcon size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.enPatio}</span>
          <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest mt-1 z-10">En Patio</span>
        </div>
        <div onClick={() => setFilterCard('Mantencion')} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === 'Mantencion' ? 'border-amber-500 ring-2 ring-amber-300 shadow-md scale-[1.02]' : 'border-amber-100 shadow-sm'} bg-gradient-to-br from-amber-400 to-amber-500 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Wrench size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.mantencion}</span>
          <span className="text-[10px] font-bold text-amber-100 uppercase tracking-widest mt-1 z-10">En Taller</span>
        </div>
        <div onClick={() => setFilterCard('Siniestros')} className={`relative overflow-hidden p-5 rounded-2xl border ${filterCard === 'Siniestros' ? 'border-red-500 ring-2 ring-red-300 shadow-md scale-[1.02]' : 'border-red-100 shadow-sm'} bg-gradient-to-br from-red-400 to-red-600 text-white flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group`}>
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><AlertOctagon size={40}/></div>
          <span className="text-4xl font-black drop-shadow-md z-10">{kpis.siniestros}</span>
          <span className="text-[10px] font-bold text-red-100 uppercase tracking-widest mt-1 z-10">Siniestros</span>
        </div>
      </div>

      {/* KPIs Secundarios: Distribución */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { 
            id: 'proveedores', title: 'Por Proveedor (Flota)', data: asignacionesStats.proveedores, 
            theme: {
              cardBorder: 'border-slate-200',
              headerBg: 'bg-slate-100',
              headerText: 'text-slate-700',
              itemHoverBg: 'hover:bg-slate-50',
              itemHoverBorder: 'hover:border-slate-300',
              itemSelectedBg: 'bg-slate-100',
              itemSelectedBorder: 'border-slate-400',
              textSelected: 'text-slate-900',
              badgeBg: 'bg-slate-300',
              badgeText: 'text-slate-900'
            }
          },
          { 
            id: 'clientes', title: 'Por Cliente', data: asignacionesStats.clientes, 
            theme: {
              cardBorder: 'border-indigo-200',
              headerBg: 'bg-indigo-50',
              headerText: 'text-indigo-700',
              itemHoverBg: 'hover:bg-indigo-50/50',
              itemHoverBorder: 'hover:border-indigo-300',
              itemSelectedBg: 'bg-indigo-100',
              itemSelectedBorder: 'border-indigo-400',
              textSelected: 'text-indigo-900',
              badgeBg: 'bg-indigo-200',
              badgeText: 'text-indigo-900'
            }
          },
          { 
            id: 'proyectos', title: 'Por Proyecto', data: asignacionesStats.proyectos, 
            theme: {
              cardBorder: 'border-emerald-200',
              headerBg: 'bg-emerald-50',
              headerText: 'text-emerald-700',
              itemHoverBg: 'hover:bg-emerald-50/50',
              itemHoverBorder: 'hover:border-emerald-300',
              itemSelectedBg: 'bg-emerald-100',
              itemSelectedBorder: 'border-emerald-400',
              textSelected: 'text-emerald-900',
              badgeBg: 'bg-emerald-200',
              badgeText: 'text-emerald-900'
            }
          },
          { 
            id: 'cargos', title: 'Por Cargo', data: asignacionesStats.cargos, 
            theme: {
              cardBorder: 'border-amber-200',
              headerBg: 'bg-amber-50',
              headerText: 'text-amber-700',
              itemHoverBg: 'hover:bg-amber-50/50',
              itemHoverBorder: 'hover:border-amber-300',
              itemSelectedBg: 'bg-amber-100',
              itemSelectedBorder: 'border-amber-400',
              textSelected: 'text-amber-900',
              badgeBg: 'bg-amber-200',
              badgeText: 'text-amber-900'
            }
          },
          { 
            id: 'estados', title: 'Por Estado', data: asignacionesStats.estados, 
            theme: {
              cardBorder: 'border-sky-200',
              headerBg: 'bg-sky-50',
              headerText: 'text-sky-700',
              itemHoverBg: 'hover:bg-sky-50/50',
              itemHoverBorder: 'hover:border-sky-300',
              itemSelectedBg: 'bg-sky-100',
              itemSelectedBorder: 'border-sky-400',
              textSelected: 'text-sky-900',
              badgeBg: 'bg-sky-200',
              badgeText: 'text-sky-900'
            }
          }
        ].map((section, i) => {
          const t = section.theme;
          return (
            <div key={i} className={`bg-white p-4 rounded-2xl border ${t.cardBorder} shadow-sm flex flex-col h-[200px] overflow-y-auto custom-scrollbar relative`}>
              <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 sticky top-0 z-10 p-2 -mx-2 -mt-2 rounded-lg border-b ${t.headerBg} ${t.headerText} flex justify-between items-center shadow-sm`}>
                {section.title}
                {distFilter.category === section.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDistFilter({ category: null, value: null }); }} 
                    className="text-slate-600 hover:text-slate-900 text-[9px] px-2 py-0.5 bg-white/60 hover:bg-white rounded-md transition-colors shadow-sm"
                  >
                    Limpiar
                  </button>
                )}
              </h3>
              {section.data.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs font-bold text-slate-300">Sin asignaciones</div>
              ) : (
                <div className="space-y-1.5">
                  {section.data.map((item, idx) => {
                    const key = item[0];
                    const count = item[1];
                    const provsArray = item[2]; // undefined for proveedores
                    
                    const isSelected = distFilter.category === section.id && distFilter.value === key;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => setDistFilter({ category: section.id, value: key })}
                        className={`flex flex-col border p-2 rounded-xl cursor-pointer transition-all duration-200 group ${isSelected ? `${t.itemSelectedBg} ${t.itemSelectedBorder} shadow-sm` : `border-transparent ${t.itemHoverBg} ${t.itemHoverBorder}`}`}
                      >
                      <div className="flex justify-between items-center">
                        <span className={`text-[11px] font-bold truncate pr-2 transition-colors ${isSelected ? t.textSelected : 'text-slate-700 group-hover:text-slate-900'}`} title={key}>{key}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md transition-colors ${isSelected ? `${t.badgeBg} ${t.badgeText}` : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'}`}>{count}</span>
                      </div>
                      {provsArray && provsArray.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {provsArray.map((p, pidx) => (
                            <span key={pidx} className={`text-[9px] flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-md border transition-colors ${isSelected ? 'bg-white/80 border-white text-slate-700' : 'bg-white border-slate-100 text-slate-500'}`}>
                              <span className={`px-1 rounded-sm text-[8px] ${isSelected ? `${t.badgeBg} ${t.badgeText}` : 'bg-slate-100 text-slate-600'}`}>{p.count}</span>
                              {p.prov}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col h-[600px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full max-w-xl">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por patente, marca, conductor..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium text-sm focus:border-blue-500 outline-none shadow-sm"
              />
            </div>
            <div className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap bg-white px-3 py-2.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
              <span className={`text-sm ${filteredVehiculos.length !== vehiculos.length ? 'text-blue-600' : 'text-slate-600'}`}>
                {filteredVehiculos.length}
              </span> 
              <span>/ {vehiculos.length} Vehículos</span>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-4 bg-slate-800 text-white px-4 py-2 rounded-xl animate-in fade-in slide-in-from-right-4 shadow-lg shadow-slate-200">
              <span className="text-sm font-bold">{selectedIds.length} seleccionados</span>
              <div className="w-px h-5 bg-slate-600"></div>
              <button onClick={handleBulkDelete} className="text-xs font-black text-red-400 uppercase tracking-widest hover:text-red-300 transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Eliminar Seleccionados
              </button>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <table className="w-full min-w-[1000px] lg:min-w-full text-left border-collapse">
              <thead className="bg-slate-100/80 sticky top-0 z-10 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <tr>
                  <th className="py-4 px-6 border-b border-slate-200 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredVehiculos.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Patente</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Vehículo</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Contrato / Proveedor</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Valor Leasing</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">Cupón / Tarjeta</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">Conductor & Zona</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">Estado Op. / Reemplazo</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-center">Logística</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 text-right">Acciones</th>
                </tr>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="py-2 px-6"></th>
                  <th className="py-2 px-6">
                    <input type="text" placeholder="Filtrar patente..." className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white placeholder-slate-400" value={columnFilters.patente} onChange={e => setColumnFilters(p => ({...p, patente: e.target.value}))} />
                  </th>
                  <th className="py-2 px-6">
                    <input type="text" placeholder="Filtrar vehículo..." className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white placeholder-slate-400" value={columnFilters.vehiculo} onChange={e => setColumnFilters(p => ({...p, vehiculo: e.target.value}))} />
                  </th>
                  <th className="py-2 px-6">
                    <input type="text" placeholder="Filtrar contrato/prov..." className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white placeholder-slate-400" value={columnFilters.contrato} onChange={e => setColumnFilters(p => ({...p, contrato: e.target.value}))} />
                  </th>
                  <th className="py-2 px-6"></th>
                  <th className="py-2 px-6 text-center">
                    <select className="w-full max-w-[110px] mx-auto text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white cursor-pointer" value={columnFilters.cupon} onChange={e => setColumnFilters(p => ({...p, cupon: e.target.value}))}>
                      <option value="">Todos</option>
                      <option value="Cupón Titular">Cupón Titular</option>
                      <option value="Cupón Reemplazo">Cupón Reemplazo</option>
                      <option value="Sin Cupón">Sin Cupón</option>
                    </select>
                  </th>
                  <th className="py-2 px-6">
                    <input type="text" placeholder="Filtrar conductor..." className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white placeholder-slate-400" value={columnFilters.conductor} onChange={e => setColumnFilters(p => ({...p, conductor: e.target.value}))} />
                  </th>
                  <th className="py-2 px-6 text-center">
                    <div className="flex flex-col gap-1.5">
                      <select className="w-full max-w-[120px] mx-auto text-[11px] px-2 py-1 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white cursor-pointer" value={columnFilters.estado} onChange={e => setColumnFilters(p => ({...p, estado: e.target.value}))}>
                        <option value="">Est. Operativo</option>
                        <option value="operativa">Operativa</option>
                        <option value="siniestro">Siniestro</option>
                        <option value="mantencion">Mantención</option>
                      </select>
                      <select className="w-full max-w-[120px] mx-auto text-[11px] px-2 py-1 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white cursor-pointer" value={columnFilters.reemplazo} onChange={e => setColumnFilters(p => ({...p, reemplazo: e.target.value}))}>
                        <option value="">Tipología</option>
                        <option value="titular">Titular</option>
                        <option value="reemplazo">Reemplazo</option>
                      </select>
                    </div>
                  </th>
                  <th className="py-2 px-6 text-center">
                    <select className="w-full max-w-[110px] mx-auto text-[11px] px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-400 font-medium text-slate-700 bg-white cursor-pointer" value={columnFilters.logistica} onChange={e => setColumnFilters(p => ({...p, logistica: e.target.value}))}>
                      <option value="">Todos</option>
                      <option value="en terreno">En Terreno</option>
                      <option value="en patio">En Patio</option>
                      <option value="en taller">En Taller</option>
                    </select>
                  </th>
                  <th className="py-2 px-6 text-right">
                    {(Object.values(columnFilters).some(v => v !== '')) && (
                      <button onClick={() => setColumnFilters({ patente: '', vehiculo: '', contrato: '', conductor: '', estado: '', logistica: '', cupon: '', reemplazo: '' })} className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors shadow-sm border border-red-100">Limpiar</button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredVehiculos.map((v) => (
                  <tr key={v._id} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(v._id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="py-4 px-6 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        checked={selectedIds.includes(v._id)}
                        onChange={() => toggleSelectOne(v._id)}
                      />
                    </td>
                    <td className="py-4 px-6">
                      <button onClick={() => openFicha(v)} className="inline-flex items-center gap-2 bg-white border-2 border-slate-300 shadow-sm text-slate-800 px-3 py-1.5 rounded-lg font-black tracking-widest hover:border-blue-500 hover:text-blue-700 transition-all uppercase group-hover:shadow-md">
                        <div className="w-1.5 h-4 bg-slate-800 rounded-full group-hover:bg-blue-600 transition-colors"></div>
                        {v.patente}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800 text-sm">{v.marca} {v.modelo}</div>
                      <div className="text-xs text-slate-400 font-medium">Año: {v.anio || 'N/A'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800 text-sm truncate max-w-[150px]" title={v.proveedor || 'Sin Proveedor'}>{v.proveedor || 'Sin Proveedor'}</div>
                      <div className="text-xs text-slate-400 font-medium truncate">{v.tipoContrato}</div>
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        const isUF = v.moneda === 'UF' || (v.valor > 0 && v.valor < 100);
                        if (isUF) {
                          const valorCLP = ufValue ? Math.round(v.valor * ufValue) : null;
                          return (
                            <div>
                              <div className="font-black text-emerald-600 text-sm">
                                {valorCLP ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(valorCLP) : 'Calculando...'}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                UF {v.valor?.toLocaleString('es-CL') || 0}
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div className="font-black text-emerald-600 text-sm">
                              {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v.valor || 0)}
                            </div>
                          );
                        }
                      })()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="font-bold text-slate-800 text-sm">
                        {v.cuponElectronico !== 'Sin Cupón' ? <span className="text-purple-600">{v.cuponElectronico}</span> : <span className="text-slate-400">Sin Cupón</span>}
                      </div>
                      {v.numeroCupon && <div className="text-[10px] text-slate-400 font-medium mt-0.5">Nº: {v.numeroCupon}</div>}
                    </td>
                    <td className="py-4 px-6">
                      {v.asignadoA ? (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500 uppercase shadow-inner border border-slate-200 shrink-0">
                            {(() => {
                              const liveName = tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''))?.fullName || tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''))?.nombre || v.asignadoA.nombre || v.asignadoA.nombres || 'User';
                              return liveName.substring(0, 2).toUpperCase();
                            })()}
                          </div>
                          <div>
                            <span className="text-[11px] font-black text-slate-800 tracking-tight block leading-tight">
                              {tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''))?.fullName || tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''))?.nombre || v.asignadoA.nombre || v.asignadoA.nombres}
                            </span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block font-mono">
                              RUT: {formatRut(v.asignadoA.rut || v.asignadoA.rutRaw || '') || 'N/A'}
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              Proyecto: {tecnicoDict.get(cleanRut(v.asignadoA.rutRaw || v.asignadoA.rut || ''))?.proyecto || 'Sin Proyecto'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5"><MapPin size={10} className="inline mr-1"/>{v.zona || 'Metropolitana'}</div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md mb-1 inline-block uppercase tracking-widest border border-slate-200">Sin Asignar</span>
                          <div className="text-[10px] text-slate-400 font-medium mt-1"><MapPin size={10} className="inline mr-1"/>{v.zona || 'Metropolitana'}</div>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${getOpColor(v.estadoOperativo)}`}>
                          {v.estadoOperativo === 'Operativa' && <CheckCircle2 size={12} />}
                          {v.estadoOperativo === 'Siniestro' && <AlertOctagon size={12} />}
                          {v.estadoOperativo === 'Mantencion' && <Wrench size={12} />}
                          {v.estadoOperativo?.toUpperCase()}
                        </span>
                        {v.tieneReemplazo === 'SI' && v.patenteReemplazo && (
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                            Rmplz: {v.patenteReemplazo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${getLogColor(v.estadoLogistico)}`}>
                        {v.estadoLogistico?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                        {(hasPermission('flota_vehiculos', 'crear') || hasPermission('flota_vehiculos', 'editar')) && v.estadoOperativo !== 'Siniestro' && (
                          <>
                            {v.asignadoA && (
                              <button onClick={() => openChecklist(v, 'Recepción')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg tooltip-btn" title="Recepcionar Vehículo (Trabajador)">
                                <ClipboardCheck size={18} />
                              </button>
                            )}
                            {!v.asignadoA && (
                              <>
                                <button onClick={() => openChecklist(v, 'Asignación')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg tooltip-btn" title="Asignar Vehículo (Checklist Entrega)">
                                  <UserPlus size={18} />
                                </button>
                                <button onClick={() => openChecklist(v, 'Recepción')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg tooltip-btn" title="Recepcionar Vehículo (Taller/Proveedor)">
                                  <ClipboardCheck size={18} />
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {(hasPermission('flota_vehiculos', 'crear') || hasPermission('flota_vehiculos', 'editar')) && (
                          <button onClick={() => openSiniestro(v)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg tooltip-btn" title="Reportar Siniestro">
                            <AlertTriangle size={18} />
                          </button>
                        )}
                        {hasPermission('flota_vehiculos', 'ver') && (
                          <button onClick={() => openHistorial(v)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg tooltip-btn" title="Ver Historial (Timeline)">
                            <Clock size={18} />
                          </button>
                        )}
                        
                        {(hasPermission('flota_vehiculos', 'editar') || hasPermission('flota_vehiculos', 'eliminar')) && (
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                        )}
                        
                        {hasPermission('flota_vehiculos', 'editar') && (
                          <button onClick={() => openFicha(v)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg tooltip-btn" title="Editar Ficha">
                            <Edit3 size={18} />
                          </button>
                        )}
                        {hasPermission('flota_vehiculos', 'eliminar') && (
                          <button onClick={() => deleteVehiculo(v._id, v.patente)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg tooltip-btn" title="Eliminar Vehículo">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RENDER ACTIVE PANELS */}
      {activePanel === 'ficha' && (
        <SlideOverFicha vehiculo={selectedVehiculo} tecnicos={tecnicos} onClose={closePanel} onSuccess={handleSuccess} />
      )}
      {activePanel === 'checklist' && (
        <SlideOverChecklist vehiculo={selectedVehiculo} tecnicos={tecnicos} tipo={checklistTipo} onClose={closePanel} onSuccess={handleSuccess} />
      )}
      {activePanel === 'siniestro' && (
        <SlideOverSiniestros vehiculo={selectedVehiculo} tecnicos={tecnicos} onClose={closePanel} onSuccess={handleSuccess} />
      )}
      {activePanel === 'historial' && (
        <SlideOverHistorial vehiculo={selectedVehiculo} onClose={closePanel} />
      )}
      {activePanel === 'carga' && (
        <SlideOverCargaMasiva onClose={closePanel} onSuccess={handleSuccess} />
      )}
      {activePanel === 'documento' && (
        <SlideOverDocumentoPdf 
          documento={selectedDocumento} 
          vehiculo={selectedVehiculo} 
          onClose={closePanel} 
        />
      )}

    </div>
  );
}
