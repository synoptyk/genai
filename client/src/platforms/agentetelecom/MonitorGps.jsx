import React, { useState, useEffect, useCallback, useMemo } from 'react';
import API_URL from '../../config';

import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import * as XLSX from 'xlsx';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Battery, Navigation, Search, User, Clock, RefreshCw, Loader2,
  FileDown, AlertTriangle, ShieldCheck, MapIcon,
  Crosshair, Signal, ChevronRight
} from 'lucide-react';

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
    background: rgba(16, 185, 129, 0.4);
    animation: pulsar 2s infinite;
    z-index: -1;
  }
  .gps-pulse-alert {
    background: rgba(239, 68, 68, 0.4);
    animation: pulsar 1.5s infinite; /* Faster pulse for alerts */
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

// --- CONFIGURACIÓN DE ICONOS ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Generador de Iconos Personalizados
const createCustomIcon = (type) => {
  const img = type === 'ok'
    ? 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png'
    : 'https://cdn-icons-png.flaticon.com/512/564/564619.png';

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

const tecnicoIcon = createCustomIcon('ok');
const alertIcon = createCustomIcon('alert');

// Componente para volar suavemente en el mapa (Optimizado)
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

const MonitorGps = () => {
  const [flota, setFlota] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [mapType, setMapType] = useState('light'); // Default to light

  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const defaultCenter = [-33.4489, -70.6693];
  const [viewState, setViewState] = useState({ center: defaultCenter, zoom: 12 });

  // --- FETCH DATA ---
  const fetchGps = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/gps/live`);
      if (Array.isArray(res.data)) {
        setFlota(res.data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error GPS:", error);
    }
  }, []);

  // Poll for updates every 5 seconds (Real-time feel)
  useEffect(() => {
    fetchGps();
    const interval = setInterval(fetchGps, 5000);
    return () => clearInterval(interval);
  }, [fetchGps]);

  // --- EXCEL EXPORT ---
  const descargarReporteGps = () => {
    if (flota.length === 0) return alert("Sin datos para exportar");
    const dataExport = flota.map(v => ({
      "Patente": v.patente,
      "Estado Sistema": v.validacion === 'OK' ? 'VALIDADO' : 'ALERTA',
      "Conductor": v.conductor || 'Sin Asignar',
      "Velocidad (km/h)": v.velocidad,
      "Batería (%)": v.bateria,
      "Último Reporte": new Date(v.ultimoReporte).toLocaleString(),
      "Ubicación": `${v.lat}, ${v.lng}`
    }));
    const ws = XLSX.utils.json_to_sheet(dataExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GPS_Live");
    XLSX.writeFile(wb, `GPS_Report_${Date.now()}.xlsx`);
  };

  // --- FILTROS (Memoized) ---
  const flotaFiltrada = useMemo(() => {
    return flota.filter(v => {
      const matchTexto =
        (v.patente || '').toLowerCase().includes(textoBusqueda.toLowerCase()) ||
        (v.conductor || '').toLowerCase().includes(textoBusqueda.toLowerCase());

      if (filtroEstado === 'movimiento' && v.velocidad === 0) return false;
      if (filtroEstado === 'alerta' && v.validacion === 'OK') return false;

      return matchTexto;
    });
  }, [flota, textoBusqueda, filtroEstado]);

  const countAlertas = useMemo(() => flota.filter(v => v.validacion !== 'OK').length, [flota]);
  const countMovimiento = useMemo(() => flota.filter(v => v.velocidad > 0).length, [flota]);

  // Tile Layer Selector
  const getTileLayer = () => {
    switch (mapType) {
      case 'satellite': return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      case 'dark': return "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      case 'light': default: return "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    }
  };

  const handleSelectVehiculo = (vehiculo) => {
    setSeleccionado(vehiculo);
    if (vehiculo.lat && vehiculo.lng) {
      setViewState({ center: [vehiculo.lat, vehiculo.lng], zoom: 16 });
    }
  };

  // Manual Sync Trigger
  const handleSync = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/api/bot/gps-run`);
      // Wait a bit for the bot to finish before refetching
      setTimeout(() => { fetchGps(); setSyncing(false); }, 4000);
    } catch (e) {
      console.error("Sync error", e);
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 w-full relative bg-slate-50/50 rounded-[2rem] overflow-hidden">
      <style>{pulsarStyles}</style>

      {/* CONTROL HEADER (FLOATING) */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-white shadow-xl shadow-slate-200/50 pointer-events-auto">
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Monitor Satelital <span className="text-blue-600">Vivo</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <Signal size={12} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-slate-500">CONECTADO</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              <RefreshCw size={12} className="text-blue-500" />
              <span className="text-[10px] font-bold text-slate-500">5s</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-white/90 backdrop-blur-md p-2 rounded-2xl border border-white shadow-xl shadow-slate-200/50 pointer-events-auto">
          {/* Quick Filters */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['todos', 'movimiento', 'alerta'].map((tipo) => (
              <button
                key={tipo}
                onClick={() => setFiltroEstado(tipo)}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${filtroEstado === tipo ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tipo === 'movimiento' ? `En Ruta (${countMovimiento})` : tipo === 'alerta' ? `Alertas (${countAlertas})` : `Todos`}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setMapType('light')} className={`p-2 rounded-lg transition-all ${mapType === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`} title="Mapa Claro"><MapIcon size={16} /></button>
            <button onClick={() => setMapType('satellite')} className={`p-2 rounded-lg transition-all ${mapType === 'satellite' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`} title="Satélite"><Crosshair size={16} /></button>
            <button onClick={() => setMapType('dark')} className={`p-2 rounded-lg transition-all ${mapType === 'dark' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`} title="Modo Oscuro"><ShieldCheck size={16} /></button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-75 disabled:shadow-none"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {syncing ? 'SYNC' : 'SYNC'}
          </button>

          <button onClick={descargarReporteGps} className="bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 p-2 rounded-xl border border-slate-200 transition-colors" title="Descargar Excel"><FileDown size={18} /></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row h-full relative z-0">

        {/* PANEL LATERAL (LISTA) */}
        <div className="w-full lg:w-96 bg-white border-r border-slate-100 flex flex-col z-20 shadow-xl shadow-slate-200/50">
          {/* Header Panel */}
          <div className="p-6 pb-2">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Buscar patente, técnico..."
                className="w-full bg-slate-50 hover:bg-white border border-slate-200 focus:border-blue-200 rounded-2xl py-3 pl-11 pr-4 text-slate-600 font-bold text-xs outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                value={textoBusqueda}
                onChange={e => setTextoBusqueda(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
            {loading && (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <span className="text-xs font-bold uppercase tracking-wide">Cargando flota...</span>
              </div>
            )}

            {!loading && flotaFiltrada.length === 0 && (
              <div className="text-center py-12 px-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 mx-2">
                <p className="text-slate-400 font-bold text-xs uppercase">No se encontraron unidades activas</p>
              </div>
            )}

            {flotaFiltrada.map((v) => (
              <div
                key={v._id}
                onClick={() => handleSelectVehiculo(v)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden ${seleccionado?._id === v._id
                  ? 'bg-blue-50 border-blue-200 shadow-md transform scale-[1.02]'
                  : 'bg-white border-slate-100 hover:border-blue-100 hover:shadow-lg hover:-translate-y-0.5'
                  }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${v.validacion === 'OK' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {v.validacion === 'OK' ? <User size={18} /> : <AlertTriangle size={18} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-tight truncate w-32">
                        {v.conductor || 'SIN ASIGNAR'}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400">{v.patente}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {v.velocidad > 0 && <span className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 mb-1"><Navigation size={10} /> {v.velocidad} km/h</span>}
                    <span className={`flex items-center justify-end gap-1 text-[9px] font-bold ${v.bateria < 20 ? 'text-rose-500' : 'text-slate-400'}`}>
                      <Battery size={10} /> {v.bateria}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[9px] pt-3 border-t border-slate-50 mt-2">
                  <span className="flex items-center gap-1 text-slate-400 font-bold"><Clock size={10} /> {new Date(v.ultimoReporte).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <ChevronRight size={14} className={`transition-transform ${seleccionado?._id === v._id ? 'rotate-90 text-blue-500' : 'text-slate-300 group-hover:text-blue-400'}`} />
                </div>
              </div>
            ))}
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

            {flotaFiltrada.map((v) => {
              if (!v.lat || !v.lng) return null;

              // Freshness Logic
              const minutesSince = v.ultimoReporte ? Math.floor((new Date() - new Date(v.ultimoReporte)) / 60000) : 999;
              const isStale = minutesSince > 10;

              return (
                <Marker
                  key={v._id}
                  position={[v.lat, v.lng]}
                  icon={v.validacion === 'OK' && !isStale ? tecnicoIcon : alertIcon}
                  eventHandlers={{ click: () => handleSelectVehiculo(v) }}
                  opacity={isStale ? 0.6 : 1}
                >
                  <Popup className="custom-popup" closeButton={false}>
                    <div className="relative font-sans">
                      {/* Popup Header */}
                      <div className={`p-4 ${isStale ? 'bg-slate-100' : v.validacion === 'OK' ? 'bg-white' : 'bg-rose-50'} border-b border-slate-100`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="bg-slate-800 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">{v.patente}</span>
                          <span className={`text-[9px] font-bold flex items-center gap-1 ${isStale ? 'text-slate-400' : 'text-emerald-500'}`}>
                            <div className={`w-2 h-2 rounded-full ${isStale ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`}></div>
                            {isStale ? 'OFFLINE' : 'ONLINE'}
                          </span>
                        </div>
                        <h3 className="font-black text-slate-800 text-sm uppercase mb-1">{v.conductor || 'Sin Asignar'}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{v.marca || 'Vehículo'} {v.modelo}</p>
                      </div>

                      {/* Popup Body */}
                      <div className="p-4 bg-white/50">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Velocidad</span>
                            <span className="text-lg font-black text-blue-600">{v.velocidad} <span className="text-[9px] text-slate-400 font-normal">km/h</span></span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Batería</span>
                            <span className={`text-lg font-black ${v.bateria < 20 ? 'text-rose-500' : 'text-emerald-500'}`}>{v.bateria}%</span>
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[9px] font-mono font-bold text-slate-300">Último reporte: {new Date(v.ultimoReporte).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* HUD Status Footer (Floating) */}
          <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur-md border border-white p-3 rounded-2xl shadow-xl shadow-slate-200/50 flex items-center gap-6">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Flota</span>
              <span className="text-xl font-black text-slate-800">{flota.length}</span>
            </div>
            <div className="w-px h-8 bg-slate-100"></div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">En Movimiento</span>
              <span className="text-xl font-black text-emerald-500">{countMovimiento}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MonitorGps;