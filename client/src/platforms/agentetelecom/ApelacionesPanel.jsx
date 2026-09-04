import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, Clock, CheckCircle2, XCircle, Search, 
  Filter, ArrowLeft, MessageSquare, Calendar, Hash, User, Users,
  Tv, Wifi, ChevronRight, AlertCircle, RefreshCw, Phone, 
  Award, Upload, Image as ImageIcon, CheckCheck, ListOrdered, 
  Sliders, Edit3, ChevronLeft, Layers, FileText, Database, ShieldCheck,
  TrendingUp, DollarSign, Target, UserCheck, ChevronDown
} from 'lucide-react';
import telecomApi from './telecomApi';

const formatRut = (rut) => {
  if (!rut) return '';
  let clean = String(rut).replace(/[^0-9kK]/g, '');
  if (clean.length < 2) return clean;
  let cuerpo = clean.slice(0, -1);
  let dv = clean.slice(-1).toUpperCase();
  let formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedCuerpo}-${dv}`;
};

const MESES_NAMES = [
  { id: 0, key: '01', name: 'Enero' },
  { id: 1, key: '02', name: 'Febrero' },
  { id: 2, key: '03', name: 'Marzo' },
  { id: 3, key: '04', name: 'Abril' },
  { id: 4, key: '05', name: 'Mayo' },
  { id: 5, key: '06', name: 'Junio' },
  { id: 6, key: '07', name: 'Julio' },
  { id: 7, key: '08', name: 'Agosto' },
  { id: 8, key: '09', name: 'Septiembre' },
  { id: 9, key: '10', name: 'Octubre' },
  { id: 10, key: '11', name: 'Noviembre' },
  { id: 11, key: '12', name: 'Diciembre' },
];

export default function ApelacionesPanel() {
  const navigate = useNavigate();

  // --- Main View Mode ---
  const [viewMode, setViewMode] = useState('apelaciones'); // 'apelaciones' | 'bitacora'

  // --- Sub-view Mode in Bitácora: 'tramos' | 'actividades' ---
  const [bitacoraSubView, setBitacoraSubView] = useState('tramos'); // 'tramos' (Tabla Producción y Tramos) | 'actividades' (Detalle OTs)

  // --- Tab 1: Apelaciones State ---
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('por_validar'); // 'por_validar', 'aprobada', 'rechazada', 'todas'
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [evidenciaUrl, setEvidenciaUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [overrideData, setOverrideData] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [tarifasLPU, setTarifasLPU] = useState([]);
  const [notification, setNotification] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);

  // --- Tab 2: Bitácora & Tramos State ---
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(7); // Agosto (7 = 0-indexed)
  const [selectedYear, setSelectedYear] = useState(2026);
  
  // Resumen Tramos por Técnico
  const [resumenTramos, setResumenTramos] = useState({
    tecnicos: [],
    tramosConfig: [],
    puntosNoCalculables: 95,
    kpisGlobales: { totalTecnicos: 0, totalOTs: 0, totalPuntos: 0, totalCalculables: 0, totalBonoProduccion: 0 }
  });
  const [loadingTramos, setLoadingTramos] = useState(false);
  const [searchTecnicoTramo, setSearchTecnicoTramo] = useState('');
  const [selectedTecnicoFiltro, setSelectedTecnicoFiltro] = useState(null); // Técnico específico para filtrar OTs

  // Actividades OTs Detalladas
  const [bitacoraData, setBitacoraData] = useState([]);
  const [bitacoraStats, setBitacoraStats] = useState({ totalActividades: 0, totalPuntos: 0 });
  const [bitacoraPagination, setBitacoraPagination] = useState({ page: 1, limit: 50, totalPages: 1, total: 0 });
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [bitacoraSearch, setBitacoraSearch] = useState('');
  const [bitacoraFilterEstado, setBitacoraFilterEstado] = useState('TODOS');
  
  // Modal Modificación CEO
  const [selectedActividadEdit, setSelectedActividadEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    codigoLpu: '',
    puntosBase: '',
    decos: 0,
    repetidores: 0,
    telefonos: 0,
    observacionCeo: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Show Toast
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch appeals from backend (Scoped by company)
  const fetchAppeals = async () => {
    setLoading(true);
    try {
      const res = await telecomApi.get('/tecnicos/produccion/apelaciones');
      setAppeals(res.data || []);
    } catch (err) {
      console.error('Error fetching appeals:', err);
      showNotification('error', 'Error al cargar las apelaciones.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Summary Table of Production & Tramos
  const fetchResumenTramos = async () => {
    setLoadingTramos(true);
    try {
      const monthStr = `${selectedYear}-${MESES_NAMES[selectedMonthIndex].key}`;
      const res = await telecomApi.get(`/tecnicos/produccion/resumen-mes-tramos?mes=${monthStr}`);
      if (res.data && res.data.success) {
        setResumenTramos({
          tecnicos: res.data.tecnicos || [],
          tramosConfig: res.data.tramosConfig || [],
          puntosNoCalculables: res.data.puntosNoCalculables || 95,
          kpisGlobales: res.data.kpisGlobales || { totalTecnicos: 0, totalOTs: 0, totalPuntos: 0, totalCalculables: 0, totalBonoProduccion: 0 }
        });
      }
    } catch (err) {
      console.error('Error fetching resumen tramos:', err);
    } finally {
      setLoadingTramos(false);
    }
  };

  // Fetch monthly activities for CEO (Scoped by company)
  const fetchBitacora = async (page = 1) => {
    setBitacoraLoading(true);
    try {
      const monthStr = `${selectedYear}-${MESES_NAMES[selectedMonthIndex].key}`;
      const params = new URLSearchParams({
        mes: monthStr,
        page: String(page),
        limit: String(bitacoraPagination.limit || 50),
        search: bitacoraSearch,
        filterEstado: bitacoraFilterEstado,
        tecnicoRut: selectedTecnicoFiltro?.rut || ''
      });
      const res = await telecomApi.get(`/tecnicos/produccion/actividades-mes?${params.toString()}`);
      if (res.data && res.data.success) {
        setBitacoraData(res.data.data || []);
        setBitacoraStats(res.data.stats || { totalActividades: 0, totalPuntos: 0 });
        setBitacoraPagination(res.data.pagination || { page: 1, limit: 50, totalPages: 1, total: 0 });
      }
    } catch (err) {
      console.error('Error fetching bitacora:', err);
      showNotification('error', 'Error al consultar la bitácora mensual de actividades.');
    } finally {
      setBitacoraLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();

    const fetchTarifas = async () => {
      try {
        const res = await telecomApi.get('/tarifa-lpu/catalogo');
        setTarifasLPU(res.data || []);
      } catch (err) {
        console.error('Error fetching tarifas LPU:', err);
      }
    };
    fetchTarifas();

    const handleNewAppeal = () => {
      console.log("🔄 [ApelacionesPanel] Notificación en tiempo real recibida.");
      fetchAppeals();
    };

    window.addEventListener('newAppealNotif', handleNewAppeal);
    return () => {
      window.removeEventListener('newAppealNotif', handleNewAppeal);
    };
  }, []);

  // Re-fetch bitácora and tramos when month, year or view mode changes
  useEffect(() => {
    if (viewMode === 'bitacora') {
      fetchResumenTramos();
      fetchBitacora(1);
    }
  }, [viewMode, selectedMonthIndex, selectedYear, bitacoraFilterEstado, selectedTecnicoFiltro]);

  // Debounced search for bitácora
  useEffect(() => {
    if (viewMode !== 'bitacora') return;
    const timer = setTimeout(() => {
      fetchBitacora(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [bitacoraSearch]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('error', 'Por favor selecciona un archivo de imagen válido.');
      return;
    }

    const formData = new FormData();
    formData.append('imagen', file);

    setUploadingImage(true);
    try {
      const res = await telecomApi.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data && res.data.url) {
        setEvidenciaUrl(res.data.url);
        showNotification('success', 'Imagen de respaldo subida correctamente.');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showNotification('error', 'Error al subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Resolve Single Appeal
  const handleResolve = async (status) => {
    if (!selectedAppeal) return;
    if (status === 'rechazada' && !feedback.trim()) {
      showNotification('error', 'Debe ingresar un comentario para poder rechazar la apelación.');
      return;
    }

    setSubmitting(true);
    try {
      await telecomApi.post(`/tecnicos/produccion/apelacion/${selectedAppeal._id}/resolver`, {
        status,
        respuesta: feedback,
        evidenciaUrl,
        overrideLpu: overrideData?.lpu,
        overrideEquipos: {
          decos: overrideData?.decos || 0,
          repetidores: overrideData?.repetidores || 0,
          telefonos: overrideData?.telefonos || 0
        }
      });

      showNotification('success', `Apelación ${status === 'aprobada' ? 'APROBADA' : 'RECHAZADA'} con éxito.`);
      setSelectedAppeal(null);
      setFeedback('');
      setEvidenciaUrl('');
      fetchAppeals();
      if (viewMode === 'bitacora') {
        fetchResumenTramos();
        fetchBitacora(bitacoraPagination.page);
      }
    } catch (err) {
      console.error('Error resolving appeal:', err);
      showNotification('error', err.response?.data?.error || 'Error al procesar la resolución de la apelación.');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Approval
  const handleBulkApprove = async () => {
    setBulkApproving(true);
    try {
      const res = await telecomApi.post('/tecnicos/produccion/apelaciones/aprobar-todas');
      if (res.data && res.data.success) {
        showNotification('success', res.data.message || `Se han aprobado ${res.data.count} apelaciones masivamente.`);
        setShowBulkModal(false);
        fetchAppeals();
        if (viewMode === 'bitacora') {
          fetchResumenTramos();
          fetchBitacora(bitacoraPagination.page);
        }
      } else {
        showNotification('error', res.data?.error || 'No se pudieron aprobar las apelaciones.');
      }
    } catch (err) {
      console.error('Error in bulk approval:', err);
      showNotification('error', err.response?.data?.error || 'Error al procesar la aprobación general.');
    } finally {
      setBulkApproving(false);
    }
  };

  // Open CEO Activity Edit Modal
  const handleOpenEditActivity = (act) => {
    setSelectedActividadEdit(act);
    const origLpu = act.CODIGO_LPU_BASE || act.Codigo_LPU_Base || act.COD_LPU || act['Cód LPU'] || act.LPU_COD || '';
    const origPtsBase = act.Pts_Actividad_Base ?? act.PTS_ACTIVIDAD_BASE ?? '';
    const origDecos = parseInt(act.Decos_Adicionales || act.DECOS_ADICIONALES || 0);
    const origRepetidores = parseInt(act.Repetidores_WiFi || act.REPETIDORES_WIFI || 0);
    const origTelefonos = parseInt(act.Telefonos || act.TELEFONOS || 0);
    const origObs = act.apelacion?.respuesta || act.observacionCeo || '';

    setEditFormData({
      codigoLpu: origLpu,
      puntosBase: origPtsBase,
      decos: origDecos,
      repetidores: origRepetidores,
      telefonos: origTelefonos,
      observacionCeo: origObs
    });
  };

  // Save CEO Activity Edit
  const handleSaveActivityEdit = async () => {
    if (!selectedActividadEdit) return;
    setSavingEdit(true);
    try {
      const res = await telecomApi.post(`/tecnicos/produccion/actividad/${selectedActividadEdit._id}/modificar-ceo`, editFormData);
      if (res.data && res.data.success) {
        showNotification('success', 'Actividad y baremos recalculados con éxito.');
        setSelectedActividadEdit(null);
        fetchResumenTramos();
        fetchBitacora(bitacoraPagination.page);
      } else {
        showNotification('error', res.data?.error || 'No se pudo guardar la modificación.');
      }
    } catch (err) {
      console.error('Error saving activity modification:', err);
      showNotification('error', err.response?.data?.error || 'Error al guardar la modificación.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Calculate Metrics
  const metrics = {
    total: appeals.length,
    pending: appeals.filter(a => a.apelacion?.status === 'por_validar').length,
    approved: appeals.filter(a => a.apelacion?.status === 'aprobada').length,
    rejected: appeals.filter(a => a.apelacion?.status === 'rechazada').length,
  };

  // Filter appeals
  const filteredAppeals = appeals.filter(a => {
    if (activeTab !== 'todas' && a.apelacion?.status !== activeTab) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const ot = String(a.peticion || a.ordenId || '').toLowerCase();
    const tech = String(a.tecnicoNombre || a.NOMBRE || '').toLowerCase();
    const act = String(a.actividadVisible || a.actividad || '').toLowerCase();
    return ot.includes(term) || tech.includes(term) || act.includes(term);
  });

  // Filter Tramos Technicians
  const filteredTecnicosTramos = resumenTramos.tecnicos.filter(t => {
    if (!searchTecnicoTramo) return true;
    const s = searchTecnicoTramo.toLowerCase();
    return (t.nombre || '').toLowerCase().includes(s) || (t.rut || '').includes(s) || (t.idRecursoToa || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6 animate-fade-in p-1 max-w-[1680px] mx-auto text-slate-800">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl transition-all duration-300 transform scale-100 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-250 text-emerald-900 shadow-emerald-100/50' 
            : 'bg-rose-50 border-rose-250 text-rose-900 shadow-rose-100/50'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/rendimiento')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-all duration-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-sky-50 text-sky-600 border border-sky-200 rounded-full">
                Módulo Maestro / CEO
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Producción & Apelaciones
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-sky-600" /> Centro de Apelaciones y Tabla de Baremos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Auditoría y cálculo de producción con tramos baremos, resolución en tiempo real y modificación directa.
            </p>
          </div>
        </div>

        {/* View Mode Switcher + Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl shadow-inner">
            <button
              onClick={() => setViewMode('apelaciones')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                viewMode === 'apelaciones'
                  ? 'bg-white text-sky-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              Apelaciones ({metrics.pending})
            </button>
            <button
              onClick={() => setViewMode('bitacora')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                viewMode === 'bitacora'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              Producción & Baremos (CEO)
            </button>
          </div>

          {viewMode === 'apelaciones' && (
            <>
              <button
                onClick={() => setShowBulkModal(true)}
                disabled={metrics.pending === 0 || loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Aprobar todas las apelaciones pendientes masivamente"
              >
                <CheckCheck className="w-4 h-4" />
                Aprobación General {metrics.pending > 0 && `(${metrics.pending})`}
              </button>

              <button 
                onClick={fetchAppeals} 
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                Refrescar
              </button>
            </>
          )}

          {viewMode === 'bitacora' && (
            <button 
              onClick={() => {
                fetchResumenTramos();
                fetchBitacora(bitacoraPagination.page);
              }} 
              disabled={loadingTramos || bitacoraLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-800 transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 text-slate-500 ${loadingTramos || bitacoraLoading ? 'animate-spin' : ''}`} />
              Refrescar Baremos
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: CENTRO DE APELACIONES                                            */}
      {/* ========================================================================= */}
      {viewMode === 'apelaciones' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-sky-600"><ClipboardCheck className="w-24 h-24" /></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Apelaciones</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-50 border border-sky-100 text-sky-600"><ClipboardCheck className="w-4 h-4" /></span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-slate-900 mt-2">{metrics.total}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">Registros de su empresa</div>
            </div>

            <div className="relative overflow-hidden bg-white border border-slate-250/90 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-amber-400 transition-all duration-200">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-amber-500"><Clock className="w-24 h-24" /></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pendientes de Validación</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 border border-amber-100 text-amber-600"><Clock className="w-4 h-4" /></span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-amber-600 mt-2">{metrics.pending}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">Requieren revisión inmediata</div>
            </div>

            <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-emerald-500 transition-all duration-200">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500"><CheckCircle2 className="w-24 h-24" /></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aprobadas / Puntos Sumados</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600"><CheckCircle2 className="w-4 h-4" /></span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">{metrics.approved}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">Puntos aplicados con éxito</div>
            </div>

            <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md border-t-4 border-t-rose-500 transition-all duration-200">
              <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-500"><XCircle className="w-24 h-24" /></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Apelaciones Rechazadas</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 border border-rose-100 text-rose-600"><XCircle className="w-4 h-4" /></span>
              </div>
              <div className="text-2xl md:text-3xl font-black text-rose-600 mt-2">{metrics.rejected}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">Desestimadas con retroalimentación</div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Filter Tabs & Search */}
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-1.5 p-1 bg-slate-150/70 border border-slate-200 rounded-xl max-w-fit overflow-x-auto">
                <button 
                  onClick={() => setActiveTab('por_validar')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeTab === 'por_validar' 
                      ? 'bg-white shadow-sm border border-slate-200 text-amber-600' 
                      : 'text-slate-500 border border-transparent hover:text-slate-800'
                  }`}
                >
                  Pendientes ({metrics.pending})
                </button>
                <button 
                  onClick={() => setActiveTab('aprobada')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeTab === 'aprobada' 
                      ? 'bg-white shadow-sm border border-slate-200 text-emerald-600' 
                      : 'text-slate-500 border border-transparent hover:text-slate-800'
                  }`}
                >
                  Aprobadas ({metrics.approved})
                </button>
                <button 
                  onClick={() => setActiveTab('rechazada')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeTab === 'rechazada' 
                      ? 'bg-white shadow-sm border border-slate-200 text-rose-600' 
                      : 'text-slate-500 border border-transparent hover:text-slate-800'
                  }`}
                >
                  Rechazadas ({metrics.rejected})
                </button>
                <button 
                  onClick={() => setActiveTab('todas')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                    activeTab === 'todas' 
                      ? 'bg-slate-800 border border-slate-700 text-white shadow-sm' 
                      : 'text-slate-500 border border-transparent hover:text-slate-800'
                  }`}
                >
                  Todas ({metrics.total})
                </button>
              </div>

              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar por OT, técnico o actividad..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-450 outline-none transition-all duration-200 font-medium"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-10 h-10 border-3 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
                  <span className="text-xs font-bold text-slate-500">Cargando apelaciones de producción...</span>
                </div>
              ) : filteredAppeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <ClipboardCheck className="w-12 h-12 text-slate-300 mb-3" />
                  <h3 className="text-sm font-black text-slate-700">No se encontraron apelaciones</h3>
                  <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
                    {searchTerm 
                      ? 'Intente cambiando los términos de búsqueda o filtros aplicados.' 
                      : 'No existen registros en el estado seleccionado para este período.'}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Técnico</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Actividad / Orden ID</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Equipos Solicitados</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Justificación Técnico</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Estado / Fecha</th>
                      <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredAppeals.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/50 transition-all duration-150 group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0 w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-600 text-xs overflow-hidden">
                              {item.tecnicoAvatar ? (
                                <img src={item.tecnicoAvatar} alt={item.tecnicoNombre} className="w-full h-full object-cover" />
                              ) : (
                                String(item.tecnicoNombre || 'T').substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-sky-600 transition-colors duration-150">{item.tecnicoNombre}</div>
                              <div className="flex flex-col text-[10px] text-slate-500 mt-0.5 gap-0.5">
                                <span>RUT: {formatRut(item.tecnicoRutFormateado || item.apelacion?.rut || item.rut)}</span>
                                <span className="text-[9px] text-sky-600 font-black tracking-wider uppercase">TOA ID: {item.tecnicoToaId || item.idRecursoToa || 'SIN'}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Hash className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-xs font-black text-slate-900">{item.peticion || item.ordenId || 'S/N'}</span>
                            </div>
                            <div className="text-[10px] text-slate-550 mt-1 font-bold leading-tight">
                              <span className="text-slate-450">Orig:</span> {item.actividadVisible || item.actividad || 'Op. Técnica'} <span className="font-mono text-slate-650 bg-slate-100 px-1 py-0.2 rounded font-black">({item.Pts_Actividad_Base || item.PTS_ACTIVIDAD_BASE || 0} pts)</span>
                              {item.apelacion?.codigoLpu && (
                                <div className="mt-1.5 flex flex-col gap-0.5">
                                  <span className="text-[9px] text-amber-700 font-extrabold flex items-center gap-1">
                                    ➔ Apela: [{item.apelacion.codigoLpu}] <span className="font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md font-black">({item.apelacion.puntosBase || 0} pts)</span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                            {parseInt(item.apelacion?.equipos?.decos || 0) > 0 && (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-150 text-indigo-650 text-[10px] font-black">
                                <Tv className="w-3.5 h-3.5 text-indigo-500" />
                                {item.apelacion.equipos.decos} Decos
                              </div>
                            )}
                            {parseInt(item.apelacion?.equipos?.repetidores || 0) > 0 && (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-150 text-teal-605 text-[10px] font-black">
                                <Wifi className="w-3.5 h-3.5 text-teal-500" />
                                {item.apelacion.equipos.repetidores} WiFi
                              </div>
                            )}
                            {parseInt(item.apelacion?.equipos?.telefonos || 0) > 0 && (
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-600 text-[10px] font-black">
                                <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                {item.apelacion.equipos.telefonos} Telf.
                              </div>
                            )}
                            {!item.apelacion?.equipos?.decos && !item.apelacion?.equipos?.repetidores && !item.apelacion?.equipos?.telefonos && (
                              <span className="text-[10px] text-slate-400 font-bold">Sólo revisión de puntos</span>
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 max-w-xs">
                          <div className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-medium">
                            "{item.apelacion?.observacion || 'Sin observaciones ingresadas.'}"
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div>
                            {item.apelacion?.status === 'por_validar' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                                <Clock className="w-2.5 h-2.5" /> Pendiente
                              </span>
                            )}
                            {item.apelacion?.status === 'aprobada' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Aprobada
                              </span>
                            )}
                            {item.apelacion?.status === 'rechazada' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-black uppercase tracking-wider shadow-sm">
                                <XCircle className="w-2.5 h-2.5" /> Rechazada
                              </span>
                            )}
                            
                            <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1.5 font-bold">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {item.apelacion?.fechaSolicitud 
                                ? new Date(item.apelacion.fechaSolicitud).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : new Date(item.fecha || item.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <button 
                            onClick={() => {
                              setSelectedAppeal(item);
                              setFeedback(item.apelacion?.respuesta || '');
                              setEvidenciaUrl(item.apelacion?.evidenciaUrl || '');
                              setOverrideData({
                                lpu: item.apelacion?.codigoLpu || '',
                                decos: item.apelacion?.equipos?.decos || item.Decos_Adicionales || 0,
                                repetidores: item.apelacion?.equipos?.repetidores || item.Repetidores_WiFi || 0,
                                telefonos: item.apelacion?.equipos?.telefonos || item.Telefonos || 0
                              });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-55/70 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200"
                          >
                            {item.apelacion?.status === 'por_validar' ? 'Evaluar' : 'Detalles'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: PRODUCCIÓN Y BAREMOS MENSUALES (CEO AUDITORÍA)                    */}
      {/* ========================================================================= */}
      {viewMode === 'bitacora' && (
        <div className="space-y-6">
          {/* Month Selector Bar */}
          <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 block">
                  Período de Producción - Auditoría CEO
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  Bitácora y Cálculo de Baremos: {MESES_NAMES[selectedMonthIndex].name} {selectedYear}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Año:</span>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>

            {/* Months Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {MESES_NAMES.map((m) => {
                const isSelected = selectedMonthIndex === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMonthIndex(m.id);
                      setSelectedTecnicoFiltro(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Técnicos Activos</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {resumenTramos.kpisGlobales.totalTecnicos}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                Con producción registrada
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total OTs del Mes</span>
                <Layers className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {resumenTramos.kpisGlobales.totalOTs.toLocaleString('es-CL')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                Órdenes técnicas completadas
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Puntos Totales Baremos</span>
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {resumenTramos.kpisGlobales.totalPuntos.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                Producción global generada
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-t-4 border-t-amber-500">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Puntos Calculables</span>
                <Target className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600 mt-2">
                {resumenTramos.kpisGlobales.totalCalculables.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                Descontando {resumenTramos.puntosNoCalculables} pts base
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm border-t-4 border-t-emerald-500 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bono Producción Total</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                ${resumenTramos.kpisGlobales.totalBonoProduccion.toLocaleString('es-CL')}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 font-semibold">
                Total estimado a pagar
              </div>
            </div>
          </div>

          {/* Sub-view Switcher (Tabla Producción y Tramos vs Bitácora Detallada de OTs) */}
          <div className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setBitacoraSubView('tramos');
                  setSelectedTecnicoFiltro(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  bitacoraSubView === 'tramos'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Tabla de Producción y Tramos por Técnico ({resumenTramos.tecnicos.length})
              </button>

              <button
                onClick={() => setBitacoraSubView('actividades')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  bitacoraSubView === 'actividades'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <FileText className="w-4 h-4" />
                Bitácora Detallada de Actividades / OTs {selectedTecnicoFiltro ? `(${selectedTecnicoFiltro.nombre})` : ''}
              </button>
            </div>

            {selectedTecnicoFiltro && (
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700">
                <span>Filtrando técnico: <strong>{selectedTecnicoFiltro.nombre}</strong></span>
                <button
                  onClick={() => setSelectedTecnicoFiltro(null)}
                  className="w-5 h-5 rounded-full bg-indigo-200 hover:bg-indigo-300 text-indigo-800 flex items-center justify-center font-black text-[10px]"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* SUB-VISTA 2.1: TABLA DE PRODUCCIÓN Y TRAMOS POR TÉCNICO */}
          {bitacoraSubView === 'tramos' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50/60">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar técnico por nombre, RUT o ID TOA..."
                    value={searchTecnicoTramo}
                    onChange={(e) => setSearchTecnicoTramo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-xl text-xs text-slate-800 placeholder-slate-450 outline-none transition-all font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                  <span>Regla Baremos:</span>
                  <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-black">
                    Puntos Base Excluidos: -{resumenTramos.puntosNoCalculables} pts
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                {loadingTramos ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-slate-500">Calculando producción y tramos de técnicos...</span>
                  </div>
                ) : filteredTecnicosTramos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <Users className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="text-sm font-black text-slate-700">No se encontraron técnicos con producción</h3>
                    <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
                      No hay registros de producción calculados para este mes en su empresa.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Técnico / RUT</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Días Trab.</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Total OTs</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Pts Totales</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Pts Calculables (-95)</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Tramo Alcanzado</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Bono Producción</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Apelaciones</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Auditoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredTecnicosTramos.map((tec) => (
                        <tr key={tec.id || tec.rut} className="hover:bg-slate-50/60 transition-all duration-150">
                          {/* Técnico */}
                          <td className="px-5 py-4">
                            <div>
                              <span className="text-xs font-black text-slate-900 block">{tec.nombre}</span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                <span>RUT: {formatRut(tec.rutFormateado || tec.rut)}</span>
                                <span className="text-sky-600 font-bold">TOA: {tec.idRecursoToa}</span>
                              </div>
                            </div>
                          </td>

                          {/* Días trabajados */}
                          <td className="px-5 py-4 text-center font-bold text-xs text-slate-700">
                            {tec.diasTrabajados} días
                          </td>

                          {/* Total OTs */}
                          <td className="px-5 py-4 text-center font-black text-xs text-slate-800">
                            {tec.totalOTs}
                          </td>

                          {/* Pts Totales */}
                          <td className="px-5 py-4 text-right font-mono font-black text-xs text-slate-900">
                            {tec.totalPuntos.toFixed(1)} pts
                          </td>

                          {/* Pts Calculables */}
                          <td className="px-5 py-4 text-right">
                            <span className={`font-mono font-black text-xs ${tec.puntosCalculables > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {tec.puntosCalculables.toFixed(1)} pts
                            </span>
                          </td>

                          {/* Tramo */}
                          <td className="px-5 py-4 text-center">
                            {tec.valorTramo > 0 ? (
                              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                ${tec.valorTramo.toLocaleString('es-CL')} c/u
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">Sin Tramo ($0)</span>
                            )}
                          </td>

                          {/* Bono Producción */}
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm font-black font-mono text-emerald-600">
                              ${tec.bonoBaremo.toLocaleString('es-CL')}
                            </span>
                          </td>

                          {/* Apelaciones */}
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {tec.apelaciones?.pendientes > 0 && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black" title="Pendientes">
                                  {tec.apelaciones.pendientes} Pend
                                </span>
                              )}
                              {tec.apelaciones?.aprobadas > 0 && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black" title="Aprobadas">
                                  {tec.apelaciones.aprobadas} Aprob
                                </span>
                              )}
                              {!tec.apelaciones?.pendientes && !tec.apelaciones?.aprobadas && (
                                <span className="text-[10px] text-slate-400 font-medium">—</span>
                              )}
                            </div>
                          </td>

                          {/* Auditoría / Ver OTs */}
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedTecnicoFiltro(tec);
                                setBitacoraSubView('actividades');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border border-indigo-200"
                            >
                              Ver OTs <ChevronRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SUB-VISTA 2.2: BITÁCORA DETALLADA DE ACTIVIDADES / OTS */}
          {bitacoraSubView === 'actividades' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Filters Bar */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50/60">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por OT, Técnico, RUT, Comuna, Actividad..."
                    value={bitacoraSearch}
                    onChange={(e) => setBitacoraSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 hover:border-slate-350 focus:border-indigo-500 rounded-xl text-xs text-slate-800 placeholder-slate-450 outline-none transition-all font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Estado:</span>
                  <select 
                    value={bitacoraFilterEstado}
                    onChange={(e) => setBitacoraFilterEstado(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="TODOS">Todos los Estados</option>
                    <option value="Completado">Completado</option>
                    <option value="Incompleto">Incompleto</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar">
                {bitacoraLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-slate-500">Cargando bitácora del mes...</span>
                  </div>
                ) : bitacoraData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <FileText className="w-12 h-12 text-slate-300 mb-3" />
                    <h3 className="text-sm font-black text-slate-700">No se encontraron actividades</h3>
                    <p className="text-xs text-slate-500 max-w-xs mt-1 font-medium">
                      No hay registros en el período seleccionado con los filtros aplicados.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha / OT</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Técnico Asignado</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Actividad / Cód LPU</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente / Dirección</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Equipos Ad.</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Pts Baremos</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Acción CEO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {bitacoraData.map((act) => {
                        const fechaStr = act.fecha ? new Date(act.fecha).toLocaleDateString('es-CL') : (act['Fecha de Cita'] || act.Fecha_de_Cita || 'S/F');
                        const otNumber = act.ordenId || act.peticion || act['Numero orden'] || act['Número orden'] || 'S/N';
                        const techName = act.NOMBRE || act.Nombre || act.tecnicoNombre || act['Técnico'] || 'Sin Técnico';
                        const techRut = act.RUT || act.rut || act.tecnicoRut || act['Rut'] || '';
                        const lpuCode = act.CODIGO_LPU_BASE || act.Codigo_LPU_Base || act.COD_LPU || act['Cód LPU'] || act.LPU_COD || 'SIN LPU';
                        const actName = act['Subtipo de Actividad'] || act.actividad || act.ACTIVIDAD || act.Desc_LPU_Base || 'Op. Técnica';
                        const ptsBase = parseFloat(act.Pts_Actividad_Base || act.PTS_ACTIVIDAD_BASE || 0);
                        const decos = parseInt(act.Decos_Adicionales || act.DECOS_ADICIONALES || 0);
                        const repetidores = parseInt(act.Repetidores_WiFi || act.REPETIDORES_WIFI || 0);
                        const telefonos = parseInt(act.Telefonos || act.TELEFONOS || 0);
                        const totalPts = parseFloat(act.PTS_TOTAL_BAREMO ?? act.ptsTotalBaremo ?? act.Pts_Total_Baremo ?? 0);
                        const hasAppealed = Boolean(act.apelacion?.status);

                        return (
                          <tr key={act._id} className="hover:bg-slate-50/60 transition-all duration-150">
                            {/* Fecha / OT */}
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-900 flex items-center gap-1">
                                  <Hash className="w-3 h-3 text-slate-400" />
                                  {otNumber}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {fechaStr}
                                </span>
                              </div>
                            </td>

                            {/* Técnico */}
                            <td className="px-5 py-4">
                              <div>
                                <span className="text-xs font-black text-slate-800 block truncate max-w-[200px]" title={techName}>
                                  {techName}
                                </span>
                                {techRut && (
                                  <span className="text-[10px] font-mono text-slate-500 block mt-0.5">
                                    RUT: {formatRut(techRut)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Actividad / LPU */}
                            <td className="px-5 py-4">
                              <div>
                                <span className="text-xs font-bold text-slate-800 block truncate max-w-[260px]" title={actName}>
                                  {actName}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono font-black text-slate-700">
                                    {lpuCode}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    Base: {ptsBase.toFixed(1)} pts
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Cliente / Dirección */}
                            <td className="px-5 py-4 max-w-[220px]">
                              <div>
                                <span className="text-xs font-bold text-slate-700 block truncate" title={act.Nombre || act['RUT del cliente']}>
                                  {act.Nombre || act.NOMBRE || act['RUT del cliente'] || 'Cliente TOA'}
                                </span>
                                <span className="text-[10px] text-slate-500 block truncate mt-0.5" title={act.Direccion || act.DIRECCION}>
                                  {[act.Comuna || act.COMUNA, act.Direccion || act.DIRECCION].filter(Boolean).join(' - ') || 'S/D'}
                                </span>
                              </div>
                            </td>

                            {/* Equipos Adicionales */}
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {decos > 0 && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[9px] font-black flex items-center gap-1" title={`${decos} Decos`}>
                                    <Tv className="w-3 h-3" /> {decos}
                                  </span>
                                )}
                                {repetidores > 0 && (
                                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-[9px] font-black flex items-center gap-1" title={`${repetidores} WiFi`}>
                                    <Wifi className="w-3 h-3" /> {repetidores}
                                  </span>
                                )}
                                {telefonos > 0 && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-black flex items-center gap-1" title={`${telefonos} Telf`}>
                                    <Phone className="w-3 h-3" /> {telefonos}
                                  </span>
                                )}
                                {decos === 0 && repetidores === 0 && telefonos === 0 && (
                                  <span className="text-[10px] text-slate-400 font-medium">—</span>
                                )}
                              </div>
                            </td>

                            {/* Total Puntos */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-black font-mono text-emerald-600">
                                  {totalPts.toFixed(1)} <span className="text-[10px] uppercase font-bold text-slate-400">pts</span>
                                </span>
                                {hasAppealed && (
                                  <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase mt-0.5">
                                    Apelado: {act.apelacion.status}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Acción CEO */}
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleOpenEditActivity(act)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 border border-indigo-200 shadow-sm"
                              >
                                <Edit3 className="w-3 h-3" /> Modificar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
                <span className="text-xs font-bold text-slate-500">
                  Mostrando {bitacoraData.length} de {bitacoraPagination.total} actividades
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={bitacoraPagination.page <= 1 || bitacoraLoading}
                    onClick={() => fetchBitacora(bitacoraPagination.page - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                  <span className="text-xs font-black text-slate-700 px-2">
                    Página {bitacoraPagination.page} de {bitacoraPagination.totalPages || 1}
                  </span>
                  <button
                    disabled={bitacoraPagination.page >= bitacoraPagination.totalPages || bitacoraLoading}
                    onClick={() => fetchBitacora(bitacoraPagination.page + 1)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-all"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EVALUACIÓN DE APELACIÓN INDIVIDUAL                                */}
      {/* ========================================================================= */}
      {selectedAppeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-scale-up text-slate-800">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Evaluación de Apelación</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">OT: {selectedAppeal.peticion || selectedAppeal.ordenId}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedAppeal(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 border border-slate-200 transition-all font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Technician Info */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-black text-slate-650 overflow-hidden">
                  {selectedAppeal.tecnicoAvatar ? (
                    <img src={selectedAppeal.tecnicoAvatar} alt={selectedAppeal.tecnicoNombre} className="w-full h-full object-cover" />
                  ) : (
                    String(selectedAppeal.tecnicoNombre || 'T').substring(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-950">{selectedAppeal.tecnicoNombre}</div>
                  <div className="flex flex-col text-[10px] text-slate-500 mt-0.5 font-bold gap-0.5">
                    <span>RUT: {formatRut(selectedAppeal.tecnicoRutFormateado || selectedAppeal.apelacion?.rut || selectedAppeal.rut)}</span>
                    <span className="text-[9px] text-sky-600 font-black tracking-wider uppercase">TOA ID Técnico: {selectedAppeal.tecnicoToaId || selectedAppeal.idRecursoToa || 'Sin ID TOA'}</span>
                  </div>
                </div>
              </div>

              {/* OT Info Details & Comparative Delta Table */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-600 block border-b border-slate-150 pb-1.5">Análisis Comparativo (TOA vs Apelación)</span>
                
                <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-inner">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-black uppercase text-[8px] text-slate-450 tracking-wider">
                        <th className="px-4 py-3">Campo / Parámetro</th>
                        <th className="px-4 py-3">Registrado en TOA</th>
                        <th className="px-4 py-3">Apelado por Técnico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Actividad LPU</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-bold text-slate-800">
                            {selectedAppeal.actividadVisible || selectedAppeal.Desc_LPU_Base || selectedAppeal.actividad || selectedAppeal['Tipo Trabajo'] || 'Op. Técnica'}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1.5 flex items-center gap-1 border-t border-slate-100 pt-1">
                            <span>Cód Asignado:</span>
                            <span className="font-bold text-slate-600 bg-slate-100 px-1 py-0.5 rounded">{selectedAppeal.CODIGO_LPU_BASE || selectedAppeal.Codigo_LPU_Base || selectedAppeal.COD_LPU || 'SIN LPU'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 bg-amber-50/20 font-bold text-amber-800">
                          {selectedAppeal.apelacion?.status === 'por_validar' ? (
                            <select
                              value={overrideData.lpu}
                              onChange={(e) => setOverrideData({...overrideData, lpu: e.target.value.toUpperCase()})}
                              className="w-full px-2 py-1 text-xs border border-amber-200 rounded outline-none focus:border-amber-400 bg-white font-mono uppercase"
                            >
                              <option value="">-- Código LPU --</option>
                              {tarifasLPU.map(t => (
                                <option key={t.codigo} value={t.codigo}>[{t.codigo}] {t.descripcion} ({t.puntos} pts)</option>
                              ))}
                            </select>
                          ) : (
                            selectedAppeal.apelacion?.codigoLpu ? (
                              <span className="font-black bg-amber-100/50 px-1 py-0.5 rounded">[{selectedAppeal.apelacion.codigoLpu}]</span>
                            ) : (
                              <span className="text-slate-400 italic">Sin cambios</span>
                            )
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Puntos Base</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">{selectedAppeal.Pts_Actividad_Base || selectedAppeal.PTS_ACTIVIDAD_BASE || 0} PTS</td>
                        <td className="px-4 py-3 bg-indigo-50/20 font-mono font-black text-indigo-700">
                          {selectedAppeal.apelacion?.puntosBase ? `${selectedAppeal.apelacion.puntosBase} PTS` : 'Sin cambios'}
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Decos Adicionales</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Decos_Adicionales || 0}</td>
                        <td className="px-4 py-3 font-mono font-black">
                          {selectedAppeal.apelacion?.status === 'por_validar' ? (
                            <input
                              type="number"
                              min="0"
                              value={overrideData.decos}
                              onChange={(e) => setOverrideData({...overrideData, decos: e.target.value})}
                              className="w-16 px-2 py-1 text-xs border border-emerald-200 rounded outline-none focus:border-emerald-400 bg-white"
                            />
                          ) : (
                            selectedAppeal.apelacion?.equipos?.decos || 0
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Repetidores WiFi</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Repetidores_WiFi || 0}</td>
                        <td className="px-4 py-3 font-mono font-black">
                          {selectedAppeal.apelacion?.status === 'por_validar' ? (
                            <input
                              type="number"
                              min="0"
                              value={overrideData.repetidores}
                              onChange={(e) => setOverrideData({...overrideData, repetidores: e.target.value})}
                              className="w-16 px-2 py-1 text-xs border border-emerald-200 rounded outline-none focus:border-emerald-400 bg-white"
                            />
                          ) : (
                            selectedAppeal.apelacion?.equipos?.repetidores || 0
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3 font-bold text-slate-500 bg-slate-50/50">Teléfonos (Voz)</td>
                        <td className="px-4 py-3 font-mono text-slate-800">{selectedAppeal.Telefonos || 0}</td>
                        <td className="px-4 py-3 font-mono font-black">
                          {selectedAppeal.apelacion?.status === 'por_validar' ? (
                            <input
                              type="number"
                              min="0"
                              value={overrideData.telefonos}
                              onChange={(e) => setOverrideData({...overrideData, telefonos: e.target.value})}
                              className="w-16 px-2 py-1 text-xs border border-emerald-200 rounded outline-none focus:border-emerald-400 bg-white"
                            />
                          ) : (
                            selectedAppeal.apelacion?.equipos?.telefonos || 0
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Justification Text */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-150 pb-1.5">Observación del Técnico</span>
                <p className="text-xs text-slate-700 mt-2 leading-relaxed italic bg-white p-3 border border-slate-150 rounded-xl font-medium">
                  "{selectedAppeal.apelacion?.observacion || 'Sin justificación ingresada.'}"
                </p>
              </div>

              {/* Feedback Input */}
              {selectedAppeal.apelacion?.status === 'por_validar' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <MessageSquare size={14} /> Retroalimentación del Supervisor / CEO
                    </h4>
                    <textarea
                      placeholder="Escriba un comentario o respuesta explicando la decisión..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-700 h-20 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-300 transition-all outline-none resize-none"
                    />
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                      <ImageIcon size={14} /> Respaldo / Evidencia (Opcional)
                    </h4>
                    <div className="flex items-center gap-4">
                      <label className={`flex items-center gap-2 px-4 py-2 ${uploadingImage ? 'bg-slate-200 text-slate-500' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'} rounded-lg font-bold text-xs cursor-pointer transition-colors border border-indigo-100 shadow-sm`}>
                        {uploadingImage ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
                        {uploadingImage ? 'Subiendo...' : 'Subir Imagen de Respaldo'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleImageUpload} 
                          disabled={uploadingImage}
                        />
                      </label>
                      {evidenciaUrl && (
                        <a href={evidenciaUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                          <CheckCircle2 size={14} /> Ver Imagen Adjunta
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
              <button 
                onClick={() => setSelectedAppeal(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-850 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cerrar
              </button>
              
              {selectedAppeal.apelacion?.status === 'por_validar' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleResolve('rechazada')}
                    disabled={submitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <button 
                    onClick={() => handleResolve('aprobada')}
                    disabled={submitting}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:from-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
                  >
                    Aprobar en Caliente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMACIÓN DE APROBACIÓN GENERAL MASIVA                        */}
      {/* ========================================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up text-slate-800 p-6">
            <div className="flex items-center gap-3 text-emerald-600 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-150 flex items-center justify-center">
                <CheckCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Aprobación General Masiva</h3>
                <p className="text-xs text-slate-500 font-semibold">Acción Administrativa Maestro / CEO</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4 font-medium">
              ¿Está seguro de aprobar las <strong className="text-emerald-600 font-black">{metrics.pending} apelaciones pendientes</strong> de su empresa de forma masiva?
              El motor de cálculo actualizará inmediatamente los baremos, decos y puntos en los dashboards de cada técnico.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-5 space-y-1.5 text-[11px] font-medium text-slate-600">
              <div className="flex justify-between">
                <span>Apelaciones a procesar:</span>
                <strong className="font-bold text-slate-800">{metrics.pending}</strong>
              </div>
              <div className="flex justify-between">
                <span>Recálculo de KPIs:</span>
                <strong className="text-emerald-600 font-bold">Automático en tiempo real</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                disabled={bulkApproving}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {bulkApproving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    Confirmar Aprobación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MODIFICACIÓN DIRECTA DE ACTIVIDAD / BAREMOS POR PARTE DEL CEO    */}
      {/* ========================================================================= */}
      {selectedActividadEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scale-up text-slate-800">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Modificar Actividad (Auditoría CEO)</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    OT: {selectedActividadEdit.ordenId || selectedActividadEdit.peticion || 'S/N'} — {selectedActividadEdit.NOMBRE || selectedActividadEdit.Nombre || 'Técnico'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedActividadEdit(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 border border-slate-200 transition-all font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Info básica */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Actividad Original:</span>
                  <strong className="text-slate-800 text-right truncate max-w-[240px]">
                    {selectedActividadEdit.actividad || selectedActividadEdit.ACTIVIDAD || selectedActividadEdit['Subtipo de Actividad'] || 'Op. Técnica'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Baremos Actual:</span>
                  <strong className="text-emerald-600 font-mono font-bold">
                    {(selectedActividadEdit.PTS_TOTAL_BAREMO ?? selectedActividadEdit.ptsTotalBaremo ?? 0)} pts
                  </strong>
                </div>
              </div>

              {/* Selector Código LPU */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Código LPU Asignado
                </label>
                <select
                  value={editFormData.codigoLpu}
                  onChange={(e) => {
                    const found = tarifasLPU.find(t => t.codigo === e.target.value);
                    setEditFormData({
                      ...editFormData,
                      codigoLpu: e.target.value,
                      puntosBase: found ? found.puntos : editFormData.puntosBase
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Mantener actual o seleccionar --</option>
                  {tarifasLPU.map(t => (
                    <option key={t.codigo} value={t.codigo}>
                      [{t.codigo}] {t.descripcion} ({t.puntos} pts)
                    </option>
                  ))}
                </select>
              </div>

              {/* Puntos Base Override */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Puntos Base Actividad
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={editFormData.puntosBase}
                  onChange={(e) => setEditFormData({ ...editFormData, puntosBase: e.target.value })}
                  placeholder="Ej: 1.5"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Equipos Adicionales Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-1">
                    Decos Ad.
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.decos}
                    onChange={(e) => setEditFormData({ ...editFormData, decos: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-indigo-500 outline-none text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-teal-600 mb-1">
                    WiFi Repetidor
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.repetidores}
                    onChange={(e) => setEditFormData({ ...editFormData, repetidores: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-teal-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-teal-500 outline-none text-center"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
                    Teléfonos
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.telefonos}
                    onChange={(e) => setEditFormData({ ...editFormData, telefonos: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 outline-none text-center"
                  />
                </div>
              </div>

              {/* Justificación CEO */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Motivo / Observación del CEO
                </label>
                <textarea
                  placeholder="Ej: Ajuste de baremos autorizado por gerencia por dificultad de terreno..."
                  value={editFormData.observacionCeo}
                  onChange={(e) => setEditFormData({ ...editFormData, observacionCeo: e.target.value })}
                  className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs font-medium text-slate-700 h-20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedActividadEdit(null)}
                disabled={savingEdit}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveActivityEdit}
                disabled={savingEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {savingEdit ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Guardar y Recalcular Baremos
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
