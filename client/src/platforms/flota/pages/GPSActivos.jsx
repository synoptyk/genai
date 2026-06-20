import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import * as XLSX from 'xlsx';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Battery, Navigation, Search, User, Clock, RefreshCw, Loader2,
  FileDown, AlertTriangle, ShieldCheck, MapIcon,
  Crosshair, Signal, ChevronRight, Smartphone, Laptop, Tablet, Radio,
  Settings, Plus, X, Save, Trash2
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import API_URL from '../../../config';

// --- ESTILOS CSS INYECTADOS PARA EFECTOS DE PULSO ---
const pulsarStyles = `
  @keyframes pulsar {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(2.5); opacity: 0; }
  }
  .gps-pulse {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.4);
    animation: pulsar 2s infinite;
    z-index: -1;
  }
  .gps-pulse-alert {
    background: rgba(239, 68, 68, 0.4);
    animation: pulsar 1.5s infinite;
  }
  .leaflet-popup-content-wrapper {
    border-radius: 16px;
    padding: 0;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(226, 232, 240, 0.8);
  }
  .leaflet-popup-content {
    margin: 0;
    width: 280px !important;
  }
  .leaflet-container {
    font-family: 'Inter', sans-serif;
  }
`;

// --- CONFIGURACIÓN DE ICONOS L LEAFLET ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Generador de Iconos Personalizados para Activos
const createAssetIcon = (type) => {
  const img = type === 'ok'
    ? 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png' // Puntero azul/normal
    : 'https://cdn-icons-png.flaticon.com/512/564/564619.png'; // Alerta roja

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        <div class="gps-pulse ${type === 'alert' ? 'gps-pulse-alert' : ''}"></div>
        <img src="${img}" style="width: 100%; height: 100%; position: relative; z-index: 2; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -45]
  });
};

const activoIcon = createAssetIcon('ok');
const alertIcon = createAssetIcon('alert');

// Controlador del Mapa para enfoque suave
const MapController = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || map.getZoom(), {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [center, zoom, map]);
  return null;
};

const getAssetIcon = (tipoActivo) => {
  switch (tipoActivo) {
    case 'CELULAR': return <Smartphone size={16} />;
    case 'NOTEBOOK': return <Laptop size={16} />;
    case 'TABLET': return <Tablet size={16} />;
    default: return <Radio size={16} />;
  }
};

const GPSActivos = () => {
  const { user } = useAuth();
  const [activos, setActivos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [mapType, setMapType] = useState('light');

  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos'); // todos, online, offline

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('crear'); // 'crear' o 'editar'
  const [formActivo, setFormActivo] = useState({ _id: null, tipoActivo: 'CELULAR', identificador: '', modelo: '', numeroCelular: '', asignadoA: '', estado: 'ACTIVO' });
  
  const [busquedaEmpleado, setBusquedaEmpleado] = useState('');
  const [mostrarDropdownEmpleados, setMostrarDropdownEmpleados] = useState(false);

  const empleadosFiltradosList = useMemo(() => {
    const filtrados = empleados.filter(emp => {
      const cargo = (emp.cargo || '').toLowerCase();
      // Excluir gerencia
      if (cargo.includes('gerencia') || cargo.includes('gerente') || cargo.includes('maestro') || cargo.includes('ceo') || cargo.includes('director')) return false;
      
      const termino = busquedaEmpleado.toLowerCase();
      const nombreCompleto = (emp.name || `${emp.nombres || ''} ${emp.apellidos || ''}`).toLowerCase();
      return nombreCompleto.includes(termino) || cargo.includes(termino);
    });

    // Agrupar por cargo
    const grupos = {};
    filtrados.forEach(emp => {
      const cargo = emp.cargo || 'Sin Cargo';
      if (!grupos[cargo]) grupos[cargo] = [];
      grupos[cargo].push(emp);
    });
    
    return Object.keys(grupos).sort().map(cargo => ({
      cargo,
      empleados: grupos[cargo].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }));
  }, [empleados, busquedaEmpleado]);

  const defaultCenter = [-33.4489, -70.6693];
  const [viewState, setViewState] = useState({ center: defaultCenter, zoom: 12 });

  // Fetch de Activos desde API
  const fetchActivos = useCallback(async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_URL}/api/flota/gps-activos`, config);
      if (Array.isArray(res.data)) {
        setActivos(res.data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error obteniendo GPS Activos:", error);
    }
  }, [user.token]);

  // Actualización automática (SSE + Polling de Respaldo)
  useEffect(() => {
    fetchActivos();
    fetchEmpleados();
    
    // Conexión SSE para recibir actualizaciones de GPS en tiempo real
    const eventSource = new EventSource(`${API_URL}/api/flota/gps-activos/stream?token=${user.token}`);
    
    eventSource.onmessage = (event) => {
      try {
        const nuevoDato = JSON.parse(event.data);
        setActivos(prev => {
          const index = prev.findIndex(a => a.identificador === nuevoDato.identificador);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = nuevoDato;
            return updated;
          }
          return [nuevoDato, ...prev];
        });
      } catch (err) {
        console.error("Error parseando SSE GPS:", err);
      }
    };

    const interval = setInterval(fetchActivos, 60000); // Polling de respaldo cada 60s
    
    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, [fetchActivos, user.token]);

  const fetchEmpleados = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const res = await axios.get(`${API_URL}/api/flota/gps-activos/users`, config);
      setEmpleados(res.data);
    } catch (e) { console.error('Error fetching users', e); }
  };

  // Funciones CRUD Modal
  const openCrear = () => {
    setModalMode('crear');
    setFormActivo({ _id: null, tipoActivo: 'CELULAR', identificador: '', modelo: '', numeroCelular: '', asignadoA: '', estado: 'ACTIVO' });
    setIsModalOpen(true);
  };

  const openEditar = (activo) => {
    setModalMode('editar');
    setFormActivo({
      _id: activo._id,
      tipoActivo: activo.tipoActivo || 'CELULAR',
      identificador: activo.identificador || '',
      modelo: activo.productoRef ? (activo.productoRef.modelo || activo.modelo) : activo.modelo || '',
      numeroCelular: activo.productoRef ? (activo.productoRef.numeroCelular || activo.numeroCelular) : activo.numeroCelular || '',
      asignadoA: activo.asignadoA ? activo.asignadoA._id : '',
      estado: activo.estado || 'ACTIVO'
    });
    setIsModalOpen(true);
  };

  const saveActivo = async (e) => {
    e.preventDefault();
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const payload = { ...formActivo, asignadoA: formActivo.asignadoA || null };
      
      if (modalMode === 'crear') {
        await axios.post(`${API_URL}/api/flota/gps-activos/admin`, payload, config);
      } else {
        await axios.put(`${API_URL}/api/flota/gps-activos/admin/${formActivo._id}`, payload, config);
      }
      setIsModalOpen(false);
      fetchActivos();
    } catch (error) {
      alert(error.response?.data?.error || 'Error al guardar el activo');
    }
  };

  const deleteActivo = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar permanentemente este activo del mapa?')) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`${API_URL}/api/flota/gps-activos/admin/${id}`, config);
      setIsModalOpen(false);
      fetchActivos();
    } catch (error) {
      alert('Error al eliminar');
    }
  };

  // Exportar Excel
  const descargarReporte = () => {
    if (activos.length === 0) return alert("Sin datos para exportar");
    const dataExport = activos.map(v => ({
      "Asignado A": v.asignadoA ? `${v.asignadoA.nombres || ''} ${v.asignadoA.apellidos || ''}` : 'Sin Asignar',
      "Tipo Activo": v.tipoActivo,
      "Identificador / IMEI": v.identificador,
      "Modelo": v.modelo,
      "Conexión": v.conexion,
      "Batería (%)": v.bateria,
      "Estado": v.estado,
      "Último Reporte": new Date(v.timestamp).toLocaleString(),
      "Ubicación (Lat, Lng)": `${v.latitud}, ${v.longitud}`
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Activos_GPS");
    XLSX.writeFile(wb, `GPS_Activos_Reporte_${Date.now()}.xlsx`);
  };

  // Filtrado de Activos
  const activosFiltrados = useMemo(() => {
    return activos.filter(v => {
      const asignadoNombre = v.asignadoA ? `${v.asignadoA.nombres} ${v.asignadoA.apellidos}` : 'sin asignar';
      const matchTexto =
        (v.identificador || '').toLowerCase().includes(textoBusqueda.toLowerCase()) ||
        asignadoNombre.toLowerCase().includes(textoBusqueda.toLowerCase()) ||
        (v.modelo || '').toLowerCase().includes(textoBusqueda.toLowerCase());

      const minutesSince = v.timestamp ? Math.floor((new Date() - new Date(v.timestamp)) / 60000) : 999;
      const isOffline = minutesSince > 10;

      if (filtroEstado === 'online' && isOffline) return false;
      if (filtroEstado === 'offline' && !isOffline) return false;

      return matchTexto;
    });
  }, [activos, textoBusqueda, filtroEstado]);

  const countOnline = useMemo(() => activos.filter(v => {
    const minutesSince = v.timestamp ? Math.floor((new Date() - new Date(v.timestamp)) / 60000) : 999;
    return minutesSince <= 10;
  }).length, [activos]);

  const countOffline = activos.length - countOnline;

  const getTileLayer = () => {
    switch (mapType) {
      case 'satellite': return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case 'dark': return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      case 'light': default: return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    }
  };

  const handleSelectActivo = (activo) => {
    setSeleccionado(activo);
    if (activo.latitud && activo.longitud) {
      setViewState({ center: [activo.latitud, activo.longitud], zoom: 16 });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    await fetchActivos();
    setTimeout(() => { setSyncing(false); }, 1000);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 w-full relative bg-slate-50/50 rounded-[2rem] overflow-hidden">
      <style>{pulsarStyles}</style>

      {/* BOTONES HUD SOBRE EL MAPA */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col xl:flex-row justify-end items-end xl:items-center gap-4 pointer-events-none">
        <div className="flex flex-wrap gap-2 items-center justify-end bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-white shadow-xl shadow-slate-200/50 pointer-events-auto">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['todos', 'online', 'offline'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroEstado(tipo)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${filtroEstado === tipo ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tipo === 'online' ? `Online (${countOnline})` : tipo === 'offline' ? `Offline (${countOffline})` : `Todos`}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setMapType('light')} className={`p-2 rounded-lg transition-all ${mapType === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`} title="Mapa Claro"><MapIcon size={16} /></button>
            <button onClick={() => setMapType('satellite')} className={`p-2 rounded-lg transition-all ${mapType === 'satellite' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`} title="Satélite"><Crosshair size={16} /></button>
            <button onClick={() => setMapType('dark')} className={`p-2 rounded-lg transition-all ${mapType === 'dark' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`} title="Modo Oscuro"><ShieldCheck size={16} /></button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <button
            onClick={openCrear}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 border border-indigo-200 transition-all active:scale-95"
          >
            <Settings size={14} /> GESTIONAR
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-75 disabled:shadow-none"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} SYNC
          </button>

          <button onClick={descargarReporte} className="bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 p-2 rounded-xl border border-slate-200 transition-colors" title="Descargar Excel"><FileDown size={18} /></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-full relative z-0">
        {/* PANEL LATERAL DE ACTIVOS */}
        <div className="w-full lg:w-96 bg-white border-r border-slate-100 flex flex-col z-20 shadow-xl shadow-slate-200/50">
          <div className="p-6 pb-2">
            
            {/* TÍTULO Y ESTADO */}
            <div className="mb-6">
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mb-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                GPS Activos
              </h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <Signal size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-500">EN LINEA</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <RefreshCw size={12} className="text-indigo-500" />
                  <span className="text-[10px] font-bold text-slate-500">10s</span>
                </div>
              </div>
            </div>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Buscar empleado, IMEI, equipo..."
                className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:border-indigo-200 rounded-2xl py-3 pl-11 pr-4 text-slate-600 font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                value={textoBusqueda}
                onChange={e => setTextoBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {loading && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="text-xs font-bold uppercase tracking-wide">Cargando activos...</span>
              </div>
            )}

            {!loading && activosFiltrados.length === 0 && (
              <div className="text-center py-12 px-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mx-2">
                <p className="text-slate-400 font-bold text-xs uppercase">No se encontraron equipos registrados</p>
              </div>
            )}

            {activosFiltrados.map((v) => {
              const minutesSince = Math.floor((new Date() - new Date(v.timestamp)) / 60000);
              const isOffline = minutesSince > 10;

              return (
                <div
                  key={v._id}
                  onClick={() => handleSelectActivo(v)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden ${seleccionado?._id === v._id
                    ? 'bg-indigo-50 border-indigo-200 shadow-md transform scale-[1.02]'
                    : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${!isOffline ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                        {getAssetIcon(v.tipoActivo)}
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-tight truncate w-32">
                          {v.asignadoA ? (v.asignadoA.name || `${v.asignadoA.nombres || ''} ${v.asignadoA.apellidos || ''}`) : 'SIN ASIGNAR'}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400">
                          {v.productoRef ? `${v.productoRef.marca || ''} ${v.productoRef.modelo || v.modelo}` : v.modelo}
                        </p>
                        {(v.productoRef?.numeroCelular || v.numeroCelular) && (
                          <p className="text-[9px] font-mono text-indigo-500 mt-0.5 font-bold">📱 {v.productoRef?.numeroCelular || v.numeroCelular}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openEditar(v); }} className="text-slate-300 hover:text-indigo-500 transition-colors p-1" title="Editar Activo"><Settings size={14}/></button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[9px] pt-3 border-t border-slate-50 mt-2">
                    <span className={`flex items-center gap-1 font-bold ${isOffline ? 'text-rose-400' : 'text-emerald-500'}`}>
                      <Clock size={10} /> {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <ChevronRight size={14} className={`transition-transform ${seleccionado?._id === v._id ? 'rotate-90 text-indigo-500' : 'text-slate-300 group-hover:text-indigo-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MAPA PRINCIPAL */}
        <div className="flex-1 relative z-10 bg-slate-100">
          <MapContainer
            center={defaultCenter}
            zoom={12}
            style={{ height: "100%", width: "100%", background: '#f1f5f9' }}
            zoomControl={false}
          >
            <TileLayer attribution='&copy; CARTO' url={getTileLayer()} />
            <ZoomControl position="bottomright" />
            <MapController center={viewState.center} zoom={viewState.zoom} />

            {activosFiltrados.map((v) => {
              if (!v.latitud || !v.longitud) return null;

              const minutesSince = Math.floor((new Date() - new Date(v.timestamp)) / 60000);
              const isOffline = minutesSince > 10;

              return (
                <Marker
                  key={v._id}
                  position={[v.latitud, v.longitud]}
                  icon={isOffline ? alertIcon : activoIcon}
                  eventHandlers={{ click: () => handleSelectActivo(v) }}
                  opacity={isOffline ? 0.6 : 1}
                >
                  <Popup className="custom-popup" closeButton={false}>
                    <div className="relative font-sans">
                      <div className={`p-4 ${isOffline ? 'bg-slate-100' : 'bg-white'} border-b border-slate-100`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex gap-1">
                            <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">{v.tipoActivo}</span>
                            {!v.esPersonal ? (
                              <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Patrimonio Empresa</span>
                            ) : (
                              <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">Equipo Personal</span>
                            )}
                          </div>
                          <span className={`text-[9px] font-bold flex items-center gap-1 ${isOffline ? 'text-slate-400' : 'text-emerald-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`}></div>
                            {isOffline ? 'OFFLINE' : 'ONLINE'}
                          </span>
                        </div>
                        <h3 className="font-black text-slate-800 text-sm uppercase mb-1">
                          {v.asignadoA ? (v.asignadoA.name || `${v.asignadoA.nombres || ''} ${v.asignadoA.apellidos || ''}`) : 'Stock / Sin Asignar'}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {v.asignadoA?.cargo || 'Activo Fijo'} • ID: {v.identificador}
                        </p>
                        {(v.productoRef?.numeroCelular || v.numeroCelular) && (
                           <p className="text-[10px] font-mono text-indigo-500 mt-1 font-bold">Línea: {v.productoRef?.numeroCelular || v.numeroCelular}</p>
                        )}
                      </div>

                      <div className="p-4 bg-white/50">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Batería</span>
                            <span className={`text-lg font-black ${v.bateria < 20 ? 'text-rose-500' : 'text-emerald-500'}`}>{v.bateria}%</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Conexión</span>
                            <span className="text-lg font-black text-indigo-600">{v.conexion}</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] font-mono font-bold text-slate-300">
                            Último reporte: {new Date(v.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur-md border border-white p-3 rounded-2xl shadow-xl shadow-slate-200/50 flex items-center gap-6">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Equipos</span>
              <span className="text-xl font-black text-slate-800">{activos.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-100"></div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Online</span>
              <span className="text-xl font-black text-indigo-500">{countOnline}</span>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL DE GESTIÓN DE ACTIVOS (CRUD) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-y-auto custom-scrollbar max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Settings className="text-indigo-600" />
                {modalMode === 'crear' ? 'Registrar Nuevo Equipo' : 'Gestionar Equipo'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveActivo} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Identificador (IMEI/MAC)</label>
                  <input required type="text" value={formActivo.identificador} disabled={modalMode === 'editar'} onChange={e => setFormActivo({...formActivo, identificador: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder="Ej: 351234567890" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo de Activo</label>
                  <select value={formActivo.tipoActivo} onChange={e => setFormActivo({...formActivo, tipoActivo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                    <option value="CELULAR">Celular</option>
                    <option value="NOTEBOOK">Notebook</option>
                    <option value="TABLET">Tablet</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Modelo / Marca</label>
                  <input type="text" value={formActivo.modelo} onChange={e => setFormActivo({...formActivo, modelo: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder="Ej: Samsung Galaxy S23" disabled={modalMode === 'editar' && !!formActivo.productoRef} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Línea Celular (Opcional)</label>
                  <input type="text" value={formActivo.numeroCelular} onChange={e => setFormActivo({...formActivo, numeroCelular: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400" placeholder="Ej: +56912345678" disabled={modalMode === 'editar' && !!formActivo.productoRef} />
                </div>
              </div>
              <p className="text-[10px] text-emerald-500 mt-0 italic flex items-center gap-1">
                  <Signal size={10} /> Al guardar, el sistema buscará el IMEI en Existencia General y si lo encuentra reescribirá estos datos por los del inventario corporativo.
              </p>

              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vincular a Empleado</label>
                
                <div 
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none hover:border-indigo-500 bg-white cursor-pointer flex items-center justify-between"
                  onClick={() => setMostrarDropdownEmpleados(true)}
                >
                  {formActivo.asignadoA ? (
                    <div className="flex-1 truncate">
                      {empleados.find(e => e._id === formActivo.asignadoA)?.name || `${empleados.find(e => e._id === formActivo.asignadoA)?.nombres || ''} ${empleados.find(e => e._id === formActivo.asignadoA)?.apellidos || ''}`.trim()} 
                      <span className="text-slate-400 font-normal ml-1">({empleados.find(e => e._id === formActivo.asignadoA)?.cargo || 'Sin Cargo'})</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">-- Sin Asignar (Stock) --</span>
                  )}
                  {formActivo.asignadoA && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFormActivo({...formActivo, asignadoA: ''}); setBusquedaEmpleado(''); }} className="text-slate-400 hover:text-rose-500 bg-slate-100 p-1 rounded-full">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {mostrarDropdownEmpleados && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setMostrarDropdownEmpleados(false)}></div>
                    <div className="absolute z-[100] mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden flex flex-col bottom-full mb-1">
                      <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10 flex items-center gap-2">
                        <Search size={14} className="text-slate-400 ml-2" />
                        <input 
                          type="text" 
                          autoFocus
                          placeholder="Buscar por nombre o cargo..." 
                          value={busquedaEmpleado}
                          onChange={e => setBusquedaEmpleado(e.target.value)}
                          className="w-full outline-none text-sm font-medium text-slate-700 py-1"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-48 p-1">
                        <div 
                          className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer rounded-lg font-medium"
                          onClick={() => {
                            setFormActivo({...formActivo, asignadoA: ''});
                            setMostrarDropdownEmpleados(false);
                            setBusquedaEmpleado('');
                          }}
                        >
                          -- Sin Asignar (Stock) --
                        </div>
                        {empleadosFiltradosList.map(grupo => (
                          <div key={grupo.cargo} className="mb-2">
                            <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase bg-slate-50 rounded">
                              {grupo.cargo}
                            </div>
                            {grupo.empleados.map(emp => (
                              <div 
                                key={emp._id}
                                className={`px-3 py-2 mt-1 text-sm cursor-pointer rounded-lg flex flex-col ${formActivo.asignadoA === emp._id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                onClick={() => {
                                  setFormActivo({...formActivo, asignadoA: emp._id});
                                  setMostrarDropdownEmpleados(false);
                                  setBusquedaEmpleado('');
                                }}
                              >
                                <span className="font-bold">{emp.name || `${emp.nombres || ''} ${emp.apellidos || ''}`.trim()}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {empleadosFiltradosList.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">No se encontraron empleados operativos</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <p className="text-[10px] text-slate-400 mt-1 italic">Si lo dejas "Sin Asignar", quedará libre en stock y no aparecerá asociado a nadie en el mapa.</p>
              </div>

              {modalMode === 'editar' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado Administrativo</label>
                  <select value={formActivo.estado} onChange={e => setFormActivo({...formActivo, estado: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500">
                    <option value="ACTIVO">Activo</option>
                    <option value="EN REPARACION">En Reparación</option>
                    <option value="EXTRAVIADO">Extraviado / Robado</option>
                    <option value="APAGADO">Apagado / Baja</option>
                  </select>
                </div>
              )}

              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                {modalMode === 'editar' ? (
                  <button type="button" onClick={() => deleteActivo(formActivo._id)} className="text-rose-500 hover:bg-rose-50 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors">
                    <Trash2 size={14} /> Eliminar Activo
                  </button>
                ) : <div></div>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-xs hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                    <Save size={14} /> Guardar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GPSActivos;
